import { describe, expect, it } from 'vitest'
import { vfxAssetForId } from '../../lib/vfxSequence'
import {
  CHILL_TOUCH_PERSISTENT_FRAMES,
  CHILL_TOUCH_PERSISTENT_DIAMETER_FACTOR,
  CHILL_TOUCH_PERSISTENT_INITIAL_FRAME,
  CHILL_TOUCH_SEQUENCE_ASSET_URL,
  chillTouchPersistentPosition,
} from './chillTouchPersistentPresentation'

describe('chill touch persistent presentation', () => {
  it('reuses mature frames from the same atlas as the cast manifestation', () => {
    expect(CHILL_TOUCH_SEQUENCE_ASSET_URL).toBe(vfxAssetForId('target.chill-touch.v1')?.url)
    expect(CHILL_TOUCH_PERSISTENT_FRAMES).toContain(CHILL_TOUCH_PERSISTENT_INITIAL_FRAME)
    expect(CHILL_TOUCH_PERSISTENT_DIAMETER_FACTOR).toBeLessThan(2.2)
  })

  it('follows the same in-flight Token path instead of jumping to its destination', () => {
    const movementAnimation = {
      id: 'target-move',
      issuedAt: 1_000,
      durationMs: 1_000,
      points: [{ x: 100, y: 100 }, { x: 300, y: 200 }],
    }

    expect(chillTouchPersistentPosition({
      x: 300,
      y: 200,
      movementAnimation,
      now: 1_500,
    })).toEqual({ x: 200, y: 150 })
    expect(chillTouchPersistentPosition({
      x: 300,
      y: 200,
      movementAnimation,
      now: 2_000,
    })).toEqual({ x: 300, y: 200 })
  })
})
