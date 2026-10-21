import { prepareStructureRemoval } from '../../../shared/structure-expiry.mjs'
import { mapGeometryTerrainElevationAtPoint, type MapGeometryState } from '../../lib/mapGeometry'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import { planDnd5eMapResultApplication, refreshDnd5eMapSpatialRelations } from './mapBridge'
import { replayDnd5eSolidExitFeatherFallChoices, type Dnd5eSolidExitFeatherFallChoice } from './solidMaterialExitSettlement'
import { previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange,
  resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange, type Dnd5eHeadlessCombatState } from './headlessCombatEngine'

/** Pure Host plan for a clock boundary. Do not commit expiry until all requested dice
 * and reactions have resolved; map, roster, geometry and clock share one transaction. */
export function resolveDnd5eTempleExpiry(input: {
  state: Dnd5eHeadlessCombatState
  map: BattleMap
  geometry: MapGeometryState
  characters: readonly Character[]
  characterIdByCombatantId: Readonly<Record<string, string>>
  worldMinute: number
  solidExitFeatherFallChoices?: readonly Dnd5eSolidExitFeatherFallChoice[]
  airborneFallDamageRollsByCombatantId?: Readonly<Record<string, readonly number[]>>
}) {
  if (!Number.isSafeInteger(input.worldMinute) || input.worldMinute < 0 || input.geometry.mapId !== input.map.id ||
    input.state.companionScene?.map.id !== input.map.id) return {ok:false as const,reason:'temple-expiry-invalid'}
  const ids = (input.geometry.structureLifetimes ?? []).filter(record => record.templeWard &&
    record.replacementGroup === 'temple-of-the-gods' && record.expiresWorldMinute != null &&
    record.expiresWorldMinute <= input.worldMinute).map(record => record.id)
  let removed: ReturnType<typeof prepareStructureRemoval>
  try { removed = prepareStructureRemoval(input.map,input.geometry,ids,mapGeometryTerrainElevationAtPoint) }
  catch { return {ok:false as const,reason:'temple-expiry-invalid'} }
  const unsupportedTokenIds = removed.map.tokens.filter(token =>
    token.elevationFeet !== input.map.tokens.find(original => original.id === token.id)?.elevationFeet).map(token => token.id)
  const provisional = structuredClone(input.state)
  provisional.companionScene = {...provisional.companionScene!,geometry:removed.geometry,worldMinute:input.worldMinute}
  // Deliberately use the original map heights, not Fortress's harmless descent projection.
  refreshDnd5eMapSpatialRelations(provisional,input.map,[],{geometry:removed.geometry})
  const reactions = replayDnd5eSolidExitFeatherFallChoices(input.state,provisional,unsupportedTokenIds,input.solidExitFeatherFallChoices)
  if (!reactions.ok) return {ok:false as const,reason:'invalid-reaction'}
  const falls = previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(input.state,reactions.state,unsupportedTokenIds)
  const landed = resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(input.state,reactions.state,
    input.airborneFallDamageRollsByCombatantId,unsupportedTokenIds)
  if (!landed.ok) return {ok:false as const,reason:landed.reason,airborneFalls:falls,solidExitReactionState:reactions.state}
  const events = [...reactions.events,...landed.events]
  const application = planDnd5eMapResultApplication({state:landed.state,map:input.map,geometry:removed.geometry,
    characters:input.characters,characterIdByCombatantId:input.characterIdByCombatantId,events})
  return {ok:true as const,changed:removed.changed,expiredIds:ids,geometry:removed.geometry,application,result:{...landed,events}}
}
