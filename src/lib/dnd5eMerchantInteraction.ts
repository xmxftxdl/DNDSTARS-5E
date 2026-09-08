import { DND_FEET_PER_CELL, tokenFootprintDistanceCells } from './gridCombat'
import type { BattleMap, Token } from '../store/maps'
import type { Dnd5eShopMerchantContext } from '../rulesets/dnd5e/shops'

export const DND5E_MERCHANT_INTERACTION_RANGE_FEET = 10

export type Dnd5eMerchantInteractionContext = Dnd5eShopMerchantContext

export type Dnd5eMerchantInteractionResult =
  | {
      ok: true
      map: BattleMap
      merchant: Token
      buyer: Token
      distanceFeet: number
    }
  | {
      ok: false
      reason: 'missing-context' | 'map-not-found' | 'merchant-not-found' | 'shop-not-bound' |
        'buyer-not-found' | 'wrong-character' | 'out-of-range'
      message: string
    }

export function validateDnd5eMerchantInteraction(input: {
  maps: readonly BattleMap[]
  context?: Dnd5eMerchantInteractionContext
  shopId: string
  characterId: string
}): Dnd5eMerchantInteractionResult {
  if (!input.context) {
    return { ok: false, reason: 'missing-context', message: '玩家必须从地图上的商人 NPC 发起交易。' }
  }
  const map = input.maps.find((candidate) => candidate.id === input.context!.mapId)
  if (!map) return { ok: false, reason: 'map-not-found', message: '商人所在地图已不可用。' }
  const merchant = map.tokens.find((token) => token.id === input.context!.merchantTokenId)
  if (!merchant || merchant.type !== 'npc') {
    return { ok: false, reason: 'merchant-not-found', message: '目标 NPC 已不在地图上。' }
  }
  if (merchant.merchantShopId !== input.shopId) {
    return { ok: false, reason: 'shop-not-bound', message: '该 NPC 已不再经营这间商店。' }
  }
  const buyer = map.tokens.find((token) => token.id === input.context!.buyerTokenId)
  if (!buyer || buyer.type !== 'player') {
    return { ok: false, reason: 'buyer-not-found', message: '你的角色 Token 不在商人所在地图上。' }
  }
  if (buyer.characterId !== input.characterId) {
    return { ok: false, reason: 'wrong-character', message: '交易角色与地图 Token 不一致。' }
  }
  const distanceFeet = tokenFootprintDistanceCells(buyer, merchant, map) *
    Math.max(1, map.feetPerCell ?? DND_FEET_PER_CELL)
  if (distanceFeet > DND5E_MERCHANT_INTERACTION_RANGE_FEET) {
    return {
      ok: false,
      reason: 'out-of-range',
      message: `需要移动到商人 ${DND5E_MERCHANT_INTERACTION_RANGE_FEET} 尺内才能交易。`,
    }
  }
  return { ok: true, map, merchant, buyer, distanceFeet }
}
