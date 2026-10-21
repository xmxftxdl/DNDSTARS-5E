import { mapForSolidMaterialTraversal, mapGeometryForSolidMaterialTraversal, type MapTraversableSolidMaterial } from './mapSolidMaterialTraversal'
import { mapClimbSupported } from './mapClimbing'
import {mapGeometryForEtherealTravel} from './mapEtherealGeometry'
import { mapStairWalkingEdges, type MapStairWalkingEdge } from './mapStairPaths'
import { dnd5eEntitySupportElevation } from '../rulesets/dnd5e/entitySupport'
import { createMapTokenOccupancy, mapTokenSweepBlocked } from './mapTokenOccupancy'
import {
  tokenAnchorCellFromPixel,
  tokenCenterForAnchorCell,
  tokenOccupiedCellsAt,
  type GridCell,
} from './gridCombat'
import {
  mapGeometryFootprintTerrainSamples,
  mapGeometryObstacleAffectsElevation,
  mapGeometryObstacleIsGroundSurfaceOverlay,
  mapGeometryDoorLockState,
  mapGeometryDoorOpenState,
  mapGeometryDoorPassageGapInches,
  mapGeometryMovementBlocked,
  mapGeometryPlacementBlocked,
  mapGeometryPointInPolygon,
  mapGeometrySegmentsIntersect,
  mapGeometryTerrainElevationAtPoint,
  type MapGeometryState,
  type MapGeometrySurfaceMaterial,
} from './mapGeometry'
import type { BattleMap, Token } from '../store/maps'
import { dnd5eNormalGroundTerrainAt } from '../rulesets/dnd5e/normalGroundTerrain'

/** Keep a horizontal walking route inside explicitly traversable authored terrain. */
function solidTerrainTraversalElevation(input: {
  map: BattleMap; geometry?: MapGeometryState; token: Token
  passThroughSolidMaterials?: readonly MapTraversableSolidMaterial[]
}, position: { x: number; y: number }, elevationFeet: number): number | undefined {
  if (!input.passThroughSolidMaterials?.length) return undefined
  const buried = mapGeometryFootprintTerrainSamples({ geometry: input.geometry, at: position,
    halfSizePixels: Math.max(1, input.map.gridSize * Math.max(1, input.token.size) / 2) })
    .filter(surface => elevationFeet < surface.elevationFeet - 1e-7)
  return buried.length && buried.every(({ material }) =>
    (material === 'earth' || material === 'stone') && input.passThroughSolidMaterials!.includes(material))
    ? elevationFeet : undefined
}

function solidTerrainStep(input: Parameters<typeof solidTerrainTraversalElevation>[0],
  from: { x: number; y: number }, to: { x: number; y: number }, fromHeight: number, toHeight: number): boolean {
  const lower = Math.min(fromHeight, toHeight)
  return solidTerrainTraversalElevation(input, from, lower) != null &&
    solidTerrainTraversalElevation(input, to, lower) != null
}

export interface MapPathResult {
  points: Array<{ x: number; y: number }>
  elevationsFeet: number[]
  cells: GridCell[]
  distanceFeet: number
  movementCostFeet: number
  /** Preserve fractional cost for movement split at reaction checkpoints. */
  unroundedMovementCostFeet?: number
  doorsToOpen: string[]
}

/**
 * A single-source path search that can resolve many destinations without
 * repeating wall, token, elevation, and terrain traversal checks.
 *
 * The tree is intentionally scoped to one immutable map/token snapshot. Callers
 * must rebuild it after any token or geometry mutation.
 */
export interface MapGeometryPathTree {
  pathTo: (to: { x: number; y: number }) => MapPathResult | undefined
  visitedCells: number
  /** True when maximumVisited stopped the search before its frontier emptied. */
  truncated: boolean
}

export interface MapGeometryPathTreeInput {
  canTraverseEdge?: (from: { x: number; y: number }, to: { x: number; y: number }) => boolean
  map: BattleMap
  geometry?: MapGeometryState
  token: Token
  climbVerticalSurfaces?: boolean
  canClimb?: boolean
  canSwim?: boolean
  canFly?: boolean
  /** Fixed flight plane used by every route in this tree. */
  targetElevationFeet?: number
  maximumTerrainStepFeet?: number
  minimumPassageGapInches?: number
  allowOpenUnlockedDoors?: boolean
  ignoreTokens?: boolean
  /** Ignores walls, doors, solid obstacles and terrain surfaces on the Material Plane. */
  ignoreGeometryCollision?: boolean
  passThroughSolidMaterials?: readonly MapTraversableSolidMaterial[]
  /** Tokens whose occupied cells may be traversed but never used as a final destination. */
  passThroughTokenIds?: readonly string[]
  maximumVisited?: number
  /** Ignores difficult-terrain multipliers while retaining independent speed-cost effects. */
  ignoreDifficultTerrain?: boolean
  ignoreDifficultTerrainMaterials?: readonly MapGeometrySurfaceMaterial[]
  /** Stops expanding routes whose weighted horizontal cost exceeds this. */
  maximumMovementCostFeet?: number
  additionalDifficultTerrainMultiplier?: (token: Token, position: { x: number; y: number }) => number
  additionalSpeedCostMultiplier?: (token: Token, position: { x: number; y: number }) => number
  /** Per-foot surcharge, added to terrain cost before independent speed reduction. */
  additionalMovementCostPerFoot?: (token: Token, from: { x: number; y: number }, to: { x: number; y: number }) => number
  /** @deprecated Use the classified callbacks above; retained for extension compatibility. */
  additionalCostMultiplier?: (token: Token, position: { x: number; y: number }) => number
}

interface PathNode {
  cell: GridCell
  cost: number
  estimate: number
  elevationFeet: number
  previous?: string
  stepDistanceFeet?: number
}

