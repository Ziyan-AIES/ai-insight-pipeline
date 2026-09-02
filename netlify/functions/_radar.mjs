import crypto from 'node:crypto'
import { lookup } from 'node:dns/promises'
import ipaddr from 'ipaddr.js'
import { Agent as UndiciAgent, fetch as undiciFetch } from 'undici-pinned'
import { canonicalizeUrl, supabase } from './_supabase.mjs'

const USER_AGENT = 'QiraIndustryRadar/0.1 (+https://aiinsightpipeline.netlify.app)'
const MAX_FEED_BYTES = 2 * 1024 * 1024

const topicRules = [
  ['ai-agents', /\b(agentic|agents?|copilots?|assistants?|autonomous|automation|orchestrat(?:e|ion))\b/i],
  ['ai-coding', /\b(coding|code generation|developer tools?|software engineering|programming|ide\b|repository|vibe cod)/i],
  ['creative-ai', /\b(image generation|video generation|generative (?:video|image|media)|avatars?|creative ai|text.to.video|diffusion)/i],
  ['voice-ai', /\b(voice|speech|audio|text.to.speech|tts\b|speech.to.text|transcri)/i],
  ['ai-search', /\b(ai search|search engine|browser|web search|answer engine|retrieval)/i],
  ['enterprise-ai', /\b(enterprise|business|workplace|saas|workflow|customer service|sales|productivity)/i],
  ['ai-hardware', /\b(gpu|chips?|semiconductor|inference hardware|data cent(?:er|re)|robotics?|robots?|wearables?|devices?)/i],
  ['open-models', /\b(open source|open.source|open weights?|hugging face|llama|mistral)/i],
  ['model-capabilities', /\b(llm|large language model|foundation model|reasoning model|multimodal|context window|benchmark)/i],
  ['ai-reliability', /\b(evals?|evaluation|reliab|observability|hallucination|guardrails?|data quality|monitoring)/i],
  ['consumer-ai', /\b(consumer|personal ai|companion|mobile app|creator|social|shopping)/i],
  ['ai-deals', /\b(funding|raises? \$|valuation|acqui(?:res|red|sition)|merger|investment|venture capital|seed round|series [a-f])/i],
  ['ai-policy', /\b(policy|regulat|safety|copyright|governance|lawmakers?|legislation|responsible ai)/i],
]

const aiGate = /\b(ai|artificial intelligence|machine learning|llm|gpt|claude|gemini|copilot|neural|generative|agents?|robots?|inference|foundation model)\b/i
const stopWords = new Set(
  'a an and are as at be by for from has have how in into is it its new of on or that the their this to with will your ai artificial intelligence says launches launch unveils'.split(' '),
)

function decodeXml(value = '') {
  return String(value)
    .replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/i, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .trim()
}

