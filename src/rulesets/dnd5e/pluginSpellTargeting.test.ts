import { describe, expect, it } from 'vitest'
import {
  dnd5ePluginSpellArea,
  dnd5ePluginSpellTargetCapacity,
  dnd5ePluginSpellUsesSelfTarget,
} from './pluginSpellTargeting'
import {
  dnd5eSrdAuditedFullContentDefinitionsV1,
  dnd5eSrdAuditedSpellActivityV1,
  dnd5eSrdAuditedSpellDefinitionV1,
} from './activities/dnd5eSrdAuditedSpellActivities'

describe('plugin spell targeting', () => {
  it('builds a freely rotatable remote wall template', () => {
    expect(dnd5ePluginSpellArea({
      range: { type: 'distance', feet: 120, shape: 'rect', widthFeet: 60, heightFeet: 5, rotatable: true },
    })).toEqual({
      shape: 'rect', origin: 'point', widthFeet: 60, heightFeet: 5, placeRangeFeet: 120, rotatable: true,
    })
  })

  it('preserves an audited line width instead of collapsing every line to five feet', () => {
    const gustOfWind = dnd5eSrdAuditedSpellDefinitionV1('gust-of-wind')
    const activity = dnd5eSrdAuditedSpellActivityV1('gust-of-wind')

    expect(gustOfWind?.range).toMatchObject({ shape: 'line', sizeFeet: 60, widthFeet: 10 })
    expect(gustOfWind?.targeting?.includeSelf).toBe(false)
    expect(dnd5ePluginSpellArea(gustOfWind!)).toMatchObject({
      shape: 'line', origin: 'self', lengthFeet: 60, widthFeet: 10,
    })
    expect(activity?.target).toMatchObject({
      kind: 'area', origin: 'self', shape: 'line', lengthFeet: 60, widthFeet: 10,
      includeSelf: false,
    })
    const gustActivities = dnd5eSrdAuditedFullContentDefinitionsV1()
      .find((definition) => definition.id === 'gust-of-wind')
      ?.activities as readonly { id?: string; target?: unknown }[] | undefined
    const redirect = gustActivities
      ?.find((candidate) => candidate.id === 'spell:gust-of-wind:redirect')
    expect(redirect?.target).toMatchObject({
      kind: 'area', origin: 'self', shape: 'line', lengthFeet: 60, widthFeet: 10,
      includeSelf: false, rotatable: true,
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

  it('uses the scaled audited Activity target count when legacy metadata omits upcast targets', () => {
    expect(dnd5ePluginSpellTargetCapacity({
      level: 1,
      targeting: { maximumTargets: 1 },
      mechanics: undefined,
    }, 5, 5)).toEqual({ maximumTargets: 5, allowDuplicateTargets: false })
  })

  it('lets an audited creature Activity override a self-origin catalogue range', () => {
    const spell = { range: { type: 'self' as const } }

    expect(dnd5ePluginSpellUsesSelfTarget(spell)).toBe(true)
    expect(dnd5ePluginSpellUsesSelfTarget(spell, { target: { kind: 'self' } })).toBe(true)
    expect(dnd5ePluginSpellUsesSelfTarget(spell, { target: { kind: 'creature' } })).toBe(false)
  })
})
