import { expect, it } from 'vitest'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from './headlessCombatEngine'

function prepared() {
  const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative,
    controller: id === 'actor' ? 'player' : 'dm', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 5, armorClass: 10, currentHp: 100, maxHp: 100, temporaryHp: 0, speed: 30,
    concentrating: false, position: { x: 0, y: 0 } })
  const state = startDnd5eHeadlessCombat('hurl-bonus', [make('actor', 20), make('target', 10)])
  Object.assign(state.combatants.actor, { classId: 'warlock', subclassId: 'fiend', level: 14,
    classResources: { 'dnd5e-hurl-through-hell': { current: 1, max: 1 } } })
  const result = resolveDnd5eHeadlessAction(state, { type: 'warlock-hurl-through-hell-ready', actorId: 'actor', active: true })
  expect(result.ok).toBe(true)
  return result.state
}
const attack = (rolls: number[]) => ({ type: 'attack' as const, actorId: 'actor', targetId: 'target', d20: 15,
  attackModifier: 5, damage: { count: 1, sides: 4, bonus: 0, rolls: [1], type: 'slashing' as const },
  hurlThroughHellDamageRolls: rolls })

it.each(['own', 'foreign', 'suspended', 'removed', 'resistant', 'fiend', 'legacy', 'negative'] as const)(
  'delayed Hurl damage uses current marks after reload and never repeats: %s', mode => {
    const hit = resolveDnd5eHeadlessAction(prepared(), attack(Array(10).fill(1)))
    expect(hit.ok, JSON.stringify(hit)).toBe(true)
    expect(hit.state.combatants.target.currentHp).toBe(99)
    const state = JSON.parse(JSON.stringify(hit.state)) as typeof hit.state
    expect(state.combatants.target.classState.hurlThroughHellPendingRolls).toEqual(Array(10).fill(1))
    const target = state.combatants.target
    if (mode !== 'removed') target.classState.activeEffects!.push(createDnd5eMechanicalEffect({
      definitionId: 'mark', label: 'Mark', targetId: 'target', source: { kind: 'feature', actorId: mode === 'foreign' ? 'other' : 'actor' },
      modifiers: { damageRollsBySourceBonus: mode === 'negative' ? -20 : 3 },
      ...(mode === 'suspended' ? { suspendedBy: ['antimagic'] } : {}),
    }))
    if (mode === 'suspended') target.classState.activeEffects!.find(effect => effect.definitionId === 'mark')!.suspendedBy = ['antimagic']
    if (mode === 'resistant') target.damageResistances = ['psychic']
    if (mode === 'fiend') target.creatureType = 'fiend'
    if (mode === 'legacy') delete target.classState.hurlThroughHellPendingRolls
    let current = state
    for (const actorId of ['actor', 'target']) {
      const next = resolveDnd5eHeadlessAction(current, { type: 'end-turn', actorId })
      expect(next.ok, JSON.stringify(next)).toBe(true)
      expect(next.state.combatants.target.currentHp).toBe(99)
      current = next.state
    }
    const returned = resolveDnd5eHeadlessAction(current, { type: 'end-turn', actorId: 'actor' })
    expect(returned.ok, JSON.stringify(returned)).toBe(true)
    const expected = 99 - ({ own: 13, foreign: 10, suspended: 10, removed: 10, resistant: 6, fiend: 0, legacy: 10, negative: 0 })[mode]
    expect(returned.state.combatants.target.currentHp).toBe(expected)
    expect(returned.state.combatants.target.classState.hurlThroughHellPendingRolls).toBeUndefined()
    expect(returned.state.combatants.target.conditions).not.toContain('banished')
    expect(returned.events.filter(event => event.type === 'damage-roll-bonus-applied')).toHaveLength(['own', 'resistant', 'negative'].includes(mode) ? 1 : 0)
    current = returned.state
    for (const actorId of ['target', 'actor']) {
      const next = resolveDnd5eHeadlessAction(current, { type: 'end-turn', actorId })
      expect(next.ok).toBe(true)
      expect(next.state.combatants.target.currentHp).toBe(expected)
      current = next.state
    }
  })

it('rejects invalid initial dice without consuming the readied use or dealing weapon damage', () => {
  const state = prepared()
  const before = structuredClone(state)
  const result = resolveDnd5eHeadlessAction(state, attack(Array(10).fill(11)))
  expect(result.ok).toBe(false)
  expect(result.state).toEqual(before)
  expect(state).toEqual(before)
})

it.each([[], Array(10).fill(11), Array(10).fill(2), 4])('rejects corrupted delayed dice transactionally: %j', pendingRolls => {
  const hit = resolveDnd5eHeadlessAction(prepared(), attack(Array(10).fill(1)))
  let state = hit.state
  for (const actorId of ['actor', 'target']) state = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId }).state
  state.combatants.target.classState.hurlThroughHellPendingRolls = pendingRolls as readonly number[]
  const before = structuredClone(state)
  const result = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: 'actor' })
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.reason).toBe('invalid-dice')
  expect(result.state).toEqual(before)
  expect(state).toEqual(before)
})
