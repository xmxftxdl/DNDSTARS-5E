import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
} from './headlessCombatEngine'
import {
  resolveDnd5ePluginFeatureDamageReduction,
  type Dnd5ePluginFeaturePassiveEffectSnapshot,
} from './pluginFeaturePassiveEffects'

const abilities = { str: 14, dex: 14, con: 14, int: 10, wis: 12, cha: 8 } as const

function damageReductionSnapshot(
  patch: Partial<Dnd5ePluginFeaturePassiveEffectSnapshot['effect']> = {},
): Dnd5ePluginFeaturePassiveEffectSnapshot {
  return {
    featureId: 'plugin:test.feat-stone-skin',
    featureName: 'Stone Guard',
    effectId: 'damage-reduction',
    effect: {
      schemaVersion: 1,
      id: 'damage-reduction',
      kind: 'damage-reduction',
      trigger: 'before-damage',
      amount: 3,
      ...patch,
    },
  }
}

describe('plugin feature passive effects', () => {
  it('checks damage type, incoming damage, HP threshold, and once-per-turn usage', () => {
    const combatant = {
      currentHp: 8,
      maxHp: 20,
      pluginFeaturePassiveEffects: [damageReductionSnapshot({
        damageTypes: ['slashing'],
        minimumIncomingDamage: 5,
        maximumCurrentHitPointPercent: 50,
        oncePerTurn: true,
      })],
      classState: {},
    }

    expect(resolveDnd5ePluginFeatureDamageReduction({
      combatant,
      amount: 8,
      damageTypes: ['fire'],
      turnKey: 'turn-1',
    })).toEqual({ amount: 8, applications: [] })
    expect(resolveDnd5ePluginFeatureDamageReduction({
      combatant,
      amount: 4,
      damageTypes: ['slashing'],
      turnKey: 'turn-1',
    })).toEqual({ amount: 4, applications: [] })

    const first = resolveDnd5ePluginFeatureDamageReduction({
      combatant,
      amount: 8,
      damageTypes: ['slashing'],
      turnKey: 'turn-1',
    })
    expect(first.amount).toBe(5)
    expect(first.applications).toEqual([expect.objectContaining({
      featureId: 'plugin:test.feat-stone-skin',
      kind: 'damage-reduction',
      amount: 3,
    })])
    expect(resolveDnd5ePluginFeatureDamageReduction({
      combatant,
      amount: 8,
      damageTypes: ['slashing'],
      turnKey: 'turn-1',
    }).amount).toBe(8)
    expect(resolveDnd5ePluginFeatureDamageReduction({
      combatant,
      amount: 8,
      damageTypes: ['slashing'],
      turnKey: 'turn-2',
    }).amount).toBe(5)
  })

  it('checks Host-derived armor, delivery, and magical-source predicates', () => {
    const effect = damageReductionSnapshot({
      damageTypes: ['bludgeoning', 'piercing', 'slashing'],
      deliveries: ['weapon-attack'],
      magical: false,
      requiresHeavyArmor: true,
    })
    const base = {
      currentHp: 20,
      maxHp: 20,
      wearingHeavyArmor: true,
      pluginFeaturePassiveEffects: [effect],
      classState: {},
    }
    const resolve = (patch: Partial<typeof base>, damageSource?: { delivery: 'weapon-attack' | 'spell' | 'other'; magical: boolean }) =>
      resolveDnd5ePluginFeatureDamageReduction({
        combatant: { ...base, ...patch }, amount: 8, damageTypes: ['slashing'], damageSource, turnKey: 'turn-1',
      }).amount

    expect(resolve({}, { delivery: 'weapon-attack', magical: false })).toBe(5)
    expect(resolve({ wearingHeavyArmor: false }, { delivery: 'weapon-attack', magical: false })).toBe(8)
    expect(resolve({}, { delivery: 'weapon-attack', magical: true })).toBe(8)
    expect(resolve({}, { delivery: 'spell', magical: false })).toBe(8)
    expect(resolve({}, undefined)).toBe(8)
  })

  it('does not reduce an unmatched component in a mixed weapon hit', () => {
    const result = resolveDnd5ePluginFeatureDamageReduction({
      combatant: {
        currentHp: 30,
        maxHp: 30,
        wearingHeavyArmor: true,
        classState: {},
        pluginFeaturePassiveEffects: [damageReductionSnapshot({
          damageTypes: ['bludgeoning', 'piercing', 'slashing'],
          deliveries: ['weapon-attack'],
          magical: false,
          requiresHeavyArmor: true,
        })],
      },
      amount: 11,
      damageTypes: ['slashing', 'fire'],
      damageAmountsByType: { slashing: 1, fire: 10 },
      damageSource: { delivery: 'weapon-attack', magical: false },
      turnKey: 'turn-1',
    })

    expect(result.amount).toBe(10)
    expect(result.applications).toContainEqual(expect.objectContaining({ amount: 1 }))
  })

  it('runs inside the authoritative damage pipeline before HP is written', () => {
    const attacker = createDnd5eCombatant({
      id: 'attacker', name: 'attacker', controller: 'player', initiative: 20,
      abilities, proficiencyBonus: 2, armorClass: 10, currentHp: 20, maxHp: 20,
      temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false,
    })
    const target = createDnd5eCombatant({
      id: 'target', name: 'target', controller: 'dm', initiative: 10,
      abilities, proficiencyBonus: 2, armorClass: 10, currentHp: 20, maxHp: 20,
      temporaryHp: 0, speed: 30, position: { x: 5, y: 0 }, concentrating: false,
      pluginFeaturePassiveEffects: [damageReductionSnapshot({ damageTypes: ['slashing'] })],
    })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('plugin-passive-reduction', [attacker, target]),
      {
        type: 'attack', actorId: attacker.id, targetId: target.id,
        attackModifier: 5, d20: 15,
        damage: { count: 1, sides: 8, bonus: 0, rolls: [8], type: 'slashing' },
      },
    )

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants[target.id].currentHp).toBe(15)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'plugin-feature-passive-effect-applied',
      actorId: target.id,
      featureName: 'Stone Guard',
      effectKind: 'damage-reduction',
      amount: 3,
    }))
  })
})
