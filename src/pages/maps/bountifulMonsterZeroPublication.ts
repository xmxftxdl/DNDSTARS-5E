import{readBountifulMonsterSavingLateCompletion,type BountifulMonsterSavingLateCompletion}from'../../rulesets/dnd5e/bountifulMonsterSavingLateCompletion'
import{getRoomSession}from'../../lib/roomSession'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
import type{SharedCombatState}from'../../lib/sharedCombatTypes'
import type{Character}from'../../types/character'
import type{BattleMap}from'../../store/maps'
import{readBountifulMonsterZeroOriginalReady}from'../../rulesets/dnd5e/bountifulMonsterZeroPersistentParent'
import{readBountifulMonsterDamageZeroOriginalQualification,type BountifulMonsterDamageZeroOriginalQualification}from'../../rulesets/dnd5e/bountifulMonsterDamageZeroOriginalQualification'
import{createDnd5ePreparedDamageCommitSession}from'../../rulesets/dnd5e/damageCommitSession'
import{resolvePreparedDnd5eMonsterAttack,readDnd5eActualMonsterFacadeResult}from'../../rulesets/dnd5e/monsterAttackAction'
import{settleDnd5eConcentrationChecks,readDnd5eCompletedCombatBase}from'./settleDnd5eCombatResult'
import{decisionFromBountifulOriginalDieReceipt,type BountifulOriginalDieReceipt}from'../../rulesets/dnd5e/bountifulLuckReceipt'
import{createDnd5eTurnEconomyCounts,projectDnd5eHeadlessTurnEconomy}from'../../rulesets/dnd5e/turnEconomy'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
type Synced<T>=T&{_sync?:{revision?:number}}
type Combat=SharedCombatState&{bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}
type BaseInput=Parameters<typeof settleDnd5eConcentrationChecks>[0]
type Options=Omit<BaseInput,'result'|'priorState'|'map'|'characters'|'priorApplication'|'characterIdByCombatantId'|'hostParentTransactionId'|'followupTransactionNow'|'resumeActivityStage'>
declare const publicationBrand:unique symbol
export type BountifulMonsterZeroPublication={readonly[publicationBrand]:true}
type Ready=Awaited<ReturnType<typeof readBountifulMonsterZeroOriginalReady>>
type Native=ReturnType<typeof resolvePreparedDnd5eMonsterAttack>
type Settled=Awaited<ReturnType<typeof settleDnd5eConcentrationChecks>>
const issued=new WeakMap<object,{qualification:BountifulMonsterDamageZeroOriginalQualification;original:unknown;ready:Ready;native:Native;settled:Settled;signature:string;roomId:string;memberId:string;unchanged:()=>boolean;late?:BountifulMonsterSavingLateCompletion}>()
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
function revision(value:Synced<object>|null){const n=value?._sync?.revision;if(!Number.isSafeInteger(n)||n!<0)throw Error('monster-zero-publication:revision-required');return n!}
function host(){const value=getRoomSession();if(value?.role!=='dm'||!value.roomId||!value.memberId)throw Error('monster-zero-publication:actual-host-required');return value}
/** Runs the actual frozen Monster facade, then the existing complete Base.
 * There is no caller result, snapshot or authority-registration argument. */
