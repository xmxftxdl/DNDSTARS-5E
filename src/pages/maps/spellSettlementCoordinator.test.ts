import { describe, expect, it } from 'vitest'
import {
  fireballPresentationForSettlement,
  guidancePresentationsForTargets,
  hasGuidancePresentationEffect,
  hasResistancePresentationEffect,
  hasSanctuaryPresentationEffect,
  mergeDnd5eSpellAreaDelta,
  resistancePresentationsForTargets,
  sanctuaryPresentationsForTargets,
  spellPresentationsBeforeRoll,
  spellSettlementMapLayerChanges,
  spellSettlementSpentTurnResource,
} from './spellSettlementCoordinator'

describe('SpellSettlementCoordinator', () => {
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
