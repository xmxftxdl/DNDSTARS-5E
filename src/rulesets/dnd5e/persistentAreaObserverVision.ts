import type { BattleMap, Dnd5ePluginArea } from '../../store/maps'
import { mapGeometryCanSeeToken, mapGeometryRuntimeForMap, mapGeometryTokenElevation, type MapGeometryState } from '../../lib/mapGeometry'
import { dnd5eConditionsFromActiveEffects } from './activeEffects'
import type { Dnd5eHeadlessCombatState } from './headlessCombatEngine'

export function projectDnd5ePersistentAreaEffectSources(state: Dnd5eHeadlessCombatState, map: BattleMap, geometry?: MapGeometryState): void {
  state.spatialEffectSources = {}
  for (const area of map.dnd5ePluginAreas ?? []) {
    const entity = area.anchorMode === 'effect-token' && map.tokens.find(token => token.id === area.anchorTokenId)
    if (!entity || entity.dnd5eSpellEffect?.sourceTokenId !== area.sourceTokenId) continue
    state.spatialEffectSources[entity.id] = { id: entity.id, position: { x: entity.x, y: entity.y },
      elevationFeet: mapGeometryTokenElevation(geometry ?? mapGeometryRuntimeForMap(map.id), entity),
      visibleTo: Object.keys(state.combatants).filter(id => dnd5ePersistentAreaObserverSeesAnchor(map, area, id, geometry)) }
  }
}

/** Observer-to-entity sight, independent of the caster and occupied area cells. */
export function dnd5ePersistentAreaObserverSeesAnchor(map: BattleMap, area: Dnd5ePluginArea, observerId: string, geometry?: MapGeometryState): boolean {
  const viewer = map.tokens.find(token => token.id === observerId)
  const target = area.anchorMode === 'effect-token' && map.tokens.find(token => token.id === area.anchorTokenId)
  if (!viewer || !target || target.dnd5eSpellEffect?.sourceTokenId !== area.sourceTokenId) return false
  if (dnd5eConditionsFromActiveEffects(viewer.dnd5eCombatState?.activeEffects).includes('blinded')) return false
  return mapGeometryCanSeeToken({ map, geometry: geometry ?? mapGeometryRuntimeForMap(map.id), viewer, target, forceEnabled: true })
}
