import {
  canonicalizeUrl,
  handleOptions,
  requireExtensionToken,
  response,
  supabase,
} from './_supabase.mjs'

export async function handler(event) {
  const options = handleOptions(event)
  if (options) return options
  if (event.httpMethod !== 'GET') {
    return response(405, { ok: false, error: 'Method not allowed' })
  }
  const denied = requireExtensionToken(event)
  if (denied) return denied

  let canonicalUrl = ''
  try {
    canonicalUrl = canonicalizeUrl(event.queryStringParameters?.url || '')
  } catch {
    return response(400, { ok: false, error: 'A valid URL is required' })
  }

  try {
    const encoded = encodeURIComponent(canonicalUrl)
    const rows = await supabase(
      `news_items?select=id,editorial_status&canonical_url=eq.${encoded}&limit=1`,
      { method: 'GET', headers: { prefer: '' } },
    )
    return response(200, {
      ok: true,
      write_authorized: true,
      saved: Boolean(rows?.length),
      editorial_status: rows?.[0]?.editorial_status || null,
      news_id: rows?.[0]?.id || null,
    })
  } catch (error) {
    console.error('status failed', error)
    return response(500, { ok: false, error: 'Status lookup failed' })
  }
}
