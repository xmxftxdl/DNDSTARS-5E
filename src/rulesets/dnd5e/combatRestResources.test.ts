import { expect, it } from 'vitest'
import { applyDnd5eGrantedCombatShortRestBenefits, createDnd5eCombatant, replaceDnd5eCombatantActiveEffects, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat, type Dnd5eCombatEvent, type Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { restoreDnd5eCombatShortRestResources } from './combatRestResources'
import { createDnd5eConditionEffect } from './activeEffects'

function actor() {
  return createDnd5eCombatant({
    id: 'resting', name: 'Resting', controller: 'player', initiative: 10,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 2, armorClass: 10, currentHp: 5, maxHp: 20, temporaryHp: 0,
    speed: 30, position: { x: 0, y: 0 }, concentrating: false,
    classResources: { focus: { current: 0, max: 3 }, daily: { current: 0, max: 1 }, unknown: { current: 0, max: 5 }, 'dnd5e-pact-slot': { current: 0, max: 2 } },
    classResourceResets: { focus: 'short-rest', daily: 'long-rest', 'dnd5e-pact-slot': 'short-rest' },
    inventoryRevision: 2,
    inventoryResourceSnapshots: [{ instanceId: 'backpack', resources: {
      charge: { id: 'charge', label: 'Charge', current: 0, maximum: 4, resetOn: 'short-rest' },
      daily: { id: 'daily', label: 'Daily', current: 0, maximum: 3, resetOn: 'long-rest' },
    } }],
  })
}

function restingEffect(rounds = 2) {
  return createDnd5eConditionEffect({ id: 'rest-effect', condition: 'unconscious', targetId: 'resting',
    source: { kind: 'spell', rulesId: 'synthetic-rest' },
    duration: { type: 'rounds', remainingRounds: rounds, tickOn: 'target-turn-end' },
    completionRequirement: { condition: 'unconscious', interrupted: false }, completionReward: { kind: 'short-rest' } })
}

function endTurn(state: Dnd5eHeadlessCombatState) {
  const result = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: state.initiativeOrder[state.initiativeIndex] })
  if (!result.ok) throw new Error(`End turn failed: ${result.reason}`)
  return result
}

it('grants recovery only at real turn expiry and retains a receipt against repeat grants from another caster', () => {
  const target = actor()
  replaceDnd5eCombatantActiveEffects(target, [restingEffect()])
  const other = { ...actor(), id: 'other', initiative: 1 }
  const initial = startDnd5eHeadlessCombat('rest-expiry', [target, other])
  let advanced = endTurn(initial)
  expect(advanced.state.combatants.resting.classResources.focus.current).toBe(0)
  advanced = endTurn(endTurn(advanced.state).state)
  const completed = advanced.state.combatants.resting
  expect(completed.classResources.focus.current).toBe(3)
  expect(completed.inventoryResourceSnapshots?.[0].resources.charge.current).toBe(4)
  expect(completed.conditions).not.toContain('unconscious')
  expect(completed.classState.activeEffects?.filter(effect => effect.definitionId.startsWith('rest-completion:'))).toHaveLength(1)
  expect(initial.combatants.resting.classResources.focus.current).toBe(0)
  completed.classResources.focus.current = 0
  replaceDnd5eCombatantActiveEffects(completed, [...completed.classState.activeEffects ?? [], {
    ...restingEffect(1), id: 'second-rest-effect', source: { kind: 'spell', rulesId: 'synthetic-rest', actorId: 'other' },
  }])
  advanced = endTurn(endTurn(advanced.state).state)
  expect(advanced.state.combatants.resting.classResources.focus.current).toBe(0)
})

it.each(['interrupted', 'removed'] as const)('does not grant a rest for an %s effect at a turn boundary', mode => {
  const target = actor()
  const effect = restingEffect(1)
  if (effect.completionRequirement) effect.completionRequirement.interrupted = true
  replaceDnd5eCombatantActiveEffects(target, mode === 'removed' ? [] : [effect])
  const state = startDnd5eHeadlessCombat(`rest-${mode}`, [target, { ...actor(), id: 'other', initiative: 1 }])
  const result = endTurn(state)
  expect(result.state.combatants.resting.classResources.focus.current).toBe(0)
  expect(result.state.combatants.resting.classState.activeEffects?.some(entry => entry.definitionId.startsWith('rest-completion:')) ?? false).toBe(false)
})

it.each([1, 20])('handles timed repeat-save expiry separately from successful early removal (d20=%s)', d20 => {
  const target = actor()
  replaceDnd5eCombatantActiveEffects(target, [{ ...restingEffect(1),
    repeatSave: { ability: 'wis', dc: 12, timing: 'target-turn-end', onSuccess: 'remove' },
  }])
  const state = startDnd5eHeadlessCombat('rest-repeat-save', [target, { ...actor(), id: 'other', initiative: 1 }])
  const result = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: target.id,
    activeEffectSavingThrows: [{ effectId: 'rest-effect', d20 }] })
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.state.combatants.resting.classResources.focus.current).toBe(d20 === 1 ? 3 : 0)
})

