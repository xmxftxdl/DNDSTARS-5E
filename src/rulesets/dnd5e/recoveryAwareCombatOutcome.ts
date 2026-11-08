import {checkCombatOutcome} from '../../lib/combatTokens'
import type {BattleMap} from '../../store/maps'
import type {Character} from '../../types/character'
import {createDnd5eMapCombatSnapshot} from './mapBridge'
import type {Dnd5eCombatant} from './headlessCombatEngine'
import {dnd5eDeathSaveActivitySupported} from './deathSaveActivity'
import {listRegisteredDnd5eActivityPackages} from './activities/dnd5eActivityRegistry'
import {dnd5eCombatantEntitledToActivityV1,dnd5eRegisteredSubclassActivityFeature} from './activities/dnd5eActivityEntitlements'
import {registeredDnd5ePluginFeatures,dnd5ePluginFeatureCurrentEnvelopeFullV1} from './plugins/pluginContentCatalog'

/** Read-only outcome discovery. This neither opens a death-save checkpoint nor
 * authorizes an Activity, a resource spend, healing or a world publication. */
export function dnd5eHasAvailableDeathSaveRecovery(actor:Dnd5eCombatant):boolean{
 if(actor.currentHp!==0||actor.deathSaves.dead||actor.deathSaves.stable||!actor.usesDeathSaves)return false
 const features=registeredDnd5ePluginFeatures()
 return listRegisteredDnd5eActivityPackages().some(pack=>pack.activities.some(activity=>{
  if(activity.automation.level!=='full'||!dnd5eDeathSaveActivitySupported(activity)||
    !dnd5eCombatantEntitledToActivityV1({packageId:pack.packageId,activity,combatant:actor}))return false
  const source=activity.legacySource!,qualified=source.id.startsWith(pack.packageId+':')?source.id:pack.packageId+':'+source.id
  const feature=source.kind==='subclass-ability'?dnd5eRegisteredSubclassActivityFeature(pack.packageId,source.id):
    features.find(row=>row.ownerPluginId===pack.packageId&&(source.kind==='feat'?row.sourceFeatId===qualified:row.id===qualified))
  if(!feature||feature.automation!=='full'||!dnd5ePluginFeatureCurrentEnvelopeFullV1(feature.id))return false
  if(feature.sourceClassId){const level=actor.classLevels?.[feature.sourceClassId]??(actor.classId===feature.sourceClassId?actor.level??0:0)
   if(level<(feature.minimumLevel??1)||feature.sourceSubclassId&&
     (actor.subclassIds?.[feature.sourceClassId]??actor.subclassId)!==feature.sourceSubclassId)return false}
  // The supported recovery profile spends only resources. Choice-dependent or
  // nonconstant costs require their own outcome discovery and stay closed here.
  return(activity.consumption??[]).every(cost=>{
   if(cost.kind!=='resource'||cost.whenChoice||cost.amount.kind!=='constant'||
     !Number.isSafeInteger(cost.amount.value)||cost.amount.value<0)return false
   const id=cost.resourceId.startsWith(pack.packageId+':')?cost.resourceId:pack.packageId+':'+cost.resourceId
   return((actor.classResources[cost.resourceId]??actor.classResources[id])?.current??0)>=cost.amount.value
  })
 }))
}

/** A living downed party member with a genuinely owned and affordable recovery
 * must reach their real turn-start choice before automatic party defeat. */
export function checkDnd5eMapCombatOutcomeWithRecovery(input:{
 map:BattleMap;characters:Character[];combatId?:string
 initiativeOrder:Parameters<typeof createDnd5eMapCombatSnapshot>[0]['initiativeOrder']
}){
 const participantTokenIds=input.initiativeOrder.map(entry=>entry.tokenId),outcome=checkCombatOutcome(input.map.tokens,input.characters,{combatId:input.combatId,delayedSummons:input.map.dnd5eDelayedSummons,participantTokenIds})
 if(!outcome.ended||outcome.reason!=='party-downed'||!input.combatId)return outcome
 const playerIds=new Set(input.map.tokens.filter(token=>token.type==='player'&&participantTokenIds.includes(token.id)).map(token=>token.id))
 const snapshot=createDnd5eMapCombatSnapshot({map:input.map,characters:input.characters,combatId:input.combatId,initiativeOrder:input.initiativeOrder})
 return Object.values(snapshot.state.combatants).some(actor=>playerIds.has(actor.id)&&dnd5eHasAvailableDeathSaveRecovery(actor))?{ended:false as const}:outcome
}
