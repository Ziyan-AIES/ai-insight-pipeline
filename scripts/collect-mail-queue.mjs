import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { JSDOM } from 'jsdom'

const directory = path.resolve('logs/agent-mail')
fs.mkdirSync(directory, { recursive: true })
const cli = process.env.AGENTLY_CLI_PATH || path.join(process.env.APPDATA || '', 'npm/node_modules/@tencent-qqmail/agently-cli/scripts/run.js')
const ledgerPath = path.join(directory, 'processed.json')
const processed = fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) : {}
function call(args) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = JSON.parse(execFileSync(process.execPath, [cli, 'message', ...args], { encoding: 'utf8', timeout: 45000, maxBuffer: 8 * 1024 * 1024, windowsHide: true, stdio: ['ignore','pipe','pipe'] }))
      if (!result.ok) throw Error('Mailbox returned an unsuccessful response')
      return result.data
    } catch (error) {
      if (![1, 4].includes(error.status) || attempt === 2) {
        let detail = 'No structured CLI error returned'
        try {
          const envelope = JSON.parse(String(error.stdout || ''))
          detail = String(envelope.error?.message || detail).slice(0, 800)
        } catch { /* Do not expose arbitrary stdout, mail bodies or credentials. */ }
        throw Error(`Mailbox operation failed (exit ${error.status ?? 'unknown'}): ${detail}; no success checkpoint advanced`)
      }
    }
  }
}
let cursor = '', messages = [], seenCursors = new Set()
do {
  const page = call(['+list', '--dir', 'inbox', '--limit', '50', ...(cursor ? ['--cursor', cursor] : [])])
  messages.push(...page.data)
  cursor = page.pagination?.has_more ? page.pagination.next_cursor : ''
  if (cursor && seenCursors.has(cursor)) throw Error('Repeated mailbox cursor')
  seenCursors.add(cursor)
} while (cursor)
const queue = [], failures = []
for (const message of messages) {
  const id = message.message_id
  if (!/^msg_[\w-]+$/.test(id) || processed[id]) continue
  const file = path.join(directory, `${id}.json`)
  try {
    let data
    if (fs.existsSync(file)) data = JSON.parse(fs.readFileSync(file, 'utf8'))
    else {
      const raw = call(['+read', '--id', id])
      const document = new JSDOM(raw.body || '').window.document
      document.querySelectorAll('style,script').forEach(node => node.remove())
      const text = document.body.textContent.replace(/[\u200b-\u200f\ufeff\u00ad]/gu, '').replace(/\u034f/gu, '').replace(/\s+/g, ' ').trim()
      const links = [...document.querySelectorAll('a[href]')].map(a => ({ text: a.textContent.trim(), url: a.href })).filter(a => /^https:\/\//.test(a.url) && !/unsubscribe|preferences|confirm|opt.out/i.test(a.text + a.url))
      data = { id, receivedAt: message.created_at, sender: message.from.email, subject: message.subject, text, links }
      fs.writeFileSync(file, JSON.stringify(data))
    }
    queue.push({ id, receivedAt: data.receivedAt, sender: data.sender, subject: data.subject, file })
  } catch (error) { failures.push({ id, error: error.message }) }
}
fs.writeFileSync(path.join(directory, 'queue.json'), JSON.stringify({ checkedAt: new Date().toISOString(), total: messages.length, queue, failures }, null, 2))
console.log(JSON.stringify({ total: messages.length, pending: queue.length, failures: failures.length, queueFile: path.join(directory, 'queue.json') }))
if (failures.length) process.exitCode = 1
