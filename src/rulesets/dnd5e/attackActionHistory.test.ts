import { expect, it } from 'vitest'
import { advanceDnd5eAttackActionHistory } from './attackActionHistory'
import { createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat, type Dnd5eAction } from './headlessCombatEngine'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { validateDeclarativeSubclassAbilityV1, type DeclarativeSubclassAbilityV1 } from './declarativeSubclassAbility'

it('separates action instances, creature targets, restricted actions and turn boundaries', () => {
  const input = { turnKey: 'turn1', startsAction: true, targetId: 'a', creature: true, restricted: false }
  const first = advanceDnd5eAttackActionHistory(undefined, input)!
  const repeat = advanceDnd5eAttackActionHistory(first, { ...input, startsAction: false })!
  const object = advanceDnd5eAttackActionHistory(repeat, { ...input, startsAction: false, targetId: 'wall', creature: false })!
  const second = advanceDnd5eAttackActionHistory(object, { ...input, startsAction: false, targetId: 'b' })!
  expect(second.creatureTargetIds).toEqual(['a', 'b'])
  expect(second.attacksTaken).toBe(4)
  expect(first.creatureTargetIds).toEqual(['a'])
  expect(first.attacksTaken).toBe(1)
  const surge = advanceDnd5eAttackActionHistory(second, { ...input, targetId: 'c', restricted: true })!
  expect(surge).toMatchObject({ actionOrdinal: 2, attacksTaken: 1, creatureTargetIds: ['c'], restricted: true })
  expect(advanceDnd5eAttackActionHistory(second, { ...input, turnKey: 'turn2', startsAction: false })).toBeUndefined()
  expect(advanceDnd5eAttackActionHistory(second, { ...input, turnKey: 'turn2' })?.actionOrdinal).toBe(1)
})

function initial() {
  const actor = createDnd5eCombatant({ id: 'actor', name: 'Actor', controller: 'player', initiative: 20,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
    armorClass: 10, currentHp: 100, maxHp: 100, temporaryHp: 0, speed: 30,
    position: { x: 0, y: 0 }, concentrating: false })
  return startDnd5eHeadlessCombat('history', [actor,
    { ...structuredClone(actor), id: 'a', controller: 'dm', initiative: 10 },
    { ...structuredClone(actor), id: 'b', controller: 'dm', initiative: 5 }])
}
const attack: Extract<Dnd5eAction, { type: 'attack' }> = {
  type: 'attack', actorId: 'actor', targetId: 'a', d20: 1, attackModifier: 10,
  damage: { count: 1, sides: 6, bonus: 0, rolls: [2], type: 'slashing' },
}

it('records settled attacks including misses, survives JSON, and starts a fresh history for the next action', () => {
  const source = initial()
  const first = resolveDnd5eHeadlessAction(source, attack)
  expect(first.ok).toBe(true)
  expect(first.state.combatants.actor.classState.attackActionHistory?.creatureTargetIds).toEqual(['a'])
  expect(source.combatants.actor.classState.attackActionHistory).toBeUndefined()
  const second = resolveDnd5eHeadlessAction(JSON.parse(JSON.stringify(first.state)),
    { ...attack, targetId: 'b', spendAction: false, d20: 15 })
  expect(second.ok).toBe(true)
  expect(second.state.combatants.actor.classState.attackActionHistory).toMatchObject({
    actionOrdinal: 1, attacksTaken: 2, creatureTargetIds: ['a', 'b'],
  })
  expect(first.state.combatants.actor.classState.attackActionHistory?.creatureTargetIds).toEqual(['a'])
  // Supply another ordinary action as an Action Surge would; do not change history.
  second.state.combatants.actor.turn.actionAvailable = true
  const next = resolveDnd5eHeadlessAction(second.state, { ...attack, targetId: 'b' })
  expect(next.ok).toBe(true)
  expect(next.state.combatants.actor.classState.attackActionHistory).toMatchObject({
    actionOrdinal: 2, attacksTaken: 1, creatureTargetIds: ['b'],
  })
})

it('does not invent an Attack action for an orphan continuation or mutate history on a rejected attack', () => {
  const orphan = resolveDnd5eHeadlessAction(initial(), { ...attack, spendAction: false })
  expect(orphan.state.combatants.actor.classState.attackActionHistory).toBeUndefined()
  const first = resolveDnd5eHeadlessAction(initial(), attack)
  const before = structuredClone(first.state)
  const rejected = resolveDnd5eHeadlessAction(first.state, { ...attack, targetId: 'missing', spendAction: false })
  expect(rejected.ok).toBe(false)
  expect(first.state).toEqual(before)
  expect(rejected.state.combatants.actor.classState.attackActionHistory).toEqual(before.combatants.actor.classState.attackActionHistory)
})

