import { createDnd5eMechanicalEffect } from './activeEffects'
import { migrateMapsState } from '../../store/maps'
import { reconcileDnd5eSummonedCreatures } from './summonedCreatures'
import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import type { BattleMap } from '../../store/maps'
import { prepareDnd5eMapInventoryPickup } from './mapInventoryPickup'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import { applyDnd5eInventoryMutation, applyDnd5eInventoryGrantBundle, expireDnd5eStructureInventoryItems, normalizeDnd5eInventory, dnd5eInventoryItemTemplate } from './items'
import {authorDnd5eMapInventoryItem} from './mapInventoryItemAuthoring'
import {dnd5eCompanionCarriedWeightPounds,droppedDnd5eCompanionObjects} from './companionCarriedObjects'
import { normalizeDnd5eMapObjectStateV1 } from './mapObjectState'
import {prepareDnd5eMapInventoryDrop,dnd5eInventoryEntryCanDrop} from './mapInventoryDrop'
import {consumeDnd5eCompanionAmmunition} from './companionHeldWeapon'
import { dnd5eCompanionSceneWornArmor, prepareDnd5eCompanionArmorChange } from './companionWornArmor'
import { getDnd5eSrdMonster } from './monsters'

it.each(['permanent', 'concentration', 'ended', 'missing-source'] as const)('preserves bound armor through character drop, summon wear, expiry and recovery (%s)', lifetime => {
 const input=fixture(1);input.map.tokens=input.map.tokens.slice(0,1)
 const grant=applyDnd5eInventoryMutation(input.characters,{type:'grant',characterId:'hero',templateId:'srd-5.1:equipment:dnd5e-chain-mail',quantity:1})
 expect(grant.ok).toBe(true)
 const inventory=normalizeDnd5eInventory(grant.characters[0]),entry=inventory.entries.find(e=>e.templateId==='srd-5.1:equipment:dnd5e-chain-mail')!
 const enchantment=createDnd5eMechanicalEffect({id:'armor-source',definitionId:'armor-source',label:'Armor source',targetId:'hero',
  source:{kind:'spell',actorId:'hero',characterId:'hero',rulesId:'armor-source',executionId:'armor-execution'},
  duration:lifetime==='permanent'?{type:'permanent'}:{type:'concentration',sourceActorId:'hero',concentrationId:'armor-source',remainingRounds:600},
  modifiers:{armorEnchantment:{armorId:'dnd5e-chain-mail',inventoryInstanceId:entry.instanceId,armorClassBonus:2}}})
 grant.characters[0].concentrating=lifetime!=='permanent'
 grant.characters[0].dnd5eCombatState={schemaVersion:2,concentrationSpellId:lifetime==='permanent'?undefined:'armor-source',activeEffects:[enchantment]}
 if(lifetime==='concentration'||lifetime==='ended')grant.characters[0].dnd5eCombatState.activeEffects=[enchantment,
  createDnd5eMechanicalEffect({id:'armor-cast-anchor',definitionId:'armor-cast-anchor',label:'Armor concentration',targetId:'hero',
   source:{kind:'spell',actorId:'hero',characterId:'hero',rulesId:'armor-source',executionId:'armor-execution'},
   duration:{type:'concentration',sourceActorId:'hero',concentrationId:'armor-source',remainingRounds:600}})]
 const original=structuredClone(grant.characters)
 const drop=prepareDnd5eMapInventoryDrop({map:input.map,characters:grant.characters,actorTokenId:'hero',instanceId:entry.instanceId,
  expectedInventoryRevision:inventory.revision??0,requestId:'armor-transfer',combatActive:false})
 if(!drop.ok)throw Error(drop.reason)
 expect(grant.characters).toEqual(original)
 expect(normalizeDnd5eInventory(drop.characters[0]).entries).toHaveLength(0)
 const saved=migrateMapsState(JSON.parse(JSON.stringify({maps:[drop.map]}))).maps[0]
 saved.tokens.push({...saved.tokens[0],id:'undead',characterId:undefined,type:'enemy',poolId:'srd-5.1:skeleton',hp:13,maxHp:13,dnd5eNativeArmorRemoved:true,
  dnd5eSummon:{schemaVersion:1,pluginId:'test',featureId:'danse',sourceCharacterId:'hero',sourceTokenId:'hero',createdRound:1,expiresAfterRound:600,side:'player'}})
 const ground=saved.tokens.find(t=>t.id===drop.objectTokenId)!
 const pickup=prepareDnd5eMapInventoryPickup({...input,map:saved,characters:drop.characters,actorTokenId:'undead',objectTokenId:ground.id,
  expectedReceiptId:ground.dnd5eObjectState!.inventoryItem!.receiptId,expectedQuantity:1})
 if(!pickup.ok)throw Error(pickup.reason)
 const bearer=pickup.map.tokens.find(t=>t.id==='undead')!
 const don=prepareDnd5eCompanionArmorChange({token:bearer,itemId:bearer.dnd5eCarriedObjects![0].id,proficient:true,
  combatActive:false,startedWorldMinute:100,completedWorldMinute:110})!
 expect(don.complete).toBe(true);bearer.dnd5eCarriedObjects=don.carried
 expect(dnd5eCompanionSceneWornArmor(bearer,getDnd5eSrdMonster(bearer.poolId!),pickup.map,pickup.characters)?.armorClass).toBe(lifetime==='missing-source'?16:18)
 if(lifetime==='ended'){
  pickup.characters[0].concentrating=false
  pickup.characters[0].dnd5eCombatState!.concentrationSpellId=undefined
  pickup.characters[0].dnd5eCombatState!.activeEffects=[]
  expect(dnd5eCompanionSceneWornArmor(bearer,getDnd5eSrdMonster(bearer.poolId!),pickup.map,pickup.characters)?.armorClass).toBe(16)
 }
 const expired=reconcileDnd5eSummonedCreatures({map:pickup.map,characters:pickup.characters,round:601})
 expect(expired.map.tokens.some(t=>t.id==='undead')).toBe(false)
 const possessions=expired.map.tokens.filter(t=>t.dnd5eObjectState?.inventoryItem?.instance?.instanceId===entry.instanceId)
 expect(possessions).toHaveLength(1)
 const dropped=possessions[0]
 const recovered=prepareDnd5eMapInventoryPickup({...input,map:expired.map,characters:pickup.characters,objectTokenId:dropped.id,
  expectedReceiptId:dropped.dnd5eObjectState!.inventoryItem!.receiptId,expectedQuantity:1})
 if(!recovered.ok)throw Error(recovered.reason)
 expect(normalizeDnd5eInventory(recovered.characters[0]).entries).toEqual([expect.objectContaining({instanceId:entry.instanceId,quantity:1})])
 expect(recovered.map.tokens).toHaveLength(1)
 expect(recovered.characters[0].dnd5eCombatState?.activeEffects?.filter(e=>e.modifiers?.armorEnchantment?.inventoryInstanceId===entry.instanceId).length??0).toBe(lifetime==='ended'||lifetime==='missing-source'?0:1)
})

