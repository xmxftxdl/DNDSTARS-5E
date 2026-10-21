import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { cellKey, cellToPixel, mapCellExtent, tokenOccupiedCellsAt, tokenFootprintDistanceCells, type GridCell } from '../../lib/gridCombat'
import { mapGeometryLineOfEffectBlocked, mapGeometryPlacementBlocked, mapGeometryRuntimeForMap } from '../../lib/mapGeometry'
import { applyDnd5eInventoryExchange, type Dnd5eInventoryExchangePolicy } from './inventoryExchange'
import { dnd5eInventoryHasAuthorityGrantReceipt, dnd5eInventoryItemTemplate } from './items'

/** Atomic map+inventory staging. Authorization, ritual completion and final publication belong to the caller. */
export function settleDnd5eInventoryExchangeOnMap(input: {
  map: BattleMap; characters: readonly Character[]; actorTokenId: string; targetCell: GridCell
  exchange: Parameters<typeof applyDnd5eInventoryExchange>[1]
  policy: Dnd5eInventoryExchangePolicy
  rangeFeet: number
}): { ok: true; map: BattleMap; characters: readonly Character[]; deduplicated?: boolean } | { ok: false } {
  const { map, targetCell, exchange } = input
  const receiptId = `exchange:${exchange.receiptId}`
  // A removed/picked-up object must never be recreated by a repeated command.
  if (dnd5eInventoryHasAuthorityGrantReceipt(input.characters, receiptId)) return { ok: true, map, characters: input.characters, deduplicated: true }
  const actor = map.tokens.find(token => token.id === input.actorTokenId)
  const template = dnd5eInventoryItemTemplate(exchange.output.templateId)
  if (!actor || actor.characterId !== exchange.characterId || !template ||
    !Number.isSafeInteger(targetCell.col) || !Number.isSafeInteger(targetCell.row) ||
    !Number.isFinite(input.rangeFeet) || input.rangeFeet < 0 || input.rangeFeet > 100000) return { ok: false }
  const point = cellToPixel(targetCell, map)
  // One-cell marker represents the item; this does not invent its physical dimensions or hit points.
  const created: Token = { id: crypto.randomUUID(), label: template.name, type: 'obstacle', color: '#b8945c', emoji: '📦',
    size: 1, ...point, dnd5eObjectState: { schemaVersion: 1, magical: false,
      inventoryItem: { ...exchange.output, receiptId } } }
  const extent = mapCellExtent(map)
  if (targetCell.col < 0 || targetCell.row < 0 || targetCell.col >= extent.cols || targetCell.row >= extent.rows ||
    tokenFootprintDistanceCells(actor, created, map) * (map.feetPerCell ?? 5) > input.rangeFeet) return { ok: false }
  if (map.tokens.some(token => tokenOccupiedCellsAt(token, map, token).some(cell => cellKey(cell) === cellKey(targetCell))) ||
    mapGeometryPlacementBlocked({ map, geometry: mapGeometryRuntimeForMap(map.id), token: created, at: point }).blocked ||
    mapGeometryLineOfEffectBlocked({ map, geometry: mapGeometryRuntimeForMap(map.id), from: actor, to: point })) return { ok: false }
  const result = applyDnd5eInventoryExchange(input.characters, exchange, input.policy, { destination: 'scene' })
  if (!result.ok || !result.sceneItem) return { ok: false }
  return { ok: true, map: { ...map, tokens: [...map.tokens, created] }, characters: result.characters }
}
