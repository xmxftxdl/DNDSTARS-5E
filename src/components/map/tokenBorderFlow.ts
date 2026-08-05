import {
  DND5E_CLASS_BORDER_BLUR_STD_DEVIATION,
  DND5E_CLASS_BORDER_DEEP_STROKE_OPACITY,
  DND5E_CLASS_BORDER_DEEP_STROKE_WIDTH,
  DND5E_CLASS_BORDER_FLOW_PERIOD_MS,
  DND5E_CLASS_BORDER_GRADIENT_STOPS,
  DND5E_CLASS_BORDER_TOP_STROKE_WIDTH,
  dnd5eClassBorderGradientStopColor,
  type Dnd5eClassBorderPalette,
} from '../../lib/dnd5eClassBorderVisual'

/** The map renderer updates only the full-gradient angle and Token position. */
export const TOKEN_BORDER_FLOW_FPS = 60
export const TOKEN_BORDER_FLOW_PERIOD_MS = DND5E_CLASS_BORDER_FLOW_PERIOD_MS

export type TokenBorderFlowPalette = Dnd5eClassBorderPalette

export const TOKEN_BORDER_FLOW_GRADIENT_STOPS = DND5E_CLASS_BORDER_GRADIENT_STOPS
export const TOKEN_BORDER_FLOW_BASE_OPACITY = DND5E_CLASS_BORDER_DEEP_STROKE_OPACITY

function normalizedPhase(elapsedMs: number, periodMs: number): number {
  const safeElapsed = Number.isFinite(elapsedMs) ? elapsedMs : 0
  return (((safeElapsed % periodMs) + periodMs) % periodMs) / periodMs
}

/** A complete rotation has no seam because 0 and 360 degrees are identical. */
export function tokenBorderFlowRotationDegrees(nowMs: number): number {
  return normalizedPhase(nowMs, TOKEN_BORDER_FLOW_PERIOD_MS) * 360
}

function parseHexColor(color: string): [number, number, number] {
  const value = color.trim().replace(/^#/, '')
  const expanded = value.length === 3
    ? value.split('').map((part) => `${part}${part}`).join('')
    : value
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return [167, 139, 250]
  return [
    Number.parseInt(expanded.slice(0, 2), 16),
    Number.parseInt(expanded.slice(2, 4), 16),
    Number.parseInt(expanded.slice(4, 6), 16),
  ]
}

function rgbaString(color: string, alpha: number): string {
  const [red, green, blue] = parseHexColor(color)
  return `rgba(${red}, ${green}, ${blue}, ${Number(alpha.toFixed(6))})`
}

/**
 * Resolve the exact seven colors used by the animated class-border gradient in
 * Dnd5eActionIcon. Both renderers consume the same shared stop declarations.
 */
export function tokenBorderFlowGradientColors(
  palette: TokenBorderFlowPalette,
): string[] {
  return TOKEN_BORDER_FLOW_GRADIENT_STOPS.map((stop) => (
    rgbaString(
      dnd5eClassBorderGradientStopColor(palette, stop),
      Number(stop.opacity ?? 1),
    )
  ))
}

/** Konva accepts gradient stops as alternating offset/color values. */
export function tokenBorderFlowGradientColorStops(
  palette: TokenBorderFlowPalette,
): Array<number | string> {
  const colors = tokenBorderFlowGradientColors(palette)
  return TOKEN_BORDER_FLOW_GRADIENT_STOPS.flatMap((stop, index) => [
    Number(stop.offset),
    colors[index],
  ])
}

export interface TokenBorderFlowWorldMetrics {
  baseStrokeWidth: number
  flowStrokeWidth: number
  glowBlur: number
}

/**
 * Dnd5eActionIcon is authored in an 80x80 viewBox. Scaling those exact 4.8,
 * 3.1 and .8 measurements by the Token diameter preserves the portrait frame
 * proportions at every map zoom instead of pinning a thick ring to the screen.
 */
export function tokenBorderFlowWorldMetrics(tokenRadius: number): TokenBorderFlowWorldMetrics {
  const safeRadius = Number.isFinite(tokenRadius) && tokenRadius > 0 ? tokenRadius : 24
  const viewBoxScale = (safeRadius * 2) / 80
  return {
    baseStrokeWidth: DND5E_CLASS_BORDER_DEEP_STROKE_WIDTH * viewBoxScale,
    flowStrokeWidth: DND5E_CLASS_BORDER_TOP_STROKE_WIDTH * viewBoxScale,
    glowBlur: DND5E_CLASS_BORDER_BLUR_STD_DEVIATION * viewBoxScale,
  }
}

export function tokenBorderFallbackPalette(color: string): TokenBorderFlowPalette {
  return {
    background: color,
    backgroundDeep: '#0f172a',
    accent: color,
    glow: color,
  }
}