function stairDirections(edges: MapStairWalkingEdge[], map: BattleMap, token: Token, position: {x:number;y:number}, elevation: number) {
  return edges.flatMap(stair => {
    const dx=stair.to.x-stair.from.x,dy=stair.to.y-stair.from.y,length=Math.hypot(dx,dy)
    // Grid-aligned flights can be authored as one long segment. Visit every crossed cell.
    if(Math.abs(dx)>1e-4 && Math.abs(dy)>1e-4 && Math.abs(Math.abs(dx)-Math.abs(dy))>1e-4)return []
    const t=((position.x-stair.from.x)*dx+(position.y-stair.from.y)*dy)/(length*length)
    if(t < -1e-7 || t>=1-1e-7 || Math.hypot(position.x-stair.from.x-dx*t,position.y-stair.from.y-dy*t)>1e-4)return []
    const expected=stair.from.elevationFeet+(stair.to.elevationFeet-stair.from.elevationFeet)*t
    if(Math.abs(expected-elevation)>1e-4)return []
    const from=tokenAnchorCellFromPixel(position.x,position.y,token,map),dc=Math.abs(dx)<1e-4?0:Math.sign(dx),dr=Math.abs(dy)<1e-4?0:Math.sign(dy)
    const center=tokenCenterForAnchorCell({col:from.col+dc,row:from.row+dr},token,map)
    const nextT=((center.x-stair.from.x)*dx+(center.y-stair.from.y)*dy)/(length*length)
    if(nextT>1+1e-7)return []
    const to={...center,elevationFeet:stair.from.elevationFeet+(stair.to.elevationFeet-stair.from.elevationFeet)*nextT}
    const distanceFeet=Math.max(map.feetPerCell??5,Math.abs(to.elevationFeet-elevation))
    return [{dc,dr,stair:{...stair,from:{...position,elevationFeet:elevation},to,distanceFeet}}]
  })
}

const directions = [-1, 0, 1].flatMap((dc) => [-1, 0, 1].flatMap((dr) =>
  dc === 0 && dr === 0 ? [] : [{ dc, dr }],
))

function key(cell: GridCell) {
  return `${cell.col},${cell.row}`
}

/** Occupancy still uses cell keys; route history must distinguish stories at the same cell. */
function nodeKey(cell: GridCell, elevationFeet: number) {
  return `${key(cell)}@${elevationFeet}`
}

function geometryWithOpenableDoors(
  geometry: MapGeometryState | undefined,
  allowOpenUnlockedDoors: boolean | undefined,
): MapGeometryState | undefined {
  return allowOpenUnlockedDoors && geometry
    ? {
        ...geometry,
        doors: geometry.doors.map((door) =>
          mapGeometryDoorOpenState(door) === 'closed' && mapGeometryDoorLockState(door) === 'unlocked'
            ? { ...door, state: 'open' as const, openState: 'open' as const }
            : door,
        ),
      }
    : geometry
}

export function terrainMultiplierAtPoint(
  geometry: MapGeometryState | undefined,
  point: { x: number; y: number },
  options: {
    canClimb?: boolean
    canSwim?: boolean
    elevationFeet: number
    tokenHeightFeet: number
    ignoreDifficultTerrain?: boolean
    ignoreDifficultTerrainMaterials?: readonly MapGeometrySurfaceMaterial[]
    map?: BattleMap
    token?: Token
  },
): number {
  let multiplier = 1
  for (const obstacle of geometry?.obstacles ?? []) {
    if (!mapGeometryPointInPolygon(point, obstacle.points)) continue
    if (mapGeometryObstacleIsGroundSurfaceOverlay(obstacle)) {
      const surfaceElevation = mapGeometryTerrainElevationAtPoint(geometry, point)
      if (Math.abs(options.elevationFeet - surfaceElevation) > 1e-4) continue
    } else if (!mapGeometryObstacleAffectsElevation(obstacle, options.elevationFeet, options.tokenHeightFeet)) {
      continue
    }
    const normalizedGround = mapGeometryObstacleIsGroundSurfaceOverlay(obstacle) &&
      dnd5eNormalGroundTerrainAt(options.map, point, options.elevationFeet, options.token, geometry)
    const terrainMultiplier = (normalizedGround || options.ignoreDifficultTerrain || (obstacle.surfaceMaterial != null &&
      options.ignoreDifficultTerrainMaterials?.includes(obstacle.surfaceMaterial)))
      ? 1
      : Math.max(1, obstacle.terrainCostMultiplier ?? 1)
    const traversalMultiplier = obstacle.traversal === 'climb' && !options.canClimb
      ? 2
      : obstacle.traversal === 'swim' && !options.canSwim
        ? 2
        : 1
    multiplier = Math.max(multiplier, terrainMultiplier * traversalMultiplier)
  }
  return multiplier
}

function standingSurfaceElevation(map: BattleMap, geometry: MapGeometryState | undefined, token: Token, position: { x: number; y: number }, ignoreEntities?: boolean) {
  const terrain = mapGeometryTerrainElevationAtPoint(geometry, position)
  return ignoreEntities ? terrain : dnd5eEntitySupportElevation({ map, geometry, token: { ...token, ...position },
    terrainElevationFeet: terrain, elevationFeet: Math.max(terrain, token.elevationFeet ?? terrain) })
}

