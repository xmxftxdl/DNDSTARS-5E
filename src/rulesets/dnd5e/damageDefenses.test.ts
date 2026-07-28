import { describe, expect, it } from 'vitest'
import type {
  Dnd5eConditionalDamageDefense,
  Dnd5eDamageSourceContext,
} from './damageDefenses'
import {
  isDnd5eConditionalDamageDefense,
  resolveDnd5eDamageDefenses,
} from './damageDefenses'

const ordinarySlashingWeapon: Dnd5eDamageSourceContext = {
  damageType: 'slashing',
  delivery: 'weapon-attack',
  magical: false,
}

function resolve(
  source: Dnd5eDamageSourceContext,
  damageDefenseRules: readonly Dnd5eConditionalDamageDefense[],
  damage = 11,
) {
  return resolveDnd5eDamageDefenses({ damage, source, defenses: { damageDefenseRules } })
}

describe('D&D 5e conditional damage defenses', () => {
  it('strictly validates persisted defense rules and rejects unknown predicates', () => {
    expect(isDnd5eConditionalDamageDefense({
      outcome: 'immune',
      damageTypes: ['bludgeoning', 'piercing', 'slashing'],
      delivery: 'weapon-attack',
      magical: false,
      weaponMaterialNot: 'silvered',
      sourceMoralAlignment: 'evil',
      reason: 'nonsilvered-immunity',
    })).toBe(true)
    expect(isDnd5eConditionalDamageDefense({
      outcome: 'immune',
      damageTypes: ['slashing'],
      futurePredicate: true,
    })).toBe(false)
    expect(isDnd5eConditionalDamageDefense({
      outcome: 'resistant',
      damageTypes: [],
    })).toBe(false)
    expect(isDnd5eConditionalDamageDefense({
      outcome: 'resistant',
      damageTypes: ['fire', 'fire'],
    })).toBe(false)
  })

  it('returns unchanged integer damage when no defense matches', () => {
    expect(resolveDnd5eDamageDefenses({
      damage: 11.9,
      source: ordinarySlashingWeapon,
    })).toEqual({
      baseDamage: 11,
      finalDamage: 11,
      multiplier: 1,
      applied: [],
    })
  })

  it.each([
    ['ordinary', undefined, false, 0],
    ['silvered', 'silvered' as const, false, 11],
    ['adamantine', 'adamantine' as const, false, 0],
    ['magical', undefined, true, 11],
  ])(
    'resolves nonmagical nonsilvered immunity for a %s weapon',
    (_label, weaponMaterial, magical, expectedDamage) => {
      const nonsilveredImmunity: Dnd5eConditionalDamageDefense = {
        outcome: 'immune',
        damageTypes: ['bludgeoning', 'piercing', 'slashing'],
        delivery: 'weapon-attack',
        magical: false,
        weaponMaterialNot: 'silvered',
        reason: 'lycanthrope-nonsilvered-immunity',
      }
      const result = resolve({
        ...ordinarySlashingWeapon,
        magical,
        weaponMaterial,
      }, [nonsilveredImmunity])

      expect(result.finalDamage).toBe(expectedDamage)
      expect(result.multiplier).toBe(expectedDamage === 0 ? 0 : 1)
    },
  )

  it.each([
    ['ordinary', undefined, false, 5],
    ['silvered', 'silvered' as const, false, 5],
    ['adamantine', 'adamantine' as const, false, 11],
    ['magical', undefined, true, 11],
  ])(
    'resolves nonmagical nonadamantine resistance for a %s weapon',
    (_label, weaponMaterial, magical, expectedDamage) => {
      const nonadamantineResistance: Dnd5eConditionalDamageDefense = {
        outcome: 'resistant',
        damageTypes: ['bludgeoning', 'piercing', 'slashing'],
        delivery: 'weapon-attack',
        magical: false,
        weaponMaterialNot: 'adamantine',
      }
      expect(resolve({
        ...ordinarySlashingWeapon,
        magical,
        weaponMaterial,
      }, [nonadamantineResistance]).finalDamage).toBe(expectedDamage)
    },
  )

  it('does not treat a material-less spell as a non-silvered weapon', () => {
    const nonsilveredResistance: Dnd5eConditionalDamageDefense = {
      outcome: 'resistant',
      damageTypes: ['slashing'],
      magical: true,
      weaponMaterialNot: 'silvered',
    }
    expect(resolve({
      damageType: 'slashing',
      delivery: 'spell',
      magical: true,
      spellLevel: 2,
    }, [nonsilveredResistance]).finalDamage).toBe(11)
  })

  it('combines static elemental defenses with conditional physical defenses', () => {
    const physicalResistance: Dnd5eConditionalDamageDefense = {
      outcome: 'resistant',
      damageTypes: ['bludgeoning', 'piercing', 'slashing'],
      magical: false,
    }
    const fire = resolveDnd5eDamageDefenses({
      damage: 13,
      source: { damageType: 'fire', delivery: 'spell', magical: true, spellLevel: 3 },
      defenses: {
        immunities: ['poison'],
        resistances: ['fire'],
        vulnerabilities: ['cold'],
        damageDefenseRules: [physicalResistance],
      },
    })
    expect(fire).toMatchObject({
      finalDamage: 6,
      multiplier: 0.5,
      applied: [{
        kind: 'resistant',
        reasons: ['static:resistant:fire'],
      }],
    })
  })

  it.each([
    ['good magical piercing weapon', 'piercing' as const, 'weapon-attack' as const, true, 'good' as const, 22],
    ['neutral wielder', 'piercing' as const, 'weapon-attack' as const, true, 'neutral' as const, 11],
    ['nonmagical weapon', 'piercing' as const, 'weapon-attack' as const, false, 'good' as const, 11],
    ['piercing spell', 'piercing' as const, 'spell' as const, true, 'good' as const, 11],
    ['slashing weapon', 'slashing' as const, 'weapon-attack' as const, true, 'good' as const, 11],
  ])(
    'resolves rakshasa piercing vulnerability for a %s',
    (_label, damageType, delivery, magical, sourceMoralAlignment, expectedDamage) => {
      const rakshasaVulnerability: Dnd5eConditionalDamageDefense = {
        outcome: 'vulnerable',
        damageTypes: ['piercing'],
        delivery: 'weapon-attack',
        magical: true,
        sourceMoralAlignment: 'good',
        reason: 'rakshasa-good-magic-piercing',
      }
      expect(resolve({
        damageType,
        delivery,
        magical,
        sourceMoralAlignment,
      }, [rakshasaVulnerability]).finalDamage).toBe(expectedDamage)
    },
  )

  it('short-circuits on immunity before matching resistance or vulnerability', () => {
    const result = resolveDnd5eDamageDefenses({
      damage: 9,
      source: { damageType: 'fire', delivery: 'spell', magical: true },
      defenses: {
        immunities: ['fire'],
        resistances: ['fire'],
        vulnerabilities: ['fire'],
      },
    })
    expect(result).toMatchObject({
      finalDamage: 0,
      multiplier: 0,
      applied: [{
        kind: 'immune',
        damageBefore: 9,
        damageAfter: 0,
        reasons: ['static:immune:fire'],
      }],
    })
    expect(result.applied).toHaveLength(1)
  })

  it('rounds resistance down before applying vulnerability', () => {
    const result = resolveDnd5eDamageDefenses({
      damage: 7,
      source: ordinarySlashingWeapon,
      defenses: {
        resistances: ['slashing'],
        vulnerabilities: ['slashing'],
      },
    })
    expect(result).toEqual({
      baseDamage: 7,
      finalDamage: 6,
      multiplier: 1,
      applied: [
        {
          kind: 'resistant',
          multiplier: 0.5,
          damageBefore: 7,
          damageAfter: 3,
          reasons: ['static:resistant:slashing'],
        },
        {
          kind: 'vulnerable',
          multiplier: 2,
          damageBefore: 3,
          damageAfter: 6,
          reasons: ['static:vulnerable:slashing'],
        },
      ],
    })
  })

  it('does not stack duplicate defenses of the same kind', () => {
    const result = resolveDnd5eDamageDefenses({
      damage: 9,
      source: ordinarySlashingWeapon,
      defenses: {
        resistances: ['slashing'],
        damageDefenseRules: [
          { outcome: 'resistant', damageTypes: ['slashing'], reason: 'second-resistance' },
        ],
      },
    })
    expect(result.finalDamage).toBe(4)
    expect(result.applied).toHaveLength(1)
    expect(result.applied[0]?.reasons).toEqual([
      'static:resistant:slashing',
      'second-resistance',
    ])
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])(
    'rejects invalid damage %s',
    (damage) => {
      expect(() => resolveDnd5eDamageDefenses({
        damage,
        source: ordinarySlashingWeapon,
      })).toThrow(RangeError)
    },
  )
})
