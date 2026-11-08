import{readSpellcastingOriginalSaving}from'./spellcasting-original-saving-authority.mjs'
import{authenticatedBountifulSpellcastingOriginal,authenticatedBountifulSpellcastingOwnPrefix}from'./bountiful-spellcasting-original-authority.mjs'
import{validateBountifulOriginalParents,bountifulOriginalRowReady,bountifulNativeLuckyDeclined}from'../../shared/bountiful-luck-state.mjs'
import{spellTargetOriginalPreparationFacts,validSpellTargetOriginalRequirement,sameSpellTargetOriginalData as same}from'../../shared/spell-target-original-preparation.mjs'
import{bountifulDamageZeroQualifiedWire}from'../../shared/bountiful-damage-zero-original.mjs'
const data=value=>!!value&&typeof value==='object'&&!Array.isArray(value),closed=(value,keys)=>data(value)&&Object.keys(value).every(key=>keys.includes(key)),identity=value=>['parentId','mapId','combatId','effectId','targetId'].every(key=>typeof value?.[key]==='string'&&value[key].length>0&&value[key].length<=2000),key=p=>'spell-target-original-preparation:'+JSON.stringify([p.parentId,p.effectId,p.targetId]),reject=error=>({ok:false,status:403,error})
async function current(ctx,p,principal,api){
 if(principal.role!=='dm'||!principal.memberId||!identity(p))return null
 const caster=await readSpellcastingOriginalSaving(ctx,{parentId:p.parentId,mapId:p.mapId,combatId:p.combatId,effectId:p.effectId},principal,api),d=await api.context(ctx)
 if(!caster.ok||caster.hostMemberId!==principal.memberId||!validateBountifulOriginalParents(d.combat?.bountifulOriginalParents))return null
 const rows=Object.values(d.combat.bountifulOriginalParents).filter(row=>row.identity.parentId===p.parentId).sort((a,b)=>a.identity.occurrence-b.identity.occurrence),first=rows[0]
 if(!first||rows.length!==1&&rows.length!==2||rows.some((row,index)=>row.consumed||row.identity.occurrence!==index||row.identity.roomId!==ctx.roomId||row.identity.hostMemberId!==principal.memberId||row.identity.mapId!==p.mapId||row.identity.combatId!==p.combatId||row.identity.effectTimestamp!==caster.effectTimestamp||row.continuation||row.postOriginalD20?.length||row.postOriginalEquipmentD20!==undefined||!bountifulOriginalRowReady(row))||first.originalAdapterId!=='spell'||first.rawIssuer?.rollId!==caster.requestId||!await (rows.length===1?authenticatedBountifulSpellcastingOriginal(ctx,first,principal,api):authenticatedBountifulSpellcastingOwnPrefix(ctx,rows,principal,api)))return null
 const original=bountifulDamageZeroQualifiedWire(first.originalParent),clock=original?.replay;if(!clock||clock.parentId!==p.parentId||clock.effectTimestamp!==caster.effectTimestamp||!Array.isArray(clock.facts)||clock.facts.length)return null
 const facts=rows.map((row,occurrence)=>{let decision;const used=row.request.nativeLucky?row.request.options[0]:row.ownerDecisions.find(choice=>choice.decision==='use');if(used&&!bountifulNativeLuckyDeclined(row)){if(!row.hostReroll)throw Error('spell-target-preparation:unfinished-authenticated-prefix');decision={ownerId:used.ownerId,featureId:used.featureId,replacement:row.hostReroll.value}}return{occurrence,request:row.request,decision}})
 return{caster,first,base:original.base,replay:{parentId:clock.parentId,sourceKey:clock.sourceKey,facts,effectTimestamp:clock.effectTimestamp},prefixSignature:JSON.stringify(rows),d}
}
/** Only the current private first caster book, actual authenticated B decisions
 * and the same frozen native Spell graph can open this sibling preparation.
 * It still issues no physical die or normal world publication. */
export async function recordSpellTargetOriginalPreparation(ctx,p,principal,api){
 if(!closed(p,['sourceKind','phase','parentId','mapId','combatId','effectId','targetId','source','requirement','prefixSignature','effectTimestamp'])||p.sourceKind!=='spell-target-original-preparation-v1'||p.phase!=='prepare'||!identity(p)||!validSpellTargetOriginalRequirement(p.requirement)||p.requirement.targetId!==p.targetId||typeof p.prefixSignature!=='string'||!p.prefixSignature)return reject('spell-target-preparation:actual-shape-required')
 const now=await current(ctx,p,principal,api),facts=spellTargetOriginalPreparationFacts(p.source,p.requirement)
 if(!now||!facts||p.effectTimestamp!==now.caster.effectTimestamp||p.requirement.actorId!==now.caster.rollerTokenId||!api.equal(facts.base,now.base)||!same(facts.replay,now.replay)||!api.equal(facts.action,now.first.originalRoomAction))return reject('spell-target-preparation:exact-current-caster-prefix-required')
 const controlled=api.controller(now.d,p.mapId,p.targetId,ctx.roomId);if(!controlled||controlled.character.id!==facts.targetToken.characterId)return reject('spell-target-preparation:canonical-target-controller-required')
 const book={schemaVersion:1,sourceKind:p.sourceKind,roomId:ctx.roomId,hostMemberId:principal.memberId,parentId:p.parentId,mapId:p.mapId,combatId:p.combatId,effectId:p.effectId,targetId:p.targetId,source:p.source,requirement:p.requirement,prefixSignature:p.prefixSignature,effectTimestamp:p.effectTimestamp,memberId:controlled.character.roomMemberId??principal.memberId,characterId:controlled.character.id,casterSignature:JSON.stringify(now.caster),authenticatedPrefixSignature:now.prefixSignature},prior=await api.load(ctx,key(p));if(prior&&!api.equal(prior,book))return reject('spell-target-preparation:immutable-private-source-required');if(!prior)await api.save(ctx,key(p),book);return{ok:true}
}
export async function readSpellTargetOriginalPreparation(ctx,p,principal,api){
 if(!closed(p,['parentId','mapId','combatId','effectId','targetId'])||!identity(p))return reject('spell-target-preparation:identity-only-required')
 const now=await current(ctx,p,principal,api),book=await api.load(ctx,key(p)),controlled=now&&book&&api.controller(now.d,p.mapId,p.targetId,ctx.roomId)
 if(!now||!book||book.roomId!==ctx.roomId||book.hostMemberId!==principal.memberId||book.casterSignature!==JSON.stringify(now.caster)||book.authenticatedPrefixSignature!==now.prefixSignature||book.effectTimestamp!==now.caster.effectTimestamp||!controlled||controlled.character.id!==book.characterId||(controlled.character.roomMemberId??principal.memberId)!==book.memberId)return reject('spell-target-preparation:current-private-source-required')
 return{ok:true,...book}
}
