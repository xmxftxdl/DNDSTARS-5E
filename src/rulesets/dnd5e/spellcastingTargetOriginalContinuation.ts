import{bountifulPreparedReplayFacts}from'./bountifulLuckReceipt'
import{readSpellTargetOriginalAuthenticatedCasterPrefix}from'./spellTargetOriginalSavingDiceRoute'
import{getRoomSession}from'../../lib/roomSession'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone'
import{readDnd5eSpellTargetOriginalOperation,type Dnd5eSpellTargetOriginalOperation}from'./spellTargetOriginalOperation'
import{captureSpellTargetOriginalPublicationPool,readSpellTargetOriginalPublicationPool,readSpellTargetOriginalSavingNativePool,type SpellTargetOriginalSavingDiceRoute}from'./spellTargetOriginalSavingDiceRoute'
import{readDnd5eSpellcastingBountifulOriginalQualification,type Dnd5eSpellcastingBountifulOriginalQualification}from'./spellcastingBountifulOriginalBoundary'
import type{OriginalD20ReplayFacts}from'./allyNaturalOneCheckpoint'

type Native=Awaited<ReturnType<typeof readDnd5eSpellTargetOriginalOperation>>
type Source=Native['source']&{hostOriginalD20Replay?:OriginalD20ReplayFacts}
const signature=(value:unknown)=>JSON.stringify(encodeSecondChanceParentWire(value))
declare const targetContinuation:unique symbol
export type SpellcastingTargetOriginalContinuation={readonly[targetContinuation]:true}
type Input={operation:Dnd5eSpellTargetOriginalOperation;route:SpellTargetOriginalSavingDiceRoute;qualification:Dnd5eSpellcastingBountifulOriginalQualification}
type Row=Input&{roomId:string;memberId:string;source:Source;initial:Source;sourceSignature:string;nativeSignature:string;poolSignature:string;effectTimestamp:number}
const issued=new WeakMap<object,Row>()
function host(){const value=getRoomSession();if(value?.role!=='dm'||!value.roomId||!value.memberId)throw Error('caster-target-continuation:actual-host-required');return value}
async function facts(input:Input){
 const native=await readDnd5eSpellTargetOriginalOperation(input.operation),pool=await readSpellTargetOriginalSavingNativePool(input.route,input.operation),replay=(native.source as Source).hostOriginalD20Replay
 if(!replay||!Array.isArray(replay.facts)||replay.facts.length!==1&&replay.facts.length!==2||pool.effectTimestamp!==native.effectTimestamp||pool.parentId!==native.source.prepared.action.id||pool.rollerTokenId!==native.requirement.targetId||pool.count!==native.requirement.requiredDiceCount||pool.targetId!==native.requirement.targetId||pool.effectId!==native.caster.effectId)throw Error('caster-target-continuation:exact-complete-target-required')
 // Reconstruct only the original empty replay clock, then ask the actual first
 // caster qualification to verify every byte. No caller source is accepted.
 if(Object.keys(replay).some(key=>!['parentId','sourceKey','effectTimestamp','facts'].includes(key)))throw Error('caster-target-continuation:unsupported-earlier-replay-fields')
 const initial=cloneDnd5eHostTransactionInput({...native.source,hostOriginalD20Replay:{parentId:replay.parentId,sourceKey:replay.sourceKey,effectTimestamp:replay.effectTimestamp,facts:[]}}),first=readDnd5eSpellcastingBountifulOriginalQualification(input.qualification,initial)
 if(first.effectTimestamp!==native.effectTimestamp||first.rawIssuer.rollId!==native.caster.requestId||signature(first.caster.rawValues)!==signature(native.caster.rawValues)||signature(first.caster.values)!==signature(native.caster.values))throw Error('caster-target-continuation:exact-first-caster-required')
   let authenticatedCasterPrefix:Awaited<ReturnType<typeof readSpellTargetOriginalAuthenticatedCasterPrefix>>|undefined
 if(replay.facts.length===2){const receipts=await readSpellTargetOriginalAuthenticatedCasterPrefix(input.route,input.operation),expected=bountifulPreparedReplayFacts({parentId:replay.parentId,source:initial,receipts});if(signature(receipts[0].request)!==signature(first.request)||signature(receipts[0].rawIssuer)!==signature(first.rawIssuer)||signature(expected)!==signature(replay))throw Error('caster-target-continuation:exact-authenticated-two-row-prefix-required');authenticatedCasterPrefix=receipts}
const source=cloneDnd5eHostTransactionInput({...initial,savingThrowD20:pool.values[0],...(pool.count===2?{savingThrowD20Second:pool.values[1]}:{})})
 return{native,pool,initial,source,...(authenticatedCasterPrefix?{authenticatedCasterPrefix}:{})}
}
/** A reconstruction witness for one actual later target component. It grants
 * neither a raw die, generic late inputs, nor a normal world publication. */
