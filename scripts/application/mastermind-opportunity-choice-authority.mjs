import{validMastermindMisdirections}from'../../shared/mastermind-misdirections.mjs'
import{secondChanceCanonicalControllerMemberId}from'../../shared/second-chance-controller.mjs'
/** Private collector witness only. No native result, state or world write is issued here. */
export async function authenticateMastermindOpportunityChoice(ctx,{d,parent,book,windowIndex,actorId,use},ports){
 if(use!==undefined&&(!use||typeof use!=='object'||Array.isArray(use)||Object.keys(use).length!==3||Object.keys(use).some(key=>!['featureId','originalTargetId','replacementTargetId'].includes(key))||!Object.values(use).every(value=>typeof value==='string'&&value.length>0&&value.length<=2000)))return null
 const{doc,equal,digest}=ports,window=book?.collectorWindows?.[windowIndex],journal=await doc(ctx,'mastermind-misdirections')
 if(!window||window.actorId!==actorId||window.windowIndex!==windowIndex)return null
 if(journal!=null&&!validMastermindMisdirections(journal))return null
 const rows=Object.values(journal?.parents??{}).filter(row=>row.parentTransactionId===parent.id&&row.mapId===parent.mapId&&row.attackerTokenId===actorId&&row.ownerTokenId===parent.actorTokenId&&row.opportunityOriginal?.family==='opportunity-sequence'&&row.opportunityOriginal?.windowIndex===windowIndex)
 if(!rows.length)return use===undefined&&!window.misdirectionWitness?{ok:true}:null
 if(rows.length!==1)return null
 const row=rows[0],owner=d.characters?.characters?.find(c=>c.id===parent.characterId),member=secondChanceCanonicalControllerMemberId(owner,{roomId:ctx.roomId,hostMemberId:book.hostMemberId})
 if(row.roomId!==ctx.roomId||row.hostMemberId!==book.hostMemberId||row.ownerCharacterId!==parent.characterId||row.ownerMemberId!==member||row.phase!=='answered'||!row.answer||row.answer.submittedByMemberId!==member||!equal(row.originalAction,parent))return null
 const expected=row.answer.choice==='decline'?undefined:{featureId:row.featureId,originalTargetId:row.ownerTokenId,replacementTargetId:row.answer.choice},witness={id:row.id,rowSignature:digest(row),...(expected?{use:expected}:{})}
 if(!equal(use,expected)||window.misdirectionWitness&&!equal(window.misdirectionWitness,witness))return null
 if(!window.misdirectionWitness){for(const[name,value]of Object.entries({characters:d.characters,maps:d.maps,combat:d.combat,'map-geometry':await doc(ctx,'map-geometry'),'campaign-time':await doc(ctx,'campaign-time')}))if(row.versions[name]!==value?._sync?.revision&&!(value==null&&row.versions[name]===0))return null}
 return{ok:true,witness}
}
