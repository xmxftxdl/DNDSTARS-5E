import { describe, expect, it } from 'vitest'
import { createDnd5eMechanicalEffect } from '../../rulesets/dnd5e'
import { dnd5eMergedCombatantActiveEffects } from './combatantActiveEffects'

describe('dnd5eMergedCombatantActiveEffects', () => {
  it('keeps a token-only historical banishment visible alongside character effects', () => {
    const characterEffect = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:mage-armor',
      label: '法师护甲',
      source: { kind: 'spell', actorId: 'wizard-token', rulesId: 'mage-armor' },
      targetId: 'wizard-token',
    })
    const tokenOnlyBanishment = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:banishment',
      label: '放逐',
      legacyCondition: 'banished',
      source: { kind: 'spell', actorId: 'archmage-token', rulesId: 'banishment' },
      targetId: 'wizard-token',
      duration: { type: 'concentration', sourceActorId: 'archmage-token', concentrationId: 'banishment' },
    })

    const merged = dnd5eMergedCombatantActiveEffects({
      character: { dnd5eCombatState: { activeEffects: [characterEffect] } },
      token: { dnd5eCombatState: { activeEffects: [characterEffect, tokenOnlyBanishment] } },
    })

    expect(merged.map((effect) => effect.id)).toEqual([
      characterEffect.id,
      tokenOnlyBanishment.id,
    ])
    expect(merged.find((effect) => effect.id === tokenOnlyBanishment.id))
      .toMatchObject({ legacyCondition: 'banished' })
  })
})
