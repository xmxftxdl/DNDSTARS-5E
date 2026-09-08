import {
  tokenMovementAnimationPosition,
  type TokenMovementAnimation,
} from '../../lib/tokenMovementAnimation'

/** Shared atlas contract for the one-shot manifestation and attached hand. */
export const CHILL_TOUCH_SEQUENCE_ASSET_URL =
  '/assets/vfx/sequence-chill-touch-sprite-v1.webp'

/** Closed-hand atlas frames: the hand remains visibly clasped around its target. */
export const CHILL_TOUCH_PERSISTENT_FRAMES = [9, 10, 11, 10] as const

export const CHILL_TOUCH_PERSISTENT_INITIAL_FRAME = 10

/** Keep the attached hand readable without covering the target portrait. */
export const CHILL_TOUCH_PERSISTENT_DIAMETER_FACTOR = 2.05

export function chillTouchPersistentPosition(input: {
  x: number
  y: number
  movementAnimation?: TokenMovementAnimation
  now: number
}): { x: number; y: number } {
  if (!input.movementAnimation) return { x: input.x, y: input.y }
  return tokenMovementAnimationPosition(
    input.movementAnimation,
    input.now - input.movementAnimation.issuedAt,
  ) ?? { x: input.x, y: input.y }
}