it('rejects weapon stacks disguised as ammunition and mismatched physical stack counts',()=>{
 const input=fixture(2)
 const grant=applyDnd5eInventoryMutation(input.characters,{type:'grant',characterId:'hero',templateId:'srd-5.1:equipment:dnd5e-longsword',quantity:1})
 const entry=structuredClone(normalizeDnd5eInventory(grant.characters[0]).entries[0])
 entry.quantity=2;entry.item.ammunitionKind='arrow'
 input.map.tokens[1].dnd5eObjectState={schemaVersion:1,inventoryItem:{templateId:entry.templateId,quantity:2,receiptId:'scene:water',instance:entry}}
 expect(dnd5eInventoryEntryCanDrop(entry)).toBe(false)
 expect(prepareDnd5eMapInventoryPickup(input)).toMatchObject({ok:false,reason:'pickup-object-unsupported'})
 entry.quantity=1
 expect(normalizeDnd5eMapObjectStateV1(input.map.tokens[1].dnd5eObjectState)).toBeUndefined()
})

it('keeps an ammunition stack identity through drop, companion pickup, consumption and recovery',()=>{
 const input=fixture(1)
 input.map.tokens=input.map.tokens.slice(0,1)
 const grant=applyDnd5eInventoryMutation(input.characters,{type:'grant',characterId:'hero',templateId:'srd-5.1:item:arrows',quantity:5})
 expect(grant.ok).toBe(true)
 const inventory=normalizeDnd5eInventory(grant.characters[0]),entry=inventory.entries[0]
 const drop=prepareDnd5eMapInventoryDrop({map:input.map,characters:grant.characters,actorTokenId:'hero',instanceId:entry.instanceId,
  expectedInventoryRevision:inventory.revision??0,requestId:'arrow-stack',combatActive:false})
 if(!drop.ok)throw Error(drop.reason)
 const bearer={...input.map.tokens[0],id:'undead',characterId:undefined,type:'enemy' as const,poolId:'srd-5.1:skeleton',hp:13,maxHp:13,
  dnd5eSummon:{schemaVersion:1 as const,pluginId:'test',featureId:'danse',sourceCharacterId:'hero',sourceTokenId:'hero',createdRound:1,expiresAfterRound:600,side:'player' as const}}
 drop.map.tokens.push(bearer)
 const ground=drop.map.tokens.find(token=>token.id===drop.objectTokenId)!
 const picked=prepareDnd5eMapInventoryPickup({...input,map:drop.map,characters:drop.characters,actorTokenId:'undead',objectTokenId:ground.id,
  expectedReceiptId:ground.dnd5eObjectState!.inventoryItem!.receiptId,expectedQuantity:5})
 if(!picked.ok)throw Error(picked.reason)
 expect(picked.map.tokens.some(token=>token.id===ground.id)).toBe(false)
 const saved=migrateMapsState(JSON.parse(JSON.stringify({maps:[picked.map]}))).maps[0]
 const held=saved.tokens.find(token=>token.id==='undead')!
 expect(held.dnd5eCarriedObjects![0].objectState.inventoryItem).toMatchObject({quantity:5,instance:{instanceId:entry.instanceId,quantity:5}})
 held.dnd5eCarriedObjects!.push({id:'bow',pickupReceipt:'bow',label:'Bow',wieldedWeapon:{proficient:true},objectState:{schemaVersion:1,wornOrCarried:true,
  inventoryItem:{templateId:'srd-5.1:equipment:dnd5e-shortbow',quantity:1,receiptId:'bow'}}})
 const fired=consumeDnd5eCompanionAmmunition(held,['held-weapon:bow'])
 if(!fired.ok)throw Error('No ammunition')
 held.dnd5eCarriedObjects=fired.carried
 const drops=droppedDnd5eCompanionObjects(held)
 const arrows=drops.find(token=>token.dnd5eObjectState?.inventoryItem?.templateId===entry.templateId)!
 const restoredMap=migrateMapsState(JSON.parse(JSON.stringify({maps:[{...saved,tokens:[saved.tokens.find(token=>token.id==='hero')!,...drops]}]}))).maps[0]
 const recovered=prepareDnd5eMapInventoryPickup({...input,map:restoredMap,characters:drop.characters,objectTokenId:arrows.id,
  expectedReceiptId:arrows.dnd5eObjectState!.inventoryItem!.receiptId,expectedQuantity:4})
 if(!recovered.ok)throw Error(recovered.reason)
 expect(normalizeDnd5eInventory(recovered.characters[0]).entries).toEqual([expect.objectContaining({instanceId:entry.instanceId,quantity:4})])
 expect(recovered.map.tokens.some(token=>token.id===arrows.id)).toBe(false)
})

it('removes the equipment projection when a structure-bound weapon disappears',()=>{
 const input=fixture(),binding={schemaVersion:1 as const,mapId:input.map.id,structureId:'fortress:a'}
 const granted=applyDnd5eInventoryGrantBundle(input.characters,{characterId:'hero',receiptId:'bound-weapon',grants:[
  {templateId:'srd-5.1:equipment:dnd5e-longsword',quantity:1,structureBinding:binding}]})
 expect(granted.ok).toBe(true)
 const entry=normalizeDnd5eInventory(granted.characters[0]).entries[0]
 const equipped=applyDnd5eInventoryMutation(granted.characters,{type:'equip',characterId:'hero',instanceId:entry.instanceId,slot:'mainWeapon'})
 expect(equipped.ok).toBe(true)
 expect(equipped.characters[0].equipment?.mainWeapon).toBeDefined()
 const expired=expireDnd5eStructureInventoryItems(equipped.characters[0],[binding])
 expect(expired.equipment?.mainWeapon).toBeUndefined()
 expect(normalizeDnd5eInventory(expired).entries).toHaveLength(0)
 expect(equipped.characters[0].equipment?.mainWeapon).toBeDefined()
})

