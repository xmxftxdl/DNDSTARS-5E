import {readSpellTargetOriginalPreparation} from './spell-target-original-preparation-authority.mjs'
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v)
const closed=(v,keys)=>object(v)&&Object.keys(v).every(key=>keys.includes(key))
const identity=p=>['parentId','mapId','combatId','effectId','targetId'].every(key=>typeof p?.[key]==='string'&&p[key].length>0&&p[key].length<=2000)
const reject=error=>({ok:false,status:403,error})
const key=p=>'spell-target-original-saving:'+JSON.stringify([p.parentId,p.effectId,p.targetId])
const preparationKey=p=>'spell-target-original-preparation:'+JSON.stringify([p.parentId,p.effectId,p.targetId])
const requestId=p=>'spell-target-original-saving:'+JSON.stringify([p.parentId,p.effectId,p.targetId,'original'])
async function original(ctx,p,api){
 if(!identity(p))return null
 // The Host identity comes exclusively from the existing private preparation
 // book. It is never a principal, role or clock submitted in this request.
 const stored=await api.load(ctx,preparationKey(p))
 if(!stored||stored.roomId!==ctx.roomId||typeof stored.hostMemberId!=='string'||!stored.hostMemberId)return null
 const current=await readSpellTargetOriginalPreparation(ctx,{parentId:p.parentId,mapId:p.mapId,combatId:p.combatId,effectId:p.effectId,targetId:p.targetId},{role:'dm',memberId:stored.hostMemberId},api)
 if(current.ok!==true||current.sourceKind!=='spell-target-original-preparation-v1'||!api.equal(current.requirement,stored.requirement)||!['normal','advantage','disadvantage'].includes(current.requirement.rollMode)||current.requirement.requiredDiceCount!==(current.requirement.rollMode==='normal'?1:2))return null
 return current
}
/** No source, mode, faces, controller or clock is accepted here. The
 * actual still-current missing-target preparation is the sole parent. */
