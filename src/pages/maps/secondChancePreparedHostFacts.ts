import{captureDnd5eActivityWorldFactRecovery,restoreDnd5eActivityWorldFactRecovery,type Dnd5eActivityWorldFactRecovery}from'../../rulesets/dnd5e/activities/dnd5eActivityWorldFacts'
import type{SharedCombatInterrupt}from'../../lib/combatInterruptQueue'
import {bountifulNativePreparedRecoveryFacts,stripBountifulNativePreparedCapability} from '../../rulesets/dnd5e/bountifulHostOperation'
import {restoreBountifulNativePreparedRecovery} from '../../rulesets/dnd5e/bountifulNativePreparedRecovery'
import {loadSharedResource,mutateSharedCombatInterrupt} from '../../lib/sharedApi'
import{dnd5ePreparedOrdinaryWeaponSceneFacts,stripDnd5ePreparedOrdinaryWeaponScene,restoreDnd5ePreparedOrdinaryWeaponSceneFacts,type OrdinaryWeaponSceneFacts}from'../../rulesets/dnd5e/ordinaryWeaponScene'
import{getRoomSession}from'../../lib/roomSession'
import{captureDnd5eCompletedRestCastingWitness,restoreDnd5eCompletedRestCastingWitness,type Dnd5eCompletedRestCastingWitness}from'../../rulesets/dnd5e/restActivityCastingWindow'
import{captureDnd5eCompletedLongCastingWitness,restoreDnd5eCompletedLongCastingWitness,type Dnd5eCompletedLongCastingWitness}from'../../rulesets/dnd5e/longCastingContinuity'
import{dnd5ePreparedLongCastingBinding,dnd5ePluginSpellElapsedCastingMinutes,dnd5eObservePreparedLongCasting}from'../../rulesets/dnd5e/pluginSpellTransaction'
import{captureDnd5eCastingProximity}from'../../rulesets/dnd5e/castingProximity'
import{dnd5ePluginSpellCastingProximityBinding,dnd5ePreparedSpellCastingProximityValid}from'../../rulesets/dnd5e/pluginSpellTransaction'
import{mapGeometryRuntimeForMap,type MapGeometryState}from'../../lib/mapGeometry'
import{authorizeDnd5eSpellPlacement,dnd5eSpellPlacementQualified}from'../../rulesets/dnd5e/spellPlacementQualification'
import type{PreparedDnd5ePluginSpellCast}from'../../rulesets/dnd5e/pluginSpellTransaction'
import{collectDnd5eActivitySaveFactsV1,dnd5eHostSaveFactsV1,type Dnd5eActivitySaveFactsV1}from'../../rulesets/dnd5e/activities/dnd5eActivitySaveFacts'
import{getRegisteredDnd5eActivity}from'../../rulesets/dnd5e/activities/dnd5eActivityRegistry'
import{cloneDnd5eHostTransactionInput,dnd5eHostTransactionHasCapabilities}from'../../rulesets/dnd5e/hostTransactionClone'
import{authorizeDnd5eActivityTargetQualificationsV1,dnd5eHostTargetQualificationsV1,dnd5eHostTargetBodyPartsV1}from'../../rulesets/dnd5e/activities/dnd5eActivityTargetQualifications'
import{authorizeDnd5eActivityDmChoicesV1,dnd5eActivityDmChoicesAuthorizedV1}from'../../rulesets/dnd5e/activities/dnd5eActivityDmChoices'
import type{Dnd5eActivityDefinitionV1}from'../../rulesets/dnd5e/activities/dnd5eActivityContracts'
import type{Dnd5eFormulaRollResult}from'../../rulesets/dnd5e/activities/dnd5eFormula'
type Action=Parameters<typeof authorizeDnd5eActivityTargetQualificationsV1>[0]&{targetId?:string;targetIds?:readonly string[]}
type Qualified=NonNullable<ReturnType<typeof dnd5eHostTargetQualificationsV1>>
interface Recovery{worldFacts?:Dnd5eActivityWorldFactRecovery;bountifulNative?:{parentId:string};ordinaryWeaponScene?:OrdinaryWeaponSceneFacts;restCasting?:Dnd5eCompletedRestCastingWitness;longCasting?:Dnd5eCompletedLongCastingWitness;proximity?:{geometry?:MapGeometryState};placementQualified?:true;activityDefinition?:Dnd5eActivityDefinitionV1;saveFacts?:Dnd5eActivitySaveFactsV1;qualified?:Qualified;bodyParts?:ReturnType<typeof dnd5eHostTargetBodyPartsV1>;dmChoices?:true}
interface PreparedInput{prepared:{map?:{id:string};state?:{combatId:string};activity?:Dnd5eActivityDefinitionV1;activityHeadlessAction?:Action;headlessAction?:Action;targetTokens?:readonly{id:string;label:string}[]};rolls?:{activityRolls?:Record<string,Dnd5eFormulaRollResult>}|Record<string,Dnd5eFormulaRollResult>}
function originalAction(input:PreparedInput){return input?.prepared?.activityHeadlessAction??input?.prepared?.headlessAction}
function originalRolls(input:PreparedInput):Record<string,Dnd5eFormulaRollResult>{return input.prepared.activityHeadlessAction?(input.rolls as{activityRolls?:Record<string,Dnd5eFormulaRollResult>}|undefined)?.activityRolls??{}:input.rolls as Record<string,Dnd5eFormulaRollResult>??{}}
const envelopeKeys=['secondChanceHostOriginalVersion','issuedForHostMemberId','issuedForRoomId','input','recovery']
const recoveryKeys=['worldFacts','bountifulNative','ordinaryWeaponScene','qualified','bodyParts','dmChoices','saveFacts','activityDefinition','placementQualified','proximity','longCasting','restCasting']
interface Envelope{secondChanceHostOriginalVersion:1;issuedForHostMemberId:string;issuedForRoomId:string;input:PreparedInput;recovery:Recovery}
function requireOriginalHost(envelope:Envelope){const host=getRoomSession();if(!host||host.role!=='dm'||host.memberId!==envelope.issuedForHostMemberId||host.roomId!==envelope.issuedForRoomId)throw Error('second-chance-parent:host-recovery-authority-required')}
/** The trusted clone restores only issuer-registered receipt slots. Inspect those
 * exact slots, preserve their original facts, and remove them from the data copy.
 * All other capabilities still fail the ordinary data codec. */
