import type {Dnd5eHeadlessCombatState} from './headlessCombatEngine'
import {dnd5eActiveMovementBoundarySaves,effectiveDnd5eActiveEffects} from './activeEffects'
import {dnd5eTempleEntryRequirements} from './templeEntry'
import {dnd5eSavingThrowMode} from './passiveDefenses'
import type {PreparedDnd5eOpeningAttackSavingThrow} from './spellAction'

/** Preview the same boundary checks used by the native move resolver, using
 * the current transaction rather than rebuilding a room snapshot. */
export function prepareDnd5eHitFollowSegmentSavingThrows(input:{
 state:Dnd5eHeadlessCombatState;actorId:string;to:{x:number;y:number;elevationFeet?:number}
}):{effectId:string;requirement:PreparedDnd5eOpeningAttackSavingThrow}[]{
 const actor=input.state.combatants[input.actorId]
 if(!actor)throw Error('follow-actor-missing')
 const temple=dnd5eTempleEntryRequirements(input.state,actor,input.to,input.to.elevationFeet??actor.elevationFeet)
 if(temple.some(entry=>entry.denied))return []
 const boundaries=dnd5eActiveMovementBoundarySaves(actor.classState.activeEffects).filter(boundary=>{
  const source=input.state.combatants[boundary.sourceActorId]
  return source&&Math.hypot(input.to.x-source.position.x,input.to.y-source.position.y)>boundary.maximumDistanceFeet+1e-6
 })
 const effects=effectiveDnd5eActiveEffects(actor.classState.activeEffects)
 return [...boundaries,...temple].map(boundary=>({effectId:boundary.effectId,requirement:{
  featureId:boundary.effectId,ability:boundary.ability,dc:boundary.dc,
  modifier:actor.savingThrowBonuses[boundary.ability]??Math.floor((actor.abilities[boundary.ability]-10)/2),
  mode:dnd5eSavingThrowMode(actor,boundary.ability,temple.some(entry=>entry.effectId===boundary.effectId)?{sourceIsSpell:true,sourceIsMagical:true}:undefined),
  blessed:effects.some(effect=>effect.source.rulesId==='bless'),baned:effects.some(effect=>effect.source.rulesId==='bane'),failureDamageMultiplier:1,
 }}))
}
