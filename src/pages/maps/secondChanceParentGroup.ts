import type{PersistedSecondChanceAttack,SecondChanceCombat}from'./secondChanceHostCommit'
export function secondChanceOccurrence(receipt:PersistedSecondChanceAttack):number{return receipt.incomingOccurrence??0}
export function secondChanceParentGroup(combat:SecondChanceCombat,transactionId:string):PersistedSecondChanceAttack[]{
 const rows=Object.values(combat.secondChanceAttacks??{}).filter(row=>row.attack.transactionId===transactionId).sort((a,b)=>secondChanceOccurrence(a)-secondChanceOccurrence(b))
 if(!rows.length)return rows
 const root=rows[0],identity=JSON.stringify([root.attack.mapId,root.attack.combatId,root.parentInput,root.sceneScope,root.originalRoomAction,root.hostControllerMemberId,root.parentDefinitionSignature])
 if(new Set(rows.map(secondChanceOccurrence)).size!==rows.length||rows.some(row=>JSON.stringify([row.attack.mapId,row.attack.combatId,row.parentInput,row.sceneScope,row.originalRoomAction,row.hostControllerMemberId,row.parentDefinitionSignature])!==identity)||rows.some(row=>row.parentContinuation?.phase==='consumed')&&rows.some(row=>row.parentContinuation?.phase!=='consumed'))throw Error('second-chance-parent:inconsistent-parent-group')
 return rows
}
export function activeSecondChanceParentReceipt(rows:readonly PersistedSecondChanceAttack[]):PersistedSecondChanceAttack|undefined{
 const pending=rows.filter(row=>!row.parentContinuation)
 if(pending.length>1)throw Error('second-chance-parent:multiple-active-occurrences')
 return pending[0]??rows.at(-1)
}
/** Only this parent's own successful atomic phase/cost writes may advance its
 * expected revisions. Unrelated changes remain conflicts at every boundary. */
export function advanceSecondChanceParentRevisions(combat:SecondChanceCombat,transactionId:string,combatRevision:number,characterRevision?:number):SecondChanceCombat{
 return{...combat,secondChanceAttacks:Object.fromEntries(Object.entries(combat.secondChanceAttacks??{}).map(([id,row])=>[id,row.attack.transactionId===transactionId&&row.parentContinuation?.phase==='ready'?{...row,parentContinuation:{...row.parentContinuation,combatRevision,...(characterRevision!==undefined?{characterRevision}:{})}}:row]))}
}
