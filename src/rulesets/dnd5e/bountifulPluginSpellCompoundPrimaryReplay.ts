import {createDnd5eOriginalD20Session,readDnd5eActualOriginalAllyBoundary} from './damageCommitSession'
import {readDnd5ePluginSpellCompoundPrimaryPendingQualification,type Dnd5ePluginSpellCompoundPrimaryPendingQualification} from './pluginSpellCompoundPrimaryPendingQualification'
import {resolvePreparedDnd5ePluginSpellCast} from './pluginSpellTransaction'
import {withActivityAttackOriginalMissing} from './activities/activityAttackOriginalMissing'
import {decisionFromBountifulOriginalDieReceipt,type BountifulOriginalDieReceipt} from './bountifulLuckReceipt'
import {originalD20ReplaySourceKey} from './allyNaturalOneCheckpoint'
import {encodeSecondChanceParentWire} from '../../lib/secondChanceParentWire'
import type {BountifulPluginSpellCompoundPrimaryBook} from '../../ports/dnd5ePluginSpellCompoundPrimaryTransport'

type Source=Parameters<typeof resolvePreparedDnd5ePluginSpellCast>[0]
type Qualification=Dnd5ePluginSpellCompoundPrimaryPendingQualification
type Session=ReturnType<typeof createDnd5eOriginalD20Session<Source,ReturnType<typeof resolvePreparedDnd5ePluginSpellCast>>>
type NativePending=Extract<ReturnType<Session['run']>,{status:'pending-ally-natural-one'}>
const signature=(value:unknown)=>JSON.stringify(encodeSecondChanceParentWire(value))
const pendingRecords=new WeakMap<object,{read:()=>void;qualification:Qualification;source:Source;receipts:readonly BountifulOriginalDieReceipt[];stage:NativePending}>()

/** Genuine ordinary attack replay. It stops at the actual ready boundary and
 * issues no completed primary result, burst source or Room capability. */
export function resumeBountifulPluginSpellCompoundPrimaryOriginalParent(input:{source:Source;receipts:readonly BountifulOriginalDieReceipt[];qualification:Qualification}){
 const actual=readDnd5ePluginSpellCompoundPrimaryPendingQualification(input.qualification,input.source),p=actual.source.prepared
 const native={...actual.source,hostOriginalD20Replay:{parentId:p.action.id,sourceKey:originalD20ReplaySourceKey(p.action.id,p.state,p.action,actual.effectTimestamp),effectTimestamp:actual.effectTimestamp,facts:[]}}
 const session=createDnd5eOriginalD20Session(native,resolvePreparedDnd5ePluginSpellCast,p.actorToken.id,'attack')
 const validate=(receipt:BountifulOriginalDieReceipt,request:NativePending['request'],occurrence:number)=>{
  if(receipt.identity.occurrence!==occurrence||receipt.identity.parentId!==p.action.id||receipt.identity.mapId!==p.map.id||receipt.identity.combatId!==p.state.combatId||receipt.identity.effectTimestamp!==actual.effectTimestamp||receipt.originalAdapterId!=='plugin-spell'||signature(receipt.rawIssuer)!==signature(actual.rawIssuer)||receipt.request.kind!=='attack'||signature(receipt.request)!==signature(request))throw Error('ice-knife-primary-replay:matching-actual-receipt-required')
 }
 try{return withActivityAttackOriginalMissing(()=>{
  let stage=session.run(p.state)
  for(let turn=0;stage.status==='pending-ally-natural-one'&&turn<64;turn++){
   const pending=stage,receipt=input.receipts.find(receipt=>receipt.identity.occurrence===pending.occurrence)
   if(!receipt){
    if(pending.occurrence!==input.receipts.length||pending.request.kind!=='attack'||pending.request.actorId!==actual.request.actorId||signature(pending.request.originalRolls)!==signature(actual.request.originalRolls))throw Error('ice-knife-primary-replay:contiguous-real-attack-required')
    const nativeFacts=readDnd5eActualOriginalAllyBoundary(pending),sourceSignature=signature(input.source),receiptsSignature=signature(input.receipts),stageSignature=signature(pending)
    if(nativeFacts.resolve!==resolvePreparedDnd5ePluginSpellCast||nativeFacts.effectTimestamp!==actual.effectTimestamp)throw Error('ice-knife-primary-replay:actual-native-clock-required')
    const read=()=>{readDnd5ePluginSpellCompoundPrimaryPendingQualification(input.qualification,input.source);const current=readDnd5eActualOriginalAllyBoundary(pending);if(signature(input.source)!==sourceSignature||signature(input.receipts)!==receiptsSignature||signature(pending)!==stageSignature||current.resolve!==nativeFacts.resolve||current.effectTimestamp!==actual.effectTimestamp)throw Error('ice-knife-primary-replay:unchanged-actual-pending-required')}
    const token=Object.freeze({status:'pending-record' as const,request:structuredClone(pending.request),snapshot:structuredClone(pending.snapshot),occurrence:pending.occurrence})
    pendingRecords.set(token,{read,qualification:input.qualification,source:input.source,receipts:structuredClone(input.receipts),stage:pending});return token
   }
   validate(receipt,pending.request,pending.occurrence)
   let decision:ReturnType<typeof decisionFromBountifulOriginalDieReceipt>
   try{decision=decisionFromBountifulOriginalDieReceipt(receipt,pending.request)}catch(error){if(error instanceof Error&&error.message==='bountiful-parent:decision-still-pending')return{status:'pending-decision' as const,receipt:structuredClone(receipt),request:pending.request,snapshot:pending.snapshot,occurrence:pending.occurrence};throw error}
   stage=session.resumeAllyNaturalOne(p.state,pending.occurrence,pending.request,decision)
  }
  if(stage.status!=='original-d20-ready')throw Error('ice-knife-primary-replay:actual-ready-required:'+stage.status)
  readDnd5ePluginSpellCompoundPrimaryPendingQualification(input.qualification,input.source)
  return stage
 })}finally{session.cancel()}
}

export async function readBountifulPluginSpellCompoundPrimaryPendingCurrent(token:object,source:Source,qualification:Qualification,receipts:readonly BountifulOriginalDieReceipt[],gateway:{loadBountifulPluginSpellCompoundPrimarySource:(identity:{parentId:string;mapId:string;combatId:string})=>Promise<BountifulPluginSpellCompoundPrimaryBook>}){
 const row=pendingRecords.get(token)
 if(!row||row.qualification!==qualification||signature(row.source)!==signature(source)||signature(row.receipts)!==signature(receipts))throw Error('ice-knife-primary-replay:actual-issued-pending-required')
 row.read()
 const actual=readDnd5ePluginSpellCompoundPrimaryPendingQualification(qualification,source),p=source.prepared,book=await gateway.loadBountifulPluginSpellCompoundPrimarySource({parentId:p.action.id,mapId:p.map.id,combatId:p.state.combatId})
 row.read()
 if(signature(book)!==signature(actual.book))throw Error('ice-knife-primary-replay:unchanged-current-private-book-required')
 return{request:structuredClone(row.stage.request),occurrence:row.stage.occurrence,rawIssuer:{...actual.rawIssuer},effectTimestamp:actual.effectTimestamp}
}
