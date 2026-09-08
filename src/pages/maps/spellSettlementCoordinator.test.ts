import { describe, expect, it } from 'vitest'
import {
  areaSpellPresentationForSettlement,
  fireballPresentationForSettlement,
  guidancePresentationsForTargets,
  hasSpellActionBannerPresentation,
  hasBarkskinPresentationEffect,
  hasBlindnessDeafnessPresentationEffect,
  hasBlurPresentationEffect,
  hasCharmPersonPresentationEffect,
  hasGuidancePresentationEffect,
  hasDarkvisionPresentationEffect,
  hasDeathWardPresentationEffect,
  hasDivineFavorPresentationEffect,
  hasEnhanceAbilityPresentationEffect,
  hasEnlargeReducePresentationEffect,
  hasFlameBladePresentationEffect,
  hasFlyPresentationEffect,
  hasGreaterInvisibilityPresentationEffect,
  hasHeroismPresentationEffect,
  hasHideousLaughterPresentationEffect,
  hasHoldPersonPresentationEffect,
  hasHuntersMarkPresentationEffect,
  hasJumpPresentationEffect,
  hasInvisibilityPresentationEffect,
  hasLongstriderPresentationEffect,
  hasMagicWeaponPresentationEffect,
  hasResistancePresentationEffect,
  hasProtectionFromEnergyPresentationEffect,
  hasProtectionFromPoisonPresentationEffect,
  hasSanctuaryPresentationEffect,
  hasSeeInvisibilityPresentationEffect,
  hasWardingBondPresentationEffect,
  mergeDnd5eSpellAreaDelta,
  planDnd5eCrossMapConcentrationProjectionCleanup,
  resistancePresentationsForTargets,
  sanctuaryPresentationsForTargets,
  spellPresentationEffectSourceActorId,
  spellPresentationsBeforeRoll,
  spellSettlementMapLayerChanges,
  spellSettlementPrimarySavingThrows,
  spellSettlementSpentTurnResource,
  settleSunburstSpellDarknessDispels,
  dnd5eConcentrationReplacementDetonationAreas,
  dnd5eSpellAttackPresentationOrigin,
  dnd5eSpellResolutionInitiativeOrder,
} from './spellSettlementCoordinator'
import type { Character } from '../../types/character'