export function captureSecondChancePreparedHostFacts(input:unknown):unknown{
 if(!dnd5eHostTransactionHasCapabilities(input))return input
 const host=getRoomSession();if(!host||host.role!=='dm')throw Error('second-chance-parent:host-recovery-authority-required')
 const ordinary=dnd5ePreparedOrdinaryWeaponSceneFacts(input);if(ordinary){const copy=cloneDnd5eHostTransactionInput(input);stripDnd5ePreparedOrdinaryWeaponScene(copy);if(dnd5eHostTransactionHasCapabilities(copy))throw Error('second-chance-parent:mixed-scene-capability-unsupported');return{secondChanceHostOriginalVersion:1,issuedForHostMemberId:host.memberId,issuedForRoomId:host.roomId,input:copy,recovery:{ordinaryWeaponScene:ordinary}}}
 const native=bountifulNativePreparedRecoveryFacts(input);if(native){const copy=cloneDnd5eHostTransactionInput(input);if(!stripBountifulNativePreparedCapability(copy)||dnd5eHostTransactionHasCapabilities(copy))throw Error('second-chance-parent:mixed-native-capability-unsupported');return{secondChanceHostOriginalVersion:1,issuedForHostMemberId:host.memberId,issuedForRoomId:host.roomId,input:copy,recovery:{bountifulNative:native}}}
 const copy=cloneDnd5eHostTransactionInput(input)as PreparedInput,action=originalAction(copy),activity=copy?.prepared?.activity??(action?getRegisteredDnd5eActivity(action.pluginId,action.actionId):undefined)
 if(!action||!activity)throw Error('second-chance-parent:capability-recovery-required')
 if(JSON.stringify(activity)!==JSON.stringify(getRegisteredDnd5eActivity(action.pluginId,action.actionId)))throw Error('second-chance-parent:original-activity-definition-mismatch')
 const recovery:Recovery={activityDefinition:activity}
 for(const slot of Object.getOwnPropertySymbols(action)){
  if(slot.description==='host-target-qualifications'){
   const qualified=dnd5eHostTargetQualificationsV1(action)
   if(!qualified)throw Error('second-chance-parent:invalid-original-qualification')
   recovery.qualified=qualified;recovery.bodyParts=dnd5eHostTargetBodyPartsV1(action)
  }else if(slot.description==='host-activity-dm-choices'){
   if(!dnd5eActivityDmChoicesAuthorizedV1(action,activity,originalRolls(copy)))throw Error('second-chance-parent:invalid-original-dm-choice')
   recovery.dmChoices=true
  }else if(slot.description==='host-activity-world-facts'){
   const facts=captureDnd5eActivityWorldFactRecovery(action,activity,{mapId:copy.prepared.map?.id,combatId:copy.prepared.state?.combatId??'',actorId:action.actorId,targetIds:action.targetIds??(action.targetId?[action.targetId]:[])})
   if(!facts||facts.scope.roomId!==host.roomId)throw Error('second-chance-parent:invalid-original-world-fact')
   recovery.worldFacts=facts
  }else if(slot.description==='host-save-facts'){
   const facts=dnd5eHostSaveFactsV1(action);if(!facts)throw Error('second-chance-parent:invalid-original-save-facts');recovery.saveFacts=facts
  }else continue
  if(!Reflect.deleteProperty(action,slot))throw Error('second-chance-parent:immutable-original-capability')
 }
 const spell=copy.prepared as PreparedDnd5ePluginSpellCast
 if(spell.longCastingReceipt){
  const original=copy as unknown as Parameters<typeof import('../../rulesets/dnd5e/pluginSpellTransaction').resolvePreparedDnd5ePluginSpellCast>[0]
  const state=original.currentCombatState??spell.state,seconds=dnd5ePluginSpellElapsedCastingMinutes({castingTime:spell.spell.castingTime,ritual:spell.ritual})*60
  const completed=dnd5eObservePreparedLongCasting(spell,original.currentRoom)&&captureDnd5eCompletedLongCastingWitness(spell.longCastingReceipt,dnd5ePreparedLongCastingBinding(spell),state,seconds)
  if(!completed)throw Error('second-chance-parent:original-long-casting-incomplete')
  recovery.longCasting=completed
  Reflect.deleteProperty(copy.prepared,'longCastingReceipt')
 }
 if(spell.castingProximityReceipt){
  if(!dnd5ePreparedSpellCastingProximityValid(spell,spell.map))throw Error('second-chance-parent:invalid-original-proximity')
  recovery.proximity={geometry:mapGeometryRuntimeForMap(spell.map.id)??undefined}
  Reflect.deleteProperty(copy.prepared,'castingProximityReceipt')
 }
 for(const slot of Object.getOwnPropertySymbols(copy.prepared)){
  if(slot.description!=='spell-placement-qualification')continue
  if(!dnd5eSpellPlacementQualified(copy.prepared as PreparedDnd5ePluginSpellCast))throw Error('second-chance-parent:invalid-original-placement')
  recovery.placementQualified=true
  if(!Reflect.deleteProperty(copy.prepared,slot))throw Error('second-chance-parent:immutable-original-capability')
 }
 const featureOriginal=copy as unknown as Parameters<typeof import('../../rulesets/dnd5e/pluginFeatureAction').resolvePreparedDnd5ePluginFeatureAction>[0],rest=featureOriginal.restAuthority,continuation=rest?.castingContinuation
 if(continuation){
  const seconds=activity.activation.kind==='minute'?activity.activation.value*60:activity.activation.kind==='hour'?activity.activation.value*3600:0
  const witness=captureDnd5eCompletedRestCastingWitness({receipt:continuation.receipt,binding:continuation.binding,character:featureOriginal.prepared.actor,clock:rest!.clock,state:featureOriginal.prepared.state,requiredSeconds:seconds})
  if(!witness)throw Error('second-chance-parent:original-rest-casting-incomplete')
  recovery.restCasting=witness
  if(!Reflect.deleteProperty(continuation,'receipt'))throw Error('second-chance-parent:immutable-original-capability')
 }
 if(dnd5eHostTransactionHasCapabilities(copy)||!recovery.worldFacts&&!recovery.qualified&&!recovery.dmChoices&&!recovery.saveFacts&&!recovery.placementQualified&&!recovery.proximity&&!recovery.longCasting&&!recovery.restCasting)throw Error('second-chance-parent:capability-recovery-required')
 return{secondChanceHostOriginalVersion:1,issuedForHostMemberId:host.memberId,issuedForRoomId:host.roomId,input:copy,recovery} satisfies Envelope
}
/** Facts came from the controller-private immutable parent receipt, bound to the
 * original command, rolls and installed-definition signature. Fresh brands are
 * issued only by the real rules modules; none are decoded from JSON. */
