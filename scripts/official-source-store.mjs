import { canonicalizeUrl, supabase } from '../netlify/functions/_supabase.mjs'
import { storySignature, topicSlugsFor } from '../netlify/functions/_radar.mjs'

export function officialHost(url, domain) {
  const u = new URL(url)
  return u.protocol === 'https:' && !u.username && !u.password &&
    (u.hostname === domain || u.hostname.endsWith('.' + domain))
}

export function validateAgentItem(item, source, now = new Date()) {
  if (!officialHost(item.url, source.domain)) throw Error('Article must use its official source domain')
  const published = new Date(item.publishedAt)
  if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(item.publishedAt || '') || !Number.isFinite(+published) ||
      +published > +now || +published < +now - 7 * 86400000) throw Error('Original publication date must be within the past seven days')
  if (item.articleRead !== true || typeof item.dateEvidence !== 'string' || item.dateEvidence.length < 10) throw Error('Read the article and record original date evidence')
  if (typeof item.promote !== 'boolean') throw Error('Promotion must be an explicit boolean decision')
  if (!item.title?.trim() || item.title.length > 500 || !item.summary || item.summary.length < 60) throw Error('A factual English title and summary are required')
  const topics = topicSlugsFor(item.title + ' ' + item.summary)
  if (!topics.length) throw Error('Article has no supported intelligence topic; do not force a trend')
  if (item.promote && (!item.importanceReason || item.importanceReason.length < 40)) throw Error('Promotion needs a specific evidence-backed reason')
  if (item.promote && !['interaction','ai_software','ai_hardware','ecosystem','ai_capability','industry_events'].includes(item.category)) throw Error('Promotion needs one existing news category')
  return { ...item, url: canonicalizeUrl(item.url), topics }
}

export async function saveRadarCandidates(source, items, method) {
  // URL is stable across RSS GUID changes and Agent rescans. Keep existing evidence unchanged.
  const existing = await supabase(`radar_items?source_id=eq.${source.id}&select=canonical_url,external_id`)
  const urls = new Set(existing.map(n => canonicalizeUrl(n.canonical_url)))
  const rows = []
  for (const item of items) {
    const url = canonicalizeUrl(item.url)
    const topics = item.topics || topicSlugsFor(item.title + ' ' + item.summary)
    if (urls.has(url) || !topics.length) continue
    urls.add(url)
    rows.push({ source_id:source.id,external_id:method === 'rss' ? String(item.externalId || url).slice(0,500) : url,
      canonical_url:url,title:item.title.slice(0,500),summary:item.summary.slice(0,2000),author:item.author || '',
      published_at:item.publishedAt,story_key:storySignature(item.title),topic_slugs:topics,
      raw_metadata:{acquisition_method:method,date_evidence:item.dateEvidence || 'Original RSS publication date',
        article_read:item.articleRead === true,importance_reason:item.importanceReason || ''} })
  }
  if (rows.length) await supabase('radar_items?on_conflict=source_id,external_id', {
    method:'POST',headers:{prefer:'resolution=ignore-duplicates'},body:JSON.stringify(rows),
  })
  return rows.length
}

export async function promoteOfficialItem(item, source) {
  const url=canonicalizeUrl(item.url)
  const existing=await supabase(`news_items?canonical_url=eq.${encodeURIComponent(url)}&select=id,deleted_at`)
  if (existing.length) return {result:'already-exists',id:existing[0].id}
  const now=new Date().toISOString()
  const relationships=(item.relationships || []).map(r=>{
    if (!/^entity:[\w .&-]{1,80}$/.test(r.from || '') || !/^entity:[\w .&-]{1,80}$/.test(r.to || '') ||
      r.from===r.to || !['partnership','integration','cloud','hardware','distribution'].includes(r.kind) ||
      typeof r.evidence !== 'string' || r.evidence.length < 30) throw Error('Relationships need explicit endpoints and article evidence')
    return {from:r.from,to:r.to,kind:r.kind,evidence_url:url,verified:true,evidence:r.evidence}
  })
  const rows=await supabase('news_items?on_conflict=canonical_url', {method:'POST',headers:{prefer:'resolution=ignore-duplicates,return=representation'},
    body:JSON.stringify({canonical_url:url,title:item.title,source:new URL(url).hostname,summary:item.summary,raw_text:item.summary,
      category:item.category,published_at:item.publishedAt,captured_at:now,captured_by:null,captured_via:'automation',source_type:'captured_news',
      editorial_status:'pending',metadata:{contributor_name:'Agent',imported_from:'official-website-weekly-scan',radar_source_id:source.id,
        acquisition_method:'website_agent',publication_date_precision:item.publishedAt.length===10?'day':'timestamp',
        publication_date_basis:item.dateEvidence,selection_reason:item.importanceReason,company_relationships:relationships,news_facts:[item.summary]}})})
  return {result:rows.length?'inserted':'already-exists',id:rows[0]?.id}
}
