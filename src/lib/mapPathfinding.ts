import {
  occupiedCells,
  tokenAnchorCellFromPixel,
  tokenCenterForAnchorCell,
  tokenOccupiedCellsAt,
  type GridCell,
} from './gridCombat'
import {
  mapGeometryObstacleAffectsElevation,
  mapGeometryMovementBlocked,
  mapGeometryPlacementBlocked,
  mapGeometryPointInPolygon,
  mapGeometrySegmentsIntersect,
  mapGeometryTerrainElevationAtPoint,
  type MapGeometryState,
} from './mapGeometry'
import type { BattleMap, Token } from '../store/maps'

export interface MapPathResult {
  points: Array<{ x: number; y: number }>
  elevationsFeet: number[]
  cells: GridCell[]
  distanceFeet: number
  movementCostFeet: number
  doorsToOpen: string[]
}

interface PathNode {
  cell: GridCell
  cost: number
  estimate: number
  elevationFeet: number
  previous?: string
}

const directions = [-1, 0, 1].flatMap((dc) => [-1, 0, 1].flatMap((dr) =>
  dc === 0 && dr === 0 ? [] : [{ dc, dr }],
))

function key(cell: GridCell) {
  return `${cell.col},${cell.row}`
}

function terrainMultiplierAtPoint(
  geometry: MapGeometryState | undefined,
  point: { x: number; y: number },
  options: { canClimb?: boolean; canSwim?: boolean; elevationFeet: number; tokenHeightFeet: number },
): number {
  let multiplier = 1
  for (const obstacle of geometry?.obstacles ?? []) {
    if (!mapGeometryPointInPolygon(point, obstacle.points)) continue
    if (!mapGeometryObstacleAffectsElevation(obstacle, options.elevationFeet, options.tokenHeightFeet)) continue
    const terrainMultiplier = Math.max(1, obstacle.terrainCostMultiplier ?? 1)
    const traversalMultiplier = obstacle.traversal === 'climb' && !options.canClimb
      ? 2
      : obstacle.traversal === 'swim' && !options.canSwim
        ? 2
        : 1
    multiplier = Math.max(multiplier, terrainMultiplier * traversalMultiplier)
  }
  return multiplier
}