export function findMapGeometryPath(input: {
  canTraverseEdge?: (from: { x: number; y: number }, to: { x: number; y: number }) => boolean
  map: BattleMap
  geometry?: MapGeometryState
  token: Token
  to: { x: number; y: number }
  climbVerticalSurfaces?: boolean
  canClimb?: boolean
  canSwim?: boolean
  canFly?: boolean
  targetElevationFeet?: number
  maximumTerrainStepFeet?: number
  minimumPassageGapInches?: number
  allowOpenUnlockedDoors?: boolean
  ignoreTokens?: boolean
  /** Ignores walls, doors, solid obstacles and terrain surfaces on the Material Plane. */
  ignoreGeometryCollision?: boolean
  passThroughSolidMaterials?: readonly MapTraversableSolidMaterial[]
  /** Tokens whose occupied cells may be traversed but never used as a final destination. */
  passThroughTokenIds?: readonly string[]
  allowOccupiedDestination?: boolean
  maximumVisited?: number
  /** Ignores difficult-terrain multipliers while retaining independent speed-cost effects. */
  ignoreDifficultTerrain?: boolean
  ignoreDifficultTerrainMaterials?: readonly MapGeometrySurfaceMaterial[]
  /** Additional difficult-terrain sources do not stack with each other. */
  additionalDifficultTerrainMultiplier?: (token: Token, position: { x: number; y: number }) => number
  /** Speed/cost modifiers stack with difficult terrain. */
  additionalSpeedCostMultiplier?: (token: Token, position: { x: number; y: number }) => number
  /** Per-foot surcharge, added to terrain cost before independent speed reduction. */
  additionalMovementCostPerFoot?: (token: Token, from: { x: number; y: number }, to: { x: number; y: number }) => number
  /** @deprecated Use the classified callbacks above; retained for extension compatibility. */
  additionalCostMultiplier?: (token: Token, position: { x: number; y: number }) => number
}): MapPathResult | undefined {
  input = { ...input, map: mapForSolidMaterialTraversal(input.map, input.passThroughSolidMaterials) }
  const gridSize = Math.max(1, input.map.gridSize)
  const feetPerCell = Math.max(1, input.map.feetPerCell ?? 5)
  const columns = Math.max(1, Math.ceil(input.map.width / gridSize))
  const rows = Math.max(1, Math.ceil(input.map.height / gridSize))
  const start = tokenAnchorCellFromPixel(input.token.x, input.token.y, input.token, input.map)
  const destination = tokenAnchorCellFromPixel(input.to.x, input.to.y, input.token, input.map)
  const pathGeometry = input.ignoreGeometryCollision
    ? mapGeometryForEtherealTravel(input.geometry)
    : geometryWithOpenableDoors(mapGeometryForSolidMaterialTraversal(input.geometry, input.passThroughSolidMaterials), input.allowOpenUnlockedDoors)
  const startPosition = tokenCenterForAnchorCell(start, input.token, input.map)
  const destinationPosition = tokenCenterForAnchorCell(destination, input.token, input.map)
  const startTerrainElevation = standingSurfaceElevation(input.map, pathGeometry, input.token, startPosition, input.ignoreGeometryCollision)
  const storedStartElevation = Number.isFinite(input.token.elevationFeet)
    ? Math.max(-1_000, Math.min(10_000, input.token.elevationFeet!))
    : startTerrainElevation
  const startElevation = input.ignoreGeometryCollision
    ? storedStartElevation
    : Math.max(startTerrainElevation, storedStartElevation)
  const targetElevation = Number.isFinite(input.targetElevationFeet)
    ? Math.max(-1_000, Math.min(10_000, input.targetElevationFeet!))
    : input.canFly ? startElevation : undefined
  if (targetElevation != null && targetElevation < mapGeometryTerrainElevationAtPoint(input.geometry, destinationPosition) - 1e-7 &&
    !input.ignoreGeometryCollision && solidTerrainTraversalElevation(input, destinationPosition, targetElevation) == null) return undefined
  const maximumTerrainStepFeet = Math.max(0, input.maximumTerrainStepFeet ?? 10)
  const tokenHeightFeet = Math.max(5, Math.max(1, input.token.size) * 5)
  const stairs = input.ignoreGeometryCollision ? [] : mapStairWalkingEdges(input.map,pathGeometry,input.token.size*feetPerCell)
  const elevationAtPosition = (position: { x: number; y: number }, isDestination = false, currentElevation = startElevation) => {
    if (input.canFly && targetElevation != null) {
      // 三维移动采用明确顺序：先在起点升降至声明高度，再水平飞行。
      // 这样同一条移动不会因拆成“升高 + 平移”而得到不同的墙体碰撞结果。
      return targetElevation
    }
    const terrainElevation = standingSurfaceElevation(input.map, pathGeometry, stairs.length ? {...input.token,elevationFeet:currentElevation} : input.token, position, input.ignoreGeometryCollision)
    const solidElevation = !input.climbVerticalSurfaces
      ? solidTerrainTraversalElevation(input, position, targetElevation ?? startElevation) : undefined
    if (solidElevation != null) return solidElevation
    if (input.climbVerticalSurfaces && targetElevation != null) {
      const height = Math.max(terrainElevation, targetElevation)
      // Approach a cliff on the ground before climbing; do not project its
      // destination height over unsupported ground along the entire route.
      return isDestination || mapClimbSupported(pathGeometry, input.map, input.token, position, position, height, height)
        ? height : terrainElevation
    }
    return isDestination && targetElevation != null ? targetElevation : terrainElevation
  }
  const occupied = createMapTokenOccupancy(input.map, input.geometry, input.token, input.ignoreTokens)
  const blockingOccupied = createMapTokenOccupancy(input.map, input.geometry, input.token,
    input.ignoreTokens, input.passThroughTokenIds)
  if ((input.canFly || input.climbVerticalSurfaces) && targetElevation != null && tokenOccupiedCellsAt(input.token, input.map, startPosition)
    .some(cell => blockingOccupied(Math.min(startElevation, targetElevation), Math.max(startElevation, targetElevation) + tokenHeightFeet).has(key(cell)))) return undefined
  const nodes = new Map<string, PathNode>()
  nodes.set(nodeKey(start, startElevation), { cell: start, cost: 0, estimate: 0, elevationFeet: startElevation })
  const open = new PathAStarOpenHeap(nodes, destination)
  open.pushOrUpdate(nodeKey(start, startElevation))
  const maximumVisited = Math.max(100, input.maximumVisited ?? 20_000)
  let visited = 0

  while (open.size > 0 && visited < maximumVisited) {
    visited += 1
    const currentKey = open.pop()!
    const current = nodes.get(currentKey)!
    if (current.cell.col === destination.col && current.cell.row === destination.row &&
      (!stairs.length || input.canFly || input.climbVerticalSurfaces || targetElevation == null || Math.abs(current.elevationFeet-targetElevation)<1e-4)) {
      const cells: GridCell[] = []
      const elevationsFeet: number[] = []
      const stepDistances: number[] = []
      let cursor: PathNode | undefined = current
      while (cursor) {
        cells.push(cursor.cell)
        elevationsFeet.push(cursor.elevationFeet)
        stepDistances.push(cursor.stepDistanceFeet??0)
        cursor = cursor.previous ? nodes.get(cursor.previous) : undefined
      }
      cells.reverse()
      elevationsFeet.reverse()
      stepDistances.reverse()
      if (cells.length === 1) {
        const finalElevation = elevationAtPosition(destinationPosition, true)
        if (input.climbVerticalSurfaces
          ? !mapClimbSupported(pathGeometry, input.map, input.token, startPosition, destinationPosition, startElevation, finalElevation)
          : !input.canFly && Math.abs(finalElevation - startElevation) > maximumTerrainStepFeet &&
            !solidTerrainStep(input, startPosition, destinationPosition, startElevation, finalElevation)) return undefined
        if (!input.allowOccupiedDestination && tokenOccupiedCellsAt(input.token, input.map, destinationPosition)
          .some(cell => occupied(finalElevation).has(key(cell)))) return undefined
        if (mapGeometryPlacementBlocked({
          geometry: pathGeometry,
          map: input.map,
          token: input.token,
          at: destinationPosition,
          elevationFeet: finalElevation,
          minimumPassageGapInches: input.minimumPassageGapInches,
        }).blocked) return undefined
        elevationsFeet[0] = finalElevation
      }
      const points = cells.map((cell) => tokenCenterForAnchorCell(cell, input.token, input.map))
      let distanceFeet = input.climbVerticalSurfaces && cells.length === 1 ? Math.abs(elevationsFeet[0] - startElevation) : 0
      const doorsToOpen = new Set<string>()
      for (let index = 1; index < points.length; index += 1) {
        const from = points[index - 1]
        const to = points[index]
        distanceFeet += stepDistances[index]
        for (const door of input.ignoreGeometryCollision ? [] : input.geometry?.doors ?? []) {
          if (
            mapGeometryDoorOpenState(door) === 'closed' &&
            mapGeometryDoorLockState(door) === 'unlocked' &&
            (input.minimumPassageGapInches == null ||
              mapGeometryDoorPassageGapInches(door) < input.minimumPassageGapInches) &&
            mapGeometrySegmentsIntersect(from, to, door.points[0], door.points[1], true)
          ) {
            doorsToOpen.add(door.id)
          }
        }
      }
      const verticalToken = { ...input.token, elevationFeet: elevationsFeet[0] }
      const verticalMultiplier = cells.length === 1 && input.climbVerticalSurfaces
        ? Math.max(
            terrainMultiplierAtPoint(pathGeometry, destinationPosition, { ...input, elevationFeet: elevationsFeet[0], tokenHeightFeet }),
            input.ignoreDifficultTerrain ? 1 : input.additionalDifficultTerrainMultiplier?.(verticalToken, destinationPosition) ?? 1,
          ) * Math.max(1, input.additionalSpeedCostMultiplier?.(verticalToken, destinationPosition) ?? 1,
            input.additionalCostMultiplier?.(verticalToken, destinationPosition) ?? 1)
        : 1
      const solidVerticalDistance = cells.length === 1 && !input.canFly && !input.climbVerticalSurfaces &&
        solidTerrainTraversalElevation(input, destinationPosition, elevationsFeet[0]) != null
        ? Math.abs(elevationsFeet[0] - startElevation) : 0
      if (solidVerticalDistance > 0) {
        if (mapGeometryMovementBlocked({ geometry: pathGeometry, map: input.map, token: input.token,
          to: destinationPosition, fromElevationFeet: startElevation, toElevationFeet: elevationsFeet[0],
          minimumPassageGapInches: input.minimumPassageGapInches }).blocked) return undefined
        distanceFeet = solidVerticalDistance
        const multiplier = Math.max(terrainMultiplierAtPoint(pathGeometry, destinationPosition,
          { ...input, elevationFeet: elevationsFeet[0], tokenHeightFeet }),
          input.ignoreDifficultTerrain ? 1 : input.additionalDifficultTerrainMultiplier?.(verticalToken, destinationPosition) ?? 1) *
          Math.max(1, input.additionalSpeedCostMultiplier?.(verticalToken, destinationPosition) ?? 1,
            input.additionalCostMultiplier?.(verticalToken, destinationPosition) ?? 1)
        const movementCostFeet = Math.ceil(solidVerticalDistance * multiplier)
        points.unshift({ ...startPosition }); cells.unshift({ ...start }); elevationsFeet.unshift(startElevation)
        return { points, elevationsFeet, cells, distanceFeet, movementCostFeet, unroundedMovementCostFeet:solidVerticalDistance*multiplier, doorsToOpen: [...doorsToOpen] }
      }
      const unroundedMovementCostFeet=current.cost + (cells.length === 1 ? distanceFeet * verticalMultiplier : 0)
      return { points, elevationsFeet, cells, distanceFeet, movementCostFeet: Math.ceil(unroundedMovementCostFeet), unroundedMovementCostFeet, doorsToOpen: [...doorsToOpen] }
    }

    const currentPosition = tokenCenterForAnchorCell(current.cell, input.token, input.map)
    const choices: {dc:number;dr:number;stair?:MapStairWalkingEdge}[]=[...directions,...stairDirections(stairs,input.map,input.token,currentPosition,current.elevationFeet)]
    directionLoop: for (const direction of choices) {
      const next = { col: current.cell.col + direction.dc, row: current.cell.row + direction.dr }
      if (next.col < 0 || next.row < 0 || next.col >= columns || next.row >= rows) continue
      const position = tokenCenterForAnchorCell(next, input.token, input.map)
      if (input.canTraverseEdge && !input.canTraverseEdge(currentPosition, position)) continue
      const placed = { ...input.token, ...position }
      const isDestination = next.col === destination.col && next.row === destination.row
      const nextElevation = direction.stair?.to.elevationFeet ?? elevationAtPosition(position, isDestination,current.elevationFeet)
      if(direction.stair && mapTokenSweepBlocked({map:input.map,geometry:pathGeometry,mover:input.token,from:currentPosition,to:position,
        fromElevationFeet:current.elevationFeet,toElevationFeet:nextElevation,ignoreTokens:input.ignoreTokens,excludedIds:input.passThroughTokenIds}))continue
      if(!direction.stair && Math.abs(nextElevation-current.elevationFeet)>1e-4 && choices.some(choice=>choice.stair && choice.dc===direction.dc && choice.dr===direction.dr && Math.abs(choice.stair.to.elevationFeet-nextElevation)<1e-4))continue
      if (!direction.stair && (input.climbVerticalSurfaces
        ? !mapClimbSupported(pathGeometry, input.map, input.token, currentPosition, position, current.elevationFeet, nextElevation)
        : !input.canFly && Math.abs(nextElevation - current.elevationFeet) > maximumTerrainStepFeet &&
          !solidTerrainStep(input, currentPosition, position, current.elevationFeet, nextElevation))) continue
      if ((!isDestination || !input.allowOccupiedDestination) &&
        tokenOccupiedCellsAt(placed, input.map, placed).some((cell) =>
          (isDestination ? occupied(nextElevation) : blockingOccupied(nextElevation)).has(key(cell)))) continue
      if (mapGeometryMovementBlocked({
        geometry: pathGeometry,
        map: input.map,
        token: { ...input.token, ...currentPosition, elevationFeet: current.elevationFeet },
        to: position,
        fromElevationFeet: current.elevationFeet,
        toElevationFeet: nextElevation,
        minimumPassageGapInches: input.minimumPassageGapInches,
      }).blocked) continue
      if (isDestination && mapGeometryPlacementBlocked({
        geometry: pathGeometry,
        map: input.map,
        token: placed,
        at: position,
        elevationFeet: nextElevation,
        minimumPassageGapInches: input.minimumPassageGapInches,
      }).blocked) continue
      if (!direction.stair && direction.dc !== 0 && direction.dr !== 0) {
        // A diagonal may not squeeze through the corner between two occupied
        // cells or wall edges. Requiring both orthogonal approaches to be open
        // also makes the preview path identical to the authoritative route.
        const cornerCells = [
          { col: current.cell.col + direction.dc, row: current.cell.row },
          { col: current.cell.col, row: current.cell.row + direction.dr },
        ]
        const occupiedCorners = cornerCells.map((cornerCell) => {
          const cornerPosition = tokenCenterForAnchorCell(cornerCell, input.token, input.map)
          const cornerToken = { ...input.token, ...cornerPosition }
          return tokenOccupiedCellsAt(cornerToken, input.map, cornerToken).some((cell) => blockingOccupied(elevationAtPosition(cornerPosition,false,current.elevationFeet)).has(key(cell)))
        })
        if (occupiedCorners.every(Boolean)) continue directionLoop
        for (const cornerCell of cornerCells) {
          const cornerPosition = tokenCenterForAnchorCell(cornerCell, input.token, input.map)
          const cornerElevation = elevationAtPosition(cornerPosition,false,current.elevationFeet)
          if (!input.canFly && !input.climbVerticalSurfaces && (
            (Math.abs(cornerElevation - current.elevationFeet) > maximumTerrainStepFeet &&
              !solidTerrainStep(input, currentPosition, cornerPosition, current.elevationFeet, cornerElevation)) ||
            (Math.abs(nextElevation - cornerElevation) > maximumTerrainStepFeet &&
              !solidTerrainStep(input, cornerPosition, position, cornerElevation, nextElevation))
          )) continue directionLoop
          if (input.climbVerticalSurfaces && (
            !mapClimbSupported(pathGeometry, input.map, input.token, currentPosition, cornerPosition, current.elevationFeet, cornerElevation) ||
            !mapClimbSupported(pathGeometry, input.map, input.token, cornerPosition, position, cornerElevation, nextElevation)
          )) continue directionLoop
          const cornerToken = { ...input.token, ...cornerPosition, elevationFeet: cornerElevation }
          if (mapGeometryMovementBlocked({
            geometry: pathGeometry,
            map: input.map,
            token: { ...input.token, ...currentPosition, elevationFeet: current.elevationFeet },
            to: cornerPosition,
            fromElevationFeet: current.elevationFeet,
            toElevationFeet: cornerElevation,
            minimumPassageGapInches: input.minimumPassageGapInches,
          }).blocked || mapGeometryMovementBlocked({
            geometry: pathGeometry,
            map: input.map,
            token: cornerToken,
            to: position,
            fromElevationFeet: cornerElevation,
            toElevationFeet: nextElevation,
            minimumPassageGapInches: input.minimumPassageGapInches,
          }).blocked) {
            continue directionLoop
          }
        }
      }
      const stepDistanceFeet = direction.stair?.distanceFeet ?? (input.climbVerticalSurfaces ? feetPerCell + Math.abs(nextElevation - current.elevationFeet)
        : solidTerrainStep(input, currentPosition, position, current.elevationFeet, nextElevation)
          ? Math.max(feetPerCell, Math.abs(nextElevation - current.elevationFeet)) : feetPerCell)
      const stepToken = { ...input.token, elevationFeet: nextElevation }
      const difficultTerrainMultiplier = Math.max(
        terrainMultiplierAtPoint(pathGeometry, position, {
          ...input,
          elevationFeet: nextElevation,
          tokenHeightFeet,
        }),
        input.ignoreDifficultTerrain
          ? 1
          : (input.additionalDifficultTerrainMultiplier?.(stepToken, position) ?? 1),
      )
      const speedCostMultiplier = Math.max(
        1,
        input.additionalSpeedCostMultiplier?.(stepToken, position) ?? 1,
        input.additionalCostMultiplier?.(stepToken, position) ?? 1,
      )
      const surcharge = Math.max(0, input.additionalMovementCostPerFoot?.(stepToken, currentPosition, position) ?? 0)
      const multiplier = (difficultTerrainMultiplier + surcharge) * speedCostMultiplier
      const nextCost = current.cost + stepDistanceFeet * multiplier
      const nextKey = nodeKey(next, nextElevation)
      const previous = nodes.get(nextKey)
      if (previous && previous.cost <= nextCost) continue
      nodes.set(nextKey, {
        cell: next,
        cost: nextCost,
        // Eight-direction grid movement costs one square per step in this ruleset,
        // so Chebyshev distance is the admissible A* heuristic.
        estimate: Math.max(Math.abs(destination.col - next.col), Math.abs(destination.row - next.row)) * feetPerCell,
        elevationFeet: nextElevation,
        previous: currentKey,
        stepDistanceFeet,
      })
      open.pushOrUpdate(nextKey)
    }
  }
  return undefined
}

