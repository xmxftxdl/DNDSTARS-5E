import{dnd5eRulesPluginRegistrySnapshot}from'./pluginApi'
import{readDnd5eSpellWindowOriginalSessionClock,type Dnd5eSpellWindowOriginalSessionClock}from'./spellWindowOriginalSessionClock'
import{captureDnd5eActualTempestuousPreparedSpellAttackWindow,readCapturedDnd5ePreparedSpellAttackWindow}from'./spellAction'
import{withDnd5eActualTempestuousBeforeLandingReplay,readDnd5eActualTempestuousBeforeSpellMovement}from'./headlessCombatEngine'
import{createDnd5ePreparedDamageCommitSession,captureDnd5eTempestuousBeforeSpellOriginalOperation,withDnd5eTempestuousBeforeOriginalClock,readDnd5eActiveTempestuousBeforeOriginalVisits,type Dnd5eTempestuousBeforeSpellOriginalOperation}from'./damageCommitSession'
import{getRoomSession}from'../../lib/roomSession'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{tokenCenterForAnchorCell}from'../../lib/gridCombat'
import{restoreTempestuousBeforeAcceptedPreparation}from'./tempestuousBeforeAcceptedPreparation'
import type{TempestuousBeforePreparationIdentity,TempestuousBeforeOriginalPreparationLoader}from'./tempestuousBeforeOriginalPreparation'
import{withDnd5eActualTempestuousPreparedReplay,hasDnd5eTempestuousPreparedRecoveryFacts,resolvePreparedDnd5eSpellCast,stripDnd5eTempestuousPreparedContinuity}from'./spellAction'
import{withTempestuousBeforeSpellOffers,type TempestuousBeforeSpellOfferChoice}from'./tempestuousBeforeSpellOffer'
import{cloneDnd5eHostTransactionInput,cloneDnd5eHostTransactionInputForOwnedUse}from'./hostTransactionClone'
import{originalD20ReplaySourceKey,type OriginalD20ReplayFacts}from'./allyNaturalOneCheckpoint'
type Source=Parameters<typeof resolvePreparedDnd5eSpellCast>[0]&{hostOriginalD20Replay?:OriginalD20ReplayFacts}
type Restored=Awaited<ReturnType<typeof restoreTempestuousBeforeAcceptedPreparation>>
const issued=new WeakMap<object,{registry:number;roomId:string;memberId:string;recovered:Restored;prepared:string;fixed:Record<string,unknown>;effectRolls:readonly number[];choice?:TempestuousBeforeSpellOfferChoice;clockOperation:Dnd5eTempestuousBeforeSpellOriginalOperation}>(),signature=(v:unknown)=>JSON.stringify(encodeSecondChanceParentWire(v))
/** The token is separate from the plain source. It carries no raw/world rights. */
export async function issueTempestuousBeforePreparedOriginalReplay(identity:TempestuousBeforePreparationIdentity,load:TempestuousBeforeOriginalPreparationLoader,landing?:Parameters<typeof restoreTempestuousBeforeAcceptedPreparation>[2]){
 const registry=dnd5eRulesPluginRegistrySnapshot(),host=getRoomSession();if(host?.role!=='dm')throw Error('tempestuous-before-replay:actual-host-required')
 const recovered=await restoreTempestuousBeforeAcceptedPreparation(identity,load,landing),current=getRoomSession();if(current?.role!=='dm'||current.roomId!==host.roomId||current.memberId!==host.memberId)throw Error('tempestuous-before-replay:changed-host')
 const {book,source}=recovered,decision=(book as typeof book&{ownerDecision:{decision:{kind:string;selection?:{frameId:string;featureId:string;cell:{col:number;row:number};elevationFeet:number}}}}).ownerDecision.decision;let choice:TempestuousBeforeSpellOfferChoice|undefined
 if(decision.kind==='use'){const selected=decision.selection!,actor=source.prepared.map.tokens.find(token=>token.id===book.frame.actorId);if(!actor||recovered.result.status!=='pending-tempestuous-before-cast')throw Error('tempestuous-before-replay:actual-consumed-movement-required');choice={frameId:selected.frameId,featureId:selected.featureId,to:tokenCenterForAnchorCell(selected.cell,actor,source.prepared.map),elevationFeet:selected.elevationFeet}}
 const nativeSession=createDnd5ePreparedDamageCommitSession(source,resolvePreparedDnd5eSpellCast,()=>false,undefined,undefined,identity.parentId,true,true);let clockOperation:Dnd5eTempestuousBeforeSpellOriginalOperation
 try{const pending=nativeSession.run(source.prepared.state);if(pending.status!=='pending-tempestuous-before-spell'||JSON.stringify(pending.frame)!==JSON.stringify(book.frame)||JSON.stringify(pending.snapshot)!==book.prefixSignature||pending.effectTimestamp!==book.effectTimestamp)throw Error('tempestuous-before-replay:actual-clock-occurrence-required');clockOperation=captureDnd5eTempestuousBeforeSpellOriginalOperation(pending)}finally{nativeSession.cancel()}
 if(dnd5eRulesPluginRegistrySnapshot()!==registry)throw Error('tempestuous-before-replay:changed-original-provider')
 const token=Object.freeze({}),fixed=Object.fromEntries(Object.entries(source).filter(([key])=>!['prepared','effectRolls','hostOriginalD20Replay'].includes(key)));issued.set(token,{registry,roomId:host.roomId!,memberId:host.memberId!,recovered:{...recovered,book:structuredClone(book)},prepared:JSON.stringify(source.prepared),fixed,effectRolls:[...source.effectRolls],choice,clockOperation});return token
}
function proofFor(source:Source,token:object){
 const row=issued.get(token),host=getRoomSession();if(!row||row.registry!==dnd5eRulesPluginRegistrySnapshot()||host?.role!=='dm'||host.roomId!==row.roomId||host.memberId!==row.memberId||JSON.stringify(source.prepared)!==row.prepared)throw Error('tempestuous-before-replay:actual-same-original-source-required')
 if(!hasDnd5eTempestuousPreparedRecoveryFacts(row.recovered.source))throw Error('tempestuous-before-replay:current-canonical-source-required')
 for(const[key,value]of Object.entries(row.fixed))if(signature((source as unknown as Record<string,unknown>)[key])!==signature(value))throw Error('tempestuous-before-replay:changed-earlier-input')
 if(row.effectRolls.length&&signature(source.effectRolls)!==signature(row.effectRolls))throw Error('tempestuous-before-replay:changed-original-effect-pool')
 const clock=(source as Source&{hostOriginalD20Replay?:{effectTimestamp?:number}}).hostOriginalD20Replay?.effectTimestamp;if(clock!==undefined&&clock!==row.recovered.book.effectTimestamp)throw Error('tempestuous-before-replay:original-clock-required')
 return row
}
function withActualLandingReplay<T>(row:ReturnType<typeof proofFor>,run:()=>T):T{const recovered=row.recovered;return 'nativeMovementOperation'in recovered&&recovered.nativeMovementOperation?withDnd5eActualTempestuousBeforeLandingReplay(recovered.nativeMovementOperation,run):run()}
/** The protected book supplies the original empty-facts clock only when the
 * candidate has none; existing replay facts remain intact for native validation. */
