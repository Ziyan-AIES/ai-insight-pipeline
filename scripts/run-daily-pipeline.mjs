import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { supabase } from '../netlify/functions/_supabase.mjs'
import { allRows, reasonJson } from './reference-runtime.mjs'
import { config, modelId, withLock, readJson, writeJson } from './pipeline-common.mjs'
import { processMailQueue, retryReadyReviews } from './daily-mail.mjs'
import { selectDaily } from './daily-selection.mjs'

process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'))
process.env.EDITORIAL_MODEL = process.env.EDITORIAL_SCHEDULED_MODEL || config.model
const stage = process.argv.find(value => value.startsWith('--stage='))?.split('=')[1] || 'intake'
const preview = process.argv.includes('--dry-run')
if (!['intake', 'editorial'].includes(stage)) throw Error('Expected --stage=intake or --stage=editorial')
async function run(script, args = []) {
  const imports = ['--import', './scripts/local-network.mjs', ...(script.endsWith('.ts') ? ['--import', 'tsx'] : [])]
  try {
    const result = await promisify(execFile)(process.execPath, [...imports, script, ...args], { cwd: process.cwd(), env: process.env, windowsHide: true, timeout: 90 * 60000, maxBuffer: 4 * 1024 * 1024 })
    if (result.stdout.trim()) console.log(result.stdout.trim())
  } catch (error) { throw Error(`${script} failed: ${String(error.stderr || error.message).slice(-1800)}`) }
}
if (process.argv.includes('--check')) {
  for (const key of ['CURSOR_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) if (!process.env[key]) throw Error('Missing environment: ' + key)
  await supabase('radar_sources?select=id&limit=1')
  console.log(JSON.stringify({ stage, database: 'reachable', model: modelId(), note: 'Read-only check; no model call or mailbox/database writes.' }))
} else {
  await withLock('daily-' + stage, async () => {
    const receipt = { stage, preview, startedAt: new Date().toISOString(), model: modelId(), steps: [], errors: [], pending: [] }
    const step = async (name, action) => {
      try {
        const result = await action()
        const failures = result?.failures || []
        const unresolved = [...(result?.reviewed || []).filter(row => row.decision === 'pending'), ...(result?.results || []).filter(row => row.status === 'pending')]
        receipt.errors.push(...failures.map(failure => ({ name, ...failure })))
        receipt.pending.push(...unresolved.map(item => ({ name, ...item })))
        receipt.steps.push({ name, status: failures.length ? 'failed' : unresolved.length || result?.deferred ? 'partial' : 'complete', result: Array.isArray(result) ? { count: result.length } : result })
        return result
      }
      catch (error) { receipt.errors.push({ name, error: error.message }); console.error(name + ': ' + error.message); return null }
      finally { writeJson(`logs/pipeline/${stage}-latest.json`, receipt) }
    }
    if (stage === 'intake') {
      await step('retry-verified-mail', () => retryReadyReviews({ run, apply: !preview }))
      const began = Date.now()
      await step('collect-mail', () => run('scripts/collect-mail-queue.mjs'))
      const queue = readJson('logs/agent-mail/queue.json', {})
      const fresh = Date.parse(queue.checkedAt) >= began
      const sources = await step('load-sources', () => supabase('radar_sources?deleted_at=is.null&select=*'))
      let radar = await step('load-evidence', () => allRows(`radar_items?published_at=gte.${new Date(Date.now() - 30 * 86400000).toISOString()}&order=published_at.desc,id.asc`))
      if (fresh && sources && radar) await step('review-mail', () => processMailQueue({ sources, radar, reason: reasonJson, run, apply: !preview, limit: Number(process.argv.find(value => value.startsWith('--mail-limit='))?.split('=')[1] || config.maxMailPerRun) }))
      else receipt.errors.push({ name: 'review-mail', error: 'Fresh mailbox queue and source/evidence reads required; old queue not finalized.' })
      if (fresh && !preview) await step('finalize-mail', () => run('scripts/finalize-mail-check.mjs'))
      if (sources && radar) {
        radar = await step('reload-today', () => allRows(`radar_items?published_at=gte.${new Date(Date.now() - 2 * 86400000).toISOString()}&order=published_at.desc,id.asc`))
        if (radar) await step('daily-selection', () => selectDaily({ radar, sources, reason: reasonJson, apply: !preview }))
      }
    } else {
      if (preview) throw Error('Use --check for editorial; no model-writing preview exists')
      process.env.EDITORIAL_BATCH_SIZE = '5'
      await step('article-editorial', () => run('scripts/run-local-editorial.ts', ['--drain']))
      // Independent phases: a failed article must not block the reference brief.
      await step('reference-brief', () => run('scripts/run-reference-brief.mjs'))
      if (process.env.RESEARCH_ENRICHMENT_ENABLED === 'true') await step('research-enrichment', () => run('scripts/run-research-enrichment.mjs'))
    }
    receipt.finishedAt = new Date().toISOString()
    receipt.status = receipt.errors.length ? 'failed' : receipt.pending.length || receipt.steps.some(step => step.result?.deferred) ? 'partial' : 'complete'
    writeJson(`logs/pipeline/${stage}-latest.json`, receipt)
    writeJson(`logs/pipeline/runs/${receipt.startedAt.replace(/[:.]/g, '-')}-${stage}.json`, receipt)
    console.log(JSON.stringify({ stage, status: receipt.status, receipt: `logs/pipeline/${stage}-latest.json` }))
    if (receipt.errors.length) process.exitCode = 1
  })
}
