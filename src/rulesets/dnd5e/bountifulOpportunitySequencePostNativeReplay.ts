import{dnd5eActualOpportunityMovePreparationCurrent}from'./opportunityMoveSequence'
import{readBountifulOpportunitySequenceMovementCompletionReplayFacts}from'./bountifulOpportunitySequenceMovement'
import{readDnd5eSequenceConcentrationOriginalReplayFacts,readDnd5eSequenceMovementConcentrationOriginalReplayFacts,dnd5eSequenceConcentrationOriginalActive}from'../../pages/maps/settleDnd5eCombatResult'
import{readDnd5eSequenceMovementOriginalReplayFacts,dnd5eSequenceMovementOriginalActive}from'../../pages/maps/movementHazardsProducer'
import{getRoomSession}from'../../lib/roomSession'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{registerDnd5eHostReceipt,registerDnd5eHostReceiptSlot,cloneDnd5eHostTransactionInput}from'./hostTransactionClone'
import{readBountifulOpportunitySequencePostNativeCompletionReplayFacts}from'./bountifulOpportunitySequencePostNative'
type Prepared={action:{id:string}}
export type BountifulSequenceConcentrationPoolIdentity={frame:object;rawRequestIds:readonly string[];ordinal:number;values:readonly number[]}
const slot=Symbol('actual-opportunity-sequence-post-native-replay')
registerDnd5eHostReceiptSlot(slot)
type MovementOriginalReplay={movementOriginals?:readonly object[];movementPools?:readonly BountifulSequenceConcentrationPoolIdentity[];movementConcentrationOriginals?:readonly object[];movementConcentrationPools?:readonly BountifulSequenceConcentrationPoolIdentity[]}
const issued=new WeakMap<object,{parentId:string;prepared:string;caps:readonly object[];movementCaps:readonly object[];concentrationOriginals:readonly object[];concentrationPools:readonly BountifulSequenceConcentrationPoolIdentity[];movementOriginals:readonly object[];movementPools:readonly BountifulSequenceConcentrationPoolIdentity[];movementConcentrationOriginals:readonly object[];movementConcentrationPools:readonly BountifulSequenceConcentrationPoolIdentity[];roomId:string;memberId:string}>()
const signature=(v:unknown)=>JSON.stringify(encodeSecondChanceParentWire(v))
export function issueBountifulOpportunitySequencePostNativeReplay(prepared:Prepared,caps:readonly object[],movementCaps:readonly object[]=[],concentrationOriginals:readonly object[]=[],concentrationPools:readonly BountifulSequenceConcentrationPoolIdentity[]=[],movement:MovementOriginalReplay={}){
 const host=getRoomSession(),key=signature(prepared),keySignature=key
 const movementOriginals=movement.movementOriginals??[],movementPools=movement.movementPools??[],movementConcentrationOriginals=movement.movementConcentrationOriginals??[],movementConcentrationPools=movement.movementConcentrationPools??[]
 if(host?.role!=='dm'||caps.length===0&&movementCaps.length===0&&concentrationOriginals.length===0&&movementOriginals.length===0&&movementConcentrationOriginals.length===0)throw Error('opportunity-sequence-post-replay:actual-base-completions-required')
 let previous=-1
 for(const cap of caps){const fact=readBountifulOpportunitySequencePostNativeCompletionReplayFacts(cap);if(fact.parentId!==prepared.action.id||fact.prepared!==key||fact.windowIndex<=previous)throw Error('opportunity-sequence-post-replay:actual-ordered-prefix-required');previous=fact.windowIndex}
 let previousSegment=-1;for(const cap of movementCaps){const fact=readBountifulOpportunitySequenceMovementCompletionReplayFacts(cap);if(fact.parentId!==prepared.action.id||fact.prepared!==key||fact.segmentIndex!==previousSegment+1)throw Error('opportunity-sequence-post-replay:actual-ordered-movements-required');previousSegment=fact.segmentIndex}
 let previousOperationWindow=-1;const operationIds=new Set<string>();for(const frame of concentrationOriginals){const fact=readDnd5eSequenceConcentrationOriginalReplayFacts(frame);if(fact.parentId!==prepared.action.id||fact.prepared!==key||fact.windowIndex<previousOperationWindow||operationIds.has(fact.operationId))throw Error('opportunity-sequence-post-replay:actual-ordered-original-operations-required');operationIds.add(fact.operationId);previousOperationWindow=fact.windowIndex}
 const seenPools=new Set<object>();for(const pool of concentrationPools){const fact=readDnd5eSequenceConcentrationOriginalReplayFacts(pool.frame);if(!concentrationOriginals.includes(pool.frame)||seenPools.has(pool.frame)||!Number.isSafeInteger(pool.ordinal)||pool.ordinal<0||pool.rawRequestIds.length!==fact.raw.length||new Set(pool.rawRequestIds).size!==pool.rawRequestIds.length||pool.rawRequestIds.some(id=>!/^bountiful-opportunity-settlement:[a-f0-9]{64}$/.test(id))||JSON.stringify(pool.values)!==JSON.stringify(fact.raw))throw Error('opportunity-sequence-post-replay:exact-original-pool-identity-required');seenPools.add(pool.frame)}
 let lastMovementSegment=-1,lastMovementOperation=-1;const movementIds=new Set<string>();for(const frame of movementOriginals){const fact=readDnd5eSequenceMovementOriginalReplayFacts(frame);if(fact.parentId!==prepared.action.id||fact.prepared!==key||fact.segmentIndex<lastMovementSegment||fact.segmentIndex===lastMovementSegment&&fact.operationIndex<=lastMovementOperation||movementIds.has(fact.operationId))throw Error('opportunity-sequence-post-replay:actual-ordered-movement-originals-required');lastMovementSegment=fact.segmentIndex;lastMovementOperation=fact.operationIndex;movementIds.add(fact.operationId)}
 const seenMovementPools=new Set<object>();for(const pool of movementPools){const fact=readDnd5eSequenceMovementOriginalReplayFacts(pool.frame);if(!movementOriginals.includes(pool.frame)||seenMovementPools.has(pool.frame)||!Number.isSafeInteger(pool.ordinal)||pool.ordinal<0||pool.rawRequestIds.length<1||pool.rawRequestIds.length>fact.raw.length||new Set(pool.rawRequestIds).size!==pool.rawRequestIds.length||pool.rawRequestIds.some(id=>!/^bountiful-opportunity-settlement:[a-f0-9]{64}$/.test(id))||JSON.stringify(pool.values)!==JSON.stringify(fact.raw))throw Error('opportunity-sequence-post-replay:exact-movement-original-pool-identity-required');seenMovementPools.add(pool.frame)}
 let previousMovementCon:readonly number[]=[-1,-1,-1];const movementConIds=new Set<string>();for(const frame of movementConcentrationOriginals){const fact=readDnd5eSequenceMovementConcentrationOriginalReplayFacts(frame),key=[fact.segmentIndex,fact.operationIndex,fact.checkIndex];if(fact.parentId!==prepared.action.id||fact.prepared!==keySignature||lex(key,previousMovementCon)<=0||movementConIds.has(fact.operationId))throw Error('opportunity-sequence-post-replay:actual-ordered-movement-CON-originals-required');previousMovementCon=key;movementConIds.add(fact.operationId)}
 const seenMovementConPools=new Set<object>();for(const pool of movementConcentrationPools){const fact=readDnd5eSequenceMovementConcentrationOriginalReplayFacts(pool.frame);if(!movementConcentrationOriginals.includes(pool.frame)||seenMovementConPools.has(pool.frame)||!Number.isSafeInteger(pool.ordinal)||pool.ordinal<0||pool.rawRequestIds.length!==fact.raw.length||new Set(pool.rawRequestIds).size!==pool.rawRequestIds.length||pool.rawRequestIds.some(id=>!/^bountiful-opportunity-settlement:[a-f0-9]{64}$/.test(id))||JSON.stringify(pool.values)!==JSON.stringify(fact.raw))throw Error('opportunity-sequence-post-replay:exact-movement-CON-pool-identity-required');seenMovementConPools.add(pool.frame)}
 const receipt=registerDnd5eHostReceipt(Object.freeze({}));issued.set(receipt,{parentId:prepared.action.id,prepared:key,caps:[...caps],movementCaps:[...movementCaps],concentrationOriginals:[...concentrationOriginals],concentrationPools:concentrationPools.map(pool=>({...pool,rawRequestIds:[...pool.rawRequestIds],values:[...pool.values]})),movementOriginals:[...movementOriginals],movementPools:movementPools.map(pool=>({...pool,rawRequestIds:[...pool.rawRequestIds],values:[...pool.values]})),movementConcentrationOriginals:[...movementConcentrationOriginals],movementConcentrationPools:movementConcentrationPools.map(pool=>({...pool,rawRequestIds:[...pool.rawRequestIds],values:[...pool.values]})),roomId:host.roomId,memberId:host.memberId});return receipt
}
function proofFor(source:{prepared:Prepared},replay:object){
 const proof=issued.get(replay),host=getRoomSession()
 if(!proof||host?.role!=='dm'||proof.roomId!==host.roomId||proof.memberId!==host.memberId||proof.parentId!==source.prepared.action.id||proof.prepared!==signature(source.prepared))throw Error('opportunity-sequence-post-replay:exact-live-native-source-required')
 for(const cap of proof.caps)readBountifulOpportunitySequencePostNativeCompletionReplayFacts(cap);for(const cap of proof.movementCaps)readBountifulOpportunitySequenceMovementCompletionReplayFacts(cap);for(const frame of proof.concentrationOriginals)readDnd5eSequenceConcentrationOriginalReplayFacts(frame);for(const frame of proof.movementOriginals)readDnd5eSequenceMovementOriginalReplayFacts(frame);for(const frame of proof.movementConcentrationOriginals)readDnd5eSequenceMovementConcentrationOriginalReplayFacts(frame)
 return proof
}
/** Keeps only an issuer-held capability through the existing native clone seam.
 * Callers persist the undecorated source. No result or state graph is accepted. */
