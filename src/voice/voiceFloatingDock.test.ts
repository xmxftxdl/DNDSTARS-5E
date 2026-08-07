import { describe, expect, it } from 'vitest'
import {
  VOICE_FLOATING_DOCK_MIN_Y,
  clampVoiceFloatingDockY,
  defaultVoiceFloatingDockY,
} from './voiceFloatingDock'

describe('voice floating dock position', () => {
  it('keeps the draggable voice icon inside the viewport', () => {
    expect(clampVoiceFloatingDockY(-100, 900)).toBe(VOICE_FLOATING_DOCK_MIN_Y)
    expect(clampVoiceFloatingDockY(10_000, 900)).toBe(832)
    expect(clampVoiceFloatingDockY(330.4, 900)).toBe(330)
  })

  it('places the initial icon near the middle-right of the screen', () => {
    expect(defaultVoiceFloatingDockY(1_000)).toBe(460)
  })
})
