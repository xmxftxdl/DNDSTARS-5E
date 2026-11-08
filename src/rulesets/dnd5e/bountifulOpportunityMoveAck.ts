import {readReplayedBountifulOpportunityPrefixProjection} from './opportunityMoveAction'
import {projectDnd5eCombatApplicationStoreState} from '../../pages/maps/combatApplicationStoreProjection'
import {readIssuedBountifulOpportunityPrefixProjection} from './opportunityMoveAction'

import {getRoomSession} from '../../lib/roomSession'
import type {SharedPlayerActionState,Dnd5eTurnEconomyCounts} from '../../lib/sharedCombatTypes'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {PublishPlayerActionAckInput} from '../../lib/playerActionAckPublish'
import type {Dnd5eDamageReactionFlowOptions} from './damageReactionFlow'
import {resolvePreparedDnd5eOpportunityPlayerMove,readIssuedDnd5eOpportunityPlayerMove,type PreparedDnd5eOpportunityPlayerMove} from './opportunityMoveAction'
import {createDnd5eTurnEconomyCounts,spendDnd5eMovement} from './turnEconomy'
import type {BattleMap} from '../../store/maps'
import type {Character} from '../../types/character'
import type {Dnd5eActionResult} from './headlessCombatEngine'
import {planDnd5eMapResultApplication,type Dnd5eMapResultPlan} from './mapBridge'
import {resolveBountifulOriginalForNormalAck,resolveBountifulOpportunityAfterPostNativeForNormalAck,publishBountifulOriginalThroughNormalAck,refreshBountifulOpportunityMovementJournal} from './bountifulLuckNormalAck'
import {cloneDnd5eHostTransactionInput} from './hostTransactionClone'
import {readBountifulOriginalOpportunityMoveInput} from './bountifulLuckPersistentRoomDriver'
import {bountifulPreparedReplayFacts,type BountifulOriginalDieReceipt} from './bountifulLuckReceipt'
import {resolveDnd5ePreparedWithMaterialDamageReactions} from './damageReactionFlow'
import {encodeSecondChanceParentWire} from '../../lib/secondChanceParentWire'
import {runIssuedDnd5eMovementHazardsProducer,withIssuedDnd5eMovementHazardsDice,type Dnd5eMovementHazardsProducer} from '../../pages/maps/movementHazardsProducer'
import {withTokenMovementPresentations,type TokenMovementPresentation} from '../../pages/maps/tokenMovementPresentation'
import {settleDnd5eConcentrationChecks as settlePostNativeBase} from '../../pages/maps/settleDnd5eCombatResult'
import {readPostNativeActivitySettlementForStage,type PostNativeActivityStage} from '../../pages/maps/postNativeActivityParent'
import {createBountifulOpportunitySettlementDice} from './bountifulOpportunitySettlementDice'
type Source=Parameters<typeof resolvePreparedDnd5eOpportunityPlayerMove>[0]
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
type Result=ReturnType<typeof resolvePreparedDnd5eOpportunityPlayerMove>
const issued=new WeakMap<SharedPlayerActionState,{roomId:string;memberId:string;source:Source;result:Result;boundResult:Result;authorityUnchanged:()=>boolean;settled?:boolean;storeProjection?:{materialSignature:string;map:BattleMap;characters:readonly Character[]}}>()
const prefixResults=new WeakMap<object,{action:SharedPlayerActionState;roomId:string;memberId:string;signature:string}>()
const movementResults=new WeakMap<object,{action:SharedPlayerActionState;roomId:string;memberId:string;signature:string;journalRows?:NonNullable<BountifulOriginalDieReceipt['opportunitySettlementRolls']>}>()
const postNativeResults=new WeakMap<object,{action:SharedPlayerActionState;prefix:OpportunityMaterial;roomId:string;memberId:string;signature:string;stage:PostNativeActivityStage}>()
const signature=(value:unknown)=>JSON.stringify(encodeSecondChanceParentWire(value))
/** A local material prefix, never an ACK issuer. It is rebuilt from the actual
 * protected original mover and authenticated original-die journal. Movement
 * remains incomplete until the normal movement collector supplies its input. */