it('restores declared resources and backpack charges while preserving other resources, HP and turn economy', () => {
  const target = actor()
  target.turn.actionAvailable = false
  const originalTurn = structuredClone(target.turn)
  const events: Dnd5eCombatEvent[] = []
  restoreDnd5eCombatShortRestResources(target, events)
  expect(target.classResources).toMatchObject({ focus: { current: 3 }, daily: { current: 0 }, unknown: { current: 0 }, 'dnd5e-pact-slot': { current: 2 } })
  expect(target.inventoryResourceSnapshots?.[0].resources).toMatchObject({ charge: { current: 4 }, daily: { current: 0 } })
  expect(target.inventoryRevision).toBe(3)
  expect(target.currentHp).toBe(5)
  expect(target.turn).toEqual(originalTurn)
  expect(events.filter(event => event.type === 'class-resource-restored')).toHaveLength(2)
  restoreDnd5eCombatShortRestResources(target, events)
  expect(target.inventoryRevision).toBe(3)
  expect(events).toHaveLength(2)
})

it('restores all equipped projections of shared charges without mutating source snapshots', () => {
  const target = actor()
  const resources = structuredClone(target.inventoryResourceSnapshots![0].resources)
  target.inventoryHeadlessEffects = ['first', 'second'].map(effectId => ({
    instanceId: 'backpack', templateId: 'test:item', itemName: 'Item', equippedSlot: 'mainWeapon', effectId,
    effect: { schemaVersion: 1, kind: 'damage-reduction', trigger: 'before-damage', amount: 1 }, resources,
  }))
  restoreDnd5eCombatShortRestResources(target, [])
  expect(target.inventoryHeadlessEffects.map(snapshot => snapshot.resources.charge.current)).toEqual([4, 4])
  expect(resources.charge.current).toBe(0)
  expect(target.inventoryRevision).toBe(3)
})

it('keeps simulacrum spell slots spent and caps sorcerous restoration at the resource maximum', () => {
  const target = actor()
  target.simulacrumCannotRegainSpellSlots = true
  target.classId = 'sorcerer'
  target.level = 20
  target.classResources['dnd5e-sorcery-points'] = { current: 18, max: 20 }
  const events: Dnd5eCombatEvent[] = []
  restoreDnd5eCombatShortRestResources(target, events)
  expect(target.classResources['dnd5e-pact-slot'].current).toBe(0)
  expect(target.classResources['dnd5e-sorcery-points'].current).toBe(20)
  expect(target.classResources.focus.current).toBe(3)
  target.level = 19
  target.classResources['dnd5e-sorcery-points'].current = 0
  restoreDnd5eCombatShortRestResources(target, [])
  expect(target.classResources['dnd5e-sorcery-points'].current).toBe(0)
})

it('combines resource recovery with rest-only effect and ability cleanup without removing magic-only reductions', () => {
  const target = actor()
  target.abilities.str = 7
  target.baseSavingThrowBonuses.str = -2
  target.savingThrowBonuses.str = -2
  target.classState.abilityScoreReductionLedger = [
    { id: 'rest', ability: 'str', amount: 2, recovery: 'short-or-long-rest' },
    { id: 'magic', ability: 'str', amount: 1, recovery: 'restoration-magic' },
  ]
  target.classState.relentlessRageDc = 20
  replaceDnd5eCombatantActiveEffects(target, [
    createDnd5eConditionEffect({ condition: 'frightened', targetId: target.id, source: { kind: 'dm' }, duration: { type: 'permanent' }, breakOn: ['short-rest-complete'] }),
    createDnd5eConditionEffect({ condition: 'poisoned', targetId: target.id, source: { kind: 'dm' }, duration: { type: 'permanent' }, breakOn: ['long-rest-complete'] }),
  ])
  const events: Dnd5eCombatEvent[] = []
  applyDnd5eGrantedCombatShortRestBenefits(target, events)
  expect(target.conditions).not.toContain('frightened')
  expect(target.conditions).toContain('poisoned')
  expect(target.abilities.str).toBe(9)
  expect(target.baseSavingThrowBonuses.str).toBe(-1)
  expect(target.savingThrowBonuses.str).toBe(-1)
  expect(target.classState.abilityScoreReductionLedger).toEqual([{ id: 'magic', ability: 'str', amount: 1, recovery: 'restoration-magic' }])
  expect(target.classState.relentlessRageDc).toBeUndefined()
  expect(target.classResources.focus.current).toBe(3)
  expect(target.currentHp).toBe(5)
  expect(events).toContainEqual(expect.objectContaining({ type: 'ability-score-restored', amount: 2, reason: 'short-rest' }))
})
