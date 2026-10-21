import { expect, it } from 'vitest'
import { createDnd5eMechanicalEffect, normalizeDnd5eActiveEffects, validateDnd5eActiveEffectsStrict } from './activeEffects'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from './headlessCombatEngine'

const rule = { damageTypes: ['bludgeoning', 'piercing', 'slashing'] as const, sourceMagical: false, attackOnly: true }
const effect = () => createDnd5eMechanicalEffect({ definitionId: 'test:attack-resistance', label: 'Attack resistance',
  source: { kind: 'spell', actorId: 'defender', rulesId: 'test:spell', magical: true }, targetId: 'defender',
  modifiers: { conditionalDamageResistances: [rule] } })

it('retains the attack-only predicate across strict validation and JSON reload', () => {
  const saved = effect()
  expect(validateDnd5eActiveEffectsStrict([saved]).ok).toBe(true)
  expect(normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify([saved])))[0].modifiers?.conditionalDamageResistances).toEqual([rule])
  for (const attackOnly of ['true', 1, {}]) {
    const invalid = { ...saved, modifiers: { conditionalDamageResistances: [{ ...rule, attackOnly }] } }
    expect(validateDnd5eActiveEffectsStrict([invalid]).ok).toBe(false)
    expect(normalizeDnd5eActiveEffects([invalid])[0]?.modifiers?.conditionalDamageResistances).toBeUndefined()
  }
})

it.each([false, true])('uses trusted native weapon provenance (magical=%s)', magical => {
  const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, controller: 'player', initiative,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
    armorClass: 10, currentHp: 100, maxHp: 100, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
  const attacker = make('attacker', 20), defender = make('defender', 10)
  attacker.weaponDamageSources = { sword: { magical } }
  defender.classState.activeEffects = [effect()]
  const state = startDnd5eHeadlessCombat('native-resistance', [attacker, defender])
  const result = resolveDnd5eHeadlessAction(state, { type: 'attack', actorId: attacker.id, targetId: defender.id,
    attackModifier: 20, d20: 10, damage: { count: 1, sides: 10, bonus: 0, rolls: [10], type: 'slashing' },
    classDamageContext: { weaponId: 'sword', mode: 'melee', finesse: false, strengthBased: true,
      weaponDamageSides: 10, damageType: 'slashing', adjacentEnemyOfTarget: false }, classDamageRolls: [] })
  expect(result.ok, JSON.stringify(result)).toBe(true)
  expect(result.state.combatants.defender.currentHp).toBe(magical ? 90 : 95)
})
