import { Circle, Group } from 'react-konva'
import type { MapGeometryEntity, MapGeometryState } from '../../lib/mapGeometry'

export function WallEndpointSnapMarkers({ draft, geometry, inv }: {
  draft: MapGeometryEntity | null
  geometry?: MapGeometryState
  inv: number
}) {
  if (draft?.kind !== 'wall') return null
  const points = draft.points.filter((point, index, all) =>
    all.findIndex(other => other.x === point.x && other.y === point.y) === index &&
    geometry?.walls.some(wall => wall.points.some(endpoint => endpoint.x === point.x && endpoint.y === point.y)))
  return <Group listening={false}>{points.map(point => <Circle key={`${point.x}:${point.y}`} x={point.x} y={point.y}
    radius={7 * inv} stroke="#67e8f9" strokeWidth={2 * inv} fill="rgba(34,211,238,0.25)" />)}</Group>
}
