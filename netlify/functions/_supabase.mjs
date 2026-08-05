import crypto from 'node:crypto'

const baseSecurityHeaders = {
  'cache-control': 'no-store',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
}

export function header(event, name) {
  const headers = event?.headers || {}
  const key = Object.keys(headers).find(
    (candidate) => candidate.toLowerCase() === name.toLowerCase(),
  )
  return key ? String(headers[key] || '') : ''
}

function allowedOrigins() {
  return new Set(
    String(process.env.APP_ORIGIN || '')
      .split(',')
      .map((origin) => origin.trim().replace(/\/$/, ''))
      .filter(Boolean),
  )
}

function corsHeaders(event) {
  const origin = header(event, 'origin').replace(/\/$/, '')
  if (!origin || !allowedOrigins().has(origin)) return {}
  return {
    'access-control-allow-origin': origin,
    vary: 'Origin',
  }
}

export function response(statusCode, body, extraHeaders = {}, event = null) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...baseSecurityHeaders,
      ...corsHeaders(event),
      ...extraHeaders,
    },
    body: statusCode === 204 ? '' : JSON.stringify(body),
  }
}

export function handleOptions(event) {
  if (event.httpMethod !== 'OPTIONS') return null
  const origin = header(event, 'origin').replace(/\/$/, '')
  if (origin && !allowedOrigins().has(origin)) {
    return response(403, { ok: false, error: 'Origin not allowed' }, {}, event)
  }
  return response(
    204,
    {},
    {
      'access-control-allow-headers':
        'authorization, content-type, x-capture-token, x-editorial-token, x-extension-token, x-bsw-token',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-max-age': '600',
    },
    event,
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

export function requireAllowedOrigin(event) {
  const origin = header(event, 'origin').replace(/\/$/, '')
  if (!origin || allowedOrigins().has(origin)) return null
  return response(403, { ok: false, error: 'Origin not allowed' }, {}, event)
}

function requireToken(event, expected, headerNames, label) {
  const got =
    headerNames.map((name) => header(event, name)).find(Boolean) || ''
  if (!expected) {
    return response(
      503,
      { ok: false, error: `${label} is not configured` },
      {},
      event,
    )
  }
  return tokenMatches(got, expected)
    ? null
    : response(401, { ok: false, error: `Invalid ${label.toLowerCase()} token` }, {}, event)
}

export function requireCaptureToken(event) {
  const expected =
    process.env.CAPTURE_WRITE_TOKEN || process.env.EXTENSION_WRITE_TOKEN || ''
  return requireToken(
    event,
    expected,
    ['x-capture-token', 'x-extension-token', 'x-bsw-token'],
    'Capture API',
  )
}

export function requireEditorialToken(event) {
  const expected =
    process.env.EDITORIAL_WRITE_TOKEN || process.env.EXTENSION_WRITE_TOKEN || ''
  return requireToken(
    event,
    expected,
    ['x-editorial-token', 'x-extension-token'],
    'Editorial API',
  )
}

// Kept for callers outside this directory during the token transition.
export const requireExtensionToken = requireCaptureToken

export function parseJsonBody(event, maxBytes = 256 * 1024) {
  const declaredLength = Number(header(event, 'content-length') || 0)
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { value: null, statusCode: 413, error: 'Request body is too large' }
  }
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64').toString('utf8')
      : String(event.body || '')
    if (Buffer.byteLength(raw, 'utf8') > maxBytes) {
      return { value: null, statusCode: 413, error: 'Request body is too large' }
    }
    const value = JSON.parse(raw || '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { value: null, statusCode: 400, error: 'JSON object required' }
    }
    return { value, statusCode: 200, error: null }
  } catch {
    return { value: null, statusCode: 400, error: 'Invalid JSON' }
  }
}

export function canonicalizeUrl(value) {
  const url = new URL(String(value || '').trim())
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only HTTP(S) URLs are allowed')
  }
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
    signal: options.signal || AbortSignal.timeout(15000),
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

export function supabaseRpc(name, arguments_) {
  return supabase(`rpc/${encodeURIComponent(name)}`, {
    method: 'POST',
    body: JSON.stringify(arguments_),
  })
}
