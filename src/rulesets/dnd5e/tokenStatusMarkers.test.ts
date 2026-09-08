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
      { id: 'effect:standard', label: '中毒', legacyCondition: 'poisoned', standardCondition: 'poisoned' },
      { id: 'effect:invisible', label: '隐形术', legacyCondition: 'invisibility', standardCondition: 'invisible' },
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

  it('projects disguise self as a dedicated disguise badge instead of invisibility', () => {
    const markers = dnd5eTokenStatusMarkersFromActiveEffects([{
      id: 'activity:disguise-self:appearance',
      definitionId: 'srd-5.1:spell:disguise-self:appearance',
      label: '易容术',
      legacyCondition: '易容术',
      source: { actorId: 'hero', rulesId: 'disguise-self' },
    }])

    expect(markers).toEqual([
      expect.objectContaining({
        id: 'headless:activity:disguise-self:appearance',
        statusId: 'disguised',
        label: '易容术',
        activeEffectId: 'activity:disguise-self:appearance',
        mechanical: true,
      }),
    ])
    expect(dnd5eTokenStatusMarkerDefinition('disguised')).toMatchObject({
      label: '易容',
    })
    expect(markers[0]?.statusId).not.toBe('hidden')
  })

  it('projects all five Imprisonment modes as one spell badge with distinct labels', () => {
    const modes = [
      ['burial', '埋葬'],
      ['chaining', '锁链'],
      ['hedged-prison', '封闭监牢'],
      ['minimus-containment', '微缩收容'],
      ['slumber', '沉眠'],
    ] as const

    for (const [mode, label] of modes) {
      expect(dnd5eTokenStatusMarkersFromActiveEffects([{
        id: `activity:imprisonment:${mode}`,
        definitionId: `activity:imprisonment:imprisonment-${mode}:extension`,
        label: `禁锢术：${label}`,
        legacyCondition: `imprisonment-${mode}`,
        source: { actorId: 'archmage', rulesId: 'imprisonment' },
      }])).toEqual([
        expect.objectContaining({
          statusId: 'imprisoned',
          label: `禁锢术：${label}`,
          mechanical: true,
        }),
      ])
    }
    expect(dnd5eTokenStatusMarkerDefinition('imprisoned').description).toBe(
      '权威效果：目标正受到禁锢术影响。',
    )
  })

  it('projects the Cone of Cold frozen statue ActiveEffect as a removable Token badge', () => {
    const markers = dnd5eTokenStatusMarkersFromActiveEffects([{
      id: 'effect:cone-of-cold:frozen-statue:target',
      definitionId: 'srd-5.1:spell:cone-of-cold:frozen-statue',
      label: '寒冰锥：冰冻塑像（直至解冻）',
      source: { actorId: 'wizard', actorName: '法师', rulesId: 'cone-of-cold' },
    }])

    expect(markers).toEqual([expect.objectContaining({
      statusId: 'frozen-statue',
      label: '寒冰锥：冰冻塑像（直至解冻）',
      activeEffectId: 'effect:cone-of-cold:frozen-statue:target',
      sourceActorId: 'wizard',
      sourceLabel: '法师',
      mechanical: true,
    })])
    expect(dnd5eTokenStatusMarkerDefinition('frozen-statue')).toMatchObject({
      label: '冰冻塑像',
      description: '权威效果：该生物被寒冰锥杀死并化为冰冻塑像，持续至解冻。',
    })
  })

  it('projects Nondetection as a dedicated removable spell badge', () => {
    const markers = dnd5eTokenStatusMarkersFromActiveEffects([{
      id: 'activity:nondetection:target',
      definitionId: 'srd-5.1:spell:nondetection',
      label: '回避侦测',
      source: { actorId: 'wizard', actorName: '法师', rulesId: 'nondetection' },
    }])

    expect(markers).toEqual([expect.objectContaining({
      statusId: 'nondetection',
      label: '回避侦测',
      activeEffectId: 'activity:nondetection:target',
      sourceActorId: 'wizard',
      sourceLabel: '法师',
      mechanical: true,
    })])
    expect(dnd5eTokenStatusMarkerDefinition('nondetection')).toMatchObject({
      label: '回避侦测',
      description: expect.stringContaining('无法成为预言系法术的目标'),
    })
  })

  it('projects a failed Plane Shift save as a removable transported Token badge', () => {
    const markers = dnd5eTokenStatusMarkersFromActiveEffects([{
      id: 'effect:plane-shift:transferred:target',
      definitionId: 'srd-5.1:spell:plane-shift-transferred',
      label: '异界传送：已被传送',
      legacyCondition: 'plane-shifted',
      source: { actorId: 'wizard', actorName: '法师', rulesId: 'plane-shift' },
    }])

    expect(markers).toEqual([expect.objectContaining({
      statusId: 'plane-shifted',
      label: '异界传送：已被传送',
      activeEffectId: 'effect:plane-shift:transferred:target',
      sourceActorId: 'wizard',
      sourceLabel: '法师',
      mechanical: true,
    })])
    expect(dnd5eTokenStatusMarkerDefinition('plane-shifted')).toMatchObject({
      label: '已被异界传送',
      description: '权威效果：该生物因异界传送豁免失败，已被送往施法者指定的存在位面。',
    })
  })

  it('projects a DM custom ActiveEffect as a removable generic Token badge', () => {
    const markers = dnd5eTokenStatusMarkersFromActiveEffects([{
      id: 'dm:target:custom-status:tracked:1',
      definitionId: 'dm:custom-status:tracked',
      label: '被星界猎手追踪',
      legacyCondition: '被星界猎手追踪',
      source: { actorId: 'dm', label: 'DM 裁定' },
    }])

    expect(markers).toEqual([
      expect.objectContaining({
        id: 'headless:dm:target:custom-status:tracked:1',
        activeEffectId: 'dm:target:custom-status:tracked:1',
        statusId: expect.stringMatching(/^custom:/),
        label: '被星界猎手追踪',
        mechanical: true,
      }),
    ])
    expect(markers[0]?.detailDescription).toBeUndefined()
    expect(normalizeDnd5eTokenStatusMarkers(markers)).toEqual([
      expect.objectContaining({
        statusId: expect.stringMatching(/^custom:/),
        label: '被星界猎手追踪',
      }),
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
