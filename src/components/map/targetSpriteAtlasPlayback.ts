export interface TargetSpriteAtlasPlaybackState {
  raw: number
  frameIndex: number
  fade: number
  spriteOpacity: number
}

export interface TargetSpriteAtlasPlaybackOptions {
  elapsedMs: number
  durationMs: number
  /**
   * Persistent effects use the cast projectile only for their entrance. Once
   * the atlas reaches a mature frame, it must remain opaque until the map area
   * overlay takes over instead of replaying the atlas' destruction frames.
   */
  holdMatureFrame?: boolean
}

const clampUnit = (value: number) => Math.max(0, Math.min(1, value))

export const TARGET_SPRITE_ATLAS_MATURE_FRAME = 8

export function targetSpriteAtlasPlaybackState({
  elapsedMs,
  durationMs,
  holdMatureFrame = false,
}: TargetSpriteAtlasPlaybackOptions): TargetSpriteAtlasPlaybackState {
  const raw = clampUnit(Math.max(0, elapsedMs) / Math.max(1, durationMs))
  if (holdMatureFrame) {
    const entranceProgress = clampUnit(raw / 0.62)
    const frameIndex = Math.min(
      TARGET_SPRITE_ATLAS_MATURE_FRAME,
      Math.floor(entranceProgress * (TARGET_SPRITE_ATLAS_MATURE_FRAME + 1)),
    )
    return {
      raw,
      frameIndex,
      fade: 1,
      spriteOpacity: clampUnit(raw / 0.055),
    }
  }

  const frameIndex = Math.min(15, Math.floor(clampUnit(raw / 0.92) * 16))
  const fade = raw < 0.84 ? 1 : clampUnit((1 - raw) / 0.16)
  return {
    raw,
    frameIndex,
    fade,
    spriteOpacity: clampUnit(raw / 0.055) * fade,
  }
}
