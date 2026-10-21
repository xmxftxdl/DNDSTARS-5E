import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve, basename } from 'node:path'
import { pathToFileURL } from 'node:url'
import { buildFullbookReviewCoverage } from './audit-fullbook-review-coverage.mjs'
import { suggestFullbookMechanismFamilies } from './audit-fullbook-mechanism-backlog.mjs'

/** Exact preflight diagnostic shapes only. A routing category never certifies support. */
export function fullbookDiagnosticWorkKind(message) {
  if (/^Activity \S+ 的休息记录、Host一次性授权、特性选择和收据原子提交已接入；已验证自动导出子职包的DM长休→玩家护甲选择→Host结算→刷新防重用。仍需逐项验证本能力的房间事件调度、目标\/选项、短休、跳过与结束清理，不能仅凭数据校验认证完整休息触发自动化。$/u.test(message)) return 'source-behavior-verification'
  if (message === 'Activity 包含显式 DM 裁定 operation。') return 'manual-boundary'
  if (message === '特性或专长仍声明部分自动化或手动结算。') return 'status-marker'
  if (message === '没有绑定到条目的可执行 Activity 或已验证结构的被动执行声明。' ||
    message === '声明式能力尚需独立执行路径与行为验证。') return 'execution-binding'
  if (/^Activity \S+ 尚需手动结算或仅供展示。$/u.test(message)) return 'status-marker'
  if (/^法术 \S+ 缺少无需效果授权的完整施放入口；/u.test(message)) return 'cast-entry'
  if (/^Activity \S+ 未从法术施放入口授予或调用，/u.test(message)) return 'follow-up-link'
  return 'mechanism-or-evidence'
}

export function buildFullbookMechanismBatchPlan(backlog, review) {
  // Reuse scope/hash checks; do not apply a review of one source to all sources.
  const coverage = buildFullbookReviewCoverage(backlog, review)
  const sources = new Map(coverage.entries.map(entry => [entry.sourceId, entry]))
  const tasks = backlog.issues.map(issue => {
    const sourceLinks = issue.sources.map(source => {
      const entry = sources.get(source.sourceId)
      const link = entry?.links.find(link => link.issueId === issue.id)
      if (!link) throw Error('Diagnostic source is absent from inventory links')
      return { sourceId: source.sourceId, name: source.name, review: link.review }
    })
    const families = [...new Set([...issue.suggestedFamilies, ...suggestFullbookMechanismFamilies(issue.diagnostic)])]
      .filter(family => family !== 'unclassified')
    return { issueId: issue.id, diagnostic: issue.diagnostic, workKind: fullbookDiagnosticWorkKind(issue.diagnostic),
      originalSuggestedFamilies: [...issue.suggestedFamilies],
      suggestedFamilies: families.length ? families : ['unclassified'], sourceLinks,
      unresolvedSourceIds: sourceLinks.filter(link => link.review !== 'expressible-by-current-runtime').map(link => link.sourceId),
      sourceBehaviorCertified: false }
  }).sort((a, b) => b.unresolvedSourceIds.length - a.unresolvedSourceIds.length || a.issueId.localeCompare(b.issueId))
  const taskById = new Map(tasks.map(task => [task.issueId, task]))
  const entries = coverage.entries.map(entry => {
    const unresolved = entry.links.filter(link => link.review !== 'expressible-by-current-runtime')
    const byKind = kind => unresolved.filter(link => taskById.get(link.issueId).workKind === kind).map(link => link.issueId)
    const mechanisms = byKind('mechanism-or-evidence')
    const configuration = [...byKind('cast-entry'), ...byKind('follow-up-link'), ...byKind('execution-binding')]
    const markers = byKind('status-marker')
    const boundaries = byKind('manual-boundary')
    const verification = byKind('source-behavior-verification')
    return { sourceId: entry.sourceId, name: entry.name, kind: entry.kind,
      preflightStatus: entry.preflightStatus, mechanismIssueIds: mechanisms, configurationIssueIds: configuration,
      statusMarkerIssueIds: markers, manualBoundaryIssueIds: boundaries, behaviorVerificationIssueIds: verification, allIssueIds: entry.links.map(link => link.issueId),
      // Markers can conceal undeclared limitations; never assume they are harmless.
      nextStep: mechanisms.length ? 'review-shared-mechanisms' : configuration.length ? 'review-configuration-contract' :
        markers.length || boundaries.length ? 'inspect-manual-activity-body' : verification.length ? 'verify-source-behavior' : entry.links.length ? 'await-batch-regeneration' : 'verify-existing-artifact',
      sourceBehaviorCertified: false }
  })
  const familyMap = new Map()
  for (const task of tasks.filter(task => task.workKind === 'mechanism-or-evidence' && task.unresolvedSourceIds.length)) {
    for (const family of task.suggestedFamilies.length ? task.suggestedFamilies : ['unclassified']) {
      const batch = familyMap.get(family) ?? { family, issueIds: new Set(), sourceIds: new Set() }
      batch.issueIds.add(task.issueId)
      for (const sourceId of task.unresolvedSourceIds) batch.sourceIds.add(sourceId)
      familyMap.set(family, batch)
    }
  }
  const batches = [...familyMap.values()].map(batch => ({ family: batch.family,
    issueIds: [...batch.issueIds].sort(), sourceIds: [...batch.sourceIds].sort() }))
    .sort((a, b) => b.sourceIds.length - a.sourceIds.length || a.family.localeCompare(b.family))
  return { schemaVersion: 1, apiCalls: 0, fullBookCertified: false, paidConversionGatePassed: false,
    note: 'Routing only. Status markers and connectivity diagnostics remain blockers; none are removed, certified, or automatically repaired. Family suggestions overlap and require code/source review.',
    counts: { entries: entries.length, diagnostics: tasks.length, unresolvedLinks: tasks.reduce((n, task) => n + task.unresolvedSourceIds.length, 0),
      byWorkKind: Object.fromEntries(['mechanism-or-evidence', 'cast-entry', 'follow-up-link', 'execution-binding', 'status-marker', 'manual-boundary', 'source-behavior-verification'].map(kind => [kind, {
        diagnostics: tasks.filter(task => task.workKind === kind).length,
        unresolvedLinks: tasks.filter(task => task.workKind === kind).reduce((n, task) => n + task.unresolvedSourceIds.length, 0),
      }])) }, batches,
    behaviorVerificationTasks: tasks.filter(task => task.workKind === 'source-behavior-verification' && task.unresolvedSourceIds.length),
    tasks, entries }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length !== 6 || args[0] !== '--backlog' || args[2] !== '--review' || args[4] !== '--output') {
    throw Error('Usage: --backlog <json> --review <json> --output <new-private-json>')
  }
  const [backlogBytes, reviewBytes] = await Promise.all([readFile(args[1]), readFile(args[3])])
  const review = JSON.parse(reviewBytes)
  if (review.backlog !== basename(args[1])) throw Error('Review names a different backlog')
  const plan = buildFullbookMechanismBatchPlan(JSON.parse(backlogBytes), review)
  plan.inputs = [args[1], args[3]].map((path, index) => ({ path: resolve(path),
    sha256: createHash('sha256').update(index === 0 ? backlogBytes : reviewBytes).digest('hex') }))
  await writeFile(args[5], JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' })
  console.log(JSON.stringify(plan.counts, null, 2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
