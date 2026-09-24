import { cellKey, type GridCell } from '../../lib/gridCombat'
import { mapGeometryLineOfEffectBlocked, mapGeometryTerrainElevationAtPoint, mapGeometryTokenElevation, type MapGeometryState } from '../../lib/mapGeometry'
import type { SkillAoeTargeting } from '../../lib/skillTargeting'
import type { BattleMap, Token } from '../../store/maps'

// Explicit SRD text, not damage type, permits these effects to spread around corners.
const CORNER_SPREAD = new Set(['fireball', 'delayed-blast-fireball', 'meteor-swarm', 'fog-cloud', 'cloudkill', 'stinking-cloud', 'incendiary-cloud', 'darkness', 'insect-plague'])

export function resolveSpellAreaObstruction(input: {
  spellId?: string
  map: BattleMap
  geometry?: MapGeometryState
  cells: readonly GridCell[]
  area: SkillAoeTargeting
  origin: { x: number; y: number }
  elevationFeet: number
  ignoresWalls?: boolean
}) {
  const { map, geometry, area, origin, elevationFeet, ignoresWalls } = input
  const center = (cell: GridCell) => ({ x: map.gridOffsetX + (cell.col + 0.5) * map.gridSize, y: map.gridOffsetY + (cell.row + 0.5) * map.gridSize })
  const blocked = (from: { x: number; y: number }, to: { x: number; y: number }, toElevationFeet = elevationFeet) => !ignoresWalls && mapGeometryLineOfEffectBlocked({ map, geometry, from, to, fromElevationFeet: elevationFeet, toElevationFeet })
  const visible = input.cells.filter(cell => !blocked(origin, center(cell)))
  const reachable = new Set(visible.map(cellKey))
  if (!ignoresWalls && CORNER_SPREAD.has(input.spellId ?? '') && area.shape === 'circle' && visible.length < input.cells.length) {
    const cells = new Map(input.cells.map(cell => [cellKey(cell), cell]))
    const feetPerPixel = (map.feetPerCell ?? 5) / map.gridSize
    const costs = new Map(visible.map(cell => [cellKey(cell), Math.hypot(center(cell).x - origin.x, center(cell).y - origin.y) * feetPerPixel]))
    const queue = [...visible]
    // Bounded by the original template; every edge is checked against physical barriers.
    for (let index = 0; index < queue.length; index++) {
      const cell = queue[index]
      const cost = costs.get(cellKey(cell))!
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const key = `${cell.col + dc},${cell.row + dr}`
        const next = cells.get(key)
        const nextCost = cost + Math.hypot(dc, dr) * (map.feetPerCell ?? 5)
        if (!next || nextCost > area.radiusFeet + 1e-6 || nextCost >= (costs.get(key) ?? Infinity)) continue
        if (blocked(center(cell), center(next))) continue
        costs.set(key, nextCost)
        reachable.add(key)
        queue.push(next)
      }
    }
  }
  return {
    cells: input.cells.filter(cell => reachable.has(cellKey(cell))),
    affectsToken: (target: Token) => {
      const targetElevation = mapGeometryTokenElevation(geometry, target)
      if (!blocked(origin, target, targetElevation)) return true
      if (!CORNER_SPREAD.has(input.spellId ?? '') || area.shape !== 'circle') return false
      // Keep the last leg vertical-aware rather than treating a 2D mask as a 3D hit.
      return input.cells.some(cell => reachable.has(cellKey(cell)) &&
        Math.hypot(center(cell).x - target.x, center(cell).y - target.y) <= map.gridSize * 0.71 &&
        !blocked(center(cell), target, targetElevation))
    },
  }
}

export function spellAreaPointElevation(geometry: MapGeometryState | undefined, point: { x: number; y: number }, declared?: number) {
  return declared ?? mapGeometryTerrainElevationAtPoint(geometry, point)
}