export async function captureSpellcastingTargetOriginalContinuation(input:Input):Promise<SpellcastingTargetOriginalContinuation>{
 const before=host(),value=await facts(input),after=host();if(before.roomId!==after.roomId||before.memberId!==after.memberId)throw Error('caster-target-continuation:changed-host')
 const token=Object.freeze({})as SpellcastingTargetOriginalContinuation;issued.set(token,{...input,roomId:before.roomId,memberId:before.memberId,source:value.source,initial:value.initial,sourceSignature:signature(value.source),nativeSignature:signature(value.native),poolSignature:signature(value.pool),effectTimestamp:value.native.effectTimestamp});return token
}
export async function readSpellcastingTargetOriginalContinuation(token:object,source?:Source){
 const current=host(),row=issued.get(token);if(!row||row.roomId!==current.roomId||row.memberId!==current.memberId)throw Error('caster-target-continuation:actual-private-token-required');const value=await facts(row),after=host()
 if(after.roomId!==row.roomId||after.memberId!==row.memberId||signature(value.native)!==row.nativeSignature||signature(value.pool)!==row.poolSignature||signature(value.source)!==row.sourceSignature||source!==undefined&&signature(source)!==row.sourceSignature)throw Error('caster-target-continuation:changed-current-source')
 return{...(value.authenticatedCasterPrefix?{authenticatedCasterPrefix:structuredClone(value.authenticatedCasterPrefix)}:{}),source:cloneDnd5eHostTransactionInput(row.source),initial:cloneDnd5eHostTransactionInput(row.initial),effectTimestamp:row.effectTimestamp,rawIssuer:{mode:'dm' as const,rollId:value.native.caster.requestId,cursor:1},target:{requestId:value.pool.requestId,rawValues:[...value.pool.rawValues],values:[...value.pool.values]}}
}

const publicationFacts=new WeakMap<object,{pool:object;poolSignature:string;sourceSignature:string;effectTimestamp:number;roomId:string;memberId:string}>()
export async function captureSpellcastingTargetPublicationFacts(token:SpellcastingTargetOriginalContinuation){
 await readSpellcastingTargetOriginalContinuation(token);const row=issued.get(token)!,pool=await captureSpellTargetOriginalPublicationPool(row.route,row.operation),current=host(),proof=Object.freeze({});publicationFacts.set(proof,{pool,poolSignature:row.poolSignature,sourceSignature:row.sourceSignature,effectTimestamp:row.effectTimestamp,roomId:current.roomId,memberId:current.memberId});return proof
}
export async function readSpellcastingTargetPublicationFacts(proof:object){
 const row=publicationFacts.get(proof),current=host();if(!row||row.roomId!==current.roomId||row.memberId!==current.memberId)throw Error('caster-target-publication:actual-facts-required');const pool=await readSpellTargetOriginalPublicationPool(row.pool);if(signature(pool)!==row.poolSignature||pool.effectTimestamp!==row.effectTimestamp)throw Error('caster-target-publication:changed-facts');return{effectTimestamp:row.effectTimestamp,sourceSignature:row.sourceSignature}
}
