import { describe, expect, it } from 'vitest'
import {
  dnd5eWorkshopDamageFormulaAsFormulaV1,
  evaluateDnd5eWorkshopDamageFormula,
  summarizeDnd5eWorkshopDamageFormula,
  validateDnd5eWorkshopDamageFormulaV1,
  type Dnd5eWorkshopDamageFormulaV1,
} from './workshopDamageFormula'
import { evaluateDnd5eFormulaV1 } from './activities/dnd5eFormula'

const formula: Dnd5eWorkshopDamageFormulaV1 = {
  schemaVersion: 1,
  terms: [
    { kind: 'proficiency-bonus' },
    { kind: 'ability-modifier', ability: 'str' },
    { kind: 'character-level', divisor: 2 },
  ],
}

const actor = {
  level: 5,
  proficiencyBonus: 3,
  abilities: { str: 18, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
}

describe('shared workshop damage formula', () => {
  it('evaluates dynamic modifiers through the authoritative formula kernel', () => {
    expect(validateDnd5eWorkshopDamageFormulaV1(formula)).toEqual([])
    expect(evaluateDnd5eWorkshopDamageFormula(formula, actor)).toBe(9)
    const compiled = dnd5eWorkshopDamageFormulaAsFormulaV1(formula)
    expect(compiled && evaluateDnd5eFormulaV1(compiled, { actor, rolls: {} })).toBe(9)
    expect(summarizeDnd5eWorkshopDamageFormula(formula)).toBe('熟练加值 + 力量调整值 + ⌊角色等级/2⌋')
  })

  it('rejects malformed or oversized formula terms', () => {
    expect(validateDnd5eWorkshopDamageFormulaV1({
      schemaVersion: 1,
      terms: [{ kind: 'ability-modifier', ability: 'luck' }],
    })).toContain('damage modifier formula.terms[0].ability is invalid')
  })
})
