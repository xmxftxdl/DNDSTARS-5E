import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const [input, output] = process.argv.slice(2)
if (!input || !output) throw Error('Usage: <consolidated-preflight.json> <new-output.json>')
const bytes = await readFile(input)
const report = JSON.parse(bytes)
if (!Array.isArray(report.entries)) throw Error('Missing entry inventory')
const entries = report.entries.map(entry => {
  const ready = entry.candidates.filter(candidate => candidate.status === 'ready-for-behavior-tests')
  const candidate = [...(ready.length ? ready : entry.candidates)].sort((a,b) =>
    String(b.finished ?? '').localeCompare(String(a.finished ?? '')) || String(a.run).localeCompare(String(b.run)))[0]
  return { sourceId: entry.sourceId, name: entry.name, kind: entry.kind, run: candidate?.run,
    contentParsed: candidate?.contentParsed === true,
    auditAvailable: Array.isArray(candidate?.activityMechanismAudit),
    activities: candidate?.activityMechanismAudit ?? [], sourceBehaviorCertified: false }
})
const groups = new Map()
for (const entry of entries) for (const activity of entry.activities) {
  for (const component of activity.analysis.missingComponents) {
    const links = groups.get(component) ?? []
    links.push({ sourceId: entry.sourceId, name: entry.name, activityId: activity.activityId, run: entry.run })
    groups.set(component, links)
  }
}
const missingComponents = [...groups].map(([component, links]) => ({ component, links,
  activityCount: links.length, entryCount: new Set(links.map(link => link.sourceId)).size }))
  .sort((a,b) => b.entryCount-a.entryCount || a.component.localeCompare(b.component))
const result = { schemaVersion: 1, input, inputSha256: createHash('sha256').update(bytes).digest('hex'),
  apiCalls: 0, fullBookCertified: false,
  note: 'Routing evidence only. Manual operations must be checked against source rules; do not classify them as narrative or delete them automatically.',
  counts: { entries: entries.length, entriesWithoutAudit: entries.filter(entry => !entry.auditAvailable).length,
    entriesWithoutParsedContent: entries.filter(entry => !entry.contentParsed).length,
    activities: entries.reduce((n,entry) => n+entry.activities.length,0),
    activitiesWithManualOperations: entries.reduce((n,entry) => n+entry.activities.filter(activity => activity.manualOperations.length).length,0) },
  missingComponents, entries }
await writeFile(output, JSON.stringify(result,null,2)+'\n', { flag: 'wx' })
console.log(JSON.stringify({ counts: result.counts, missingComponents: missingComponents.map(({links,...summary})=>summary) },null,2))
