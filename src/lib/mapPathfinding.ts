import {
  occupiedCells,
  tokenAnchorCellFromPixel,
  tokenCenterForAnchorCell,
  tokenOccupiedCellsAt,
  type GridCell,
} from './gridCombat'
import {
  mapGeometryObstacleAffectsElevation,
  mapGeometryDoorLockState,
  mapGeometryDoorOpenState,
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
  map: BattleMap
  geometry?: MapGeometryState
  token: Token
  canClimb?: boolean
  canSwim?: boolean
  canFly?: boolean
  /** Fixed flight plane used by every route in this tree. */
  targetElevationFeet?: number
  maximumTerrainStepFeet?: number
  allowOpenUnlockedDoors?: boolean
  ignoreTokens?: boolean
  maximumVisited?: number
  /** Stops expanding routes whose weighted horizontal cost exceeds this. */
  maximumMovementCostFeet?: number
  additionalDifficultTerrainMultiplier?: (token: Token, position: { x: number; y: number }) => number
  additionalSpeedCostMultiplier?: (token: Token, position: { x: number; y: number }) => number
  /** @deprecated Use the classified callbacks above; retained for extension compatibility. */
  additionalCostMultiplier?: (token: Token, position: { x: number; y: number }) => number
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
  const pathGeometry = geometryWithOpenableDoors(
    input.geometry,
    input.allowOpenUnlockedDoors,
  )
  const startPosition = tokenCenterForAnchorCell(start, input.token, input.map)
  const destinationPosition = tokenCenterForAnchorCell(destination, input.token, input.map)
  const startTerrainElevation = mapGeometryTerrainElevationAtPoint(pathGeometry, startPosition)
  const storedStartElevation = Number.isFinite(input.token.elevationFeet)
    ? Math.max(-1_000, Math.min(10_000, input.token.elevationFeet!))
    : startTerrainElevation
  const startElevation = Math.max(startTerrainElevation, storedStartElevation)
  const targetElevation = Number.isFinite(input.targetElevationFeet)
    ? Math.max(-1_000, Math.min(10_000, input.targetElevationFeet!))
    : input.canFly ? startElevation : undefined
  const maximumTerrainStepFeet = Math.max(0, input.maximumTerrainStepFeet ?? 10)
  const tokenHeightFeet = Math.max(5, Math.max(1, input.token.size) * 5)
  const elevationAtPosition = (position: { x: number; y: number }, isDestination = false) => {
    if (input.canFly && targetElevation != null) {
      // 三维移动采用明确顺序：先在起点升降至声明高度，再水平飞行。
      // 这样同一条移动不会因拆成“升高 + 平移”而得到不同的墙体碰撞结果。
      return targetElevation
    }
    const terrainElevation = mapGeometryTerrainElevationAtPoint(pathGeometry, position)
    return isDestination && targetElevation != null ? targetElevation : terrainElevation
  }
  const occupied = input.ignoreTokens ? new Set<string>() : occupiedCells(input.map.tokens, input.map, input.token.id)
  const nodes = new Map<string, PathNode>()
  nodes.set(key(start), { cell: start, cost: 0, estimate: 0, elevationFeet: startElevation })
  const open = new PathAStarOpenHeap(nodes, destination)
  open.pushOrUpdate(key(start))
  const maximumVisited = Math.max(100, input.maximumVisited ?? 20_000)
  let visited = 0

  while (open.size > 0 && visited < maximumVisited) {
    visited += 1
    const currentKey = open.pop()!
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
          if (
            mapGeometryDoorOpenState(door) === 'closed' &&
            mapGeometryDoorLockState(door) === 'unlocked' &&
            mapGeometrySegmentsIntersect(from, to, door.points[0], door.points[1], true)
          ) {
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
  const pathGeometry = geometryWithOpenableDoors(
    input.geometry,
    input.allowOpenUnlockedDoors,
  )
  const startPosition = tokenCenterForAnchorCell(start, input.token, input.map)
  const startTerrainElevation = mapGeometryTerrainElevationAtPoint(
    pathGeometry,
    startPosition,
  )
  const storedStartElevation = Number.isFinite(input.token.elevationFeet)
    ? Math.max(-1_000, Math.min(10_000, input.token.elevationFeet!))
    : startTerrainElevation
  const startElevation = Math.max(startTerrainElevation, storedStartElevation)
  const flightElevation = input.canFly && Number.isFinite(input.targetElevationFeet)
    ? Math.max(-1_000, Math.min(10_000, input.targetElevationFeet!))
    : undefined
  const maximumTerrainStepFeet = Math.max(
    0,
    input.maximumTerrainStepFeet ?? 10,
  )
  const maximumMovementCostFeet = Number.isFinite(input.maximumMovementCostFeet)
    ? Math.max(0, input.maximumMovementCostFeet!)
    : Number.POSITIVE_INFINITY
  const tokenHeightFeet = Math.max(5, Math.max(1, input.token.size) * 5)
  const elevationAtPosition = (position: { x: number; y: number }) =>
    flightElevation ?? mapGeometryTerrainElevationAtPoint(pathGeometry, position)
  const occupied = input.ignoreTokens
    ? new Set<string>()
    : occupiedCells(input.map.tokens, input.map, input.token.id)
  const nodes = new Map<string, PathNode>()
  const queue = new PathMinHeap()
  let queueOrder = 0
  nodes.set(key(start), {
    cell: start,
    cost: 0,
    estimate: 0,
    elevationFeet: startElevation,
  })
  queue.push({ nodeKey: key(start), cost: 0, order: queueOrder++ })
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
    directionLoop: for (const direction of directions) {
      const next = {
        col: current.cell.col + direction.dc,
        row: current.cell.row + direction.dr,
      }
      if (
        next.col < 0 || next.row < 0 ||
        next.col >= columns || next.row >= rows
      ) continue
      const position = tokenCenterForAnchorCell(next, input.token, input.map)
      const placed = { ...input.token, ...position }
      const nextElevation = elevationAtPosition(position)
      if (
        !input.canFly &&
        Math.abs(nextElevation - current.elevationFeet) > maximumTerrainStepFeet
      ) continue
      if (
        tokenOccupiedCellsAt(placed, input.map, placed)
          .some((cell) => occupied.has(key(cell)))
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
      if (direction.dc !== 0 && direction.dr !== 0) {
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
            .some((cell) => occupied.has(key(cell)))
        })
        if (occupiedCorners.every(Boolean)) continue directionLoop
        for (const cornerCell of cornerCells) {
          const cornerPosition = tokenCenterForAnchorCell(
            cornerCell,
            input.token,
            input.map,
          )
          const cornerElevation = elevationAtPosition(cornerPosition)
          if (!input.canFly && (
            Math.abs(cornerElevation - current.elevationFeet) > maximumTerrainStepFeet ||
            Math.abs(nextElevation - cornerElevation) > maximumTerrainStepFeet
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
      const nextCost = current.cost +
        feetPerCell * difficultTerrainMultiplier * speedCostMultiplier
      if (nextCost > maximumMovementCostFeet + 1e-4) continue
      const nextKey = key(next)
      const previous = nodes.get(nextKey)
      if (previous && previous.cost <= nextCost) continue
      nodes.set(nextKey, {
        cell: next,
        cost: nextCost,
        estimate: 0,
        elevationFeet: nextElevation,
        previous: queued.nodeKey,
      })
      queue.push({ nodeKey: nextKey, cost: nextCost, order: queueOrder++ })
    }
  }

  const truncated = queue.size > 0
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
      const destinationNode = nodes.get(key(destination))
      if (!destinationNode) return undefined
      const destinationPosition = tokenCenterForAnchorCell(
        destination,
        input.token,
        input.map,
      )
      const cells: GridCell[] = []
      const elevationsFeet: number[] = []
      let cursor: PathNode | undefined = destinationNode
      while (cursor) {
        cells.push(cursor.cell)
        elevationsFeet.push(cursor.elevationFeet)
        cursor = cursor.previous ? nodes.get(cursor.previous) : undefined
      }
      cells.reverse()
      elevationsFeet.reverse()
      // Match findMapGeometryPath's single-cell vertical movement semantics:
      // a flyer can change elevation without changing its anchor cell.
      if (cells.length === 1 && flightElevation != null) {
        elevationsFeet[0] = flightElevation
      }
      const destinationElevation =
        elevationsFeet.at(-1) ?? destinationNode.elevationFeet
      if (mapGeometryPlacementBlocked({
        geometry: pathGeometry,
        map: input.map,
        token: input.token,
        at: destinationPosition,
        elevationFeet: destinationElevation,
      }).blocked) return undefined
      const points = cells.map((cell) =>
        tokenCenterForAnchorCell(cell, input.token, input.map))
      const doorsToOpen = new Set<string>()
      for (let index = 1; index < points.length; index += 1) {
        const from = points[index - 1]
        const target = points[index]
        for (const door of input.geometry?.doors ?? []) {
          if (
            mapGeometryDoorOpenState(door) === 'closed' &&
            mapGeometryDoorLockState(door) === 'unlocked' &&
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
      return {
        points,
        elevationsFeet,
        cells,
        distanceFeet: Math.max(0, cells.length - 1) * feetPerCell,
        movementCostFeet: Math.ceil(destinationNode.cost),
        doorsToOpen: [...doorsToOpen],
      }
    },
  }
}