const distinctBonus: DeclarativeSubclassAbilityV1 = {
  schemaVersion: 1, id: 'distinct', name: 'Distinct attack', description: 'Synthetic per-action grant.', level: 11,
  trigger: { kind: 'passive' }, targeting: { kind: 'self' }, effects: [], automation: 'full',
  mechanic: { kind: 'distinct-target-bonus-attack', minimumDistinctTargets: 2 },
}

it('validates bounded passive distinct-target grants', () => {
  expect(() => validateDeclarativeSubclassAbilityV1(distinctBonus)).not.toThrow()
  for (const minimumDistinctTargets of [0, 1, 2.5, 11, Infinity])
    expect(() => validateDeclarativeSubclassAbilityV1({ ...distinctBonus,
      mechanic: { kind: 'distinct-target-bonus-attack', minimumDistinctTargets } })).toThrow()
})

it('consumes a distinct-target grant once on a miss, excludes prior targets and checks ownership and action identity', () => {
  const namespace = 'com.example.distinct-attack', subclassId = `${namespace}:test`, featureId = `${subclassId}.distinct`
  const dispose = registerDnd5eRulesPlugin({
    manifest: { id: namespace, name: 'Distinct attack test', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Test', license: 'CC0-1.0' },
    setup(api) { api.registerDeclarativeSubclass({ schemaVersion: 1, id: 'test', classId: 'ranger',
      name: 'Test', summary: 'Synthetic', abilities: [distinctBonus] }) },
  })
  try {
    const source = initial(), actor = source.combatants.actor
    actor.classLevels = { ranger: 11 }; actor.subclassIds = { ranger: subclassId }; actor.pluginFeatureIds = [featureId]
    source.combatants.c = { ...structuredClone(source.combatants.a), id: 'c' }
    let ready = resolveDnd5eHeadlessAction(source, attack).state
    ready = resolveDnd5eHeadlessAction(ready, { ...attack, spendAction: false, targetId: 'b' }).state
    const bonus: Extract<Dnd5eAction, { type: 'attack' }> = { ...attack, targetId: 'c', spendAction: false,
      classDamageContext: { mode: 'melee', weaponId: 'sword', finesse: false, strengthBased: true,
        weaponDamageSides: 6, damageType: 'slashing', adjacentEnemyOfTarget: false,
        distinctTargetBonusAttackFeatureId: featureId } }
    for (const mode of ['prior', 'low', 'unowned', 'wrong-subclass', 'restricted', 'new-action', 'cross-turn', 'object']) {
      const state = structuredClone(ready), command = structuredClone(bonus)
      if (mode === 'prior') command.targetId = 'a'
      if (mode === 'low') state.combatants.actor.classLevels = { ranger: 10 }
      if (mode === 'unowned') state.combatants.actor.pluginFeatureIds = []
      if (mode === 'wrong-subclass') state.combatants.actor.subclassIds = { ranger: 'hunter' }
      if (mode === 'restricted') state.combatants.actor.classState.attackActionHistory!.restricted = true
      if (mode === 'new-action') command.spendAction = true
      if (mode === 'cross-turn') state.combatants.actor.classState.attackActionHistory!.turnKey = 'old'
      if (mode === 'object') state.combatants.c.objectDamageThreshold = 0
      const result = resolveDnd5eHeadlessAction(state, command)
      expect(result.ok, mode).toBe(false)
      expect(result.state.combatants.actor.classState.attackActionHistory).toEqual(state.combatants.actor.classState.attackActionHistory)
    }
    const used = resolveDnd5eHeadlessAction(ready, bonus)
    expect(used.ok, used.ok ? '' : used.reason).toBe(true)
    expect(used.state.combatants.actor.classState.attackActionHistory?.usedDistinctTargetBonusFeatureIds).toEqual([featureId])
    expect(used.state.combatants.actor.classState.attackActionHistory?.creatureTargetIds).toEqual(['a', 'b', 'c'])
    expect(ready.combatants.actor.classState.attackActionHistory?.usedDistinctTargetBonusFeatureIds).toBeUndefined()
    const restored = JSON.parse(JSON.stringify(used.state))
    restored.combatants.d = { ...structuredClone(restored.combatants.a), id: 'd' }
    expect(resolveDnd5eHeadlessAction(restored, { ...bonus, targetId: 'd' }).ok).toBe(false)
  } finally { dispose() }
})
