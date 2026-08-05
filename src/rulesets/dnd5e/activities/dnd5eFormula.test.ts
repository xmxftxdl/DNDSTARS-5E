import { describe, expect, it } from 'vitest'
import {
  collectDnd5eFormulaRollDeclarations,
  evaluateDnd5eFormulaV1,
  validateDnd5eFormulaV1,
  type Dnd5eFormulaV1,
} from './dnd5eFormula'

const abilities = { str: 12, dex: 14, con: 10, int: 8, wis: 16, cha: 18 } as const

describe('D&D 5e structured formulas', () => {
  it('evaluates dice, closed references and slot scaling without eval', () => {
    const formula: Dnd5eFormulaV1 = {
      kind: 'add',
      values: [
        { kind: 'dice', rollId: 'damage', count: 2, sides: 6 },
        { kind: 'reference', reference: { kind: 'actor-ability-modifier', ability: 'cha' } },
        {
          kind: 'multiply',
          values: [
            { kind: 'reference', reference: { kind: 'slot-delta', baseLevel: 1 } },
            { kind: 'constant', value: 2 },
          ],
        },
      ],
    }
    expect(validateDnd5eFormulaV1(formula)).toEqual([])
    expect(evaluateDnd5eFormulaV1(formula, {
      actor: { level: 7, proficiencyBonus: 3, abilities },
      castLevel: 3,
      rolls: { damage: { values: [3, 5] } },
    })).toBe(16)
  })

  it('declares the maximum Host dice recipe and rejects invalid results', () => {
    const formula: Dnd5eFormulaV1 = { kind: 'dice', rollId: 'strike', count: 1, sides: 8 }
    expect(collectDnd5eFormulaRollDeclarations([formula], 2)).toEqual([{ id: 'strike', count: 2, sides: 8 }])
    expect(() => evaluateDnd5eFormulaV1(formula, {
      actor: { level: 1, proficiencyBonus: 2, abilities },
      rolls: { strike: { values: [9] } },
    })).toThrow('invalid dice result: strike')
  })

  it('rejects arbitrary paths and executable-looking nodes', () => {
    expect(validateDnd5eFormulaV1({
      kind: 'reference',
      reference: { kind: 'path', value: 'actor.actions' },
    })).toEqual(['formula.reference.kind is invalid'])
    expect(validateDnd5eFormulaV1({ kind: 'eval', value: 'actor.hp = 0' }))
      .toEqual(['formula.kind is invalid'])
  })
})
