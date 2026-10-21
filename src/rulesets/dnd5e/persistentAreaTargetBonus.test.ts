import { expect, it } from 'vitest'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5ePersistentAreaTrigger } from './headlessCombatEngine'

function fixture() {
  const state = startDnd5eHeadlessCombat('area-bonus', ['caster', 'target'].map(id => createDnd5eCombatant({ id, name: id,
    controller: 'player', initiative: 10, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 2, armorClass: 10, currentHp: 40, maxHp: 50, temporaryHp: 0,
    speed: 30, position: { x: 0, y: 0 }, concentrating: false })))
  state.combatants.target.classState.activeEffects = [createDnd5eMechanicalEffect({ definitionId: 'mark', label: 'Mark',
    source: { kind: 'feature', actorId: 'caster' }, targetId: 'target', modifiers: { damageRollsBySourceBonus: 2 } })]
  return state
}

it.each(['ordinary', 'half-vulnerable', 'half-resistant', 'foreign', 'suspended', 'removed', 'fixed', 'negative', 'invalid'] as const)(
  'area damage adds a source-qualified roll bonus before saves and defenses: %s', mode => {
  const state = fixture()
  const target = state.combatants.target
  if (mode === 'half-vulnerable') target.damageVulnerabilities = ['fire']
  if (mode === 'half-resistant') target.damageResistances = ['fire']
  if (mode === 'foreign') target.classState.activeEffects![0].source.actorId = 'other'
  if (mode === 'suspended') target.classState.activeEffects![0].suspendedBy = ['antimagic']
  if (mode === 'removed') target.classState.activeEffects = []
  const half = mode.startsWith('half-')
  const before = structuredClone(state)
  const result = resolveDnd5ePersistentAreaTrigger(state, { areaId: 'area', sourceId: 'caster', targetId: 'target',
    trigger: { id: 'pulse', label: 'Pulse', timing: 'turn-start',
      damage: { count: mode === 'fixed' ? 0 : 1, sides: 8, modifier: mode === 'fixed' ? 7 : mode === 'negative' ? -10 : 0, type: 'fire' },
      ...(half ? { savingThrow: { ability: 'dex' as const, dc: 10, onSuccess: 'half' as const } } : {}) },
    damageRolls: mode === 'fixed' ? [] : [mode === 'invalid' ? 9 : 7], ...(half ? { d20: 20 } : {}) })
  expect(result.ok, JSON.stringify(result)).toBe(mode !== 'invalid')
  const amount = { ordinary: 9, 'half-vulnerable': 8, 'half-resistant': 2, foreign: 7, suspended: 7, removed: 7, fixed: 7, negative: 0, invalid: 0 }[mode]
  expect(result.state.combatants.target.currentHp).toBe(40 - amount)
  expect(result.events.filter(event => event.type === 'damage-roll-bonus-applied')).toHaveLength(
    ['ordinary', 'half-vulnerable', 'half-resistant', 'negative'].includes(mode) ? 1 : 0)
  if (!result.ok) expect(result.state).toEqual(before)
  expect(state).toEqual(before)
})

it.each(['on-create', 'on-enter', 'turn-start', 'turn-end'] as const)('each eligible area timing resolves a fresh roll: %s', timing => {
  const state = fixture()
  const request = { areaId: 'area', sourceId: 'caster', targetId: 'target',
    trigger: { id: 'pulse', label: 'Pulse', timing, damage: { count: 1, sides: 8, type: 'fire' as const } }, damageRolls: [7] }
  const first = resolveDnd5ePersistentAreaTrigger(state, request)
  expect(first.ok, JSON.stringify(first)).toBe(true)
  const second = resolveDnd5ePersistentAreaTrigger(first.state, request)
  expect(second.ok, JSON.stringify(second)).toBe(true)
  expect(second.state.combatants.target.currentHp).toBe(22)
  expect(second.events).toContainEqual(expect.objectContaining({ type: 'persistent-area-triggered', damageResolution: expect.objectContaining({
    roll: { sides: 8, rolls: [7], modifier: 2, total: 9 }, finalDamage: 9,
  }) }))
})

it('does not add a damage bonus to area healing', () => {
  const result = resolveDnd5ePersistentAreaTrigger(fixture(), { areaId: 'area', sourceId: 'caster', targetId: 'target',
    trigger: { id: 'heal', label: 'Heal', timing: 'turn-start', healing: { amount: 0, dice: { count: 1, sides: 8 } } }, healingRolls: [3] })
  expect(result.ok, JSON.stringify(result)).toBe(true)
  expect(result.state.combatants.target.currentHp).toBe(43)
  expect(result.events.some(event => event.type === 'damage-roll-bonus-applied')).toBe(false)
})
