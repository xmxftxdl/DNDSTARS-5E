import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { buildFullbookReviewCoverage } from './audit-fullbook-review-coverage.mjs'

export function sourceDiagnosticReviews(messages, sourceId, reviews) {
  return messages.map(diagnostic => {
    const matches = reviews.filter(review => review.diagnostic === diagnostic && review.sourceIds.includes(sourceId))
    if (matches.length > 1) throw Error('Ambiguous diagnostic review')
    const review = matches[0]
    return { diagnostic, decision: review?.decision ?? 'unreviewed', evidence: review?.evidence ?? [],
      configurationStillRequiresRegeneration: review?.configurationStillRequiresRegeneration ?? null,
      sourceBehaviorCertified: false }
  })
}

export function collectManualBoundaries(content) {
  const found = []
  function walk(value, path) {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) { value.forEach((row, index) => walk(row, `${path}[${index}]`)); return }
    const explicit = value.kind === 'manual-adjudication'
    const declared = ['manual', 'partial', 'reference-only'].includes(value.automation) || value.automation?.mode === 'reference-only'
    if (explicit || declared) found.push({ path, category: explicit ? 'explicit-operation' : 'declared-boundary',
      id: value.id ?? null, name: value.name ?? null, automation: value.automation ?? null,
      description: value.description ?? value.reason ?? null, declaration: value })
    for (const [key, child] of Object.entries(value)) walk(child, `${path}.${key}`)
  }
  walk(content, '$')
  return found
}

export function selectExactSourceDrafts(run, source) {
  if (run.manualContentRepairs !== false) throw Error('Run is not explicitly unedited')
  return (run.drafts ?? []).filter(job => job.draft && job.source?.id === source.id &&
    job.source.kind === source.kind && job.source.name === source.name && job.source.text === source.text)
}

export function summarizeExecutionDeclarations(content) {
  const features = [...(content.features ?? []), ...(content.feats ?? [])]
  return {
    activityCount: (content.activities ?? []).length,
    entries: features.map(entry => ({ id: entry.id, automation: entry.automation ?? null,
      explicitActionId: entry.action?.id ?? null,
      declarativeMechanic: entry.declarativeAbility?.mechanic?.kind ?? null,
      advancementCount: (entry.advancements ?? []).length,
      passiveEffectCount: (entry.passiveEffects ?? []).length,
      spellGrantCount: (entry.spellGrants ?? []).length,
    })),
  }
}

async function main() {
  const args = process.argv.slice(2)
  if (![8, 10, 12].includes(args.length) || args[0] !== '--root' || args[2] !== '--backlog' || args[4] !== '--inventory' || args[6] !== '--output') throw Error('Usage: --root <private-runs> --backlog <json> --inventory <json> --output <new-private-json> [--diagnostic <exact diagnostic>] [--review <review.json>]')
  const optional = new Map()
  for (let i = 8; i < args.length; i += 2) {
    if (!['--diagnostic', '--review'].includes(args[i]) || optional.has(args[i])) throw Error('Invalid or repeated optional argument')
    optional.set(args[i], args[i + 1])
  }
  const backlogBytes = await readFile(args[3]), inventoryBytes = await readFile(args[5])
  const backlog = JSON.parse(backlogBytes), inventory = JSON.parse(inventoryBytes)
  const reviewBytes = optional.has('--review') ? await readFile(optional.get('--review')) : undefined
  const review = reviewBytes ? JSON.parse(reviewBytes) : undefined
  if (review) buildFullbookReviewCoverage(backlog, review)
  const sources = inventory.windows.flatMap(window => window.spells ?? [])
  const diagnosticText = optional.get('--diagnostic') ?? 'Activity 包含显式 DM 裁定 operation。'
  const matches = backlog.issues.filter(issue => issue.diagnostic === diagnosticText)
  if (matches.length !== 1) throw Error('Missing or ambiguous diagnostic')
  const diagnostic = matches[0]
  const runs = new Map(), entries = []
  for (const ref of diagnostic.sources) {
    const sourceMatches = sources.filter(source => source.id === ref.sourceId)
    if (sourceMatches.length !== 1) throw Error(`Ambiguous/missing inventory source: ${ref.sourceId}`)
    if (typeof ref.run !== 'string' || !/^fullbook-[a-z0-9-]+$/.test(ref.run)) throw Error('Invalid run name')
    if (!runs.has(ref.run)) {
      const bytes = await readFile(join(args[1], ref.run, 'conversion-run.json'))
      runs.set(ref.run, { data: JSON.parse(bytes), sha256: createHash('sha256').update(bytes).digest('hex') })
    }
    const run = runs.get(ref.run), jobs = selectExactSourceDrafts(run.data, sourceMatches[0])
    if (!jobs.length) throw Error(`No exact-source unedited draft: ${ref.sourceId}`)
    entries.push({ sourceId: ref.sourceId, name: ref.name, run: ref.run, runSha256: run.sha256,
      candidates: jobs.map(job => {
        const content = typeof job.draft.contentJson === 'string' ? JSON.parse(job.draft.contentJson) : job.draft.contentJson
        if (!content || typeof content !== 'object') throw Error('Invalid content')
        return { contentSha256: createHash('sha256').update(JSON.stringify(content)).digest('hex'),
          executionDeclarations: summarizeExecutionDeclarations(content),
          boundaries: collectManualBoundaries(content), unsupported: job.draft.unsupported ?? [], reviewStatus: 'unreviewed',
          ...(review ? { diagnosticReviews: sourceDiagnosticReviews(job.draft.unsupported ?? [], ref.sourceId, review.reviews) } : {}) }
      }) })
  }
  const boundaries = entries.flatMap(entry => entry.candidates.flatMap(candidate => candidate.boundaries))
  const counts = { entries: entries.length, candidates: entries.reduce((count, entry) => count + entry.candidates.length, 0),
    boundaries: boundaries.length, explicitOperations: boundaries.filter(row => row.category === 'explicit-operation').length,
    declarations: boundaries.filter(row => row.category === 'declared-boundary').length,
    entriesWithoutRawBoundary: entries.filter(entry => entry.candidates.every(candidate => !candidate.boundaries.length)).length }
  await writeFile(args[7], JSON.stringify({ schemaVersion: 1, apiCalls: 0, fullBookCertified: false, classificationOnly: true,
    note: 'Raw declarations may compile into manual operations. No automatic narrative/deterministic classification; inspect each declaration and source before deciding.',
    diagnostic: diagnosticText, ...(reviewBytes ? { reviewSha256: createHash('sha256').update(reviewBytes).digest('hex') } : {}),
    backlogSha256: createHash('sha256').update(backlogBytes).digest('hex'), inventorySha256: createHash('sha256').update(inventoryBytes).digest('hex'), counts, entries }, null, 2) + '\n', { flag: 'wx' })
  process.stdout.write(JSON.stringify(counts, null, 2) + '\n')
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1 })
