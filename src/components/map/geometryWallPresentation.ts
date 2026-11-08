import type {MapGeometryState, MapGeometryEntity, MapGeometryWallMaterial} from '../../lib/mapGeometry'

export const WALL_MATERIAL_STYLE: Record<MapGeometryWallMaterial, { color: string; dash?: number[] }> = {
  stone: { color: '#94a3b8' },
  earth: { color: '#8b6f47' },
  brick: { color: '#c2410c', dash: [12, 2] },
  wood: { color: '#a16207', dash: [18, 4] },
  metal: { color: '#cbd5e1', dash: [4, 2] },
  natural: { color: '#22c55e', dash: [9, 5] },
}



export function geometryWallMaterial(
  geometry: MapGeometryState | undefined,
  entity: MapGeometryEntity,
): MapGeometryWallMaterial {
  if (entity.kind === 'wall') return entity.material ?? 'stone'
  if (entity.kind === 'door' || entity.kind === 'window') {
    return geometry?.walls.find((wall) => wall.id === entity.parentWallId)?.material ?? 'stone'
  }
  return 'stone'
}



