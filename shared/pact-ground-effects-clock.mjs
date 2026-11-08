import {createHash}from'node:crypto'
const key=(instance,token,effect)=>createHash('sha256').update(JSON.stringify([instance,token,effect.id,effect.source?.executionId??null,effect.source?.rulesId??null,effect.duration.type])).digest('hex')
const effectsOf=actor=>actor?.dnd5eCombatState?.activeEffects??[]
const instanceOf=token=>token?.dnd5eObjectState?.inventoryItem?.instance
const bindingOf=effect=>effect.modifiers?.weaponEnchantment?.inventoryInstanceId??effect.modifiers?.armorEnchantment?.inventoryInstanceId
const seconds=clock=>clock.worldMinute*60+(clock.worldSecondRemainder??0)
function sourceLive(effect,characters,map){
 if(effect.duration.type!=='concentration')return true
 const token=map.tokens?.find(t=>t.id===effect.duration.sourceActorId),character=characters.find(c=>c.id===(effect.source.characterId??token?.characterId??effect.duration.sourceActorId)),state=character?.dnd5eCombatState??token?.dnd5eCombatState
 return (!character||character.concentrating===true)&&state?.concentrationSpellId===(effect.duration.concentrationId??effect.source.rulesId)&&(!effect.source.executionId||effectsOf(character??token).some(e=>e.source.executionId===effect.source.executionId&&e.source.rulesId===effect.source.rulesId&&e.duration.type==='concentration'))
}
function issued(entry,before){
 const marker=entry?.pactWeaponPhysicalIdentity
 if(marker?.schemaVersion!==1||marker.inventoryInstanceId!==entry.instanceId||marker.equipmentId!==entry.item?.equipment?.id)return false
 const same=row=>row.instanceId===entry.instanceId&&row.item?.equipment?.id===marker.equipmentId&&row.pactWeaponPhysicalIdentity?.equipmentId===marker.equipmentId
 return before.some(actor=>(actor.dnd5eInventory?.entries??[]).some(same)||(actor.dnd5ePactWeaponAuthority?.inventory?.stowed??[]).some(same))
}
/** Server-owned watermark/tombstones. Incoming records are always ignored. No effect snapshots are cached. */
export function observePactGroundEffects(previous,next,{clock=null,clockRevision=null,charactersBefore=[],charactersAfter=charactersBefore,allowIssue=false}={}){
 const previousMaps=previous?.maps??[]
 return {...next,maps:(next?.maps??[]).map(map=>{
  const old=previousMaps.find(row=>row.id===map.id),records=structuredClone(old?.dnd5ePactGroundEffectClocks??[]),now=clock?seconds(clock):null
  if(!records.length&&!map.tokens?.some(token=>instanceOf(token)?.pactWeaponPhysicalIdentity&&token.dnd5eObjectState?.inventoryItem?.boundEffects?.some(effect=>effect.duration.type!=='permanent')))return map.dnd5ePactGroundEffectClocks?{...map,dnd5ePactGroundEffectClocks:undefined}:map
  if(now!=null&&(!Number.isSafeInteger(now)||now<0||!Number.isSafeInteger(clockRevision)||clockRevision<0))throw Error('pact-ground:invalid-clock')
  for(const record of records){
   if(now!=null&&(now<record.second||clockRevision<record.clockRevision))throw Error('pact-ground:clock-regressed')
   if(!map.tokens?.some(token=>token.id===record.tokenId&&instanceOf(token)?.instanceId===record.instanceId)){record.expired=true;record.remainingRounds=0}
  }
  const tokens=(map.tokens??[]).map(token=>{
   const item=token.dnd5eObjectState?.inventoryItem,entry=item?.instance
   if(!entry||!item.boundEffects?.length)return token
   const oldToken=old?.tokens?.find(row=>row.id===token.id&&instanceOf(row)?.instanceId===entry.instanceId)
   const boundEffects=item.boundEffects.flatMap(effect=>{
    if(bindingOf(effect)!==entry.instanceId||effect.duration.type==='permanent')return[effect]
    const effectKey=key(entry.instanceId,token.id,effect);let record=records.find(row=>row.effectKey===effectKey)
    const sourceEffect=charactersBefore.flatMap(effectsOf).find(e=>e.id===effect.id&&bindingOf(e)===entry.instanceId&&JSON.stringify(e.source)===JSON.stringify(effect.source)&&JSON.stringify(e.modifiers)===JSON.stringify(effect.modifiers)&&e.duration.type===effect.duration.type)
    if(!record&&allowIssue&&now!=null&&!oldToken&&issued(entry,charactersBefore)&&sourceEffect){
     if(records.length>=10000)throw Error('pact-ground:clock-capacity')
     record={effectKey,instanceId:entry.instanceId,tokenId:token.id,effectId:effect.id,second:now,observedSecond:now,clockRevision,remainingRounds:Math.min(effect.duration.remainingRounds??Infinity,sourceEffect.duration.remainingRounds??Infinity)===Infinity?null:Math.min(effect.duration.remainingRounds??Infinity,sourceEffect.duration.remainingRounds??Infinity),expired:false};records.push(record)
    }
    if(!record)return[effect] // Legacy ground facts get no invented start time; Host must reject these later.
    if(record.expired)return[]
    if(clock&&!sourceLive(effect,charactersAfter,map)){record.expired=true;record.remainingRounds=0;return[]}
    const oldEffect=oldToken?.dnd5eObjectState?.inventoryItem?.boundEffects?.find(e=>key(entry.instanceId,token.id,e)===effectKey)
    let remaining=Math.min(effect.duration.remainingRounds??Infinity,oldEffect?.duration.remainingRounds??Infinity,record.remainingRounds??Infinity)
    if(now!=null){const elapsed=(Math.floor(now/60)-Math.floor(record.second/60))*10;if(effect.duration.type==='until-turn-boundary'&&elapsed>0){record.expired=true;record.remainingRounds=0;return[]}if(Number.isFinite(remaining))remaining-=elapsed;record.second=now;record.observedSecond=now;record.clockRevision=clockRevision}
    if(remaining<=0){record.expired=true;record.remainingRounds=0;return[]}
    record.remainingRounds=Number.isFinite(remaining)?remaining:null
    return[{...effect,duration:{...effect.duration,...(Number.isFinite(remaining)?{remainingRounds:remaining}:{})}}]
   })
   return{...token,dnd5eObjectState:{...token.dnd5eObjectState,inventoryItem:{...item,boundEffects}}}
  })
  return{...map,tokens,dnd5ePactGroundEffectClocks:records.length?records:undefined}
 })}
}
