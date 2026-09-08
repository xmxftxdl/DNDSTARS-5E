import { describe, expect, it } from 'vitest'
import type { MobileSpellView } from '../../../../packages/mobile-protocol/src'
import { defaultSpellIntent, spellPayloadIntent, spellTargetCapacity } from '../services/mobileSpellIntents'

function spell(patch: Partial<MobileSpellView>): MobileSpellView {
  return {
    id: 'test-spell', name: '测试法术', level: 1, classes: ['wizard'], headless: true,
    automationLevel: 'full', catalogOnly: false, prepared: true, known: true, inSpellbook: true,
    ...patch,
  }
}

describe('mobile combat spell intents', () => {
  it('supplies mandatory closed choices before submitting to the Host', () => {
    expect(defaultSpellIntent(spell({ id: 'blindness-deafness', level: 2 }), 2)).toEqual({ conditionChoice: 'blinded' })
    expect(defaultSpellIntent(spell({ id: 'protection-from-energy', level: 3 }), 3)).toEqual({ effectDamageType: 'acid' })
    expect(defaultSpellIntent(spell({ id: 'flame-strike', level: 5 }), 6)).toEqual({ higherSlotDamageType: 'fire' })
  })

  it('retains Host-validated spell modifiers but drops mobile-only targeting state', () => {
    expect(spellPayloadIntent({
      blindTargetCell: true,
      targetElevationFeet: 40,
      areaTargetOrientation: 2,
      metamagic: { kind: 'heightened', heightenedTargetId: 'enemy' },
      overchannel: true,
      repellingBlast: true,
      spellOriginAreaId: 'projection-area',
      damageMaximizationFeatureId: 'demo.plugin:maximize',
    })).toEqual(expect.objectContaining({
      areaTargetOrientation: 2,
      metamagic: { kind: 'heightened', heightenedTargetId: 'enemy' },
      overchannel: true,
      repellingBlast: true,
      spellOriginAreaId: 'projection-area',
      damageMaximizationFeatureId: 'demo.plugin:maximize',
    }))
    expect(spellPayloadIntent({ blindTargetCell: true, targetElevationFeet: 40 })).not.toHaveProperty('blindTargetCell')
    expect(spellPayloadIntent({ blindTargetCell: true, targetElevationFeet: 40 })).not.toHaveProperty('targetElevationFeet')
  })

  it('changes single-target capacity only when twinned intent is armed', () => {
    const ray = spell({ id: 'fire-bolt', level: 0, maximumTargets: 1 })
    expect(spellTargetCapacity(ray, 0, 5).maximum).toBe(1)
    expect(spellTargetCapacity(ray, 0, 5, { metamagic: { kind: 'twinned' } }).maximum).toBe(2)
  })

  it('preserves complex area geometry, exclusions and healing allocation for Host validation', () => {
    expect(spellPayloadIntent({
      wallOfFireShape: 'ring',
      wallOfFireAngleDegrees: 90,
      wallOfFireDamagingSide: 'inside',
      wallOfFireDiameterFeet: 20,
      bladeBarrierShape: 'line',
      bladeBarrierAngleDegrees: 180,
      bladeBarrierLengthFeet: 80,
      excludedAreaTargetIds: ['ally-1', 'ally-2'],
      healingAllocations: [{ targetTokenId: 'ally-1', amount: 40 }],
    })).toEqual(expect.objectContaining({
      wallOfFireShape: 'ring',
      wallOfFireAngleDegrees: 90,
      wallOfFireDamagingSide: 'inside',
      wallOfFireDiameterFeet: 20,
      bladeBarrierShape: 'line',
      bladeBarrierAngleDegrees: 180,
      bladeBarrierLengthFeet: 80,
      excludedAreaTargetIds: ['ally-1', 'ally-2'],
      healingAllocations: [{ targetTokenId: 'ally-1', amount: 40 }],
    }))
  })
})
