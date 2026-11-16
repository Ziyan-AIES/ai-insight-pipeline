import fs from 'node:fs'
import { supabase } from '../netlify/functions/_supabase.mjs'
import registry from '../config/investor-sources.json' with { type: 'json' }
import { resolveMailSource } from './mail-source.mjs'
const queue = JSON.parse(fs.readFileSync('logs/agent-mail/queue.json', 'utf8'))
const ledger = fs.existsSync('logs/agent-mail/processed.json') ? JSON.parse(fs.readFileSync('logs/agent-mail/processed.json', 'utf8')) : {}
const sources = await supabase('radar_sources?enabled=eq.true&deleted_at=is.null&select=id,domain,enabled')
for (const source of sources.filter(s => registry.some(r => r.domain === s.domain && r.method === 'agent_email'))) {
  const pending = queue.queue.filter(m => !ledger[m.id] && resolveMailSource(m.sender, sources)?.id === source.id).length
  const complete = !pending && !queue.failures.length
  await supabase(`radar_sources?id=eq.${source.id}`, { method: 'PATCH', body: JSON.stringify({ last_fetched_at: queue.checkedAt,
    last_error: complete ? '' : `${pending} messages awaiting review; ${queue.failures.length} mailbox read failures`,
    ...(complete ? { last_success_at: queue.checkedAt } : {}) }) })
}
console.log('Mailbox check status saved; incomplete reviews did not advance success timestamps.')
