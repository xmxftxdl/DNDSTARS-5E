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
  resistancePresentationsForTargets,
  sanctuaryPresentationsForTargets,
  spellPresentationEffectSourceActorId,
  spellPresentationsBeforeRoll,
  spellSettlementMapLayerChanges,
  spellSettlementSpentTurnResource,
} from './spellSettlementCoordinator'

describe('SpellSettlementCoordinator', () => {
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
      spellId: 'grease',
    })).toMatchObject({
      spellId: 'grease',
      shape: 'rect',
      widthFeet: 10,
      heightFeet: 10,
    })
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
      spellId: 'wall-of-fire',
    })).toMatchObject({ spellId: 'wall-of-fire', shape: 'rect', widthFeet: 60, heightFeet: 5 })
    expect(areaSpellPresentationForSettlement({
      ...common,
      spellId: 'blade-barrier',
    })).toMatchObject({ spellId: 'blade-barrier', shape: 'rect', widthFeet: 100, heightFeet: 5 })
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
})
