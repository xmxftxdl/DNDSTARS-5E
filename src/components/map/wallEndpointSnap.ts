import type { MapGeometryPoint, MapGeometryState, MapGeometryTool } from '../../lib/mapGeometry'

export const WALL_ENDPOINT_SNAP_PIXELS = 10

export function nearestWallEndpoint(point: MapGeometryPoint, geometry: MapGeometryState | undefined, scale: number): MapGeometryPoint | undefined {
  const radius = WALL_ENDPOINT_SNAP_PIXELS / Math.max(0.001, scale)
  let distance = radius
  let result: MapGeometryPoint | undefined
  for (const wall of geometry?.walls ?? []) {
    for (const endpoint of wall.points) {
      const candidate = Math.hypot(endpoint.x - point.x, endpoint.y - point.y)
      if (candidate <= distance && (!result || candidate < distance)) {
        distance = candidate
        result = endpoint
      }
    }
  }
  return result ? { ...result } : undefined
}

export function snapGeometryDrawingPoint(point: MapGeometryPoint, input: {
  geometry?: MapGeometryState
  tool: MapGeometryTool
  scale: number
  snapToGrid: boolean
  gridSize: number
  gridOffsetX?: number
  gridOffsetY?: number
}): MapGeometryPoint {
  const endpoint = input.tool === 'wall' ? nearestWallEndpoint(point, input.geometry, input.scale) : undefined
  if (endpoint) return endpoint
  if (!input.snapToGrid) return point
  const size = Math.max(1, input.gridSize)
  const x = input.gridOffsetX ?? 0
  const y = input.gridOffsetY ?? 0
  return { x: x + Math.round((point.x - x) / size) * size, y: y + Math.round((point.y - y) / size) * size }
}