export async function resolveBountifulMonsterZeroForMap(qualification:BountifulMonsterDamageZeroOriginalQualification,original:unknown,gateway:Gateway,options:Options,unchanged:()=>boolean){
 const session=host(),ready=await readBountifulMonsterZeroOriginalReady(qualification,original,gateway)
 if(!unchanged())throw Error('monster-zero-publication:stale-caller')
 const execution=createDnd5ePreparedDamageCommitSession(ready.source,resolvePreparedDnd5eMonsterAttack,()=>false)
 let native:Native
 try{const terminal=execution.run(ready.source.prepared.state);if(terminal.status!=='resolved')throw Error('monster-zero-publication:actual-complete-native-required');native=terminal.result}finally{execution.cancel()}
 if(!native.result.ok||!native.application)throw Error('monster-zero-publication:actual-successful-native-required')
 readDnd5eActualMonsterFacadeResult(ready.source.prepared,native)
 const settled=await settleDnd5eConcentrationChecks({...options,result:native.result,priorState:ready.source.prepared.state,map:native.application.map,characters:native.application.characters,priorApplication:native.application,characterIdByCombatantId:ready.source.prepared.characterIdByCombatantId,hostParentTransactionId:ready.receipts[0].identity.parentId,followupTransactionNow:()=>ready.receipts[0].identity.effectTimestamp})
 readDnd5eCompletedCombatBase(native.result,settled)
 const current=await readBountifulMonsterZeroOriginalReady(qualification,original,gateway),now=host()
 if(now.roomId!==session.roomId||now.memberId!==session.memberId||!unchanged()||!same(current.receipts,ready.receipts)||settled.application.geometry)throw Error('monster-zero-publication:changed-completed-source')
 const publication=Object.freeze({})as BountifulMonsterZeroPublication
 issued.set(publication,{qualification,original,ready,native,settled,signature:JSON.stringify({native,settled}),roomId:session.roomId,memberId:session.memberId,unchanged})
 return{publication,result:structuredClone(settled)}
}
/** The sole ordinary Host world transaction consumes the original group with
 * the real final Base materials. Caller snapshots cannot enter this API. */
export async function publishBountifulMonsterZeroMapResult(publication:BountifulMonsterZeroPublication,gateway:Gateway){
 const proof=issued.get(publication),session=host()
 if(!proof||proof.roomId!==session.roomId||proof.memberId!==session.memberId)throw Error('monster-zero-publication:actual-issued-completion-required')
 const[combat,characters,maps,geometry,clock,queue,processed,ack]=await Promise.all([gateway.loadResource<Synced<Combat>>('combat'),gateway.loadResource<Synced<{characters:Character[]}>>('characters'),gateway.loadResource<Synced<{maps:BattleMap[]}>>('maps'),gateway.loadResource<Synced<object>>('map-geometry'),gateway.loadResource<Synced<object>>('campaign-time'),gateway.loadResource<Synced<object>>('player-action-requests'),gateway.loadResource<Synced<object>>('player-action-processed'),gateway.loadResource<Synced<object>>('player-action-ack')]),first=proof.ready.receipts[0],identity=first.identity,current=Object.values(combat?.bountifulOriginalParents??{}).filter(row=>row.identity.parentId===identity.parentId).sort((a,b)=>a.identity.occurrence-b.identity.occurrence)
 if(current.length===proof.ready.receipts.length&&current.every(row=>row.consumed?.transactionId===identity.parentId))return{status:'already-committed'as const}
 if(proof.late)await readBountifulMonsterSavingLateCompletion(proof.late)
 await readBountifulMonsterDamageZeroOriginalQualification(proof.qualification,proof.original)
 readDnd5eActualMonsterFacadeResult(proof.ready.source.prepared,proof.native)
 if(!proof.native.result.ok)throw Error('monster-zero-publication:actual-success-required')
 readDnd5eCompletedCombatBase(proof.native.result,proof.settled)
 if(JSON.stringify({native:proof.native,settled:proof.settled})!==proof.signature||!combat||!characters||!maps||!proof.unchanged()||!same(current,proof.ready.receipts)||combat.active!==true||combat.mapId!==identity.mapId||combat.combatId!==identity.combatId||combat.round!==identity.round||combat.initiativeIndex!==identity.initiativeIndex||JSON.stringify(combat.dnd5eTurnEconomyByToken??{})!==identity.reactionEconomySignature||revision(characters)!==identity.revisions.characters||revision(maps)!==identity.revisions.maps||(geometry?revision(geometry):0)!==identity.revisions['map-geometry'])throw Error('monster-zero-publication:stale-completed-source')
 const final=proof.settled,original=proof.ready.source.prepared,success=final.result,economies={...combat.dnd5eTurnEconomyByToken}
 for(const actor of Object.values(success.state.combatants)){
  const slot=original.state.initiativeOrder[identity.initiativeIndex]===actor.id?(original.state.initiativeSlotIds?.[identity.initiativeIndex]??actor.id):actor.id,base=economies[actor.id]??createDnd5eTurnEconomyCounts(identity.combatId+':'+identity.round+':'+slot,actor.speed),projected=projectDnd5eHeadlessTurnEconomy(base,actor.turn,actor.speed)
  economies[actor.id]={...projected,action:{...projected.action,current:Math.min(base.action.current,projected.action.current)},bonusAction:{...projected.bonusAction,current:Math.min(base.bonusAction.current,projected.bonusAction.current)},reaction:{...projected.reaction,current:Math.min(base.reaction.current,projected.reaction.current)},movement:{...projected.movement,current:Math.min(base.movement.current,projected.movement.current)}}
 }
 for(const row of current){const decision=decisionFromBountifulOriginalDieReceipt(row,row.request);if(!decision||row.request.nativeLucky)continue;const actor=success.state.combatants[decision.ownerId],character=final.application.characters.find(character=>character.id===original.characterIdByCombatantId[decision.ownerId]);if(!actor||actor.turn.reactionAvailable||economies[decision.ownerId]?.reaction.current!==0||!success.events.some(event=>event.type==='ally-natural-one-rerolled'&&event.actorId===decision.ownerId&&event.targetId===row.request.actorId&&event.featureId===decision.featureId&&event.dieIndex===row.request.dieIndex&&event.replacement===decision.replacement&&same(event.originalValues,row.request.originalRolls))||!character?.dnd5eCombatState?.activeEffects?.some(effect=>effect.appliedAt===identity.effectTimestamp&&effect.source.actorId===decision.ownerId&&effect.source.rulesId===decision.featureId&&effect.definitionId===decision.featureId+':lucky-suppressed'&&effect.tags?.includes('bountiful-luck:racial-lucky-suppressed')))throw Error('monster-zero-publication:actual-cost-required')}
 const result=encodeSecondChanceParentWire(final),next={...combat,dnd5eTurnEconomyByToken:economies,bountifulOriginalParents:{...combat.bountifulOriginalParents,...Object.fromEntries(current.map(row=>[JSON.stringify(['bountiful-original-parent',identity.parentId,row.identity.occurrence]),{...row,consumed:{transactionId:identity.parentId,result}}]))}},commit=await gateway.saveResourcesAtomically([{name:'characters',expectedRevision:revision(characters),data:{...characters,characters:final.application.characters}},{name:'maps',expectedRevision:revision(maps),data:{...maps,maps:maps.maps.map(map=>map.id===identity.mapId?final.application.map:map)}},{name:'combat',expectedRevision:revision(combat),data:next}],{transactionId:'bountiful-host-parent:'+identity.parentId,readRevisions:{'map-geometry':identity.revisions['map-geometry'],'campaign-time':clock?revision(clock):0,'player-action-requests':queue?revision(queue):0,'player-action-processed':processed?revision(processed):0,'player-action-ack':ack?revision(ack):0}})
 return{status:'committed'as const,commit}
}

