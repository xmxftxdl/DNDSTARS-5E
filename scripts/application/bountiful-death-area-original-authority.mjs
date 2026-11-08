import{bountifulDeathSaveSourceFacts,currentBountifulDeathSaveOriginal}from'../../shared/bountiful-death-save-original.mjs'
import{validateBountifulOriginalParents,bountifulOriginalRowReady}from'../../shared/bountiful-luck-state.mjs'
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v),closed=(v,keys)=>object(v)&&Object.keys(v).every(k=>keys.includes(k)),reject=error=>({ok:false,status:403,error}),identity=['parentId','mapId','combatId'],namespace='bountiful-death-area-original:',key=id=>'death-area-original:'+id
const immutable=row=>Object.fromEntries(Object.entries(row).filter(([k])=>!['ownerDecisions','rawReroll','hostReroll','processedRequestIds','consumed','continuation','postOriginalD20','postOriginalEquipmentD20','postOriginalCursor','opportunitySettlementRolls','nativeLuckyDecision'].includes(k)))
const faces=(v,count,sides)=>Array.isArray(v)&&v.length===count&&v.every(n=>Number.isInteger(n)&&n>=1&&n<=sides)
/** This ledger is deliberately only the first actual normal Sickening Radiance
 * turn-start save after a deferred Death. It accepts no state, prepared frame,
 * Native result, save outcome or publication claim from the caller. */