export async function previewBountifulOpportunityMovePrefix(input:{action:SharedPlayerActionState;options:Dnd5eDamageReactionFlowOptions},gateway:Gateway){
 const session=getRoomSession();if(session?.role!=='dm'||!input.options.authorityUnchanged())throw Error('bountiful-opportunity-prefix:authenticated-current-host-required')
 type Combat={_sync?:{revision?:number};bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}
 const before=await gateway.loadResource<Combat>('combat')
 const loaded=await readBountifulOriginalOpportunityMoveInput({mapId:input.action.mapId,parentId:input.action.id},gateway)
 const after=await gateway.loadResource<Combat>('combat')
 if(!before||!after||JSON.stringify(before)!==JSON.stringify(after)||!loaded.hasAfterDice||loaded.source.stage!=='opportunity'&&loaded.source.movement===undefined||JSON.stringify(loaded.source.prepared.action)!==JSON.stringify(input.action))throw Error('bountiful-opportunity-prefix:actual-persisted-prefix-required')
 const receipts=Object.values(after.bountifulOriginalParents??{}).filter(row=>row.identity.parentId===input.action.id).sort((a,b)=>a.identity.occurrence-b.identity.occurrence)
 if(receipts.some(row=>row.consumed))throw Error('bountiful-opportunity-prefix:completed-parent')
 const source={...loaded.source,stage:'opportunity' as const,hostOriginalD20Replay:bountifulPreparedReplayFacts({parentId:input.action.id,source:loaded.source,receipts})}
 const resolved=await resolveDnd5ePreparedWithMaterialDamageReactions(input.options,source,resolvePreparedDnd5eOpportunityPlayerMove)
 if(!resolved.result.ok||!resolved.application||!input.options.authorityUnchanged()||getRoomSession()?.roomId!==session.roomId||getRoomSession()?.memberId!==session.memberId||getRoomSession()?.role!=='dm')throw Error('bountiful-opportunity-prefix:actual-current-material-result-required')
 prefixResults.set(resolved,{action:input.action,roomId:session.roomId,memberId:session.memberId,signature:signature(resolved)})
 return resolved
}
/** Only this real composition can issue the movement/OA material witness. */
export async function resolveBountifulOpportunityMoveForNormalAck(input:{action:SharedPlayerActionState;source:Source;options:Dnd5eDamageReactionFlowOptions;postNative?:Parameters<typeof readBountifulOpportunityPostNativePrefix>[1]},gateway:Gateway){
 if(input.source.stage==='opportunity')throw Error('bountiful-opportunity-ack:movement-not-settled')
 const session=getRoomSession();if(session?.role!=='dm')throw Error('bountiful-opportunity-ack:authenticated-host-required')
 const resolved=input.postNative?await resolveBountifulOpportunityAfterPostNativeForNormalAck({...input,postNative:input.postNative},gateway):await resolveBountifulOriginalForNormalAck({...input,resolve:resolvePreparedDnd5eOpportunityPlayerMove},gateway)
 if(!resolved.result.ok||!resolved.application)throw Error('bountiful-opportunity-ack:actual-material-result-required')
 if(getRoomSession()?.roomId!==session.roomId||getRoomSession()?.memberId!==session.memberId||getRoomSession()?.role!=='dm')throw Error('bountiful-opportunity-ack:authenticated-host-required')
 issued.set(input.action,{roomId:session.roomId,memberId:session.memberId,source:cloneDnd5eHostTransactionInput(input.source),result:cloneDnd5eHostTransactionInput(resolved),boundResult:resolved,authorityUnchanged:input.options.authorityUnchanged})
 if(resolved.result.movementBlocked){const proof=issued.get(input.action);if(!proof)throw Error('bountiful-opportunity-ack:actual-move-issuer-required');proof.settled=true}
 if(resolved.movementInterrupted==='mover-defeated'||resolved.result.movementBlocked)movementResults.set(resolved,{action:input.action,roomId:session.roomId,memberId:session.memberId,signature:signature(resolved)})
 return resolved
}
/** The exact private prefix can advance its own local projection; a copied or
 * changed material result has no such authority. This reader performs no write. */
