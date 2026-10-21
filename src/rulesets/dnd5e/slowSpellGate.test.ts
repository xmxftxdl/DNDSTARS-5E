import { describe, expect, it } from 'vitest'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { createDnd5eCombatant, dnd5eCombatantPairKey, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat, type Dnd5eAction } from './headlessCombatEngine'
import { ensureDnd5eCoreSpellActivitiesRegisteredV1 } from './activities/dnd5eCoreSpellActivities'

function fixture(spellId: string, classId: 'wizard' | 'cleric' = 'wizard') {
  const actor = createDnd5eCombatant({ id: 'caster', name: '任意施法者', controller: 'player', initiative: 20,
    abilities: { str: 10, dex: 12, con: 12, int: 18, wis: 18, cha: 12 }, proficiencyBonus: 3,
    armorClass: 12, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false,
    classId, level: 5, classLevels: { [classId]: 5 }, saveDc: 15, languages: ['Common'],
    classSelections: { 'spell-prepared': [spellId] },
    classSelectionsByClass: { [classId]: { 'spell-prepared': [spellId] } },
    classResources: { 'dnd5e-spell-slot-1': { current: 2, max: 2 } },
  })
  actor.classState.activeEffects = [createDnd5eMechanicalEffect({ definitionId: 'slow', label: '缓慢术', targetId: actor.id,
    source: { kind: 'spell', rulesId: 'slow' }, modifiers: { actionSpellDelay: { dieSides: 20, delayMinimum: 11 }, actionOrBonusActionOnly: true },
  })]
  const target = createDnd5eCombatant({ ...actor, id: 'target', name: '目标', initiative: 10, controller: 'dm', classState: {}, languages: ['Common'] })
  const state = startDnd5eHeadlessCombat('gate-test', [actor, target])
  state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('caster', 'target')]: 10 }
  const action: SharedPlayerActionState = { id: 'request', type: 'dnd5e-spell-cast', mapId: 'map', combatId: 'gate-test',
    sourceMode: 'player', status: 'pending', actorTokenId: actor.id, characterId: 'character', round: 1,
    initiativeIndex: 0, seq: 1, updatedAt: 1, dnd5eSpellCast: { spellId, slotLevel: 1, targetTokenId: target.id } }
  const check = (d20: number): Extract<Dnd5eAction, { type: 'check-slow-spell' }> => ({ type: 'check-slow-spell', actorId: actor.id,
    requestId: action.id, spellId, spellName: spellId, slotLevel: 1, d20, intent: { kind: 'player', action } })
  return { state, check }
}
const core: Dnd5eAction = { type: 'cast-spell', actorId: 'caster', targetId: 'target', targetIds: ['target'],
  spellId: 'magic-missile', slotLevel: 1, projectileTargetIds: ['target', 'target', 'target'], effectRolls: [1, 2, 3] }
const adjudicated: Dnd5eAction = { type: 'adjudicated-spell', actorId: 'caster', spellId: 'custom-spell', spellName: '自定义法术',
  castingClassId: 'wizard', spellLevel: 1, slotLevel: 1, castingTime: 'action', effects: [{ targetId: 'target', operation: 'damage', amount: 4 }] }
function activity(): Dnd5eAction {
  ensureDnd5eCoreSpellActivitiesRegisteredV1()
  return { type: 'plugin-spell-activity', actorId: 'caster',
    pluginAction: { type: 'plugin', actorId: 'caster', pluginId: 'srd-5.1', actionId: 'spell:command',
      transactionId: 'command-gate', targetId: 'target', targetIds: ['target'], castLevel: 1,
      payload: { activityChoices: { 'command-mode': 'grovel' } }, rolls: { 'command-save-d20:target': { values: [1, 2], modifier: 0, total: 3 } } },
    spell: { castingClassId: 'cleric', spellId: 'command', spellName: '命令术', spellLevel: 1, slotLevel: 1,
      castingTime: 'action', declaredTargetIds: ['target'], spellSchool: 'enchantment' } }
}

