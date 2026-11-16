import { parseJsonBody, response, supabaseRpc, canonicalizeUrl } from './_supabase.mjs'

export const config = {
  path: '/api/visitor-write',
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ['ip', 'domain'] },
}

export function validateVisitorWrite(body) {
  const text = (key, max, required = false) => {
    if (body[key] !== undefined && typeof body[key] !== 'string') throw new Error(`Invalid ${key}`)
    const value = (body[key] || '').trim()
    if (value.length > max || (required && !value)) throw new Error(`Invalid ${key}`)
    return value
  }
  const uuid = key => {
    const value = text(key, 36, true)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new Error(`Invalid ${key}`)
    return value
  }
  switch (body.action) {
    case 'research_source': {
      const url = new URL(text('url', 4096, true))
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid URL')
      const type = text('type', 20, true)
      if (!['podcast', 'video', 'document'].includes(type)) throw new Error('Invalid source type')
      return { action: body.action, topicId: uuid('topicId'), url: canonicalizeUrl(url.href), type, title: text('title',500), publisher: text('publisher',300), description: text('description',12000), body: text('body',2000000), scope: body.scope === 'full' ? 'full' : 'excerpt', language: ['en','zh','mixed','other'].includes(body.language) ? body.language : 'unknown' }
    }
    case 'capture': {
      const url = new URL(text('url', 4096, true))
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid URL')
      return { action: 'capture', url: canonicalizeUrl(url.href), title: text('title', 500), contributor: text('contributor', 80) || 'Anonymous', topicId: body.topicId ? uuid('topicId') : null }
    }
    case 'create_trend':
      return { action: body.action, title: text('title', 300, true), category: text('category', 40, true), observation: text('observation', 10000), initialRead: text('initialRead', 10000), discussionQuestion: text('discussionQuestion', 3000) }
    case 'link_trend_source':
    case 'unlink_trend_source':
      return { action: body.action, trendId: uuid('trendId'), newsId: uuid('newsId') }
    default: throw new Error('Unsupported visitor operation')
  }
}

export async function handler(event) {
  if (process.env.PUBLIC_WORKSPACE_ENABLED !== 'true') return response(503, { error: 'Public submissions are not enabled.' }, {}, event)
  if (event.httpMethod !== 'POST') return response(405, { error: 'Method not allowed' }, { allow: 'POST' }, event)
  const parsed = parseJsonBody(event, 2100 * 1024)
  if (!parsed.value) return response(parsed.statusCode, { error: parsed.error }, {}, event)
  let input
  try { input = validateVisitorWrite(parsed.value) }
  catch (error) { return response(400, { error: error.message }, {}, event) }
  try {
    const result = await supabaseRpc(input.action === 'research_source' ? 'visitor_research_source' : 'visitor_write', { p_input: input })
    return response(200, { result }, {}, event)
  } catch {
    return response(409, { error: 'Could not save. The source or trend may have changed; refresh and retry.' }, {}, event)
  }
}
