import { describe, expect, it } from 'vitest'
import { dnd5ePluginSpellArea, dnd5ePluginSpellTargetCapacity } from './pluginSpellTargeting'

describe('plugin spell targeting', () => {
  it('builds a freely rotatable remote wall template', () => {
    expect(dnd5ePluginSpellArea({
      range: { type: 'distance', feet: 120, shape: 'rect', widthFeet: 60, heightFeet: 5, rotatable: true },
    })).toEqual({
      shape: 'rect', origin: 'point', widthFeet: 60, heightFeet: 5, placeRangeFeet: 120, rotatable: true,
    })
  })

  it('adds higher-slot targets and projectiles to the selectable capacity', () => {
    expect(dnd5ePluginSpellTargetCapacity({
      level: 2,
      targeting: { maximumTargets: 1 },
      mechanics: { kind: 'damage', resolution: 'automatic', upcast: {
        fromSlotLevel: 2,
        effects: [{ kind: 'additional-targets', countPerSlot: 2 }],
      } },
    }, 4)).toEqual({ maximumTargets: 5, allowDuplicateTargets: false })
    expect(dnd5ePluginSpellTargetCapacity({
      level: 1,
      targeting: { maximumTargets: 3 },
      mechanics: { kind: 'damage', resolution: 'automatic', upcast: {
        fromSlotLevel: 1,
        effects: [{ kind: 'additional-projectiles', countPerSlot: 1 }],
      } },
    }, 3)).toEqual({ maximumTargets: 5, allowDuplicateTargets: true })
  })
})