export function readBountifulOpportunityMovePrefix(action:SharedPlayerActionState,result:object){
 const proof=prefixResults.get(result),session=getRoomSession()
 if(!proof||proof.action!==action||session?.role!=='dm'||session.roomId!==proof.roomId||session.memberId!==proof.memberId||proof.signature!==signature(result))throw Error('bountiful-opportunity-prefix:exact-original-witness-required')
 return true
}
type PostNativeServices=Omit<Parameters<typeof settlePostNativeBase>[0],'result'|'priorState'|'map'|'characters'|'characterIdByCombatantId'|'priorApplication'|'preserveOffMapParticipants'|'resumeActivityStage'|'hostParentTransactionId'|'followupTransactionNow'|'damageReactions'|'settleActivityTriggers'>&{settleActivityTriggers:NonNullable<Parameters<typeof settlePostNativeBase>[0]['settleActivityTriggers']>}
/** The concrete Base settles its own concentration/Hellish/death/Activity tail.
 * Mechanical input always comes from the actual same-parent prefix. Callers
 * supply its existing dice/choice services, never a replacement result graph. */
export async function settleBountifulOpportunityPostNativePrefix(input:{action:SharedPlayerActionState;prefix:OpportunityMaterial;services:PostNativeServices;options:Dnd5eDamageReactionFlowOptions},gateway:Gateway&Pick<SharedRoomGatewayPort,'publishEvent'>){
 readBountifulOpportunityMovePrefix(input.action,input.prefix)
 const session=getRoomSession(),original=await readBountifulOriginalOpportunityMoveInput({mapId:input.action.mapId,parentId:input.action.id},gateway)
 if(session?.role!=='dm'||!input.options.authorityUnchanged()||!input.prefix.result.ok||!input.prefix.application||original.source.stage!=='opportunity'&&original.source.movement===undefined)throw Error('bountiful-opportunity-post-native:actual-prefix-required')
 const combat=await gateway.loadResource<{bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}>('combat'),first=Object.values(combat?.bountifulOriginalParents??{}).find(row=>row.identity.parentId===input.action.id&&row.identity.occurrence===0)
 if(!first||first.consumed)throw Error('bountiful-opportunity-post-native:live-original-required')
 let stage:PostNativeActivityStage|undefined
 const journal=createBountifulOpportunitySettlementDice({action:input.action,prefix:input.prefix,authorityUnchanged:input.options.authorityUnchanged},gateway)
 if(!('publishEvent' in gateway))throw Error('bountiful-opportunity-post-native:authenticated-dice-gateway-required')
 const settled=await settlePostNativeBase({...input.services,rollD20:async(label,target,context)=>(await journal.roll(1,20,label,target,context,async actual=>[await input.services.rollD20(label,target,actual)]))[0]!,rollD4:async(label,target,context)=>(await journal.roll(1,4,label,target,context,async actual=>[await input.services.rollD4(label,target,actual)]))[0]!,rollDice:(count,sides,label,target,context)=>journal.roll(count,sides,label,target,context,actual=>input.services.rollDice(count,sides,label,target,actual)),result:cloneDnd5eHostTransactionInput(input.prefix.result),map:cloneDnd5eHostTransactionInput(input.prefix.application.map),characters:cloneDnd5eHostTransactionInput(input.prefix.application.characters),characterIdByCombatantId:original.source.prepared.characterIdByCombatantId,priorApplication:input.prefix.application,hostParentTransactionId:input.action.id,followupTransactionNow:()=>first.identity.effectTimestamp,damageReactions:input.options,settleActivityTriggers:async request=>{
  if(!request.stage)throw Error('bountiful-opportunity-post-native:actual-base-stage-required')
  stage=request.stage
  return input.services.settleActivityTriggers(request)
 }})
 await journal.finish()
 if(!stage||!input.options.authorityUnchanged()||getRoomSession()?.role!=='dm'||getRoomSession()?.roomId!==session.roomId||getRoomSession()?.memberId!==session.memberId)throw Error('bountiful-opportunity-post-native:stale-original')
 readPostNativeActivitySettlementForStage(stage,settled)
 postNativeResults.set(settled,{action:input.action,prefix:input.prefix,roomId:session.roomId,memberId:session.memberId,signature:signature(settled),stage})
 return settled
}
export function readBountifulOpportunityPostNativePrefix(action:SharedPlayerActionState,result:Parameters<typeof readPostNativeActivitySettlementForStage>[1]){
 const proof=postNativeResults.get(result),session=getRoomSession()
 if(!proof||proof.action!==action||session?.role!=='dm'||session.roomId!==proof.roomId||session.memberId!==proof.memberId||signature(result)!==proof.signature)throw Error('bountiful-opportunity-post-native:exact-base-completion-required')
 readBountifulOpportunityMovePrefix(action,proof.prefix)
 return {...readPostNativeActivitySettlementForStage(proof.stage,result),opportunityPrefix:cloneDnd5eHostTransactionInput(proof.prefix)}
}
/** Runs the concrete hazard and presentation producers over this exact issued
 * original move. No caller-supplied state/map/application can be signed here. */
