import { mapGeometryVisibilityPolygon, type MapGeometryState } from '../../lib/mapGeometry'
import type { BattleMap } from '../../store/maps'

/** Original-plane scenery is separate from creatures perceived on the current plane. */
export function originalPlaneSceneView(input: {
  map: BattleMap
  geometry?: MapGeometryState
  viewerCharacterId?: string
  materialSightRangeFeet?: number
  isDM: boolean
  worldMinute: number
}) {
  const range = input.materialSightRangeFeet
  if (input.isDM || !input.viewerCharacterId || !Number.isFinite(range) || range! <= 0 || range! > 10_000) return undefined
  return input.map.tokens.filter(token => token.characterId === input.viewerCharacterId).map(viewer =>
    mapGeometryVisibilityPolygon({
      map: input.map, geometry: input.geometry, viewer, forceEnabled: true,
      rangeOverrideFeet: range, worldMinute: input.worldMinute,
    }))
}
