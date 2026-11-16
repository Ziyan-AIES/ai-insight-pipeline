import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import config from '../config/daily-pipeline.json' with { type: 'json' }

export { config }
export const modelId = () => process.env.EDITORIAL_MODEL || process.env.EDITORIAL_SCHEDULED_MODEL || config.model
export const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
export const readJson = (file, fallback) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback
export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(value, null, 2))
}
export function beijingDay(now = new Date()) { return new Date(+now + 8 * 3600000).toISOString().slice(0, 10) }
export function dayWindow(now = new Date()) {
  const day = beijingDay(now), start = new Date(day + 'T00:00:00+08:00')
  return { day, start: start.toISOString(), end: new Date(+start + 86400000).toISOString() }
}
export async function withLock(name, action) {
  const file = path.resolve('logs/pipeline', name + '.lock')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  if (fs.existsSync(file)) {
    const previous = readJson(file, {})
    try { process.kill(previous.pid, 0); throw Error(name + ' is already running') }
    catch (error) { if (error.code !== 'ESRCH') throw error }
    fs.unlinkSync(file)
  }
  const descriptor = fs.openSync(file, 'wx')
  fs.writeFileSync(descriptor, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }))
  fs.closeSync(descriptor)
  try { return await action() } finally { fs.unlinkSync(file) }
}
export async function cachedModel(namespace, instruction, evidence, reason, validate = value => value) {
  const file = `logs/pipeline/cache/${namespace}-${hash([config.version, modelId(), instruction, evidence])}.json`
  if (fs.existsSync(file)) { try { return validate(readJson(file)) } catch { /* invalid cache is regenerated */ } }
  const result = validate(await reason(instruction, evidence))
  writeJson(file, result)
  return result
}