function plainText(value = '') {
  return decodeXml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tag(block, names) {
  for (const name of names) {
    const paired = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'))
    if (paired) return decodeXml(paired[1])
    const attribute = block.match(new RegExp(`<${name}\\b[^>]*(?:href|url)=["']([^"']+)["'][^>]*>`, 'i'))
    if (attribute) return decodeXml(attribute[1])
  }
  return ''
}

function absoluteUrl(value, baseUrl) {
  try {
    return canonicalizeUrl(new URL(plainText(value), baseUrl).toString())
  } catch {
    return ''
  }
}

export function parseFeed(xml, baseUrl) {
  const itemBlocks = [...String(xml).matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
  return itemBlocks
    .map((match) => {
      const block = match[2]
      const title = plainText(tag(block, ['title']))
      const link = absoluteUrl(tag(block, ['link', 'atom:link']), baseUrl)
      const externalId = plainText(tag(block, ['guid', 'id'])) || link
      const publishedRaw = plainText(tag(block, ['pubDate', 'published', 'updated', 'dc:date']))
      const publishedAt = new Date(publishedRaw || Date.now())
      return {
        externalId,
        url: link,
        title,
        summary: plainText(tag(block, ['description', 'summary', 'content:encoded', 'content'])).slice(0, 1200),
        author: plainText(tag(block, ['author', 'dc:creator'])).slice(0, 200),
        publishedAt: Number.isNaN(publishedAt.getTime()) ? new Date().toISOString() : publishedAt.toISOString(),
        engagement: {},
        rawMetadata: {},
      }
    })
    .filter((item) => item.title && item.url)
}

function privateHostname(hostname) {
  const value = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (value === 'localhost' || value.endsWith('.localhost') || value.endsWith('.local')) return true
  if (!ipaddr.isValid(value)) return false
  let address = ipaddr.parse(value)
  if (address.kind() === 'ipv6' && address.isIPv4MappedAddress()) address = address.toIPv4Address()
  return address.range() !== 'unicast'
}

async function publicTarget(value) {
  const url = new URL(canonicalizeUrl(value))
  if (privateHostname(url.hostname)) throw new Error('Private source URLs are not allowed')
  const addresses = await lookup(url.hostname, { all: true, verbatim: true })
  if (!addresses.length || addresses.some((entry) => privateHostname(entry.address))) {
    throw new Error('Source URL resolves to a private address')
  }
  return { url, address: addresses[0].address, family: addresses[0].family }
}

export async function fetchPublicText(value, accepted = /xml|rss|atom|html|text/i) {
  let current = value
  for (let redirect = 0; redirect <= 4; redirect += 1) {
    const { url, address, family } = await publicTarget(current)
    const dispatcher = new UndiciAgent({
      connect: { lookup: (_hostname, _options, callback) => callback(null, address, family) },
    })
    try {
      const result = await undiciFetch(url, {
        dispatcher,
        redirect: 'manual',
        headers: { 'user-agent': USER_AGENT, accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8' },
        signal: AbortSignal.timeout(12000),
      })
      if (result.status >= 300 && result.status < 400) {
        const location = result.headers.get('location')
        await result.body?.cancel()
        if (!location) throw new Error(`Source redirected without a location (${result.status})`)
        current = new URL(location, url).toString()
        continue
      }
      if (!result.ok) throw new Error(`Source returned ${result.status}`)
      const contentType = result.headers.get('content-type') || ''
      if (!accepted.test(contentType) && !contentType.includes('octet-stream')) {
        await result.body?.cancel()
        throw new Error(`Unsupported source content type: ${contentType || 'unknown'}`)
      }
      const declared = Number(result.headers.get('content-length') || 0)
      if (declared > MAX_FEED_BYTES) {
        await result.body?.cancel()
        throw new Error('Source response is too large')
      }
      const text = await result.text()
      if (Buffer.byteLength(text, 'utf8') > MAX_FEED_BYTES) throw new Error('Source response is too large')
      return { url: url.toString(), contentType, text }
    } finally {
      await dispatcher.close()
    }
  }
  throw new Error('Too many source redirects')
}

function htmlTitle(html, fallback) {
  return plainText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || fallback)
    .replace(/\s+[|–—-].*$/, '')
    .trim()
}

function feedLinks(html, pageUrl) {
  const links = []
  for (const tagText of html.match(/<link\b[^>]*>/gi) || []) {
    const rel = tagText.match(/\brel=["']([^"']+)["']/i)?.[1] || ''
    const type = tagText.match(/\btype=["']([^"']+)["']/i)?.[1] || ''
    const href = tagText.match(/\bhref=["']([^"']+)["']/i)?.[1] || ''
    if (!/alternate/i.test(rel) || !/(rss|atom|xml)/i.test(type) || !href) continue
    try {
      links.push(new URL(decodeXml(href), pageUrl).toString())
    } catch {
      // Ignore malformed discovery links.
    }
  }
  return [...new Set(links)]
}

export async function probeSource(value) {
  const first = await fetchPublicText(value)
  const looksLikeFeed = /<(rss|feed|rdf:RDF)\b/i.test(first.text)
  let homepageUrl = first.url
  let feedUrl = first.url
  let feedText = first.text
  let name = ''
  if (!looksLikeFeed) {
    name = htmlTitle(first.text, new URL(first.url).hostname)
    const candidates = feedLinks(first.text, first.url)
    if (!candidates.length) throw new Error('No RSS or Atom feed was advertised by this website')
    feedUrl = candidates[0]
    const feed = await fetchPublicText(feedUrl)
    feedUrl = feed.url
    feedText = feed.text
  } else {
    homepageUrl = new URL('/', first.url).toString()
  }
  const parsed = parseFeed(feedText, feedUrl)
  if (!parsed.length) throw new Error('The feed was found but no readable entries were returned')
  if (!name) name = plainText(tag(feedText, ['title'])) || new URL(homepageUrl).hostname
  return {
    name: name.slice(0, 120),
    homepageUrl,
    feedUrl,
    preview: parsed.slice(0, 5).map((item) => ({ title: item.title, url: item.url, publishedAt: item.publishedAt })),
  }
}

export function topicSlugsFor(value, sourceType = 'industry_news') {
  const text = plainText(value)
  if (!aiGate.test(text)) return []
  const topics = topicRules.filter(([, pattern]) => pattern.test(text)).map(([slug]) => slug)
  if (!topics.length && sourceType === 'product_discovery') topics.push('ai-products')
  if (!topics.length) topics.push('model-capabilities')
  return [...new Set(topics)]
}

export function storyTokens(title) {
  return plainText(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((token) => token.length > 2 && !stopWords.has(token))
}

export function titleSimilarity(left, right) {
  const a = new Set(storyTokens(left))
  const b = new Set(storyTokens(right))
  if (!a.size || !b.size) return 0
  const overlap = [...a].filter((token) => b.has(token)).length
  return overlap / (a.size + b.size - overlap)
}

export function storySignature(title) {
  const tokens = [...new Set(storyTokens(title))].sort().slice(0, 12)
  return crypto.createHash('sha256').update(tokens.join('|')).digest('hex').slice(0, 24)
}

function normalizeCandidate(source, candidate) {
  const topics = topicSlugsFor(
    `${candidate.title} ${candidate.summary} ${(candidate.rawMetadata?.topics || []).join(' ')}`,
    source.source_type,
  )
  if (!topics.length) return null
  return {
    source_id: source.id,
    external_id: String(candidate.externalId || candidate.url).slice(0, 500),
    canonical_url: canonicalizeUrl(candidate.url),
    title: plainText(candidate.title).slice(0, 500),
    summary: plainText(candidate.summary).slice(0, 2000),
    author: plainText(candidate.author).slice(0, 200),
    published_at: candidate.publishedAt,
    discovered_at: new Date().toISOString(),
    story_key: storySignature(candidate.title),
    topic_slugs: topics,
    engagement: candidate.engagement || {},
    raw_metadata: candidate.rawMetadata || {},
  }
}

async function productHuntItems(source) {
  const clientId = process.env.PRODUCTHUNT_CLIENT_ID || ''
  const clientSecret = process.env.PRODUCTHUNT_CLIENT_SECRET || ''
  if (!clientId || !clientSecret) throw new Error('Product Hunt credentials are missing')
  const tokenResult = await fetch('https://api.producthunt.com/v2/oauth/token', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }),
    signal: AbortSignal.timeout(12000),
  })
  if (!tokenResult.ok) throw new Error(`Product Hunt authentication returned ${tokenResult.status}`)
  const token = (await tokenResult.json()).access_token
  if (!token) throw new Error('Product Hunt did not return an access token')
  const postedAfter = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
  const query = `query RadarPosts($after: DateTime!) {
    posts(first: 60, order: NEWEST, postedAfter: $after) {
      edges { node { id name tagline description url website createdAt votesCount commentsCount topics(first: 8) { edges { node { name slug } } } } }
    }
  }`
  const result = await fetch('https://api.producthunt.com/v2/api/graphql', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables: { after: postedAfter } }),
    signal: AbortSignal.timeout(15000),
  })
  const body = await result.json().catch(() => ({}))
  if (!result.ok || body.errors) throw new Error(`Product Hunt query failed (${result.status})`)
  return (body.data?.posts?.edges || []).map(({ node }) => ({
    externalId: `producthunt:${node.id}`,
    url: node.url,
    title: node.name,
    summary: [node.tagline, node.description].filter(Boolean).join('. '),
    author: '',
    publishedAt: node.createdAt,
    engagement: { votes: node.votesCount, comments: node.commentsCount },
    rawMetadata: {
      website: node.website,
      topics: (node.topics?.edges || []).map((edge) => edge.node.name),
      source: source.name,
    },
  }))
}

