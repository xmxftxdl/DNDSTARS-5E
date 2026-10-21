import {it,expect} from 'vitest'
import {normalizeCharacter} from '../../store/characters'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {applyDnd5eInventoryMutation,consumeDnd5eWeaponAmmunition} from './items'
import {ammunitionContainerSnapshots} from './ammunitionBindings'
import {createDnd5eMechanicalEffect,dnd5eActiveWeaponEnchantmentDamage} from './activeEffects'
import {reconcileDnd5eInventoryEffectBindings} from './inventoryEffectBindings'
import {DND5E_LONGBOW} from './equipment'
it.each(['ethereal-ammo','released-ammo','ethereal-container','released-container','missing-container','cyclic-container'] as const)('rejects inaccessible ammunition without changing inventory (%s)', scenario=>{
 const dispose=registerDnd5eRulesPlugin({manifest:{id:'test.inaccessible-ammo',name:'Ammo',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){api.registerItem({id:'quiver',name:'Quiver',category:'container',icon:'container',description:'Synthetic',rulesText:'Synthetic',stackable:false,containerCapacityWeightLb:10})}})
 try {
  let chars=[normalizeCharacter({id:'owner',name:'Owner',equipment:{mainWeapon:DND5E_LONGBOW},dnd5eInventory:{schemaVersion:1,entries:[]}})]
  chars=applyDnd5eInventoryMutation(chars,{type:'grant',characterId:'owner',templateId:'test.inaccessible-ammo:quiver',quantity:1}).characters
  chars=applyDnd5eInventoryMutation(chars,{type:'grant',characterId:'owner',templateId:'srd-5.1:item:arrows',quantity:2}).characters
  const entries=chars[0].dnd5eInventory!.entries
  const quiver=entries.find(entry=>entry.item.category==='container')!,arrows=entries.find(entry=>entry.item.ammunitionKind==='arrow')!
  arrows.containerInstanceId=quiver.instanceId
  if(scenario==='ethereal-ammo')arrows.planarState='ethereal'
  if(scenario==='released-ammo')arrows.releasedByCharacterId='owner'
  if(scenario==='ethereal-container')quiver.planarState='ethereal'
  if(scenario==='released-container')quiver.releasedByCharacterId='owner'
  if(scenario==='missing-container')quiver.containerInstanceId='absent'
  if(scenario==='cyclic-container')quiver.containerInstanceId=quiver.instanceId
  const before=structuredClone(chars[0])
  expect(ammunitionContainerSnapshots(chars[0])).toEqual([])
  expect(consumeDnd5eWeaponAmmunition(chars[0],DND5E_LONGBOW.id)).toMatchObject({ok:false,reason:'ammunition-unavailable'})
  expect(chars[0]).toEqual(before)
 }finally{dispose()}
})
it('binds only the selected loaded container and transfers its contents and charge balance',()=>{
 const dispose=registerDnd5eRulesPlugin({manifest:{id:'test.ammo',name:'Ammo',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){api.registerItem({id:'quiver',name:'Quiver',category:'container',icon:'container',description:'Synthetic',rulesText:'Synthetic',stackable:false,containerCapacityWeightLb:10})}})
 try {
 let chars=['owner','recipient'].map(id=>normalizeCharacter({id,name:id,equipment:{mainWeapon:DND5E_LONGBOW},dnd5eInventory:{schemaVersion:1,entries:[]}}))
 chars=applyDnd5eInventoryMutation(chars,{type:'grant',characterId:'owner',templateId:'test.ammo:quiver',quantity:2}).characters
 chars=applyDnd5eInventoryMutation(chars,{type:'grant',characterId:'owner',templateId:'srd-5.1:item:arrows',quantity:20}).characters
 const quiver=chars[0].dnd5eInventory!.entries.find(entry=>entry.item.category==='container')!, arrows=chars[0].dnd5eInventory!.entries.find(entry=>entry.item.ammunitionKind==='arrow')!
 chars=applyDnd5eInventoryMutation(chars,{type:'set-container',characterId:'owner',instanceId:arrows.instanceId,containerInstanceId:quiver.instanceId}).characters
 expect(ammunitionContainerSnapshots(chars[0])).toEqual([{instanceId:quiver.instanceId,weaponIds:[DND5E_LONGBOW.id]}])
 chars[0].dnd5eCombatState={schemaVersion:2,activeEffects:[createDnd5eMechanicalEffect({id:'flames',definitionId:'flames',label:'Flames',targetId:'owner',source:{kind:'spell',actorId:'owner',rulesId:'flames'},duration:{type:'concentration',sourceActorId:'owner',remainingRounds:600},modifiers:{weaponEnchantment:{weaponId:'container:'+quiver.instanceId,inventoryInstanceId:quiver.instanceId,ammunitionContainer:true,remainingAttacks:12,attackAndDamageBonus:0,bonusDamage:{count:1,sides:6,type:'fire'}}}})]}
 chars=reconcileDnd5eInventoryEffectBindings(chars)
 expect(dnd5eActiveWeaponEnchantmentDamage(chars[0].dnd5eCombatState?.activeEffects,DND5E_LONGBOW.id)).toHaveLength(1)
 expect(dnd5eActiveWeaponEnchantmentDamage(chars[0].dnd5eCombatState?.activeEffects,'dnd5e-longsword')).toHaveLength(0)
 const transfer=applyDnd5eInventoryMutation(chars,{type:'transfer',characterId:'owner',targetCharacterId:'recipient',instanceId:quiver.instanceId,quantity:1})
 expect(transfer.ok).toBe(true)
 const recipient=transfer.characters[1]
 expect(recipient.dnd5eInventory!.entries.find(entry=>entry.instanceId===arrows.instanceId)?.containerInstanceId).toBe(quiver.instanceId)
 expect(recipient.dnd5eCombatState?.activeEffects?.[0].modifiers?.weaponEnchantment?.remainingAttacks).toBe(12)
 const consumed=consumeDnd5eWeaponAmmunition(recipient,DND5E_LONGBOW.id)
 expect(consumed.ok).toBe(true)
 expect(consumed.character.dnd5eInventory!.entries.find(entry=>entry.instanceId===arrows.instanceId)?.quantity).toBe(19)
 expect(transfer.characters[0].dnd5eInventory!.entries.some(entry=>entry.instanceId===arrows.instanceId)).toBe(false)
 }finally{dispose()}
})