it('removes bound inventory and released objects without erasing unrelated recoverable objects',()=>{
 const input=fixture(1),binding={schemaVersion:1 as const,mapId:input.map.id,structureId:'fortress:a'}
 input.map.tokens[1].dnd5eObjectState!.structureBinding=binding
 const picked=prepareDnd5eMapInventoryPickup(input)
 if(!picked.ok)throw Error(picked.reason)
 const character=picked.characters[0],entry=normalizeDnd5eInventory(character).entries[0]
 character.dnd5eInventory!.releasedObjects=[{...entry,instanceId:'released-bound'},
  {...entry,instanceId:'released-ordinary',structureBinding:undefined}]
 character.dnd5eInventory!.spellMaterialEscrows=[{id:'escrow',sourceSpellId:'test',sourceEffectId:'test',label:'Reserved',status:'reserved',
  entries:[{...entry,instanceId:'reserved-bound'},{...entry,instanceId:'reserved-ordinary',structureBinding:undefined}]}]
 const before=structuredClone(character),cleaned=expireDnd5eStructureInventoryItems(character,[binding])
 const inventory=normalizeDnd5eInventory(cleaned)
 expect(inventory.entries).toEqual([])
 expect(inventory.releasedObjects?.map(item=>item.instanceId)).toEqual(['released-ordinary'])
 expect(inventory.spellMaterialEscrows?.[0].entries.map(item=>item.instanceId)).toEqual(['reserved-ordinary'])
 expect(expireDnd5eStructureInventoryItems(cleaned,[binding])).toBe(cleaned)
 expect(character).toEqual(before)
})

it('keeps mundane and different-structure stacks separate and rejects malformed origin grants',()=>{
 const input=fixture(),templateId='srd-5.1:item:potion-of-healing'
 const binding={schemaVersion:1 as const,mapId:input.map.id,structureId:'fortress:a'}
 const grant=applyDnd5eInventoryGrantBundle(input.characters,{characterId:'hero',receiptId:'origin-stacks',grants:[
  {templateId,quantity:1},{templateId,quantity:1,structureBinding:binding},
  {templateId,quantity:2,structureBinding:binding},{templateId,quantity:1,structureBinding:{...binding,structureId:'fortress:b'}}]})
 expect(grant.ok).toBe(true)
 const entries=normalizeDnd5eInventory(grant.characters[0]).entries
 expect(entries).toHaveLength(3)
 expect(entries.find(e=>e.structureBinding?.structureId==='fortress:a')?.quantity).toBe(3)
 expect(entries.find(e=>!e.structureBinding)?.quantity).toBe(1)
 expect(applyDnd5eInventoryGrantBundle(input.characters,{characterId:'hero',receiptId:'invalid-origin',grants:[
  {templateId,quantity:1,structureBinding:{...binding,mapId:''}}]}).ok).toBe(false)
})

it('retains structure origin through pickup, reload, transfer and physical drop',()=>{
 const input=fixture(1),binding={schemaVersion:1 as const,mapId:input.map.id,structureId:'fortress:a'}
 input.map.tokens[1].dnd5eObjectState!.structureBinding=binding
 const before=structuredClone(input),picked=prepareDnd5eMapInventoryPickup(input)
 if(!picked.ok)throw Error(picked.reason)
 const restored=normalizeCharacter(JSON.parse(JSON.stringify(picked.characters[0])))
 const entry=normalizeDnd5eInventory(restored).entries[0]
 expect(entry.structureBinding).toEqual(binding)
 const other=normalizeCharacter({...input.characters[0],id:'other',name:'Other'})
 const moved=applyDnd5eInventoryMutation([restored,other],{type:'transfer',characterId:'hero',targetCharacterId:'other',instanceId:entry.instanceId,quantity:1})
 expect(moved.ok).toBe(true)
 const inventory=normalizeDnd5eInventory(moved.characters[1])
 expect(inventory.entries[0].structureBinding).toEqual(binding)
 const dropped=prepareDnd5eMapInventoryDrop({map:{...picked.map,tokens:picked.map.tokens.map(t=>({...t,characterId:'other'}))},
  characters:moved.characters,actorTokenId:'hero',instanceId:inventory.entries[0].instanceId,
  expectedInventoryRevision:inventory.revision!,requestId:'structure-drop',combatActive:false})
 if(!dropped.ok)throw Error(dropped.reason)
 const object=normalizeDnd5eMapObjectStateV1(JSON.parse(JSON.stringify(dropped.map.tokens.find(t=>t.id===dropped.objectTokenId)!.dnd5eObjectState)))!
 expect(object.structureBinding).toEqual(binding)
 expect(object.inventoryItem!.instance!.structureBinding).toEqual(binding)
 expect(normalizeDnd5eMapObjectStateV1({...object,structureBinding:{...binding,structureId:'conflicting'}})).toBeUndefined()
 expect(normalizeDnd5eMapObjectStateV1({...object,structureBinding:{...binding,mapId:''}})).toBeUndefined()
 expect(input).toEqual(before)
})

