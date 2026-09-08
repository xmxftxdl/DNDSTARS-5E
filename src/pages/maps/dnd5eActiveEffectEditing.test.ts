import { describe, expect, it } from 'vitest'
import { createDnd5eMechanicalEffect } from '../../rulesets/dnd5e/activeEffects'
import { dnd5eActiveEffectListsDiffer } from './dnd5eActiveEffectEditing'

describe('DM Active Effect editing', () => {
  it('detects removal of a non-condition mechanical effect', () => {
    const mirrorImage = createDnd5eMechanicalEffect({
      id: 'mirror-image:test01',
      definitionId: 'dnd5e-spell-mirror-image',
      label: '镜影术',
      source: { kind: 'spell', actorId: 'test01', rulesId: 'mirror-image' },
      targetId: 'test01',
      duration: { type: 'rounds', remainingRounds: 9, tickOn: 'source-turn-end' },
      stackingKey: 'mirror-image:test01',
      modifiers: {
        attackDecoys: {
          remaining: 3,
          redirectMinimumD20: [11, 8, 6],
          armorClassBase: 10,
          armorClassAbility: 'dex',
          requiresOrdinarySight: true,
        },
      },
    })

    expect(dnd5eActiveEffectListsDiffer([mirrorImage], [])).toBe(true)
  })

  it('does not submit an unchanged normalized list', () => {
    expect(dnd5eActiveEffectListsDiffer([], undefined)).toBe(false)
  })
})
