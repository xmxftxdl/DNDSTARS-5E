import{bountifulOpportunitySequenceContinuationFacts,bountifulOpportunitySequenceSourceFacts,bountifulOpportunityCollectorContinuationFacts}from'./bountiful-opportunity-sequence.mjs'
import {bountifulHostPreparedWireSignature} from './bountiful-host-operation.mjs'
const record=v=>!!v&&typeof v==='object'&&!Array.isArray(v)
const keys=(v,allowed)=>record(v)&&Object.keys(v).every(key=>allowed.includes(key))
const text=v=>typeof v==='string'&&v.length>0&&v.length<=2000
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max
export const canonicalBountifulOpportunitySettlement=v=>Array.isArray(v)?v.map(canonicalBountifulOpportunitySettlement):record(v)?Object.fromEntries(Object.keys(v).sort().map(key=>[key,canonicalBountifulOpportunitySettlement(v[key])])):v
export function validBountifulOpportunitySettlementSpec(s){
 return keys(s,['parentId','roomId','mapId','combatId','hostMemberId','phase','ordinal','sourceDigest','opportunityActorId','postNativeWindowIndex','movementSegmentIndex','actorId','characterId','memberId','count','sides','rollKind','label','targetName'])&&[s.parentId,s.roomId,s.mapId,s.combatId,s.hostMemberId,s.actorId,s.memberId,s.label].every(text)&&(s.opportunityActorId===undefined||text(s.opportunityActorId))&&(s.postNativeWindowIndex===undefined||s.phase==='post-native'&&text(s.opportunityActorId)&&integer(s.postNativeWindowIndex,0,127))&&(s.phase!=='post-native'||s.opportunityActorId===undefined||integer(s.postNativeWindowIndex,0,127))&&(s.movementSegmentIndex===undefined||s.phase==='movement-hazards'&&s.opportunityActorId===undefined&&s.postNativeWindowIndex===undefined&&integer(s.movementSegmentIndex,0,128))&&(s.characterId===undefined||text(s.characterId))&&(s.targetName===undefined||text(s.targetName))&&['attack-late','post-native','movement-hazards'].includes(s.phase)&&integer(s.ordinal,0,255)&&typeof s.sourceDigest==='string'&&/^sha256:[a-f0-9]{64}$/.test(s.sourceDigest)&&integer(s.count,1,100)&&integer(s.sides,2,1000)&&['attack','saving-throw','ability-check','damage','other'].includes(s.rollKind)
}
export function validBountifulOpportunitySettlementRolls(rows,parent){
 if(!record(parent?.identity)||!Array.isArray(rows)||rows.length>512)return false
 return rows.every((row,index)=>{
  if(!keys(row,['requestId','spec','rawValues','values'])||!text(row.requestId)||!row.requestId.startsWith('bountiful-opportunity-settlement:')||!validBountifulOpportunitySettlementSpec(row.spec))return false
  const s=row.spec,i=parent.identity,faces=value=>Array.isArray(value)&&value.length===s.count&&value.every(face=>integer(face,1,s.sides))
  if(s.parentId!==i.parentId||s.roomId!==i.roomId||s.mapId!==i.mapId||s.combatId!==i.combatId||s.hostMemberId!==i.hostMemberId||!['opportunity-move','opportunity-move-sequence'].includes(parent.originalAdapterId)||i.occurrence!==0||parent.originalAdapterId==='opportunity-move-sequence'&&(s.phase!=='attack-late'||s.opportunityActorId===undefined&&s.rollKind!=='damage'))return false
  if(row.rawValues!==undefined&&!faces(row.rawValues)||row.values!==undefined&&(!faces(row.values)||!faces(row.rawValues))||parent.consumed&&row.values===undefined)return false
  const before=rows.slice(0,index)
  return s.ordinal===before.filter(prior=>prior.spec.phase===s.phase).length&&!before.some(prior=>prior.requestId===row.requestId)
 })
}
/** Closed actual OA collector fields. Prepared state, original d20s and pre-roll
 * choices are separate pinned facts; these late choices are revalidated by the
 * actual native facade before the sole ordinary ACK. */
