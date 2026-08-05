import Konva from 'konva'
import type { MapGeometryEntity } from '../../lib/mapGeometry'

export function geometryEntityPoints(entity: MapGeometryEntity): number[] {
  return entity.points.flatMap((point) => [point.x, point.y])
}



export function isMapTokenNode(node: Konva.Node | null): boolean {
  let n: Konva.Node | null = node
  while (n) {
    if (n.name() === 'map-token') return true
    n = n.parent
  }
  return false
}



/** Grid line positions: offset + n * step, covering [0, length]. */
export function gridLinePositions(length: number, offset: number, step: number): number[] {
  if (step <= 0) return []
  const positions: number[] = []
  const nMin = Math.ceil((0 - offset) / step)
  const nMax = Math.floor((length - offset) / step)
  for (let n = nMin; n <= nMax; n++) {
    const p = offset + n * step
    if (p >= 0 && p <= length) positions.push(p)
  }
  return positions
}
