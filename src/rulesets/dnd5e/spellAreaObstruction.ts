import {rectangularPrism,rectangularPrismNearestPoint} from '../../../shared/rectangular-prism.mjs'
import { cellKey, type GridCell } from '../../lib/gridCombat'
import { mapGeometryOpaqueCoverBlocked, mapGeometryLineOfEffectBlocked, mapGeometryPointInPolygon, mapGeometryTerrainElevationAtPoint, mapGeometryTokenElevation, type MapGeometryState } from '../../lib/mapGeometry'
import type { SkillAoeTargeting } from '../../lib/skillTargeting'
import type { BattleMap, Token, Dnd5ePluginArea } from '../../store/maps'
import { dnd5eAreaVerticalExtentIntersectsToken } from './verticalCombatGeometry'
import type { Dnd5eActivityTargetV1 } from './activities/dnd5eActivityContracts'

export function dnd5eAreaPlacementMatchesSurface(input: {
  target?: Dnd5eActivityTargetV1
  geometry?: MapGeometryState
  point: { x: number; y: number }
  elevationFeet?: number
}): boolean {
  if (input.target?.kind !== 'area' || input.target.placementSurface == null) return true
  const ground = mapGeometryTerrainElevationAtPoint(input.geometry, input.point)
  const elevation = input.elevationFeet ?? ground
  if (input.target.placementSurface === 'sky') {
    const geometry = input.geometry
    const localSky = geometry?.obstacles.findLast(body => body.terrainRegion === true &&
      body.skyExposure != null && mapGeometryPointInPolygon(input.point, body.points))?.skyExposure
    const open = localSky === 'open' || (localSky == null && geometry?.environment === 'outdoors' && geometry.overheadSpace !== 'confined')
    if (!geometry || !open ||
      !Number.isFinite(input.point.x) || !Number.isFinite(input.point.y) ||
      !Number.isFinite(elevation) || elevation <= ground) return false
    // A mapped roof or solid above the selected point separates it from open sky.
    return !geometry.obstacles.some(body => !body.terrainRegion &&
      (body.blocksVision || body.blocksLineOfEffect) &&
      body.baseHeightFeet + body.heightFeet > elevation &&
      mapGeometryPointInPolygon(input.point, body.points))
  }
  return Number.isFinite(elevation) && Math.abs(elevation - ground) <= 1e-4
}

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
  /** Explicit box/cylinder height from an Activity, independent of the 2D footprint. */
  heightFeet?: number
  rectangularVolume?: Dnd5ePluginArea
  propagationCover?: 'opaque-only'
  ignoresWalls?: boolean
  spreadsAroundCorners?: boolean
}) {
  const { map, geometry, area, origin, elevationFeet, ignoresWalls } = input
  const spreadsAroundCorners = input.spreadsAroundCorners === true || CORNER_SPREAD.has(input.spellId ?? '')
  const center = (cell: GridCell) => ({ x: map.gridOffsetX + (cell.col + 0.5) * map.gridSize, y: map.gridOffsetY + (cell.row + 0.5) * map.gridSize })
  const blocked = (from: { x: number; y: number }, to: { x: number; y: number }, toElevationFeet = elevationFeet) => !ignoresWalls && (input.propagationCover === 'opaque-only' ? mapGeometryOpaqueCoverBlocked : mapGeometryLineOfEffectBlocked)({ map, geometry, from, to, fromElevationFeet: propagationElevation, toElevationFeet })
  const prism=input.rectangularVolume&&rectangularPrism(map,input.rectangularVolume)
  const propagationElevation=prism?prism.center.elevationFeet:elevationFeet
  const cellSample=(cell:GridCell)=>prism?rectangularPrismNearestPoint(map,input.rectangularVolume!,{...center(cell),elevationFeet:propagationElevation})!:{...center(cell),elevationFeet}
  const visible = input.cells.filter(cell => {
    const sample=cellSample(cell)
    return !blocked(origin,sample,sample.elevationFeet)
  })
  const reachable = new Set(visible.map(cellKey))
  if (!ignoresWalls && spreadsAroundCorners && area.shape === 'circle' && visible.length < input.cells.length) {
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
      if (input.heightFeet != null && !dnd5eAreaVerticalExtentIntersectsToken({
        geometry, targetToken: target, elevationFeet, heightFeet: input.heightFeet,
      })) return false
      const targetElevation = mapGeometryTokenElevation(geometry, target)
      if (!blocked(origin, target, targetElevation)) return true
      if (!spreadsAroundCorners || area.shape !== 'circle') return false
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
