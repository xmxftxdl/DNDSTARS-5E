import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildFullbookMechanismBacklog } from './audit-fullbook-mechanism-backlog.mjs'
import { buildFullbookReviewCoverage } from './audit-fullbook-review-coverage.mjs'

function fixture() {
  const backlog = buildFullbookMechanismBacklog({ entries: ['one', 'two'].map(sourceId => ({ sourceId, name: sourceId, kind: 'spell', status: 'blocked', candidates: [{ issues: ['shared diagnostic'] }] })) }, 'input')
  const issue = backlog.issues[0]
  const review = { reviews: [{ issueId: issue.id, diagnostic: issue.diagnostic, sourceIds: ['one'], evidence: ['test.ts'],
    decision: 'expressible-by-current-runtime', behaviorVerified: false, configurationStillRequiresRegeneration: true }] }
  return { backlog, review }
}

test('keeps source-scoped evidence separate from shared diagnostics and conversion certification', () => {
  const { backlog, review } = fixture(), original = JSON.stringify({ backlog, review })
  const result = buildFullbookReviewCoverage(backlog, review)
  assert.equal(result.entries[0].nextStep, 'await-batch-regeneration')
  assert.equal(result.entries[1].nextStep, 'review-or-implement-mechanisms')
  assert.equal(result.counts.expressibleLinks, 1)
  assert.equal(result.counts.unreviewedLinks, 1)
  assert.equal(result.fullBookCertified, false)
  assert.equal(result.paidConversionGatePassed, false)
  assert.ok(result.entries.every(row => row.sourceBehaviorCertified === false))
  assert.equal(JSON.stringify({ backlog, review }), original)
  review.reviews[0].decision = 'partially-addressed-by-current-runtime'
  assert.equal(buildFullbookReviewCoverage(backlog, review).counts.entriesAwaitingBatchRegeneration, 0)
})

test('rejects mismatched evidence identities, unsupported claims and malformed scopes', () => {
  for (const mutate of [
    row => { row.diagnostic = 'changed' }, row => { row.issueId = 'unknown' },
    row => { row.behaviorVerified = true }, row => { row.configurationStillRequiresRegeneration = false },
    row => { row.sourceIds = ['other'] }, row => { row.sourceIds = ['one', 'one'] },
    row => { row.evidence = [] }, row => { row.decision = 'fully-automated' },
  ]) {
    const { backlog, review } = fixture()
    mutate(review.reviews[0])
    assert.throws(() => buildFullbookReviewCoverage(backlog, review))
  }
  const { backlog, review } = fixture()
  review.reviews.push(review.reviews[0])
  assert.throws(() => buildFullbookReviewCoverage(backlog, review), /Duplicate review/)
})

test('does not promote clean preflight entries to source behavioral acceptance', () => {
  const backlog = buildFullbookMechanismBacklog({ entries: [{ sourceId: 'ready', name: 'Ready', kind: 'feat', status: 'ready-for-behavior-tests', candidates: [{ status: 'ready-for-behavior-tests' }] }] }, 'input')
  const report = buildFullbookReviewCoverage(backlog, { reviews: [] })
  assert.equal(report.entries[0].nextStep, 'verify-existing-artifact')
  assert.equal(report.entries[0].sourceBehaviorCertified, false)
  assert.equal(report.paidConversionGatePassed, false)
})

test('tracks unsupported source claims without treating them as implemented mechanisms or paid readiness', () => {
  const { backlog, review } = fixture()
  review.reviews[0].decision = 'source-claim-not-supported'
  const report = buildFullbookReviewCoverage(backlog, review)
  assert.equal(report.counts.sourceCorrectionLinks, 1)
  assert.equal(report.counts.expressibleLinks, 0)
  assert.equal(report.counts.entriesAwaitingBatchRegeneration, 0)
  assert.equal(report.entries[0].nextStep, 'review-or-implement-mechanisms')
  assert.equal(report.counts.unreviewedLinks, 1)
  assert.equal(report.entries[0].sourceBehaviorCertified, false)
  assert.equal(report.paidConversionGatePassed, false)
})
