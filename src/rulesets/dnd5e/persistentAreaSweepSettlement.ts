import type {BattleMap} from '../../store/maps'
import type {Character} from '../../types/character'
import {collectDnd5ePersistentAreaTriggers,type Dnd5ePersistentAreaTriggerCandidate} from './pluginAreas'
import {stageDnd5eSphereAreaContact} from './persistentAreaContactStage'
import {dnd5ePersistentAreaConditionEffects} from './persistentAreaConditionEffects'

/** The callback settles only the supplied transient state. It must never publish room state. */
export async function settleDnd5eSphereSweep(input:{
 map:BattleMap;characters:readonly Character[];destinationMap:BattleMap;areaId:string;round:number;turnKey:string
 path:readonly {x:number;y:number;elevationFeet:number}[]
 settle:(input:{map:BattleMap;characters:readonly Character[];candidate:Dnd5ePersistentAreaTriggerCandidate})=>Promise<{map:BattleMap;characters:readonly Character[]}|undefined>
}):Promise<{map:BattleMap;characters:readonly Character[]}|undefined>{
 const destination=input.destinationMap.dnd5ePluginAreas?.find(a=>a.id===input.areaId)
 if(!destination||input.destinationMap.id!==input.map.id||input.path.length<2)return undefined
 const end=input.path.at(-1)!,anchor=destination.anchorCell
 if(!anchor||destination.vertical?.mode!=='volume'||(destination.vertical.shape!=='sphere'&&!destination.circularGeometry?.radiusFeet)||
  ![end.x,end.y,end.elevationFeet].every(Number.isFinite)||
  Math.abs(end.x-(input.map.gridOffsetX+(anchor.col+.5)*input.map.gridSize))>1e-6||
  Math.abs(end.y-(input.map.gridOffsetY+(anchor.row+.5)*input.map.gridSize))>1e-6||
  Math.abs(end.elevationFeet-destination.vertical.baseElevationFeet)>1e-6)return undefined
 let map=structuredClone(input.map),characters:readonly Character[]=structuredClone([...input.characters]),path=[...input.path]
 const completed=new Set<string>()
 const settledTargetIds=new Set<string>()
 for(;;){
  const area=map.dnd5ePluginAreas?.find(a=>a.id===input.areaId)
  if(!area)return undefined
  const candidates=collectDnd5ePersistentAreaTriggers({map,areaId:area.id,round:input.round,turnKey:input.turnKey,
   timing:'on-area-move-impact',areaSweep:{areaId:area.id,path}}).filter(candidate=>{
    const token=candidate.targetToken
    const character=token.characterId&&!token.dnd5eSimulacrum?characters.find(c=>c.id===token.characterId):undefined
    const effects=(character?.dnd5eCombatState??token.dnd5eCombatState)?.activeEffects
    return !dnd5ePersistentAreaConditionEffects({effects,areaId:area.id,sourceId:area.sourceTokenId,condition:'restrained'}).length
   })
  const next=candidates[0]
  if(!next){
   const final=stageDnd5eSphereAreaContact({map,characters,areaId:area.id,path,pendingContactTargetIds:[...settledTargetIds]})
   if(!final)return undefined
   const finalArea=final.dnd5ePluginAreas!.find(a=>a.id===area.id)!
   // Restore the validated final footprint and integer anchor; retain only settlement receipts.
   return {map:{...final,dnd5ePluginAreas:final.dnd5ePluginAreas!.map(a=>a.id===area.id?{...destination,triggerReceipts:finalArea.triggerReceipts}:a)},characters}
  }
  if(!next.areaContact||completed.has(next.transactionId))return undefined
  const contact=next.areaContact
  const stagePath=[...path.slice(0,contact.segment+1),contact.point]
  const simultaneous = candidates.filter(candidate => candidate.areaContact?.segment === contact.segment &&
    Math.abs(candidate.areaContact.fraction-contact.fraction)<1e-7).map(candidate=>candidate.targetToken.id)
  // A creature already resolved during this sweep may be expelled ahead of
  // the sphere. Its once-per-turn receipt prevents another save, but must not
  // turn it into a solid obstacle to the continuing sphere and its occupants.
  const staged=stageDnd5eSphereAreaContact({map,characters,areaId:area.id,path:stagePath,pendingContactTargetIds:[...settledTargetIds,...simultaneous]})
  if(!staged)return undefined
  const stagedArea=staged.dnd5ePluginAreas!.find(a=>a.id===area.id)!
  const settled=await input.settle({map:staged,characters,candidate:{...next,area:stagedArea,targetToken:staged.tokens.find(t=>t.id===next.targetToken.id)!}})
  if(!settled||settled.map.id!==map.id||!settled.map.dnd5ePluginAreas?.find(a=>a.id===area.id)?.triggerReceipts?.some(r=>r.transactionId===next.transactionId))return undefined
  completed.add(next.transactionId)
  settledTargetIds.add(next.targetToken.id)
  map=settled.map;characters=settled.characters
  path=[contact.point,...path.slice(contact.segment+1)]
 }
}
