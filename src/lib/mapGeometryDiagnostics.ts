import { openingPoints, wallEdgeId } from '../../shared/map-geometry-kernel.mjs'
import { mapGeometryRelationshipIssues, type MapGeometryState } from './mapGeometry'
import { deriveMapRoomGraph } from './mapRooms'

export interface MapGeometryDiagnosticEdge {
  wallId: string
  wallEdgeId: string
  midpoint: { x: number; y: number }
}

export interface MapGeometryDiagnosticRoom {
  id: string
  sealed: boolean
  touchesMapBoundary: boolean
  cells: Array<{ x: number; y: number; width: number; height: number }>
  center: { x: number; y: number }
}

export interface MapGeometryDiagnosticPortal {
  id: string
  fromRoomId: string | null
  toRoomId: string | null
  open: boolean
  midpoint: { x: number; y: number }
}

export interface MapGeometryDiagnostics {
  cellSize: number
  edges: MapGeometryDiagnosticEdge[]
  rooms: MapGeometryDiagnosticRoom[]
  portals: MapGeometryDiagnosticPortal[]
  issues: ReturnType<typeof mapGeometryRelationshipIssues>
  truncated: boolean
}

export function buildMapGeometryDiagnostics(input: {
  geometry: MapGeometryState
  width: number
  height: number
  cellSize?: number
  maximumCells?: number
}): MapGeometryDiagnostics {
  const graph = deriveMapRoomGraph(input)
  const maximumCells = Math.max(100, input.maximumCells ?? 8_000)
  let remaining = maximumCells
  const rooms = graph.rooms.map((room) => {
    const visibleCells = room.cells.slice(0, remaining)
    remaining -= visibleCells.length
    const center = room.cells.reduce((sum, cell) => ({
      x: sum.x + Math.min(input.width, (cell.col + 0.5) * graph.cellSize),
      y: sum.y + Math.min(input.height, (cell.row + 0.5) * graph.cellSize),
    }), { x: 0, y: 0 })
    const divisor = Math.max(1, room.cells.length)
    return {
      id: room.id,
      sealed: room.sealed,
      touchesMapBoundary: room.touchesMapBoundary,
      cells: visibleCells.map((cell) => ({
        x: cell.col * graph.cellSize,
        y: cell.row * graph.cellSize,
        width: Math.min(graph.cellSize, input.width - cell.col * graph.cellSize),
        height: Math.min(graph.cellSize, input.height - cell.row * graph.cellSize),
      })),
      center: { x: center.x / divisor, y: center.y / divisor },
    }
  })
  const edges = input.geometry.walls.flatMap((wall) =>
    wall.points.slice(0, -1).map((point, index) => {
      const next = wall.points[index + 1]
      return {
        wallId: wall.id,
        wallEdgeId: wallEdgeId(wall, index),
        midpoint: { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 },
      }
    }),
  )
  const portalById = new Map(graph.portals.map((portal) => [portal.id, portal]))
  const portals = input.geometry.doors.flatMap((door) => {
    const points = openingPoints(input.geometry, door)
    const portal = portalById.get(door.id)
    if (points.length !== 2 || !portal) return []
    return [{
      ...portal,
      midpoint: {
        x: (points[0].x + points[1].x) / 2,
        y: (points[0].y + points[1].y) / 2,
      },
    }]
  })
  return {
    cellSize: graph.cellSize,
    edges,
    rooms,
    portals,
    issues: mapGeometryRelationshipIssues(input.geometry),
    truncated: graph.rooms.reduce((count, room) => count + room.cells.length, 0) > maximumCells,
  }
}