export function tempestuousBeforePreparedOriginalInput(source:Source,token:object):Source&{hostOriginalD20Replay?:OriginalD20ReplayFacts}{
 const row=proofFor(source,token),copy=cloneDnd5eHostTransactionInput(source),existing=(copy as Source&{hostOriginalD20Replay?:unknown}).hostOriginalD20Replay
 return existing!==undefined?copy:{...copy,hostOriginalD20Replay:{parentId:row.recovered.book.parentId,sourceKey:originalD20ReplaySourceKey(row.recovered.book.parentId,copy.prepared.state,copy.prepared.action,row.recovered.book.effectTimestamp),effectTimestamp:row.recovered.book.effectTimestamp,facts:[]}}
}
/** This factory owns its first copy through strip and the same live proof.
 * Only allocation metadata can remove the second, otherwise identical clone. */
export function tempestuousBeforeCollectorOriginalInput(source:Source,token:object):Source&{hostOriginalD20Replay?:OriginalD20ReplayFacts}{
 const owned=cloneDnd5eHostTransactionInputForOwnedUse(source),plain=owned.copy
 if(!stripDnd5eTempestuousPreparedContinuity(plain))throw Error('tempestuous-before-collector:actual-plain-original-required')
 const row=proofFor(plain,token),copy=owned.currentDetachedData()?plain:cloneDnd5eHostTransactionInput(plain),existing=(copy as Source&{hostOriginalD20Replay?:unknown}).hostOriginalD20Replay
 return existing!==undefined?copy:{...copy,hostOriginalD20Replay:{parentId:row.recovered.book.parentId,sourceKey:originalD20ReplaySourceKey(row.recovered.book.parentId,copy.prepared.state,copy.prepared.action,row.recovered.book.effectTimestamp),effectTimestamp:row.recovered.book.effectTimestamp,facts:[]}}
}
/** Only the real canonical resolver's synchronous native call gets this exact
 * owner transcript. Source wire and resolver function identity are unchanged. */
