// This stores a Host-confirmed Native resolution for transport recovery only.
// It grants no publication authority; the existing delta merge and transaction
// still validate and commit the world state.
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)
const clone=v=>JSON.parse(JSON.stringify(v))
const stable=v=>JSON.stringify(v,(_key,value)=>object(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])):value)
const denied=(error,status=409)=>({ok:false,changed:false,status,error:'effect-end-receipt:'+error})
const ids=rows=>Array.isArray(rows)&&rows.every(row=>object(row)&&typeof row.id==='string'&&row.id)&&new Set(rows.map(row=>row.id)).size===rows.length
const state=v=>object(v)&&ids(v.maps)&&ids(v.characters)
function pending(snapshot,mapId){
 const map=snapshot.maps.find(row=>row.id===mapId)
 if(!map||!ids(map.tokens))return null
 const rows=[]
 for(const token of map.tokens){
  const owner=token.characterId?snapshot.characters.find(row=>row.id===token.characterId):undefined
  const effects=(owner?.dnd5eCombatState??token.dnd5eCombatState)?.activeEffects??[]
  if(!Array.isArray(effects))return null
  for(const effect of effects)if(effect?.pendingEndSavingThrow){
   if(typeof effect.id!=='string'||!effect.id)return null
   rows.push({tokenId:token.id,characterId:owner?.id??null,effect})
  }
 }
 return rows.sort((a,b)=>stable(a).localeCompare(stable(b)))
}
const generation=snapshot=>({combatId:snapshot.combat?.combatId??null,effectiveRules:snapshot.combat?.effectiveRules??null})
function host(identity){return identity?.roomId&&identity.role==='dm'&&identity.memberId&&identity.hostMemberId===identity.memberId}
/** All snapshots and identity here are read by the server under its world lock. */
export function mutateEffectEndConfirmedReceipt(current,snapshot,identity,operation,input,now){
 if(!host(identity))return denied('actual-host-required',403)
 if(!['read','record'].includes(operation)||!object(input)||typeof input.mapId!=='string'||!input.mapId)return denied('identity-required',400)
 if(!state(snapshot))return denied('canonical-world-required')
 if(current!==null&&(!object(current)||current.schemaVersion!==1||current.roomId!==identity.roomId||!object(current.maps)))return denied('invalid-private-book')
 const rows=pending(snapshot,input.mapId)
 if(rows===null)return denied('actual-map-required')
 const contextKey=stable({generation:generation(snapshot),pending:rows})
 const revision=snapshot.combat?._sync?.revision
 const combatRevision=Number.isSafeInteger(revision)&&revision>=0?revision:0
 const original=current?.maps[input.mapId]
 const valid=original&&original.hostMemberId===identity.memberId&&original.roomId===identity.roomId&&
  original.mapId===input.mapId&&stable(original.generation)===stable(generation(snapshot))&&rows.length>0&&stable(original.pending)===stable(rows)
 if(operation==='read')return {ok:true,changed:false,next:current,receipt:valid?clone(original.receipt):null,contextKey,combatRevision,hasPending:rows.length>0}
 if(input.contextKey!==contextKey)return denied('context-changed-before-confirmation')
 if(!rows.length)return denied('actual-pending-effect-required')
 const receipt=input.receipt
 if(!object(receipt)||!state(receipt.before)||!state(receipt.after))return denied('native-resolution-required',400)
 if(valid){
  if(stable(original.receipt)!==stable(receipt))return denied('already-confirmed-different-result')
  return {ok:true,changed:false,next:current,receipt:clone(original.receipt),contextKey,combatRevision,hasPending:true}
 }
 if(stable(receipt.before)!==stable({maps:snapshot.maps,characters:snapshot.characters}))return denied('canonical-before-changed')
 if(stable(receipt.before.maps.map(row=>row.id))!==stable(receipt.after.maps.map(row=>row.id))||
    stable(receipt.before.characters.map(row=>row.id))!==stable(receipt.after.characters.map(row=>row.id)))return denied('actor-identities-changed')
 const remaining=pending(receipt.after,input.mapId)
 if(remaining===null||remaining.length)return denied('unconfirmed-ending-resolution')
 const entry={roomId:identity.roomId,mapId:input.mapId,hostMemberId:identity.memberId,generation:generation(snapshot),pending:rows,receipt,confirmedAt:now}
 const next={schemaVersion:1,roomId:identity.roomId,maps:{...(current?.maps??{}),[input.mapId]:clone(entry)},updatedAt:now}
 return {ok:true,changed:true,next,receipt:clone(receipt),contextKey,combatRevision,hasPending:true}
}
