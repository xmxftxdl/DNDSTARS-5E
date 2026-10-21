import { expect, it } from 'vitest'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eEtherealReturnDamage } from './headlessCombatEngine'

function fixture() {
  const actor = createDnd5eCombatant({ id: 'returner', name: 'Returner', initiative: 10, controller: 'player',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
    armorClass: 10, currentHp: 30, maxHp: 30, temporaryHp: 3, speed: 30,
    position: { x: 125, y: 125 }, concentrating: false })
  return startDnd5eHeadlessCombat('return', [actor])
}

it.each([
  ['none', 23, 0], ['resistant', 28, 0], ['immune', 30, 3],
] as const)('settles ejection through force defenses and temporary HP: %s', (defense, hp, temporaryHp) => {
  const state = fixture()
  if (defense === 'resistant') state.combatants.returner.damageResistances = ['force']
  if (defense === 'immune') state.combatants.returner.damageImmunities = ['force']
  const before = structuredClone(state)
  const result = resolveDnd5eEtherealReturnDamage(state, 'returner', 5)
  expect(result.ok).toBe(true)
  expect(result.state.combatants.returner.currentHp).toBe(hp)
  expect(result.state.combatants.returner.temporaryHp).toBe(temporaryHp)
  expect(state).toEqual(before)
  if (defense !== 'immune') expect(result.events).toContainEqual(expect.objectContaining({
    type: 'damage-applied', targetId: 'returner', damageTypes: ['force'],
  }))
})

it.each([-1, NaN, Infinity, Number.MAX_VALUE])('rejects invalid displacement %s atomically', distance => {
  const state = fixture()
  expect(resolveDnd5eEtherealReturnDamage(state, 'returner', distance)).toEqual({
    ok: false, state, events: [], reason: 'invalid-target',
  })
})

it('does not produce damage or clone state for an unobstructed return', () => {
  const state = fixture()
  const result = resolveDnd5eEtherealReturnDamage(state, 'returner', 0)
  expect(result).toEqual({ ok: true, state, events: [] })
  expect(result.state).toBe(state)
})
