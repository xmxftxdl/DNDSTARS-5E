import{readMastermindSpellWindowSource}from'./mastermind-spell-windows.mjs'
import{currentMastermindSpellWardRequest}from'./mastermind-spell-ward-pools.mjs'
import{mutateSpellWardOwn}from'./mastermind-spell-ward-own.mjs'
const fail=(status,error)=>({ok:false,status,error}),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
function source(value,snapshot,identity,requestId,hash){
 if(!/^mm-spell-ward-own:[a-f0-9]{64}$/.test(requestId)||!value?.parents)return
 const rows=[];for(const p of Object.values(value.parents))for(const w of p.windows??[])for(const r of w.wardRequests??[])for(const e of r.own?.entries??[])if(e.id===requestId)rows.push({p,w,r,e})
 if(rows.length!==1)return
 const{p,w,r,e}=rows[0],host={...identity,role:'dm',memberId:identity.hostMemberId},current=readMastermindSpellWindowSource(value,snapshot,host,p.id,hash)
 if(!current.ok||!currentMastermindSpellWardRequest(p,w,r,snapshot,identity,hash)||e.decision?.decision!=='use')return
 // The existing original-source read independently validates all own evidence.
 const checked=mutateSpellWardOwn(p,r,snapshot,host,'ward-own-source',{parentId:p.id,windowIndex:w.index,requestId:r.id},0,hash,()=>undefined)
 if(!checked.ok)return
 return{parent:p,window:w,row:r,entry:e}
}
export function projectMastermindSpellWardOwnDice(value,snapshot,identity,requestId,hash){
 const found=source(value,snapshot,identity,requestId,hash);if(!found)return fail(403,'spell-ward-own-dice:current-authenticated-use-required')
 const{parent:p,row:r,entry:e}=found,host=identity.role==='dm'&&identity.memberId===p.hostMemberId,owner=identity.memberId===r.rollerMemberId&&identity.role===(r.rollerMemberId===p.hostMemberId?'dm':'player')
 if(!host&&!owner)return fail(403,'spell-ward-own-dice:actual-controller-required')
 return{ok:true,request:{id:e.id,parentId:p.id,mapId:p.original.mapId,combatId:p.original.combatId,windowIndex:found.window.index,originalWardRequestId:r.id,mode:'normal',count:1,sides:20,kind:'saving',rollerTokenId:r.rollerTokenId,rollerCharacterId:r.rollerCharacterId,controllerMemberId:r.rollerMemberId,canRoll:owner,phase:e.confirmed?'confirmed':e.raw?'raw':'issued',...(e.raw?{raw:[...e.raw.values]}:{}),...(e.confirmed?{confirmed:[...e.confirmed.values]}:{})}}
}
/** Pure event validation and input mutation, never a Native or World issuer. */
export function mutateMastermindSpellWardOwnDice(value,snapshot,identity,channel,payload,now,hash,mutate){
 const presentation=typeof payload?.requestId==='string'&&payload.requestId.endsWith(':dm-confirmed'),requestId=presentation?payload.requestId.slice(0,-13):payload?.requestId,found=source(value,snapshot,identity,requestId,hash)
 if(!found)return fail(403,'spell-ward-own-dice:current-authenticated-use-required')
 const{parent:p,window:w,row:r,entry:e}=found,host=identity.role==='dm'&&identity.memberId===p.hostMemberId,owner=identity.memberId===r.rollerMemberId&&identity.role===(r.rollerMemberId===p.hostMemberId?'dm':'player'),faces=v=>Array.isArray(v)&&v.length===1&&Number.isSafeInteger(v[0])&&v[0]>=1&&v[0]<=20
 if(payload.mapId!==p.original.mapId||payload.combatId!==p.original.combatId||payload.parentId!==undefined&&payload.parentId!==p.id||payload.count!==1||payload.sides!==20||!['dice','d20'].includes(payload.kind))return fail(403,'spell-ward-own-dice:exact-issued-spec-required')
 if(presentation)return host&&channel==='dice-roll-request-dm-to-player'&&payload.delivery==='broadcast-result'&&e.confirmed&&same(payload.values,e.confirmed.values)?{ok:true,changed:false,next:value}:fail(403,'spell-ward-own-dice:actual-confirmed-presentation-required')
 if(payload.rollerTokenId!==r.rollerTokenId||payload.targetCharacterId!==r.rollerCharacterId||payload.rollKind!=='saving-throw')return fail(403,'spell-ward-own-dice:exact-actual-roller-required')
 if(channel==='dice-roll-request-dm-to-player'&&payload.delivery==='player-roll-request')return host&&r.rollerMemberId!==p.hostMemberId?{ok:true,changed:false,next:value}:fail(403,'spell-ward-own-dice:host-request-required')
 if(channel!=='dice-roll-request-player-to-dm'||!owner||identity.role!=='player'||!['player-roll-start','player-roll-result'].includes(payload.delivery))return fail(403,'spell-ward-own-dice:actual-player-physical-required')
 if(payload.delivery==='player-roll-start'&&Array.isArray(payload.values)&&payload.values.length===0)return{ok:true,changed:false,next:value}
 if(!faces(payload.values))return fail(403,'spell-ward-own-dice:single-physical-d20-required')
 return mutate(value,snapshot,identity,'ward-own-raw',{parentId:p.id,windowIndex:w.index,requestId:r.id,ownRequestId:e.id,values:payload.values},now,hash)
}