interface PathQueueEntry {
  nodeKey: string
  cost: number
  order: number
}

interface PathOpenEntry {
  nodeKey: string
  order: number
}

/**
 * Indexed heap equivalent of the former stable `[...open].sort(...)` loop.
 * Updating a node keeps its Set insertion order, preserving deterministic
 * target-directed A* tie breaks while avoiding a full sort for every visit.
 */
class PathAStarOpenHeap {
  private readonly entries: PathOpenEntry[] = []
  private readonly indexes = new Map<string, number>()
  private readonly nodes: Map<string, PathNode>
  private readonly destination: GridCell
  private nextOrder = 0

  constructor(
    nodes: Map<string, PathNode>,
    destination: GridCell,
  ) {
    this.nodes = nodes
    this.destination = destination
  }

  get size() {
    return this.entries.length
  }

  pushOrUpdate(nodeKey: string) {
    const existingIndex = this.indexes.get(nodeKey)
    if (existingIndex != null) {
      this.bubbleUp(existingIndex)
      return
    }
    const entry = { nodeKey, order: this.nextOrder++ }
    this.entries.push(entry)
    const index = this.entries.length - 1
    this.indexes.set(nodeKey, index)
    this.bubbleUp(index)
  }

  pop(): string | undefined {
    const first = this.entries[0]
    if (!first) return undefined
    const tail = this.entries.pop()!
    this.indexes.delete(first.nodeKey)
    if (this.entries.length > 0) {
      this.entries[0] = tail
      this.indexes.set(tail.nodeKey, 0)
      this.bubbleDown(0)
    }
    return first.nodeKey
  }