describe('SpellSettlementCoordinator', () => {
  it('captures an on-detonate concentration area removed by a replacement spell', () => {
    const delayedBlastFireball = {
      id: 'dbf-area', pluginId: 'srd-5.1', featureId: 'srd-5.1:spell:delayed-blast-fireball',
      sourceKind: 'core-spell' as const, coreSpellId: 'delayed-blast-fireball',
      label: '延迟爆裂火球', color: '#ef4444', sourceCharacterId: 'wizard',
      sourceTokenId: 'wizard-token', cells: [{ col: 3, row: 3 }], createdRound: 1,
      expiresAfterRound: 11, concentrationId: 'delayed-blast-fireball',
      triggers: [{
        id: 'detonate', timing: 'on-detonate' as const, label: '爆炸',
        damage: { count: 12, sides: 6, type: 'fire' as const },
      }],
    }
    const unrelated = {
      ...delayedBlastFireball,
      id: 'other-area',
      sourceCharacterId: 'other-wizard',
      sourceTokenId: 'other-token',
    }
    const beforeMap = {
      id: 'map', name: 'map', width: 500, height: 500, gridSize: 50, showGrid: true,
      gridOffsetX: 0, gridOffsetY: 0,
      tokens: [], dnd5ePluginAreas: [delayedBlastFireball, unrelated],
    }
    const afterMap = { ...beforeMap, dnd5ePluginAreas: [unrelated] }

    expect(dnd5eConcentrationReplacementDetonationAreas({
      beforeMap,
      afterMap,
      sourceCharacterId: 'wizard',
      sourceTokenId: 'wizard-token',
      replacementConcentrationId: 'haste',
    })).toEqual([delayedBlastFireball])

    expect(dnd5eConcentrationReplacementDetonationAreas({
      beforeMap,
      afterMap: beforeMap,
      sourceCharacterId: 'wizard',
      sourceTokenId: 'wizard-token',
      concentrationEnded: true,
    })).toEqual([delayedBlastFireball])
  })

  it('adds ordinary NPC creatures to ephemeral spell-resolution initiative without changing combat turns', () => {
    const map = {
      id: 'map', name: 'map', width: 500, height: 500, gridSize: 50, showGrid: true,
      gridOffsetX: 0, gridOffsetY: 0,
      tokens: [
        { id: 'caster', label: 'caster', x: 25, y: 25, color: '#fff', emoji: 'C', size: 1, type: 'player' as const },
        { id: 'npc', label: 'npc', x: 75, y: 25, color: '#fff', emoji: 'N', size: 1, type: 'npc' as const, hp: 12, maxHp: 12 },
      ],
    }
    const combatEntry = { tokenId: 'caster', roll: 18, label: 'caster', emoji: 'C', color: '#fff', slotId: 'caster-slot' }
    expect(dnd5eSpellResolutionInitiativeOrder({
      combatActive: true, map, actorTokenId: 'caster', initiativeOrder: [combatEntry],
    })).toEqual([
      combatEntry,
      expect.objectContaining({ tokenId: 'npc', slotId: 'spell-resolution:npc:npc' }),
    ])
  })

  it('removes a caster\'s stale concentration projections from every other map', () => {
    const oldArea = {
      id: 'old-dancing-lights', pluginId: 'srd-5.1', featureId: 'srd-5.1:spell:dancing-lights',
      sourceKind: 'core-spell' as const, coreSpellId: 'dancing-lights', label: '舞光术', color: '#67e8f9',
      sourceCharacterId: 'wizard', sourceTokenId: 'wizard-old-token',
      cells: [{ col: 3, row: 3 }], createdRound: 1, expiresAfterRound: 11,
      concentrationId: 'dancing-lights',
    }
    const staleEffectToken = {
      id: 'old-effect', label: 'old effect', x: 25, y: 25, color: '#fff', emoji: '✦', size: 1,
      type: 'obstacle' as const,
      dnd5eSpellEffect: {
        schemaVersion: 1 as const, spellId: 'moonbeam', sourceCharacterId: 'wizard',
        sourceTokenId: 'wizard-old-token', createdRound: 1, expiresAfterRound: 11,
        concentrationId: 'moonbeam',
      },
    }
    const unrelatedArea = { ...oldArea, id: 'other-area', sourceCharacterId: 'other-caster' }
    const maps = [
      { id: 'current', name: 'current', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [] },
      {
        id: 'old', name: 'old', width: 500, height: 500, gridSize: 50, showGrid: true,
        gridOffsetX: 0, gridOffsetY: 0,
        tokens: [staleEffectToken], dnd5ePluginAreas: [oldArea, unrelatedArea],
      },
    ]

    expect(planDnd5eCrossMapConcentrationProjectionCleanup({
      maps,
      currentMapId: 'current',
      createdArea: { concentrationId: 'dancing-lights', sourceCharacterId: 'wizard' },
    })).toEqual([{
      mapId: 'old',
      dnd5ePluginAreas: [unrelatedArea],
      tokens: [],
    }])
  })

  it('counts only primary spell saves and excludes concentration follow-ups', () => {
    const primaryA = {
      type: 'saving-throw-resolved' as const,
      targetId: 'cleric', ability: 'con' as const,
      d20: 14, modifier: 5, total: 19, dc: 19, success: true,
    }
    const primaryB = {
      type: 'saving-throw-resolved' as const,
      targetId: 'goblin', ability: 'con' as const,
      d20: 7, modifier: 0, total: 7, dc: 19, success: false,
    }
    const concentrationFollowUp = {
      type: 'saving-throw-resolved' as const,
      targetId: 'cleric', ability: 'con' as const,
      d20: 11, modifier: 5, total: 16, dc: 10, success: true,
    }
    const duplicateFollowUp = { ...primaryA, d20: 20, total: 25 }

    expect(spellSettlementPrimarySavingThrows(
      [primaryA, primaryB, concentrationFollowUp, duplicateFollowUp],
      [
        { targetId: 'cleric', ability: 'con', dc: 19 },
        { targetId: 'goblin', ability: 'con', dc: 19 },
      ],
    )).toEqual([primaryA, primaryB])
  })

  it('uses the moved Spiritual Weapon token as the sustained attack trace origin', () => {
    const actorToken = {
      id: 'cleric-token', label: 'Cleric', x: 25, y: 25, color: '#fff', emoji: 'C', size: 1,
      type: 'player' as const, characterId: 'cleric',
    }
    const weaponToken = {
      id: 'weapon-token', label: 'Spiritual Weapon', x: 225, y: 25, color: '#fff', emoji: 'W', size: 1,
      type: 'obstacle' as const,
    }
    const map = {
      id: 'map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, weaponToken],
      dnd5ePluginAreas: [{
        id: 'weapon-area', pluginId: 'srd-5.1', featureId: 'srd-5.1:spell:spiritual-weapon',
        sourceKind: 'core-spell' as const, coreSpellId: 'spiritual-weapon',
        label: 'Spiritual Weapon', color: '#fff', sourceCharacterId: 'cleric',
        sourceTokenId: actorToken.id, cells: [{ col: 4, row: 0 }], createdRound: 1,
        expiresAfterRound: 11, anchorMode: 'effect-token' as const, anchorTokenId: weaponToken.id,
      }],
    }

    expect(dnd5eSpellAttackPresentationOrigin({
      map,
      actorToken,
      sustainedEffectAreaId: 'weapon-area',
      sustainedAttackOrigin: 'effect-token',
    })).toBe(weaponToken)
    expect(dnd5eSpellAttackPresentationOrigin({ map, actorToken })).toBe(actorToken)
  })

  it('allows every validated spell to use the shared action banner', () => {
    expect(hasSpellActionBannerPresentation('shatter')).toBe(true)
    expect(hasSpellActionBannerPresentation('thunderwave')).toBe(true)
    expect(hasSpellActionBannerPresentation('fireball')).toBe(true)
    expect(hasSpellActionBannerPresentation('fire-bolt')).toBe(true)
    expect(hasSpellActionBannerPresentation('plugin.example:storm-song')).toBe(true)
    expect(hasSpellActionBannerPresentation('')).toBe(false)
  })

  it('plans every supported presentation before any attack or save result exists', () => {
    expect(spellPresentationsBeforeRoll({
      spellId: 'sacred-flame',
      transactionId: 'sacred-tx',
      mapId: 'map',
      actorTokenId: 'cleric',
      targetTokenIds: ['goblin'],
    })).toEqual([{
      spellId: 'sacred-flame',
      id: 'sacred-tx:sacred-flame:0',
      transactionId: 'sacred-tx',
      mapId: 'map',
      sourceTokenId: 'cleric',
      targetTokenId: 'goblin',
    }])
    for (const spellId of [
      'fire-bolt',
      'ray-of-frost',
      'eldritch-blast',
      'produce-flame',
      'shocking-grasp',
      'chill-touch',
      'sacred-flame',
      'sanctuary',
      'spare-the-dying',
      'acid-splash',
      'poison-spray',
      'vicious-mockery',
      'magic-missile',
      'scorching-ray',
      'guiding-bolt',
      'acid-arrow',
      'cure-wounds',
      'healing-word',
      'inflict-wounds',
      'bless',
      'bane',
      'shield-of-faith',
      'mage-armor',
      'jump',
      'darkvision',
      'see-invisibility',
      'warding-bond',
      'fly',
      'heroism',
      'enlarge-reduce',
      'enhance-ability',
      'divine-favor',
      'hunters-mark',
      'magic-weapon',
      'flame-blade',
      'invisibility',
      'blur',
      'barkskin',
      'protection-from-poison',
      'longstrider',
      'protection-from-energy',
      'death-ward',
      'greater-invisibility',
      'charm-person',
      'hideous-laughter',
      'hold-person',
      'blindness-deafness',
      'blight',
      'chain-lightning',
      'disintegrate',
      'finger-of-death',
      'power-word-stun',
      'power-word-kill',
      'false-life',
      'hypnotic-pattern',
      'slow',
      'phantasmal-killer',
      'banishment',
      'hold-monster',
      'dispel-magic',
      'lesser-restoration',
    ]) {
      expect(spellPresentationsBeforeRoll({
        spellId,
        transactionId: `${spellId}-tx`,
        mapId: 'map',
        actorTokenId: 'caster',
        targetTokenIds: ['target'],
      })).toEqual([expect.objectContaining({ spellId, targetTokenId: 'target' })])
    }
    expect(spellPresentationsBeforeRoll({
      spellId: 'misty-step',
      transactionId: 'misty-step-tx',
      mapId: 'map',
      actorTokenId: 'wizard',
      targetTokenIds: [],
    })).toEqual([expect.objectContaining({
      spellId: 'misty-step',
      sourceTokenId: 'wizard',
      targetTokenId: 'wizard',
    })])
    expect(spellPresentationsBeforeRoll({
      spellId: 'eldritch-blast',
      transactionId: 'blast-tx',
      mapId: 'map',
      actorTokenId: 'warlock',
      targetTokenIds: ['goblin', 'ogre', 'goblin'],
    })).toEqual([
      expect.objectContaining({
        id: 'blast-tx:eldritch-blast:0',
        targetTokenId: 'goblin',
      }),
      expect.objectContaining({
        id: 'blast-tx:eldritch-blast:1',
        targetTokenId: 'ogre',
      }),
      expect.objectContaining({
        id: 'blast-tx:eldritch-blast:2',
        targetTokenId: 'goblin',
      }),
    ])
    expect(spellPresentationsBeforeRoll({
      spellId: 'magic-missile',
      transactionId: 'missile-tx',
      mapId: 'map',
      actorTokenId: 'wizard',
      targetTokenIds: ['goblin', 'ogre', 'goblin'],
    })).toEqual([
      expect.objectContaining({
        id: 'missile-tx:magic-missile:0',
        targetTokenId: 'goblin',
      }),
      expect.objectContaining({
        id: 'missile-tx:magic-missile:1',
        targetTokenId: 'ogre',
      }),
      expect.objectContaining({
        id: 'missile-tx:magic-missile:2',
        targetTokenId: 'goblin',
      }),
    ])
    expect(spellPresentationsBeforeRoll({
      spellId: 'chain-lightning',
      transactionId: 'chain-tx',
      mapId: 'map',
      actorTokenId: 'sorcerer',
      targetTokenIds: ['primary', 'secondary-a', 'secondary-b'],
    })).toEqual([
      expect.objectContaining({ sourceTokenId: 'sorcerer', targetTokenId: 'primary' }),
      expect.objectContaining({ sourceTokenId: 'primary', targetTokenId: 'secondary-a' }),
      expect.objectContaining({ sourceTokenId: 'primary', targetTokenId: 'secondary-b' }),
    ])
    expect(spellPresentationsBeforeRoll({
      spellId: 'fire-bolt',
      transactionId: 'twinned-tx',
      mapId: 'map',
      actorTokenId: 'sorcerer',
      targetTokenIds: ['goblin', 'ogre'],
    })).toEqual([
      expect.objectContaining({ targetTokenId: 'goblin' }),
      expect.objectContaining({ targetTokenId: 'ogre' }),
    ])
    expect(spellPresentationsBeforeRoll({
      spellId: 'fireball',
      transactionId: 'area-tx',
      mapId: 'map',
      actorTokenId: 'wizard',
      targetTokenIds: ['goblin'],
    })).toEqual([])
  })

  it('derives authoritative area VFX geometry from the selected anchor cell', () => {
    const common = {
      transactionId: 'area-vfx-tx',
      mapId: 'map',
      actorTokenId: 'caster',
      areaAnchorCell: { col: 6, row: 4 },
    }
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'burning-hands',
    })).toMatchObject({
      spellId: 'burning-hands',
      shape: 'cone',
      lengthFeet: 15,
      widthFeet: 15,
      targetCell: { col: 6, row: 4 },
    })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'shatter',
    })).toMatchObject({
      spellId: 'shatter',
      shape: 'circle',
      radiusFeet: 10,
    })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'lightning-bolt',
    })).toMatchObject({
      spellId: 'lightning-bolt',
      shape: 'line',
      lengthFeet: 100,
      widthFeet: 5,
    })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'flame-strike',
    })).toMatchObject({
      spellId: 'flame-strike',
      shape: 'circle',
      radiusFeet: 10,
    })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'sunburst',
    })).toMatchObject({
      spellId: 'sunburst',
      shape: 'circle',
      radiusFeet: 60,
    })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'cone-of-cold',
    })).toMatchObject({
      spellId: 'cone-of-cold',
      shape: 'cone',
      lengthFeet: 60,
      widthFeet: 60,
    })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'circle-of-death',
    })).toMatchObject({
      spellId: 'circle-of-death',
      shape: 'circle',
      radiusFeet: 60,
    })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'ice-storm',
    })).toMatchObject({
      spellId: 'ice-storm',
      shape: 'circle',
      radiusFeet: 20,
    })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'freezing-sphere',
    })).toMatchObject({
      spellId: 'freezing-sphere',
      shape: 'circle',
      radiusFeet: 60,
    })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'color-spray',
    })).toMatchObject({
      spellId: 'color-spray',
      shape: 'cone',
      lengthFeet: 15,
      widthFeet: 15,
    })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'prismatic-spray',
    })).toMatchObject({
      spellId: 'prismatic-spray',
      shape: 'cone',
      lengthFeet: 60,
      widthFeet: 60,
    })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'faerie-fire',
    })).toMatchObject({
      spellId: 'faerie-fire',
      shape: 'rect',
      widthFeet: 20,
      heightFeet: 20,
    })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'sleep',
    })).toMatchObject({
      spellId: 'sleep',
      shape: 'circle',
      radiusFeet: 20,
    })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'entangle',
    })).toMatchObject({
      spellId: 'entangle',
      shape: 'rect',
      widthFeet: 20,
      heightFeet: 20,
    })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'web',
    })).toMatchObject({
      spellId: 'web',
      shape: 'rect',
      widthFeet: 20,
      heightFeet: 20,
    })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'grease',
    })).toBeNull()
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'darkness',
    })).toMatchObject({
      spellId: 'darkness',
      shape: 'circle',
      radiusFeet: 15,
    })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'flaming-sphere',
    })).toMatchObject({
      spellId: 'flaming-sphere',
      shape: 'circle',
      radiusFeet: 5,
    })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'moonbeam',
    })).toMatchObject({
      spellId: 'moonbeam',
      shape: 'circle',
      radiusFeet: 5,
    })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'daylight',
    })).toMatchObject({ spellId: 'daylight', shape: 'circle', radiusFeet: 120 })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'black-tentacles',
    })).toMatchObject({
      spellId: 'black-tentacles', shape: 'rect', widthFeet: 20, heightFeet: 20,
    })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'spike-growth',
    })).toMatchObject({ spellId: 'spike-growth', shape: 'circle', radiusFeet: 20 })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'mage-hand',
    })).toMatchObject({ spellId: 'mage-hand', shape: 'circle', radiusFeet: 0 })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'spiritual-weapon',
    })).toMatchObject({ spellId: 'spiritual-weapon', shape: 'circle', radiusFeet: 5 })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'spirit-guardians',
    })).toMatchObject({ spellId: 'spirit-guardians', shape: 'circle', radiusFeet: 15 })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'call-lightning',
    })).toMatchObject({ spellId: 'call-lightning', shape: 'circle', radiusFeet: 60 })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'call-lightning-strike',
    })).toMatchObject({ spellId: 'call-lightning-strike', shape: 'circle', radiusFeet: 5 })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'insect-plague',
    })).toMatchObject({ spellId: 'insect-plague', shape: 'circle', radiusFeet: 20 })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'stinking-cloud',
    })).toMatchObject({ spellId: 'stinking-cloud', shape: 'circle', radiusFeet: 20 })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'fog-cloud',
    })).toMatchObject({ spellId: 'fog-cloud', shape: 'circle', radiusFeet: 20 })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'silence',
    })).toMatchObject({ spellId: 'silence', shape: 'circle', radiusFeet: 20 })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'sleet-storm',
    })).toMatchObject({ spellId: 'sleet-storm', shape: 'circle', radiusFeet: 40 })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'wind-wall',
      areaTargetOrientation: 3,
    })).toMatchObject({
      spellId: 'wind-wall', shape: 'rect', widthFeet: 50, heightFeet: 5,
      areaAngleDegrees: 270,
    })
    for (const spellId of ['wall-of-force', 'wall-of-stone', 'wall-of-ice'] as const) {
      expect(areaSpellPresentationForSettlement({
        ...common,
        spellId,
        areaTargetOrientation: 1,
      })).toMatchObject({
        spellId, shape: 'rect', widthFeet: 100, heightFeet: 5, areaAngleDegrees: 90,
      })
    }
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'wall-of-thorns',
      areaTargetOrientation: 2,
    })).toMatchObject({
      spellId: 'wall-of-thorns', shape: 'rect', widthFeet: 60, heightFeet: 5,
      areaAngleDegrees: 180,
    })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'wall-of-fire',
    })).toMatchObject({ spellId: 'wall-of-fire', shape: 'rect', widthFeet: 60, heightFeet: 5 })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'wall-of-fire',
      wallOfFireGeometry: { shape: 'line', angleDegrees: 35, lengthFeet: 30, diameterFeet: 20 },
    })).toMatchObject({
      spellId: 'wall-of-fire',
      shape: 'rect',
      widthFeet: 30,
      heightFeet: 5,
      wallOfFireShape: 'line',
      wallOfFireAngleDegrees: 35,
    })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'wall-of-fire',
      wallOfFireGeometry: { shape: 'ring', angleDegrees: 0, lengthFeet: 60, diameterFeet: 10 },
    })).toMatchObject({ spellId: 'wall-of-fire', shape: 'rect', widthFeet: 10, heightFeet: 5, wallOfFireShape: 'ring' })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'blade-barrier',
    })).toMatchObject({ spellId: 'blade-barrier', shape: 'rect', widthFeet: 100, heightFeet: 5 })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'blade-barrier',
      wallOfFireGeometry: { shape: 'ring', angleDegrees: 0, lengthFeet: 100, diameterFeet: 45 },
    })).toMatchObject({ spellId: 'blade-barrier', shape: 'rect', widthFeet: 45, heightFeet: 5, wallOfFireShape: 'ring' })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'fireball',
    })).toBeNull()
  })

  it('derives Guidance manifestations and recognizes its authoritative duration marker', () => {
    expect(guidancePresentationsForTargets({
      spellId: 'guidance',
      transactionId: 'guidance-tx',
      mapId: 'map',
      actorTokenId: 'cleric',
      targetTokenIds: ['fighter', 'fighter'],
    })).toEqual([{
      id: 'guidance-tx:guidance:0',
      transactionId: 'guidance-tx',
      mapId: 'map',
      sourceTokenId: 'cleric',
      targetTokenId: 'fighter',
    }])
    expect(hasGuidancePresentationEffect({
      concentrationEffectsBySource: { cleric: 'guidance' },
    })).toBe(true)
    expect(hasGuidancePresentationEffect({
      activeEffects: [{ source: { rulesId: 'guidance' } }],
    })).toBe(true)
    expect(hasGuidancePresentationEffect(undefined)).toBe(false)
  })

  it('derives Resistance manifestations and recognizes its authoritative duration marker', () => {
    expect(resistancePresentationsForTargets({
      spellId: 'resistance',
      transactionId: 'resistance-tx',
      mapId: 'map',
      actorTokenId: 'cleric',
      targetTokenIds: ['fighter', 'fighter'],
    })).toEqual([{
      id: 'resistance-tx:resistance:0',
      transactionId: 'resistance-tx',
      mapId: 'map',
      sourceTokenId: 'cleric',
      targetTokenId: 'fighter',
    }])
    expect(hasResistancePresentationEffect({
      concentrationEffectsBySource: { cleric: 'resistance' },
    })).toBe(true)
    expect(hasResistancePresentationEffect({
      activeEffects: [{ source: { rulesId: 'resistance' } }],
    })).toBe(true)
    expect(hasResistancePresentationEffect(undefined)).toBe(false)
  })

  it('derives Sanctuary manifestations and recognizes its authoritative duration marker', () => {
    expect(sanctuaryPresentationsForTargets({
      spellId: 'sanctuary',
      transactionId: 'sanctuary-tx',
      mapId: 'map',
      actorTokenId: 'cleric',
      targetTokenIds: ['fighter', 'fighter'],
    })).toEqual([{
      id: 'sanctuary-tx:sanctuary:0',
      transactionId: 'sanctuary-tx',
      mapId: 'map',
      sourceTokenId: 'cleric',
      targetTokenId: 'fighter',
    }])
    expect(hasSanctuaryPresentationEffect({
      activeEffects: [{
        definitionId: 'srd-5.1:spell:sanctuary',
        source: { rulesId: 'sanctuary' },
      }],
    })).toBe(true)
    expect(hasSanctuaryPresentationEffect(undefined)).toBe(false)
  })

  it('resolves the actor who granted a persistent spell status', () => {
    expect(spellPresentationEffectSourceActorId({
      activeEffects: [{
        definitionId: 'srd-5.1:spell:sanctuary',
        source: { actorId: 'cleric-token', rulesId: 'sanctuary' },
      }],
    }, 'sanctuary')).toBe('cleric-token')
    expect(spellPresentationEffectSourceActorId({
      concentrationEffectsBySource: { 'druid-token': 'guidance' },
    }, 'guidance')).toBe('druid-token')
    expect(spellPresentationEffectSourceActorId(undefined, 'resistance')).toBeUndefined()
  })

  it('recognizes the next active-effect status markers from Headless state', () => {
    const stateFor = (spellId: string) => ({
      activeEffects: [{
        definitionId: `srd-5.1:spell:${spellId}`,
        source: { actorId: 'caster-token', rulesId: spellId },
      }],
    })
    expect(hasJumpPresentationEffect(stateFor('jump'))).toBe(true)
    expect(hasDarkvisionPresentationEffect(stateFor('darkvision'))).toBe(true)
    expect(hasSeeInvisibilityPresentationEffect(stateFor('see-invisibility'))).toBe(true)
    expect(hasWardingBondPresentationEffect(stateFor('warding-bond'))).toBe(true)
    expect(hasFlyPresentationEffect(stateFor('fly'))).toBe(true)
    expect(hasHeroismPresentationEffect(stateFor('heroism'))).toBe(true)
    expect(hasEnlargeReducePresentationEffect(stateFor('enlarge-reduce'))).toBe(true)
    expect(hasEnhanceAbilityPresentationEffect(stateFor('enhance-ability'))).toBe(true)
    expect(hasDivineFavorPresentationEffect(stateFor('divine-favor'))).toBe(true)
    expect(hasHuntersMarkPresentationEffect({
      concentrationEffectsBySource: { 'ranger-token': 'hunters-mark' },
    })).toBe(true)
    expect(hasMagicWeaponPresentationEffect(stateFor('magic-weapon'))).toBe(true)
    expect(hasFlameBladePresentationEffect(stateFor('flame-blade'))).toBe(true)
    expect(hasInvisibilityPresentationEffect(stateFor('invisibility'))).toBe(true)
    expect(hasBlurPresentationEffect(stateFor('blur'))).toBe(true)
    expect(hasBarkskinPresentationEffect(stateFor('barkskin'))).toBe(true)
    expect(hasProtectionFromPoisonPresentationEffect(stateFor('protection-from-poison'))).toBe(true)
    expect(hasLongstriderPresentationEffect(stateFor('longstrider'))).toBe(true)
    expect(hasProtectionFromEnergyPresentationEffect(stateFor('protection-from-energy'))).toBe(true)
    expect(hasDeathWardPresentationEffect(stateFor('death-ward'))).toBe(true)
    expect(hasGreaterInvisibilityPresentationEffect(stateFor('greater-invisibility'))).toBe(true)
    expect(hasCharmPersonPresentationEffect(stateFor('charm-person'))).toBe(true)
    expect(hasHideousLaughterPresentationEffect(stateFor('hideous-laughter'))).toBe(true)
    expect(hasHoldPersonPresentationEffect(stateFor('hold-person'))).toBe(true)
    expect(hasBlindnessDeafnessPresentationEffect(stateFor('blindness-deafness'))).toBe(true)
    expect(spellPresentationEffectSourceActorId({
      concentrationEffectsBySource: { 'ranger-token': 'hunters-mark' },
    }, 'hunters-mark')).toBe('ranger-token')
    expect(spellPresentationEffectSourceActorId(
      stateFor('warding-bond'),
      'warding-bond',
    )).toBe('caster-token')
    expect(hasJumpPresentationEffect(undefined)).toBe(false)
  })

  it('derives Fireball presentation from the Host-validated area anchor', () => {
    expect(fireballPresentationForSettlement({
      spellId: 'fireball',
      transactionId: 'fireball-tx',
      mapId: 'map',
      actorTokenId: 'wizard',
      areaAnchorCell: { col: 7, row: 4 },
      radiusFeet: 20,
    })).toEqual({
      id: 'fireball-tx:fireball',
      transactionId: 'fireball-tx',
      mapId: 'map',
      sourceTokenId: 'wizard',
      targetCell: { col: 7, row: 4 },
      radiusFeet: 20,
    })
    expect(fireballPresentationForSettlement({
      spellId: 'fireball',
      transactionId: 'bad',
      mapId: 'map',
      actorTokenId: 'wizard',
    })).toBeNull()
  })

  it('projects action economy and changed persistent layers from a settlement', () => {
    expect(spellSettlementSpentTurnResource([
      { type: 'turn-resource-spent', actorId: 'wizard', resource: 'bonusAction' },
    ])).toBe('bonusAction')
    const before = {
      id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [],
    }
    expect(spellSettlementMapLayerChanges(before, {
      ...before,
      dnd5ePluginAreas: [{
        id: 'area', pluginId: 'srd', featureId: 'spell', label: '区域', color: '#fff',
        sourceCharacterId: 'wizard', sourceTokenId: 'wizard-token', cells: [{ col: 1, row: 1 }],
        createdRound: 1, expiresAfterRound: 2,
      }],
    })).toEqual({ areasChanged: true, effectTokensChanged: false })
  })

  it('merges only the spell area delta and preserves concurrently-created areas', () => {
    const before = {
      id: 'map', name: 'Map', width: 100, height: 100, gridSize: 10,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [],
      dnd5ePluginAreas: [{
        id: 'spiritual-weapon', pluginId: 'srd-5.1', featureId: 'srd-5.1:spell:spiritual-weapon',
        sourceKind: 'core-spell' as const, coreSpellId: 'spiritual-weapon',
        sourceCharacterId: 'cleric', sourceTokenId: 'cleric-token',
        label: '灵体武器', color: '#c4b5fd', cells: [{ col: 1, row: 1 }],
        anchorCell: { col: 1, row: 1 }, createdRound: 1, expiresAfterRound: 11,
      }],
    }
    const moved = {
      ...before,
      dnd5ePluginAreas: [{
        ...before.dnd5ePluginAreas[0],
        cells: [{ col: 3, row: 1 }],
        anchorCell: { col: 3, row: 1 },
      }],
    }
    const concurrent = {
      ...before.dnd5ePluginAreas[0],
      id: 'concurrent-area',
      coreSpellId: 'grease',
    }
    const current = { ...before, dnd5ePluginAreas: [...before.dnd5ePluginAreas, concurrent] }
    expect(mergeDnd5eSpellAreaDelta({ currentMap: current, beforeMap: before, afterMap: moved }))
      .toEqual([
        expect.objectContaining({ id: 'spiritual-weapon', anchorCell: { col: 3, row: 1 } }),
        concurrent,
      ])
  })

  it('removes only spell-created magical darkness touched by Sunburst and ends its concentration', () => {
    const darknessCharacter = {
      id: 'darkness-caster', name: 'Darkness Caster', concentrating: true, conditions: [],
      dnd5eCombatState: {
        schemaVersion: 2, concentrationSpellId: 'darkness', concentrationSpellLevel: 2,
        concentrationRoundsRemaining: 100,
        activeEffects: [{
          instanceId: 'darkness-controller', definitionId: 'srd-5.1:spell:darkness',
          source: { kind: 'spell', actorId: 'darkness-token', rulesId: 'darkness' },
          duration: { type: 'concentration', sourceActorId: 'darkness-token', concentrationId: 'darkness' },
          modifiers: {}, stacking: { mode: 'replace-by-definition' },
        }],
      },
    } as unknown as Character
    const darknessToken = {
      id: 'darkness-token', label: 'Darkness Caster', x: 25, y: 25, color: '#000', emoji: 'D', size: 1,
      type: 'player' as const, characterId: darknessCharacter.id, concentrating: true,
      dnd5eCombatState: {
        schemaVersion: 2 as const, concentrationSpellId: 'darkness', concentrationSpellLevel: 2,
        concentrationRoundsRemaining: 100,
      },
    }
    const baseArea = {
      pluginId: 'srd-5.1', featureId: 'srd-5.1:spell:darkness', sourceKind: 'core-spell' as const,
      coreSpellId: 'darkness', slotLevel: 2, label: '黑暗术', color: '#000',
      sourceCharacterId: darknessCharacter.id, sourceTokenId: darknessToken.id,
      createdRound: 1, expiresAfterRound: 101, concentrationId: 'darkness',
      lighting: { kind: 'magical-darkness' as const, radiusFeet: 15, spellLevel: 2 },
    }
    const map = {
      id: 'sunburst-map', name: 'Sunburst', width: 1000, height: 1000, gridSize: 20,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [darknessToken],
      dnd5ePluginAreas: [
        { ...baseArea, id: 'near-spell-darkness', cells: [{ col: 12, row: 0 }], anchorCell: { col: 12, row: 0 } },
        { ...baseArea, id: 'far-spell-darkness', cells: [{ col: 20, row: 0 }], anchorCell: { col: 20, row: 0 } },
        {
          ...baseArea, id: 'near-feature-darkness', sourceKind: 'plugin-feature' as const,
          cells: [{ col: 1, row: 0 }], anchorCell: { col: 1, row: 0 },
        },
      ],
    }

    const settled = settleSunburstSpellDarknessDispels({
      map, characters: [darknessCharacter], anchorCell: { col: 0, row: 0 }, radiusFeet: 60,
    })

    expect(settled.removedAreaIds).toEqual(['near-spell-darkness'])
    expect(settled.map.dnd5ePluginAreas?.map((area) => area.id)).toEqual([
      'far-spell-darkness', 'near-feature-darkness',
    ])
    expect(settled.characters[0]).toMatchObject({ concentrating: false })
    expect(settled.characters[0]?.dnd5eCombatState).not.toHaveProperty('concentrationSpellId')
    expect(settled.characters[0]?.dnd5eCombatState).toHaveProperty('activeEffects', undefined)
    expect(settled.map.tokens[0]).toMatchObject({ concentrating: false })
    expect(settled.map.tokens[0]?.dnd5eCombatState).not.toHaveProperty('concentrationSpellId')
    expect(settled.changedCharacterIds).toEqual(['darkness-caster'])
    expect(settled.changedTokenIds).toEqual(['darkness-token'])
  })
})
