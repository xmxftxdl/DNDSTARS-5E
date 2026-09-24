import type { Token } from '../store/maps'

export function directMoveSnapshotHasArrived(input: {
  origin: { x: number; y: number }
  destination: { x: number; y: number }
  authoritative?: { x: number; y: number }
}): boolean {
  if (!input.authoritative) return true // Removed or transferred to another map.
  const same = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y) < .001
  return same(input.origin, input.destination) || !same(input.authoritative, input.origin)
}

/** Resolve visibility IDs to stored tokens so interactions never use display coordinates. */
export function authoritativeVisibleTokens<T extends { id: string }>(
  storedTokens: readonly T[], visibleTokens: readonly { id: string }[],
): T[] {
  const visibleIds = new Set(visibleTokens.map(token => token.id))
  return storedTokens.filter(token => visibleIds.has(token.id))
}

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
 * The DM may authoritatively place any unlocked Token both inside and outside
 * combat. This is an override/scene-edit gesture; rules-valid turn movement
 * still uses the click-to-move Headless transaction. A player may drag only an
 * explicitly authorized player Token, and ownership is revalidated by the DM
 * Host when the movement request is submitted.
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
 * DM placement bypasses movement blockers. Player movement also skips the
 * canvas' cheap straight-line check because the room authority validates the
 * complete path; rejecting the direct ray here would incorrectly reject a
 * legal route that turns around a wall.
 */
export function shouldValidateMapTokenMoveLocally(input: {
  isDm: boolean
  token: Pick<Token, 'id' | 'type'>
  authoritativeMovementTokenIds?: readonly string[]
}): boolean {
  if (dmTokenPlacementBypassesMovementBlockers(input)) return false
  if (input.token.type === 'player') return false
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
