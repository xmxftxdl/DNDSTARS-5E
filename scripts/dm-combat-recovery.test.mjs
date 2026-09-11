import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dmUndoAfterMetadata, dmUndoPublicHistory } from './dm-combat-recovery.mjs'

const combat = { active: true, mapId: 'map', combatId: 'fight', round: 1, initiativeIndex: 0,
  initiativeOrder: [{ tokenId: 'hero', slotId: 'hero-slot', label: '法师' }] }

test('keeps turn identity and concrete damage/resource/movement descriptions', () => {
  assert.equal(dmUndoAfterMetadata('combat', combat).actorLabel, '法师')
  const before = { characters: [{ id: 'hero', name: '法师', currentHp: 30, classResources: { slot1: { current: 3 } } }] }
  const after = { characters: [{ id: 'hero', name: '法师', currentHp: 20, classResources: { slot1: { current: 2 } } }] }
  const details = dmUndoAfterMetadata('characters', after, before).details.join('\n')
  assert.match(details, /HP 30 → 20（恢复为 30）/)
  assert.match(details, /slot1 3 → 2/)
})

test('reconstructs old logs at matching revisions and assigns map-only actions to the turn', () => {
  const action = { transactionId: 'action', status: 'applied', label: '施法', changes: [
    { resource: 'combat-log', beforeRevision: 1, afterRevision: 2, before: { entries: [] } },
  ] }
  const next = { transactionId: 'next', status: 'applied', label: '移动', changes: [
    { resource: 'combat-log', beforeRevision: 2, afterRevision: 3, before: { entries: [{ id: 1, text: '法师施放火焰箭，造成 24 点伤害' }] } },
  ] }
  const summaries = dmUndoPublicHistory([action, next], combat)
  assert.equal(summaries[1].details[0], '法师施放火焰箭，造成 24 点伤害')
  assert.equal(summaries[0].combat.beforeActorLabel, '法师')
  next.changes[0].beforeRevision = 99
  assert.deepEqual(dmUndoPublicHistory([action, next], combat)[1].details, [])
})

test('uses the current matching revision to describe the newest legacy transaction', () => {
  const transaction = { transactionId: 'last', status: 'applied', label: '结算玩家行动', changes: [
    { resource: 'characters', beforeRevision: 3, afterRevision: 4,
      before: { characters: [{ id: 'hero', name: '法师', currentHp: 30 }] } },
  ] }
  const snapshot = { resource: 'characters', value: { _sync: { revision: 4 }, characters: [{ id: 'hero', name: '法师', currentHp: 10 }] } }
  assert.match(dmUndoPublicHistory([transaction], combat, [snapshot])[0].details.join(), /HP 30 → 10/)
  snapshot.value._sync.revision = 5
  assert.deepEqual(dmUndoPublicHistory([transaction], combat, [snapshot])[0].details, [])
})