export function withTempestuousBeforePreparedOriginalReplay<T>(source:Source,token:object,runNative:()=>T):T{
 const row=proofFor(source,token),run=()=>withActualLandingReplay(row,runNative),book=row.recovered.book;let visited=0
 if((source as Source&{hostOriginalD20Replay?:{effectTimestamp?:number}}).hostOriginalD20Replay?.effectTimestamp!==book.effectTimestamp)throw Error('tempestuous-before-replay:original-clock-required')
 return withDnd5eActualTempestuousPreparedReplay(row.recovered.source.prepared,()=>withTempestuousBeforeSpellOffers(book.parentId,(frame,state)=>{if(visited++!==0||signature(frame)!==signature(book.frame)||JSON.stringify(state)!==book.prefixSignature)throw Error('tempestuous-before-replay:exact-native-owner-prefix-required');return row.choice&&structuredClone(row.choice)},()=>{const result=run();if(result&&typeof(result as{then?:unknown}).then==='function')throw Error('tempestuous-before-replay:sync-only');if(visited!==1)throw Error('tempestuous-before-replay:actual-owner-prefix-not-consumed');proofFor(source,token);return result}))
}

/** The real Native Session consumes an issuer-bound clock without decorating
 * its original input with replay metadata or a serialized capability. */
let activePlainOriginalReplay:{token:object;operation:Dnd5eTempestuousBeforeSpellOriginalOperation;sourceSignature:string;bookSignature:string;choiceSignature:string}|undefined
export function withTempestuousBeforePlainOriginalReplay<T>(source:Source,token:object,runNative:()=>T):T{
  const row=proofFor(source,token),run=()=>withActualLandingReplay(row,runNative),sourceSignature=JSON.stringify(source),bookSignature=signature(row.recovered.book),choiceSignature=signature(row.choice),previous=activePlainOriginalReplay
  // A real final Spell can arrive through both its Heart transport and its
  // material-flow transport. Exact current private books identify one before
  // operation; its actual Native visit must consume the existing outer clock.
  if(previous&&previous.sourceSignature===sourceSignature&&previous.bookSignature===bookSignature&&previous.choiceSignature===choiceSignature){
    proofFor(source,previous.token)
    const visits=readDnd5eActiveTempestuousBeforeOriginalVisits(previous.operation)
    if(runNative.constructor.name==='AsyncFunction')throw Error('tempestuous-native-clock:sync-only')
    const result=run()
    if(result&&typeof(result as{then?:unknown}).then==='function')throw Error('tempestuous-native-clock:sync-only')
    if(readDnd5eActiveTempestuousBeforeOriginalVisits(previous.operation)<=visits)throw Error('tempestuous-native-clock:actual-prefix-not-reached')
    proofFor(source,previous.token);proofFor(source,token)
    return result
  }
  activePlainOriginalReplay={token,operation:row.clockOperation,sourceSignature,bookSignature,choiceSignature}
  try{return withDnd5eActualTempestuousPreparedReplay(row.recovered.source.prepared,()=>withDnd5eTempestuousBeforeOriginalClock(row.clockOperation,row.choice,()=>{const result=run();proofFor(source,token);return result}))}finally{activePlainOriginalReplay=previous}
}

