import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve, relative, isAbsolute, basename } from 'node:path'
import { pathToFileURL } from 'node:url'

const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const decisions = new Set(['expressible-by-current-runtime', 'partially-addressed-by-current-runtime', 'source-claim-not-supported'])

/** Review coverage only. Neither referenced files nor review decisions certify source conversion. */
export function buildFullbookReviewCoverage(backlog, review) {
  if (backlog?.schemaVersion !== 1 || !Array.isArray(backlog.entries) || !Array.isArray(backlog.issues) || !Array.isArray(review?.reviews)) throw Error('Invalid backlog/review')
  const issues = new Map(backlog.issues.map(issue => [issue.id, issue]))
  if (issues.size !== backlog.issues.length) throw Error('Duplicate diagnostic')
  const reviews = new Map()
  for (const row of review.reviews) {
    const issue = issues.get(row.issueId)
    if (!issue || issue.diagnostic !== row.diagnostic || hash(issue.diagnostic) !== row.issueId) throw Error('Stale or unknown diagnostic')
    if (reviews.has(row.issueId)) throw Error('Duplicate review')
    if (!decisions.has(row.decision) || row.behaviorVerified !== false || row.configurationStillRequiresRegeneration !== true) throw Error('Review cannot certify conversion')
    if (!Array.isArray(row.evidence) || !row.evidence.length || row.evidence.some(path => typeof path !== 'string' || !path.trim())) throw Error('Missing evidence')
    if (!Array.isArray(row.sourceIds) || !row.sourceIds.length || new Set(row.sourceIds).size !== row.sourceIds.length || row.sourceIds.some(id => !issue.sources.some(source => source.sourceId === id))) throw Error('Invalid review source scope')
    reviews.set(row.issueId, row)
  }
  const sourceIds = new Set()
  const entries = backlog.entries.map(entry => {
    if (!entry.sourceId || sourceIds.has(entry.sourceId)) throw Error('Duplicate source')
    sourceIds.add(entry.sourceId)
    const links = entry.issueIds.map(issueId => {
      const issue = issues.get(issueId)
      if (!issue?.sources.some(source => source.sourceId === entry.sourceId)) throw Error('Invalid diagnostic link')
      const row = reviews.get(issueId)
      return { issueId, review: row?.sourceIds.includes(entry.sourceId) ? row.decision : 'unreviewed' }
    })
    const unresolved = links.filter(link => link.review !== 'expressible-by-current-runtime')
    return { sourceId: entry.sourceId, name: entry.name, kind: entry.kind, preflightStatus: entry.preflightStatus,
      links, unresolvedDiagnosticCount: unresolved.length,
      nextStep: !links.length ? 'verify-existing-artifact' : unresolved.length ? 'review-or-implement-mechanisms' : 'await-batch-regeneration',
      sourceBehaviorCertified: false }
  })
  const links = entries.flatMap(entry => entry.links)
  return { schemaVersion: 1, apiCalls: 0, fullBookCertified: false, paidConversionGatePassed: false,
    note: 'This report measures exact diagnostic review coverage only; source artifacts and behavior remain independently unverified.',
    counts: { entries: entries.length, distinctDiagnostics: issues.size, reviewedDiagnostics: reviews.size,
      links: links.length, unreviewedLinks: links.filter(link => link.review === 'unreviewed').length,
      partialLinks: links.filter(link => link.review === 'partially-addressed-by-current-runtime').length,
      sourceCorrectionLinks: links.filter(link => link.review === 'source-claim-not-supported').length,
      expressibleLinks: links.filter(link => link.review === 'expressible-by-current-runtime').length,
      entriesAwaitingMechanismReview: entries.filter(entry => entry.nextStep === 'review-or-implement-mechanisms').length,
      entriesAwaitingBatchRegeneration: entries.filter(entry => entry.nextStep === 'await-batch-regeneration').length }, entries }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length !== 6 || args[0] !== '--backlog' || args[2] !== '--review' || args[4] !== '--output') throw Error('Usage: --backlog <json> --review <json> --output <new-private-json>')
  const [backlogBytes, reviewBytes] = await Promise.all([readFile(args[1]), readFile(args[3])])
  const backlog = JSON.parse(backlogBytes), review = JSON.parse(reviewBytes)
  if (review.backlog !== basename(args[1])) throw Error('Review names a different backlog')
  const report = buildFullbookReviewCoverage(backlog, review)
  const evidence = []
  for (const path of [...new Set(review.reviews.flatMap(row => row.evidence))].sort()) {
    const resolved = resolve(path), rel = relative(process.cwd(), resolved)
    if (isAbsolute(rel) || rel === '..' || rel.startsWith('../') || rel.startsWith('..\\')) throw Error('Evidence must be in workspace')
    evidence.push({ path, sha256: hash(await readFile(resolved)) })
  }
  await writeFile(args[5], JSON.stringify({ ...report, backlogSha256: hash(backlogBytes), reviewSha256: hash(reviewBytes), evidence }, null, 2) + '\n', { flag: 'wx' })
  process.stdout.write(JSON.stringify(report.counts, null, 2) + '\n')
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1 })