  private bubbleUp(initialIndex: number) {
    let index = initialIndex
    const entry = this.entries[index]
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2)
      if (!this.less(entry, this.entries[parent])) break
      this.entries[index] = this.entries[parent]
      this.indexes.set(this.entries[index].nodeKey, index)
      index = parent
    }
    this.entries[index] = entry
    this.indexes.set(entry.nodeKey, index)
  }

  private bubbleDown(initialIndex: number) {
    let index = initialIndex
    const entry = this.entries[index]
    while (true) {
      const left = index * 2 + 1
      const right = left + 1
      if (left >= this.entries.length) break
      const next = right < this.entries.length &&
        this.less(this.entries[right], this.entries[left])
        ? right
        : left
      if (!this.less(this.entries[next], entry)) break
      this.entries[index] = this.entries[next]
      this.indexes.set(this.entries[index].nodeKey, index)
      index = next
    }
    this.entries[index] = entry
    this.indexes.set(entry.nodeKey, index)
  }

  private less(left: PathOpenEntry, right: PathOpenEntry) {
    const a = this.nodes.get(left.nodeKey)!
    const b = this.nodes.get(right.nodeKey)!
    const totalCostDifference =
      (a.cost + a.estimate) - (b.cost + b.estimate)
    if (totalCostDifference !== 0) return totalCostDifference < 0
    const aManhattan = Math.abs(this.destination.col - a.cell.col) +
      Math.abs(this.destination.row - a.cell.row)
    const bManhattan = Math.abs(this.destination.col - b.cell.col) +
      Math.abs(this.destination.row - b.cell.row)
    if (aManhattan !== bManhattan) return aManhattan < bManhattan
    return left.order < right.order
  }
}

