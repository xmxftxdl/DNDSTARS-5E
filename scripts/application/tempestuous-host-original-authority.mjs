import{secondChanceCanonicalControllerMemberId}from'../../shared/second-chance-controller.mjs'
// This private ledger authenticates a Host's input only. A row is never a
// Native frame, raw issuer, owner answer, reaction or publication capability.
const data=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)
const closed=(v,keys)=>data(v)&&Object.keys(v).every(k=>keys.includes(k))
const id=v=>typeof v==='string'&&v.length>0&&v.length<=2000
const integer=v=>Number.isSafeInteger(v)&&v>=0
const reject=error=>({ok:false,status:403,error})
const key=parent=>'tempestuous-host-original:'+parent
const identity=p=>closed(p,['parentId','mapId','combatId'])&&['parentId','mapId','combatId'].every(k=>id(p[k]))
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
function spellIntent(v){
 if(!closed(v,['spellId','slotLevel','castingClassId','targetTokenId','targetTokenIds','areaTargetCell','ritual','itemInstanceId','itemUseActionId','focusItemInstanceId','racialInnate','projectileTargetIds'])||!id(v.spellId)||!Number.isSafeInteger(v.slotLevel)||v.slotLevel<1||v.slotLevel>9)return false
 if(['castingClassId','targetTokenId','itemInstanceId','itemUseActionId','focusItemInstanceId'].some(k=>v[k]!==undefined&&!id(v[k])))return false
 if(['ritual','racialInnate'].some(k=>v[k]!==undefined&&typeof v[k]!=='boolean'))return false
 if(['targetTokenIds','projectileTargetIds'].some(k=>v[k]!==undefined&&(!Array.isArray(v[k])||v[k].length<1||v[k].length>128||!v[k].every(id))))return false
 return v.areaTargetCell===undefined||closed(v.areaTargetCell,['col','row'])&&Number.isSafeInteger(v.areaTargetCell.col)&&Number.isSafeInteger(v.areaTargetCell.row)
}
function actionIntent(v){return closed(v,['id','mapId','combatId','sourceMode','status','type','actorTokenId','characterId','roomMemberId','targetTokenId','round','initiativeIndex','seq','updatedAt','dnd5eSpellCast'])&&['id','mapId','combatId','actorTokenId','characterId'].every(k=>id(v[k]))&&v.sourceMode==='dm'&&v.status==='pending'&&v.type==='dnd5e-spell-cast'&&integer(v.round)&&v.round>=1&&integer(v.initiativeIndex)&&integer(v.seq)&&integer(v.updatedAt)&&['roomMemberId','targetTokenId'].every(k=>v[k]===undefined||id(v[k]))&&spellIntent(v.dnd5eSpellCast)}
async function current(ctx,action,principal,api){
 if(principal?.role!=='dm'||!id(principal.memberId)||!actionIntent(action))return
 const d=await api.context(ctx),[geometry,clock,queue,processed,ack]=await Promise.all(['map-geometry','campaign-time','player-action-requests','player-action-processed','player-action-ack'].map(n=>api.doc(ctx,n))),combat=d.combat,map=d.maps?.maps?.find(m=>m.id===action.mapId),token=map?.tokens?.find(t=>t.id===action.actorTokenId&&t.type!=='obstacle'),character=d.characters?.characters?.find(c=>c.id===token?.characterId)
 if(!combat?.active||combat.flowPause||combat.mapId!==action.mapId||combat.combatId!==action.combatId||combat.round!==action.round||combat.initiativeIndex!==action.initiativeIndex||combat.initiativeOrder?.[combat.initiativeIndex]?.tokenId!==action.actorTokenId||!map||!token||!character||character.id!==action.characterId)return
 if(secondChanceCanonicalControllerMemberId(character,{roomId:ctx.roomId,hostMemberId:principal.memberId})!==principal.memberId||action.roomMemberId!==undefined&&action.roomMemberId!==principal.memberId)return
 if(queue?.requests?.some(r=>r.id===action.id)||processed?.actionIds?.includes(action.id)||ack?.actionId===action.id&&['accepted','rejected'].includes(ack.status))return
 const scope={versions:{characters:d.characters?._sync?.revision??0,maps:d.maps?._sync?.revision??0,'map-geometry':geometry?._sync?.revision??0},mapSignature:JSON.stringify(d.maps?.maps??[]),charactersSignature:JSON.stringify(d.characters?.characters??[]),geometrySignature:JSON.stringify(geometry??null),clockSignature:JSON.stringify(clock??null),combatSignature:JSON.stringify([combat.mapId,combat.combatId,combat.active,combat.round,combat.initiativeIndex,combat.initiativeOrder,combat.effectiveRules??null]),economySignature:JSON.stringify(combat.dnd5eTurnEconomyByToken??{}),queueSignature:JSON.stringify(queue??null)}
 return{scope,characterId:character.id}
}
export async function beginTempestuousHostOriginal(ctx,p,principal,api){
 if(!closed(p,['intent'])||!actionIntent(p.intent))return reject('tempestuous-host-original:closed-host-intent-required')
 const now=await current(ctx,p.intent,principal,api);if(!now)return reject('tempestuous-host-original:current-host-intent-required')
 const book={schemaVersion:1,sourceKind:'tempestuous-host-original-v1',roomId:ctx.roomId,hostMemberId:principal.memberId,parentId:p.intent.id,mapId:p.intent.mapId,combatId:p.intent.combatId,originalRoomAction:structuredClone(p.intent),characterId:now.characterId,scope:now.scope},prior=await api.load(ctx,key(p.intent.id))
 if(prior&&!equal(prior,book))return reject('tempestuous-host-original:immutable-intent-required')
 if(!prior)await api.save(ctx,key(p.intent.id),book)
 return{ok:true,...book}
}
export async function readTempestuousHostOriginal(ctx,p,principal,api){
 if(!identity(p)||principal?.role!=='dm'||!id(principal.memberId))return reject('tempestuous-host-original:host-identity-required')
 const book=await api.load(ctx,key(p.parentId));if(!book||book.schemaVersion!==1||book.sourceKind!=='tempestuous-host-original-v1'||book.roomId!==ctx.roomId||book.hostMemberId!==principal.memberId||book.parentId!==p.parentId||book.mapId!==p.mapId||book.combatId!==p.combatId||book.canceled)return reject('tempestuous-host-original:actual-private-host-intent-required')
 const now=await current(ctx,book.originalRoomAction,principal,api);if(!now||now.characterId!==book.characterId||!equal(now.scope,book.scope))return reject('tempestuous-host-original:current-private-host-intent-required')
 return{ok:true,...book}
}
export async function cancelTempestuousHostOriginal(ctx,p,principal,api){
 if(!identity(p)||principal?.role!=='dm'||!id(principal.memberId))return reject('tempestuous-host-original:host-identity-required')
 const book=await api.load(ctx,key(p.parentId));if(!book||book.schemaVersion!==1||book.sourceKind!=='tempestuous-host-original-v1'||book.roomId!==ctx.roomId||book.hostMemberId!==principal.memberId||book.parentId!==p.parentId||book.mapId!==p.mapId||book.combatId!==p.combatId)return reject('tempestuous-host-original:actual-private-host-intent-required')
 // Closing an issued input ledger cannot authorize anything. It remains
 // possible after the real original has changed the world through normal CAS.
 if(!book.canceled)await api.save(ctx,key(p.parentId),{...book,canceled:true});return{ok:true}
}