export function findMapGeometryPath(input: {
  map: BattleMap
  geometry?: MapGeometryState
  token: Token
  to: { x: number; y: number }
  canClimb?: boolean
  canSwim?: boolean
  canFly?: boolean
  targetElevationFeet?: number
  maximumTerrainStepFeet?: number
  allowOpenUnlockedDoors?: boolean
  ignoreTokens?: boolean
  allowOccupiedDestination?: boolean
  maximumVisited?: number
  /** Additional difficult-terrain sources do not stack with each other. */
  additionalDifficultTerrainMultiplier?: (token: Token, position: { x: number; y: number }) => number
  /** Speed/cost modifiers stack with difficult terrain. */
  additionalSpeedCostMultiplier?: (token: Token, position: { x: number; y: number }) => number
  /** @deprecated Use the classified callbacks above; retained for extension compatibility. */
  additionalCostMultiplier?: (token: Token, position: { x: number; y: number }) => number
}): MapPathResult | undefined {
  const gridSize = Math.max(1, input.map.gridSize)
  const feetPerCell = Math.max(1, input.map.feetPerCell ?? 5)
  const columns = Math.max(1, Math.ceil(input.map.width / gridSize))
  const rows = Math.max(1, Math.ceil(input.map.height / gridSize))
  const start = tokenAnchorCellFromPixel(input.token.x, input.token.y, input.token, input.map)
  const destination = tokenAnchorCellFromPixel(input.to.x, input.to.y, input.token, input.map)
  const startElevation = Number.isFinite(input.token.elevationFeet) ? input.token.elevationFeet! : 0
  const targetElevation = Number.isFinite(input.targetElevationFeet)
    ? Math.max(-1_000, Math.min(10_000, input.targetElevationFeet!))
    : input.canFly ? startElevation : undefined
  const maximumTerrainStepFeet = Math.max(0, input.maximumTerrainStepFeet ?? 10)
  const tokenHeightFeet = Math.max(5, Math.max(1, input.token.size) * 5)
  const pathGeometry = input.allowOpenUnlockedDoors && input.geometry
    ? {
        ...input.geometry,
        doors: input.geometry.doors.map((door) => door.state === 'closed' ? { ...door, state: 'open' as const } : door),
      }
    : input.geometry
  const startPosition = tokenCenterForAnchorCell(start, input.token, input.map)
  const destinationPosition = tokenCenterForAnchorCell(destination, input.token, input.map)
  const routeDx = destinationPosition.x - startPosition.x
  const routeDy = destinationPosition.y - startPosition.y
  const routeLengthSquared = routeDx * routeDx + routeDy * routeDy
  const elevationAtPosition = (position: { x: number; y: number }, isDestination = false) => {
    if (input.canFly && targetElevation != null) {
      const progress = routeLengthSquared <= 1e-6
        ? 1
        : Math.max(0, Math.min(1, (
            (position.x - startPosition.x) * routeDx + (position.y - startPosition.y) * routeDy
          ) / routeLengthSquared))
      return startElevation + (targetElevation - startElevation) * progress
    }
    const terrainElevation = mapGeometryTerrainElevationAtPoint(pathGeometry, position)
    return isDestination && targetElevation != null ? targetElevation : terrainElevation
  }
  const occupied = input.ignoreTokens ? new Set<string>() : occupiedCells(input.map.tokens, input.map, input.token.id)
  const nodes = new Map<string, PathNode>()
  const open = new Set<string>([key(start)])
  nodes.set(key(start), { cell: start, cost: 0, estimate: 0, elevationFeet: startElevation })
  const maximumVisited = Math.max(100, input.maximumVisited ?? 20_000)
  let visited = 0

  while (open.size > 0 && visited < maximumVisited) {
    visited += 1
    const currentKey = [...open].sort((left, right) => {
      const a = nodes.get(left)!
      const b = nodes.get(right)!
      const totalCostDifference = (a.cost + a.estimate) - (b.cost + b.estimate)
      if (totalCostDifference !== 0) return totalCostDifference
      const aManhattan = Math.abs(destination.col - a.cell.col) + Math.abs(destination.row - a.cell.row)
      const bManhattan = Math.abs(destination.col - b.cell.col) + Math.abs(destination.row - b.cell.row)
      return aManhattan - bManhattan
    })[0]
    open.delete(currentKey)
    const current = nodes.get(currentKey)!
    if (current.cell.col === destination.col && current.cell.row === destination.row) {
      const cells: GridCell[] = []
      const elevationsFeet: number[] = []
      let cursor: PathNode | undefined = current
      while (cursor) {
        cells.push(cursor.cell)
        elevationsFeet.push(cursor.elevationFeet)
        cursor = cursor.previous ? nodes.get(cursor.previous) : undefined
      }
      cells.reverse()
      elevationsFeet.reverse()
      if (cells.length === 1) {
        const finalElevation = elevationAtPosition(destinationPosition, true)
        if (!input.canFly && Math.abs(finalElevation - startElevation) > maximumTerrainStepFeet) return undefined
        if (mapGeometryPlacementBlocked({
          geometry: pathGeometry,
          map: input.map,
          token: input.token,
          at: destinationPosition,
          elevationFeet: finalElevation,
        }).blocked) return undefined
        elevationsFeet[0] = finalElevation
      }
      const points = cells.map((cell) => tokenCenterForAnchorCell(cell, input.token, input.map))
      let distanceFeet = 0
      const doorsToOpen = new Set<string>()
      for (let index = 1; index < points.length; index += 1) {
        const from = points[index - 1]
        const to = points[index]
        distanceFeet += feetPerCell
        for (const door of input.geometry?.doors ?? []) {
          if (door.state === 'closed' && mapGeometrySegmentsIntersect(from, to, door.points[0], door.points[1], true)) {
            doorsToOpen.add(door.id)
          }
        }
      }
      return { points, elevationsFeet, cells, distanceFeet, movementCostFeet: Math.ceil(current.cost), doorsToOpen: [...doorsToOpen] }
    }

    const currentPosition = tokenCenterForAnchorCell(current.cell, input.token, input.map)
    directionLoop: for (const direction of directions) {
      const next = { col: current.cell.col + direction.dc, row: current.cell.row + direction.dr }
      if (next.col < 0 || next.row < 0 || next.col >= columns || next.row >= rows) continue
      const position = tokenCenterForAnchorCell(next, input.token, input.map)
      const placed = { ...input.token, ...position }
      const isDestination = next.col === destination.col && next.row === destination.row
      const nextElevation = elevationAtPosition(position, isDestination)
      if (!input.canFly && Math.abs(nextElevation - current.elevationFeet) > maximumTerrainStepFeet) continue
      if ((!isDestination || !input.allowOccupiedDestination) &&
        tokenOccupiedCellsAt(placed, input.map, placed).some((cell) => occupied.has(key(cell)))) continue
      if (mapGeometryMovementBlocked({
        geometry: pathGeometry,
        map: input.map,
        token: { ...input.token, ...currentPosition, elevationFeet: current.elevationFeet },
        to: position,
        fromElevationFeet: current.elevationFeet,
        toElevationFeet: nextElevation,
      }).blocked) continue
      if (isDestination && mapGeometryPlacementBlocked({
        geometry: pathGeometry,
        map: input.map,
        token: placed,
        at: position,
        elevationFeet: nextElevation,
      }).blocked) continue
      if (direction.dc !== 0 && direction.dr !== 0) {
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
          return tokenOccupiedCellsAt(cornerToken, input.map, cornerToken).some((cell) => occupied.has(key(cell)))
        })
        if (occupiedCorners.every(Boolean)) continue directionLoop
        for (const cornerCell of cornerCells) {
          const cornerPosition = tokenCenterForAnchorCell(cornerCell, input.token, input.map)
          const cornerElevation = elevationAtPosition(cornerPosition)
          if (!input.canFly && (
            Math.abs(cornerElevation - current.elevationFeet) > maximumTerrainStepFeet ||
            Math.abs(nextElevation - cornerElevation) > maximumTerrainStepFeet
          )) continue directionLoop
          const cornerToken = { ...input.token, ...cornerPosition, elevationFeet: cornerElevation }
          if (mapGeometryMovementBlocked({
            geometry: pathGeometry,
            map: input.map,
            token: { ...input.token, ...currentPosition, elevationFeet: current.elevationFeet },
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
          }).blocked) {
            continue directionLoop
          }
        }
      }
      const stepDistanceFeet = feetPerCell
      const difficultTerrainMultiplier = Math.max(
        terrainMultiplierAtPoint(pathGeometry, position, {
          ...input,
          elevationFeet: nextElevation,
          tokenHeightFeet,
        }),
        input.additionalDifficultTerrainMultiplier?.(input.token, position) ?? 1,
      )
      const speedCostMultiplier = Math.max(
        1,
        input.additionalSpeedCostMultiplier?.(input.token, position) ?? 1,
        input.additionalCostMultiplier?.(input.token, position) ?? 1,
      )
      const multiplier = difficultTerrainMultiplier * speedCostMultiplier
      const nextCost = current.cost + stepDistanceFeet * multiplier
      const nextKey = key(next)
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
      })
      open.add(nextKey)
    }
  }
  return undefined
}
