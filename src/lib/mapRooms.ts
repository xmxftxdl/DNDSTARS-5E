import { deriveRoomGraph } from '../../shared/map-geometry-kernel.mjs'
import type { MapGeometryState } from './mapGeometry'

export interface DerivedMapRoom {
  id: string
  cells: Array<{ col: number; row: number }>
  touchesMapBoundary: boolean
  sealed: boolean
}

export interface DerivedMapRoomGraph {
  cellSize: number
  columns: number
  rows: number
  rooms: DerivedMapRoom[]
  portals: Array<{
    id: string
    fromRoomId: string | null
    toRoomId: string | null
    open: boolean
  }>
  roomByCell: Map<string, string>
}

export function deriveMapRoomGraph(input: {
  geometry: MapGeometryState
  width: number
  height: number
  cellSize?: number
}): DerivedMapRoomGraph {
  const graph = deriveRoomGraph({
    ...input,
  })
  return {
    ...graph,
    rooms: graph.rooms,
  }
}

export function derivedRoomAtPoint(
  graph: DerivedMapRoomGraph,
  point: { x: number; y: number },
): DerivedMapRoom | undefined {
  const col = Math.max(0, Math.min(graph.columns - 1, Math.floor(point.x / graph.cellSize)))
  const row = Math.max(0, Math.min(graph.rows - 1, Math.floor(point.y / graph.cellSize)))
  const id = graph.roomByCell.get(`${col},${row}`)
  return graph.rooms.find((room) => room.id === id)
}
