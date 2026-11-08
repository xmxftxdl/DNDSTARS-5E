const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value)
const text=(value,max=256)=>typeof value==='string'&&value.trim()===value&&value.length>0&&value.length<=max
export const HOST_WORLD_FACT_INTERRUPT_PREFIX='host-world-fact:'
/** Protect both the typed audience and its reserved identity. Stripping a tag
 * or changing kind does not convert an existing Host request into player data. */
export function isDmOnlyChoiceInterrupt(row){
 return !!row&&(row.kind==='dm-adjudication'||(row.kind==='plugin-choice'&&row.payload?.audience==='dm')||row.payload?.hostWorldFactBinding!=null||
  typeof row.id==='string'&&row.id.startsWith(HOST_WORLD_FACT_INTERRUPT_PREFIX))
}
export function validateHostWorldFactChoice(row){
 const reserved=typeof row?.id==='string'&&row.id.startsWith(HOST_WORLD_FACT_INTERRUPT_PREFIX)
 const value=row?.payload?.hostWorldFactBinding
 if(!reserved&&value==null)return true
 if(!reserved||row.kind!=='plugin-choice'||row.payload?.audience!=='dm'||!record(value))return false
 const keys=['schemaVersion','factId','parentId','eventId','occurrence','actorId','targetId','packageId','activityId']
 return Object.keys(value).length===keys.length&&Object.keys(value).every(key=>keys.includes(key))&&
  value.schemaVersion===1&&typeof value.factId==='string'&&/^[a-z][a-z0-9.-]{0,63}$/.test(value.factId)&&
  ['parentId','eventId','actorId','targetId','packageId','activityId'].every(key=>text(value[key],key==='parentId'?500:256))&&
  Number.isSafeInteger(value.occurrence)&&value.occurrence>=0&&value.occurrence<=10000&&
  row.transactionId===value.parentId&&row.payload.pluginId===value.packageId&&row.payload.featureId===value.activityId&&
  /^host-world-fact:[a-f0-9]{32}:[0-9]+$/.test(row.id)
}
const canonical=value=>Array.isArray(value)?value.map(canonical):record(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value
export function dmOnlyChoiceProtectedQueueUnchanged(before,after){
 const prior=Array.isArray(before?.interrupts)?before.interrupts:[],next=Array.isArray(after?.interrupts)?after.interrupts:[]
 const ids=new Set([...prior,...next].filter(isDmOnlyChoiceInterrupt).map(row=>row.id))
 if(!ids.size)return true
 if(before?.mapId!==after?.mapId)return false
 for(const id of ids){
  const a=prior.filter(row=>row.id===id),b=next.filter(row=>row.id===id)
  if(a.length!==1||b.length!==1||JSON.stringify(canonical(a[0]))!==JSON.stringify(canonical(b[0])))return false
 }
 return true
}
