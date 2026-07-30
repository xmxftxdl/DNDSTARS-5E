import type { Token } from '../store/maps'

export interface MapTokenDragPolicyInput {
  isDm: boolean
  token: Pick<Token, 'id' | 'type'>
  playerMovableTokenIds?: readonly string[]
  measureMode: boolean
  deleteSelectMode: boolean
  gridAdjustMode: boolean
  fogEditMode: boolean
  geometryEditMode: boolean
  lockDragTokenIds: readonly string[]
}

/**
 * DM can drag any unlocked Token. A player may drag only an explicitly
 * authorized player Token; ownership is still revalidated by the DM Host when
 * the movement request is submitted.
 */
export function canDragMapToken(input: MapTokenDragPolicyInput): boolean {
  const hasDragAuthority = input.isDm || (
    input.token.type === 'player' &&
    input.playerMovableTokenIds?.includes(input.token.id) === true
  )
  return hasDragAuthority &&
    !input.measureMode &&
    !input.deleteSelectMode &&
    !input.gridAdjustMode &&
    !input.fogEditMode &&
    !input.geometryEditMode &&
    !input.lockDragTokenIds.includes(input.token.id)
}

/**
 * DM dragging a player Token is an authoritative placement operation, not a
 * creature movement attempt. It may cross walls, closed doors and terrain
 * height steps. Player-authored movement never receives this bypass.
 */
export function dmPlayerTokenPlacementBypassesMovementBlockers(input: {
  isDm: boolean
  token: Pick<Token, 'type'>
}): boolean {
  return input.isDm && input.token.type === 'player'
}

/**
 * Most canvas drags use a cheap straight-line geometry check before mutating
 * the map. An authoritative Headless movement transaction must receive the
 * request first, because it owns pathfinding, movement resources, doors,
 * opportunity attacks and terrain hazards.
 */
export function shouldValidateMapTokenMoveLocally(input: {
  isDm: boolean
  token: Pick<Token, 'id' | 'type'>
  authoritativeMovementTokenIds?: readonly string[]
}): boolean {
  if (dmPlayerTokenPlacementBypassesMovementBlockers(input)) return false
  return input.authoritativeMovementTokenIds?.includes(input.token.id) !== true
}

export function shouldReleaseOptimisticTokenMovePreview(input: {
  requestPending: boolean
  authoritative?: { x: number; y: number }
  preview: { x: number; y: number }
  tolerance?: number
}): boolean {
  if (!input.requestPending) return true
  if (!input.authoritative) return false
  return Math.hypot(
    input.authoritative.x - input.preview.x,
    input.authoritative.y - input.preview.y,
  ) < (input.tolerance ?? 0.5)
}
