import{bountifulOriginalRowReady}from'../../shared/bountiful-luck-state.mjs'
import{validBountifulMonsterZeroCommand}from'../../shared/bountiful-monster-zero-command.mjs'
import {createHash} from 'node:crypto'
import {readFile,mkdir,writeFile,rename} from 'node:fs/promises'
import path from 'node:path'
import {validBountifulHostOperation,bountifulHostOperationResultFacts} from '../../shared/bountiful-host-operation.mjs'
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v)
const canonical=v=>Array.isArray(v)?v.map(canonical):object(v)?Object.fromEntries(Object.keys(v).sort().map(key=>[key,canonical(v[key])])):v
const digest=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
const target=(ctx,parentId)=>path.join(ctx.stateRoot,'.authority','bountiful-completed',createHash('sha256').update(parentId).digest('hex')+'.json')
async function read(ctx,id){try{return JSON.parse(await readFile(target(ctx,id),'utf8'))}catch{return null}}
async function save(ctx,id,value){const file=target(ctx,id);await mkdir(path.dirname(file),{recursive:true});await writeFile(file+'.next',JSON.stringify(value));await rename(file+'.next',file)}
function group(combat,parentId){const result={};for(const field of ['bountifulOriginalParents','bountifulReadyParents'])for(const [id,row]of Object.entries(combat?.[field]??{})){const parent=row.identity?.parentId??row.parentId;if(parent===parentId)result[field+':'+id]=row}return result}
function completed(rows,parentId){return Object.keys(rows).length>0&&Object.values(rows).every(row=>row.consumed?.transactionId===parentId)}
function nativeCompletion(current,incoming,parentId,transaction){
 if(transaction.transactionId!=='bountiful-host-parent:'+parentId)return false
 const before=group(current,parentId),after=group(incoming,parentId)
 const keys=Object.keys(before)
 if(!keys.length||keys.length>128||keys.length!==Object.keys(after).length||keys.some(key=>!key.startsWith('bountifulOriginalParents:')||!after[key]))return false
 const originals=Object.values(before).sort((a,b)=>a.identity.occurrence-b.identity.occurrence),old=originals[0],row=after['bountifulOriginalParents:'+JSON.stringify(['bountiful-original-parent',parentId,0])],operation=old.originalRoomAction
 const zero=validBountifulMonsterZeroCommand(operation)&&operation.parentId===parentId&&operation.mapId===old.identity.mapId&&operation.combatId===old.identity.combatId&&operation.targetTokenId===old.identity.roller.tokenId&&old.originalCheckpoint?.kind==='saving-throw'&&old.originalCheckpoint.actorId===operation.targetTokenId&&old.request.kind==='saving-throw'&&old.request.actorId===operation.targetTokenId&&old.rawIssuer?.mode==='dm'&&/^bountiful-monster-damage-zero-original:[a-f0-9]{64}$/.test(old.rawIssuer.rollId)&&Number.isSafeInteger(old.identity.effectTimestamp)&&old.identity.effectTimestamp>0
 if((!zero&&(!validBountifulHostOperation(operation)||operation.adapterId!=='monster'))||old.originalAdapterId!=='monster'||!row?.consumed||row.identity.parentId!==parentId)return false
 if(zero&&(transaction.writes.length!==3||new Set(transaction.writes.map(write=>write.name)).size!==3||!['characters','maps','combat'].every(name=>transaction.writes.some(write=>write.name===name))))return false
 for(let index=0;index<originals.length;index++){
  const prior=originals[index],next=after['bountifulOriginalParents:'+JSON.stringify(['bountiful-original-parent',parentId,index])]
  if(prior.identity.occurrence!==index||prior.consumed||prior.identity.parentId!==parentId||prior.originalAdapterId!=='monster'||digest(prior.originalRoomAction)!==digest(operation)||digest(prior.originalParent)!==digest(old.originalParent)||!next?.consumed||next.consumed.transactionId!==parentId||digest(next.consumed.result)!==digest(row.consumed.result))return false
  if(!bountifulOriginalRowReady(prior))return false
 }
 const result=bountifulHostOperationResultFacts(row.consumed.result),byName=name=>transaction.writes.find(write=>write.name===name)?.data
 const map=byName('maps')?.maps?.find(map=>map.id===old.identity.mapId),characters=byName('characters')?.characters
 return !!result&&result.ok===true&&object(result.map)&&object(map)&&Array.isArray(result.characters)&&Array.isArray(characters)&&result.combatId===old.identity.combatId&&result.round===old.identity.round&&result.initiativeIndex===old.identity.initiativeIndex&&digest(result.map)===digest(map)&&digest(result.characters)===digest(characters)
}
async function finalize(ctx,parentId,combat){const fact=await read(ctx,parentId);if(!fact||fact.parentId!==parentId)return null;if(fact.finalized)return fact;const rows=group(combat,parentId);if(!completed(rows,parentId)||digest(rows)!==fact.groupHash)return null;const finalized={...fact,finalized:true};await save(ctx,parentId,finalized);return finalized}
/** This prepares no public success and authorizes no pending source. A failed
 * transaction cannot retire anything: the committed current group must exactly
 * match this witness before it can ever be finalized. */
