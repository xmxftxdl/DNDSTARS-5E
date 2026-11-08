import{deriveDnd5eMonsterDamageZeroHeldSavingInput}from'./monsterDamageZeroOriginalContext'
import{getRoomSession}from'../../lib/roomSession'
import{readDnd5eActualOriginalReadyBoundary,readDnd5eActualDamageZeroOriginalBoundary}from'./damageCommitSession'
import{buildDnd5eMonsterDamageZeroOriginalSource,readDnd5eMonsterDamageZeroOriginalOperation}from'./damageZeroMonsterOriginalOperation'
import{resolvePreparedDnd5eMonsterAttack}from'./monsterAttackAction'
declare const savingLate:unique symbol
/** Data lineage at the actual post-original saving stage. This is not a die,
 * consent, result or publication authority. A future transport must separately
 * validate the live private original/ready ledger before issuing any slot. */
export type BountifulMonsterDamageZeroSavingLateCheckpoint={readonly[savingLate]:true}
const issued=new WeakMap<object,{roomId:string;memberId:string;result:object;signature:string}>()
const host=()=>{const s=getRoomSession();if(s?.role!=='dm'||!s.roomId||!s.memberId)throw Error('monster-zero-save-late:actual-host-required');return s}
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
function actual(result:object){
 const ready=readDnd5eActualOriginalReadyBoundary(result)
 if(ready.resolve!==resolvePreparedDnd5eMonsterAttack||ready.request.kind!=='saving-throw')throw Error('monster-zero-save-late:actual-zero-saving-ready-required')
 const lineage=readDnd5eActualDamageZeroOriginalBoundary(result),completed=buildDnd5eMonsterDamageZeroOriginalSource(result),record=completed.operations[0]
 if(lineage.resolve!==resolvePreparedDnd5eMonsterAttack||completed.operations.length!==1||!record?.choice||record.frame.targetId!==ready.request.actorId||ready.snapshot.combatants[ready.request.actorId]?.currentHp!==0||record.frame.parentId!==completed.source.transactionId||record.frame.sourceId!==completed.source.prepared.actorToken.id||!same(record.choice.rolls,ready.request.originalRolls))throw Error('monster-zero-save-late:exact-native-zero-original-required')
 const origin=readDnd5eMonsterDamageZeroOriginalOperation(record.operation),mode=ready.request.rollMode??record.frame.mode,count=mode==='normal'?1:2
 if(mode!==record.frame.mode||ready.request.originalRolls.length!==count||ready.request.values.length!==count||ready.request.values.some(value=>!Number.isInteger(value)||value<1||value>20)||ready.request.finalizedDice.some(index=>!Number.isSafeInteger(index)||index<0||index>=count)||new Set(ready.request.finalizedDice).size!==ready.request.finalizedDice.length||!same(origin.frame,record.frame)||origin.prefixSignature!==record.prefixSignature||origin.effectTimestamp!==lineage.effectTimestamp)throw Error('monster-zero-save-late:exact-native-retained-pool-required')
 const prefixKeys=['frameId','featureId','rolls','blessRoll','baneRoll'];if(Object.entries(record.choice).some(([key,value])=>value!==undefined&&!prefixKeys.includes(key)))throw Error('monster-zero-save-late:uncollected-late-input-required')
 return{source:completed.source,frame:structuredClone(record.frame),prefix:structuredClone(record.choice),prefixSignature:record.prefixSignature,effectTimestamp:lineage.effectTimestamp,request:structuredClone(ready.request),state:structuredClone(ready.snapshot)}
}
export function captureBountifulMonsterDamageZeroSavingLateCheckpoint(result:object):BountifulMonsterDamageZeroSavingLateCheckpoint{const session=host(),facts=actual(result),cap=Object.freeze({})as BountifulMonsterDamageZeroSavingLateCheckpoint;issued.set(cap,{roomId:session.roomId,memberId:session.memberId,result,signature:JSON.stringify(facts)});return cap}
export function readBountifulMonsterDamageZeroSavingLateCheckpoint(cap:BountifulMonsterDamageZeroSavingLateCheckpoint){const session=host(),row=issued.get(cap);if(!row||row.roomId!==session.roomId||row.memberId!==session.memberId)throw Error('monster-zero-save-late:actual-checkpoint-required');const facts=actual(row.result);if(JSON.stringify(facts)!==row.signature)throw Error('monster-zero-save-late:changed-actual-checkpoint');return facts}


