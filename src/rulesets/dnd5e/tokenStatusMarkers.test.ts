import { describe, expect, it } from 'vitest'
import { getDnd5eSrdMonster } from './monsters'
import {
  createDnd5eTokenStatusMarker,
  dnd5eTokenStatusMarkerDefinition,
  dnd5eMonsterRuntimeStatusCapabilities,
  dnd5eTokenStatusMarkerGrantsFromMonster,
  dnd5eTokenStatusMarkerOptionsForTarget,
  dnd5eTokenStatusMarkersFromActiveEffects,
  mergeDnd5eTokenStatusMarkersForDisplay,
  normalizeDnd5eSuppressedTokenStatusMarkerIds,
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

  it('projects each active legacy effect as its own badge while ignoring suspended effects', () => {
    expect(dnd5eTokenStatusMarkersFromActiveEffects([
      { id: 'effect:disease', label: '腐败疫病', legacyCondition: 'disease' },
      { id: 'effect:disease-copy', label: '另一种疾病', legacyCondition: '疾病' },
      { id: 'effect:curse', label: '休眠诅咒', legacyCondition: 'curse', suspendedBy: ['shapechange'] },
      { id: 'effect:standard', label: '中毒', legacyCondition: 'poisoned' },
      { id: 'effect:attached', label: '附着', legacyCondition: 'attached' },
      { id: 'effect:suffocating', label: '无法呼吸', legacyCondition: 'unable-to-breathe' },
    ])).toEqual([
      expect.objectContaining({
        id: 'headless:effect:disease',
        activeEffectId: 'effect:disease',
        statusId: 'diseased',
        source: 'headless',
        mechanical: true,
      }),
      expect.objectContaining({
        id: 'headless:effect:disease-copy',
        activeEffectId: 'effect:disease-copy',
        statusId: 'diseased',
        source: 'headless',
        mechanical: true,
      }),
      expect.objectContaining({ id: 'headless:effect:attached', statusId: 'attached' }),
      expect.objectContaining({ id: 'headless:effect:suffocating', statusId: 'suffocating' }),
    ])
  })

  it('keeps effect instances independent but collapses one semantic status to one map badge', () => {
    const manual = createDnd5eTokenStatusMarker('fire-averse')
    const derived = {
      ...createDnd5eTokenStatusMarker('fire-averse', 'headless'),
      id: 'monster-trait:golem:fire-averse:1',
      mechanical: true,
    }

    expect(mergeDnd5eTokenStatusMarkersForDisplay([manual], [derived])).toEqual([derived])
  })

  it('normalizes hidden derived marker ids without accepting unsafe data', () => {
    expect(normalizeDnd5eSuppressedTokenStatusMarkerIds([
      'monster-trait:golem:fire-averse:1',
      'monster-trait:golem:fire-averse:1',
      '../unsafe',
      42,
    ])).toEqual(['monster-trait:golem:fire-averse:1'])
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

  it('audits structured monster effects into scoped triggerable status capabilities', () => {
    const grants = dnd5eTokenStatusMarkerGrantsFromMonster({
      traits: [{ name: '黏液云', rule: { kind: 'mucous-cloud', condition: 'disease' } }],
      actions: [
        {
          attack: {
            onHitEffects: [{ kind: 'persistent-effect', label: '流血伤口', ailment: 'bleeding' }],
          },
        },
        {
          rule: { kind: 'invisibility' },
        },
        {
          rule: {
            kind: 'area-saving-throw',
            activeEffectOnFailedSave: {
              label: '迟缓吐息',
              modifiers: { speedMultiplier: 0.5 },
            },
          },
        },
      ],
      headlessMechanics: [{
        schemaVersion: 2,
        effects: [{ kind: 'tactical-status', target: 'selected-subject', statusId: 'marked' }],
      }],
    })

    expect(grants).toEqual(expect.arrayContaining([
      { statusId: 'diseased', target: 'other', application: 'active-effect' },
      { statusId: 'bleeding', target: 'other', application: 'active-effect' },
      { statusId: 'hidden', target: 'self', application: 'active-effect' },
      { statusId: 'slowed', target: 'other', application: 'active-effect' },
      { statusId: 'marked', target: 'other', application: 'active-effect' },
    ]))
  })

  it('exposes only runtime states declared by the monster stat block', () => {
    expect(dnd5eMonsterRuntimeStatusCapabilities(
      getDnd5eSrdMonster('srd-5.1:flesh-golem'),
    )).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'monster-berserk', label: '狂暴' }),
      expect.objectContaining({ id: 'monster-damage-aversion', label: '伤害畏避' }),
    ]))
    expect(dnd5eMonsterRuntimeStatusCapabilities(
      getDnd5eSrdMonster('srd-5.1:red-dragon-wyrmling'),
    )).toEqual([])
    expect(dnd5eMonsterRuntimeStatusCapabilities(
      getDnd5eSrdMonster('srd-5.1:troll'),
    )).toEqual([
      expect.objectContaining({ id: 'monster-regeneration-suppressed', label: '再生受抑' }),
    ])
  })

  it('includes attached and suffocating states only for other targets of a participating Cloaker', () => {
    const cloaker = { tokenId: 'cloaker', label: '斗篷怪', monster: getDnd5eSrdMonster('srd-5.1:cloaker') }
    const target = { tokenId: 'target', label: '冒险者' }
    const forTarget = dnd5eTokenStatusMarkerOptionsForTarget({
      targetTokenId: target.tokenId,
      participants: [cloaker, target],
    })
    const forCloaker = dnd5eTokenStatusMarkerOptionsForTarget({
      targetTokenId: cloaker.tokenId,
      participants: [cloaker, target],
    })

    expect(forTarget).toEqual(expect.arrayContaining([
      expect.objectContaining({ definition: expect.objectContaining({ id: 'attached' }), applications: ['active-effect'] }),
      expect.objectContaining({ definition: expect.objectContaining({ id: 'suffocating' }), applications: ['active-effect'] }),
    ]))
    expect(forCloaker.map((option) => option.definition.id)).not.toContain('attached')
    expect(forCloaker.map((option) => option.definition.id)).not.toContain('suffocating')
  })
})
