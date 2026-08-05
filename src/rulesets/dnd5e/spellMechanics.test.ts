import { describe, expect, it } from 'vitest'
import {
  dnd5eSpellCantripScalingTotals,
  dnd5eSpellUpcastTotals,
  parseDnd5eSpellMechanics,
} from './spellMechanics'

describe('D&D 5e declarative spell mechanics template', () => {
  it('calculates every structured higher-slot increment from one shared profile', () => {
    expect(dnd5eSpellUpcastTotals({ upcast: {
      fromSlotLevel: 2,
      effects: [
        { kind: 'damage-dice', diceCountPerSlot: 1 },
        { kind: 'flat-damage', amountPerSlot: 2 },
        { kind: 'additional-targets', countPerSlot: 1 },
        { kind: 'additional-projectiles', countPerSlot: 2 },
        { kind: 'duration-rounds', roundsPerSlot: 3 },
      ],
    } }, 4)).toEqual({
      slotDelta: 2,
      damageDice: 2,
      flatDamage: 4,
      additionalTargets: 2,
      additionalProjectiles: 4,
      durationRounds: 6,
    })
  })

  it('normalizes damage, upcast and standard condition effects', () => {
    const problems: string[] = []
    const parsed = parseDnd5eSpellMechanics({
      kind: 'damage',
      resolution: 'saving-throw',
      savingThrow: { ability: 'dex', onSuccess: 'half' },
      damage: { dice: { count: 2, sides: 6, bonus: 0 }, type: 'fire' },
      conditions: [{
        condition: 'blinded', trigger: 'on-failed-save',
        duration: { kind: 'save-ends', timing: 'target-turn-end', maximumRounds: 10, saveAbility: 'con' },
      }],
      upcast: { fromSlotLevel: 2, effects: [{ kind: 'damage-dice', diceCountPerSlot: 1 }] },
    }, 'spell.mechanics', problems)
    expect(problems).toEqual([])
    expect(parsed).toMatchObject({
      kind: 'damage',
      damage: { dice: { count: 2, sides: 6 }, type: 'fire' },
      conditions: [{ condition: 'blinded', duration: { kind: 'save-ends', maximumRounds: 10 } }],
      upcast: { effects: [{ kind: 'damage-dice', diceCountPerSlot: 1 }] },
    })
  })

  it('uses an explicit character-level table for configurable cantrip damage', () => {
    const damage = {
      dice: { count: 1, sides: 6, bonus: 0 },
      type: 'thunder' as const,
      cantripScaling: {
        basis: 'character-level' as const,
        steps: [
          { level: 5, diceCount: 1 },
          { level: 11, diceCount: 2, flatDamage: 1 },
          { level: 17, diceCount: 1 },
        ],
      },
    }
    expect(dnd5eSpellCantripScalingTotals(damage, 4)).toEqual({ damageDice: 0, flatDamage: 0 })
    expect(dnd5eSpellCantripScalingTotals(damage, 11)).toEqual({ damageDice: 3, flatDamage: 1 })

    const problems: string[] = []
    const parsed = parseDnd5eSpellMechanics({
      kind: 'damage', resolution: 'saving-throw', savingThrow: { ability: 'con', onSuccess: 'none' }, damage,
    }, 'spell.mechanics', problems)
    expect(problems).toEqual([])
    expect(parsed?.damage?.cantripScaling).toEqual(damage.cantripScaling)
    expect(dnd5eSpellCantripScalingTotals({
      dice: { count: 2, sides: 4, bonus: 0 }, type: 'fire', cantripScaling: true,
    }, 11)).toEqual({ damageDice: 4, flatDamage: 0 })
  })

  it('rejects unknown damage and condition identifiers', () => {
    const problems: string[] = []
    parseDnd5eSpellMechanics({
      kind: 'damage', resolution: 'automatic',
      damage: { dice: { count: 1, sides: 6, bonus: 0 }, type: 'laser' },
      conditions: [{ condition: 'confused', trigger: 'always', duration: { kind: 'target-next-turn-start' } }],
    }, 'spell.mechanics', problems)
    expect(problems.join('；')).toMatch(/damage\.type/)
    expect(problems.join('；')).toMatch(/标准状态 ID/)
  })
})
