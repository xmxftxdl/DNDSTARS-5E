import { advanceDnd5eCampaignTimedActiveEffects } from './campaignTimeRules'
import { describe, expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { applyDnd5eInventoryMutation } from './items'
import { createDnd5eMechanicalEffect, dnd5eActiveArmorEnchantmentBonus, dnd5eActiveMagicWeaponBonus, dnd5eActiveEmittedLight } from './activeEffects'
import { DND5E_LONGSWORD } from './equipment'
import { reconcileDnd5eInventoryEffectBindings, dnd5eMapInventoryLifetimeEntries } from './inventoryEffectBindings'
import { migrateMapsState } from '../../store/maps'
import { validateDnd5eActiveEffectsStrict } from './activeEffects'

it.each(['destroy-bound','destroy-other','missing','transfer','ambiguous'] as const)('ends a caster-owned lifetime only for confirmed destruction of its exact instance (%s)',mode=>{
  let characters=['source','recipient'].map(id=>normalizeCharacter({id,name:id,equipment:{},dnd5eInventory:{schemaVersion:1,entries:[]}}))
  for(const characterId of ['source','recipient']){
    const grant=applyDnd5eInventoryMutation(characters,{type:'grant',characterId,templateId:'srd-5.1:equipment:dnd5e-longsword',quantity:1})
    expect(grant.ok).toBe(true);characters=grant.characters
  }
  const instanceId=characters[0].dnd5eInventory!.entries[0].instanceId
  characters[0].dnd5eCombatState={activeEffects:[createDnd5eMechanicalEffect({id:'controller',definitionId:'controller',label:'Controller',targetId:'source',
    source:{kind:'spell',actorId:'source'},duration:{type:'permanent'},removal:{onInventoryInstanceDestroyed:instanceId}})]}
  characters=characters.map(character=>normalizeCharacter(JSON.parse(JSON.stringify(character))))
  expect(characters[0].dnd5eCombatState!.activeEffects![0].removal?.onInventoryInstanceDestroyed).toBe(instanceId)
  if(mode==='transfer'){
    const moved=applyDnd5eInventoryMutation(characters,{type:'transfer',characterId:'source',targetCharacterId:'recipient',instanceId,quantity:1})
    expect(moved.ok).toBe(true);characters=moved.characters
    expect(characters[1].dnd5eInventory!.entries.some(entry=>entry.instanceId===instanceId)).toBe(true)
    const returned=applyDnd5eInventoryMutation(characters,{type:'transfer',characterId:'recipient',targetCharacterId:'source',instanceId,quantity:1})
    expect(returned.ok).toBe(true)
    expect(returned.characters[0].dnd5eInventory!.entries.some(entry=>entry.instanceId===instanceId)).toBe(true)
    expect(returned.characters[0].dnd5eCombatState?.activeEffects?.some(effect=>effect.id==='controller')).toBe(true)
  }
  if(mode==='missing')characters[0].dnd5eInventory!.entries=[]
  if(mode==='ambiguous')characters[1].dnd5eInventory!.entries.push(structuredClone(characters[0].dnd5eInventory!.entries[0]))
  if(mode==='destroy-bound'||mode==='ambiguous')characters[0].dnd5eInventory!.entries[0].condition={destroyed:true}
  if(mode==='destroy-other')characters[1].dnd5eInventory!.entries[0].condition={destroyed:true}
  const before=structuredClone(characters),result=reconcileDnd5eInventoryEffectBindings(characters)
  expect(result[0].dnd5eCombatState?.activeEffects?.some(effect=>effect.id==='controller')??false).toBe(mode!=='destroy-bound')
  expect(result[1].dnd5eCombatState?.activeEffects?.some(effect=>effect.id==='controller')??false).toBe(false)
  expect(characters).toEqual(before)
  const bad=createDnd5eMechanicalEffect({id:'bad',definitionId:'bad',label:'Bad',targetId:'source',source:{kind:'spell'},removal:{onInventoryInstanceDestroyed:''}})
  expect(validateDnd5eActiveEffectsStrict([bad]).ok).toBe(false)
})

it.each(['intact','destroyed','missing-profile','ambiguous','carried-destroyed'] as const)(
  'uses explicit room object destruction without guessing from missing or ambiguous instances: %s', mode => {
    const source=normalizeCharacter({id:'source',name:'Source',equipment:{},dnd5eInventory:{schemaVersion:3,entries:[]}})
    const granted=applyDnd5eInventoryMutation([source],{type:'grant',characterId:source.id,templateId:'srd-5.1:equipment:dnd5e-longsword',quantity:1})
    expect(granted.ok).toBe(true)
    const entry=granted.characters[0].dnd5eInventory!.entries[0]
    const character={...granted.characters[0],dnd5eInventory:{...granted.characters[0].dnd5eInventory!,entries:mode==='ambiguous'?[entry]:[]},
      dnd5eCombatState:{activeEffects:[createDnd5eMechanicalEffect({id:'lifetime',definitionId:'lifetime',label:'Lifetime',targetId:source.id,
        source:{kind:'plugin'},removal:{onInventoryInstanceDestroyed:entry.instanceId}})]}}
    const objectState={schemaVersion:1,combatProfile:mode==='missing-profile'?undefined:{armorClass:15},inventoryItem:{
      templateId:entry.templateId,quantity:1,receiptId:'dropped',instance:mode==='carried-destroyed'?{...entry,condition:{destroyed:true}}:entry}}
    const maps=migrateMapsState({maps:[{id:'remote',width:500,height:500,gridSize:50,tokens:[mode==='carried-destroyed'
      ?{id:'carrier',type:'enemy',label:'Carrier',x:25,y:25,size:1,dnd5eCarriedObjects:[{id:'item',pickupReceipt:'pickup',label:'Item',objectState}]}
      :{id:'item',type:'obstacle',label:'Item',x:25,y:25,size:1,hp:mode==='intact'?3:0,maxHp:3,dnd5eObjectState:objectState}]}]}).maps
    const before=structuredClone({maps,character})
    const result=reconcileDnd5eInventoryEffectBindings([character],dnd5eMapInventoryLifetimeEntries(maps))
    expect(result[0].dnd5eCombatState?.activeEffects?.some(effect=>effect.id==='lifetime')??false).toBe(mode!=='destroyed'&&mode!=='carried-destroyed')
    expect({maps,character}).toEqual(before)
  })

describe('instance-bound enchantment lifecycle', () => {
  it('suspends when unequipped, transfers the same instance and removes its effect on discard', () => {
    let characters = ['source', 'recipient'].map(id => normalizeCharacter({ id, name: id, equipment: {}, dnd5eInventory: { schemaVersion: 1, entries: [] } }))
    let result = applyDnd5eInventoryMutation(characters, { type: 'grant', characterId: 'source', templateId: 'srd-5.1:equipment:dnd5e-longsword', quantity: 1 })
    expect(result.ok).toBe(true)
    const instanceId = result.characters[0].dnd5eInventory!.entries[0].instanceId
    result = applyDnd5eInventoryMutation(result.characters, { type: 'equip', characterId: 'source', instanceId, slot: 'mainWeapon' })
    characters = result.characters
    characters[0] = { ...characters[0], dnd5eCombatState: { schemaVersion: 2, activeEffects: [createDnd5eMechanicalEffect({
      id: 'bound-test', definitionId: 'test:bound', label: 'Bound', targetId: 'source',
      source: { kind: 'spell', actorId: 'caster', rulesId: 'test:bound', pluginId: 'local.test' },
      duration: { type: 'rounds', remainingRounds: 10, tickOn: 'source-turn-end' },
      modifiers: { weaponEnchantment: { weaponId: DND5E_LONGSWORD.id, inventoryInstanceId: instanceId, attackAndDamageBonus: 2, remainingAttacks: 3 } },
    })] } }
    // The binding survives ordinary persistence normalization.
    characters[0] = normalizeCharacter(characters[0])
    expect(characters[0].dnd5eCombatState?.activeEffects?.[0].modifiers?.weaponEnchantment?.inventoryInstanceId).toBe(instanceId)
    const unequipped = applyDnd5eInventoryMutation(characters, { type: 'unequip', characterId: 'source', instanceId })
    expect(unequipped.ok).toBe(true)
    expect(dnd5eActiveMagicWeaponBonus(unequipped.characters[0].dnd5eCombatState?.activeEffects, DND5E_LONGSWORD.id)).toBe(0)
    const transferred = applyDnd5eInventoryMutation(unequipped.characters, { type: 'transfer', characterId: 'source', instanceId, targetCharacterId: 'recipient', quantity: 1 })
    expect(transferred.ok).toBe(true)
    expect(transferred.characters[0].dnd5eCombatState?.activeEffects).toHaveLength(0)
    expect(transferred.characters[1].dnd5eInventory?.entries[0].instanceId).toBe(instanceId)
    const equipped = applyDnd5eInventoryMutation(transferred.characters, { type: 'equip', characterId: 'recipient', instanceId, slot: 'mainWeapon' })
    expect(dnd5eActiveMagicWeaponBonus(equipped.characters[1].dnd5eCombatState?.activeEffects, DND5E_LONGSWORD.id)).toBe(2)
    expect(equipped.characters[1].dnd5eCombatState?.activeEffects?.[0].modifiers?.weaponEnchantment?.remainingAttacks).toBe(3)
    const discarded = applyDnd5eInventoryMutation(equipped.characters, { type: 'discard', characterId: 'recipient', instanceId, quantity: 1 })
    expect(discarded.ok).toBe(true)
    expect(discarded.characters[1].dnd5eCombatState?.activeEffects).toHaveLength(0)
  })
})

it('moves armor binding with the physical instance and suspends it while not worn',()=>{
 let characters=['source','recipient'].map(id=>normalizeCharacter({id,name:id,equipment:{},dnd5eInventory:{schemaVersion:1,entries:[]}}))
 const granted=applyDnd5eInventoryMutation(characters,{type:'grant',characterId:'source',templateId:'srd-5.1:equipment:dnd5e-chain-mail',quantity:1})
 expect(granted.ok).toBe(true)
 const instanceId=granted.characters[0].dnd5eInventory!.entries[0].instanceId
 characters=applyDnd5eInventoryMutation(granted.characters,{type:'equip',characterId:'source',instanceId,slot:'armor'}).characters
 const armorId=characters[0].equipment!.armor!.id
 characters[0]={...characters[0],dnd5eCombatState:{schemaVersion:2,activeEffects:[createDnd5eMechanicalEffect({id:'armor-bound',definitionId:'test:armor',label:'Armor',targetId:'source',source:{kind:'feature',actorId:'caster'},modifiers:{armorEnchantment:{armorId,inventoryInstanceId:instanceId,armorClassBonus:1}}})]}}
 const bonus=(character:typeof characters[number])=>dnd5eActiveArmorEnchantmentBonus(character.dnd5eCombatState?.activeEffects,character.equipment?.armor?{itemId:character.equipment.armor.id,inventoryInstanceId:instanceId}:undefined)
 expect(bonus(characters[0])).toBe(1)
 const removed=applyDnd5eInventoryMutation(characters,{type:'unequip',characterId:'source',instanceId})
 expect(bonus(removed.characters[0])).toBe(0)
 const moved=applyDnd5eInventoryMutation(removed.characters,{type:'transfer',characterId:'source',instanceId,targetCharacterId:'recipient',quantity:1})
 expect(moved.ok).toBe(true)
 expect(moved.characters[0].dnd5eCombatState?.activeEffects).toHaveLength(0)
 const equipped=applyDnd5eInventoryMutation(moved.characters,{type:'equip',characterId:'recipient',instanceId,slot:'armor'})
 expect(equipped.ok).toBe(true)
 expect(bonus(equipped.characters[1])).toBe(1)
 const discarded=applyDnd5eInventoryMutation(equipped.characters,{type:'discard',characterId:'recipient',instanceId,quantity:1})
 expect(discarded.ok).toBe(true)
 expect(discarded.characters[1].dnd5eCombatState?.activeEffects).toHaveLength(0)
})

it('keeps light on an unheld bound weapon while its attack bonus and other suppressions remain enforced',()=>{
 const effect=createDnd5eMechanicalEffect({id:'light',definitionId:'light',label:'Light',targetId:'holder',
  source:{kind:'spell',actorId:'caster',magical:true},duration:{type:'permanent'},
  suspendedBy:['inventory-binding:not-held'],modifiers:{emittedLight:{brightRadiusFeet:30,dimRadiusFeet:30,color:'#fff4cc'},
   weaponEnchantment:{weaponId:DND5E_LONGSWORD.id,inventoryInstanceId:'sword',attackAndDamageBonus:2}}})
 expect(dnd5eActiveEmittedLight([effect])).toMatchObject({brightRadiusFeet:30,dimRadiusFeet:30})
 expect(dnd5eActiveMagicWeaponBonus([effect],DND5E_LONGSWORD.id)).toBe(0)
 expect(effect.suspendedBy).toEqual(['inventory-binding:not-held'])
 expect(dnd5eActiveEmittedLight([{...effect,suspendedBy:['inventory-binding:not-held','antimagic']}])).toBeUndefined()
 expect(dnd5eActiveEmittedLight([{...effect,modifiers:{emittedLight:effect.modifiers!.emittedLight}}])).toBeUndefined()
})


it.each(['ground-intact','ground-child-destroyed','carried-child-destroyed','container-destroyed'] as const)('tracks a packed physical instance lifetime and origin: %s',async mode=>{
 let characters=[normalizeCharacter({id:'source',name:'Source',equipment:{},dnd5eInventory:{schemaVersion:3,entries:[]}})]
 for(const templateId of ['srd-5.1:item:backpack','srd-5.1:equipment:dnd5e-longsword']){
  const grant=applyDnd5eInventoryMutation(characters,{type:'grant',characterId:'source',templateId,quantity:1});expect(grant.ok).toBe(true);characters=grant.characters
 }
 const bag=characters[0].dnd5eInventory!.entries.find(e=>e.item.category==='container')!,sword=characters[0].dnd5eInventory!.entries.find(e=>e.item.category!=='container')!
 sword.containerInstanceId=bag.instanceId
 const destroyed=mode.includes('child-destroyed')
 if(destroyed)sword.condition={destroyed:true}
 if(mode==='container-destroyed')bag.condition={destroyed:true}
 characters[0].dnd5eInventory!.entries=[]
 characters[0].dnd5eCombatState={schemaVersion:2,activeEffects:[createDnd5eMechanicalEffect({id:'packed-lifetime',definitionId:'packed-lifetime',label:'Packed lifetime',targetId:'source',
  source:{kind:'spell',actorId:'source'},duration:{type:'permanent'},removal:{onInventoryInstanceDestroyed:sword.instanceId}})]}
 const effect=createDnd5eMechanicalEffect({id:'packed-effect',definitionId:'packed-effect',label:'Packed effect',targetId:'ground',source:{kind:'spell',actorId:'source'},duration:{type:'permanent'},
  modifiers:{weaponEnchantment:{weaponId:'dnd5e-longsword',inventoryInstanceId:sword.instanceId,attackAndDamageBonus:1}}})
 const objectState={schemaVersion:1,inventoryItem:{templateId:bag.templateId,quantity:1,receiptId:'pack',instance:bag,contents:[sword],boundEffects:[effect]}}
 const carried=mode.startsWith('carried')
 const map=migrateMapsState(JSON.parse(JSON.stringify({maps:[{id:'packed',width:500,height:500,gridSize:50,tokens:[carried
  ?{id:'bearer',type:'enemy',label:'Bearer',x:25,y:25,size:1,dnd5eCarriedObjects:[{id:'pack',pickupReceipt:'pack',label:'Pack',objectState}]}
  :{id:'ground',type:'obstacle',label:'Pack',x:25,y:25,size:1,dnd5eObjectState:objectState}]}]}))).maps[0]
 const entries=dnd5eMapInventoryLifetimeEntries([map])
 expect(entries.map(e=>e.instanceId).sort()).toEqual([bag.instanceId,sword.instanceId].sort())
 const result=reconcileDnd5eInventoryEffectBindings(characters,entries)
 expect(result[0].dnd5eCombatState?.activeEffects?.some(e=>e.id==='packed-lifetime')??false).toBe(!destroyed)
 const {projectDnd5eGroundItemEffectOrigins}=await import('./mapGroundItemEffectOrigins')
 const state={combatants:{}} as unknown as Parameters<typeof projectDnd5eGroundItemEffectOrigins>[0]
 projectDnd5eGroundItemEffectOrigins(state,map)
 expect(state.groundItemEffectOrigins?.[carried?'bearer':'ground']?.map(e=>e.id)??[]).toEqual(destroyed?[]:['packed-effect'])
})


it('retains a source-only enchantment across transfer without granting its bonus to a different wielder', () => {
  let characters = ['source', 'recipient'].map(id => normalizeCharacter({ id, name: id, equipment: {}, dnd5eInventory: { schemaVersion: 1, entries: [] } }))
  const granted = applyDnd5eInventoryMutation(characters, { type: 'grant', characterId: 'source', templateId: 'srd-5.1:equipment:dnd5e-longsword', quantity: 1 })
  expect(granted.ok).toBe(true)
  const instanceId = granted.characters[0].dnd5eInventory!.entries[0].instanceId
  const equipped = applyDnd5eInventoryMutation(granted.characters, { type: 'equip', characterId: 'source', instanceId, slot: 'mainWeapon' })
  expect(equipped.ok).toBe(true); characters = equipped.characters
  characters[0].dnd5eCombatState = { schemaVersion: 2, activeEffects: [createDnd5eMechanicalEffect({
    id: 'sharpen', definitionId: 'test:sharpen', label: 'Sharpen', targetId: 'source-token',
    source: { kind: 'plugin', actorId: 'source-token', characterId: 'source', pluginId: 'test.sharpen' },
    duration: { type: 'rounds', remainingRounds: 7, tickOn: 'source-turn-start' },
    modifiers: { weaponEnchantment: { weaponId: DND5E_LONGSWORD.id, inventoryInstanceId: instanceId, attackAndDamageBonus: 3, sourceWielderOnly: true } },
  })] }
  characters = characters.map(c => normalizeCharacter(JSON.parse(JSON.stringify(c))))
  expect(characters[0].dnd5eCombatState!.activeEffects![0].modifiers!.weaponEnchantment!.sourceWielderOnly).toBe(true)
  expect(dnd5eActiveMagicWeaponBonus(characters[0].dnd5eCombatState?.activeEffects, DND5E_LONGSWORD.id)).toBe(3)
  const transferred = applyDnd5eInventoryMutation(characters, { type: 'transfer', characterId: 'source', instanceId, targetCharacterId: 'recipient', quantity: 1 })
  expect(transferred.ok).toBe(true)
  const other = applyDnd5eInventoryMutation(transferred.characters, { type: 'equip', characterId: 'recipient', instanceId, slot: 'mainWeapon' })
  expect(other.ok).toBe(true)
  expect(other.characters[1].dnd5eCombatState?.activeEffects).toHaveLength(1)
  expect(dnd5eActiveMagicWeaponBonus(other.characters[1].dnd5eCombatState?.activeEffects, DND5E_LONGSWORD.id)).toBe(0)
  expect(other.characters[1].dnd5eCombatState?.activeEffects?.[0].duration).toMatchObject({ remainingRounds: 7 })
  const expired = advanceDnd5eCampaignTimedActiveEffects(other.characters[1], 1)
  expect(expired.dnd5eCombatState?.activeEffects ?? []).toHaveLength(0)
  const restored = other.characters.map(c => normalizeCharacter(JSON.parse(JSON.stringify(c))))
  expect(dnd5eActiveMagicWeaponBonus(restored[1].dnd5eCombatState?.activeEffects, DND5E_LONGSWORD.id)).toBe(0)
  const returned = applyDnd5eInventoryMutation(restored, { type: 'transfer', characterId: 'recipient', instanceId, targetCharacterId: 'source', quantity: 1 })
  expect(returned.ok).toBe(true)
  const reequipped = applyDnd5eInventoryMutation(returned.characters, { type: 'equip', characterId: 'source', instanceId, slot: 'mainWeapon' })
  expect(reequipped.ok).toBe(true)
  expect(dnd5eActiveMagicWeaponBonus(reequipped.characters[0].dnd5eCombatState?.activeEffects, DND5E_LONGSWORD.id)).toBe(3)
  expect(reequipped.characters[0].dnd5eCombatState?.activeEffects?.[0].duration).toMatchObject({ remainingRounds: 7 })
})
