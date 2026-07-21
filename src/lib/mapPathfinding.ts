import {
  occupiedCells,
  tokenAnchorCellFromPixel,
  tokenCenterForAnchorCell,
  tokenOccupiedCellsAt,
  type GridCell,
} from './gridCombat'
import {
  mapGeometryMovementBlocked,
  mapGeometryPointInPolygon,
  mapGeometrySegmentsIntersect,
  type MapGeometryState,
} from './mapGeometry'
import type { BattleMap, Token } from '../store/maps'

export interface MapPathResult {
  points: Array<{ x: number; y: number }>
  cells: GridCell[]
  distanceFeet: number
  movementCostFeet: number
  doorsToOpen: string[]
}

interface PathNode {
  cell: GridCell
  cost: number
  estimate: number
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
  options: { canClimb?: boolean; canSwim?: boolean },
): number {
  let multiplier = 1
  for (const obstacle of geometry?.obstacles ?? []) {
    if (!mapGeometryPointInPolygon(point, obstacle.points)) continue
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
  const pathGeometry = input.allowOpenUnlockedDoors && input.geometry
    ? {
        ...input.geometry,
        doors: input.geometry.doors.map((door) => door.state === 'closed' ? { ...door, state: 'open' as const } : door),
      }
    : input.geometry
  const occupied = input.ignoreTokens ? new Set<string>() : occupiedCells(input.map.tokens, input.map, input.token.id)
  const nodes = new Map<string, PathNode>()
  const open = new Set<string>([key(start)])
  nodes.set(key(start), { cell: start, cost: 0, estimate: 0 })
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
      let cursor: PathNode | undefined = current
      while (cursor) {
        cells.push(cursor.cell)
        cursor = cursor.previous ? nodes.get(cursor.previous) : undefined
      }
      cells.reverse()
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
      return { points, cells, distanceFeet, movementCostFeet: Math.ceil(current.cost), doorsToOpen: [...doorsToOpen] }
    }

    const currentPosition = tokenCenterForAnchorCell(current.cell, input.token, input.map)
    directionLoop: for (const direction of directions) {
      const next = { col: current.cell.col + direction.dc, row: current.cell.row + direction.dr }
      if (next.col < 0 || next.row < 0 || next.col >= columns || next.row >= rows) continue
      const position = tokenCenterForAnchorCell(next, input.token, input.map)
      const placed = { ...input.token, ...position }
      const isDestination = next.col === destination.col && next.row === destination.row
      if ((!isDestination || !input.allowOccupiedDestination) &&
        tokenOccupiedCellsAt(placed, input.map, placed).some((cell) => occupied.has(key(cell)))) continue
      if (mapGeometryMovementBlocked({
        geometry: pathGeometry, map: input.map, token: { ...input.token, ...currentPosition }, to: position,
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
          const cornerToken = { ...input.token, ...cornerPosition }
          if (mapGeometryMovementBlocked({
            geometry: pathGeometry,
            map: input.map,
            token: { ...input.token, ...currentPosition },
            to: cornerPosition,
          }).blocked || mapGeometryMovementBlocked({
            geometry: pathGeometry,
            map: input.map,
            token: cornerToken,
            to: position,
          }).blocked) {
            continue directionLoop
          }
        }
      }
      const stepDistanceFeet = feetPerCell
      const difficultTerrainMultiplier = Math.max(
        terrainMultiplierAtPoint(pathGeometry, position, input),
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
        previous: currentKey,
      })
      open.add(nextKey)
    }
  }
  return undefined
}
