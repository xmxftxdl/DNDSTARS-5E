import*as bounty from'./bountiful-luck-state.mjs'
import{bountifulDamageZeroQualifiedWire}from'./bountiful-damage-zero-original.mjs'
const data=v=>!!v&&typeof v==='object'&&!Array.isArray(v),closed=(v,keys)=>data(v)&&Object.keys(v).every(k=>keys.includes(k)),canonical=v=>Array.isArray(v)?v.map(canonical):data(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v,equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b)),rev=d=>d?._sync?.revision??0
/** Pure comparison of an actual current stored prefix, never a receipt issuer,
 * Native capability, controller answer, die or publication permission. */
export function validStormFuryMoveBountyReplay(move,action,parents,scope,identity){try{
 const stored=parents??{};if(!bounty.validateBountifulOriginalParents(stored))return false
 const rows=Object.values(stored).filter(row=>row.identity.parentId===identity.parentId).sort((a,b)=>a.identity.occurrence-b.identity.occurrence)
 if(!move.hasOriginalReplay)return rows.length===0
 const replay=move.originalReplay;if(!closed(replay,['parentId','sourceKey','effectTimestamp','facts','readyFrames','equipmentD20','deferredD20Choices','afterOriginalFalls'])||!rows.length||replay.parentId!==identity.parentId||replay.effectTimestamp!==move.firstHostNow||!Array.isArray(replay.facts))return false
 const sourceKey=JSON.stringify([identity.parentId,move.state,action,move.firstHostNow]);if(replay.sourceKey!==sourceKey)return false
 const complete=[];for(const row of rows){const used=row.ownerDecisions.find(choice=>choice.decision==='use');let done,decision
  if(row.request.nativeLucky){if(typeof bounty.bountifulOriginalRowReady!=='function'||typeof bounty.bountifulNativeLuckyDeclined!=='function')return false;done=bounty.bountifulOriginalRowReady(row);if(done&&!bounty.bountifulNativeLuckyDeclined(row)){if(!row.hostReroll)return false;decision={ownerId:row.request.options[0].ownerId,featureId:row.request.options[0].featureId,replacement:row.hostReroll.value}}}
  else{done=used?!!row.rawReroll&&!!row.hostReroll:row.ownerDecisions.length===row.request.options.length;if(done&&used)decision={ownerId:used.ownerId,featureId:used.featureId,replacement:row.hostReroll.value}}
  if(!done)break
  complete.push({row,decision})
 }
 if(!complete.length||complete.length!==replay.facts.length)return false
 for(let i=0;i<complete.length;i++){const{row,decision}=complete[i],id=row.identity;if(id.occurrence!==i||id.roomId!==identity.roomId||id.mapId!==identity.mapId||id.combatId!==identity.combatId||id.hostMemberId!==identity.hostMemberId||id.round!==identity.round||id.initiativeIndex!==identity.initiativeIndex||id.effectTimestamp!==move.firstHostNow||row.consumed||row.originalAdapterId!=='opportunity-move-sequence'||!equal(row.originalRoomAction,action)||!['attack','saving-throw'].includes(row.request.kind)||!move.state.combatants[row.request.actorId]||Object.entries(id.revisions).some(([name,value])=>value!==rev(name==='characters'?scope.characters:name==='maps'?scope.maps:name==='map-geometry'?scope.geometry:name==='campaign-time'?scope.clock:null))||!equal(replay.facts[i],{occurrence:i,request:row.request,decision}))return false
 }
 const first=complete[0].row,original=bountifulDamageZeroQualifiedWire(first.continuation?.source??first.originalParent);if(!original||original.records!==undefined)return false
 const binding=original.replay;if(binding&&(binding.parentId!==identity.parentId||binding.sourceKey!==sourceKey||binding.effectTimestamp!==move.firstHostNow))return false
 const expected={...(binding?.readyFrames===undefined?{}:{readyFrames:binding.readyFrames}),...(first.postOriginalEquipmentD20===undefined?{}:{equipmentD20:first.postOriginalEquipmentD20}),...(first.postOriginalD20===undefined?{}:{deferredD20Choices:first.postOriginalD20}),parentId:identity.parentId,sourceKey,facts:complete.map(({row,decision},occurrence)=>({occurrence,request:row.request,decision})),effectTimestamp:move.firstHostNow,...(first.continuation?.afterOriginalFalls===undefined?{}:{afterOriginalFalls:first.continuation.afterOriginalFalls})}
 return equal(replay,expected)
 }catch{return false}}
