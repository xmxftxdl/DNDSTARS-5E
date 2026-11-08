const data=v=>!!v&&typeof v==='object'&&!Array.isArray(v),closed=(v,keys)=>data(v)&&Object.keys(v).every(k=>keys.includes(k)),identity=p=>['parentId','mapId','combatId'].every(k=>typeof p?.[k]==='string'&&p[k].length>0&&p[k].length<=2000)&&Number.isSafeInteger(p?.frameIndex)&&p.frameIndex>=0,reject=error=>({ok:false,status:403,error}),parentKey=p=>'storm-fury-original:'+JSON.stringify([p.parentId,p.frameIndex]),savingKey=p=>'storm-fury-saving:'+JSON.stringify([p.parentId,p.frameIndex])
const components=p=>[{key:'original',count:p.mode==='normal'?1:2,sides:20},...(p.blessed?[{key:'bless',count:1,sides:4}]:[]),...(p.baned?[{key:'bane',count:1,sides:4}]:[])]
async function parent(ctx,p,api){
 if(!identity(p))return null
 const book=await api.load(ctx,parentKey(p));if(!book||book.roomId!==ctx.roomId||book.mapId!==p.mapId||book.combatId!==p.combatId)return null
 const d=await api.context(ctx),geometry=await api.doc(ctx,'map-geometry'),clock=await api.doc(ctx,'campaign-time'),processed=await api.doc(ctx,'player-action-processed'),ack=await api.doc(ctx,'player-action-ack'),scope={characters:d.characters,maps:d.maps,requests:d.requests,geometry,clock,combat:d.combat}
 if(d.combat?.active!==true||d.combat.mapId!==p.mapId||d.combat.combatId!==p.combatId||!api.equal(book.scope,scope)||processed?.actionIds?.includes(p.parentId)||ack?.actionId===p.parentId&&['accepted','rejected'].includes(ack.status))return null
 const owner=api.controller(d,p.mapId,book.frame.event.targetId,ctx.roomId),answer=await api.load(ctx,parentKey(p)+':answer')
 if(!owner?.character||owner.character.id!==book.characterId||(owner.character.roomMemberId??book.hostMemberId)!==book.memberId||!answer||answer.roomId!==ctx.roomId||answer.memberId!==book.memberId||answer.role!==(book.memberId===book.hostMemberId?'dm':'player')||answer.windowId!==book.windowId||answer.decision?.kind!=='use'||!book.frame.options.some(o=>o.featureId===answer.decision.featureId))return null
 return{book,answer,d}
}
/** Family-private original STR component book. It authenticates physical input
 * and Host adoption only; Native rechecks the actual issued saving frontier. */
