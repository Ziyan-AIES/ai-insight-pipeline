import crypto from 'node:crypto'

export function response(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  }
}

export function handleOptions(event) {
  if (event.httpMethod !== 'OPTIONS') return null
  return response(
    204,
    {},
    {
      'access-control-allow-origin': process.env.APP_ORIGIN || '',
      'access-control-allow-headers':
        'authorization, content-type, x-extension-token',
      'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    },
  )
}

function tokenMatches(got, expected) {
  if (!got || !expected) return false
  const gotBytes = Buffer.from(got)
  const expectedBytes = Buffer.from(expected)
  return (
    gotBytes.length === expectedBytes.length &&
    crypto.timingSafeEqual(gotBytes, expectedBytes)
  )
}

export function requireExtensionToken(event) {
  const expected = process.env.EXTENSION_WRITE_TOKEN || ''
  const got =
    event.headers['x-extension-token'] ||
    event.headers['x-bsw-token'] ||
    ''
  if (!expected) {
    return response(503, {
      ok: false,
      error: 'Extension capture is not configured',
    })
  }
  return tokenMatches(got, expected)
    ? null
    : response(401, { ok: false, error: 'Invalid extension token' })
}

export function parseJsonBody(event) {
  try {
    return JSON.parse(event.body || '{}')
  } catch {
    return null
  }
}

export function canonicalizeUrl(value) {
  const url = new URL(String(value || '').trim())
  url.hash = ''
  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith('utm_') || key === 'fbclid' || key === 'gclid') {
      url.searchParams.delete(key)
    }
  }
  return url.toString()
}

export async function supabase(path, options = {}) {
  const url = process.env.SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) throw new Error('Supabase service credentials are missing')
  const result = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      prefer: 'return=representation',
      ...(options.headers || {}),
    },
  })
  const text = await result.text()
  if (!result.ok) {
    throw new Error(`Supabase ${result.status}: ${text || result.statusText}`)
  }
  return text ? JSON.parse(text) : null
}
