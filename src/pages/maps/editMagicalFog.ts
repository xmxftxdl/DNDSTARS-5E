import { createEmptyMapFog, type MapFogState } from '../../lib/fogOfWar'
import { createEmptyMapGeometry } from '../../lib/mapGeometry'
import { useMapGeometryStore } from '../../store/mapGeometry'

export function editMagicalFog(mapId: string, edit: (fog: MapFogState) => MapFogState) {
  const store = useMapGeometryStore.getState()
  const geometry = store.maps.find(map => map.mapId === mapId) ?? createEmptyMapGeometry(mapId)
  const legacy = geometry.obstacles.filter(region => region.magicalDarkness && region.darknessSpellLevel == null)
  const fog = geometry.darknessFog ?? createEmptyMapFog(mapId)
  const migrated: MapFogState = {
    ...fog,
    shapes: [...legacy.map(region => ({
      id: region.id, kind: 'polygon' as const, operation: 'cover' as const,
      createdAt: region.createdAt,
      points: region.points.flatMap(point => [point.x, point.y]),
    })), ...fog.shapes],
  }
  return store.replaceMap(mapId, {
    ...geometry,
    obstacles: geometry.obstacles.filter(region => !legacy.includes(region)),
    darknessFog: { ...edit(migrated), updatedAt: Date.now() },
  })
}
