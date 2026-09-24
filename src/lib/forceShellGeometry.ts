import type { BattleMap, Dnd5ePluginArea } from '../store/maps'

/** Intersect a segment with the actual shell, not its filled map footprint. */
export function forceShellCrosses(area: Dnd5ePluginArea,
  map: Pick<BattleMap, 'gridSize'> & Partial<Pick<BattleMap, 'gridOffsetX' | 'gridOffsetY' | 'feetPerCell'>>,
  from: { x: number; y: number }, to: { x: number; y: number }, fromZ: number, toZ: number): boolean {
  if (!area.forceShell || !area.anchorCell) return false
  const { shape, radiusFeet: r } = area.forceShell
  const scale = (map.feetPerCell ?? 5) / Math.max(1, map.gridSize)
  const cx = (map.gridOffsetX ?? 0) + (area.anchorCell.col + 0.5) * map.gridSize
  const cy = (map.gridOffsetY ?? 0) + (area.anchorCell.row + 0.5) * map.gridSize
  const base = area.vertical?.mode === 'volume' ? area.vertical.baseElevationFeet : 0
  const cz = base + (shape === 'sphere' ? r : 0)
  const a = [(from.x - cx) * scale, (from.y - cy) * scale, fromZ - cz]
  const d = [(to.x - from.x) * scale, (to.y - from.y) * scale, toZ - fromZ]
  const aa = d.reduce((sum, v) => sum + v * v, 0)
  if (aa < 1e-10) return false
  const bb = 2 * a.reduce((sum, v, i) => sum + v * d[i], 0)
  const cc = a.reduce((sum, v) => sum + v * v, 0) - r * r
  const disc = bb * bb - 4 * aa * cc
  if (disc < 0) return false
  return [(-bb - Math.sqrt(disc)) / (2 * aa), (-bb + Math.sqrt(disc)) / (2 * aa)]
    .some(t => t > 1e-6 && t <= 1 + 1e-6 && (shape === 'sphere' || a[2] + d[2] * t >= -1e-6))
}
