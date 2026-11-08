import type {Character} from '../../types/character'
import {prepareDnd5eEquipmentAttack} from '../../rulesets/dnd5e/equipmentAttackAction'
import {derivePactWeaponCombatView} from './pactWeaponCombatView'
import {pactWeaponHasImprovedInvocation} from './pactWeaponEntitlement'

/** Staged Host composition for ordinary real equipment attacks. Never persist
 * the derived roster: the canonical resolver consumes ammunition and creates its
 * application against the original actor/roster instead. Prelude and in-flight
 * save-counter snapshots require their own integration and are rejected here.
 */
export function preparePactWeaponAttackView(input:Parameters<typeof prepareDnd5eEquipmentAttack>[0],hasImprovedInvocation:(owner:Character)=>boolean=pactWeaponHasImprovedInvocation){
 if(input.savingThrowCounterattack)return{ok:false as const,reason:'invalid-action' as const}
 const view=derivePactWeaponCombatView(input.characters,hasImprovedInvocation)
 const result=prepareDnd5eEquipmentAttack({...input,characters:view.characters})
 if(!result.ok)return result
 const prepared=result.prepared
 if(prepared.attackActionTeleport||prepared.attackTeleportPrelude)return{ok:false as const,reason:'invalid-action' as const}
 const originalActor=input.characters.find(actor=>actor.id===prepared.actor.id)
 if(!originalActor)return{ok:false as const,reason:'invalid-actor' as const}
 // The original source and private binding were validated while deriving facts.
 for(const fact of view.facts){
  for(const token of input.map.tokens.filter(token=>token.characterId===fact.wielderId)){
   const combatant=prepared.state.combatants[token.id]
   if(!combatant)continue
   combatant.weaponDamageSources={...combatant.weaponDamageSources,[fact.equipmentId]:fact.damageSource}
  }
 }
 const fact=view.facts.find(row=>row.wielderId===originalActor.id&&row.equipmentId===prepared.profile.weaponId)
 return{ok:true as const,prepared:{...prepared,actor:originalActor,characters:input.characters,
  damageSource:fact?fact.damageSource:prepared.damageSource},facts:view.facts}
}