export async function prepareBountifulParentCompletion(ctx,current,incoming,{writes,transactionId}){
 const parentIds=new Set([...Object.values(incoming?.bountifulOriginalParents??{}).map(row=>row.identity?.parentId),...Object.values(incoming?.bountifulReadyParents??{}).map(row=>row.parentId)].filter(id=>typeof id==='string'))
 const names=new Set(writes.map(write=>write.name)),byName=name=>writes.find(write=>write.name===name)?.data
 for(const parentId of parentIds){const before=group(current,parentId),after=group(incoming,parentId);if(!Object.keys(before).length||completed(before,parentId)||!completed(after,parentId))continue
  const normal=transactionId==='player-action:'+parentId&&byName('player-action-ack')?.status==='accepted'&&byName('player-action-ack')?.actionId===parentId&&byName('player-action-processed')?.actionIds?.includes(parentId)
  const sc=transactionId==='second-chance-parent:'+parentId&&Object.values(incoming.secondChanceAttacks??{}).some(row=>row.attack?.transactionId===parentId&&row.parentContinuation?.phase==='consumed')
  if((!normal&&!sc&&!nativeCompletion(current,incoming,parentId,{writes,transactionId}))||!['characters','maps','combat'].every(name=>names.has(name)))continue
  const prior=await finalize(ctx,parentId,current);if(prior)continue
  await save(ctx,parentId,{schemaVersion:1,parentId,transactionId,groupHash:digest(after),rowHashes:Object.fromEntries(Object.entries(after).map(([key,row])=>[key,digest(row)])),finalized:false})
 }
}
export async function authorizeBountifulParentRetirement(ctx,current,field,id,row){const parentId=row.identity?.parentId??row.parentId;if(!parentId)return false;const fact=await finalize(ctx,parentId,current);return !!fact&&row.consumed?.transactionId===parentId&&fact.rowHashes?.[field+':'+id]===digest(row)}
export async function bountifulParentPreviouslyCompleted(ctx,parentId,current){return !!await finalize(ctx,parentId,current)}

export async function authorizeBountifulParentCompletionTransition(ctx,current,incoming,parentId){
 const transaction=ctx.bountifulCompletionTransaction;if(!transaction||!Array.isArray(transaction.writes))return false
 const writes=transaction.writes,names=new Set(writes.map(write=>write.name)),byName=name=>writes.find(write=>write.name===name)?.data
 const normal=transaction.transactionId==='player-action:'+parentId&&byName('player-action-ack')?.status==='accepted'&&byName('player-action-ack')?.actionId===parentId&&byName('player-action-processed')?.actionIds?.includes(parentId)
 const sc=transaction.transactionId==='second-chance-parent:'+parentId&&Object.values(incoming.secondChanceAttacks??{}).some(row=>row.attack?.transactionId===parentId&&row.parentContinuation?.phase==='consumed')
 const fact=await read(ctx,parentId),rows=group(incoming,parentId)
 return !!fact&&!fact.finalized&&(!completed(group(current,parentId),parentId))&&(normal||sc||nativeCompletion(current,incoming,parentId,transaction))&&['characters','maps','combat'].every(name=>names.has(name))&&completed(rows,parentId)&&fact.groupHash===digest(rows)
}
