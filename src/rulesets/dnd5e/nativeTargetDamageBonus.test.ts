import { expect, it } from 'vitest'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat, type Dnd5eAction } from './headlessCombatEngine'
import { withDnd5eWeaponHitCheckpoints } from './weaponHitCheckpoint'

function fixture() {
  const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative,
    controller: id === 'actor' ? 'player' : 'dm', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 2, armorClass: 10, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30,
    concentrating: false, position: { x: 0, y: 0 } })
  const state = startDnd5eHeadlessCombat('native-bonus', [make('actor', 20), make('target', 10)])
  state.combatants.target.classState.activeEffects = [createDnd5eMechanicalEffect({ definitionId: 'mark', label: 'Mark',
    targetId: 'target', source: { kind: 'feature', actorId: 'actor' }, modifiers: { damageRollsBySourceBonus: 2 } })]
  const action: Extract<Dnd5eAction, { type: 'attack' }> = { type: 'attack', actorId: 'actor', targetId: 'target', d20: 18,
    attackModifier: 5, damage: { count: 1, sides: 6, rolls: [5], bonus: 0, type: 'slashing' },
    classDamageContext: { mode: 'melee', weaponId: 'sword', finesse: false, strengthBased: true,
      weaponDamageSides: 6, damageType: 'slashing', adjacentEnemyOfTarget: false } }
  return { state, action }
}

it.each([
  ['ordinary', 7], ['critical', 9], ['negative-base', 1], ['resistance', 3], ['immunity', 0], ['fixed', 5],
  ['miss', 0], ['foreign', 5], ['suspended', 5], ['removed', 5], ['invalid', 0],
] as const)('settles one target bonus before defenses, without critical multiplication (%s)', (mode, damage) => {
  const { state, action } = fixture()
  const target = state.combatants.target
  if (mode === 'critical') { action.d20 = 20; action.damage.rolls = [3, 4] }
  if (mode === 'negative-base') { action.damage.rolls = [1]; action.damage.bonus = -5 }
  if (mode === 'resistance') target.damageResistances = ['slashing']
  if (mode === 'immunity') target.damageImmunities = ['slashing']
  if (mode === 'fixed') action.damage = { count: 0, sides: 6, rolls: [], bonus: 5, type: 'slashing' }
  if (mode === 'miss') { action.d20 = 1; action.damage.rolls = [] }
  if (mode === 'foreign') target.classState.activeEffects![0].source.actorId = 'other'
  if (mode === 'suspended') target.classState.activeEffects![0].suspendedBy = ['antimagic']
  if (mode === 'removed') target.classState.activeEffects = []
  if (mode === 'invalid') action.damage.rolls = [9]
  const before = structuredClone(state)
  const result = resolveDnd5eHeadlessAction(state, action)
  expect(result.ok, JSON.stringify(result)).toBe(mode !== 'invalid')
  expect(result.state.combatants.target.currentHp).toBe(30 - damage)
  expect(result.events.filter(event => event.type === 'damage-roll-bonus-applied'))
    .toHaveLength(['ordinary', 'critical', 'negative-base', 'resistance', 'immunity'].includes(mode) ? 1 : 0)
  expect(state).toEqual(before)
})

it.each([false, true])('adds once across primary and typed on-hit dice (replaced primary=%s)', fixed => {
  const { state, action } = fixture()
  if (fixed) state.combatants.actor.classState.activeEffects = [createDnd5eMechanicalEffect({ definitionId: 'replace', label: 'Replace', targetId: 'actor', source: { kind: 'feature' }, modifiers: { weaponDamageReplacementAttackModes: ['melee'] } })]
  const result = withDnd5eWeaponHitCheckpoints(() => ({ resourceCosts: [],
    damageComponents: [{ amount: 3, type: 'fire', rolled: true }, { amount: 4, type: 'cold', rolled: true }] }),
  () => resolveDnd5eHeadlessAction(state, action))
  expect(result.ok, JSON.stringify(result)).toBe(true)
  expect(result.state.combatants.target.currentHp).toBe(fixed ? 21 : 16)
  expect(result.events.filter(event => event.type === 'damage-roll-bonus-applied')).toEqual([
    expect.objectContaining({ amount: 2, damageType: fixed ? 'fire' : 'slashing' }),
  ])
})

it('does not qualify a fixed on-hit value as a damage roll', () => {
  const { state, action } = fixture()
  state.combatants.actor.classState.activeEffects = [createDnd5eMechanicalEffect({ definitionId: 'replace', label: 'Replace', targetId: 'actor', source: { kind: 'feature' }, modifiers: { weaponDamageReplacementAttackModes: ['melee'] } })]
  const result = withDnd5eWeaponHitCheckpoints(() => ({ resourceCosts: [], resolvedBonusDamage: 5 }),
    () => resolveDnd5eHeadlessAction(state, action))
  expect(result.ok).toBe(true)
  expect(result.state.combatants.target.currentHp).toBe(25)
  expect(result.events.some(event => event.type === 'damage-roll-bonus-applied')).toBe(false)
})

it('adds before the reduced-weapon pool subtraction and its minimum-damage clamp', () => {
  const { state, action } = fixture()
  Object.assign(state.combatants.actor, { classId: 'wizard', level: 3,
    classSelections: { 'spell-prepared': ['enlarge-reduce'] }, classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } } })
  const reduced = resolveDnd5eHeadlessAction(state, { type: 'cast-spell', actorId: 'actor', targetId: 'actor',
    spellId: 'enlarge-reduce', slotLevel: 2, enlargeReduceChoice: 'reduce', effectRolls: [] })
  expect(reduced.ok, JSON.stringify(reduced)).toBe(true)
  reduced.state.combatants.actor.turn.actionAvailable = true
  action.damage.rolls = [1]
  action.classDamageRolls = [{ source: 'reduce', rolls: [4] }]
  const result = resolveDnd5eHeadlessAction(reduced.state, action)
  expect(result.ok, JSON.stringify(result)).toBe(true)
  expect(result.state.combatants.target.currentHp).toBe(29)
  expect(result.events.filter(event => event.type === 'damage-roll-bonus-applied')).toHaveLength(1)
})

it('uses the same bonus for the native opportunity-attack settlement', () => {
  const { state, action } = fixture()
  const result = resolveDnd5eHeadlessAction(state, { ...action, type: 'opportunity-attack' })
  expect(result.ok, JSON.stringify(result)).toBe(true)
  expect(result.state.combatants.target.currentHp).toBe(23)
  expect(result.events.filter(event => event.type === 'damage-roll-bonus-applied')).toHaveLength(1)
})