async function settleBountifulOpportunityMoveHazardsInternal(input:{action:SharedPlayerActionState;producer:Dnd5eMovementHazardsProducer;beforePersistentAreaSettlement?:Parameters<Dnd5eMovementHazardsProducer['settleDnd5eMovementHazards']>[0]['beforePersistentAreaSettlement'];presentations?:Readonly<Record<string,TokenMovementPresentation>>},finish?:()=>Promise<NonNullable<BountifulOriginalDieReceipt['opportunitySettlementRolls']>>){
 const proof=issued.get(input.action),session=getRoomSession()
 if(!proof||proof.settled||session?.role!=='dm'||session.roomId!==proof.roomId||session.memberId!==proof.memberId||!proof.authorityUnchanged()||signature(proof.boundResult)!==signature(proof.result)||!proof.result.result.ok||!proof.result.application||!proof.result.movementPrepared)throw Error('bountiful-opportunity-hazards:exact-issued-move-required')
 const movement=proof.result.movementPrepared
 const hazards=await runIssuedDnd5eMovementHazardsProducer(input.producer,{state:proof.result.result.state,map:movement.map,characters:movement.characters,characterIdByCombatantId:movement.characterIdByCombatantId,movements:movement.movementTraces,settleSolidMaterialEndpoint:true,carefulMovementActorId:input.action.dnd5eCarefulMovement?movement.actorToken.id:undefined,beforePersistentAreaSettlement:input.beforePersistentAreaSettlement})
 if(!proof.authorityUnchanged()||getRoomSession()?.roomId!==proof.roomId||getRoomSession()?.memberId!==proof.memberId||getRoomSession()?.role!=='dm')throw Error('bountiful-opportunity-hazards:stale-parent')
 const journalRows=await finish?.()
 // Hazards compare against their post-OA input. Re-project against this exact
 // issued parent's original characters so whole/non-staged callers retain the
 // preceding OA/BL effects and costs in the final concrete Store delta too.
 const whole=planDnd5eMapResultApplication({state:hazards.state,map:hazards.application.map,characters:hazards.application.characters,baselineCharacters:proof.source.prepared.characters,characterIdByCombatantId:movement.characterIdByCombatantId})
 const changedTokenIds=whole.map.tokens.flatMap(token=>JSON.stringify(token)===JSON.stringify(proof.source.prepared.map.tokens.find(before=>before.id===token.id))?[]:[token.id])
 const application=withTokenMovementPresentations({application:{...whole,geometry:hazards.application.geometry,changedTokenIds},byTokenId:input.presentations??{}})
 const result={...proof.result.result,state:hazards.state}
 proof.boundResult.result=result;proof.boundResult.application=application
 proof.result=cloneDnd5eHostTransactionInput(proof.boundResult);proof.settled=true
 const settled={result,application,logs:hazards.logs,finalPositionByCombatantId:hazards.finalPositionByCombatantId,completedPathsByCombatantId:hazards.completedPathsByCombatantId}
 movementResults.set(settled,{action:input.action,roomId:proof.roomId,memberId:proof.memberId,signature:signature(settled),...(journalRows?{journalRows:structuredClone(journalRows)}:{})})
 return settled
}
interface OpportunityLocalProjection{map:BattleMap;characters:readonly Character[];turnEconomyByToken:Readonly<Record<string,Dnd5eTurnEconomyCounts>>}
type OpportunityMaterial={result:Dnd5eActionResult;application?:Dnd5eMapResultPlan}
/** The independent scene anchors never change. Only a concrete same-parent
 * material witness can advance these three local projections. Backend source,
 * queue and version checks remain in the final publisher. */
