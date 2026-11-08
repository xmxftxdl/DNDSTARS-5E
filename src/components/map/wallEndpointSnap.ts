import type { MapGeometryState, MapGeometryTool, MapGeometryPoint } from '../../lib/mapGeometry'

export function snapWallDrawingPoint(point: MapGeometryPoint, geometry: MapGeometryState | undefined, tool: MapGeometryTool, scale: number, grid: { enabled: boolean; size: number; x: number; y: number }): MapGeometryPoint {
  if (tool === 'wall') {
    let nearest: MapGeometryPoint | undefined
    let distance = 10 / Math.max(0.01, scale)
    for (const wall of geometry?.walls ?? []) for (const vertex of wall.points) {
      const candidate = Math.hypot(vertex.x - point.x, vertex.y - point.y)
      if (candidate <= distance) { nearest = vertex; distance = candidate }
    }
    if (nearest) return { ...nearest }
  }
  if (!grid.enabled) return point
  const size = Math.max(1, grid.size)
  return { x: grid.x + Math.round((point.x - grid.x) / size) * size, y: grid.y + Math.round((point.y - grid.y) / size) * size }
}