export function withBountifulOpportunitySequencePostNativeReplay<T extends{prepared:Prepared}>(source:T,replay:object):T{
 proofFor(source,replay)
 const decorated=cloneDnd5eHostTransactionInput(source)
 // Preserve only an already-issued exact mechanical preparation; a copied
 // source retains no identity. The existing private replay proof is unchanged.
 if(dnd5eActualOpportunityMovePreparationCurrent(source.prepared))decorated.prepared=source.prepared
 Object.defineProperty(decorated,slot,{value:replay,enumerable:true,configurable:false,writable:false})
 return decorated
}
export function readBountifulOpportunitySequencePostNativeReplay(source:{prepared:Prepared}){
 const replay=(source as unknown as Record<symbol,unknown>)[slot]
 if(replay===undefined)return undefined
 if(!replay||typeof replay!=='object')throw Error('opportunity-sequence-post-replay:exact-live-native-source-required')
 return proofFor(source,replay).caps
}

export function readBountifulOpportunitySequenceMovementReplay(source:{prepared:Prepared}){const replay=(source as unknown as Record<symbol,unknown>)[slot];if(replay===undefined)return undefined;if(!replay||typeof replay!=='object')throw Error('opportunity-sequence-post-replay:exact-live-native-source-required');return proofFor(source,replay).movementCaps}
export function readBountifulOpportunitySequenceConcentrationOriginalReplay(source:{prepared:Prepared}){const replay=(source as unknown as Record<symbol,unknown>)[slot];if(replay===undefined)return undefined;if(!replay||typeof replay!=='object')throw Error('opportunity-sequence-post-replay:exact-live-native-source-required');return proofFor(source,replay).concentrationOriginals}
/** Undefined preserves ordinary sessions. A real operation bundle can pause
 * only its last actual Base frame, never an earlier same-actor CON window. */
