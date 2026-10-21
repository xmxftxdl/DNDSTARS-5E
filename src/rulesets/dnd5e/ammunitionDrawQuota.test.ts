import {it,expect} from 'vitest'
import {normalizeCharacter} from '../../store/characters'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {applyDnd5eInventoryMutation} from './items'
import {createDnd5eMechanicalEffect} from './activeEffects'
import {DND5E_LONGBOW} from './equipment'
it.each(['withdraw','transfer','mixed-transfer','invalid-transfer','same-container','legacy','suspended'] as const)('settles opt-in ammunition draw quota only for completed draws: %s',mode=>{
 const dispose=registerDnd5eRulesPlugin({manifest:{id:'test.draw-quota',name:'Quota',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){api.registerItem({id:'quiver',name:'Quiver',category:'container',icon:'container',description:'Synthetic',rulesText:'Synthetic',stackable:false,containerCapacityWeightLb:10})}})
 try{
  let chars=['owner','recipient'].map(id=>normalizeCharacter({id,name:id,equipment:{mainWeapon:DND5E_LONGBOW}}))
  chars=applyDnd5eInventoryMutation(chars,{type:'grant',characterId:'owner',templateId:'test.draw-quota:quiver',quantity:1}).characters
  chars=applyDnd5eInventoryMutation(chars,{type:'grant',characterId:'owner',templateId:'srd-5.1:item:arrows',quantity:20}).characters
  const quiver=chars[0].dnd5eInventory!.entries.find(e=>e.item.category==='container')!,ammo=chars[0].dnd5eInventory!.entries.find(e=>e.item.ammunitionKind==='arrow')!
  chars=applyDnd5eInventoryMutation(chars,{type:'set-container',characterId:'owner',instanceId:ammo.instanceId,containerInstanceId:quiver.instanceId}).characters
  const effect=createDnd5eMechanicalEffect({id:'quota',definitionId:'quota',label:'Quota',targetId:'owner',source:{kind:'spell',actorId:'owner-token',characterId:'owner',rulesId:'quota'},duration:{type:'concentration',sourceActorId:'owner-token',concentrationId:'quota',remainingRounds:600},modifiers:{weaponEnchantment:{weaponId:'container:'+quiver.instanceId,inventoryInstanceId:quiver.instanceId,ammunitionContainer:true,consumeOnDraw:mode==='legacy'?undefined:true,weaponIds:[DND5E_LONGBOW.id],remainingAttacks:12,attackAndDamageBonus:0,bonusDamage:{count:1,sides:6,type:'fire'}}}})
  if(mode==='suspended')effect.suspendedBy=['test-suppression']
  chars[0].concentrating=true;chars[0].dnd5eCombatState={schemaVersion:2,concentrationSpellId:'quota',activeEffects:[effect]}
  if(mode==='mixed-transfer')chars=applyDnd5eInventoryMutation(chars,{type:'grant',characterId:'recipient',templateId:'srd-5.1:item:arrows',quantity:5}).characters
  const before=structuredClone(chars)
  const result=applyDnd5eInventoryMutation(chars,mode.includes('transfer')?{type:'transfer',characterId:'owner',targetCharacterId:'recipient',instanceId:ammo.instanceId,quantity:mode==='invalid-transfer'?21:3}:{type:'set-container',characterId:'owner',instanceId:ammo.instanceId,containerInstanceId:mode==='same-container'?quiver.instanceId:undefined})
  expect(result.ok).toBe(mode!=='invalid-transfer');expect(chars).toEqual(before)
  const retained=result.characters[0].dnd5eCombatState?.activeEffects?.find(e=>e.id===effect.id)
  if(mode==='withdraw'){expect(retained).toBeUndefined();expect(result.characters[0].concentrating).toBe(false);expect(result.characters[0].dnd5eCombatState?.concentrationSpellId).toBeUndefined()}
  else {expect(retained?.modifiers?.weaponEnchantment?.remainingAttacks).toBe(mode==='transfer'||mode==='mixed-transfer'?9:12);expect(result.characters[0].concentrating).toBe(true)}
  if(mode==='transfer'||mode==='mixed-transfer'){
   let transferred=JSON.parse(JSON.stringify(result.characters)) as typeof chars
   const loose=transferred[1].dnd5eInventory!.entries.find(e=>e.item.ammunitionKind==='arrow')!
   const drawn=transferred[1].dnd5eCombatState?.activeEffects?.find(e=>e.modifiers?.weaponEnchantment?.ammunitionStack)
   expect(drawn?.modifiers?.weaponEnchantment).toMatchObject({inventoryInstanceId:loose.instanceId,remainingAttacks:3,drawSourceEffectId:effect.id})
   for(const quantity of [1,2]){
    const returned=applyDnd5eInventoryMutation(transferred,{type:'transfer',characterId:'recipient',targetCharacterId:'owner',instanceId:loose.instanceId,quantity})
    expect(returned.ok).toBe(true);transferred=returned.characters
    expect(transferred[0].dnd5eCombatState?.activeEffects?.find(e=>e.id===effect.id)?.modifiers?.weaponEnchantment?.remainingAttacks).toBe(9)
    const ownerDraws=transferred[0].dnd5eCombatState?.activeEffects?.filter(e=>e.modifiers?.weaponEnchantment?.ammunitionStack)??[]
    expect(ownerDraws.reduce((sum,e)=>sum+(e.modifiers?.weaponEnchantment?.remainingAttacks??0),0)).toBe(quantity===1?1:3)
    expect(transferred[0].concentrating).toBe(true)
   }
   expect(transferred[1].dnd5eCombatState?.activeEffects?.filter(e=>e.modifiers?.weaponEnchantment?.ammunitionStack)).toEqual([])
   expect(transferred[1].dnd5eInventory?.entries.reduce((sum,e)=>sum+(e.item.ammunitionKind==='arrow'?e.quantity:0),0)).toBe(mode==='mixed-transfer'?5:0)
  }
 }finally{dispose()}
})

