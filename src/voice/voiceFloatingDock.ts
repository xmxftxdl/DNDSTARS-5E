export const VOICE_FLOATING_DOCK_MIN_Y = 72
export const VOICE_FLOATING_DOCK_EDGE_GAP = 16
export const VOICE_FLOATING_DOCK_SIZE = 52

export function clampVoiceFloatingDockY(value: number, viewportHeight: number): number {
  const maximum = Math.max(VOICE_FLOATING_DOCK_MIN_Y, viewportHeight - VOICE_FLOATING_DOCK_SIZE - VOICE_FLOATING_DOCK_EDGE_GAP)
  return Math.min(maximum, Math.max(VOICE_FLOATING_DOCK_MIN_Y, Math.round(value)))
}

export function defaultVoiceFloatingDockY(viewportHeight: number): number {
  return clampVoiceFloatingDockY(viewportHeight * 0.46, viewportHeight)
}
