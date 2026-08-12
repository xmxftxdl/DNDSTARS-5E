import { describe, expect, it } from 'vitest'
import type { Dnd5eCustomHeadlessActionDraft } from '../customRulesPlugin'
import { compileDnd5eActivityHeadlessAction } from './dnd5eActivityHeadlessCompiler'
import { dnd5eActivityFromCustomHeadlessAction } from './legacyCustomHeadlessActivityAdapter'
import { evaluateDnd5eFormulaV1 } from './dnd5eFormula'

describe('V2 custom Headless Activity compatibility adapter', () => {
  it('preserves stable roll ids and converts every supported effect', () => {
    const legacy: Dnd5eCustomHeadlessActionDraft = {
      id: 'ember-aid',
      label: '余烬援护',
      effects: [
        { kind: 'damage', dice: { count: 2, sides: 6, modifier: 1 }, damageType: 'fire' },
        { kind: 'healing', dice: { count: 1, sides: 8 } },
        { kind: 'condition', condition: 'frightened', duration: { expiresAt: 'target-turn-end', remainingRounds: 2 } },
      ],
    }
    const activity = dnd5eActivityFromCustomHeadlessAction(legacy)
    const compiled = compileDnd5eActivityHeadlessAction(activity)
    expect(activity.legacySource).toEqual({ kind: 'custom-headless-action', id: 'ember-aid' })
    expect(compiled.rolls).toEqual([
      expect.objectContaining({ id: 'effect-0', count: 2, sides: 6 }),
      expect.objectContaining({ id: 'effect-1', count: 1, sides: 8 }),
    ])
  })

  it('keeps the legacy interrupt gate as a closed choice predicate', () => {
    const activity = dnd5eActivityFromCustomHeadlessAction({
      id: 'confirmed', label: '确认后执行', requiredInterruptOptionId: 'accept',
      effects: [{ kind: 'healing', dice: { count: 1, sides: 4 } }],
    })
    expect(activity.requirements).toEqual([{ kind: 'choice', choiceId: 'interrupt', optionId: 'accept' }])
  })

  it('compiles workshop dynamic modifiers into the shared Activity formula', () => {
    const activity = dnd5eActivityFromCustomHeadlessAction({
      id: 'trained-strike',
      label: '熟练猛击',
      effects: [{
        kind: 'damage',
        damageType: 'bludgeoning',
        dice: {
          count: 1,
          sides: 6,
          modifier: 1,
          modifierFormula: {
            schemaVersion: 1,
            terms: [{ kind: 'proficiency-bonus' }, { kind: 'ability-modifier', ability: 'str' }],
          },
        },
      }],
    })
    const operation = activity.outcomes[0].operations[0]
    expect(operation.kind).toBe('damage')
    if (operation.kind !== 'damage') throw new Error('expected damage operation')
    expect(evaluateDnd5eFormulaV1(operation.amount, {
      actor: {
        level: 5,
        proficiencyBonus: 3,
        abilities: { str: 18, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      },
      rolls: { 'effect-0': { values: [4] } },
    })).toBe(12)
  })
})