export async function recordStormFurySavingPreparation(ctx,p,principal,api){
 if(principal.role!=='dm'||!principal.memberId||!closed(p,['sourceKind','phase','parentId','mapId','combatId','frameIndex','family','source','request','prefixSignature','effectTimestamp','mode','blessed','baned'])||p.sourceKind!=='storm-fury-saving-v1'||p.phase!=='prepare'||!identity(p)||!['normal','advantage','disadvantage'].includes(p.mode)||typeof p.blessed!=='boolean'||typeof p.baned!=='boolean'||typeof p.prefixSignature!=='string'||!p.prefixSignature||!closed(p.request,['kind','frame','featureId'])||p.request.kind!=='saving-throw')return reject('storm-fury-saving:actual-saving-shape-required')
 const current=await parent(ctx,p,api);if(!current)return reject('storm-fury-saving:current-used-owner-required')
 const{book,answer,d}=current
 if(principal.memberId!==book.hostMemberId||p.family!==book.family||p.effectTimestamp!==book.effectTimestamp||!api.equal(p.source,book.source)||!api.equal(p.request.frame,book.frame)||p.request.featureId!==answer.decision.featureId)return reject('storm-fury-saving:exact-native-parent-required')
 const roller=api.controller(d,p.mapId,book.frame.event.actorId,ctx.roomId);if(!roller)return reject('storm-fury-saving:canonical-attacker-controller-required')
 const memberId=roller.character?.roomMemberId??book.hostMemberId,role=memberId===book.hostMemberId?'dm':'player',rows=components(p).map(component=>({...component,requestId:'storm-fury-saving:'+JSON.stringify([p.parentId,p.frameIndex,p.request.featureId,component.key])})),candidate={schemaVersion:1,sourceKind:p.sourceKind,roomId:ctx.roomId,parentId:p.parentId,mapId:p.mapId,combatId:p.combatId,frameIndex:p.frameIndex,hostMemberId:book.hostMemberId,rollerTokenId:book.frame.event.actorId,rollerCharacterId:roller.character?.id??null,memberId,role,source:p.source,request:p.request,prefixSignature:p.prefixSignature,effectTimestamp:p.effectTimestamp,mode:p.mode,blessed:p.blessed,baned:p.baned,components:rows},prior=await api.load(ctx,savingKey(p))
 if(prior&&!api.equal(prior,candidate))return reject('storm-fury-saving:immutable-original-components-required')
 if(!prior)await api.save(ctx,savingKey(p),candidate)
 for(const component of rows){const pointer={schemaVersion:1,roomId:ctx.roomId,parentId:p.parentId,mapId:p.mapId,combatId:p.combatId,frameIndex:p.frameIndex,requestId:component.requestId},pointerKey='storm-fury-saving-request:'+component.requestId,stored=await api.load(ctx,pointerKey);if(stored&&!api.equal(stored,pointer))return reject('storm-fury-saving:immutable-private-request-required');if(!stored)await api.save(ctx,pointerKey,pointer)}
 return{ok:true,components:rows,rollerTokenId:candidate.rollerTokenId,rollerCharacterId:candidate.rollerCharacterId,memberId,role}
}
async function saving(ctx,p,api){const original=await parent(ctx,p,api),book=await api.load(ctx,savingKey(p));if(!original||!book||book.roomId!==ctx.roomId||book.hostMemberId!==original.book.hostMemberId||book.request.featureId!==original.answer.decision.featureId||!api.equal(book.source,original.book.source)||!api.equal(book.request.frame,original.book.frame)||book.effectTimestamp!==original.book.effectTimestamp)return null;const controller=api.controller(original.d,p.mapId,book.rollerTokenId,ctx.roomId);if(!controller||(controller.character?.id??null)!==book.rollerCharacterId||(controller.character?.roomMemberId??book.hostMemberId)!==book.memberId)return null;return book}
export async function recordStormFurySavingDice(ctx,p,principal,api){
 if(!closed(p,['parentId','mapId','combatId','frameIndex','requestId','phase','values'])||!identity(p)||!['start','raw','adopt'].includes(p.phase)||typeof p.requestId!=='string')return reject('storm-fury-saving:closed-dice-request-required')
 const book=await saving(ctx,p,api),component=book?.components.find(c=>c.requestId===p.requestId);if(!book||!component)return reject('storm-fury-saving:current-original-component-required')
 const own=principal.memberId===book.memberId&&principal.role===book.role,host=principal.memberId===book.hostMemberId&&principal.role==='dm',rowKey=savingKey(p)+':component:'+component.key,row=await api.load(ctx,rowKey)
 if(p.phase==='start'){
  if(!own||Object.hasOwn(p,'values'))return reject('storm-fury-saving:actual-roller-start-required')
  if(!row)await api.save(ctx,rowKey,{schemaVersion:1,requestId:p.requestId,memberId:book.memberId,role:book.role,started:true})
  return{ok:true}
 }
 if(!Array.isArray(p.values)||p.values.length!==component.count||p.values.some(n=>!Number.isInteger(n)||n<1||n>component.sides))return reject('storm-fury-saving:exact-component-faces-required')
 if(!row?.started||row.requestId!==p.requestId||row.memberId!==book.memberId||row.role!==book.role)return reject('storm-fury-saving:actual-physical-start-required')
 if(p.phase==='raw'){
  if(!own)return reject('storm-fury-saving:actual-physical-roller-required')
  if(row.raw&&!api.equal(row.raw,p.values))return{ok:false,status:409,error:'storm-fury-saving:immutable-physical-values-required'}
  if(!row.raw)await api.save(ctx,rowKey,{...row,raw:p.values})
 }else{
  if(!host||!row.raw)return reject('storm-fury-saving:physical-before-host-adoption-required')
  if(row.adopted&&!api.equal(row.adopted,p.values))return{ok:false,status:409,error:'storm-fury-saving:immutable-host-adoption-required'}
  if(!row.adopted)await api.save(ctx,rowKey,{...row,adopted:p.values,adoptedBy:principal.memberId})
 }
 return{ok:true}
}
export async function readStormFurySavingDice(ctx,p,principal,api){
 if(!closed(p,['parentId','mapId','combatId','frameIndex'])||!identity(p))return reject('storm-fury-saving:identity-only-required')
 const book=await saving(ctx,p,api);if(!book||principal.role!=='dm'||principal.memberId!==book.hostMemberId)return reject('storm-fury-saving:current-host-source-required')
 const rows=await Promise.all(book.components.map(c=>api.load(ctx,savingKey(p)+':component:'+c.key)));if(rows.some((r,i)=>!r?.started||r.requestId!==book.components[i].requestId||!r.raw||!r.adopted||r.adoptedBy!==book.hostMemberId))return reject('storm-fury-saving:all-actual-components-required')
 const values=Object.fromEntries(book.components.map((c,i)=>[c.key,rows[i].adopted])),roll={d20:values.original[0],...(book.mode!=='normal'?{d20Second:values.original[1]}:{}),...(book.blessed?{blessRoll:values.bless[0]}:{}),...(book.baned?{baneRoll:values.bane[0]}:{})}
 return{ok:true,request:book.request,prefixSignature:book.prefixSignature,effectTimestamp:book.effectTimestamp,mode:book.mode,blessed:book.blessed,baned:book.baned,roll,components:book.components.map((c,i)=>({...c,physical:rows[i].raw,adopted:rows[i].adopted,memberId:book.memberId,adoptedBy:rows[i].adoptedBy}))}
}
export async function inspectStormFurySavingComponent(ctx,p,principal,api){
 if(!closed(p,['parentId','mapId','combatId','frameIndex','requestId'])||!identity(p)||typeof p.requestId!=='string')return reject('storm-fury-saving:exact-component-identity-required')
 const book=await saving(ctx,p,api),component=book?.components.find(c=>c.requestId===p.requestId);if(!book||!component||principal.role!=='dm'||principal.memberId!==book.hostMemberId)return reject('storm-fury-saving:current-host-component-required')
 const row=await api.load(ctx,savingKey(p)+':component:'+component.key)
 return{ok:true,sourceKind:book.sourceKind,parentId:book.parentId,mapId:book.mapId,combatId:book.combatId,frameIndex:book.frameIndex,source:book.source,request:book.request,prefixSignature:book.prefixSignature,effectTimestamp:book.effectTimestamp,mode:book.mode,blessed:book.blessed,baned:book.baned,component,hostMemberId:book.hostMemberId,memberId:book.memberId,role:book.role,rollerTokenId:book.rollerTokenId,rollerCharacterId:book.rollerCharacterId,...(row?.raw?{physical:row.raw}:{}),...(row?.adopted?{adopted:row.adopted}:{})}
}
/** Generic DiceBox events are input data. Only an indexed, current Fury request
 * and its authenticated actual roller may record this family's physical row. */