async function hackerNewsItems() {
  const idsResult = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json', {
    headers: { 'user-agent': USER_AGENT },
    signal: AbortSignal.timeout(10000),
  })
  if (!idsResult.ok) throw new Error(`Hacker News returned ${idsResult.status}`)
  const ids = (await idsResult.json()).slice(0, 80)
  const stories = await Promise.all(
    ids.map(async (id) => {
      const result = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
        headers: { 'user-agent': USER_AGENT },
        signal: AbortSignal.timeout(10000),
      })
      return result.ok ? result.json() : null
    }),
  )
  return stories.filter(Boolean).map((story) => ({
    externalId: `hn:${story.id}`,
    url: `https://news.ycombinator.com/item?id=${story.id}`,
    title: story.title,
    summary: '',
    author: story.by || '',
    publishedAt: new Date(Number(story.time || 0) * 1000).toISOString(),
    engagement: { score: story.score || 0, comments: story.descendants || 0 },
    rawMetadata: { original_url: story.url || '' },
  }))
}

async function fetchSource(source) {
  if (source.connector_type === 'producthunt') return productHuntItems(source)
  if (source.connector_type === 'hacker_news') return hackerNewsItems(source)
  if (!source.feed_url) throw new Error('RSS URL is missing')
  const feed = await fetchPublicText(source.feed_url)
  return parseFeed(feed.text, feed.url)
}

