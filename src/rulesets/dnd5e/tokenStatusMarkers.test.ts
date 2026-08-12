import { describe, expect, it } from 'vitest'
import { getDnd5eSrdMonster } from './monsters'
import {
  createDnd5eTokenStatusMarker,
  dnd5eTokenStatusMarkerDefinition,
  dnd5eTokenStatusMarkerOptionsForTarget,
  dnd5eTokenStatusMarkersFromActiveEffects,
  normalizeDnd5eTokenStatusMarkers,
} from './tokenStatusMarkers'

describe('D&D 5e Token status markers', () => {
  it('creates a stable presentation-only DM marker', () => {
    expect(createDnd5eTokenStatusMarker('fire-averse')).toEqual({
      schemaVersion: 1,
      id: 'dm:fire-averse',
      statusId: 'fire-averse',
      source: 'dm',
    })
    expect(dnd5eTokenStatusMarkerDefinition('fire-averse').label).toBe('畏火')
  })

  it('deduplicates status ids and rejects untrusted marker shapes', () => {
    expect(normalizeDnd5eTokenStatusMarkers([
      { schemaVersion: 1, id: 'dm:marked', statusId: 'marked', source: 'dm' },
      { schemaVersion: 1, id: 'dm:marked-again', statusId: 'marked', source: 'dm' },
      { schemaVersion: 1, id: 'plugin:unsafe', statusId: 'marked', source: 'plugin' },
      { schemaVersion: 2, id: 'dm:future', statusId: 'burning', source: 'dm' },
      null,
    ])).toEqual([
      { schemaVersion: 1, id: 'dm:marked', statusId: 'marked', source: 'dm', label: undefined },
    ])
  })

  it('projects active legacy effects while ignoring suspended and duplicate badges', () => {
    expect(dnd5eTokenStatusMarkersFromActiveEffects([
      { id: 'effect:disease', label: '腐败疫病', legacyCondition: 'disease' },
      { id: 'effect:disease-copy', label: '另一种疾病', legacyCondition: '疾病' },
      { id: 'effect:curse', label: '休眠诅咒', legacyCondition: 'curse', suspendedBy: ['shapechange'] },
      { id: 'effect:standard', label: '中毒', legacyCondition: 'poisoned' },
    ])).toEqual([{
      schemaVersion: 1,
      id: 'headless:effect:disease',
      statusId: 'diseased',
      source: 'headless',
      label: '腐败疫病',
    }])
  })

  it('scopes tactical marker options to encounter sources and self/other targets', () => {
    const participants = [
      {
        tokenId: 'flesh-golem',
        label: '血肉魔像',
        monster: {
          traits: [{ rule: { kind: 'damage-aversion', damageType: 'fire' } }],
        },
      },
      {
        tokenId: 'cultist',
        label: '邪教徒',
        monster: {
          tokenStatusMarkerGrants: [
            { statusId: 'marked' as const, target: 'other' as const },
          ],
        },
      },
      { tokenId: 'red-dragon', label: '红龙雏龙' },
    ]

    const golemOptions = dnd5eTokenStatusMarkerOptionsForTarget({
      targetTokenId: 'flesh-golem',
      participants,
    })
    expect(golemOptions).toEqual(expect.arrayContaining([
      expect.objectContaining({ definition: expect.objectContaining({ id: 'prone' }), kind: 'base' }),
      expect.objectContaining({ definition: expect.objectContaining({ id: 'fire-averse' }), target: 'self' }),
      expect.objectContaining({ definition: expect.objectContaining({ id: 'marked' }), target: 'other' }),
    ]))

    const dragonOptionIds = dnd5eTokenStatusMarkerOptionsForTarget({
      targetTokenId: 'red-dragon',
      participants,
    }).map((option) => option.definition.id)
    expect(dragonOptionIds).toContain('marked')
    expect(dragonOptionIds).not.toContain('fire-averse')

    const withoutCultist = dnd5eTokenStatusMarkerOptionsForTarget({
      targetTokenId: 'red-dragon',
      participants: participants.filter((participant) => participant.tokenId !== 'cultist'),
    }).map((option) => option.definition.id)
    expect(withoutCultist).not.toContain('marked')
  })

  it('offers fire aversion to the flesh golem itself but not a red dragon wyrmling', () => {
    const participants = [
      { tokenId: 'golem', label: '血肉魔像', monster: getDnd5eSrdMonster('srd-5.1:flesh-golem') },
      { tokenId: 'dragon', label: '红龙雏龙', monster: getDnd5eSrdMonster('srd-5.1:red-dragon-wyrmling') },
    ]
    const optionsFor = (targetTokenId: string) => dnd5eTokenStatusMarkerOptionsForTarget({
      targetTokenId,
      participants,
    }).map((option) => option.definition.id)

    expect(optionsFor('golem')).toContain('fire-averse')
    expect(optionsFor('dragon')).not.toContain('fire-averse')
  })
})
