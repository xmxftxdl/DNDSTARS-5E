import { describe, expect, it } from 'vitest'
import {
  fireBoltPresentationForSettlement,
  spellSettlementMapLayerChanges,
  spellSettlementSpentTurnResource,
} from './spellSettlementCoordinator'

describe('SpellSettlementCoordinator', () => {
  it('derives a Fire Bolt presentation only from the authoritative attack result', () => {
    expect(fireBoltPresentationForSettlement({
      spellId: 'fire-bolt', transactionId: 'tx', mapId: 'map', actorTokenId: 'wizard',
      events: [{
        type: 'attack-resolved', actorId: 'wizard', targetId: 'goblin',
        d20: 12, total: 17, armorClass: 15, hit: true, critical: false,
      }],
    })).toEqual({
      id: 'tx:fire-bolt', transactionId: 'tx', mapId: 'map',
      sourceTokenId: 'wizard', targetTokenId: 'goblin', outcome: 'hit',
    })
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
})