export function restoreSecondChancePreparedHostFacts(value:unknown):unknown{
 if(!value||typeof value!=='object'||!Object.hasOwn(value,'secondChanceHostOriginalVersion'))return value
 const envelope=value as Envelope
 requireOriginalHost(envelope)
 if(envelope.secondChanceHostOriginalVersion!==1||Object.keys(envelope).some(key=>!envelopeKeys.includes(key)))throw Error('second-chance-parent:invalid-host-original')
 if(envelope.recovery&&Object.hasOwn(envelope.recovery,'bountifulNative'))throw Error('second-chance-parent:async-host-recovery-required')
 const ordinary=envelope.recovery?.ordinaryWeaponScene;if(ordinary){if(Object.keys(envelope.recovery).length!==1||ordinary.roomId!==envelope.issuedForRoomId||ordinary.hostMemberId!==envelope.issuedForHostMemberId)throw Error('second-chance-parent:invalid-host-original');return restoreDnd5ePreparedOrdinaryWeaponSceneFacts(cloneDnd5eHostTransactionInput(envelope.input),ordinary)}
 const {input,recovery}=envelope,action=originalAction(input),activity=input?.prepared?.activity??recovery?.activityDefinition
 if(!action||!activity||!recovery||Object.keys(recovery).some(key=>!recoveryKeys.includes(key))||!recovery.qualified&&!recovery.dmChoices||recovery.bodyParts&&!recovery.qualified||recovery.dmChoices!==undefined&&recovery.dmChoices!==true)throw Error('second-chance-parent:invalid-host-original')
 if(JSON.stringify(activity)!==JSON.stringify(getRegisteredDnd5eActivity(action.pluginId,action.actionId)))throw Error('second-chance-parent:original-activity-definition-mismatch')
 if(recovery.worldFacts||recovery.saveFacts||recovery.placementQualified||recovery.proximity||recovery.longCasting||recovery.restCasting)throw Error('second-chance-parent:async-host-recovery-required')
 if(recovery.qualified)authorizeDnd5eActivityTargetQualificationsV1(action,recovery.qualified,recovery.bodyParts)
 if(recovery.dmChoices)authorizeDnd5eActivityDmChoicesV1(action,activity,originalRolls(input))
 return input
}


