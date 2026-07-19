import { describe, expect, it } from 'vitest'
import { parseDnd5eSpellMechanics } from './spellMechanics'

describe('D&D 5e declarative spell mechanics template', () => {
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