it('preserves an original physical weapon through map reload and pickup, without re-equipping or cloning it', () => {
  const input = fixture(1)
  const templateId = 'srd-5.1:equipment:dnd5e-longsword'
  const instance = { instanceId: 'original-weapon', templateId, item: dnd5eInventoryItemTemplate(templateId)!,
    quantity: 1, acquiredAt: 1234, equippedSlot: 'mainWeapon' as const, containerInstanceId: 'former-bag',
    condition: { armorClassPenalty: 1 }, identified: true }
  input.map.tokens[1].dnd5eObjectState = { schemaVersion: 1,
    inventoryItem: { templateId, quantity: 1, receiptId: input.expectedReceiptId, instance } }
  input.map = migrateMapsState(JSON.parse(JSON.stringify({ maps: [input.map] }))).maps[0]
  expect(input.map.tokens[1].dnd5eObjectState?.inventoryItem?.instance).toEqual(instance)
  const before = structuredClone(input)
  const result = prepareDnd5eMapInventoryPickup(input)
  if (!result.ok) throw Error(result.reason)
  const entries = normalizeDnd5eInventory(result.characters[0]).entries
  expect(entries).toHaveLength(1)
  expect(entries[0]).toMatchObject({ instanceId: 'original-weapon', acquiredAt: 1234, condition: instance.condition })
  expect(entries[0].equippedSlot).toBeUndefined()
  expect(entries[0].containerInstanceId).toBeUndefined()
  expect(result.characters[0].dnd5eInventory?.revision).toBe(1)
  expect(result.map.tokens.some(t => t.id === 'water')).toBe(false)
  expect(input).toEqual(before)
  const duplicate = prepareDnd5eMapInventoryPickup({ ...input, characters: result.characters })
  expect(duplicate).toEqual({ ok: false, reason: 'pickup-instance-conflict' })
  expect(normalizeDnd5eMapObjectStateV1({ schemaVersion: 1,
    inventoryItem: { templateId, quantity: 2, receiptId: 'invalid-stack', instance } })).toBeUndefined()
  expect(normalizeDnd5eMapObjectStateV1({ schemaVersion: 1,
    inventoryItem: { templateId, quantity: 1, receiptId: 'invalid-template', instance: { ...instance, templateId: 'different' } } })).toBeUndefined()
})

function fixture(quantity = 2) {
  const map: BattleMap = { id: 'pickup-test', name: 'Pickup', width: 500, height: 500, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [
      { id: 'hero', characterId: 'hero', type: 'player', label: 'Hero', size: 1, x: 75, y: 75, color: '', emoji: '' },
      { id: 'water', type: 'obstacle', label: 'Water', size: 1, x: 125, y: 75, color: '', emoji: '', dnd5eObjectState: {
        schemaVersion: 1, inventoryItem: { templateId: 'srd-5.1:item:holy-water-flask', quantity, receiptId: 'scene:water' },
        consumable: { kind: 'drink', contaminants: ['poison'] },
      } },
    ] }
  return { map, characters: [normalizeCharacter({ id: 'hero', name: 'Hero', charClass: '战士', equipment: {}, maxHp: 20, currentHp: 20,
    dnd5eInventory: { schemaVersion: 1, entries: [] } })], actorTokenId: 'hero', objectTokenId: 'water',
    expectedReceiptId: 'scene:water', expectedQuantity: quantity, combatActive: false }
}

it.each(['player','companion'] as const)('removes area capture from picked possessions but preserves the remaining stack: %s',mode=>{
 const input=fixture(2),bearer=input.map.tokens[0]
 const capture={mapId:input.map.id,areaId:'whirlwind',sourceTokenId:'caster'}
 input.map.tokens[1].dnd5eObjectState!.areaCapture=capture
 if(mode==='companion'){
  bearer.characterId=undefined;bearer.type='enemy';bearer.poolId='srd-5.1:skeleton';bearer.hp=13
  bearer.dnd5eSummon={schemaVersion:1,pluginId:'test',featureId:'danse',sourceCharacterId:'hero',sourceTokenId:'caster',createdRound:1,expiresAfterRound:600,side:'player'}
 }
 const before=structuredClone(input),picked=prepareDnd5eMapInventoryPickup(input)
 expect(picked.ok).toBe(true);if(!picked.ok)throw Error(picked.reason)
 expect(picked.map.tokens.find(t=>t.id==='water')?.dnd5eObjectState).toMatchObject({areaCapture:capture,inventoryItem:{quantity:1}})
 if(mode==='companion'){
  const held=picked.map.tokens.find(t=>t.id===bearer.id)!
  expect(held.dnd5eCarriedObjects![0].objectState.areaCapture).toBeUndefined()
  // Existing saves may still contain the old copied binding; reload/drop must discard it too.
  held.dnd5eCarriedObjects![0].objectState.areaCapture=capture
  const restored=migrateMapsState(JSON.parse(JSON.stringify({maps:[picked.map]}))).maps[0].tokens.find(t=>t.id===bearer.id)!
  expect(restored.dnd5eCarriedObjects![0].objectState.areaCapture).toBeUndefined()
  expect(droppedDnd5eCompanionObjects(restored)[0].dnd5eObjectState?.areaCapture).toBeUndefined()
 }else{
  const inventory=normalizeDnd5eInventory(picked.characters[0]),entry=inventory.entries.find(e=>e.templateId==='srd-5.1:item:holy-water-flask')!
  const drop=prepareDnd5eMapInventoryDrop({map:picked.map,characters:picked.characters,actorTokenId:bearer.id,instanceId:entry.instanceId,
   expectedInventoryRevision:inventory.revision??0,requestId:'wind-drop',combatActive:false})
  expect(drop.ok).toBe(true);if(!drop.ok)throw Error(drop.reason)
  expect(drop.map.tokens.find(t=>t.id===drop.objectTokenId)?.dnd5eObjectState?.areaCapture).toBeUndefined()
 }
 expect(input).toEqual(before)
})

