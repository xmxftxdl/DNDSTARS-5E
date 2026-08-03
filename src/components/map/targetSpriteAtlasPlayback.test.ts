import { describe, expect, it } from 'vitest'
import {
  TARGET_SPRITE_ATLAS_MATURE_FRAME,
  targetSpriteAtlasPlaybackState,
} from './targetSpriteAtlasPlayback'

describe('targetSpriteAtlasPlaybackState', () => {
  it('keeps a persistent spell fully visible on its mature frame through handoff', () => {
    const durationMs = 2_100
    const handoff = targetSpriteAtlasPlaybackState({
      elapsedMs: 1_300,
      durationMs,
      holdMatureFrame: true,
    })
    const late = targetSpriteAtlasPlaybackState({
      elapsedMs: durationMs * 0.9,
      durationMs,
      holdMatureFrame: true,
    })
    const finished = targetSpriteAtlasPlaybackState({
      elapsedMs: durationMs,
      durationMs,
      holdMatureFrame: true,
    })

    expect(handoff).toMatchObject({
      frameIndex: TARGET_SPRITE_ATLAS_MATURE_FRAME,
      fade: 1,
      spriteOpacity: 1,
    })
    expect(late).toMatchObject({
      frameIndex: TARGET_SPRITE_ATLAS_MATURE_FRAME,
      fade: 1,
      spriteOpacity: 1,
    })
    expect(finished).toMatchObject({
      frameIndex: TARGET_SPRITE_ATLAS_MATURE_FRAME,
      fade: 1,
      spriteOpacity: 1,
    })
  })

  it('retains the original destruction-frame fade for one-shot effects', () => {
    const late = targetSpriteAtlasPlaybackState({ elapsedMs: 900, durationMs: 1_000 })
    const finished = targetSpriteAtlasPlaybackState({ elapsedMs: 1_000, durationMs: 1_000 })

    expect(late.frameIndex).toBeGreaterThan(TARGET_SPRITE_ATLAS_MATURE_FRAME)
    expect(late.fade).toBeGreaterThan(0)
    expect(late.fade).toBeLessThan(1)
    expect(finished).toMatchObject({ frameIndex: 15, fade: 0, spriteOpacity: 0 })
  })
})