describe('Slow gate across spell execution routes', () => {
  it.each([['core', 'magic-missile', 'wizard'], ['adjudicated', 'custom-spell', 'wizard'], ['activity', 'command', 'cleric']] as const)(
    '%s defers before effect dice, survives serialization, then settles once', (route, spellId, classId) => {
      const { state, check } = fixture(spellId, classId)
      const command = route === 'core' ? core : route === 'adjudicated' ? adjudicated : activity()
      const bypass = resolveDnd5eHeadlessAction(state, command)
      expect(bypass.ok).toBe(false)
      expect(bypass.events.some(event => event.type === 'damage-applied')).toBe(false)
      const deferred = resolveDnd5eHeadlessAction(state, check(11))
      expect(deferred.ok, deferred.ok ? undefined : deferred.reason).toBe(true)
      expect(deferred.events.some(event => ['attack-resolved', 'saving-throw-resolved', 'damage-applied', 'spell-cast'].includes(event.type))).toBe(false)
      expect(deferred.state.combatants.caster.classResources['dnd5e-spell-slot-1'].current).toBe(2)
      expect(deferred.state.combatants.caster.turn.actionAvailable).toBe(false)
      expect(resolveDnd5eHeadlessAction(deferred.state, command).ok).toBe(false)
      const resumed = JSON.parse(JSON.stringify(deferred.state)) as typeof state
      resumed.round += 1
      resumed.combatants.caster.turn.actionAvailable = true
      resumed.combatants.caster.turn.bonusActionAvailable = true
      const completed = resolveDnd5eHeadlessAction(resumed, command)
      expect(completed.ok, completed.ok ? undefined : completed.reason).toBe(true)
      expect(completed.state.combatants.caster.classResources['dnd5e-spell-slot-1'].current).toBe(1)
      expect(completed.state.combatants.caster.classState.slowSpellGate).toBeUndefined()
      expect(resolveDnd5eHeadlessAction(completed.state, command).ok).toBe(false)
    })
  it('10 casts immediately; invalid dice and duplicate gate submissions do not spend resources', () => {
    const { state, check } = fixture('magic-missile')
    for (const value of [0, 21, 1.5]) expect(resolveDnd5eHeadlessAction(state, check(value)).ok).toBe(false)
    const checked = resolveDnd5eHeadlessAction(state, check(10))
    expect(checked.ok).toBe(true)
    expect(checked.state.combatants.caster.turn.actionAvailable).toBe(true)
    expect(resolveDnd5eHeadlessAction(checked.state, check(10)).ok).toBe(false)
    const cast = resolveDnd5eHeadlessAction(checked.state, core)
    expect(cast.ok, cast.ok ? undefined : cast.reason).toBe(true)
    expect(cast.state.combatants.target.currentHp).toBe(21)
  })
  it('a deferred spell still completes after Slow itself ends', () => {
    const { state, check } = fixture('magic-missile')
    const deferred = resolveDnd5eHeadlessAction(state, check(20))
    const resumed = structuredClone(deferred.state)
    resumed.round += 1
    resumed.combatants.caster.turn.actionAvailable = true
    resumed.combatants.caster.classState.activeEffects = []
    const cast = resolveDnd5eHeadlessAction(resumed, core)
    expect(cast.ok, cast.ok ? undefined : cast.reason).toBe(true)
  })
  it('bonus-action and long casting do not require the action-spell delay die', () => {
    for (const castingTime of ['bonus-action', 'long'] as const) {
      const { state } = fixture('custom-spell')
      const cast = resolveDnd5eHeadlessAction(state, { ...adjudicated, castingTime })
      expect(cast.ok, cast.ok ? undefined : cast.reason).toBe(true)
    }
  })
})

it.each(['core', 'adjudicated', 'activity'] as const)('persists one casting save through the shared Slow gate: %s', route => {
  for (const d20 of [1, 20]) {
    const spellId = route === 'core' ? 'magic-missile' : route === 'adjudicated' ? 'custom-spell' : 'command'
    const { state, check } = fixture(spellId, route === 'activity' ? 'cleric' : 'wizard')
    const pain = createDnd5eMechanicalEffect({ definitionId: 'pain', label: 'Pain', targetId: 'caster',
      source: { kind: 'spell' }, spellcastingSave: { ability: 'con', dc: 18 } })
    state.combatants.caster.classState.activeEffects!.push(pain)
    const checked = resolveDnd5eHeadlessAction(state, { ...check(20), spellcastingSavingThrows: [{ effectId: pain.id, d20 }] })
    expect(checked.ok, checked.ok ? '' : checked.reason).toBe(true)
    if (!checked.ok) continue
    expect(checked.events.filter(e => e.type === 'saving-throw-resolved')).toHaveLength(1)
    expect(checked.state.combatants.caster.classState.slowSpellGate?.delayed).toBe(d20 === 20)
    const resumed = JSON.parse(JSON.stringify(checked.state)) as typeof state
    if (d20 === 20) {
      resumed.round += 1
      resumed.combatants.caster.turn.actionAvailable = true
      resumed.combatants.caster.turn.bonusActionAvailable = true
    }
    const command = route === 'core' ? core : route === 'adjudicated' ? adjudicated : activity()
    const result = resolveDnd5eHeadlessAction(resumed, command)
    expect(result.ok, result.ok ? '' : result.reason).toBe(true)
    if (!result.ok) continue
    expect(result.events.filter(e => e.type === 'saving-throw-resolved' && e.targetId === 'caster')).toHaveLength(0)
    expect(result.events.some(e => e.type === 'spellcasting-prevented')).toBe(d20 === 1)
    expect(result.state.combatants.caster.classResources['dnd5e-spell-slot-1'].current).toBe(1)
    expect(result.state.combatants.caster.classState.slowSpellGate).toBeUndefined()
    if (d20 === 1) expect(result.state.combatants.target).toEqual(resumed.combatants.target)
  }
})