it.each([['dnd5e-longsword',3],['dnd5e-chain-mail',55],['dnd5e-shield',6]] as const)('picks up ordinary equipment without equipping it: %s',(equipmentId,weight)=>{
 const input=fixture(1),bearer=input.map.tokens[0],templateId='srd-5.1:equipment:'+equipmentId
 bearer.characterId=undefined;bearer.type='enemy';bearer.poolId='srd-5.1:skeleton';bearer.hp=13
 bearer.dnd5eSummon={schemaVersion:1,pluginId:'test',featureId:'danse',sourceCharacterId:'hero',sourceTokenId:'caster',createdRound:1,expiresAfterRound:600,side:'player'}
 const patch=authorDnd5eMapInventoryItem(input.map.tokens[1],templateId,1)
 expect(patch).toBeDefined()
 Object.assign(input.map.tokens[1],patch)
 input.expectedReceiptId=patch!.dnd5eObjectState!.inventoryItem!.receiptId
 const before=structuredClone(input),result=prepareDnd5eMapInventoryPickup(input)
 expect(result.ok).toBe(true);if(!result.ok)throw Error(result.reason)
 const saved=migrateMapsState(JSON.parse(JSON.stringify({maps:[result.map]}))).maps[0]
 const held=saved.tokens[0]
 expect(held.dnd5eCarriedObjects?.[0].objectState.inventoryItem).toMatchObject({templateId,quantity:1})
 expect(dnd5eCompanionCarriedWeightPounds(held.dnd5eCarriedObjects)).toBe(weight)
 expect(held.poolId).toBe(bearer.poolId)
 expect(held.dnd5eCombatState).toEqual(bearer.dnd5eCombatState)
 expect(result.characters).toEqual(input.characters)
 const dropped=droppedDnd5eCompanionObjects(held)
 expect(dropped).toHaveLength(1)
 expect(dropped[0].dnd5eObjectState?.inventoryItem).toMatchObject({templateId,quantity:1})
 expect(input).toEqual(before)
})

it.each([0,100,600,602])('uses actual stack weight for companion pickup and preserves split weight: %s',weight=>{
 const input=fixture(2),bearer=input.map.tokens[0]
 bearer.characterId=undefined;bearer.type='enemy';bearer.poolId='srd-5.1:skeleton';bearer.hp=13
 bearer.dnd5eSummon={schemaVersion:1,pluginId:'test',featureId:'danse',sourceCharacterId:'hero',sourceTokenId:'caster',createdRound:1,expiresAfterRound:600,side:'player'}
 input.map.tokens[1].dnd5eObjectState!.weightPounds=weight
 const before=structuredClone(input),first=prepareDnd5eMapInventoryPickup(input)
 expect(first.ok).toBe(weight<=600)
 if(!first.ok){expect(first.reason).toBe('pickup-too-heavy');expect(input).toEqual(before);return}
 const saved=migrateMapsState(JSON.parse(JSON.stringify({maps:[first.map]}))).maps[0]
 expect(dnd5eCompanionCarriedWeightPounds(saved.tokens[0].dnd5eCarriedObjects)).toBe(weight/2)
 expect(saved.tokens[1].dnd5eObjectState?.weightPounds).toBe(weight/2)
 const second=prepareDnd5eMapInventoryPickup({...input,map:saved,expectedQuantity:1})
 expect(second.ok).toBe(weight<=300)
 if(second.ok){
  const drops=droppedDnd5eCompanionObjects(second.map.tokens[0])
  expect(drops).toHaveLength(2)
  expect(drops.reduce((sum,t)=>sum+(t.dnd5eObjectState?.weightPounds??0),0)).toBe(weight)
  expect(dnd5eCompanionCarriedWeightPounds(second.map.tokens[0].dnd5eCarriedObjects)).toBe(weight)
 }else expect(second.reason).toBe('pickup-too-heavy')
 expect(input).toEqual(before)
})

it.each([0, 100, 600, 602])('preserves remaining stack weight when a character picks up before a companion: %s', weight => {
  const input = fixture(2)
  input.map.tokens[1].dnd5eObjectState!.weightPounds = weight
  const before = structuredClone(input)
  const first = prepareDnd5eMapInventoryPickup(input)
  if (!first.ok) throw Error(first.reason)
  const saved: BattleMap = JSON.parse(JSON.stringify(first.map))
  expect(saved.tokens[1].dnd5eObjectState).toMatchObject({ weightPounds: weight / 2, inventoryItem: { quantity: 1 } })
  const bearer = saved.tokens[0]
  saved.tokens.push({ ...bearer, id: 'skeleton', characterId: undefined, type: 'enemy', poolId: 'srd-5.1:skeleton', hp: 13,
    dnd5eSummon: { schemaVersion: 1, pluginId: 'test', featureId: 'danse', sourceCharacterId: 'hero', sourceTokenId: 'hero',
      createdRound: 1, expiresAfterRound: 600, side: 'player' } })
  const second = prepareDnd5eMapInventoryPickup({ ...input, map: saved, characters: first.characters, actorTokenId: 'skeleton', expectedQuantity: 1 })
  expect(second.ok).toBe(weight <= 600)
  if (second.ok) {
    const skeleton = second.map.tokens.find(t => t.id === 'skeleton')!
    expect(dnd5eCompanionCarriedWeightPounds(skeleton.dnd5eCarriedObjects)).toBe(weight / 2)
    expect(droppedDnd5eCompanionObjects(skeleton)[0].dnd5eObjectState?.weightPounds).toBe(weight / 2)
    expect(second.map.tokens.some(t => t.id === 'water')).toBe(false)
    expect(second.characters).toEqual(first.characters)
  } else expect(second.reason).toBe('pickup-too-heavy')
  expect(input).toEqual(before)
})

it('retains one vessel capacity, fill and lid state through pickup, reload and transfer without merging vessels', () => {
  const input = fixture(1)
  const water = { schemaVersion: 1 as const, open: false, capacityGallons: 1, waterGallons: 0.125 }
  input.map.tokens[1].dnd5eObjectState!.waterContainer = water
  const result = prepareDnd5eMapInventoryPickup(input)
  expect(result.ok).toBe(true)
  if (!result.ok) throw Error(result.reason)
  const restored = normalizeCharacter(JSON.parse(JSON.stringify(result.characters[0])))
  const entry = normalizeDnd5eInventory(restored).entries.find(e => e.waterContainer)!
  expect(entry.waterContainer).toEqual(water)
  expect(entry.contaminants).toEqual(['poison'])
  const other = normalizeCharacter({ id: 'other', name: 'Other', charClass: '战士', equipment: {}, maxHp: 20, currentHp: 20, dnd5eInventory: { schemaVersion: 1, entries: [] } })
  const moved = applyDnd5eInventoryMutation([restored, other], { type: 'transfer', characterId: 'hero', targetCharacterId: 'other', instanceId: entry.instanceId, quantity: 1 })
  expect(moved.ok).toBe(true)
  expect(normalizeDnd5eInventory(moved.characters[1]).entries[0]).toMatchObject({ quantity: 1, waterContainer: water, contaminants: ['poison'] })
  const pile = fixture(2)
  pile.map.tokens[1].dnd5eObjectState!.waterContainer = water
  expect(prepareDnd5eMapInventoryPickup(pile)).toMatchObject({ ok: false, reason: 'pickup-object-unsupported' })
})