export async function recordStormFurySavingDiceEvent(ctx,channel,p,principal,api){
 const id=p?.requestId,confirmed=typeof id==='string'&&id.endsWith(':dm-confirmed'),requestId=confirmed?id.slice(0,-13):id
 if(typeof requestId!=='string'||!requestId.startsWith('storm-fury-saving:'))return{ok:true}
 if(!['dice-roll-request-player-to-dm','dice-roll-request-dm-to-player'].includes(channel))return reject('storm-fury-saving:actual-dice-channel-required')
 const pointer=await api.load(ctx,'storm-fury-saving-request:'+requestId);if(!pointer||pointer.roomId!==ctx.roomId)return reject('storm-fury-saving:actual-private-request-required')
 const identity={parentId:pointer.parentId,mapId:pointer.mapId,combatId:pointer.combatId,frameIndex:pointer.frameIndex},book=await saving(ctx,identity,api),component=book?.components.find(c=>c.requestId===requestId)
 if(!book||!component||p.mapId!==book.mapId||p.combatId!==book.combatId||p.count!==component.count||p.sides!==component.sides||!['d20','dice'].includes(p.kind))return reject('storm-fury-saving:actual-component-event-required')
 const host=principal.role==='dm'&&principal.memberId===book.hostMemberId,own=principal.role===book.role&&principal.memberId===book.memberId,faces=v=>Array.isArray(v)&&v.length===component.count&&v.every(n=>Number.isInteger(n)&&n>=1&&n<=component.sides)
 if(confirmed){const row=await api.load(ctx,savingKey(identity)+':component:'+component.key);return host&&p.delivery==='broadcast-result'&&faces(p.values)&&api.equal(row?.adopted,p.values)?{ok:true}:reject('storm-fury-saving:actual-confirmed-presentation-required')}
 if(p.rollerTokenId!==book.rollerTokenId||(p.targetCharacterId??null)!==book.rollerCharacterId||p.rollKind!=='saving-throw')return reject('storm-fury-saving:canonical-original-event-roller-required')
 if(p.delivery==='player-roll-request')return host&&book.role==='player'?{ok:true}:reject('storm-fury-saving:actual-host-player-request-required')
 if(!own||book.role!=='player'||!['player-roll-start','player-roll-result'].includes(p.delivery))return reject('storm-fury-saving:actual-physical-player-required')
 const announcedKey=savingKey(identity)+':announced:'+component.key,announced=await api.load(ctx,announcedKey)
 if(p.delivery==='player-roll-start'){
  if(!Array.isArray(p.values)||p.values.length&&!faces(p.values))return reject('storm-fury-saving:actual-announced-faces-required')
  if(p.values.length){const recorded=await api.load(ctx,savingKey(identity)+':component:'+component.key);if(announced&&!api.equal(announced.values,p.values)||recorded?.raw&&!api.equal(recorded.raw,p.values))return{ok:false,status:409,error:'storm-fury-saving:immutable-announced-faces-required'};if(!announced)await api.save(ctx,announcedKey,{memberId:principal.memberId,values:p.values})}
  return recordStormFurySavingDice(ctx,{...identity,requestId,phase:'start'},principal,api)
 }
 if(!faces(p.values)||announced&&(announced.memberId!==principal.memberId||!api.equal(announced.values,p.values)))return reject('storm-fury-saving:exact-physical-result-required')
 return recordStormFurySavingDice(ctx,{...identity,requestId,phase:'raw',values:p.values},principal,api)
}
