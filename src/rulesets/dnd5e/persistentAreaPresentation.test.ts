import { describe, expect, it } from 'vitest'
import { dnd5ePersistentAreaPresentationVisual } from './persistentAreaPresentation'

describe('dnd5ePersistentAreaPresentationVisual', () => {
  it('recovers the Flaming Sphere atlas preset for legacy shared areas', () => {
    expect(dnd5ePersistentAreaPresentationVisual({
      sourceKind: 'core-spell',
      coreSpellId: 'flaming-sphere',
    })).toEqual({ preset: 'flaming-sphere', intensity: 'strong' })
  })

  it('preserves an explicit snapshot visual and does not infer plugin visuals', () => {
    expect(dnd5ePersistentAreaPresentationVisual({
      sourceKind: 'core-spell',
      coreSpellId: 'flaming-sphere',
      visual: { preset: 'arcane', intensity: 'subtle' },
    })).toEqual({ preset: 'arcane', intensity: 'subtle' })
    expect(dnd5ePersistentAreaPresentationVisual({
      sourceKind: 'plugin-feature',
      coreSpellId: 'flaming-sphere',
    })).toBeUndefined()
  })

  it('upgrades legacy generic core visuals to their material presets', () => {
    expect(dnd5ePersistentAreaPresentationVisual({
      sourceKind: 'core-spell',
      coreSpellId: 'mage-hand',
      visual: { preset: 'arcane', intensity: 'subtle' },
    })).toEqual({ preset: 'mage-hand', intensity: 'subtle' })
    expect(dnd5ePersistentAreaPresentationVisual({
      sourceKind: 'core-spell',
      coreSpellId: 'insect-plague',
      visual: { preset: 'toxic-cloud', intensity: 'strong' },
    })).toEqual({ preset: 'insect-plague', intensity: 'strong' })
    expect(dnd5ePersistentAreaPresentationVisual({
      sourceKind: 'core-spell',
      coreSpellId: 'blade-barrier',
      visual: { preset: 'arcane', intensity: 'strong' },
    })).toEqual({ preset: 'blade-barrier', intensity: 'strong' })
  })
})
