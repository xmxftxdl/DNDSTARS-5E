import type { BattleMap, Token } from '../../store/maps'
import type { GridCell } from '../../lib/gridCombat'
import { cellToPixel, cellDistance, tokenOccupiedCellsAt } from '../../lib/gridCombat'
import type { MapGeometryState } from '../../lib/mapGeometry'
import { mapGeometryTerrainElevationAtPoint } from '../../lib/mapGeometry'
import { mapGeometryLineOfEffectBlocked } from '../../lib/mapGeometry'
import { dnd5eMapTokenDistanceFeet, dnd5eTokenToPointDistanceFeet } from './verticalCombatGeometry'
import { registerDnd5eHostReceipt } from './hostTransactionClone'

export interface Dnd5eCastingConstraints { maximumTargetDistanceFeet: number }
export function validDnd5eCastingConstraints(value: unknown): value is Dnd5eCastingConstraints {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const v = value as Record<string, unknown>
  return Object.keys(v).every(key => key === 'maximumTargetDistanceFeet') &&
    typeof v.maximumTargetDistanceFeet === 'number' && Number.isFinite(v.maximumTargetDistanceFeet) &&
    v.maximumTargetDistanceFeet >= 0 && v.maximumTargetDistanceFeet <= 10000
}
export interface Dnd5eCastingProximityBinding {
  requestId: string; spellId: string; activityId: string; mapId: string; actorTokenId: string
  targetTokenIds: readonly string[]; targetCell?: GridCell; targetElevationFeet?: number
  choices?: Readonly<Record<string, string>>; maximumTargetDistanceFeet: number
}
declare const receiptBrand: unique symbol
export interface Dnd5eCastingProximityReceipt { readonly [receiptBrand]: true }
const receipts = new WeakMap<Dnd5eCastingProximityReceipt, { binding: Dnd5eCastingProximityBinding; signature: string; valid: boolean }>()
function signature(binding: Dnd5eCastingProximityBinding): string {
  return JSON.stringify({ ...binding, targetTokenIds: [...binding.targetTokenIds].sort(),
    choices: Object.fromEntries(Object.entries(binding.choices ?? {}).sort(([a], [b]) => a.localeCompare(b))) })
}
export function dnd5eCastingTargetsWithinRange(binding: Dnd5eCastingProximityBinding, map: BattleMap | undefined,
  geometry?: MapGeometryState, requireLineOfEffect = false): boolean {
  if (!map || map.id !== binding.mapId || !validDnd5eCastingConstraints({ maximumTargetDistanceFeet: binding.maximumTargetDistanceFeet }) ||
    !Number.isFinite(map.gridSize) || map.gridSize <= 0 || !Number.isFinite(map.feetPerCell ?? 5) || (map.feetPerCell ?? 5) <= 0) return false
  const lookup = (id: string) => {
    const matches = map.tokens.filter(token => token.id === id)
    const token = matches.length === 1 ? matches[0] : undefined
    return token && [token.x, token.y, token.size, token.elevationFeet ?? 0].every(Number.isFinite) && token.size > 0 ? token : undefined
  }
  const actor = lookup(binding.actorTokenId)
  if (!actor || !binding.targetTokenIds.length && !binding.targetCell) return false
  const targets: Token[] = []
  for (const id of binding.targetTokenIds) {
    const target = lookup(id)
    if (!target) return false
    targets.push(target)
  }
  if (binding.targetCell) {
    if (!Number.isInteger(binding.targetCell.col) || !Number.isInteger(binding.targetCell.row) ||
      binding.targetElevationFeet != null && !Number.isFinite(binding.targetElevationFeet)) return false
    const point = cellToPixel(binding.targetCell, map)
    if (requireLineOfEffect && mapGeometryLineOfEffectBlocked({ map, geometry, from: actor, to: point,
      toElevationFeet: binding.targetElevationFeet })) return false
    const horizontal = Math.min(...tokenOccupiedCellsAt(actor, map, actor).map(cell => cellDistance(cell, binding.targetCell!))) * (map.feetPerCell ?? 5)
    const distance = dnd5eTokenToPointDistanceFeet({ token: actor, geometry, horizontalDistanceFeet: horizontal,
      pointElevationFeet: binding.targetElevationFeet ?? mapGeometryTerrainElevationAtPoint(geometry, point) })
    if (!Number.isFinite(distance) || distance > binding.maximumTargetDistanceFeet) return false
  }
  return targets.every(target => {
    if (requireLineOfEffect && mapGeometryLineOfEffectBlocked({ map, geometry, from: actor, to: target })) return false
    const distance = dnd5eMapTokenDistanceFeet({ map, geometry, left: actor, right: target })
    return Number.isFinite(distance) && distance <= binding.maximumTargetDistanceFeet
  })
}
/** Host-only, non-serializable evidence. A witnessed excursion stays invalid. */
export function captureDnd5eCastingProximity(binding: Dnd5eCastingProximityBinding, map: BattleMap,
  geometry?: MapGeometryState): Dnd5eCastingProximityReceipt | undefined {
  if (!dnd5eCastingTargetsWithinRange(binding, map, geometry)) return undefined
  const receipt = registerDnd5eHostReceipt(Object.freeze({})) as Dnd5eCastingProximityReceipt
  const captured = structuredClone(binding)
  receipts.set(receipt, { binding: captured, signature: signature(captured), valid: true })
  return receipt
}
export function observeDnd5eCastingProximity(receipt: Dnd5eCastingProximityReceipt, map: BattleMap | undefined,
  geometry?: MapGeometryState): boolean {
  const stored = receipts.get(receipt)
  if (!stored) return false
  stored.valid = stored.valid && dnd5eCastingTargetsWithinRange(stored.binding, map, geometry)
  return stored.valid
}
export function verifyDnd5eCastingProximity(receipt: Dnd5eCastingProximityReceipt | undefined,
  binding: Dnd5eCastingProximityBinding, map: BattleMap | undefined, geometry?: MapGeometryState): boolean {
  const stored = receipt ? receipts.get(receipt) : undefined
  return !!stored && stored.signature === signature(binding) && observeDnd5eCastingProximity(receipt!, map, geometry)
}
