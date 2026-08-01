import type { Token } from '../store/maps'

export interface MapTokenDragPolicyInput {
  isDm: boolean
  combatActive: boolean
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
 * Outside combat the DM can freely place any unlocked Token. During combat an
 * enemy Token is never draggable: the current manually controlled monster
 * moves through the click-to-move Headless transaction, and every other
 * monster must stay immobile until its own turn. A player may drag only an
 * explicitly authorized player Token; ownership is still revalidated by the
 * DM Host when the movement request is submitted.
 */
export function canDragMapToken(input: MapTokenDragPolicyInput): boolean {
  if (input.combatActive && input.token.type === 'enemy') return false
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
 * A direct DM drag is an authoritative placement operation, not a creature
 * movement attempt. It may cross walls, closed doors and terrain height steps
 * for every Token type. Player-authored movement never receives this bypass.
 *
 * Turn movement does not enter this drag pipeline. Click-to-move is submitted
 * separately to the Headless transaction, which validates the complete path
 * and movement economy on the DM authority host.
 */
export function dmTokenPlacementBypassesMovementBlockers(input: {
  isDm: boolean
  token: Pick<Token, 'type'>
}): boolean {
  return input.isDm
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
  if (dmTokenPlacementBypassesMovementBlockers(input)) return false
  return input.authoritativeMovementTokenIds?.includes(input.token.id) !== true
}

export function shouldReleaseOptimisticTokenMovePreview(input: {
  dragActive?: boolean
  requestPending: boolean
  authoritative?: { x: number; y: number }
  preview: { x: number; y: number }
  tolerance?: number
}): boolean {
  // The authoritative map can reach the target before the ACK transaction is
  // complete. Releasing here exposes the mover to an older queued snapshot or
  // replays the authority animation from its origin. Hold until ACK/rejection
  // clears the pending request, then reconcile exactly once.
  return !input.dragActive && !input.requestPending
}

export function resolveOptimisticTokenMovePreview(input: {
  dragActive?: boolean
  requestPending: boolean
  authoritative?: {
    x: number
    y: number
    movementAnimation?: { id: string }
  }
  preview: { x: number; y: number }
  tolerance?: number
}): {
  release: boolean
  suppressMovementAnimationId?: string
} {
  const release = shouldReleaseOptimisticTokenMovePreview(input)
  if (!release) return { release: false }
  const movementAnimationId = input.authoritative?.movementAnimation?.id
  return movementAnimationId
    ? { release: true, suppressMovementAnimationId: movementAnimationId }
    : { release: true }
}
