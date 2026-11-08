import type{readDnd5eCompletedCombatBase}from'../../pages/maps/settleDnd5eCombatResult'
import{getRoomSession}from'../../lib/roomSession'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone'
import{readCapturedDnd5eOpportunitySequenceMovementCheckpoint}from'./opportunityMoveSequence'
import{runIssuedDnd5eMovementHazardsProducer,bindDnd5eSequenceMovementOriginals,readDnd5eSequenceMovementOriginalEvents,type Dnd5eMovementHazardsProducer,type Dnd5eMovementOriginalFrame}from'../../pages/maps/movementHazardsProducer'
import{planDnd5eMapResultApplication}from'./mapBridge'
type Fact=ReturnType<typeof readCapturedDnd5eOpportunitySequenceMovementCheckpoint>
type Settled={result:Fact['resolved']['result'];application:NonNullable<Fact['resolved']['application']>}
const signature=(value:unknown)=>JSON.stringify(encodeSecondChanceParentWire(value))
const prefix=(fact:Fact)=>({prepared:fact.source.prepared,request:fact.request,preceding:fact.preceding,beforeState:fact.beforeState,resolved:fact.resolved,movement:fact.movement})
const completed=new WeakMap<object,{fact:Fact;settled:Settled;signature:string;roomId:string;memberId:string;unchanged:()=>boolean}>()
/** No caller graph can issue this completion: run the exact producer over the
 * genuine native move segment before the next opportunity window is spent. */
export async function settleBountifulOpportunitySequenceMovement(input:{checkpoint:object;producer:Dnd5eMovementHazardsProducer;authorityUnchanged:()=>boolean;resolveOriginal?:(frame:Dnd5eMovementOriginalFrame)=>Promise<readonly number[]|object|undefined>;resolveFinal?:(frame:Dnd5eMovementOriginalFrame)=>Promise<object>;resolveConcentration?:(checkpoint:object)=>Promise<Parameters<typeof readDnd5eCompletedCombatBase>[1]>;beforePersistentAreaSettlement?:Parameters<Dnd5eMovementHazardsProducer['settleDnd5eMovementHazards']>[0]['beforePersistentAreaSettlement']}){
 const fact=readCapturedDnd5eOpportunitySequenceMovementCheckpoint(input.checkpoint),host=getRoomSession()
 if(host?.role!=='dm'||!input.authorityUnchanged()||!fact.resolved.result.ok||!fact.resolved.application)throw Error('opportunity-sequence-movement:actual-live-native-required')
  const producerInput:Parameters<Dnd5eMovementHazardsProducer['settleDnd5eMovementHazards']>[0]={state:cloneDnd5eHostTransactionInput(fact.resolved.result.state),map:cloneDnd5eHostTransactionInput(fact.movement.map),characters:cloneDnd5eHostTransactionInput(fact.movement.characters),characterIdByCombatantId:fact.movement.characterIdByCombatantId,movements:cloneDnd5eHostTransactionInput(fact.movement.movementTraces),settleSolidMaterialEndpoint:true,carefulMovementActorId:fact.request.originalAction.dnd5eCarefulMovement?fact.request.originalAction.actorTokenId:undefined,beforePersistentAreaSettlement:input.beforePersistentAreaSettlement}
  if(input.resolveOriginal)bindDnd5eSequenceMovementOriginals(input.producer,producerInput,input.checkpoint,input.authorityUnchanged,input.resolveOriginal,input.resolveFinal,input.resolveConcentration)
  const hazard=await runIssuedDnd5eMovementHazardsProducer(input.producer,producerInput)
 const current=getRoomSession()
 if(current?.role!=='dm'||current.roomId!==host.roomId||current.memberId!==host.memberId||!input.authorityUnchanged())throw Error('opportunity-sequence-movement:stale-native-segment')
 const application=planDnd5eMapResultApplication({state:hazard.state,map:hazard.application.map,characters:hazard.application.characters,baselineCharacters:fact.movement.characters,characterIdByCombatantId:fact.movement.characterIdByCombatantId}),settled={result:{...fact.resolved.result,state:hazard.state,events:[...fact.resolved.result.events,...(input.resolveOriginal?readDnd5eSequenceMovementOriginalEvents(input.producer,producerInput,input.checkpoint):[])]},application:{...application,geometry:hazard.application.geometry}},cap=Object.freeze({})
 completed.set(cap,{fact,settled,signature:signature(settled),roomId:host.roomId,memberId:host.memberId,unchanged:input.authorityUnchanged});return cap
}
export function readBountifulOpportunitySequenceMovementCompletion(cap:object,checkpoint:object){
 const proof=completed.get(cap),host=getRoomSession(),fact=readCapturedDnd5eOpportunitySequenceMovementCheckpoint(checkpoint)
 if(!proof||host?.role!=='dm'||host.roomId!==proof.roomId||host.memberId!==proof.memberId||!proof.unchanged()||signature(proof.settled)!==proof.signature)throw Error('opportunity-sequence-movement:exact-live-producer-completion-required')
 if(proof.fact.request.parentId!==fact.request.parentId)throw Error('opportunity-sequence-movement:foreign-original-parent')
 if(proof.fact.request.segmentIndex!==fact.request.segmentIndex)return undefined
 if(signature(prefix(proof.fact))!==signature(prefix(fact)))throw Error('opportunity-sequence-movement:changed-actual-native-segment')
 return cloneDnd5eHostTransactionInput(proof.settled)
}

/** Identity of a genuine movement completion only; no graph setter. */
export function readBountifulOpportunitySequenceMovementCompletionReplayFacts(cap:object){const proof=completed.get(cap),host=getRoomSession();if(!proof||host?.role!=='dm'||host.roomId!==proof.roomId||host.memberId!==proof.memberId||!proof.unchanged()||signature(proof.settled)!==proof.signature)throw Error('opportunity-sequence-movement:exact-live-producer-completion-required');return{parentId:proof.fact.request.parentId,segmentIndex:proof.fact.request.segmentIndex,prepared:signature(proof.fact.source.prepared)}}
