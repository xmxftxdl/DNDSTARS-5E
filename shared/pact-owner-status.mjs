import{createHash}from'node:crypto'
/** Caller has already checked actual room ownership. Never expose private receipts,
 * stored inventory identities or the full ritual document to a player. */
export function projectPactWeaponOwnerStatus(character){
 const authority=character?.dnd5ePactWeaponAuthority,state=authority?.state,doc=character?.dnd5ePactWeaponRitualAuthority
 if(authority?.schemaVersion!==1||state?.ownerId!==character.id||!Number.isSafeInteger(state.revision)||state.revision<0)return undefined
 const binding=state.binding
 if(binding&&(!['present','dismissed'].includes(binding.status)||!['summoned','ritually-bound-magic'].includes(binding.origin)))return undefined
 const active=doc?.ownerId===character.id&&doc?.sessions?.find(row=>row.id===state.ritual?.ritualId&&row.phase==='active')
 const reviewed=(character.dnd5eInventory?.entries??[]).filter(entry=>entry.item?.magicItem&&entry.item.magicItem.rarity!=='artifact'&&doc?.facts?.some(fact=>fact.instanceId===entry.instanceId&&fact.sentient===false&&fact.itemSha===createHash('sha256').update(JSON.stringify(entry.item)).digest('hex'))).map(entry=>entry.instanceId)
 // Owner UI hints expose equipped slots only. They do not expose private
 // receipts/instance identities and cannot authorize an attack on the Host.
 const summonedWeaponSlots=[]
 if(binding?.status==='present'&&authority.inventory?.schemaVersion===1&&authority.inventory.ownerId===character.id&&
   authority.summons?.some(row=>row.inventoryInstanceId===binding.inventoryInstanceId&&Number.isSafeInteger(row.pactRevision)&&row.pactRevision>0&&row.pactRevision<=state.revision)){
  for(const slot of['mainWeapon','offHand']){
   const weapon=character.equipment?.[slot],entries=(character.dnd5eInventory?.entries??[]).filter(entry=>entry.equippedSlot===slot&&entry.quantity===1&&!entry.condition?.destroyed&&entry.item?.equipment?.id===weapon?.id)
   if(weapon&&entries.length===1&&entries[0].instanceId===binding.inventoryInstanceId)summonedWeaponSlots.push(slot)
  }
 }
 return{revision:state.revision,status:binding?.status??'unbound',...(binding?{origin:binding.origin}:{}),...(summonedWeaponSlots.length?{summonedWeaponSlots}:{}),...(active&&Number.isSafeInteger(active.startedSecond)?{ritual:{kind:active.kind,startedSecond:active.startedSecond}}:{}),...(reviewed.length?{reviewedMagicInstances:reviewed}:{})}
}
