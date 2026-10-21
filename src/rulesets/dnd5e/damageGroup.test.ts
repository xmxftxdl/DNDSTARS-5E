import { describe, expect, it } from 'vitest'
import { resolveDnd5eDamageDefenses, resolveDnd5eDamageGroup, type Dnd5eDamageDefenses, type Dnd5eDamageDefenseResolutionInput } from './damageDefenses'

const packet = (damage: number, damageType: 'piercing' | 'force', defenses: Dnd5eDamageDefenses = {}): Dnd5eDamageDefenseResolutionInput => ({
  damage, source: { damageType, delivery: 'other', magical: true }, defenses,
})

describe('simultaneous typed damage after a successful save', () => {
  it('retains both halves until the combined HP amount is known', () => {
    const input = { multiplier: 0.5 as const, components: [packet(9, 'piercing'), packet(3, 'force')] }
    const before = structuredClone(input)
    expect(resolveDnd5eDamageGroup(input)).toMatchObject({ finalDamage: 6, components: [{ baseDamage: 4.5, finalDamage: 4.5 }, { baseDamage: 1.5, finalDamage: 1.5 }] })
    expect(input).toEqual(before)
    expect(resolveDnd5eDamageDefenses({ ...packet(9, 'piercing'), damage: 4.5 }).finalDamage).toBe(4)
  })

  it.each([
    [{}, 6],
    [{ immunities: ['piercing'] }, 1],
    [{ immunities: ['force'] }, 4],
    [{ immunities: ['piercing', 'force'] }, 0],
    [{ resistances: ['piercing'] }, 3],
    [{ resistances: ['force'] }, 4],
    [{ resistances: ['piercing', 'force'] }, 2],
    [{ vulnerabilities: ['piercing'] }, 10],
    [{ vulnerabilities: ['force'] }, 7],
    [{ vulnerabilities: ['piercing', 'force'] }, 12],
    [{ resistances: ['piercing'], vulnerabilities: ['piercing'] }, 5],
    [{ immunities: ['piercing'], vulnerabilities: ['piercing'] }, 1],
  ] as [Dnd5eDamageDefenses, number][])('keeps defenses type-specific (%j)', (defenses, expected) => {
    const components = [packet(9, 'piercing', defenses), packet(3, 'force', defenses)]
    expect(resolveDnd5eDamageGroup({ components, multiplier: 0.5 }).finalDamage).toBe(expected)
    expect(resolveDnd5eDamageGroup({ components: [...components].reverse(), multiplier: 0.5 }).finalDamage).toBe(expected)
  })

  it('respects conditional sources without stacking duplicate resistance', () => {
    const defenses: Dnd5eDamageDefenses = { resistances: ['piercing'], damageDefenseRules: [
      { outcome: 'resistant', damageTypes: ['piercing'], magical: true, reason: 'duplicate' },
      { outcome: 'immune', damageTypes: ['force'], magical: false },
    ] }
    const result = resolveDnd5eDamageGroup({ components: [packet(9, 'piercing', defenses), packet(3, 'force', defenses)], multiplier: 0.5 })
    expect(result.finalDamage).toBe(3)
    expect(result.components[0].applied[0].reasons).toEqual(['static:resistant:piercing', 'duplicate'])
    expect(result.components[1].applied).toEqual([])
  })

  it('matches the FVTT arithmetic ordering across odd/even values and all defense combinations', () => {
    let cases = 0
    for (let physical = 0; physical <= 12; physical++) for (let force = 0; force <= 12; force++) {
      for (const multiplier of [0.5, 1] as const) for (let physicalFlags = 0; physicalFlags < 8; physicalFlags++) for (let forceFlags = 0; forceFlags < 8; forceFlags++) {
        const defenses = (type: 'piercing' | 'force', flags: number): Dnd5eDamageDefenses => ({
          immunities: flags & 1 ? [type] : [], resistances: flags & 2 ? [type] : [], vulnerabilities: flags & 4 ? [type] : [],
        })
        // Independent reference arithmetic: immune -> zero; otherwise multiplier,
        // resistance truncation, vulnerability, then combined total truncation.
        const reference = (value: number, flags: number) => {
          if (flags & 1) return 0
          let amount = value * multiplier
          if (flags & 2) amount = Math.trunc(amount / 2)
          if (flags & 4) amount *= 2
          return amount
        }
        const result = resolveDnd5eDamageGroup({ multiplier, components: [packet(physical, 'piercing', defenses('piercing', physicalFlags)), packet(force, 'force', defenses('force', forceFlags))] })
        expect(result.finalDamage).toBe(Math.trunc(reference(physical, physicalFlags) + reference(force, forceFlags)))
        cases++
      }
    }
    expect(cases).toBe(21632)
  })

  it('rejects invalid packets and multipliers without silently normalizing them', () => {
    for (const damage of [-1, 0.5, NaN, Infinity, 1_000_001, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => resolveDnd5eDamageGroup({ components: [packet(damage, 'force')], multiplier: 0.5 })).toThrow(RangeError)
    }
    expect(() => resolveDnd5eDamageGroup({ components: [packet(1, 'force')], multiplier: 2 as 1 })).toThrow(RangeError)
    expect(() => resolveDnd5eDamageGroup({ components: [packet(Number.MAX_SAFE_INTEGER, 'force'), packet(1, 'piercing')], multiplier: 1 })).toThrow(RangeError)
    expect(() => resolveDnd5eDamageGroup({ components: Array.from({length:1001}, () => packet(1, 'force')), multiplier: 1 })).toThrow(RangeError)
    expect(resolveDnd5eDamageGroup({ components: [packet(1_000_000, 'force')], multiplier: 1 }).finalDamage).toBe(1_000_000)
    expect(resolveDnd5eDamageGroup({ components: [], multiplier: 0.5 }).finalDamage).toBe(0)
  })
})
