import type { BattleMap, Dnd5ePluginArea, Token } from '../../store/maps'
import type { Dnd5ePersistentAreaTriggerSnapshot } from './persistentAreaTypes'
import { tokenOccupiedCellsAt } from '../../lib/gridCombat'
import { mapGeometryRuntimeForMap, mapGeometryTokenElevation, mapGeometryEntityBodyHeightFeet } from '../../lib/mapGeometry'
import { dnd5eTokenIntersectsPersistentAreaAt } from './persistentAreaGeometry'
import { dnd5ePersistentAreaProximityIncludes } from './persistentAreaProximity'

/** One wave per target, regardless of how many eligible scene objects are nearby. */
export function dnd5eMappedObjectProximityIncludes(
  map: BattleMap, area: Dnd5ePluginArea, trigger: Dnd5ePersistentAreaTriggerSnapshot, target: Token,
): boolean {
  if (!trigger.proximityObjectKind || trigger.proximityFeet == null) return false
  const geometry = mapGeometryRuntimeForMap(map.id)
  return map.tokens.some(object => {
    if (object.type !== 'obstacle' || object.dnd5eObjectState?.naturalFeature !== trigger.proximityObjectKind ||
      !dnd5eTokenIntersectsPersistentAreaAt(object, map, area, object)) return false
    const objectArea: Dnd5ePluginArea = {
      id: area.id, pluginId: area.pluginId, featureId: area.featureId, label: area.label, color: area.color,
      sourceCharacterId: area.sourceCharacterId, sourceTokenId: area.sourceTokenId,
      createdRound: area.createdRound, expiresAfterRound: area.expiresAfterRound,
      anchorMode: 'fixed', cells: tokenOccupiedCellsAt(object, map, object),
      vertical: { mode: 'volume', baseElevationFeet: mapGeometryTokenElevation(geometry, object),
        heightFeet: mapGeometryEntityBodyHeightFeet(object) ?? 5 },
    }
    return dnd5ePersistentAreaProximityIncludes(target, map, objectArea, trigger.proximityFeet)
  })
}