declare const nativeStageBrand:unique symbol
export type BountifulMonsterZeroNativeStage={readonly[nativeStageBrand]:true}
type NativeStageProof={qualification:BountifulMonsterDamageZeroOriginalQualification;original:unknown;ready:Ready;native:Native;signature:string;roomId:string;memberId:string;unchanged:()=>boolean;late?:BountifulMonsterSavingLateCompletion}
const nativeStages=new WeakMap<object,NativeStageProof>(),settledStages=new WeakMap<object,{publication:BountifulMonsterZeroPublication;settled:Settled}>(),activeStages=new WeakSet<object>()
/** Split adapter for the actual Page Native→Base sequence. This exposes only a
 * display clone plus an opaque stage, never a caller-registerable result. */
export async function prepareBountifulMonsterZeroNativeStage(qualification:BountifulMonsterDamageZeroOriginalQualification,original:unknown,gateway:Gateway,unchanged:()=>boolean,late?:BountifulMonsterSavingLateCompletion){
 const session=host();let ready=await readBountifulMonsterZeroOriginalReady(qualification,original,gateway)
 if(late){const actual=await readBountifulMonsterSavingLateCompletion(late);if(actual.parentId!==ready.receipts[0].identity.parentId||actual.effectTimestamp!==ready.receipts[0].identity.effectTimestamp||!same(actual.source.prepared,ready.source.prepared))throw Error('monster-zero-stage:exact-late-original-required');ready={...ready,source:{...actual.source,hostOriginalD20Replay:{...actual.source.hostOriginalD20Replay,facts:ready.source.hostOriginalD20Replay.facts}}}}
 if(!unchanged())throw Error('monster-zero-stage:stale-original')
 const execution=createDnd5ePreparedDamageCommitSession(ready.source,resolvePreparedDnd5eMonsterAttack,()=>false)
 let native:Native
 try{const terminal=execution.run(ready.source.prepared.state);if(terminal.status!=='resolved')throw Error('monster-zero-stage:actual-complete-native-required');native=terminal.result}finally{execution.cancel()}
 if(!native.result.ok||!native.application)throw Error('monster-zero-stage:actual-success-required')
 readDnd5eActualMonsterFacadeResult(ready.source.prepared,native)
 const stage=Object.freeze({})as BountifulMonsterZeroNativeStage;nativeStages.set(stage,{qualification,original,ready,native,signature:JSON.stringify(native),roomId:session.roomId,memberId:session.memberId,unchanged,late})
 return{stage,resolved:structuredClone(native)}
}
/** The existing Page calls Base once with its actual prefix. Every supplied
 * mechanical material must match this private Native stage before Base runs.
 * Its service callbacks remain the original Page callbacks. */