export function bountifulSequenceConcentrationOriginalTargetActive(source:object,request:{actorId:string;kind:string}){const replay=(source as Record<symbol,unknown>)[slot];if(replay===undefined)return undefined;if(!replay||typeof replay!=='object')throw Error('opportunity-sequence-post-replay:exact-live-native-source-required');const current=currentOriginal(proofFor(source as{prepared:Prepared},replay));return current&&request.actorId===current.fact.actorId&&request.kind===current.fact.kind?current.active(current.frame):undefined}
export function readBountifulOpportunitySequenceMovementOriginalReplay(source:{prepared:Prepared}){const replay=(source as unknown as Record<symbol,unknown>)[slot];if(replay===undefined)return undefined;if(!replay||typeof replay!=='object')throw Error('opportunity-sequence-post-replay:exact-live-native-source-required');return proofFor(source,replay).movementOriginals}
/** These are pool identities, not raw/adoption evidence. The authenticated C
 * registration and first-mint gate independently verify every private slot. */
export function readBountifulSequenceConcentrationOriginalTarget(source:{prepared:Prepared},replay:object){
 const proof=proofFor(source,replay),frame=proof.concentrationOriginals.at(-1)
 if(!frame)return undefined
 const fact=readDnd5eSequenceConcentrationOriginalReplayFacts(frame),pool=proof.concentrationPools.find(pool=>pool.frame===frame)
 if(!pool)throw Error('opportunity-sequence-post-replay:actual-original-pool-identity-required')
 return {...fact,rawRequestIds:[...pool.rawRequestIds],rawIssuer:{mode:'dm' as const,rollId:pool.rawRequestIds[0]!,cursor:pool.ordinal+1}}
}
/** Current saving original only. Pool metadata names existing private slots;
 * the dedicated server branch independently checks their raw/adoption facts. */