async function current(ctx,p,principal,api){
 if(principal.role!=='dm'||!principal.memberId)return null
 const d=await api.context(ctx),parent=d.requests?.requests?.find(a=>a.id===p.parentId),all=d.combat?.bountifulOriginalParents
 if(!parent||!validateBountifulOriginalParents(all))return null
 const rows=Object.entries(all??{}).filter(([,r])=>r.identity.parentId===p.parentId).sort((a,b)=>a[1].identity.occurrence-b[1].identity.occurrence),first=rows[0]?.[1],source=first&&bountifulDeathSaveSourceFacts(first.originalParent)
 if(!first||!source||first.originalAdapterId!=='death-save'||first.identity.hostMemberId!==principal.memberId||first.identity.roomId!==ctx.roomId||first.identity.mapId!==p.mapId||first.identity.combatId!==p.combatId||first.request.nativeLucky||!source.command.deferNextTurnStart||source.command.activeEffectSavingThrows?.length||source.command.activeEffectPeriodicDamageRolls?.length||source.command.activeEffectRandomConditionRolls?.length||source.command.turnStartActiveEffectSavingThrows?.length||source.command.turnStartActiveEffectPeriodicDamageRolls?.length||source.command.turnStartGazeResolutions?.length||!currentBountifulDeathSaveOriginal(first,d,parent,api.equal))return null
 for(let i=0;i<rows.length;i++){const[id,row]=rows[i],stamp=await api.load(ctx,'original:'+id);if(row.identity.occurrence!==i||row.consumed||row.originalAdapterId!=='death-save'||row.request.actorId!==first.request.actorId||row.identity.effectTimestamp!==first.identity.effectTimestamp||!api.equal(row.originalParent,first.originalParent)||!api.equal(row.rawIssuer,first.rawIssuer)||!api.equal(row.request.originalRolls,first.request.originalRolls)||!bountifulOriginalRowReady(row)||!stamp||stamp.roomId!==ctx.roomId||stamp.memberId!==principal.memberId||stamp.identity!==api.digest(immutable(row)))return null}
 if(first.identity.reactionEconomySignature!==JSON.stringify(d.combat.dnd5eTurnEconomyByToken??{}))return null
 const final=[...first.request.originalRolls];for(const[,row]of rows)if(row.hostReroll)final[row.request.dieIndex]=row.hostReroll.value
 // A natural 20 resumes this actor instead of crossing into the next area.
 if(final.length!==1||final[0]===20||source.deathSaves.failures!==0||source.deathSaves.successes!==0)return null
 const order=d.combat.initiativeOrder,index=(d.combat.initiativeIndex+1)%order.length,next=order[index],slot=next.slotId??next.tokenId
 if(source.command.nextTurnSlotId!==undefined&&source.command.nextTurnSlotId!==slot)return null
 const map=d.maps.maps.find(m=>m.id===p.mapId),target=map?.tokens?.find(t=>t.id===next.tokenId),owned=api.controller(d,p.mapId,next.tokenId,ctx.roomId)??api.hostPoolController(d,p.mapId,next.tokenId)
 if(!target||target.size!==1||!(target.hp>0)||target.type==='obstacle'||!owned?.character||owned.character.currentHp!==target.hp)return null
 const round=d.combat.round+(index===0?1:0),areas=(map.dnd5ePluginAreas??[]).filter(a=>String(a.coreSpellId??'').endsWith(':sickening-radiance')&&a.sourceKind==='core-spell'&&a.createdRound<=round&&a.expiresAfterRound>=round&&a.anchorMode==='fixed'&&a.cells?.some(c=>c.col===Math.floor(target.x/map.gridSize)&&c.row===Math.floor(target.y/map.gridSize)))
 if(areas.length!==1)return null
 const area=areas[0],triggers=area.triggers?.filter(t=>t.timing==='turn-start')??[],trigger=triggers[0],caster=api.controller(d,p.mapId,area.sourceTokenId,ctx.roomId)??api.hostPoolController(d,p.mapId,area.sourceTokenId),turnKey=round+':'+slot
 if(triggers.length!==1||!caster?.character||caster.character.id!==area.sourceCharacterId||trigger.sourceChoosesTargets||trigger.sourceMayDecline||trigger.dmAdjustable||trigger.savingThrow?.ability!=='con'||trigger.savingThrow.allowWillingFailure||trigger.savingThrow.onSuccess!=='none'||trigger.damage?.count!==4||trigger.damage.sides!==10||trigger.damage.type!=='radiant'||trigger.oncePerTurn!==true||trigger.oncePerRound!==false||area.triggerReceipts?.some(r=>r.targetTokenId===target.id&&r.turnKey===turnKey))return null
 const names=['characters','maps','combat','map-geometry','campaign-time','player-action-requests','player-action-processed','player-action-ack'],docs={},revisions={}
 for(const name of names){const doc=await api.doc(ctx,name);if(doc!==null&&doc!==undefined&&(!object(doc._sync)||!Number.isInteger(doc._sync.revision)||doc._sync.revision<0))return null;docs[name]=doc??null;revisions[name]=doc?._sync?.revision??0}
 if(Object.entries(first.identity.revisions).some(([name,revision])=>revisions[name]!==revision)||docs['player-action-processed']?.actionIds?.includes(p.parentId)||docs['player-action-ack']?.actionId===p.parentId)return null
 const saving={actorId:target.id,characterId:owned.character.id,memberId:owned.character.roomMemberId??principal.memberId,count:1,sides:20,ability:'con',dc:trigger.savingThrow.dc,mode:'normal'},damage={actorId:area.sourceTokenId,characterId:caster.character.id,memberId:caster.character.roomMemberId??principal.memberId,count:4,sides:10,type:'radiant'}
 if(!Number.isInteger(saving.dc)||saving.dc<1)return null
 return{base:{schemaVersion:1,roomId:ctx.roomId,hostMemberId:principal.memberId,...Object.fromEntries(identity.map(k=>[k,p[k]])),effectTimestamp:first.identity.effectTimestamp,originalSource:first.originalParent,originalRows:rows.map(([,r])=>r),area,trigger,target,round,turnKey,saving,damage,revisions,sourceSignature:api.digest(docs)},docs}
}
export async function recordBountifulDeathAreaOriginal(ctx,p,principal,api){
 if(!closed(p,['sourceKind','phase',...identity,'requestId','pool','rawValues','values'])||p.sourceKind!=='death-area-original-v1'||!identity.every(k=>typeof p[k]==='string'&&p[k]))return reject('death-area-original:closed-current-parent-required')
 const actual=await current(ctx,p,principal,api);if(!actual)return reject('death-area-original:protected-current-deferred-death-required')
 const base=actual.base,requestId=namespace+api.digest(base),prior=await api.load(ctx,key(p.parentId)),book=prior??{...base,requestId,pools:{}}
 if(prior){const{pools,...saved}=prior;if(!api.equal(saved,{...base,requestId}))return reject('death-area-original:immutable-current-source')}
 if(p.phase==='register'){if(['requestId','pool','rawValues','values'].some(k=>p[k]!==undefined))return reject('death-area-original:closed-register-required');if(!prior){await api.save(ctx,key(p.parentId),book);for(const pool of ['saving','damage'])await api.save(ctx,'death-area-pool:'+requestId+':'+pool,{...Object.fromEntries(identity.map(k=>[k,p[k]])),hostMemberId:principal.memberId,pool})}return{ok:true,requestId}}
 if(!prior||p.requestId!==requestId||!['saving','damage'].includes(p.pool))return reject('death-area-original:exact-issued-pool-required')
 const spec=book[p.pool],row=book.pools[p.pool]??{}
 // No damage request precedes the independently adopted original saving pool.
 if(p.pool==='damage'&&!book.pools.saving?.confirmed)return reject('death-area-original:saving-adoption-required')
 if(p.phase==='host-raw'){if(spec.memberId!==principal.memberId||p.values!==undefined||!faces(p.rawValues,spec.count,spec.sides))return reject('death-area-original:canonical-host-raw-required');const raw={memberId:principal.memberId,values:p.rawValues};if(row.raw&&!api.equal(row.raw,raw))return reject('death-area-original:raw-immutable');row.raw=raw}
 else if(p.phase==='confirm'){if(!row.raw||!faces(p.rawValues,spec.count,spec.sides)||!faces(p.values,spec.count,spec.sides)||!api.equal(row.raw.values,p.rawValues))return reject('death-area-original:independent-raw-required');const confirmed={memberId:principal.memberId,values:p.values};if(row.confirmed&&!api.equal(row.confirmed,confirmed))return reject('death-area-original:adoption-immutable');row.confirmed=confirmed}
 else return reject('death-area-original:issued-phase-required')
 book.pools[p.pool]=row;await api.save(ctx,key(p.parentId),book);return{ok:true}
}
export async function readBountifulDeathAreaOriginal(ctx,p,principal,api){if(!closed(p,identity)||!identity.every(k=>typeof p[k]==='string'&&p[k]))return reject('death-area-original:closed-read-required');const actual=await current(ctx,p,principal,api),book=await api.load(ctx,key(p.parentId));if(!actual)return reject('death-area-original:protected-current-deferred-death-required');if(!book)return{ok:true,present:false};const{pools,...saved}=book;if(!api.equal(saved,{...actual.base,requestId:namespace+api.digest(actual.base)}))return reject('death-area-original:immutable-current-source');return{ok:true,present:true,...book}}
export async function recordBountifulDeathAreaOriginalDice(ctx,p,principal,api){
 const presentation=typeof p?.requestId==='string'&&p.requestId.endsWith(':dm-confirmed'),id=presentation?p.requestId.slice(0,-13):p?.requestId
 if(typeof id!=='string'||!/^bountiful-death-area-original:[a-f0-9]{64}:(saving|damage)$/.test(id))return reject('death-area-original:exact-issued-request-required')
 const index=await api.load(ctx,'death-area-pool:'+id);if(!index)return reject('death-area-original:private-issued-pool-required')
 const result=await readBountifulDeathAreaOriginal(ctx,Object.fromEntries(identity.map(k=>[k,index[k]])),{role:'dm',memberId:index.hostMemberId},api)
 if(!result.ok||!result.present)return reject('death-area-original:current-private-book-required')
 const{ok,present,...book}=result,spec=book[index.pool],row=book.pools[index.pool]??{}
 if(p.mapId!==book.mapId||p.combatId!==book.combatId||p.count!==spec.count||p.sides!==spec.sides||!['dice','d20'].includes(p.kind))return reject('death-area-original:exact-issued-pool-required')
 if(index.pool==='damage'&&!book.pools.saving?.confirmed)return reject('death-area-original:saving-adoption-required')
 if(presentation)return principal.role==='dm'&&principal.memberId===book.hostMemberId&&p.delivery==='broadcast-result'&&row.confirmed&&api.equal(p.values,row.confirmed.values)?{ok:true}:reject('death-area-original:confirmed-presentation-required')
 if(p.rollerTokenId!==spec.actorId||p.targetCharacterId!==spec.characterId||p.rollKind!==(index.pool==='saving'?'saving-throw':'damage'))return reject('death-area-original:canonical-roller-required')
 if(p.delivery==='player-roll-request')return principal.role==='dm'&&principal.memberId===book.hostMemberId&&spec.memberId!==book.hostMemberId?{ok:true}:reject('death-area-original:canonical-host-request-required')
 if(!['player-roll-start','player-roll-result'].includes(p.delivery)||principal.role!=='player'||principal.memberId!==spec.memberId||spec.memberId===book.hostMemberId||p.delivery==='player-roll-result'&&!faces(p.values,spec.count,spec.sides)||p.delivery==='player-roll-start'&&(!Array.isArray(p.values)||p.values.length!==0&&!faces(p.values,spec.count,spec.sides)))return reject('death-area-original:canonical-physical-player-required')
 if(p.delivery==='player-roll-start'){if(p.values.length){const announced={memberId:principal.memberId,values:[...p.values]};if(row.announced&&!api.equal(row.announced,announced)||row.raw&&!api.equal(row.raw,announced))return reject('death-area-original:announced-immutable');row.announced=announced}else return{ok:true}}
 else{const raw={memberId:principal.memberId,values:[...p.values]};if(row.announced&&!api.equal(row.announced,raw)||row.raw&&!api.equal(row.raw,raw))return reject('death-area-original:raw-immutable');row.raw=raw}
 book.pools[index.pool]=row;await api.save(ctx,key(book.parentId),book);return{ok:true}
}