it('prepares coupled map/inventory changes, retains pollution, rejects replay and removes only the last unit', () => {
  const input = fixture(), before = structuredClone(input)
  const first = prepareDnd5eMapInventoryPickup(input)
  expect(first.ok).toBe(true)
  if (!first.ok) throw Error(first.reason)
  expect(input).toEqual(before)
  expect(first.characters[0].dnd5eInventory?.entries[0]).toMatchObject({ quantity: 1, contaminants: ['poison'] })
  expect(first.map.tokens[1].dnd5eObjectState?.inventoryItem?.quantity).toBe(1)
  expect(prepareDnd5eMapInventoryPickup({ ...input, map: first.map, characters: first.characters })).toMatchObject({ ok: false, reason: 'pickup-object-changed' })
  expect(prepareDnd5eMapInventoryPickup({ ...input, characters: first.characters })).toMatchObject({ ok: false, reason: 'pickup-already-completed' })
  const last = prepareDnd5eMapInventoryPickup({ ...input, map: first.map, characters: first.characters, expectedQuantity: 1 })
  expect(last.ok).toBe(true)
  if (!last.ok) throw Error(last.reason)
  expect(last.map.tokens.map(t => t.id)).toEqual(['hero'])
  expect(last.characters[0].dnd5eInventory?.entries[0].quantity).toBe(2)
})

it('spends free interaction then action and rejects exhausted or wrong-turn pickups', () => {
  const input = fixture(), economy = createDnd5eTurnEconomyCounts('turn')
  const run = (turnEconomy = economy, currentTokenId = 'hero') => prepareDnd5eMapInventoryPickup({ ...input,
    combatActive: true, combat: { currentTokenId, turnEconomy } })
  const free = run()
  expect(free).toMatchObject({ ok: true, turnEconomy: { objectInteraction: { current: 0 }, action: { current: 1 } } })
  economy.objectInteraction!.current = 0
  expect(run()).toMatchObject({ ok: true, turnEconomy: { action: { current: 0 } } })
  economy.action.current = 0
  expect(run()).toMatchObject({ ok: false, reason: 'pickup-action-unavailable' })
  expect(run(economy, 'other')).toMatchObject({ ok: false, reason: 'pickup-invalid-turn' })
})

it('rejects distant, unconscious and stale-object requests without mutating state', () => {
  const far = fixture(); far.map.tokens[1].x = 375
  expect(prepareDnd5eMapInventoryPickup(far)).toMatchObject({ ok: false, reason: 'pickup-out-of-reach' })
  const down = fixture(); down.characters[0].currentHp = 0
  expect(prepareDnd5eMapInventoryPickup(down)).toMatchObject({ ok: false, reason: 'pickup-actor-unavailable' })
  expect(prepareDnd5eMapInventoryPickup({ ...fixture(), expectedReceiptId: 'forged' })).toMatchObject({ ok: false, reason: 'pickup-object-changed' })
})

it('keeps picked-up items on the companion through save and drops them when animation ends',()=>{
  const input=fixture(2)
  const bearer=input.map.tokens[0]
  bearer.characterId=undefined;bearer.type='enemy';bearer.poolId='srd-5.1:skeleton';bearer.hp=13;bearer.maxHp=13
  bearer.dnd5eSummon={schemaVersion:1,pluginId:'test',featureId:'danse',sourceCharacterId:'hero',sourceTokenId:'caster',
    createdRound:1,expiresAfterRound:600,side:'player',commandPolicy:'persistent-order',
    animatedCorpse:{id:'body',label:'Body',type:'enemy',poolId:'srd-5.1:goblin',size:1,x:75,y:75,hp:0,color:'',emoji:''}}
  const before=structuredClone(input)
  const first=prepareDnd5eMapInventoryPickup(input)
  expect(first.ok).toBe(true);if(!first.ok)throw Error(first.reason)
  expect(first.characters).toEqual(input.characters)
  const saved=migrateMapsState(JSON.parse(JSON.stringify({maps:[first.map]}))).maps[0]
  expect(saved.tokens[0].dnd5eCarriedObjects).toHaveLength(1)
  expect(saved.tokens[0].dnd5eCarriedObjects![0].objectState.consumable?.contaminants).toEqual(['poison'])
  const stale={...saved,tokens:[saved.tokens[0],input.map.tokens[1]]}
  expect(prepareDnd5eMapInventoryPickup({...input,map:stale})).toMatchObject({ok:false,reason:'pickup-already-completed'})
  const second=prepareDnd5eMapInventoryPickup({...input,map:saved,expectedQuantity:1})
  expect(second.ok).toBe(true);if(!second.ok)throw Error(second.reason)
  expect(second.map.tokens[0].dnd5eCarriedObjects).toHaveLength(2)
  expect(second.map.tokens).toHaveLength(1)
  second.map.tokens[0].x=225
  const ended=reconcileDnd5eSummonedCreatures({map:second.map,characters:input.characters,round:601})
  expect(ended.map.tokens.find(t=>t.id==='body')).toMatchObject({hp:0,x:225})
  const drops=ended.map.tokens.filter(t=>t.type==='obstacle')
  expect(drops).toHaveLength(2)
  expect(new Set(drops.map(t=>t.id)).size).toBe(2)
  for(const drop of drops)expect(drop).toMatchObject({x:225,dnd5eObjectState:{wornOrCarried:false,inventoryItem:{quantity:1},consumable:{contaminants:['poison']}}})
  const restored=migrateMapsState(JSON.parse(JSON.stringify({maps:[ended.map]}))).maps[0]
  expect(reconcileDnd5eSummonedCreatures({map:restored,characters:input.characters,round:602}).map).toEqual(restored)
  expect(input).toEqual(before)
})