export async function settleBountifulMonsterZeroNativeStage(stage:BountifulMonsterZeroNativeStage,input:BaseInput,gateway:Gateway){
 const proof=nativeStages.get(stage),session=host()
 if(!proof||proof.roomId!==session.roomId||proof.memberId!==session.memberId||!proof.unchanged()||proof.signature!==JSON.stringify(proof.native)||!proof.native.result.ok||!proof.native.application)throw Error('monster-zero-stage:actual-unchanged-native-required')
 readDnd5eActualMonsterFacadeResult(proof.ready.source.prepared,proof.native)
 if(proof.late)await readBountifulMonsterSavingLateCompletion(proof.late)
 const actual=await readBountifulMonsterDamageZeroOriginalQualification(proof.qualification,proof.original),prepared=proof.ready.source.prepared
 if(!same(input.result,proof.native.result)||!(same(input.map,prepared.map)||same(input.map,proof.native.application.map))||!(same(input.characters,prepared.characters)||same(input.characters,proof.native.application.characters))||!same(input.characterIdByCombatantId,prepared.characterIdByCombatantId)||input.priorState!==undefined&&!same(input.priorState,prepared.state)||input.priorApplication!==undefined&&!same(input.priorApplication,proof.native.application)||input.hostParentTransactionId!==undefined&&input.hostParentTransactionId!==actual.parentId||input.followupTransactionNow!==undefined&&input.followupTransactionNow()!==actual.effectTimestamp||input.resumeActivityStage!==undefined)throw Error('monster-zero-stage:exact-native-base-prefix-required')
 const previous=settledStages.get(stage);if(previous){readDnd5eCompletedCombatBase(proof.native.result,previous.settled);return{publication:previous.publication,resolved:structuredClone(previous.settled)}}
 if(activeStages.has(stage))throw Error('monster-zero-stage:base-already-running');activeStages.add(stage)
 let settled:Settled;try{settled=await settleDnd5eConcentrationChecks({...input,result:proof.native.result,priorState:prepared.state,hostParentTransactionId:actual.parentId,followupTransactionNow:()=>actual.effectTimestamp})}finally{activeStages.delete(stage)}
 readDnd5eCompletedCombatBase(proof.native.result,settled)
 readDnd5eActualMonsterFacadeResult(prepared,proof.native)
 const current=await readBountifulMonsterZeroOriginalReady(proof.qualification,proof.original,gateway),now=host()
 if(!proof.unchanged()||now.roomId!==proof.roomId||now.memberId!==proof.memberId||!same(current.receipts,proof.ready.receipts)||settled.application.geometry||proof.signature!==JSON.stringify(proof.native))throw Error('monster-zero-stage:changed-completed-original')
 const publication=Object.freeze({})as BountifulMonsterZeroPublication;issued.set(publication,{qualification:proof.qualification,original:proof.original,ready:proof.ready,native:proof.native,settled,signature:JSON.stringify({native:proof.native,settled}),roomId:proof.roomId,memberId:proof.memberId,unchanged:proof.unchanged,late:proof.late})
 settledStages.set(stage,{publication,settled});return{publication,resolved:structuredClone(settled)}
}
