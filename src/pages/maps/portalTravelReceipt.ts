import type { BattleMap } from '../../store/maps'
import type { Dnd5eCombatEvent } from '../../application/combat/dnd5eCombatRules'
import { mapGeometryRuntimeForMap, mapGeometryTokenElevation } from '../../lib/mapGeometry'

/** Retains Host-approved geometry before the source token is removed. */
export interface PortalTravelReceipt {
  before: BattleMap
  after: BattleMap
  event: Extract<Dnd5eCombatEvent, { type: 'moved' }>
}

/** Commit only approved travelers, keeping effects/resources from their latest source state. */
export function applyApprovedPortalTravelReceipts(maps: readonly BattleMap[], receipts: readonly PortalTravelReceipt[]): BattleMap[] {
  let next = [...maps]
  const seen = new Set<string>()
  for (const receipt of receipts) {
    const id = receipt.event.actorId
    const source = next.find(map => map.id === receipt.before.id)
    const destination = next.find(map => map.id === receipt.after.id)
    const token = source?.tokens.find(token => token.id === id)
    const arrival = receipt.after.tokens.find(token => token.id === id)
    if (!source || !destination || !token || !arrival || seen.has(id)) throw new Error('portal-approved-traveler-invalid')
    seen.add(id)
    const transferred = { ...token, x: arrival.x, y: arrival.y, elevationFeet: arrival.elevationFeet,
      movementAnimation: undefined }
    next = next.map(map => map.id === destination.id
      ? { ...map, tokens: [...map.tokens.filter(candidate => candidate.id !== id &&
        !(token.characterId && candidate.characterId === token.characterId)), transferred] }
      : map.id === source.id ? { ...map, tokens: map.tokens.filter(candidate => candidate.id !== id) } : map)
  }
  return next
}

/** Earlier travelers may already have changed HP or source-linked effects. */
export function portalSettlementSourceMap(receipt: PortalTravelReceipt, maps: readonly BattleMap[]): BattleMap {
  const live = new Map(maps.flatMap(map => map.tokens.map(token => [token.id, token] as const)))
  return { ...receipt.before, ...maps.find(map => map.id === receipt.before.id), tokens: receipt.before.tokens.flatMap(before => {
    const token = live.get(before.id)
    return token ? [{ ...token, x: before.x, y: before.y, elevationFeet: before.elevationFeet }] : []
  }) }
}

export function portalTravelReceipt(before: BattleMap, after: BattleMap, tokenId: string): PortalTravelReceipt {
  const from = before.tokens.find(token => token.id === tokenId)
  const to = after.tokens.find(token => token.id === tokenId)
  if (!from || !to) throw new Error('portal-travel-receipt-token-missing')
  return {
    before, after,
    event: {
      type: 'moved', actorId: tokenId, movementKind: 'teleport',
      fromMapId: before.id, toMapId: after.id,
      from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y },
      fromElevationFeet: mapGeometryTokenElevation(mapGeometryRuntimeForMap(before.id), from),
      toElevationFeet: mapGeometryTokenElevation(mapGeometryRuntimeForMap(after.id), to),
      // Teleportation does not consume traversed movement distance.
      distance: 0,
    },
  }
}