it.each(['uncontrolled','dead','far','no-action'] as const)('rejects invalid companion pickup: %s',mode=>{
  const input=fixture(1),bearer=input.map.tokens[0]
  bearer.characterId=undefined;bearer.type='enemy';bearer.hp=mode==='dead'?0:13
  bearer.dnd5eSummon={schemaVersion:1,pluginId:'test',featureId:'danse',sourceCharacterId:'hero',sourceTokenId:'caster',
    createdRound:1,expiresAfterRound:600,side:'player',controlEnded:mode==='uncontrolled'||undefined}
  if(mode==='far')bearer.x=475
  const economy=createDnd5eTurnEconomyCounts('turn');economy.action.current=0;economy.objectInteraction!.current=0
  const before=structuredClone(input)
  expect(prepareDnd5eMapInventoryPickup({...input,combatActive:mode==='no-action',combat:{currentTokenId:bearer.id,turnEconomy:economy}}).ok).toBe(false)
  expect(input).toEqual(before)
})

it('retains physical surface through pickup, reload, transfer and physical drop',()=>{
 const input=fixture(1),binding={material:'stone' as const,widthFeet:0.5,lengthFeet:0.75,heightFeet:0.25,rotationDegrees:90}
 input.map.tokens[1].dnd5eObjectState!.surfaceProfile=binding
 const before=structuredClone(input),picked=prepareDnd5eMapInventoryPickup(input)
 if(!picked.ok)throw Error(picked.reason)
 const restored=normalizeCharacter(JSON.parse(JSON.stringify(picked.characters[0])))
 const entry=normalizeDnd5eInventory(restored).entries[0]
 expect(entry.surfaceProfile).toEqual({...binding,surfaceId:input.objectTokenId})
 const other=normalizeCharacter({...input.characters[0],id:'other',name:'Other'})
 const moved=applyDnd5eInventoryMutation([restored,other],{type:'transfer',characterId:'hero',targetCharacterId:'other',instanceId:entry.instanceId,quantity:1})
 expect(moved.ok).toBe(true)
 const inventory=normalizeDnd5eInventory(moved.characters[1])
 expect(inventory.entries[0].surfaceProfile).toEqual({...binding,surfaceId:input.objectTokenId})
 const dropped=prepareDnd5eMapInventoryDrop({map:{...picked.map,tokens:picked.map.tokens.map(t=>({...t,characterId:'other'}))},
  characters:moved.characters,actorTokenId:'hero',instanceId:inventory.entries[0].instanceId,
  expectedInventoryRevision:inventory.revision!,requestId:'structure-drop',combatActive:false})
 if(!dropped.ok)throw Error(dropped.reason)
 const object=normalizeDnd5eMapObjectStateV1(JSON.parse(JSON.stringify(dropped.map.tokens.find(t=>t.id===dropped.objectTokenId)!.dnd5eObjectState)))!
 expect(object.surfaceProfile).toEqual({...binding,surfaceId:input.objectTokenId})
 expect(object.inventoryItem!.instance!.surfaceProfile).toEqual({...binding,surfaceId:input.objectTokenId})
 expect(input).toEqual(before)
})

it('keeps physical surface grants distinct and rejects malformed surface data',()=>{
 const input=fixture(),templateId='srd-5.1:item:potion-of-healing'
 const surfaceProfile={material:'stone' as const,widthFeet:0.5,lengthFeet:0.5,heightFeet:0.25,rotationDegrees:0}
 const result=applyDnd5eInventoryGrantBundle(input.characters,{characterId:'hero',receiptId:'surface-items',grants:[
  {templateId,quantity:1},{templateId,quantity:1,surfaceProfile},{templateId,quantity:1,surfaceProfile}]})
 expect(result.ok).toBe(true)
 const entries=normalizeDnd5eInventory(result.characters[0]).entries
 expect(entries).toHaveLength(3)
 expect(entries.filter(entry=>entry.surfaceProfile)).toHaveLength(2)
 expect(applyDnd5eInventoryGrantBundle(input.characters,{characterId:'hero',receiptId:'bad-surface',grants:[
  {templateId,quantity:1,surfaceProfile:{...surfaceProfile,heightFeet:0}}]}).ok).toBe(false)
})

it('rebinds a saved surface mark after pickup and drop without cloning it onto the remainder',async()=>{
 const {createEmptyMapGeometry}=await import('../../lib/mapGeometry')
 const {mapGeometryWithObjectSurfaces}=await import('./mapObjectSurfaceGeometry')
 const {selectHorizontalMaterialSurface}=await import('./horizontalMaterialSurface')
 const {projectAttachedSurfaceArea}=await import('./attachedSurfaceArea')
 const input=fixture(2),object=input.map.tokens.find(t=>t.id===input.objectTokenId)!
 object.dnd5eObjectState!.surfaceProfile={material:'stone',widthFeet:5,lengthFeet:5,heightFeet:1,rotationDegrees:0}
 const geometry=createEmptyMapGeometry(input.map.id,1),proxy=mapGeometryWithObjectSurfaces(input.map,geometry).obstacles[0]
 const horizontalSurface=selectHorizontalMaterialSurface({geometry:mapGeometryWithObjectSurfaces(input.map,geometry),corners:proxy.points,elevationFeet:1,pixelsPerFoot:input.map.gridSize/(input.map.feetPerCell??5),materials:['stone']})!
 expect(horizontalSurface).toBeDefined()
 const area:any={id:'mark',label:'Mark',cells:[{col:1,row:1}],visual:{preset:'surface-color',horizontalSurface},expiresAtWorldMinute:160,sourceLimit:{groupId:'mold-earth-lasting',maximum:2}}
 const before=JSON.stringify(area)
 const picked=prepareDnd5eMapInventoryPickup(input)
 if(!picked.ok)throw Error(picked.reason)
 expect(projectAttachedSurfaceArea(area,picked.map,geometry)).toBeUndefined()
 const inventory=normalizeDnd5eInventory(picked.characters[0]),entry=inventory.entries[0]
 expect(entry.surfaceProfile?.surfaceId).toBe(object.id)
 expect(picked.map.tokens.find(t=>t.id===object.id)!.dnd5eObjectState!.surfaceProfile!.surfaceId).not.toBe(object.id)
 const dropped=prepareDnd5eMapInventoryDrop({map:picked.map,characters:picked.characters,actorTokenId:input.actorTokenId,instanceId:entry.instanceId,expectedInventoryRevision:inventory.revision!,requestId:'surface-drop',combatActive:false})
 if(!dropped.ok)throw Error(dropped.reason)
 const restored=projectAttachedSurfaceArea(area,dropped.map,geometry)!
 expect(restored).toBeDefined()
 expect(restored.expiresAtWorldMinute).toBe(160)
 expect(restored.sourceLimit).toEqual(area.sourceLimit)
 expect(restored.visual!.horizontalSurface!.entityId).toBe('surface-object:'+object.id)
 expect(JSON.stringify(area)).toBe(before)
})