type SavingLateFacts=ReturnType<typeof readBountifulMonsterDamageZeroSavingLateCheckpoint>
type SavingLateChoice=NonNullable<SavingLateFacts['source']['hostDamageZeroSavingThrows']>[number]['choice']&{}
export interface BountifulMonsterDamageZeroSavingLateSelection{
 readonly frame:SavingLateFacts['frame'];readonly prefix:SavingLateChoice;readonly state:SavingLateFacts['state'];
 /** Preview retained dice; the original Choice.rolls must stay locked. */
 readonly initialSavingThrow:{readonly d20:number;readonly d20Second?:number;readonly blessRoll?:number;readonly baneRoll?:number};
 readonly finalizedDice:readonly number[];
}
declare const collectedSavingLate:unique symbol
/** Collected input only. Neither a raw-pool authentication nor a native result. */
export type BountifulMonsterDamageZeroCollectedSavingLate={readonly[collectedSavingLate]:true}
const collected=new WeakMap<object,{checkpoint:BountifulMonsterDamageZeroSavingLateCheckpoint;choice:SavingLateChoice}>()
export async function collectBountifulMonsterDamageZeroSavingLate(checkpoint:BountifulMonsterDamageZeroSavingLateCheckpoint,collect:(selection:BountifulMonsterDamageZeroSavingLateSelection)=>Promise<SavingLateChoice>):Promise<BountifulMonsterDamageZeroCollectedSavingLate>{
 const before=readBountifulMonsterDamageZeroSavingLateCheckpoint(checkpoint),prefix=structuredClone(before.prefix),choice=await collect({frame:structuredClone(before.frame),prefix:structuredClone(prefix),state:structuredClone(before.state),initialSavingThrow:{d20:before.request.values[0],...(before.request.values[1]!==undefined?{d20Second:before.request.values[1]}:{}),...(prefix.blessRoll!==undefined?{blessRoll:prefix.blessRoll}:{}),...(prefix.baneRoll!==undefined?{baneRoll:prefix.baneRoll}:{})},finalizedDice:[...before.request.finalizedDice]})
 readBountifulMonsterDamageZeroSavingLateCheckpoint(checkpoint)
 if(!choice||['frameId','featureId','rolls','blessRoll','baneRoll'].some(key=>!same(choice[key as keyof SavingLateChoice],prefix[key as keyof typeof prefix])))throw Error('monster-zero-save-late:locked-original-prefix-required')
 const cap=Object.freeze({})as BountifulMonsterDamageZeroCollectedSavingLate;collected.set(cap,{checkpoint,choice:structuredClone(choice)});return cap
}
export function readBountifulMonsterDamageZeroCollectedSavingLate(cap:BountifulMonsterDamageZeroCollectedSavingLate){const row=collected.get(cap);if(!row)throw Error('monster-zero-save-late:actual-collected-input-required');const facts=readBountifulMonsterDamageZeroSavingLateCheckpoint(row.checkpoint);return{...facts,choice:structuredClone(row.choice)}}

/** Derives only from the private actual-ready reference captured above. */
export function deriveBountifulMonsterDamageZeroCollectedSavingLate(cap:BountifulMonsterDamageZeroCollectedSavingLate){const row=collected.get(cap);if(!row)throw Error('monster-zero-save-late:actual-collected-input-required');const actual=issued.get(row.checkpoint);if(!actual)throw Error('monster-zero-save-late:actual-checkpoint-required');readBountifulMonsterDamageZeroCollectedSavingLate(cap);return deriveDnd5eMonsterDamageZeroHeldSavingInput(actual.result,row.choice)}
