import { cellToPixel } from '../../lib/gridCombat'
import { mapGeometryRuntimeForMap, mapGeometryTerrainElevationAtPoint, mapGeometryTokenElevation, type MapGeometryState } from '../../lib/mapGeometry'
import type { BattleMap, Dnd5ePluginArea, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { dnd5eActivityPointVisible } from './activityPointVisibility'
import { dnd5eConditionsFromActiveEffects } from './activeEffects'
import { dnd5eStandardConditionId } from './conditions'

/** Capture before dice UI yields; a stale search must not replace newer map state. */
export function visualSearchAuthorityStamp(map: BattleMap | undefined, characters: readonly Character[],
  worldMinute?: number, geometry = map ? mapGeometryRuntimeForMap(map.id) : undefined): string {
  return JSON.stringify({ map, characters, worldMinute, geometry })
}

export function canSeeRecognizableArea(map: BattleMap, area: Dnd5ePluginArea, viewer: Token,
  characters: readonly Character[], worldMinute?: number, geometry = mapGeometryRuntimeForMap(map.id)): boolean {
  const character = characters.find(candidate => candidate.id === viewer.characterId)
  if ((character?.currentHp ?? viewer.hp ?? 1) <= 0 ||
    dnd5eConditionsFromActiveEffects(character?.dnd5eCombatState?.activeEffects ?? viewer.dnd5eCombatState?.activeEffects,
      character?.conditions ?? viewer.dnd5eCombatState?.conditions ?? []).some(condition => dnd5eStandardConditionId(condition) === 'unconscious')) return false
  return area.cells.some(cell => {
    const point = cellToPixel(cell, map)
    const anchor = area.anchorMode === 'effect-token'
      ? map.tokens.find(token => token.id === area.anchorTokenId) : undefined
    const elevationFeet = anchor ? mapGeometryTokenElevation(geometry, anchor)
      : area.vertical?.mode === 'volume' ? area.vertical.baseElevationFeet
      : mapGeometryTerrainElevationAtPoint(geometry, point)
    return dnd5eActivityPointVisible({ map, viewer, characters, worldMinute, geometry,
      point: { ...point, elevationFeet } })
  })
}

/** A declared visual area search uses each hazard's Host DC, never the submitted check DC. */
export function recognizeAreasByVisualSearch(input: {
  skill?: 'perception' | 'investigation'
  map: BattleMap; actorTokenId: string; characters: readonly Character[]; total: number; worldMinute?: number; round?: number; geometry?: MapGeometryState
}): BattleMap {
  const viewer = input.map.tokens.find(token => token.id === input.actorTokenId)
  if (!viewer || viewer.type === 'obstacle' || !Number.isFinite(input.total)) return input.map
  let changed = false
  const areas = input.map.dnd5ePluginAreas?.map(area => {
    const recognition = area.visualRecognition
    if (!recognition || (recognition.skill ?? 'perception') !== (input.skill ?? 'perception') || recognition.knownTokenIds.includes(viewer.id) || input.total < recognition.dc ||
      area.modeState?.paused || (!area.permanent && (
        (input.round != null && input.round > area.expiresAfterRound) ||
        (input.worldMinute != null && area.expiresAtWorldMinute != null && input.worldMinute >= area.expiresAtWorldMinute))) ||
      !canSeeRecognizableArea(input.map, area, viewer, input.characters, input.worldMinute, input.geometry)) return area
    changed = true
    return { ...area, visualRecognition: { ...recognition, knownTokenIds: [...recognition.knownTokenIds, viewer.id] } }
  })
  return changed ? { ...input.map, dnd5ePluginAreas: areas } : input.map
}
