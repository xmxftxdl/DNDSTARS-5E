import { effectiveDnd5eActiveEffects, type Dnd5eActiveEffectInstance } from './activeEffects'
import { dnd5eInitialSpaceContainsPoint } from './initialSpaceBoundary'

/** Clip existing wall-limited visibility; never reveal additional terrain. */
export function clipDnd5eInitialSpaceVision(
  polygon: readonly { x: number; y: number }[],
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
  mapId: string,
): { x: number; y: number }[] {
  let points = polygon.map(point => ({ ...point }))
  for (const effect of effectiveDnd5eActiveEffects(effects)) {
    const boundary = effect.initialSpaceBoundary
    if (!boundary) continue
    if (boundary.mapId !== mapId) return []
    for (const axis of ['x', 'y'] as const) {
      for (const sign of [-1, 1]) {
        const limit = boundary[axis] + sign * boundary.halfWidthUnits
        const input = points
        points = []
        for (let i = 0; i < input.length; i++) {
          const a = input[i], b = input[(i + 1) % input.length]
          const insideA = sign * (a[axis] - limit) <= 0
          const insideB = sign * (b[axis] - limit) <= 0
          if (insideA) points.push(a)
          if (insideA !== insideB) {
            const t = (limit - a[axis]) / (b[axis] - a[axis])
            points.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) })
          }
        }
      }
    }
  }
  return points
}

/** A personal boundary limits its bearer, never observers looking at the bearer. */
export function dnd5eInitialSpaceAllowsPerception(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
  point: { mapId?: string; x: number; y: number; elevationFeet: number } | undefined,
): boolean {
  return effectiveDnd5eActiveEffects(effects).every(effect => !effect.initialSpaceBoundary ||
    !!point && typeof point.mapId === 'string' && dnd5eInitialSpaceContainsPoint(effect.initialSpaceBoundary,
      { ...point, mapId: point.mapId }))
}
