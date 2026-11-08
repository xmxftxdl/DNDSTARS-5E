import type{Dnd5eCombatEvent,Dnd5eHeadlessCombatState}from'./headlessCombatEngine'
import{listDnd5eActivityTriggerWindowsV1}from'./activities/dnd5eActivityTriggerWindows'
import{resolveRegisteredDnd5eActivityInCombatV1}from'./activities/dnd5eActivityCombatAuthority'
import{dnd5eCombatantPairKey}from'./headlessCombatPrimitives'
import{dnd5eCombatantCanSee}from'./headlessCombatEngine'
import{dnd5eAreaTargetSelectionValid}from'./activities/dnd5eAreaTargetSelection'
import{dnd5eBoundedHostEventId}from'./activities/dnd5eActivityIdentity'
export type PostD20FeatureUseEvent=Extract<Dnd5eCombatEvent,{type:'post-d20-adjustment-applied'}>
export interface PostD20FeatureUseChoice {packageId:string;activityId:string;targetIds:readonly string[]}
export interface PostD20FeatureUseRequest {event:PostD20FeatureUseEvent;windows:ReturnType<typeof listDnd5eActivityTriggerWindowsV1>;eventBatchId:string}
type Listener=(request:PostD20FeatureUseRequest,state:Dnd5eHeadlessCombatState)=>PostD20FeatureUseChoice|undefined
let active:{listener:Listener;eventBatchId:string;interrupted?:boolean;error?:unknown}|undefined
export function withPostD20FeatureUseCheckpoints<T>(listener:Listener,run:()=>T,eventBatchId:string):T {const prior=active;active={listener,eventBatchId};try{return run()}finally{active=prior}}
export function rethrowPostD20FeatureUseInterruption(){if(active?.interrupted)throw active.error}
/** Source event and current state come only from an actual Host use, before original damage. */
export function settlePostD20FeatureUse(state:Dnd5eHeadlessCombatState,event:PostD20FeatureUseEvent,events:Dnd5eCombatEvent[]):boolean{
 const eventBatchId=active?.eventBatchId??state.combatId+':unissued-feature-use',batch=eventBatchId+':post-d20:'+events.indexOf(event),windows=listDnd5eActivityTriggerWindowsV1({state,events:[event],eventBatchId:batch})
 if(!windows.length)return true
 if(!active)throw Error('post-d20-feature-use-followup-required')
 try{
 const request={event:structuredClone(event),windows,eventBatchId:batch},choice=active.listener(structuredClone(request),structuredClone(state))
 if(!choice){event.inlineFollowupSettled=true;return true}
 const window=windows.find(w=>w.available.some(a=>a.packageId===choice.packageId&&a.activity.id===choice.activityId)),entry=window?.available.find(a=>a.packageId===choice.packageId&&a.activity.id===choice.activityId)
 if(!entry||!window||entry.confirmation!=='actor-choice'||entry.activity.target.kind!=='area'||entry.activity.target.origin!=='self'||entry.activity.target.shape!=='sphere'||entry.activity.target.selection!=='choose-any')return false
 const target=entry.activity.target,owner=state.combatants[event.actorId]
 if(!owner||window.triggerContext.eligibleTargetIds[0]!==owner.id||target.radiusFeet==null)return false
 const candidates=Object.values(state.combatants).filter(c=>!c.deathSaves.dead&&(c.currentHp>0||c.usesDeathSaves)&&
  (target.includeSelf||c.id!==owner.id)&&(target.relation==='any'||(target.relation==='ally')===(c.controller===owner.controller))&&
  (!(target.requiresVisibleTargets||target.requiresLineOfSight)||dnd5eCombatantCanSee(state,owner.id,c.id))&&
  (c.id===owner.id?0:state.distanceFeetByCombatantPair?.[dnd5eCombatantPairKey(owner.id,c.id)]??Infinity)<=target.radiusFeet!).map(c=>c.id)
 if(!dnd5eAreaTargetSelectionValid(target,candidates,choice.targetIds))return false
 const commandId=dnd5eBoundedHostEventId(batch+':'+entry.packageId+':'+entry.activity.id),committed=resolveRegisteredDnd5eActivityInCombatV1({state,command:{schemaVersion:1,commandId,actorId:owner.id,packageId:entry.packageId,packageVersion:entry.packageVersion,activityId:entry.activity.id,targetIds:[...choice.targetIds],expectedRevision:0,triggerEventId:window.triggerContext.eventId,areaPlacement:{x:owner.position.x,y:owner.position.y,elevationFeet:owner.elevationFeet,radiusFeet:target.radiusFeet,angleDegrees:0}},combatRevision:0,authoritativeRolls:{},areaTargetIds:candidates,areaPlacementDistanceFeet:0,triggerContext:{...window.triggerContext,eligibleTargetIds:candidates},confirmedBy:'actor'})
 if(committed.phase!=='commit')throw Error('post-d20-feature-use-child-rejected:'+committed.phase+':'+committed.result.reason)
 if(!committed.result.ok)throw Error('post-d20-feature-use-child-rejected:commit:'+committed.result.reason)
 if(committed.result.activityHandoffs&&Object.entries(committed.result.activityHandoffs).some(([kind,value])=>kind==='areaSpellDamageTypes'?Array.isArray(value)&&value.includes('cold'):Array.isArray(value)&&value.length>0))throw Error('post-d20-feature-use-map-handoff-required')
 // Preserve the native parent's live actor references while accepting the real child plan.
 for(const[id,value]of Object.entries(committed.result.state.combatants)){if(state.combatants[id])Object.assign(state.combatants[id],value);else state.combatants[id]=value}
 Object.assign(state,{...committed.result.state,combatants:state.combatants});events.push(...committed.result.events);event.inlineFollowupSettled=true;return true
 }catch(error){active.interrupted=true;active.error=error;throw error}
}
