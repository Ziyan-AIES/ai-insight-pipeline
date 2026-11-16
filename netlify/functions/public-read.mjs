import { response, supabase } from './_supabase.mjs'

export const config = { path: '/api/public-read' }
// Explicit projections: never expose member directories, raw transcripts, jobs,
// audit records, arbitrary metadata, or a client-supplied PostgREST query.
const pick = (value, keys) => Object.fromEntries(keys.filter(key => value && Object.hasOwn(value, key)).map(key => [key, value[key]]))
export function publicTopic(row) {
  const analysis = pick(row.analysis, ['description','authorName','workflowStage','keyQuestion','observed','currentView','implications','watch'])
  analysis.products = (Array.isArray(row.analysis?.products) ? row.analysis.products : []).map(product => pick(product, ['id','name','description','company','url','logoUrl','screenshotUrl','companyDescription','foundedDate','launchDate','launchKind']))
  const outputs = (Array.isArray(row.outputs) ? row.outputs : []).map(output => {
    const result = pick(output, ['id','kind','title','dateLabel','link','description'])
    if (output.content) result.content = { ...pick(output.content,['format','author','revision']), blocks:(Array.isArray(output.content.blocks) ? output.content.blocks : []).map(block => pick(block,['id','type','text','imageUrl','caption'])) }
    return result
  })
  const {owner_id, ...publicRow} = row
  return {...publicRow, analysis, outputs}
}
export const publicResources = {
  researchSources: ['research_topic_sources', 'linked_at,research_sources!inner(id,type,url,title,publisher,language,description,published_at,created_at,version)', 'unlinked_at=is.null&research_sources.deleted_at=is.null&order=linked_at.desc,source_id'],
  news: ['news_items', 'id,canonical_url,title,source,summary,takeaway,category,captured_at,published_at,image_url,editorial_status,metadata,updated_at,version,source_type,topic_news(deleted_at,topics(id,title,scheduled_month,deleted_at))', 'deleted_at=is.null&order=captured_at.desc,id'],
  topics: ['topics', 'id,title,category,status,kind,thread_status,scheduled_month,created_at,updated_at,version,display_order,owner_id,analysis,outputs,topic_news(news_id,deleted_at)', 'deleted_at=is.null&order=created_at.desc,id'],
  trends: ['trends', 'id,title,category,observation,initial_read,discussion_question,status,created_at,updated_at,version,display_order,trend_news(news_id,evidence_role,display_order,linked_at,deleted_at),trend_topics(topic_id,deleted_at)', 'deleted_at=is.null&order=created_at.desc,id'],
  radarSources: ['radar_sources', 'id,name,domain,homepage_url,source_type,connector_type,enabled,priority,display_order,last_fetched_at,last_success_at', 'deleted_at=is.null&order=display_order,id'],
  radarItems: ['radar_items', 'id,source_id,external_id,canonical_url,title,summary,author,published_at,story_key,topic_slugs,engagement,radar_sources(name,source_type)', 'order=published_at.desc,id'],
  briefs: ['editorial_readouts', 'lede,bullets,generated_at', 'generated_by=eq.signal-reference-v1&order=generated_at.desc'],
}

export async function handler(event) {
  if (process.env.PUBLIC_WORKSPACE_ENABLED !== 'true') return response(503, { error: 'Public access is not enabled.' }, {}, event)
  if (event.httpMethod !== 'GET') return response(405, { error: 'Method not allowed' }, { allow: 'GET' }, event)
  const { resource, offset = '0', topicId } = event.queryStringParameters || {}
  if (!Object.hasOwn(publicResources, resource || '') || !/^\d{1,7}$/.test(offset)) return response(400, { error: 'Invalid public resource' }, {}, event)
  const [table, fields, filters] = publicResources[resource]
  if (resource === 'researchSources' && !/^[0-9a-f-]{36}$/i.test(topicId || '')) return response(400, {error:'Invalid topic'}, {}, event)
  const topicFilter = resource === 'researchSources' ? `&topic_id=eq.${encodeURIComponent(topicId)}` : ''
  const recent = resource === 'radarItems' ? `&published_at=gte.${encodeURIComponent(new Date(Date.now() - 60 * 86400000).toISOString())}` : ''
  try {
    const data = await supabase(`${table}?select=${encodeURIComponent(fields)}&${filters}${recent}${topicFilter}&offset=${offset}&limit=${resource === 'briefs' ? 10 : 250}`)
    if (resource === 'topics') {
      const ownerIds = [...new Set((data || []).filter(row=>row.analysis?.authorName == null && row.owner_id).map(row=>row.owner_id))]
      if (ownerIds.length) {
        const members = await supabase(`team_members?select=user_id,display_name&user_id=in.(${ownerIds.map(id=>encodeURIComponent(id)).join(',')})`)
        const names = new Map(members.map(member=>[member.user_id, member.display_name || 'Team member']))
        for (const row of data) if (row.analysis?.authorName == null && row.owner_id) row.analysis = {...row.analysis,authorName:names.get(row.owner_id) || 'Team member'}
      }
    }
    for (const row of data || []) {
      if (resource === 'news') row.metadata = {...pick(row.metadata,['language','original_language','content_type']),contributor_name: typeof row.metadata?.contributor_name === 'string' ? row.metadata.contributor_name.slice(0,80) : 'Anonymous'}
      for (const key of ['topic_news', 'trend_news', 'trend_topics']) {
        if (Array.isArray(row[key])) row[key] = row[key].filter(link => !link.deleted_at && !link.topics?.deleted_at)
      }
    }
    return response(200, { data: resource === 'topics' ? data.map(publicTopic) : data }, { 'cache-control': 'public, max-age=30, s-maxage=60' }, event)
  } catch {
    return response(503, { error: 'Public content could not be loaded. Please retry.' }, {}, event)
  }
}
