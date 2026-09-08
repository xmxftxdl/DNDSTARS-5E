import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../store/maps'
import { validateDnd5eMerchantInteraction } from './dnd5eMerchantInteraction'

const player: Token = {
  id: 'player-token', label: '英雄', type: 'player', characterId: 'hero',
  x: 35, y: 35, size: 1, color: '#fff', emoji: '🧙',
}
const merchant: Token = {
  id: 'merchant-token', label: '商人', type: 'npc', merchantShopId: 'shop-1',
  x: 105, y: 35, size: 1, color: '#fff', emoji: '🧑',
}
const map: BattleMap = {
  id: 'map-1', name: '市集', width: 700, height: 700, gridSize: 70,
  gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
  tokens: [player, merchant],
}

describe('D&D 5e map merchant interaction', () => {
  it('accepts a bound NPC and the matching nearby player token', () => {
    expect(validateDnd5eMerchantInteraction({
      maps: [map],
      context: { mapId: map.id, merchantTokenId: merchant.id, buyerTokenId: player.id },
      shopId: 'shop-1',
      characterId: 'hero',
    })).toMatchObject({ ok: true, distanceFeet: 5 })
  })

  it('rejects remote, rebound, and impersonated purchases', () => {
    const distant = { ...map, tokens: [player, { ...merchant, x: 665 }] }
    const context = { mapId: map.id, merchantTokenId: merchant.id, buyerTokenId: player.id }
    expect(validateDnd5eMerchantInteraction({
      maps: [distant], context, shopId: 'shop-1', characterId: 'hero',
    })).toMatchObject({ ok: false, reason: 'out-of-range' })
    expect(validateDnd5eMerchantInteraction({
      maps: [map], context, shopId: 'shop-2', characterId: 'hero',
    })).toMatchObject({ ok: false, reason: 'shop-not-bound' })
    expect(validateDnd5eMerchantInteraction({
      maps: [map], context, shopId: 'shop-1', characterId: 'someone-else',
    })).toMatchObject({ ok: false, reason: 'wrong-character' })
  })
})
