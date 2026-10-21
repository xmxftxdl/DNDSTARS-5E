import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { startDnd5eHeadlessCombat } from '../headlessCombatEngine'
import { registerDnd5eActivityPackage, clearDnd5eActivityRegistryForTests } from './dnd5eActivityRegistry'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'
import { describe, expect, it } from 'vitest'
import { normalizeCharacter } from '../../../store/characters'
import { createCombatantFromDnd5eCharacter, migrateCharacterToDnd5e } from '../character'
import { DND5E_LONGSWORD } from '../equipment'
import { createDnd5eMechanicalEffect } from '../activeEffects'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './dnd5eActivityCombatAuthority'
import { resolveDnd5eAppliedEffectDefinitionV1 } from './dnd5eActivityExecutor'
import { validateDnd5eEffectDefinitionV1 } from './dnd5eActivityValidation'
import type { Dnd5eEffectDefinitionV1 } from './dnd5eEffectContracts'
const definition: Dnd5eEffectDefinitionV1 = {
 schemaVersion:1,id:'nonmagical-binding',name:'Binding',stacking:'replace',duration:{kind:'rounds',rounds:10,expiresAt:'target-turn-end'},
 modifiers:[{kind:'weapon-enchantment',weaponSlot:'main-hand',requiresNonmagical:true,attackAndDamageBonus:{kind:'constant',value:1}}],
}
function combatant(magical=false) {
 const weapon={...DND5E_LONGSWORD,dnd5e:{...DND5E_LONGSWORD.dnd5e!,magical}} as typeof DND5E_LONGSWORD
 return createCombatantFromDnd5eCharacter({character:migrateCharacterToDnd5e(normalizeCharacter({id:'hero',name:'Hero',charClass:'战士',level:1,equipment:{mainWeapon:weapon}})),controller:'player',initiativeD20:10,position:{x:0,y:0}})
}
function binding(target: ReturnType<typeof combatant>) {
 const snapshot=dnd5eActivityActorSnapshotFromCombatantV1(target)
 return resolveDnd5eAppliedEffectDefinitionV1(definition,{actor:snapshot,target:snapshot})
}
describe('Host nonmagical weapon binding eligibility',()=>{
 it('accepts ordinary weapons and rejects intrinsic magic or missing facts',()=>{
  expect(validateDnd5eEffectDefinitionV1(definition)).toEqual([])
  const ordinary=combatant()
  expect(binding(ordinary).modifierGroups?.[0]?.weaponEnchantment?.weaponId).toBe(DND5E_LONGSWORD.id)
  expect(()=>binding(combatant(true))).toThrow('verified nonmagical')
  delete ordinary.activityEquipment!.mainHand!.magical
  expect(()=>binding(ordinary)).toThrow('verified nonmagical')
 })
 it('refreshes temporary zero-bonus enchantments and permits binding again after removal',()=>{
  const target=combatant()
  const before=structuredClone(target)
  target.classState.activeEffects=[createDnd5eMechanicalEffect({definitionId:'existing',label:'Existing',source:{kind:'spell',actorId:'caster'},targetId:'hero',modifiers:{weaponEnchantment:{weaponId:DND5E_LONGSWORD.id,attackAndDamageBonus:0}}})]
  expect(()=>binding(target)).toThrow('verified nonmagical')
  target.classState.activeEffects=[]
  expect(()=>binding(target)).not.toThrow()
  expect(target.activityEquipment).toEqual(before.activityEquipment)
 })
 it('does not confuse another weapon or a suspended enchantment with this weapon',()=>{
  const target=combatant()
  const effect=createDnd5eMechanicalEffect({definitionId:'other',label:'Other',source:{kind:'spell',actorId:'caster'},targetId:'hero',modifiers:{magicWeapon:{weaponId:'other-weapon',bonus:1}}})
  target.classState.activeEffects=[effect]
  expect(()=>binding(target)).not.toThrow()
  target.classState.activeEffects=[{...effect,suspendedBy:['antimagic'],modifiers:{magicWeapon:{weaponId:DND5E_LONGSWORD.id,bonus:1}}}]
  expect(()=>binding(target)).not.toThrow()
 })
 it('rejects unsupported container qualification and malformed boolean declarations',()=>{
  const modifier=definition.modifiers![0]
  for(const patch of [{requiresNonmagical:false},{requiresNonmagical:'true'},{weaponSlot:'ammunition-container'}]) {
   expect(validateDnd5eEffectDefinitionV1({...definition,modifiers:[{...modifier,...patch}]} as Dnd5eEffectDefinitionV1).some(issue=>issue.includes('weapon-enchantment'))).toBe(true)
  }
 })
})

it('rejects a second enchantment through the real Host transaction without spending resources',()=>{
 const actor=combatant()
 actor.pluginFeatureIds=['bind']
 actor.classResources={focus:{current:2,max:2}}
 const enemy={...combatant(),id:'enemy',controller:'dm' as const,initiative:1}
 const state=startDnd5eHeadlessCombat('binding-test',[actor,enemy])
 registerDnd5eActivityPackage({packageId:'test.binding-eligibility',packageVersion:'1.0.0',activities:[{
  schemaVersion:1,id:'bind',name:'Bind',activation:{kind:'free'},target:{kind:'self'},legacySource:{kind:'feature',id:'bind'},
  automation:automationCapabilityFromLegacyStatus('full'),effects:[definition],
  consumption:[{kind:'resource',resourceId:'focus',amount:{kind:'constant',value:1},consumeOn:'resolve'}],
  outcomes:[{id:'apply',when:{kind:'always'},operations:[{id:'enchant',kind:'apply-effect',target:'actor',effectId:definition.id}]}],
 }]})
 try{
  const execute=(current:typeof state,id:string)=>resolveRegisteredDnd5eActivityInCombatV1({state:current,combatRevision:1,command:{schemaVersion:1,commandId:id,actorId:actor.id,packageId:'test.binding-eligibility',packageVersion:'1.0.0',activityId:'bind',targetIds:[actor.id],expectedRevision:1},authoritativeRolls:{},confirmedBy:'actor'})
  const first=execute(state,'first')
  expect(first.result.ok,JSON.stringify(first)).toBe(true)
  if(first.phase!=='commit'||!first.result.ok)throw Error('binding did not commit')
  const accepted=first.result.state
  expect(accepted.combatants[actor.id].classResources.focus.current).toBe(1)
  expect(state.combatants[actor.id].classResources.focus.current).toBe(2)
  const before=structuredClone(accepted)
  const second=execute(accepted,'second')
  expect(second.result.ok).toBe(false)
  expect(accepted).toEqual(before)
 }finally{clearDnd5eActivityRegistryForTests()}
})