export function createBountifulOpportunityMoveLocalAuthority(input:{prepared:PreparedDnd5eOpportunityPlayerMove;replayedPrefixContext?:object;readProjection:()=>OpportunityLocalProjection;readAnchors:()=>unknown}){
 const original=readIssuedDnd5eOpportunityPlayerMove(input.prepared),session=getRoomSession()
 if(session?.role!=='dm'||original.action!==input.prepared.action&&signature(original.action)!==signature(input.prepared.action))throw Error('bountiful-opportunity-local:actual-original-required')
 const action=input.prepared.action,initial=cloneDnd5eHostTransactionInput(input.readProjection()),anchors=signature(input.readAnchors())
 const prefix=input.replayedPrefixContext?readReplayedBountifulOpportunityPrefixProjection(input.prepared,input.replayedPrefixContext,initial):readIssuedBountifulOpportunityPrefixProjection(input.prepared)
 if(prefix&&signature(initial.turnEconomyByToken)!==signature(prefix.turnEconomyByToken))throw Error('bountiful-opportunity-local:actual-prefix-economy-required')
 if(signature(initial.map)!==signature(prefix?.map??original.map)||signature(initial.characters)!==signature(prefix?.characters??original.characters))throw Error('bountiful-opportunity-local:original-projection-required')
 let expected=signature(initial)
 const current=()=>getRoomSession()?.role==='dm'&&getRoomSession()?.roomId===session.roomId&&getRoomSession()?.memberId===session.memberId&&signature(input.readAnchors())===anchors&&signature(input.readProjection())===expected
 const project=(material:OpportunityMaterial,apply:(projection:OpportunityLocalProjection,application:Dnd5eMapResultPlan)=>void)=>{
  if(!current()||!material.result.ok||!material.application)throw Error('bountiful-opportunity-local:stale-parent')
  const pools:Record<string,Dnd5eTurnEconomyCounts>=cloneDnd5eHostTransactionInput(prefix?(original.turnEconomyByToken??{}):initial.turnEconomyByToken)
  for(const [id,before]of Object.entries(original.state.combatants)){
   const after=material.result.state.combatants[id]
   if(!after)continue
   const active=original.state.initiativeOrder[original.state.initiativeIndex]===id,slot=active?(original.state.initiativeSlotIds?.[original.state.initiativeIndex]??id):id
   const pool=pools[id]??createDnd5eTurnEconomyCounts(original.state.combatId+':'+original.state.round+':'+slot,before.speed)
   let next=pool
   for(const [field,key]of [['actionAvailable','action'],['bonusActionAvailable','bonusAction'],['reactionAvailable','reaction']]as const)if(before.turn[field]!==after.turn[field])next={...next,[key]:{...next[key],current:after.turn[field]?next[key].max:0}}
   if(before.turn.movementRemaining!==after.turn.movementRemaining){
    const feet=before.turn.movementRemaining-after.turn.movementRemaining,spent=spendDnd5eMovement(next,feet)
    if(feet<0||!spent.ok)throw Error('bountiful-opportunity-local:unsupported-movement-budget')
    next=spent.economy
   }
   if(next!==pool)pools[id]=next
  }
  const currentProjection=input.readProjection(),store=projectDnd5eCombatApplicationStoreState({map:currentProjection.map,characters:currentProjection.characters,application:material.application})
  const projection={map:store.map,characters:store.characters,turnEconomyByToken:pools},next=signature(projection)
  apply(projection,cloneDnd5eHostTransactionInput(material.application))
  if(signature(input.readAnchors())!==anchors||signature(input.readProjection())!==next)throw Error('bountiful-opportunity-local:unexpected-projection')
  expected=next
  return projection
 }
 return {authorityUnchanged:current,applyPrefix(material:OpportunityMaterial,apply:Parameters<typeof project>[1]){readBountifulOpportunityMovePrefix(action,material);project(material,apply)},applyPostNative(material:Parameters<typeof readBountifulOpportunityPostNativePrefix>[1],apply:Parameters<typeof project>[1]){readBountifulOpportunityPostNativePrefix(action,material);project(material,apply)},applyMovement(material:OpportunityMaterial,apply:Parameters<typeof project>[1]){const proof=movementResults.get(material);if(!proof||proof.action!==action||proof.roomId!==session.roomId||proof.memberId!==session.memberId||proof.signature!==signature(material))throw Error('bountiful-opportunity-local:actual-movement-witness-required');const owner=issued.get(action);if(!owner||signature({result:owner.boundResult.result,application:owner.boundResult.application})!==signature({result:material.result,application:material.application}))throw Error('bountiful-opportunity-local:matching-original-move-required');const projected=project(material,apply);owner.storeProjection={materialSignature:signature(owner.boundResult),map:cloneDnd5eHostTransactionInput(projected.map),characters:cloneDnd5eHostTransactionInput(projected.characters)}}}
}
/** Checks the actual attack's cost and the actual mover's result before the
 * existing original ACK independently verifies journal, queue and every CAS.
 * This first bounded source slice permits no unissued postprocessing changes. */
