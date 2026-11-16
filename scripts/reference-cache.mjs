import { modelId } from './pipeline-common.mjs'
import fs from 'node:fs'
import crypto from 'node:crypto'

export function createCachedReason(reasonJson, options = {}) {
return async function cachedReason(instruction, evidence) {
  const model = options.model || modelId()
  const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
  const directory = options.directory || 'logs/reference-briefs/cache'
  fs.mkdirSync(directory, { recursive: true })
  const file = `${directory}/${digest([model, instruction, evidence])}.json`
  // Daily and weekly often contain the same articles. Reuse only exact content,
  // prompt and model matches, even when their batch boundaries differ.
  const articleFiles = Array.isArray(evidence) ? evidence.map(item => `${directory}/article-${digest([model, instruction, item])}.json`) : null
  function valid(result) {
    if (articleFiles) return Array.isArray(result?.items) && result.items.length === evidence.length && new Set(result.items.map(x => x.id)).size === evidence.length && result.items.every(x => evidence.some(row => row.id === x.id))
    if (evidence?.notes) {
      const ids = new Set(evidence.notes.flatMap(note => note.evidenceIds))
      return typeof result?.summary === 'string' && result.summary.trim() && result.summary.length <= 2400 && Array.isArray(result.evidenceIds) && result.evidenceIds.length > 0 && result.evidenceIds.length <= 8 && result.evidenceIds.every(id => ids.has(id))
    }
    return true
  }
  function persist(result) {
    if (articleFiles && Array.isArray(result.items) && result.items.length === evidence.length && new Set(result.items.map(item => item.id)).size === evidence.length && result.items.every(item => evidence.some(source => source.id === item.id))) {
      evidence.forEach((item, index) => fs.writeFileSync(articleFiles[index], JSON.stringify(result.items.find(entry => entry.id === item.id))))
    }
    fs.writeFileSync(file, JSON.stringify(result))
    return result
  }
  if (fs.existsSync(file)) { const saved = JSON.parse(fs.readFileSync(file, 'utf8')); if (valid(saved)) return persist(saved); console.log('Regenerating invalid cached step.'); }
  const cached = articleFiles?.map(path => fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, 'utf8')) : null)
  const missing = cached ? evidence.filter((_, index) => !cached[index]) : evidence
  if (cached && !missing.length) return persist({ items: cached })
  let invalidResult = null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      let result = await reasonJson(invalidResult ? instruction + '\nCORRECTION REQUIRED: The previous result failed validation. Use ONLY the exact supplied evidenceIds, maximum eight. Write a shorter summary of at most 1500 characters. Return the same JSON schema.' : instruction, invalidResult ? { ...missing, previousInvalidResult: invalidResult } : missing)
      if (cached) {
        if (!Array.isArray(result.items) || result.items.length !== missing.length || new Set(result.items.map(item => item.id)).size !== missing.length || result.items.some(item => !missing.some(source => source.id === item.id))) throw Error('Every uncached article must be classified exactly once')
        result = { items: evidence.map((item, index) => cached[index] || result.items.find(entry => entry.id === item.id)) }
      }
      if (!valid(result)) {
        invalidResult = result
        fs.writeFileSync(file + '.invalid.json', JSON.stringify({ evidence, result }, null, 2))
        throw Error('Invalid ' + (evidence.category || 'classification') + ' result: summary characters=' + (result.summary?.length || 0) + ', references=' + (result.evidenceIds?.length || 0))
      }
      persist(result)
      console.log(Array.isArray(evidence) ? `Classified ${missing.length} articles; reused ${evidence.length - missing.length}.` : `Completed ${evidence.category || 'cross-topic'} synthesis.`)
      return result
    } catch (error) {
      if (attempt) throw error
      console.log('Retrying one failed briefing step: ' + error.message)
    }
  }
}
}
