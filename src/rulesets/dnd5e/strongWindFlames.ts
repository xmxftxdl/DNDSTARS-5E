import { campaignLightIsActive } from '../../lib/campaignTime'
import type { BattleMap, Dnd5ePluginArea, Token } from '../../store/maps'
import { dnd5eTokenIntersectsPersistentAreaAt } from './persistentAreaGeometry'

import { isFlameLight, isFlameProtected } from '../../../shared/flame-light-concealment.mjs'
import { STRONG_WIND_FLAME_RECEIPT_PREFIX, strongWindFlameReceiptKey } from './strongWindFlameReceipt'
export { STRONG_WIND_FLAME_RECEIPT_PREFIX } from './strongWindFlameReceipt'

function exposureKey(token: Token): string | undefined {
  const light = token.lightSource
  if (!light?.enabled || !isFlameLight(light) || !isFlameProtected(light)) return
  return strongWindFlameReceiptKey(light)
}

function exposed(map: BattleMap, area: Dnd5ePluginArea, token: Token): boolean {
  return !!(area.strongWind || (area.sourceKind === 'core-spell' && area.coreSpellId === 'gust-of-wind')) &&
    !area.excludedTargetIds?.includes(token.id) && dnd5eTokenIntersectsPersistentAreaAt(token, map, area, token)
}

/** A surviving lamp rolls once per continuous exposure, not once per render or round. */
export function reconcileStrongWindFlameReceipts(map: BattleMap): BattleMap {
  let changed = false
  const areas = map.dnd5ePluginAreas?.map(area => {
    const receipts = area.triggerReceipts?.filter(receipt => {
      if (!receipt.triggerId.startsWith(STRONG_WIND_FLAME_RECEIPT_PREFIX) || receipt.targetTokenId.startsWith('geometry-light:')) return true
      const token = map.tokens.find(t => t.id === receipt.targetTokenId)
      return !!token && (!token.lightSource || exposureKey(token) === receipt.triggerId) && exposed(map, area, token)
    })
    if (receipts?.length === area.triggerReceipts?.length) return area
    changed = true
    return { ...area, triggerReceipts: receipts }
  })
  return changed ? { ...map, dnd5ePluginAreas: areas } : map
}

export function collectStrongWindProtectedFlames(map: BattleMap, clock?: { worldMinute?: number; round?: number }) {
  return (map.dnd5ePluginAreas ?? []).flatMap(area => map.tokens.flatMap(token => {
    const key = exposureKey(token)
    if (area.modeState?.paused || (!area.permanent && (
      (clock?.worldMinute != null && area.expiresAtWorldMinute != null && clock.worldMinute >= area.expiresAtWorldMinute) ||
      (clock?.round != null && clock.round > area.expiresAfterRound))) ||
      (clock?.worldMinute != null && !campaignLightIsActive(token.lightSource, clock.worldMinute))) return []
    if (!key || !exposed(map, area, token) || area.triggerReceipts?.some(r =>
      r.triggerId === key && r.targetTokenId === token.id)) return []
    return [{ areaId: area.id, tokenId: token.id, key, areaLabel: area.label, targetName: token.label }]
  }))
}

export function settleStrongWindProtectedFlame(map: BattleMap, input: {
  areaId: string; tokenId: string; key: string; d100: number; round: number; worldMinute?: number; transactionId: string
}): BattleMap | undefined {
  if (!Number.isInteger(input.d100) || input.d100 < 1 || input.d100 > 100 ||
    !Number.isInteger(input.round) || input.round < 1 || !input.transactionId || input.transactionId.length > 400) return
  if (!collectStrongWindProtectedFlames(map, input).some(c => c.areaId === input.areaId &&
    c.tokenId === input.tokenId && c.key === input.key)) return
  const extinguished = input.d100 <= 50
  return { ...map,
    tokens: extinguished ? map.tokens.map(t => t.id === input.tokenId ? { ...t, lightSource: undefined } : t) : map.tokens,
    dnd5ePluginAreas: map.dnd5ePluginAreas?.map(area => area.id !== input.areaId ? area : {
      ...area, triggerReceipts: [...(area.triggerReceipts ?? []), {
        triggerId: input.key, targetTokenId: input.tokenId, round: input.round,
        transactionId: `wind-flame:d100=${input.d100}:${input.transactionId}`,
      }],
    }),
  }
}
