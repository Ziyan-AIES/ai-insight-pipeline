export const DEFAULT_WORKSPACE_URL = 'https://aiinsightpipeline.netlify.app'

export const STORAGE_KEYS = {
  apiBase: 'bswApiBase',
  accessToken: 'bswAccessToken',
  refreshToken: 'bswRefreshToken',
  identity: 'bswIdentity',
  authorized: 'bswAuthorized',
  email: 'bswEmail',
  startCollapsed: 'bswStartCollapsed',
  defaultCategory: 'bswDefaultCategory',
  pendingState: 'bswPendingAuthState',
}

export const CATEGORIES = [
  { id: 'auto', label: 'Auto detect' },
  { id: 'interaction', label: 'Entry & Interaction' },
  { id: 'ai_hardware', label: 'AI Devices' },
  { id: 'ai_software', label: 'AI Experiences' },
  { id: 'ai_capability', label: 'AI Capability & Technology' },
  { id: 'ecosystem', label: 'Ecosystem' },
  { id: 'industry_events', label: 'Industry & Market' },
]

export const CATEGORY_KEYWORDS = {
  interaction: [
    'interaction',
    'interface',
    'ux',
    'ui',
    'assistant',
    'browser',
    'voice',
    'multimodal',
    'wearable',
  ],
  ai_software: [
    'software',
    'app',
    'saas',
    'copilot',
    'agent',
    'workflow',
    'automation',
    'cursor',
  ],
  ai_hardware: ['chip', 'gpu', 'npu', 'device', 'robot', 'nvidia', 'hardware'],
  ecosystem: [
    'ecosystem',
    'platform',
    'partner',
    'open source',
    'marketplace',
    'funding',
    'regulation',
  ],
  ai_capability: [
    'model',
    'llm',
    'reasoning',
    'benchmark',
    'training',
    'inference',
    'gpt',
    'claude',
    'gemini',
  ],
  industry_events: [
    'ces',
    'earnings',
    'market',
    'ipo',
    'acquisition',
    'conference',
  ],
}

export function normalizeWorkspaceUrl(value) {
  const clean = String(value || '').trim().replace(/\/+$/, '')
  if (!clean) return DEFAULT_WORKSPACE_URL
  try {
    return new URL(clean).origin
  } catch {
    return clean
  }
}

export function detectCategory(text) {
  const haystack = String(text || '').toLowerCase()
  let best = { id: 'ecosystem', score: 0 }
  for (const [id, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.reduce(
      (sum, keyword) => sum + (haystack.includes(keyword) ? 1 : 0),
      0,
    )
    if (score > best.score) best = { id, score }
  }
  return best.id
}