export async function publishBountifulOpportunityMoveAck(action:SharedPlayerActionState,input:PublishPlayerActionAckInput,gateway:Pick<SharedRoomGatewayPort,'loadResource'>){
 const proof=issued.get(action)
 if(!proof){
  const combat=await gateway.loadResource<{bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}>('combat')
  if(Object.values(combat?.bountifulOriginalParents??{}).some(row=>row.identity.parentId===action.id&&row.originalAdapterId==='opportunity-move'&&!row.consumed))throw Error('bountiful-opportunity-ack:exact-original-witness-required')
  return publishBountifulOriginalThroughNormalAck(action,input,gateway)
 }
 const session=getRoomSession(),snapshots=input.snapshots,application=proof.result.application
 if(!proof.settled&&proof.result.movementInterrupted!=='mover-defeated')throw Error('bountiful-opportunity-ack:movement-hazards-not-settled')
 if(session?.role!=='dm'||session.roomId!==proof.roomId||session.memberId!==proof.memberId||!snapshots?.combat||!application||!proof.result.result.ok||input.ack.recipientMemberId!==action.roomMemberId||JSON.stringify(proof.source.prepared.action)!==JSON.stringify(action))throw Error('bountiful-opportunity-ack:exact-original-witness-required')
 const materialMap=snapshots.maps.find(map=>map.id===action.mapId)
 const store=proof.storeProjection
 if(store&&store.materialSignature!==signature(proof.boundResult))throw Error('bountiful-opportunity-ack:changed-store-material')
 if(signature(materialMap)!==signature(store?.map??application.map)||signature(snapshots.characters)!==signature(store?.characters??application.characters))throw Error('bountiful-opportunity-ack:changed-original-materials')
 const attackerId=proof.source.prepared.opportunity.actorToken.id,moverId=action.actorTokenId,state=proof.result.result.state,actor=state.combatants[attackerId],mover=state.combatants[moverId],pools=snapshots.combat.dnd5eTurnEconomyByToken
 if(!actor||!mover||actor.turn.reactionAvailable||pools?.[attackerId]?.reaction.current!==0||pools?.[moverId]?.movement.current!==mover.turn.movementRemaining)throw Error('bountiful-opportunity-ack:changed-original-cost')
 const feet=proof.source.prepared.moverEconomy.movement.current-mover.turn.movementRemaining,spent=spendDnd5eMovement(proof.source.prepared.moverEconomy,feet)
 if(feet<0||!spent.ok||signature(pools[moverId].movement)!==signature(spent.economy.movement)||signature(pools[attackerId])!==signature({...proof.source.prepared.attackerEconomy,reaction:{...proof.source.prepared.attackerEconomy.reaction,current:0}}))throw Error('bountiful-opportunity-ack:changed-original-cost')
 await publishBountifulOriginalThroughNormalAck(action,input,gateway);issued.delete(action)
}