class PathMinHeap {
  private readonly entries: PathQueueEntry[] = []

  get size() {
    return this.entries.length
  }

  push(entry: PathQueueEntry) {
    this.entries.push(entry)
    let index = this.entries.length - 1
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2)
      if (!this.less(entry, this.entries[parent])) break
      this.entries[index] = this.entries[parent]
      index = parent
    }
    this.entries[index] = entry
  }

  pop(): PathQueueEntry | undefined {
    const first = this.entries[0]
    const tail = this.entries.pop()
    if (!first || !tail || this.entries.length === 0) return first
    let index = 0
    while (true) {
      const left = index * 2 + 1
      const right = left + 1
      if (left >= this.entries.length) break
      const next = right < this.entries.length && this.less(this.entries[right], this.entries[left])
        ? right
        : left
      if (!this.less(this.entries[next], tail)) break
      this.entries[index] = this.entries[next]
      index = next
    }
    this.entries[index] = tail
    return first
  }

  private less(left: PathQueueEntry, right: PathQueueEntry) {
    return left.cost < right.cost ||
      (left.cost === right.cost && left.order < right.order)
  }
}

/**
 * Builds the exact weighted route tree once for callers (such as tactical AI)
 * that need to score many possible destinations from the same origin.
 */
export function createMapGeometryPathTree(
  input: MapGeometryPathTreeInput,
): MapGeometryPathTree {
  input = { ...input, map: mapForSolidMaterialTraversal(input.map, input.passThroughSolidMaterials) }
  if (input.climbVerticalSurfaces) return {
    visitedCells: 0, truncated: false,
    pathTo(to) {
      const path = findMapGeometryPath({ ...input, to })
      return path && path.movementCostFeet <= (input.maximumMovementCostFeet ?? Infinity) ? path : undefined
    },
  }
  const gridSize = Math.max(1, input.map.gridSize)
  const feetPerCell = Math.max(1, input.map.feetPerCell ?? 5)
  const columns = Math.max(1, Math.ceil(input.map.width / gridSize))
  const rows = Math.max(1, Math.ceil(input.map.height / gridSize))
  const start = tokenAnchorCellFromPixel(
    input.token.x,
    input.token.y,
    input.token,
    input.map,
  )
  const pathGeometry = input.ignoreGeometryCollision
    ? mapGeometryForEtherealTravel(input.geometry)
    : geometryWithOpenableDoors(mapGeometryForSolidMaterialTraversal(input.geometry, input.passThroughSolidMaterials), input.allowOpenUnlockedDoors)
  const startPosition = tokenCenterForAnchorCell(start, input.token, input.map)
  const startTerrainElevation = standingSurfaceElevation(input.map, pathGeometry, input.token, startPosition, input.ignoreGeometryCollision)
  const storedStartElevation = Number.isFinite(input.token.elevationFeet)
    ? Math.max(-1_000, Math.min(10_000, input.token.elevationFeet!))
    : startTerrainElevation
  const startElevation = input.ignoreGeometryCollision
    ? storedStartElevation
    : Math.max(startTerrainElevation, storedStartElevation)
  const flightElevation = input.canFly && Number.isFinite(input.targetElevationFeet)
    ? Math.max(-1_000, Math.min(10_000, input.targetElevationFeet!))
    : input.canFly ? startElevation : undefined
  const stairs = input.ignoreGeometryCollision ? [] : mapStairWalkingEdges(input.map,pathGeometry,input.token.size*feetPerCell)
  const maximumTerrainStepFeet = Math.max(
    0,
    input.maximumTerrainStepFeet ?? 10,
  )
  const maximumMovementCostFeet = Number.isFinite(input.maximumMovementCostFeet)
    ? Math.max(0, input.maximumMovementCostFeet!)
    : Number.POSITIVE_INFINITY
  const tokenHeightFeet = Math.max(5, Math.max(1, input.token.size) * 5)
  const elevationAtPosition = (position: { x: number; y: number }, currentElevation = startElevation) =>
    flightElevation ?? solidTerrainTraversalElevation(input, position, input.targetElevationFeet ?? startElevation) ??
      standingSurfaceElevation(input.map, pathGeometry, stairs.length ? {...input.token,elevationFeet:currentElevation} : input.token, position, input.ignoreGeometryCollision)
  const occupied = createMapTokenOccupancy(input.map, input.geometry, input.token, input.ignoreTokens)
  const blockingOccupied = createMapTokenOccupancy(input.map, input.geometry, input.token,
    input.ignoreTokens, input.passThroughTokenIds)
  if (input.canFly && flightElevation != null && tokenOccupiedCellsAt(input.token, input.map, startPosition)
    .some(cell => blockingOccupied(Math.min(startElevation, flightElevation), Math.max(startElevation, flightElevation) + tokenHeightFeet).has(key(cell)))) {
    return { visitedCells: 0, truncated: false, pathTo: () => undefined }
  }
  const nodes = new Map<string, PathNode>()
  const queue = new PathMinHeap()
  let queueOrder = 0
  nodes.set(nodeKey(start, startElevation), {
    cell: start,
    cost: 0,
    estimate: 0,
    elevationFeet: startElevation,
  })
  queue.push({ nodeKey: nodeKey(start, startElevation), cost: 0, order: queueOrder++ })
  const maximumVisited = Math.max(100, input.maximumVisited ?? 20_000)
  let visited = 0

  while (queue.size > 0 && visited < maximumVisited) {
    const queued = queue.pop()!
    const current = nodes.get(queued.nodeKey)
    if (!current || current.cost !== queued.cost) continue
    visited += 1
    const currentPosition = tokenCenterForAnchorCell(
      current.cell,
      input.token,
      input.map,
    )
    const choices: {dc:number;dr:number;stair?:MapStairWalkingEdge}[]=[...directions,...stairDirections(stairs,input.map,input.token,currentPosition,current.elevationFeet)]
    directionLoop: for (const direction of choices) {
      const next = {
        col: current.cell.col + direction.dc,
        row: current.cell.row + direction.dr,
      }
      if (
        next.col < 0 || next.row < 0 ||
        next.col >= columns || next.row >= rows
      ) continue
      const position = tokenCenterForAnchorCell(next, input.token, input.map)
      if (input.canTraverseEdge && !input.canTraverseEdge(currentPosition, position)) continue
      const placed = { ...input.token, ...position }
      const nextElevation = direction.stair?.to.elevationFeet ?? elevationAtPosition(position,current.elevationFeet)
      if(direction.stair && mapTokenSweepBlocked({map:input.map,geometry:pathGeometry,mover:input.token,from:currentPosition,to:position,
        fromElevationFeet:current.elevationFeet,toElevationFeet:nextElevation,ignoreTokens:input.ignoreTokens,excludedIds:input.passThroughTokenIds}))continue
      if(!direction.stair && Math.abs(nextElevation-current.elevationFeet)>1e-4 && choices.some(choice=>choice.stair && choice.dc===direction.dc && choice.dr===direction.dr && Math.abs(choice.stair.to.elevationFeet-nextElevation)<1e-4))continue
      if (
        !direction.stair && !input.canFly &&
        Math.abs(nextElevation - current.elevationFeet) > maximumTerrainStepFeet &&
        !solidTerrainStep(input, currentPosition, position, current.elevationFeet, nextElevation)
      ) continue
      if (
        tokenOccupiedCellsAt(placed, input.map, placed)
          .some((cell) => blockingOccupied(nextElevation).has(key(cell)))
      ) continue
      if (mapGeometryMovementBlocked({
        geometry: pathGeometry,
        map: input.map,
        token: {
          ...input.token,
          ...currentPosition,
          elevationFeet: current.elevationFeet,
        },
        to: position,
        fromElevationFeet: current.elevationFeet,
        toElevationFeet: nextElevation,
      }).blocked) continue
      if (!direction.stair && direction.dc !== 0 && direction.dr !== 0) {
        const cornerCells = [
          { col: current.cell.col + direction.dc, row: current.cell.row },
          { col: current.cell.col, row: current.cell.row + direction.dr },
        ]
        const occupiedCorners = cornerCells.map((cornerCell) => {
          const cornerPosition = tokenCenterForAnchorCell(
            cornerCell,
            input.token,
            input.map,
          )
          const cornerToken = { ...input.token, ...cornerPosition }
          return tokenOccupiedCellsAt(cornerToken, input.map, cornerToken)
            .some((cell) => blockingOccupied(elevationAtPosition(cornerPosition,current.elevationFeet)).has(key(cell)))
        })
        if (occupiedCorners.every(Boolean)) continue directionLoop
        for (const cornerCell of cornerCells) {
          const cornerPosition = tokenCenterForAnchorCell(
            cornerCell,
            input.token,
            input.map,
          )
          const cornerElevation = elevationAtPosition(cornerPosition,current.elevationFeet)
          if (!input.canFly && !input.climbVerticalSurfaces && (
            (Math.abs(cornerElevation - current.elevationFeet) > maximumTerrainStepFeet &&
              !solidTerrainStep(input, currentPosition, cornerPosition, current.elevationFeet, cornerElevation)) ||
            (Math.abs(nextElevation - cornerElevation) > maximumTerrainStepFeet &&
              !solidTerrainStep(input, cornerPosition, position, cornerElevation, nextElevation))
          )) continue directionLoop
          const cornerToken = {
            ...input.token,
            ...cornerPosition,
            elevationFeet: cornerElevation,
          }
          if (mapGeometryMovementBlocked({
            geometry: pathGeometry,
            map: input.map,
            token: {
              ...input.token,
              ...currentPosition,
              elevationFeet: current.elevationFeet,
            },
            to: cornerPosition,
            fromElevationFeet: current.elevationFeet,
            toElevationFeet: cornerElevation,
          }).blocked || mapGeometryMovementBlocked({
            geometry: pathGeometry,
            map: input.map,
            token: cornerToken,
            to: position,
            fromElevationFeet: cornerElevation,
            toElevationFeet: nextElevation,
          }).blocked) continue directionLoop
        }
      }
      const stepToken = { ...input.token, elevationFeet: nextElevation }
      const difficultTerrainMultiplier = Math.max(
        terrainMultiplierAtPoint(pathGeometry, position, {
          ...input,
          elevationFeet: nextElevation,
          tokenHeightFeet,
        }),
        input.ignoreDifficultTerrain
          ? 1
          : (input.additionalDifficultTerrainMultiplier?.(stepToken, position) ?? 1),
      )
      const speedCostMultiplier = Math.max(
        1,
        input.additionalSpeedCostMultiplier?.(stepToken, position) ?? 1,
        input.additionalCostMultiplier?.(stepToken, position) ?? 1,
      )
      const surcharge = Math.max(0, input.additionalMovementCostPerFoot?.(stepToken, currentPosition, position) ?? 0)
      const stepDistanceFeet = direction.stair?.distanceFeet ?? (solidTerrainStep(input, currentPosition, position, current.elevationFeet, nextElevation)
        ? Math.max(feetPerCell, Math.abs(nextElevation - current.elevationFeet)) : feetPerCell)
      const nextCost = current.cost +
        stepDistanceFeet * (difficultTerrainMultiplier + surcharge) * speedCostMultiplier
      if (nextCost > maximumMovementCostFeet + 1e-4) continue
      const nextKey = nodeKey(next, nextElevation)
      const previous = nodes.get(nextKey)
      if (previous && previous.cost <= nextCost) continue
      nodes.set(nextKey, {
        cell: next,
        cost: nextCost,
        estimate: 0,
        elevationFeet: nextElevation,
        previous: queued.nodeKey,
        stepDistanceFeet,
      })
      queue.push({ nodeKey: nextKey, cost: nextCost, order: queueOrder++ })
    }
  }

  const truncated = queue.size > 0
  const destinations = new Map<string, PathNode>()
  for (const node of nodes.values()) {
    if(stairs.length && !input.canFly && !input.climbVerticalSurfaces && input.targetElevationFeet!=null && Math.abs(node.elevationFeet-input.targetElevationFeet)>1e-4)continue
    const cellKey = key(node.cell)
    const previous = destinations.get(cellKey)
    if (!previous || node.cost < previous.cost) destinations.set(cellKey, node)
  }
  return {
    visitedCells: visited,
    truncated,
    pathTo(to) {
      const destination = tokenAnchorCellFromPixel(
        to.x,
        to.y,
        input.token,
        input.map,
      )
      const destinationNode = destinations.get(key(destination))
      if (!destinationNode) return undefined
      const destinationPosition = tokenCenterForAnchorCell(
        destination,
        input.token,
        input.map,
      )
      if (input.targetElevationFeet != null &&
        input.targetElevationFeet < mapGeometryTerrainElevationAtPoint(input.geometry, destinationPosition) - 1e-7 &&
        !input.ignoreGeometryCollision && solidTerrainTraversalElevation(input, destinationPosition, input.targetElevationFeet) == null) return undefined
      const destinationToken = { ...input.token, ...destinationPosition }
      if (tokenOccupiedCellsAt(destinationToken, input.map, destinationToken)
        .some((cell) => occupied(destinationNode.elevationFeet).has(key(cell)))) return undefined
      const cells: GridCell[] = []
      const elevationsFeet: number[] = []
      const stepDistances: number[] = []
      let cursor: PathNode | undefined = destinationNode
      while (cursor) {
        cells.push(cursor.cell)
        elevationsFeet.push(cursor.elevationFeet)
        stepDistances.push(cursor.stepDistanceFeet??0)
        cursor = cursor.previous ? nodes.get(cursor.previous) : undefined
      }
      cells.reverse()
      elevationsFeet.reverse()
      stepDistances.reverse()
      // Match findMapGeometryPath's single-cell vertical movement semantics:
      // a flyer can change elevation without changing its anchor cell.
      if (cells.length === 1 && (flightElevation != null || input.passThroughSolidMaterials?.length)) {
        elevationsFeet[0] = elevationAtPosition(destinationPosition)
      }
      const destinationElevation =
        elevationsFeet.at(-1) ?? destinationNode.elevationFeet
      if (mapGeometryPlacementBlocked({
        geometry: pathGeometry,
        map: input.map,
        token: input.token,
        at: destinationPosition,
        elevationFeet: destinationElevation,
        minimumPassageGapInches: input.minimumPassageGapInches,
      }).blocked) return undefined
      const points = cells.map((cell) =>
        tokenCenterForAnchorCell(cell, input.token, input.map))
      const doorsToOpen = new Set<string>()
      for (let index = 1; index < points.length; index += 1) {
        const from = points[index - 1]
        const target = points[index]
        for (const door of input.ignoreGeometryCollision ? [] : input.geometry?.doors ?? []) {
          if (
            mapGeometryDoorOpenState(door) === 'closed' &&
            mapGeometryDoorLockState(door) === 'unlocked' &&
            (input.minimumPassageGapInches == null ||
              mapGeometryDoorPassageGapInches(door) < input.minimumPassageGapInches) &&
            mapGeometrySegmentsIntersect(
              from,
              target,
              door.points[0],
              door.points[1],
              true,
            )
          ) doorsToOpen.add(door.id)
        }
      }
      const solidVerticalDistance = cells.length === 1 && !input.canFly &&
        solidTerrainTraversalElevation(input, destinationPosition, destinationElevation) != null
        ? Math.abs(destinationElevation - startElevation) : 0
      if (solidVerticalDistance > 0) {
        if (mapGeometryMovementBlocked({ geometry: pathGeometry,
          map: input.map, token: input.token, to: destinationPosition, fromElevationFeet: startElevation,
          toElevationFeet: destinationElevation, minimumPassageGapInches: input.minimumPassageGapInches }).blocked) return undefined
        const verticalToken = { ...input.token, elevationFeet: destinationElevation }
        const multiplier = Math.max(terrainMultiplierAtPoint(pathGeometry, destinationPosition,
          { ...input, elevationFeet: destinationElevation, tokenHeightFeet }),
          input.ignoreDifficultTerrain ? 1 : input.additionalDifficultTerrainMultiplier?.(verticalToken, destinationPosition) ?? 1) *
          Math.max(1, input.additionalSpeedCostMultiplier?.(verticalToken, destinationPosition) ?? 1,
            input.additionalCostMultiplier?.(verticalToken, destinationPosition) ?? 1)
        const movementCostFeet = Math.ceil(solidVerticalDistance * multiplier)
        if (movementCostFeet > maximumMovementCostFeet) return undefined
        points.unshift({ ...startPosition }); cells.unshift({ ...start }); elevationsFeet.unshift(startElevation)
        return { points, elevationsFeet, cells, distanceFeet: solidVerticalDistance, movementCostFeet, unroundedMovementCostFeet:solidVerticalDistance*multiplier, doorsToOpen: [...doorsToOpen] }
      }
      return {
        points,
        elevationsFeet,
        cells,
        distanceFeet: stepDistances.reduce((sum,distance)=>sum+distance,0),
        movementCostFeet: Math.ceil(destinationNode.cost),
        unroundedMovementCostFeet: destinationNode.cost,
        doorsToOpen: [...doorsToOpen],
      }
    },
  }
}