export async function prepareSpellTargetOriginalSaving(ctx,p,principal,api){
 if(!closed(p,['parentId','mapId','combatId','effectId','targetId'])||!identity(p))return reject('spell-target-saving:identity-only-required')
 const parent=await original(ctx,p,api)
 if(!parent||principal.role!=='dm'||principal.memberId!==parent.hostMemberId)return reject('spell-target-saving:actual-current-host-parent-required')
 const book={schemaVersion:1,sourceKind:'spell-target-original-saving-v1',roomId:ctx.roomId,parentId:p.parentId,mapId:p.mapId,combatId:p.combatId,effectId:p.effectId,targetId:p.targetId,hostMemberId:parent.hostMemberId,memberId:parent.memberId,role:parent.memberId===parent.hostMemberId?'dm':'player',rollerTokenId:parent.requirement.targetId,rollerCharacterId:parent.characterId,effectTimestamp:parent.effectTimestamp,mode:parent.requirement.rollMode,count:parent.requirement.requiredDiceCount,sides:20,requestId:requestId(p),parentSignature:JSON.stringify(parent)}
 const existing=await api.load(ctx,key(p));if(existing&&!api.equal(existing,book))return reject('spell-target-saving:immutable-native-parent-required')
 if(!existing)await api.save(ctx,key(p),book)
 const pointer={parentId:p.parentId,mapId:p.mapId,combatId:p.combatId,effectId:p.effectId,targetId:p.targetId,roomId:ctx.roomId,requestId:book.requestId},pointerKey='spell-target-original-saving-request:'+book.requestId,priorPointer=await api.load(ctx,pointerKey)
 if(priorPointer&&!api.equal(priorPointer,pointer))return reject('spell-target-saving:immutable-request-required')
 if(!priorPointer)await api.save(ctx,pointerKey,pointer)
 return{ok:true,...book}
}
async function current(ctx,p,api){const parent=await original(ctx,p,api),book=await api.load(ctx,key(p));return parent&&book?.roomId===ctx.roomId&&book.sourceKind==='spell-target-original-saving-v1'&&book.parentSignature===JSON.stringify(parent)&&book.requestId===requestId(p)?book:null}
const faces=(v,book)=>Array.isArray(v)&&v.length===book.count&&v.every(n=>Number.isInteger(n)&&n>=1&&n<=book.sides)
export async function recordSpellTargetOriginalSavingDice(ctx,p,principal,api){
 if(!closed(p,['parentId','mapId','combatId','effectId','targetId','requestId','phase','values'])||!identity(p)||!['start','raw','adopt'].includes(p.phase))return reject('spell-target-saving:closed-original-input-required')
 const book=await current(ctx,p,api);if(!book||p.requestId!==book.requestId)return reject('spell-target-saving:current-issued-original-required')
 const own=principal.memberId===book.memberId&&principal.role===book.role,host=principal.memberId===book.hostMemberId&&principal.role==='dm',rowKey=key(p)+':faces',row=await api.load(ctx,rowKey)
 if(p.phase==='start'){
  if(!own||Object.hasOwn(p,'values'))return reject('spell-target-saving:actual-controller-start-required')
  if(!row)await api.save(ctx,rowKey,{schemaVersion:1,requestId:book.requestId,memberId:book.memberId,role:book.role,started:true})
  return{ok:true}
 }
 if(!faces(p.values,book))return reject('spell-target-saving:exact-original-pool-required')
 if(!row?.started||row.requestId!==book.requestId||row.memberId!==book.memberId||row.role!==book.role)return reject('spell-target-saving:actual-physical-start-required')
 if(p.phase==='raw'){
  if(!own)return reject('spell-target-saving:actual-physical-controller-required')
  if(row.raw&&!api.equal(row.raw,p.values))return{ok:false,status:409,error:'spell-target-saving:immutable-physical-pool-required'}
  if(!row.raw)await api.save(ctx,rowKey,{...row,raw:[...p.values]})
 }else{
  if(!host||!row.raw)return reject('spell-target-saving:physical-before-independent-adoption-required')
  if(row.adopted&&!api.equal(row.adopted,p.values))return{ok:false,status:409,error:'spell-target-saving:immutable-host-adoption-required'}
  if(!row.adopted)await api.save(ctx,rowKey,{...row,adopted:[...p.values],adoptedBy:principal.memberId})
 }
 return{ok:true}
}
export async function inspectSpellTargetOriginalSaving(ctx,p,principal,api){
 if(!closed(p,['parentId','mapId','combatId','effectId','targetId'])||!identity(p))return reject('spell-target-saving:identity-only-required')
 const book=await current(ctx,p,api);if(!book||principal.role!=='dm'||principal.memberId!==book.hostMemberId)return reject('spell-target-saving:current-host-original-required')
 const row=await api.load(ctx,key(p)+':faces');return{ok:true,...book,...(row?.raw?{physical:row.raw}:{}),...(row?.adopted?{adopted:row.adopted,adoptedBy:row.adoptedBy}:{})}
}
export async function readSpellTargetOriginalSaving(ctx,p,principal,api){
 const reply=await inspectSpellTargetOriginalSaving(ctx,p,principal,api);if(reply.ok!==true)return reply
 if(!faces(reply.physical,reply)||!faces(reply.adopted,reply)||reply.adoptedBy!==reply.hostMemberId)return reject('spell-target-saving:actual-complete-original-required')
 return{...reply,roll:{d20:reply.adopted[0],...(reply.mode!=='normal'?{d20Second:reply.adopted[1]}:{})}}
}
export async function recordSpellTargetOriginalSavingEvent(ctx,channel,p,principal,api){
 const id=p?.requestId,confirmed=typeof id==='string'&&id.endsWith(':dm-confirmed'),originalId=confirmed?id.slice(0,-13):id
 if(typeof originalId!=='string'||!originalId.startsWith('spell-target-original-saving:'))return{ok:true}
 if(!['dice-roll-request-player-to-dm','dice-roll-request-dm-to-player'].includes(channel))return reject('spell-target-saving:actual-dice-channel-required')
 const pointer=await api.load(ctx,'spell-target-original-saving-request:'+originalId)
 if(!pointer||pointer.roomId!==ctx.roomId||pointer.requestId!==originalId)return reject('spell-target-saving:actual-private-request-required')
 const identity={parentId:pointer.parentId,mapId:pointer.mapId,combatId:pointer.combatId,effectId:pointer.effectId,targetId:pointer.targetId},book=await current(ctx,identity,api)
 if(!book||p.mapId!==book.mapId||p.combatId!==book.combatId||p.count!==book.count||p.sides!==20||!['d20','dice'].includes(p.kind))return reject('spell-target-saving:exact-component-event-required')
 const host=principal.role==='dm'&&principal.memberId===book.hostMemberId,own=principal.role===book.role&&principal.memberId===book.memberId,rowKey=key(identity)+':faces'
 if(confirmed){const row=await api.load(ctx,rowKey);return host&&p.delivery==='broadcast-result'&&faces(p.values,book)&&api.equal(row?.adopted,p.values)?{ok:true}:reject('spell-target-saving:actual-confirmed-presentation-required')}
 if(p.rollerTokenId!==book.rollerTokenId||(p.targetCharacterId??null)!==book.rollerCharacterId||p.rollKind!=='saving-throw')return reject('spell-target-saving:canonical-target-event-controller-required')
 if(p.delivery==='player-roll-request')return host&&book.role==='player'?{ok:true}:reject('spell-target-saving:actual-host-player-request-required')
 if(!own||book.role!=='player'||!['player-roll-start','player-roll-result'].includes(p.delivery))return reject('spell-target-saving:actual-physical-player-required')
 const announceKey=key(identity)+':announced',announced=await api.load(ctx,announceKey)
 if(p.delivery==='player-roll-start'){
  if(!Array.isArray(p.values)||p.values.length&&!faces(p.values,book))return reject('spell-target-saving:exact-announced-faces-required')
  if(p.values.length){const row=await api.load(ctx,rowKey);if(announced&&!api.equal(announced.values,p.values)||row?.raw&&!api.equal(row.raw,p.values))return{ok:false,status:409,error:'spell-target-saving:immutable-announced-faces-required'};if(!announced)await api.save(ctx,announceKey,{memberId:principal.memberId,values:[...p.values]})}
  return recordSpellTargetOriginalSavingDice(ctx,{...identity,requestId:originalId,phase:'start'},principal,api)
 }
 if(!faces(p.values,book)||announced&&(announced.memberId!==principal.memberId||!api.equal(announced.values,p.values)))return reject('spell-target-saving:exact-physical-result-required')
 return recordSpellTargetOriginalSavingDice(ctx,{...identity,requestId:originalId,phase:'raw',values:p.values},principal,api)
}
