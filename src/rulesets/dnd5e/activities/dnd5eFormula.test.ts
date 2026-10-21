import { dnd5eMonsterHitDiceMaximum } from './dnd5eMonsterHitDice'
import { describe, expect, it } from 'vitest'
import {
  collectDnd5eFormulaRollDeclarations,
  evaluateDnd5eFormulaV1,
  validateDnd5eFormulaV1,
  type Dnd5eFormulaV1,
} from './dnd5eFormula'

const abilities = { str: 12, dex: 14, con: 10, int: 8, wis: 16, cha: 18 } as const

describe('D&D 5e structured formulas', () => {
  it('reads real mixed Hit Dice pools and distinguishes missing data from an empty pool', () => {
    const actor = { level: 7, proficiencyBonus: 3, abilities, hitPointDice: [
      { sides: 6, current: 1, max: 3 }, { sides: 10, current: 3, max: 4 },
    ] }
    for (const kind of ['actor-hit-dice', 'target-hit-dice'] as const) {
      const formula: Dnd5eFormulaV1 = { kind: 'reference', reference: { kind, field: 'current' } }
      expect(validateDnd5eFormulaV1(formula)).toEqual([])
      expect(evaluateDnd5eFormulaV1(formula, { actor, target: actor, rolls: {} })).toBe(4)
      expect(evaluateDnd5eFormulaV1({ kind: 'reference', reference: { kind, field: 'maximum' } }, { actor, target: actor, rolls: {} })).toBe(7)
      expect(evaluateDnd5eFormulaV1({ kind: 'reference', reference: { kind, field: 'current', sides: 8 } }, { actor, target: actor, rolls: {} })).toBe(0)
      expect(() => evaluateDnd5eFormulaV1(formula, { actor: { ...actor, hitPointDice: undefined }, rolls: {} })).toThrow('Hit Dice')
      expect(validateDnd5eFormulaV1({ kind: 'reference', reference: { kind, field: 'current', sides: 3 } })).not.toEqual([])
    }
  })
  it('reads monster d4 and d20 Hit Dice without inferring missing or malformed pools', () => {
    const actor = { level: 17, proficiencyBonus: 6, abilities }
    for (const sides of [4, 20] as const) {
      const target = { ...actor, hitPointDice: [{ sides, current: 0, max: 11 }] }
      const formula: Dnd5eFormulaV1 = { kind: 'reference', reference: { kind: 'target-hit-dice', field: 'maximum', sides } }
      expect(validateDnd5eFormulaV1(formula)).toEqual([])
      expect(evaluateDnd5eFormulaV1(formula, { actor, target, rolls: {} })).toBe(11)
      expect(evaluateDnd5eFormulaV1({ kind: 'reference', reference: { kind: 'target-hit-dice', field: 'current' } }, { actor, target, rolls: {} })).toBe(0)
      for (const hitPointDice of [undefined, [{ sides: 3, current: 0, max: 11 }],
        [{ sides, current: 12, max: 11 }], [{ sides, current: 0, max: 1.5 }],
        [...target.hitPointDice, ...target.hitPointDice]]) {
        expect(() => evaluateDnd5eFormulaV1(formula, { actor, target: { ...actor, hitPointDice }, rolls: {} })).toThrow('Hit Dice')
      }
    }
  })
  it('uses stat-block totals only for maximum, never fabricating spendable dice', () => {
    const actor = { level: 17, proficiencyBonus: 6, abilities }
    const target = { ...actor, hitPointDiceMaximum: dnd5eMonsterHitDiceMaximum('33d20 + 330') }
    expect(target.hitPointDiceMaximum).toEqual([{ sides: 20, max: 33 }])
    expect(dnd5eMonsterHitDiceMaximum('1d4 − 1')).toEqual([{ sides: 4, max: 1 }])
    for (const dice of [undefined, 'unknown', '0d4', '1d3', '3d20 + 1d4', '999999999999999999d8']) {
      expect(dnd5eMonsterHitDiceMaximum(dice)).toBeUndefined()
    }
    expect(evaluateDnd5eFormulaV1({ kind: 'reference', reference: { kind: 'target-hit-dice', field: 'maximum' } }, { actor, target, rolls: {} })).toBe(33)
    expect(() => evaluateDnd5eFormulaV1({ kind: 'reference', reference: { kind: 'target-hit-dice', field: 'current' } }, { actor, target, rolls: {} })).toThrow('Hit Dice')
  })
  it('uses Host skill modifiers and rejects absent or unknown skills', () => {
    const actor = { level: 7, proficiencyBonus: 3, abilities, skillCheckModifiers: { deception: 10 } }
    const target = { ...actor, skillCheckModifiers: { deception: 4 } }
    for (const kind of ['actor-skill-check-modifier', 'target-skill-check-modifier'] as const) {
      const formula: Dnd5eFormulaV1 = { kind: 'reference', reference: { kind, skill: 'deception' } }
      expect(validateDnd5eFormulaV1(formula)).toEqual([])
      expect(evaluateDnd5eFormulaV1(formula, { actor, target, rolls: {} })).toBe(kind.startsWith('actor') ? 10 : 4)
      expect(() => evaluateDnd5eFormulaV1(formula, { actor: { ...actor, skillCheckModifiers: {} }, rolls: {} }))
        .toThrow('skill modifier is unavailable')
      expect(validateDnd5eFormulaV1({ kind: 'reference', reference: { kind, skill: 'invented-skill' } })).not.toEqual([])
    }
  })
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

  it('reads a triggering effect caster DC from the Host-captured effect source', () => {
    const formula: Dnd5eFormulaV1 = {
      kind: 'reference',
      reference: { kind: 'actor-active-effect-source-spell-save-dc', effectId: 'holy-aura' },
    }
    expect(validateDnd5eFormulaV1(formula)).toEqual([])
    expect(evaluateDnd5eFormulaV1(formula, {
      actor: {
        level: 8, proficiencyBonus: 3, abilities,
        activeEffectSourceSpellSaveDcs: [{
          definitionId: 'activity:spell:holy-aura:holy-aura:modifiers:0',
          sourceSpellSaveDc: 17,
        }],
      },
      rolls: {},
    })).toBe(17)
  })

  it('reads the inspected target effect caster DC from the Host snapshot', () => {
    const formula: Dnd5eFormulaV1 = {
      kind: 'reference',
      reference: {
        kind: 'target-active-effect-source-spell-save-dc',
        effectId: 'disguise-self-appearance',
      },
    }
    expect(validateDnd5eFormulaV1(formula)).toEqual([])
    expect(evaluateDnd5eFormulaV1(formula, {
      actor: { level: 1, proficiencyBonus: 2, abilities },
      target: {
        level: 20, proficiencyBonus: 6, abilities,
        activeEffectSourceSpellSaveDcs: [{
          definitionId: 'activity:spell:disguise-self:disguise-self-appearance:modifiers:0',
          sourceSpellSaveDc: 19,
        }],
      },
      rolls: {},
    })).toBe(19)
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
