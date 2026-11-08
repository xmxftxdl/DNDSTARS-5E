import {isBountifulReadyD20Interrupt} from './bountiful-ready-d20-host-gate.mjs'
const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value)
const prefix='["bountiful-parent-d20-followup",'
export function isBountifulD20FollowupInterrupt(row){return isBountifulReadyD20Interrupt(row)||!!row&&(row.payload?.bountifulParent!=null||typeof row.payload?.rollId==='string'&&row.payload.rollId.startsWith(prefix)||typeof row.id==='string'&&row.id.startsWith('roll-confirmation:'+prefix))}
export function validateBountifulD20ParentFollowup(value,rollId){return record(value)&&Object.keys(value).every(key=>['parentId','sourceOccurrence','dieIndex','rawRollId'].includes(key))&&typeof value.parentId==='string'&&value.parentId.trim()===value.parentId&&value.parentId.length>0&&value.parentId.length<=500&&typeof value.rawRollId==='string'&&value.rawRollId.trim()===value.rawRollId&&value.rawRollId.length>0&&value.rawRollId.length<=1000&&Number.isSafeInteger(value.sourceOccurrence)&&value.sourceOccurrence>=0&&value.sourceOccurrence<=95&&Number.isSafeInteger(value.dieIndex)&&value.dieIndex>=0&&value.dieIndex<=1&&rollId===JSON.stringify(['bountiful-parent-d20-followup',value.parentId,value.sourceOccurrence,value.rawRollId,value.dieIndex])}
export function bountifulD20ProtectedQueueUnchanged(before,after){
 const prior=Array.isArray(before?.interrupts)?before.interrupts:[],next=Array.isArray(after?.interrupts)?after.interrupts:[]
 const ids=new Set([...prior,...next].filter(isBountifulD20FollowupInterrupt).map(row=>row.id))
 if(!ids.size)return true
 if(before?.mapId!==after?.mapId)return false
 for(const id of ids){const a=prior.filter(row=>row.id===id),b=next.filter(row=>row.id===id);if(a.length!==1||b.length!==1||JSON.stringify(a[0])!==JSON.stringify(b[0]))return false}
 return true
}