/** Read-only source matching; this returns no capability or native outcome. */
export function assertTempestuousBeforePreparedOriginalReplaySource(source:Source,token:object):void{proofFor(source,token)}

/** Read-only identity for an already issued private owner replay; never a setter. */
export function readTempestuousBeforePreparedOriginalReplayBookSignature(source:Source,token:object):string{const book=proofFor(source,token).recovered.book as unknown as Record<string,unknown>;if(Object.hasOwn(book,'present')){if(book.present!==true)throw Error('tempestuous-before-replay:exact-probe-presence-required');const{present:_,...facts}=book;return signature(facts)}return signature(book)}

/** Actual first target-window state only. The private owner replay and the
 * existing canonical window clock must both still refer to this same cast.
 * No target rolls, owner answer, Room capability or outcome is returned. */
export function captureTempestuousBeforeSpellWindowPreview(source:Source,token:object,clock:Dnd5eSpellWindowOriginalSessionClock){
 const row=proofFor(source,token),actual=row.recovered.source,original=readDnd5eSpellWindowOriginalSessionClock(clock,actual,resolvePreparedDnd5eSpellCast)
 if(original.effectTimestamp!==row.recovered.book.effectTimestamp||original.parentId!==actual.prepared.action.id||!original.current())throw Error('tempestuous-before-window:same-original-clock-required')
 const window=captureDnd5eActualTempestuousPreparedSpellAttackWindow(actual.prepared,token,original.effectTimestamp),read=readCapturedDnd5ePreparedSpellAttackWindow(window)
 proofFor(source,token);if(!original.current()||read.parentId!==original.parentId||read.now!==original.effectTimestamp||read.attackIndex!==0||read.stage!=='target'||read.preceding.length||read.raw)throw Error('tempestuous-before-window:actual-first-target-required')
 return{status:'spell-attack-target-window' as const,snapshot:structuredClone(read.state)}
}

/** True completed Native ground movement needs no landing resolver. This
 * boolean grants no source, raw, cast, movement or publication capability. */
export function tempestuousBeforePreparedReplayHasNoLandingBoundary(source:Source,token:object):boolean{
 const row=proofFor(source,token)
 if(!row.choice)return true
 const recovered=row.recovered
 if(!('nativeMovementOperation'in recovered)||!recovered.nativeMovementOperation)return false
 const native=readDnd5eActualTempestuousBeforeSpellMovement(recovered.nativeMovementOperation),actor=native.state.combatants[native.frame.actorId],original=recovered.source.prepared.state.combatants[native.frame.actorId]
 return row.choice.elevationFeet===0&&(original?.groundElevationFeet??0)===0&&native.frame.actualPosition.elevationFeet===0&&(actor?.groundElevationFeet??0)===0&&native.action.tempestuousMovementRolls===undefined
}

/** Read-only mechanical origin of this exact private before choice. It grants
 * no target, dice, actor answer or world permission. */
export function readTempestuousBeforePreparedOriginalMovement(source:Source,token:object):object|undefined{
 const row=proofFor(source,token);if(!row.choice)return
 const recovered=row.recovered;if(!('nativeMovementOperation'in recovered)||!recovered.nativeMovementOperation)throw Error('tempestuous-before-replay:actual-native-movement-required')
 const movement=readDnd5eActualTempestuousBeforeSpellMovement(recovered.nativeMovementOperation)
 if(movement.frame.parentId!==source.prepared.action.id||movement.frame.actorId!==source.prepared.actorToken.id||!movement.frame.movementCompleted||movement.frame.actualPosition.x!==row.choice.to.x||movement.frame.actualPosition.y!==row.choice.to.y)throw Error('tempestuous-before-replay:same-completed-native-movement-required')
 return recovered.nativeMovementOperation
}