/** Re-run the real async collector with the original Host's recorded answers.
 * Missing declarations, target bindings or answers never become fabricated facts. */
export async function restoreSecondChancePreparedHostFactsAsync(value:unknown):Promise<unknown>{
 if(!value||typeof value!=='object'||!Object.hasOwn(value,'secondChanceHostOriginalVersion'))return value
 const envelope=value as Envelope;requireOriginalHost(envelope)
 if(envelope.recovery&&Object.hasOwn(envelope.recovery,'bountifulNative')){if(envelope.secondChanceHostOriginalVersion!==1||Object.keys(envelope).some(key=>!envelopeKeys.includes(key))||Object.keys(envelope.recovery).length!==1||!envelope.recovery.bountifulNative)throw Error('second-chance-parent:invalid-host-original');return restoreBountifulNativePreparedRecovery(envelope.input,envelope.recovery.bountifulNative,{loadResource:loadSharedResource})}
 const worldFacts=envelope.recovery?.worldFacts,recorded=envelope.recovery?.saveFacts,placement=envelope.recovery?.placementQualified,proximity=envelope.recovery?.proximity,longCasting=envelope.recovery?.longCasting,restCasting=envelope.recovery?.restCasting
 if(!worldFacts&&!recorded&&!placement&&!proximity&&!longCasting&&!restCasting)return restoreSecondChancePreparedHostFacts(value)
 const {worldFacts:_worldFacts,saveFacts:_saveFacts,placementQualified:_placement,proximity:_proximity,longCasting:_longCasting,restCasting:_restCasting,...other}=envelope.recovery
 if(envelope.secondChanceHostOriginalVersion!==1||Object.keys(envelope).some(key=>!envelopeKeys.includes(key))||Object.keys(envelope.recovery).some(key=>!recoveryKeys.includes(key))||placement!==undefined&&placement!==true||other.bodyParts&&!other.qualified||other.dmChoices!==undefined&&other.dmChoices!==true)throw Error('second-chance-parent:invalid-host-original')
 const input=(other.qualified||other.dmChoices?restoreSecondChancePreparedHostFacts({...envelope,recovery:other}):envelope.input) as PreparedInput
 const action=originalAction(input),activity=input?.prepared?.activity??envelope.recovery.activityDefinition
 if(!action||!activity||JSON.stringify(activity)!==JSON.stringify(getRegisteredDnd5eActivity(action.pluginId,action.actionId)))throw Error('second-chance-parent:original-activity-definition-mismatch')
 if(worldFacts){
  if(worldFacts.scope?.roomId!==envelope.issuedForRoomId)throw Error('second-chance-parent:invalid-original-world-fact')
  await restoreDnd5eActivityWorldFactRecovery(action,activity,worldFacts,{mapId:input.prepared.map?.id,combatId:input.prepared.state?.combatId??'',actorId:action.actorId,targetIds:action.targetIds??(action.targetId?[action.targetId]:[])},{
   authorityUnchanged:()=>{const current=getRoomSession();return current?.role==='dm'&&current.roomId===envelope.issuedForRoomId&&current.memberId===envelope.issuedForHostMemberId},
   load:async id=>(await loadSharedResource<{interrupts:SharedCombatInterrupt[]}>('combat-interrupts'))?.interrupts.find(row=>row.id===id),
   finish:async(id,response)=>{const done=await mutateSharedCombatInterrupt({operation:'finish',mapId:worldFacts.scope.mapId,id,response});if(!done)throw Error('second-chance-parent:world-fact-recovery-failed')},
  })
 }
 if(recorded){
  const targets=input.prepared.targetTokens
  if(!targets?.length||!await collectDnd5eActivitySaveFactsV1({action,activity,targets,decide:async(fact,target)=>recorded[target.id]?.[fact.id]}))throw Error('second-chance-parent:save-fact-recovery-failed')
 }
 if(longCasting){
  const original=input as unknown as Parameters<typeof import('../../rulesets/dnd5e/pluginSpellTransaction').resolvePreparedDnd5ePluginSpellCast>[0],prepared=original.prepared
  const seconds=dnd5ePluginSpellElapsedCastingMinutes({castingTime:prepared.spell.castingTime,ritual:prepared.ritual})*60
  const receipt=restoreDnd5eCompletedLongCastingWitness(longCasting,dnd5ePreparedLongCastingBinding(prepared),original.currentCombatState??prepared.state,seconds)
  if(!receipt)throw Error('second-chance-parent:long-casting-recovery-failed')
  prepared.longCastingReceipt=receipt
  if(!dnd5eObservePreparedLongCasting(prepared,original.currentRoom))throw Error('second-chance-parent:long-casting-recovery-failed')
 }
 if(restCasting){
  const original=input as unknown as Parameters<typeof import('../../rulesets/dnd5e/pluginFeatureAction').resolvePreparedDnd5ePluginFeatureAction>[0],rest=original.restAuthority,continuation=rest?.castingContinuation
  const seconds=activity.activation.kind==='minute'?activity.activation.value*60:activity.activation.kind==='hour'?activity.activation.value*3600:0
  const receipt=rest&&continuation&&restoreDnd5eCompletedRestCastingWitness(restCasting,{binding:continuation.binding,character:original.prepared.actor,clock:rest.clock,state:original.prepared.state,requiredSeconds:seconds})
  if(!receipt||!continuation)throw Error('second-chance-parent:rest-casting-recovery-failed')
  continuation.receipt=receipt
 }
 if(proximity){
  if(Object.keys(proximity).some(key=>key!=='geometry'))throw Error('second-chance-parent:invalid-host-original')
  const prepared=input.prepared as PreparedDnd5ePluginSpellCast,binding=dnd5ePluginSpellCastingProximityBinding(prepared)
  const receipt=binding&&captureDnd5eCastingProximity(binding,prepared.map,proximity.geometry)
  if(!receipt)throw Error('second-chance-parent:proximity-recovery-failed')
  prepared.castingProximityReceipt=receipt
 }
 if(placement&&!await authorizeDnd5eSpellPlacement(input.prepared as PreparedDnd5ePluginSpellCast,async()=>true))throw Error('second-chance-parent:placement-recovery-failed')
 return input
}



