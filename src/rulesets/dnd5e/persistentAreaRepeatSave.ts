import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import type { Dnd5eActionResult, Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { planDnd5eMapResultApplication } from './mapBridge'
import { dnd5eNearestOutsideAreaMovementV1 } from './activities/dnd5eActivityMapInteraction'
import { dnd5ePersistentAreaEffectMatchesOrigin } from './persistentAreaConditionEffects'
import { recordDnd5eStraightMovement } from './straightMovementStreak'
import {mapGeometryRuntimeForMap,mapGeometryTerrainElevationAtPoint} from '../../lib/mapGeometry'

/** Stage all required releases before committing the turn. Failure leaves the caller's result untouched. */
export function settleDnd5eAreaRepeatSaveEjections(input: {
  before: Dnd5eHeadlessCombatState; result: Dnd5eActionResult; map: BattleMap
  characters: readonly Character[]; characterIdByCombatantId: Record<string,string>
}): Dnd5eActionResult | undefined {
  if (!input.result.ok) return input.result
  const releases=input.result.events.flatMap(event=>{
    if(event.type!=='active-effect-removed'||event.reason!=='save-succeeded')return []
    const effect=input.before.combatants[event.targetId]?.classState.activeEffects?.find(e=>e.id===event.effectId)
    const link=effect?.areaLifetime
    if(!effect||!link||link.mapId!==input.map.id||effect.source.actorId!==link.sourceActorId)return []
    const area=input.map.dnd5ePluginAreas?.find(a=>a.id===link.areaId&&a.sourceTokenId===link.sourceActorId)
    if(!area||!dnd5ePersistentAreaEffectMatchesOrigin(effect,area.id)||
      !area.triggers?.some(t=>t.condition?.condition===effect.standardCondition&&t.condition?.ejectOnSuccessfulRepeatSave))return []
    return [{targetId:event.targetId,area}]
  })
  if(!releases.length)return input.result
  const result={...structuredClone(input.result),events:structuredClone([...input.result.events])}
  const seen=new Set<string>()
  for(const {targetId,area} of releases){
    const key=JSON.stringify([targetId,area.id]);if(seen.has(key))continue;seen.add(key)
    const map=planDnd5eMapResultApplication({...input,state:result.state,events:result.events}).map
    const destination=dnd5eNearestOutsideAreaMovementV1({map,area,targetTokenId:targetId})
    const target=result.state.combatants[targetId]
    if(!destination||!target)return undefined
    if(destination.distanceFeet<=0)continue
    const from={...target.position}
    target.position={...destination.position}
    target.groundElevationFeet=mapGeometryTerrainElevationAtPoint(mapGeometryRuntimeForMap(input.map.id),target.position)
    target.airborne=(target.elevationFeet??target.groundElevationFeet)>target.groundElevationFeet+1e-7
    result.events.push({type:'moved',actorId:targetId,sourceActorId:area.sourceTokenId,from,to:{...target.position},
      fromElevationFeet:target.elevationFeet,toElevationFeet:target.elevationFeet,distance:destination.distanceFeet,movementKind:'forced'})
    recordDnd5eStraightMovement(result.state,result.events.slice(-1))
  }
  return result
}
