import { describe, expect, it } from 'vitest'
import { resolveAoeDimensions } from '../../lib/skillTargeting'
import { dnd5eActivityMapTemplateV1 } from './activities/dnd5eActivityMapInteraction'
import { dnd5eSrdAuditedSpellActivityV1 } from './activities/dnd5eSrdAuditedSpellActivities'
import { validateDnd5eActivityDefinitionV1 } from './activities/dnd5eActivityValidation'
import { dnd5eActivityAutomationAnalysisV1 } from './plugins/pluginMechanicsRegistry'
import { dnd5eSpellUsesNarrativeResolution } from './spellNarrativeResolution'

describe('Move Earth audited Activity', () => {
  it('selects an adjustable square and persists it without a DM confirmation operation', () => {
    const activity = dnd5eSrdAuditedSpellActivityV1('move-earth')

    expect(activity).toBeDefined()
    expect(validateDnd5eActivityDefinitionV1(activity!)).toEqual([])
    expect(activity?.target).toEqual({
      kind: 'area', relation: 'any', origin: 'point', shape: 'rect',
      placeRangeFeet: 120,
      widthFeet: 40, minimumWidthFeet: 5,
      lengthFeet: 40, minimumLengthFeet: 5,
      heightFeet: 5,
      maximumTargets: 256, includeSelf: true,
      gridAligned: true,
      rotatable: false,
      requiresLineOfSight: false,
      requiresLineOfEffect: true,
    })
    const operations = activity?.outcomes.flatMap((outcome) => outcome.operations) ?? []
    expect(operations).toEqual([
      expect.objectContaining({
        kind: 'create-persistent-area', label: '地动术',
        durationRounds: 1_200, concentration: true, anchorMode: 'fixed',
      }),
    ])
    expect(operations.some((operation) => operation.kind === 'manual-adjudication')).toBe(false)
    expect(dnd5eActivityAutomationAnalysisV1(activity!).capability.level).toBe('full')
    expect(dnd5eSpellUsesNarrativeResolution('move-earth', activity)).toBe(false)

    const template = dnd5eActivityMapTemplateV1(activity!)
    expect(template).toEqual({
      shape: 'rect', origin: 'point', widthFeet: 40, heightFeet: 40,
      gridAligned: true,
      minimumWidthFeet: 5, minimumHeightFeet: 5,
      placeRangeFeet: 120, rotatable: false,
    })
    expect(resolveAoeDimensions(template!, { widthFeet: 25, heightFeet: 25 })).toMatchObject({
      shape: 'rect', widthFeet: 25, heightFeet: 25,
    })
    expect(resolveAoeDimensions(template!, { widthFeet: 45, heightFeet: 45 })).toBeNull()
  })
})
