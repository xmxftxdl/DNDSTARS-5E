import type{SharedPlayerActionState}from'../../lib/sharedCombatTypes'
import type{MastermindThoughtGateway}from'./mastermindThoughtReadingParent'
import{prepareMastermindThoughtNativeContinuationOriginal,restoreMastermindThoughtNativeContinuationOriginal,readMastermindThoughtNativeContinuationIssuedOriginal,type MastermindThoughtNativeContinuationIntent,type MastermindThoughtContinuationOriginal}from'./mastermindThoughtContinuation'
const ordered=(v:unknown):unknown=>Array.isArray(v)?v.map(ordered):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,value])=>[k,ordered(value)])):v,sig=(v:unknown)=>JSON.stringify(ordered(v))
const issued=new WeakMap<SharedPlayerActionState,{original:MastermindThoughtContinuationOriginal;signature:string}>()
export async function issueMastermindNativeThoughtContinuationDispatch(input:MastermindThoughtNativeContinuationIntent,gateway:MastermindThoughtGateway){
 const original=await prepareMastermindThoughtNativeContinuationOriginal(input,gateway),view=await readMastermindThoughtNativeContinuationIssuedOriginal(original,gateway),action=view.originalAction
 issued.set(action,{original,signature:sig(action)});return action
}
export async function readMastermindNativeThoughtContinuationDispatch(action:SharedPlayerActionState,gateway:MastermindThoughtGateway){
 const proof=issued.get(action);if(!proof)return undefined
 if(sig(action)!==proof.signature)throw Error('native-thought-continuation:issued-intent-mutated')
 const view=await readMastermindThoughtNativeContinuationIssuedOriginal(proof.original,gateway)
 if(sig(view.originalAction)!==proof.signature)throw Error('native-thought-continuation:current-issued-intent-required')
 return proof.original
}
/** Classification alone authorizes neither execution nor publication. */
export const isMastermindNativeThoughtContinuationDispatch=(action:SharedPlayerActionState)=>issued.has(action)
export async function restoreMastermindNativeThoughtContinuationDispatch(parentId:string,gateway:MastermindThoughtGateway){
 const session=gateway.session();if(session?.role!=='dm')throw Error('native-thought-continuation:current-Host-required')
 const journal=await gateway.loadResource<{parents:Record<string,{origin?:string;parentTransactionId:string;roomId:string;hostMemberId:string;originalAction:SharedPlayerActionState}>}>('mastermind-thought-readings'),row=Object.values(journal?.parents??{}).find(row=>row.parentTransactionId===parentId&&row.origin==='native'&&row.originalAction.type==='dnd5e-plugin-action')
 if(!row)return undefined
 if(row.roomId!==session.roomId||row.hostMemberId!==session.memberId)throw Error('native-thought-continuation:current-Host-required')
 const original=await restoreMastermindThoughtNativeContinuationOriginal(parentId,gateway),view=await readMastermindThoughtNativeContinuationIssuedOriginal(original,gateway),action=view.originalAction
 issued.set(action,{original,signature:sig(action)});return action
}
export async function listMastermindNativeThoughtContinuationDispatches(mapId:string,gateway:MastermindThoughtGateway){
 const session=gateway.session();if(session?.role!=='dm')return[]
 const journal=await gateway.loadResource<{parents:Record<string,{origin?:string;parentTransactionId:string;roomId:string;hostMemberId:string;mapId:string;readerTokenId:string;ownerTokenId:string;phase:string;originalAction:SharedPlayerActionState}>}>('mastermind-thought-readings'),rows=[]
 for(const row of Object.values(journal?.parents??{})){if(row.origin!=='native'||row.originalAction.type!=='dnd5e-plugin-action'||row.roomId!==session.roomId||row.hostMemberId!==session.memberId||row.mapId!==mapId||!['waiting','answered'].includes(row.phase))continue;try{if(await restoreMastermindNativeThoughtContinuationDispatch(row.parentTransactionId,gateway))rows.push({parentId:row.parentTransactionId,readerTokenId:row.readerTokenId,ownerTokenId:row.ownerTokenId,phase:row.phase})}catch{/* Changed originals never become resumable entries. */}}
 return rows
}
