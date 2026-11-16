export const publicWorkspaceEnabled = import.meta.env.VITE_PUBLIC_WORKSPACE_ENABLED === 'true'

export function visitorDisplayName() {
  try { return localStorage.getItem('sonata:visitor-name')?.trim().slice(0, 80) || 'Anonymous' }
  catch { return 'Anonymous' }
}

export async function publicRead<T>(resource: string, topicId?: string): Promise<T[]> {
  const rows: T[] = []
  for (let offset = 0; ; offset += 250) {
    const response = await fetch(`/api/public-read?resource=${encodeURIComponent(resource)}&offset=${offset}${topicId ? `&topicId=${encodeURIComponent(topicId)}` : ''}`)
    const body = await response.json().catch(() => ({}))
    if (!response.ok || !Array.isArray(body.data)) throw new Error(body.error || 'Could not load public content.')
    rows.push(...body.data)
    if (body.data.length < 250) return rows
  }
}

export async function visitorWrite<T>(input: Record<string, unknown>): Promise<T> {
  const response = await fetch('/api/visitor-write', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Could not save. Your input has been retained.')
  return body.result as T
}
