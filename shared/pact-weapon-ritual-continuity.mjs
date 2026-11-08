import {createHash} from 'node:crypto'
export const PACT_RITUAL_FIELD='dnd5ePactWeaponRitualAuthority'
export const pactRitualItemSha=entry=>createHash('sha256').update(JSON.stringify(entry.item)).digest('hex')
export function pactRitualHeld(characters,ownerId,instanceId,itemSha){
 const found=characters.flatMap(actor=>(actor.dnd5eInventory?.entries??[]).filter(entry=>entry.instanceId===instanceId).map(entry=>({actor,entry})))
 if(found.length!==1)return false
 const{actor,entry}=found[0],slot=entry.equippedSlot
 return actor.id===ownerId&&entry.quantity===1&&!entry.containerInstanceId&&!entry.condition?.destroyed&&
  ['mainWeapon','offHand'].includes(slot)&&actor.equipment?.[slot]?.id===entry.item?.equipment?.id&&
  entry.item?.equipment?.dnd5e?.kind==='weapon'&&pactRitualItemSha(entry)===itemSha
}
/** Called by BOTH real server character persistence paths while their existing
 * lock/journal is held. It observes every committed equipment/inventory change;
 * a later pickup or old complete character upload cannot erase an interruption.
 * No spell concentration or per-turn casting requirement is introduced. */
export function observePactWeaponRituals(before,after,nextRevision){
 if(!Array.isArray(after?.characters))return after
 return {...after,characters:after.characters.map(actor=>{
  const previous=before?.characters?.find(row=>row.id===actor.id),old=previous?.[PACT_RITUAL_FIELD];let incoming=actor[PACT_RITUAL_FIELD]
  if(!old&&!incoming)return actor
  const oldPact=previous?.dnd5ePactWeaponAuthority
  if(old&&oldPact&&(!actor.dnd5ePactWeaponAuthority||actor.dnd5ePactWeaponAuthority.state?.revision<oldPact.state.revision))actor={...actor,dnd5ePactWeaponAuthority:structuredClone(oldPact)}
  if(!incoming||incoming.schemaVersion!==1||incoming.ownerId!==actor.id||!Array.isArray(incoming.sessions)){
   if(old)incoming=structuredClone(old)
   else throw Error('pact-ritual:invalid-authority-record')
  }
  const sessions=incoming.sessions.map(session=>{
   const prior=old?.sessions?.find(row=>row.id===session.id)
   if(prior?.phase==='interrupted'||prior?.phase==='completed')return structuredClone(prior)
   if(prior?.phase==='active'&&prior.observedCharacterRevision!==before?._sync?.revision)throw Error('pact-ritual:continuity-history-gap')
   const live=prior??session
   let reason=live.interruptedReason
   if(live.phase==='active'){
    const conditions=[...(actor.conditions??[]),...(actor.dnd5eCombatState?.activeEffects??[]).filter(effect=>!effect.suspendedBy?.length).flatMap(effect=>[effect.standardCondition,effect.legacyCondition])]
    if(actor.currentHp<=0||conditions.some(value=>['incapacitated','unconscious','paralyzed','petrified','stunned','昏迷','失能','麻痹','石化','震慑'].includes(value)))reason??='owner-unavailable'
    if(live.kind==='binding'&&!pactRitualHeld(after.characters,actor.id,live.instanceId,live.itemSha))reason??='physical-holding-interrupted'
   }
   if(reason)return{...live,phase:'interrupted',interruptedReason:reason,observedCharacterRevision:nextRevision}
   // A trusted DM completion may close the session only after the Host planner
   // has removed the matching FSM ritual in the same character transaction.
   const completed=prior&&session.phase==='completed'&&actor.dnd5ePactWeaponAuthority?.state?.ritual?.ritualId!==live.id
   return{...live,...(completed?{phase:'completed'}:{}),observedCharacterRevision:nextRevision}
  })
  for(const prior of old?.sessions??[])if(!sessions.some(row=>row.id===prior.id))sessions.push({...structuredClone(prior),...(prior.phase==='active'?{phase:'interrupted',interruptedReason:'history-removed',observedCharacterRevision:nextRevision}:{})})
  let next={...actor,[PACT_RITUAL_FIELD]:{...incoming,sessions}}
  const ritual=next.dnd5ePactWeaponAuthority?.state?.ritual
  if(ritual&&sessions.some(row=>row.id===ritual.ritualId&&row.phase==='interrupted')){
   const authority=next.dnd5ePactWeaponAuthority,state={...authority.state};delete state.ritual
   state.revision=Math.max(state.revision,previous?.dnd5ePactWeaponAuthority?.state?.revision??0)+Number(!old?.sessions?.some(row=>row.id===ritual.ritualId&&row.phase==='interrupted'))
   next={...next,dnd5ePactWeaponAuthority:{...authority,state}}
  }
  return next
 })}
}
