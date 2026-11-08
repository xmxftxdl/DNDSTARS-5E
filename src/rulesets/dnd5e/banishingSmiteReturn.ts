import {dnd5eEntitySupportElevation} from './entitySupport'
import type {BattleMap} from '../../store/maps'
import type {Character} from '../../types/character'
import {planEtherealReturn} from '../../lib/mapEtherealGeometry'
import {mapGeometryRuntimeForMap,mapGeometryTerrainElevationAtPoint,type MapGeometryState} from '../../lib/mapGeometry'
import {dnd5eConditionsFromActiveEffects,normalizeDnd5eActiveEffects} from './activeEffects'
import type {Dnd5eCombatEvent,Dnd5eHeadlessCombatState} from './headlessCombatEngine'

/** A physical departure receipt survives removal of the magical controller.
 * Only a known original source can prove that controller ended. No absence of
 * a source from this scene, cached concentration flag, or new same-name cast
 * can take ownership of an old departure. */
export function settleDnd5ePendingBanishmentReturns(input:{state:Dnd5eHeadlessCombatState;map:BattleMap;
 characters:readonly Character[];characterIdByCombatantId:Readonly<Record<string,string>>;geometry?:MapGeometryState|null
}):{ok:true;events:Dnd5eCombatEvent[]}|{ok:false;reason:'banishment-return-no-space'|'banishment-return-invalid-receipt'}{
 const pending=Object.values(input.state.combatants).flatMap(actor=>normalizeDnd5eActiveEffects(actor.classState.activeEffects)
  .filter(effect=>effect.tags?.includes('banishing-smite-native-return')).map(effect=>({actor,effect})))
 if(!pending.length)return{ok:true,events:[]}
 const staged=structuredClone(input.state),events:Dnd5eCombatEvent[]=[]
 const geometry=input.geometry===undefined?mapGeometryRuntimeForMap(input.map.id):input.geometry??undefined
 for(const {actor:original,effect}of pending){
  const origin=effect.initialSpaceBoundary
  if(!origin||!effect.source.executionId||!effect.source.pluginId||!effect.source.rulesId||effect.source.magical!==false)
   return{ok:false,reason:'banishment-return-invalid-receipt'}
  if(origin.mapId!==input.map.id)continue
  const characterId=effect.source.characterId
  const statePeers=Object.values(staged.combatants).filter(peer=>characterId
   ?input.characterIdByCombatantId[peer.id]===characterId:peer.id===effect.source.actorId)
  const characterPeers=characterId?input.characters.filter(peer=>peer.id===characterId):[]
  if(statePeers.length>1||(!statePeers.length&&characterPeers.length!==1))continue
  const sourceEffects=statePeers.length===1?normalizeDnd5eActiveEffects(statePeers[0].classState.activeEffects)
   :normalizeDnd5eActiveEffects(characterPeers[0].dnd5eCombatState?.activeEffects)
  const dead=statePeers.length===1?statePeers[0].deathSaves.dead:(characterPeers[0].deathSaveFailures??0)>=3
  // A new primed on-hit grant has its normal final stamp later. It is not the
  // controller and cannot make an already identified new controller unknown.
  if(!dead&&sourceEffects.some(controller=>!controller.grantedActivities?.length&&controller.duration.type==='concentration'&&controller.source.pluginId===effect.source.pluginId&&controller.source.rulesId===effect.source.rulesId&&!controller.source.executionId))continue
  if(!dead&&sourceEffects.some(controller=>controller.captureExecutionIdentity===true&&
   controller.source.executionId===effect.source.executionId&&controller.source.pluginId===effect.source.pluginId&&
   controller.source.rulesId===effect.source.rulesId&&controller.duration.type==='concentration'))continue
  const actor=staged.combatants[original.id]
  const projected={...input.map,tokens:input.map.tokens.flatMap(token=>{
   const current=staged.combatants[token.id]
   if(current&&current.id!==actor.id&&current.conditions.includes('banished'))return[]
   return[{...token,...current?.position,elevationFeet:current?.elevationFeet??token.elevationFeet,
    dnd5eCombatState:current?{...current.classState,conditions:[...current.conditions]}:token.dnd5eCombatState}]
  })}
  const token=projected.tokens.find(candidate=>candidate.id===actor.id)
  if(!token)return{ok:false,reason:'banishment-return-invalid-receipt'}
  // Reuse only the actual occupancy/terrain planner; its Ethereal force damage
  // is expressly not part of this spell and is never applied here.
  const plan=planEtherealReturn({map:projected,geometry,token,
   at:{x:origin.x,y:origin.y},elevationFeet:origin.bottomFeet})
  if(!plan.ok)return{ok:false,reason:'banishment-return-no-space'}
  const from={...actor.position},fromElevationFeet=actor.elevationFeet??origin.bottomFeet
  actor.position={...plan.position};actor.elevationFeet=plan.elevationFeet
  actor.groundElevationFeet=dnd5eEntitySupportElevation({map:projected,geometry,
   token:{...token,...plan.position,elevationFeet:plan.elevationFeet},terrainElevationFeet:mapGeometryTerrainElevationAtPoint(geometry,plan.position),elevationFeet:plan.elevationFeet})
  actor.airborne=plan.elevationFeet>actor.groundElevationFeet+1e-4
  const ended=normalizeDnd5eActiveEffects(actor.classState.activeEffects).filter(candidate=>candidate.id===effect.id||
   candidate.id===`${effect.id}:incapacitated`&&candidate.source.actorId===effect.source.actorId&&
   candidate.source.pluginId===effect.source.pluginId&&candidate.source.executionId===effect.source.executionId)
  const endedIds=new Set(ended.map(candidate=>candidate.id))
  actor.classState.activeEffects=normalizeDnd5eActiveEffects(actor.classState.activeEffects).filter(candidate=>!endedIds.has(candidate.id))
  actor.conditions=dnd5eConditionsFromActiveEffects(actor.classState.activeEffects)
  for(const removed of ended)events.push({type:'active-effect-removed',targetId:actor.id,effectId:removed.id,definitionId:removed.definitionId,reason:'expired'})
  if(from.x!==plan.position.x||from.y!==plan.position.y||fromElevationFeet!==plan.elevationFeet)
   events.push({type:'moved',actorId:actor.id,from,to:{...plan.position},fromElevationFeet,toElevationFeet:plan.elevationFeet,
    movementKind:'forced',distance:plan.distanceFeet})
 }
 // No partial publication if any return cannot be staged safely.
 for(const [id,actor]of Object.entries(staged.combatants))Object.assign(input.state.combatants[id],actor)
 return{ok:true,events}
}
