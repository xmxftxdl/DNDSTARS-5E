import{pactWeaponPendingSeparationInstance}from'./pactWeaponSeparation'
import type {Character} from '../../types/character'
import type {EquipmentItem} from '../../types/equipment'
import {normalizeDnd5eInventory} from '../../rulesets/dnd5e/items'
import {dnd5eCharacterClassLevel} from '../../rulesets/dnd5e/classLevels'
import {dnd5eActiveMagicWeaponBonus} from '../../rulesets/dnd5e/activeEffects'
import {dnd5eWeaponDamageSource} from '../../rulesets/dnd5e/equipment'
import {normalizePactWeaponState} from './pactWeaponBinding.mjs'
import {validPactWeaponPhysicalIdentity} from './pactWeaponPhysicalIdentity'
import type {PactAuthorityCharacter} from './pactWeaponSummonHost'
import {pactWeaponHasImprovedInvocation} from './pactWeaponEntitlement'

export type PactWeaponCombatFact={ownerId:string;wielderId:string;instanceId:string;equipmentId:string;
 additionalAttackAndDamageBonus:0|1;grantsProficiency:boolean;warlockFocus:boolean;
 damageSource:NonNullable<ReturnType<typeof dnd5eWeaponDamageSource>>}

/** Host-only derived read model. The callback must resolve the registered owned
 * invocation; it is never part of a player command. Returned equipment is for
 * rules reads only: persist/apply results against the ORIGINAL roster.
 * No production consumer is wired to this staged adapter yet.
 */
export function derivePactWeaponCombatView(original:readonly Character[],hasImprovedInvocation:(owner:Character)=>boolean=pactWeaponHasImprovedInvocation){
 const characters=original.map(character=>{
  const inventory=normalizeDnd5eInventory(character),equipment={...character.equipment}
  for(const entry of inventory.entries){
   if(validPactWeaponPhysicalIdentity(entry)&&entry.equippedSlot&&entry.item.equipment)equipment[entry.equippedSlot]=entry.item.equipment
  }
  return {...character,equipment,dnd5eInventory:inventory}
 })
 const facts:PactWeaponCombatFact[]=[]
 const bonds=original.flatMap(owner=>{
  const authority=(owner as PactAuthorityCharacter).dnd5ePactWeaponAuthority
  const state=authority?.schemaVersion===1?normalizePactWeaponState(authority.state):undefined
  if(pactWeaponPendingSeparationInstance(owner)||!state||state.ownerId!==owner.id||state.binding?.status!=='present'||dnd5eCharacterClassLevel(owner,'warlock')<3||
   !owner.dnd5eClassChoices?.classes?.warlock?.selections?.['pact-boon']?.includes('blade'))return[]
  return[{owner,state,binding:state.binding}]
 })
 for(const {owner,binding}of bonds){
  if(bonds.filter(row=>row.binding.inventoryInstanceId===binding.inventoryInstanceId).length!==1)continue
  const matches=characters.flatMap(actor=>actor.dnd5eInventory.entries.filter(entry=>entry.instanceId===binding.inventoryInstanceId).map(entry=>({actor,entry})))
  if(matches.length!==1)continue
  const {actor,entry}=matches[0],identity=validPactWeaponPhysicalIdentity(entry),weapon=entry.item.equipment
  if(!identity||!weapon||weapon.dnd5e?.kind!=='weapon'||entry.condition?.destroyed||
   (entry.equippedSlot!=='mainWeapon'&&entry.equippedSlot!=='offHand')||
   actor.equipment[entry.equippedSlot]?.id!==identity.equipmentId||
   (weapon.baseEquipmentId??weapon.id).replace(/^dnd5e-/,'')!==binding.weaponBaseId)continue
  if(characters.some(other=>other.dnd5eInventory.entries.some(row=>row.instanceId!==entry.instanceId&&row.item.equipment?.id===identity.equipmentId)))continue
  const improved=hasImprovedInvocation(owner),personal=actor.id===owner.id
  const activeBonus=dnd5eActiveMagicWeaponBonus(actor.dnd5eCombatState?.activeEffects,weapon.id)
  const alreadyBonused=activeBonus!==0||(weapon.effects?.weaponAttackBonus??0)!==0||(weapon.effects?.weaponDamageBonus??0)!==0
  const additionalAttackAndDamageBonus=improved&&!alreadyBonused?1:0
  const source=dnd5eWeaponDamageSource(weapon);if(!source)continue
  const projected:EquipmentItem={...weapon,
   effects:additionalAttackAndDamageBonus?{...weapon.effects,weaponAttackBonus:1,weaponDamageBonus:1}:weapon.effects,
   // Make intrinsic magic explicit before adding the derived +1. Otherwise the
   // legacy +N-item inference would reclassify a merely resistance-magical pact
   // weapon as intrinsically magical for unrelated spell target requirements.
   dnd5e:{...weapon.dnd5e,magical:source.magical,...(personal?{grantsProficiency:true}:{})},
   spellcastingFocusClassIds:personal&&improved?[...new Set([...(weapon.spellcastingFocusClassIds??[]),'warlock'])]:weapon.spellcastingFocusClassIds}
  actor.equipment[entry.equippedSlot]=projected
  entry.item={...entry.item,equipment:projected}
  facts.push({ownerId:owner.id,wielderId:actor.id,instanceId:entry.instanceId,equipmentId:identity.equipmentId,
   additionalAttackAndDamageBonus,grantsProficiency:personal,warlockFocus:personal&&improved,damageSource:{...source,magical:true}})
 }
 return {characters,facts}
}
