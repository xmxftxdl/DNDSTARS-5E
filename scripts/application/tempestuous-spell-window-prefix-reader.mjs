import{createHash}from'node:crypto'
import{readMastermindSpellWindowSource}from'../../shared/mastermind-spell-windows.mjs'
import{recordTempestuousBeforeOriginalPreparation,readTempestuousBeforeOriginalPreparation}from'./tempestuous-before-original-authority.mjs'
import{projectTempestuousBeforeOwnerChoice}from'../../shared/tempestuous-before-owner-choice.mjs'
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),id=v=>typeof v==='string'&&v.length>0&&v.length<=2000,reject=error=>({ok:false,status:403,error})
/** A current Host MM input parent permits only an optional private lookup.
 * Presence is not a Temp source, Native frame, owner answer, raw or World cap.
 * A present Temp book must independently pass its own unchanged source reader. */
export async function readTempestuousSpellWindowPrefix(ctx,p,principal,api){
 if(principal?.role!=='dm'||!id(principal.memberId)||!object(p)||Object.keys(p).length!==4||!['parentId','mapId','combatId','spellWindowParentId'].every(k=>id(p[k])))return reject('tempestuous-spell-window:closed-current-host-identity-required')
 const names=['maps','characters','combat','map-geometry','campaign-time','player-action-requests','mastermind-misdirections','player-action-processed','player-action-ack'],values=await Promise.all(names.map(name=>api.doc(ctx,name))),snapshot=Object.fromEntries(names.map((name,index)=>[name,values[index]])),ledger=await api.doc(ctx,'mastermind-spell-windows'),identity={roomId:ctx.roomId,memberId:principal.memberId,hostMemberId:principal.memberId,role:'dm'},source=readMastermindSpellWindowSource(ledger,snapshot,identity,p.spellWindowParentId,value=>createHash('sha256').update(value).digest('hex'))
 const parent=source.ok&&source.parent,original=parent?.original
 if(!parent||parent.source?.origin!=='native'||parent.hostMemberId!==principal.memberId||original?.action?.id!==p.parentId||original.mapId!==p.mapId||original.combatId!==p.combatId)return reject('tempestuous-spell-window:actual-current-native-parent-required')
 const book=await api.load(ctx,'tempestuous-before-preparation:'+p.parentId)
 if(book==null)return{ok:true,present:false,parentId:p.parentId,mapId:p.mapId,combatId:p.combatId,spellWindowParentId:parent.id,effectTimestamp:parent.issuedAt}
 const current=await readTempestuousBeforeOriginalPreparation(ctx,{parentId:p.parentId,mapId:p.mapId,combatId:p.combatId},principal,api)
 if(!current.ok)return current
 if(current.effectTimestamp!==parent.issuedAt||current.originalRoomAction?.sourceMode!=='dm'||current.originalRoomAction?.actorTokenId!==original.actorTokenId||current.characterId!==original.actorCharacterId)return reject('tempestuous-spell-window:same-original-native-clock-required')
 // Rerun the existing factual producer checks over this actual private row.
 // Its save port is sealed shut, so a read can never create or refresh a book.
 const validated=await recordTempestuousBeforeOriginalPreparation(ctx,{sourceKind:current.sourceKind,phase:'prepare',parentId:current.parentId,mapId:current.mapId,combatId:current.combatId,source:current.source,preparation:current.preparation,frame:current.frame,prefixSignature:current.prefixSignature,effectTimestamp:current.effectTimestamp},principal,{...api,save:async()=>{throw Error('tempestuous-spell-window:read-only-private-observation')}})
 if(!validated.ok)return validated
 if(current.ownerDecision){
  if(!Array.isArray(current.ownerDecision.interruptIds)||current.ownerDecision.interruptIds.length>192)return reject('tempestuous-spell-window:actual-owner-prefix-required')
  const queue=await api.doc(ctx,'combat-interrupts'),answers=Object.fromEntries(await Promise.all(current.ownerDecision.interruptIds.map(async id=>[id,await api.load(ctx,'tempestuous-before-answer:'+p.parentId+':'+id)]))),projected=projectTempestuousBeforeOwnerChoice(current,queue,answers)
  if(!projected.ok||!api.equal(projected.decision,current.ownerDecision.decision)||!api.equal(projected.interruptIds,current.ownerDecision.interruptIds))return reject('tempestuous-spell-window:actual-owner-prefix-required')
 }
 return{ok:true,present:true,parentId:p.parentId,mapId:p.mapId,combatId:p.combatId,spellWindowParentId:parent.id,effectTimestamp:parent.issuedAt,book:current}
}
