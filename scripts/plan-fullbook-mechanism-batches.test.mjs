import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { buildFullbookMechanismBatchPlan, fullbookDiagnosticWorkKind } from './plan-fullbook-mechanism-batches.mjs'
import { suggestFullbookMechanismFamilies } from './audit-fullbook-mechanism-backlog.mjs'

test('refreshes stale family hints without rewriting evidence or releasing blockers', () => {
  const cases = [
    ['同一时间只能拥有一只造妖', ['summons-control', 'lifecycle-resource']],
    ['已有存活造妖时施法失败', ['summons-control', 'lifecycle-resource']],
    ['每天在同一地点施放使神庙永久存在', ['items-objects', 'lifecycle-resource']],
    ['石柱在生物脚下升起时使生物被顶起', ['items-objects', 'target-geometry']],
    ['自愿生物目的地周围必须有未被占据空间', ['target-geometry']],
    ['残骸云的重度遮蔽', ['target-geometry']],
    ['输入没有提供对应额外法术', ['source-evidence']],
    ['未知语义', ['unclassified']],
  ]
  const issues = cases.map(([diagnostic]) => ({ id: createHash('sha256').update(diagnostic).digest('hex'),
    diagnostic, suggestedFamilies: ['unclassified'], sources: [{ sourceId: 'one', name: 'One' }] }))
  const backlog = { schemaVersion: 1, entries: [{ sourceId: 'one', name: 'One', issueIds: issues.map(issue => issue.id) }], issues }
  const before = JSON.stringify(backlog)
  const plan = buildFullbookMechanismBatchPlan(backlog, { reviews: [] })
  for (const [diagnostic, expected] of cases) {
    const task = plan.tasks.find(task => task.diagnostic === diagnostic)
    for (const family of expected) assert.ok(task.suggestedFamilies.includes(family))
    assert.deepEqual(task.originalSuggestedFamilies, ['unclassified'])
    assert.deepEqual(task.unresolvedSourceIds, ['one'])
    assert.equal(task.workKind, 'mechanism-or-evidence')
    assert.equal(task.sourceBehaviorCertified, false)
    assert.deepEqual(task.suggestedFamilies, suggestFullbookMechanismFamilies(diagnostic))
  }
  assert.equal(plan.counts.unresolvedLinks, cases.length)
  assert.equal(plan.fullBookCertified, false)
  assert.equal(plan.paidConversionGatePassed, false)
  assert.equal(JSON.stringify(backlog), before)
})

const restDiagnostic = 'Activity recovery 的休息记录、Host一次性授权、特性选择和收据原子提交已接入；已验证自动导出子职包的DM长休→玩家护甲选择→Host结算→刷新防重用。仍需逐项验证本能力的房间事件调度、目标/选项、短休、跳过与结束清理，不能仅凭数据校验认证完整休息触发自动化。'

test('routes known pending source behavior separately without dropping or certifying it',()=>{
  const id=createHash('sha256').update(restDiagnostic).digest('hex')
  const backlog={schemaVersion:1,entries:[{sourceId:'source',name:'Source',issueIds:[id]}],issues:[{
    id,diagnostic:restDiagnostic,suggestedFamilies:['resources'],sources:[{sourceId:'source',name:'Source'}]}]}
  const plan=buildFullbookMechanismBatchPlan(backlog,{reviews:[]})
  assert.equal(plan.counts.unresolvedLinks,1)
  assert.equal(plan.behaviorVerificationTasks.length,1)
  assert.deepEqual(plan.behaviorVerificationTasks[0].unresolvedSourceIds,['source'])
  assert.deepEqual(plan.entries[0].behaviorVerificationIssueIds,[id])
  assert.equal(plan.entries[0].nextStep,'verify-source-behavior')
  assert.equal(plan.entries[0].sourceBehaviorCertified,false)
  assert.equal(plan.fullBookCertified,false)
  assert.equal(plan.paidConversionGatePassed,false)
  assert.equal(plan.batches.length,0)
  assert.equal(fullbookDiagnosticWorkKind(restDiagnostic+'另缺位面校验'),'mechanism-or-evidence')
  assert.equal(fullbookDiagnosticWorkKind(restDiagnostic.replace('已接入','未接入')),'mechanism-or-evidence')
})

test('separates exact status/connectivity messages without certifying similar rule limitations', () => {
  assert.equal(fullbookDiagnosticWorkKind('Activity foo 尚需手动结算或仅供展示。'), 'status-marker')
  assert.equal(fullbookDiagnosticWorkKind('Activity foo 未从法术施放入口授予或调用，玩家无法使用。'), 'follow-up-link')
  assert.equal(fullbookDiagnosticWorkKind('法术 foo 缺少无需效果授权的完整施放入口；后续限制'), 'cast-entry')
  assert.equal(fullbookDiagnosticWorkKind('Activity foo 尚需手动结算或仅供展示。还缺反应中断'), 'mechanism-or-evidence')
  assert.equal(fullbookDiagnosticWorkKind('Activity 包含显式 DM 裁定 operation。'), 'manual-boundary')
  assert.equal(fullbookDiagnosticWorkKind('特性或专长仍声明部分自动化或手动结算。'), 'status-marker')
  assert.equal(fullbookDiagnosticWorkKind('声明式能力尚需独立执行路径与行为验证。'), 'execution-binding')
})

test('keeps shared issues source-scoped, all markers blocking, and family counts nonadditive', () => {
  const diagnostic = '共同机制仍需验证'
  const id = createHash('sha256').update(diagnostic).digest('hex')
  const marker = 'Activity foo 尚需手动结算或仅供展示。'
  const mid = createHash('sha256').update(marker).digest('hex')
  const backlog = { schemaVersion: 1,
    entries: [{ sourceId: 'one', name: 'One', issueIds: [id, mid] }, { sourceId: 'two', name: 'Two', issueIds: [id] }],
    issues: [{ id, diagnostic, suggestedFamilies: ['events', 'resources'], sources: [{ sourceId: 'one', name: 'One' }, { sourceId: 'two', name: 'Two' }] },
      { id: mid, diagnostic: marker, suggestedFamilies: ['contracts'], sources: [{ sourceId: 'one', name: 'One' }] }] }
  const review = { reviews: [{ issueId: id, diagnostic, sourceIds: ['one'], decision: 'expressible-by-current-runtime',
    configurationStillRequiresRegeneration: true, behaviorVerified: false, evidence: ['fixture'] }] }
  const before = JSON.stringify({ backlog, review })
  const plan = buildFullbookMechanismBatchPlan(backlog, review)
  assert.equal(plan.counts.diagnostics, 2)
  assert.equal(plan.counts.unresolvedLinks, 2)
  assert.equal(plan.tasks.find(task => task.issueId === id).unresolvedSourceIds.join(), 'two')
  assert.equal(plan.entries.find(entry => entry.sourceId === 'one').nextStep, 'inspect-manual-activity-body')
  assert.equal(plan.batches.length, 2)
  assert.ok(plan.batches.every(batch => batch.sourceIds.join() === 'two'))
  assert.equal(plan.paidConversionGatePassed, false)
  assert.ok(plan.entries.every(entry => entry.sourceBehaviorCertified === false))
  assert.equal(JSON.stringify({ backlog, review }), before)
})