/** Mechanical legacy comparison path; production Bountiful uses the durable
 * wrapper below so every real hazard die remains with the original move. */
export const settleBountifulOpportunityMoveHazards=(input:Parameters<typeof settleBountifulOpportunityMoveHazardsInternal>[0])=>settleBountifulOpportunityMoveHazardsInternal(input)
export function readBountifulOpportunityIssuedMove(action:SharedPlayerActionState,result:object){
 const proof=issued.get(action),session=getRoomSession()
 if(!proof||proof.settled||proof.boundResult!==result||signature(proof.result)!==signature(result)||session?.role!=='dm'||session.roomId!==proof.roomId||session.memberId!==proof.memberId||!proof.authorityUnchanged())throw Error('bountiful-opportunity-hazards:exact-issued-move-required')
 return true
}
export async function settleBountifulOpportunityMoveHazardsWithJournal(input:Parameters<typeof settleBountifulOpportunityMoveHazardsInternal>[0],gateway:Gateway&Pick<SharedRoomGatewayPort,'publishEvent'>){
 const proof=issued.get(input.action)
 if(!proof)throw Error('bountiful-opportunity-hazards:exact-issued-move-required')
 readBountifulOpportunityIssuedMove(input.action,proof.boundResult)
 const journal=createBountifulOpportunitySettlementDice({action:input.action,prefix:proof.boundResult,phase:'movement-hazards',authorityUnchanged:proof.authorityUnchanged},gateway)
 const producer=withIssuedDnd5eMovementHazardsDice(input.producer,ports=>({
  rollDiceBoxD20:async(label,target,context)=>(await journal.roll(1,20,label,target,context,async actual=>[await ports.rollDiceBoxD20(label,target,actual)]))[0]!,
  rollDiceBoxValues:(count,sides,label,target,context)=>journal.roll(count,sides,label,target,context,actual=>ports.rollDiceBoxValues(count,sides,label,target,actual)),
  rollDiceBoxD20Pair:async(label,target,mode,context,boundary)=>{
   const values=await journal.roll(mode==='normal'?1:2,20,label,target,context,async actual=>{const pair=await ports.rollDiceBoxD20Pair(label,target,mode,actual,boundary);return pair[1]===undefined?[pair[0]]:[pair[0],pair[1]]})
   return [values[0]!,values[1]]
  },
 }))
 const settled=await settleBountifulOpportunityMoveHazardsInternal({...input,producer},()=>journal.finish())
 await refreshBountifulOpportunityMovementJournal(input.action,settled,gateway)
 return settled
}

/** Exact concrete completion only; it exposes no source/material setter. */
export function readBountifulOpportunityMovementJournal(action:SharedPlayerActionState,material:object,boundResult:object){
 const completed=movementResults.get(material),proof=issued.get(action),session=getRoomSession()
 if(!completed?.journalRows||!proof?.settled||proof.boundResult!==boundResult||completed.action!==action||session?.role!=='dm'||session.roomId!==completed.roomId||session.memberId!==completed.memberId||completed.signature!==signature(material)||signature(proof.boundResult)!==signature(proof.result))throw Error('bountiful-opportunity-journal:exact-movement-completion-required')
 return structuredClone(completed.journalRows)
}

/** Only a concrete completed native move binding selects this ACK path. */
export function hasBountifulOpportunityMoveAck(action:SharedPlayerActionState){
 const proof=issued.get(action),host=getRoomSession()
 if(!proof)return false
 if(host?.role!=='dm'||host.roomId!==proof.roomId||host.memberId!==proof.memberId||signature(proof.boundResult)!==signature(proof.result)||!proof.authorityUnchanged())throw Error('bountiful-opportunity-ack:stale-issued-parent')
 return true
}
