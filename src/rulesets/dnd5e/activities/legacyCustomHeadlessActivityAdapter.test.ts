import { describe, expect, it } from 'vitest'
import type { Dnd5eCustomHeadlessActionDraft } from '../customRulesPlugin'
import { compileDnd5eActivityHeadlessAction } from './dnd5eActivityHeadlessCompiler'
import { dnd5eActivityFromCustomHeadlessAction } from './legacyCustomHeadlessActivityAdapter'

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
})