const lex=(left:readonly number[],right:readonly number[])=>{for(let i=0;i<Math.max(left.length,right.length);i++){const difference=(left[i]??0)-(right[i]??0);if(difference)return difference}return 0}
type CurrentOriginalFact=ReturnType<typeof readDnd5eSequenceConcentrationOriginalReplayFacts>|ReturnType<typeof readDnd5eSequenceMovementOriginalReplayFacts>|ReturnType<typeof readDnd5eSequenceMovementConcentrationOriginalReplayFacts>
function currentOriginal(proof:NonNullable<ReturnType<typeof issued.get>>){const all:{frame:object;fact:CurrentOriginalFact;pools:readonly BountifulSequenceConcentrationPoolIdentity[];sourcePhase:'post-native'|'movement-hazards';key:readonly number[];active:(frame:object)=>boolean}[]=[];const con=proof.concentrationOriginals.at(-1),movement=proof.movementOriginals.at(-1),movementCon=proof.movementConcentrationOriginals.at(-1);if(con){const fact=readDnd5eSequenceConcentrationOriginalReplayFacts(con);all.push({frame:con,fact,pools:proof.concentrationPools,sourcePhase:'post-native',key:[fact.windowIndex*2+1,0,0,0],active:dnd5eSequenceConcentrationOriginalActive})}if(movement){const fact=readDnd5eSequenceMovementOriginalReplayFacts(movement);all.push({frame:movement,fact,pools:proof.movementPools,sourcePhase:'movement-hazards',key:[fact.segmentIndex*2,fact.operationIndex,0,0],active:dnd5eSequenceMovementOriginalActive})}if(movementCon){const fact=readDnd5eSequenceMovementConcentrationOriginalReplayFacts(movementCon);all.push({frame:movementCon,fact,pools:proof.movementConcentrationPools,sourcePhase:'movement-hazards',key:[fact.segmentIndex*2,fact.operationIndex,1,fact.checkIndex],active:dnd5eSequenceConcentrationOriginalActive})}return all.sort((a,b)=>lex(a.key,b.key)).at(-1)}
export function readBountifulOpportunitySequenceMovementConcentrationOriginalReplay(source:{prepared:Prepared}){const replay=(source as unknown as Record<symbol,unknown>)[slot];if(replay===undefined)return undefined;if(!replay||typeof replay!=='object')throw Error('opportunity-sequence-post-replay:exact-live-native-source-required');return proofFor(source,replay).movementConcentrationOriginals}
export function readBountifulSequenceOriginalTarget(source:{prepared:Prepared},replay:object){const current=currentOriginal(proofFor(source,replay));if(!current)return undefined;const pool=current.pools.find(row=>row.frame===current.frame);if(!pool)throw Error('opportunity-sequence-post-replay:actual-current-original-pool-identity-required');return{...current.fact,sourcePhase:current.sourcePhase,rawRequestIds:[...pool.rawRequestIds],rawIssuer:{mode:'dm'as const,rollId:pool.rawRequestIds[0]!,cursor:pool.ordinal+1}}}

/** Data projection for the actual Fury operation's description only. The
 * current private replay is verified before omitting precisely its own slot;
 * this reader neither restores it nor serializes a caller capability. */
export function readStormFuryMovePlainOriginalSource(input:unknown):unknown{
 if(!input||typeof input!=='object')return input
 const row=input as Record<symbol,unknown>,replay=row[slot]
 if(replay===undefined)return input
 if(!replay||typeof replay!=='object'||Reflect.ownKeys(input).some(key=>typeof key==='symbol'&&key!==slot))throw Error('storm-fury-move:exact-existing-replay-required')
 proofFor(input as{prepared:Prepared},replay)
 return cloneDnd5eHostTransactionInput(Object.fromEntries(Object.entries(input)))
}
