import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildFullbookMechanismBacklog } from './audit-fullbook-mechanism-backlog.mjs'

test('accounts for every entry, deduplicates shared findings and does not promote routing hints to evidence', () => {
  const input = { entries: [
    { sourceId: 'one', name: 'One', kind: 'spell', status: 'blocked', candidates: [{ run: 'a', issues: ['目标区域需核查', '目标区域需核查'] }] },
    { sourceId: 'two', name: 'Two', kind: 'feat', status: 'blocked', candidates: [{ run: 'a', issues: ['目标区域需核查', 'opaque finding'] }] },
    { sourceId: 'three', name: 'Three', kind: 'subclass', status: 'no-current-source-draft', candidates: [] },
  ] }
  const original = JSON.stringify(input), report = buildFullbookMechanismBacklog(input, 'digest')
  assert.equal(JSON.stringify(input), original)
  assert.deepEqual(report.counts, { entries: 3, preflightReady: 0, blocked: 3, distinctDiagnostics: 3, issueEntryLinks: 4, reviewedIssues: 0 })
  assert.equal(report.issues.find(issue => issue.diagnostic === '目标区域需核查').sources.length, 2)
  assert.equal(report.groups.find(group => group.id === 'unclassified').affectedEntryCount, 1)
  assert.ok(report.issues.every(issue => issue.reviewStatus === 'unreviewed' && issue.decision === null && issue.evidence.length === 0))
  assert.equal(report.fullBookCertified, false)
  assert.equal(report.apiCalls, 0)
})

test('selects a valid cached candidate instead of a newer failed regeneration', () => {
  const entry = { sourceId: 'one', name: 'One', kind: 'spell', status: 'ready-for-behavior-tests', candidates: [
    { run: 'valid', finished: '2026-09-01', status: 'ready-for-behavior-tests', issues: [] },
    { run: 'later', finished: '2026-09-02', status: 'blocked', issues: ['失败'] },
  ] }
  const report = buildFullbookMechanismBacklog({ entries: [entry] }, 'digest')
  assert.equal(report.entries[0].selectedRun, 'valid')
  assert.equal(report.counts.distinctDiagnostics, 0)
  assert.equal(report.entries[0].behaviorVerified, false)
  assert.throws(() => buildFullbookMechanismBacklog({ entries: [{ ...entry, status: 'blocked' }] }, 'digest'), /contradicts/)
  assert.throws(() => buildFullbookMechanismBacklog({ entries: [{ ...entry, candidates: [] }] }, 'digest'), /no ready candidate/)
  assert.throws(() => buildFullbookMechanismBacklog({ entries: [entry, entry] }, 'digest'), /duplicate/)
})
