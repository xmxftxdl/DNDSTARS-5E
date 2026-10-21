import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectManualBoundaries, selectExactSourceDrafts, summarizeExecutionDeclarations, sourceDiagnosticReviews } from './audit-fullbook-manual-boundaries.mjs'

test('reuses only exact, source-scoped review evidence without certifying a draft', () => {
  const reviews = [{ diagnostic: 'Old limitation', sourceIds: ['one'], decision: 'expressible-by-current-runtime',
    evidence: ['test.ts'], configurationStillRequiresRegeneration: true }]
  const result = sourceDiagnosticReviews(['Old limitation', 'Old limitation with new constraint'], 'one', reviews)
  assert.equal(result[0].decision, 'expressible-by-current-runtime')
  assert.equal(result[0].configurationStillRequiresRegeneration, true)
  assert.equal(result[0].sourceBehaviorCertified, false)
  assert.equal(result[1].decision, 'unreviewed')
  assert.equal(sourceDiagnosticReviews(['Old limitation'], 'other', reviews)[0].decision, 'unreviewed')
  assert.throws(() => sourceDiagnosticReviews(['Old limitation'], 'one', [...reviews, ...reviews]))
})

test('reports authored declarations without inventing executable bindings or certifying passive choices', () => {
  const content = { features: [{ id: 'description-only', automation: 'manual' }],
    feats: [{ id: 'partial', automation: 'partial', advancements: [{ id: 'ability' }],
      declarativeAbility: { mechanic: { kind: 'passive-defense' } } }], activities: [] }
  const before = structuredClone(content)
  assert.deepEqual(summarizeExecutionDeclarations(content), { activityCount: 0, entries: [
    { id: 'description-only', automation: 'manual', explicitActionId: null, declarativeMechanic: null,
      advancementCount: 0, passiveEffectCount: 0, spellGrantCount: 0 },
    { id: 'partial', automation: 'partial', explicitActionId: null, declarativeMechanic: 'passive-defense',
      advancementCount: 1, passiveEffectCount: 0, spellGrantCount: 0 },
  ] })
  assert.deepEqual(content, before)
})

test('retains nested operation and declaration paths without declaring narrative or completeness', () => {
  const content = { subclasses: [{ abilities: [{ id: 'one', automation: 'manual', description: 'A deterministic rule' }] }],
    activities: [{ id: 'two', outcomes: [{ operations: [{ id: 'ask', kind: 'manual-adjudication', reason: 'A story fact' }] }] }],
    features: [{ id: 'three', automation: 'partial' }, { id: 'four', automation: 'full', description: 'manual-adjudication appears only as text' }],
    spells: [{ id: 'reference', automation: { mode: 'reference-only' } }] }
  const original = JSON.stringify(content), rows = collectManualBoundaries(content)
  assert.equal(rows.length, 4)
  assert.equal(rows[0].path, '$.subclasses[0].abilities[0]')
  assert.equal(rows[1].path, '$.activities[0].outcomes[0].operations[0]')
  assert.equal(rows[1].category, 'explicit-operation')
  assert.equal(JSON.stringify(content), original)
})

test('requires exact verified source text and explicit automatic provenance', () => {
  const source = { id: 'one', kind: 'spell', name: 'Test', text: 'Original' }
  const good = { source, draft: { contentJson: '{}' } }
  const run = { manualContentRepairs: false, drafts: [good, { ...good, source: { ...source, text: 'Edited' } }] }
  assert.deepEqual(selectExactSourceDrafts(run, source), [good])
  assert.throws(() => selectExactSourceDrafts({ ...run, manualContentRepairs: true }, source))
  assert.throws(() => selectExactSourceDrafts({ drafts: [good] }, source))
  assert.deepEqual(selectExactSourceDrafts(run, { ...source, id: 'other' }), [])
})
