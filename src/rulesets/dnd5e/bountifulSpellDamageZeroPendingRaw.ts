import{getRoomSession}from'../../lib/roomSession'
import{createDnd5eOriginalD20Session}from'./damageCommitSession'
import{resolvePreparedDnd5eSpellCast}from'./spellAction'
import{buildDnd5eSpellDamageZeroOriginalSource,readDnd5eSpellDamageZeroOriginalOperation}from'./damageZeroSpellOriginalOperation'
import{resumeBountifulOriginalParent}from'./bountifulLuckPersistedReplay'
import{decisionFromBountifulOriginalDieReceipt,type BountifulOriginalDieReceipt}from'./bountifulLuckReceipt'
import type{AllyNaturalOneRequest}from'./allyNaturalOneCheckpoint'

type Input=Parameters<typeof resolvePreparedDnd5eSpellCast>[0]
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
/** Reconstruct the real pending stage from the frozen source and saved decisions.
 * The caller must use the authenticated driver context. This does not mint a
 * receipt or grant a world result: the Host router still verifies every row. */
export function restoreBountifulSpellDamageZeroPendingRaw(input:{source:Input;resolve:unknown;receipts:readonly BountifulOriginalDieReceipt[];pending:{status:'pending-record';request:AllyNaturalOneRequest;occurrence:number;snapshot:unknown}}){
 const host=getRoomSession(),first=input.receipts[0],state=input.source.prepared.state,parentId=input.source.prepared.action.id
 if(host?.role!=='dm'||!host.roomId||!host.memberId||!first||first.identity.roomId!==host.roomId||first.identity.hostMemberId!==host.memberId||first.identity.parentId!==parentId||first.identity.combatId!==state.combatId||first.originalAdapterId!=='spell'||input.resolve!==resolvePreparedDnd5eSpellCast)throw Error('spell-zero-pending:actual-host-original-required')
 if(!first.rawIssuer||first.rawIssuer.mode!=='dm'||first.rawIssuer.cursor!==1||!/^bountiful-spell-damage-zero-original:[a-f0-9]{64}$/.test(first.rawIssuer.rollId)||first.originalCheckpoint?.kind!=='saving-throw'||first.originalCheckpoint.actorId!==input.pending.request.actorId||input.pending.request.kind!=='saving-throw'||!input.receipts.length||input.receipts.some((row,index)=>row.identity.occurrence!==index||row.identity.parentId!==parentId||row.identity.effectTimestamp!==first.identity.effectTimestamp||row.consumed||!equal(row.rawIssuer,first.rawIssuer)||!equal(row.originalParent,first.originalParent)))throw Error('spell-zero-pending:exact-ready-prefix-required')
 const replay=resumeBountifulOriginalParent({source:input.source,resolve:resolvePreparedDnd5eSpellCast,parentId,actorId:first.originalCheckpoint?.actorId??first.request.actorId,kind:'saving-throw',receipts:input.receipts})
 if(replay.status!=='pending-record'||!equal(replay,input.pending))throw Error('spell-zero-pending:exact-pending-prefix-required')
 const session=createDnd5eOriginalD20Session(input.source,resolvePreparedDnd5eSpellCast,first.originalCheckpoint?.actorId??first.request.actorId,'saving-throw')
 try{
  let result=session.run(state)
  for(let index=0;index<input.receipts.length;index++){
   const receipt=input.receipts[index]
   if(result.status!=='pending-ally-natural-one'||result.occurrence!==receipt.identity.occurrence)throw Error('spell-zero-pending:actual-ready-prefix-required')
   result=session.resumeAllyNaturalOne(state,result.occurrence,result.request,decisionFromBountifulOriginalDieReceipt(receipt,result.request))
  }
  if(result.status!=='pending-ally-natural-one'||result.occurrence!==input.pending.occurrence||!equal(result.request,input.pending.request)||!equal(result.snapshot,input.pending.snapshot))throw Error('spell-zero-pending:actual-pending-stage-required')
  const completed=buildDnd5eSpellDamageZeroOriginalSource(result),operation=completed.operations[0]
  if(completed.operations.length!==1||!operation?.choice||!equal(completed.source,input.source)||!equal(operation.choice.rolls,result.request.originalRolls)||operation.frame.targetId!==result.request.actorId||readDnd5eSpellDamageZeroOriginalOperation(operation.operation).effectTimestamp!==first.identity.effectTimestamp)throw Error('spell-zero-pending:actual-original-pool-required')
  return{...first.rawIssuer}
 }finally{session.cancel()}
}