function assignExistingStoryKeys(items, existing) {
  const compared = [...existing]
  return items.map((item) => {
    let best = null
    let bestScore = 0
    for (const candidate of compared) {
      const score = titleSimilarity(item.title, candidate.title)
      const sharedTokens = storyTokens(item.title).filter((token) => storyTokens(candidate.title).includes(token)).length
      if (sharedTokens >= 3 && score > bestScore) {
        best = candidate
        bestScore = score
      }
    }
    if (best && bestScore >= 0.52) item.story_key = best.story_key
    compared.push(item)
    return item
  })
}

async function saveItems(items) {
  let saved = 0
  for (let index = 0; index < items.length; index += 100) {
    const chunk = items.slice(index, index + 100)
    if (!chunk.length) continue
    const result = await supabase('radar_items?on_conflict=source_id,external_id', {
      method: 'POST',
      headers: { prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(chunk),
    })
    saved += Array.isArray(result) ? result.length : chunk.length
  }
  return saved
}

async function recordSourceResult(source, error = null) {
  const now = new Date().toISOString()
  await supabase(`radar_sources?id=eq.${encodeURIComponent(source.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      last_fetched_at: now,
      last_success_at: error ? source.last_success_at : now,
      last_error: error ? String(error.message || error).slice(0, 500) : '',
      updated_at: now,
    }),
  })
}

export async function runRadarIngest() {
  const sources = await supabase(
    'radar_sources?enabled=eq.true&deleted_at=is.null&select=*&order=display_order.asc',
  )
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
  const existing = await supabase(
    `radar_items?published_at=gte.${encodeURIComponent(since)}&select=title,story_key,published_at`,
  )
  let fetched = 0
  let inserted = 0
  let failed = 0
  const results = await Promise.allSettled(
    (sources || []).map(async (source) => {
      try {
        const raw = await fetchSource(source)
        fetched += raw.length
        const normalized = raw
          .map((item) => normalizeCandidate(source, item))
          .filter(Boolean)
          .filter((item) => new Date(item.published_at).getTime() >= Date.now() - 60 * 24 * 60 * 60 * 1000)
        const withStories = assignExistingStoryKeys(normalized, existing || [])
        inserted += await saveItems(withStories)
        await recordSourceResult(source)
        return { source: source.name, fetched: raw.length, saved: withStories.length }
      } catch (error) {
        failed += 1
        await recordSourceResult(source, error).catch(() => undefined)
        throw new Error(`${source.name}: ${error.message || error}`)
      }
    }),
  )
  return {
    fetched,
    inserted,
    failed,
    sources: results.map((result) =>
      result.status === 'fulfilled' ? result.value : { error: result.reason.message },
    ),
  }
}