it('moves a nested container intact through ground, companion, expiry drops and character recovery',()=>{
 const input=fixture(1);input.map.tokens=input.map.tokens.slice(0,1)
 let characters=input.characters
 for(const [templateId,quantity] of [['srd-5.1:item:chest',1],['srd-5.1:item:backpack',1],['srd-5.1:item:arrows',5]] as const){
  const r=applyDnd5eInventoryMutation(characters,{type:'grant',characterId:'hero',templateId,quantity});expect(r.ok).toBe(true);characters=r.characters
 }
 const entries=normalizeDnd5eInventory(characters[0]).entries
 const chest=entries.find(e=>e.templateId.endsWith(':chest'))!,bag=entries.find(e=>e.templateId.endsWith(':backpack'))!,arrows=entries.find(e=>e.templateId.endsWith(':arrows'))!
 for(const [instanceId,containerInstanceId] of [[bag.instanceId,chest.instanceId],[arrows.instanceId,bag.instanceId]]){
  const r=applyDnd5eInventoryMutation(characters,{type:'set-container',characterId:'hero',instanceId,containerInstanceId});expect(r.ok).toBe(true);characters=r.characters
 }
 characters[0].dnd5eCombatState={schemaVersion:2,activeEffects:[createDnd5eMechanicalEffect({id:'packed-arrows',definitionId:'packed-arrows',label:'Packed arrows',targetId:'hero',
  source:{kind:'spell',actorId:'hero',rulesId:'test'},duration:{type:'permanent'},modifiers:{weaponEnchantment:{weaponId:'ammunition:'+arrows.instanceId,
   inventoryInstanceId:arrows.instanceId,ammunitionStack:true,drawSourceEffectId:'test-source',remainingAttacks:4,attackAndDamageBonus:1}}})]}
 const before=JSON.stringify(characters),original=normalizeDnd5eInventory(characters[0])
 const drop=prepareDnd5eMapInventoryDrop({map:input.map,characters,actorTokenId:'hero',instanceId:chest.instanceId,expectedInventoryRevision:original.revision!,requestId:'nested-bag',combatActive:false})
 if(!drop.ok)throw Error(drop.reason)
 expect(JSON.stringify(characters)).toBe(before)
 expect(normalizeDnd5eInventory(drop.characters[0]).entries).toHaveLength(0)
 const saved=migrateMapsState(JSON.parse(JSON.stringify({maps:[drop.map]}))).maps[0]
 const ground=saved.tokens.find(t=>t.id===drop.objectTokenId)!
 expect(ground.dnd5eObjectState!.inventoryItem!.contents).toHaveLength(2)
 expect(ground.dnd5eObjectState!.inventoryItem!.boundEffects?.[0]?.modifiers?.weaponEnchantment?.remainingAttacks).toBe(4)
 const expectedWeight=original.entries.reduce((sum,e)=>sum+(e.item.weightLb??0)*e.quantity,0)
 expect(ground.dnd5eObjectState!.weightPounds).toBe(expectedWeight)
 const malformed=structuredClone(ground.dnd5eObjectState!);malformed.inventoryItem!.contents![0].containerInstanceId=arrows.instanceId
 expect(normalizeDnd5eMapObjectStateV1(malformed)).toBeUndefined()
 const bearer={...saved.tokens[0],id:'undead',characterId:undefined,type:'enemy' as const,poolId:'srd-5.1:skeleton',hp:13,maxHp:13,
  dnd5eSummon:{schemaVersion:1 as const,pluginId:'test',featureId:'danse',sourceCharacterId:'hero',sourceTokenId:'hero',createdRound:1,expiresAfterRound:600,side:'player' as const}}
 saved.tokens.push(bearer)
 const pickupInput={...input,map:saved,characters:drop.characters,actorTokenId:'undead',objectTokenId:ground.id,expectedReceiptId:ground.dnd5eObjectState!.inventoryItem!.receiptId,expectedQuantity:1}
 const duplicate=structuredClone(drop.characters);duplicate[0].dnd5eInventory!.entries=[{...arrows,containerInstanceId:undefined}]
 expect(prepareDnd5eMapInventoryPickup({...pickupInput,characters:duplicate})).toMatchObject({ok:false,reason:'pickup-instance-conflict'})
 const picked=prepareDnd5eMapInventoryPickup(pickupInput);if(!picked.ok)throw Error(picked.reason)
 const held=picked.map.tokens.find(t=>t.id==='undead')!
 expect(dnd5eCompanionCarriedWeightPounds(held.dnd5eCarriedObjects)).toBe(expectedWeight)
 const expired=reconcileDnd5eSummonedCreatures({map:picked.map,characters:drop.characters,round:601})
 const dropped=expired.map.tokens.find(t=>t.id.startsWith('carried:'))!
 expect(dropped).toBeDefined()
 const recovered=prepareDnd5eMapInventoryPickup({...input,map:expired.map,characters:drop.characters,objectTokenId:dropped.id,expectedReceiptId:dropped.dnd5eObjectState!.inventoryItem!.receiptId,expectedQuantity:1})
 if(!recovered.ok)throw Error(recovered.reason)
 const restored=normalizeDnd5eInventory(recovered.characters[0]).entries
 expect(restored.map(e=>[e.instanceId,e.quantity,e.containerInstanceId]).sort()).toEqual(original.entries.map(e=>[e.instanceId,e.quantity,e.containerInstanceId]).sort())
 expect(recovered.map.tokens).toHaveLength(1)
 expect(recovered.characters[0].dnd5eCombatState?.activeEffects?.find(e=>e.id==='packed-arrows')?.modifiers?.weaponEnchantment?.remainingAttacks).toBe(4)
})
