export type Dnd5eClassBorderGradientColor = 'accent' | 'glow' | 'white'

/** Palette subset required by both the spell portrait and the circular map frame. */
export interface Dnd5eClassBorderPalette {
  background: string
  backgroundDeep: string
  accent: string
  glow: string
}

export interface Dnd5eClassBorderGradientStop {
  /** SVG gradient offset, kept in the same textual form as the original artwork. */
  offset: string
  color: Dnd5eClassBorderGradientColor
  /** Omitted for the fully opaque midpoint, matching the original SVG output. */
  opacity?: string
}

/** Shared spell/class portrait border: one rotating highlight line over a coincident deep backing line. */
export const DND5E_CLASS_BORDER_GRADIENT_STOPS: readonly Dnd5eClassBorderGradientStop[] = [
  { offset: '0', color: 'accent', opacity: '.7' },
  { offset: '.2', color: 'accent', opacity: '.74' },
  { offset: '.38', color: 'glow', opacity: '.86' },
  { offset: '.5', color: 'white' },
  { offset: '.62', color: 'glow', opacity: '.86' },
  { offset: '.8', color: 'accent', opacity: '.74' },
  { offset: '1', color: 'accent', opacity: '.7' },
]

export const DND5E_CLASS_BORDER_FLOW_DURATION = '14s'
export const DND5E_CLASS_BORDER_FLOW_PERIOD_MS = 14_000
export const DND5E_CLASS_BORDER_DEEP_STROKE_WIDTH = 4.8
export const DND5E_CLASS_BORDER_TOP_STROKE_WIDTH = 3.1
export const DND5E_CLASS_BORDER_DEEP_STROKE_OPACITY = 0.82
export const DND5E_CLASS_BORDER_BLUR_STD_DEVIATION = 0.8

export function dnd5eClassBorderGradientStopColor(
  palette: Dnd5eClassBorderPalette,
  stop: Dnd5eClassBorderGradientStop,
): string {
  if (stop.color === 'white') return '#ffffff'
  return palette[stop.color]
}

/**
 * Keep independently mounted spell portraits on one global animation phase.
 * A negative CSS animation delay means remounting an icon resumes the shared
 * fourteen-second loop instead of visibly restarting from zero.
 */
export function dnd5eClassBorderFlowBegin(nowMs = Date.now()): string {
  if (!Number.isFinite(nowMs)) return '0s'
  const phaseMs = ((nowMs % DND5E_CLASS_BORDER_FLOW_PERIOD_MS) + DND5E_CLASS_BORDER_FLOW_PERIOD_MS)
    % DND5E_CLASS_BORDER_FLOW_PERIOD_MS
  if (phaseMs === 0) return '0s'
  const phaseSeconds = String(Number((phaseMs / 1_000).toFixed(3)))
  return `-${phaseSeconds}s`
}