export const bountifulOpportunitySequenceLateFields=Object.freeze(['halflingLuckyD20','halflingLuckyD20Second','blessRoll','baneRoll','bardicInspirationRoll','cuttingWords','cuttingWordsDamage','strokeOfLuck','postD20Adjustment','shieldSpellReaction','shieldSpellcastingSavingThrows','uncannyDodge','damageRolls','savageAttacksRoll','wholeWeaponDamageReroll','classDamageRolls','inventoryEffectRolls','hurlThroughHellDamageRolls','standAgainstTide','airborneFallDamageRollsByCombatantId','attackDecoyRolls'])
export function bountifulOpportunitySequenceOriginalAttack(attack){
 if(!record(attack)||Object.keys(attack).some(key=>!['d20','d20Second','coverAttackRedirect','tranquilitySave','areaAttackAdvantageReaction','disadvantageNegationChoice',...bountifulOpportunitySequenceLateFields].includes(key)))return null
 return Object.fromEntries(Object.entries(attack).filter(([key])=>!bountifulOpportunitySequenceLateFields.includes(key)))
}
/** Data-only source projection. It restores no Host capability or identity. */
export function bountifulOpportunitySettlementSource(wire,phase,actorId){try{
 const object=ref=>{const node=wire.nodes[ref?.ref];if(node?.kind!=='object')throw Error('object');return Object.fromEntries(node.entries)}
 const plain=(value,depth=0)=>{if(depth>100)throw Error('depth');if(value===undefined||value===null||['string','number','boolean'].includes(typeof value))return value;if(value?.undefined===true)return undefined;const node=wire.nodes[value?.ref];if(node?.kind==='array')return node.items.map(item=>plain(item,depth+1));if(node?.kind==='object')return Object.fromEntries(node.entries.map(([key,item])=>[key,plain(item,depth+1)]));throw Error('non-json-fact')}
 const source=object(wire.root),preparedSignature=bountifulHostPreparedWireSignature(wire)
 if(!preparedSignature||!['attack-late','post-native','movement-hazards'].includes(phase))return null
 if(source.hostOriginalOpportunityRolls!==undefined){const f=bountifulOpportunitySequenceContinuationFacts(wire),index=f?.rawBook?.findIndex(row=>row.actorId===actorId),row=index>=0?f.rawBook[index]:null,attack=row&&f.attacks?.[actorId];if(phase!=='attack-late'||!row||!attack||!Array.isArray(attack.damageRolls))return null;return{preparedSignature,opportunitySequence:{actorId,index,priorAttacks:f.rawBook.slice(0,index).map(row=>[row.actorId,f.attacks[row.actorId]]),original:{...attack,damageRolls:[]},raw:row}}}
 return {preparedSignature,opportunity:plain(source.opportunity),...(phase==='movement-hazards'?{movement:plain(source.movement)}:{})}
 }catch{return null}}

/** Stable current native collector scope, including before its original d20.
 * Only the registered prepared/window/preceding facts bind these real pools. */
export function bountifulOpportunityCollectorSettlementSource(wire,actorId){
 const f=bountifulOpportunitySequenceSourceFacts(wire),r=f?.pending,preparedSignature=bountifulHostPreparedWireSignature(wire)
 if(!preparedSignature||!f||!r||r.actorTokenId!==actorId||r.parentId!==f.action?.id||r.targetTokenId!==f.action?.actorTokenId||!Number.isSafeInteger(r.windowIndex)||r.windowIndex<0||!Array.isArray(f.preceding)||f.preceding.length!==r.windowIndex||Object.keys(r).some(key=>!['mandatory','coverAttackRedirect','parentId','windowIndex','actorTokenId','targetTokenId','rollMode','position','originalAction'].includes(key))||r.mandatory!==undefined&&r.mandatory!==true||!['normal','advantage','disadvantage'].includes(r.rollMode)||JSON.stringify(canonicalBountifulOpportunitySettlement(r.originalAction))!==JSON.stringify(canonicalBountifulOpportunitySettlement(f.action)))return null
 return{preparedSignature,opportunityCollector:{...(r.mandatory?{mandatory:true}:{}),parentId:r.parentId,windowIndex:r.windowIndex,actorId:r.actorTokenId,targetId:r.targetTokenId,position:r.position,preceding:f.preceding}}
}

/** Protected completed-window data only; this never issues a native/Base result. */
export function bountifulOpportunityPostNativeSettlementSource(wire,actorId,windowIndex){
 const f=bountifulOpportunityCollectorContinuationFacts(wire),preparedSignature=bountifulHostPreparedWireSignature(wire)
 if(!preparedSignature||!f||!text(actorId)||!integer(windowIndex,0,127)||!f.attacks[actorId]||f.attacks[actorId].reactionDecision==='decline'||Object.keys(f.attacks).length!==windowIndex+1)return null
 return{preparedSignature,opportunityPostNative:{actorId,windowIndex,transactionId:f.transactionId,attacks:f.attacks,rawBook:f.rawBook}}
}

/** A movement segment precedes its upcoming OA window. Only the original
 * prepared move and already-completed typed prefix are projected here. */
export function bountifulOpportunityMovementSegmentSettlementSource(wire,segmentIndex){const f=bountifulOpportunityCollectorContinuationFacts(wire),preparedSignature=bountifulHostPreparedWireSignature(wire);if(!preparedSignature||!f||!integer(segmentIndex,0,128)||Object.keys(f.attacks).length!==segmentIndex)return null;return{preparedSignature,opportunityMovementSegment:{segmentIndex,transactionId:f.transactionId,attacks:f.attacks,rawBook:f.rawBook}}}
