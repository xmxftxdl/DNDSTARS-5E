import type { BattleMap, Token } from '../../store/maps'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { dnd5eOwnsPersistentArea } from './persistentAreaOwnership'

/** Cross-map access is limited to ending a fixed, character-owned effect.
 * It must not grant remote movement, targeting, or other area controls. */
export function resolveRemoteAreaDismissal(input: {
  maps: readonly BattleMap[]; actor: Token; actorMapId: string
  areaMapId: string; areaId: string; packageId: string
  activity: Dnd5eActivityDefinitionV1; worldMinute?: number
}) {
  const { activity, actor } = input
  const operations=activity.outcomes.flatMap(outcome=>outcome.operations)
  if(!actor.characterId || input.areaMapId===input.actorMapId || activity.target.kind!=='self' ||
    !operations.length || operations.some(operation=>operation.kind!=='dismiss-granting-area')) return undefined
  const matches=input.maps.filter(map=>map.id===input.areaMapId)
  if(matches.length!==1)return undefined
  const map=matches[0], areas=map.dnd5ePluginAreas?.filter(area=>area.id===input.areaId)??[]
  if(areas.length!==1)return undefined
  const area=areas[0]
  if(area.anchorMode!=='fixed' || !area.sourceLimit || area.concentrationId ||
    !dnd5eOwnsPersistentArea(area,actor) || area.pluginId!==input.packageId ||
    !area.grantedActivities?.some(grant=>grant.activityId===activity.id) ||
    (!area.permanent && (input.worldMinute==null || area.expiresAtWorldMinute==null || input.worldMinute>=area.expiresAtWorldMinute))) return undefined
  return {map,area}
}
