import { JSDOM } from 'jsdom'
import { canonicalizeUrl } from '../netlify/functions/_supabase.mjs'
import { fetchPublicText } from '../netlify/functions/_radar.mjs'

export function cleanArticleUrl(value) {
  const u = new URL(canonicalizeUrl(value))
  if (u.protocol !== 'https:' || u.username || u.password || /unsubscribe|preferences|opt.out|\/ls\/click|\/login|\/confirm/i.test(u.href)) throw Error('Not a publisher article URL')
  for (const key of [...u.searchParams.keys()]) if (/^(utm_|cio_|mc_|trk$|ref$)/i.test(key)) u.searchParams.delete(key)
  return u.toString()
}
export const urlKey = value => cleanArticleUrl(value).replace(/\/$/, '')
export function matchingTitle(a, b) {
  const words = value => new Set(String(value).toLowerCase().match(/[a-z0-9]{3,}/g) || [])
  const left = words(a), right = words(b)
  return left.size >= 3 && [...left].filter(word => right.has(word)).length / left.size >= 0.6
}
export function parseArticleEvidence(html, requestedUrl, expectedTitle, now = new Date()) {
  const document = new JSDOM(html).window.document
  const title = document.querySelector('meta[property="og:title"]')?.content || document.querySelector('h1')?.textContent || document.title
  if (!matchingTitle(expectedTitle, title)) throw Error('Publisher title could not be matched')
  const url = cleanArticleUrl(new URL(document.querySelector('link[rel="canonical"]')?.href || requestedUrl, requestedUrl).href)
  if (new URL(url).hostname !== new URL(requestedUrl).hostname) throw Error('Cross-domain canonical requires review')
  const dates = [...document.querySelectorAll('meta[property="article:published_time"],meta[name="datePublished"],meta[itemprop="datePublished"]')].map(node => node.content)
  function visit(value) {
    if (!value || typeof value !== 'object') return
    if (/Article|NewsArticle|BlogPosting/.test(String(value['@type'] || '')) && value.datePublished) dates.push(value.datePublished)
    for (const child of Object.values(value)) if (typeof child === 'object') Array.isArray(child) ? child.forEach(visit) : visit(child)
  }
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) { try { visit(JSON.parse(script.textContent)) } catch {} }
  const unique = [...new Set(dates.filter(date => /^\d{4}-\d\d-\d\d(?:$|T.*(?:Z|[+-]\d\d:\d\d)$)/.test(date)))]
  if (!unique.length || new Set(unique.map(date => date.slice(0, 10))).size !== 1) throw Error('Original publication date missing or conflicting')
  const raw = unique.find(date => date.includes('T')) || unique[0]
  const published = new Date(raw)
  if (!Number.isFinite(+published) || +published > +now) throw Error('Publication date is invalid or in the future')
  return { url, title: title.trim(), publishedAt: published.toISOString(), datePrecision: raw.length === 10 ? 'day' : 'timestamp', dateEvidence: `Publisher datePublished/article:published_time: ${raw}`, urlVerified: true, urlEvidence: `Fetched publisher page, matched title and canonical URL: ${url}` }
}
export async function verifyArticle(url, title) {
  const response = await fetchPublicText(cleanArticleUrl(url), /html/i)
  return parseArticleEvidence(response.text, response.url, title)
}
