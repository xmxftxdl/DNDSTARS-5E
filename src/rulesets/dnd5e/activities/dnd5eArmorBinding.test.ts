import { validateDnd5eEffectDefinitionV1 } from './dnd5eActivityValidation'
import { describe, expect, it } from 'vitest'
import { normalizeCharacter } from '../../../store/characters'
import { createCombatantFromDnd5eCharacter, migrateCharacterToDnd5e } from '../character'
import { DND5E_CHAIN_MAIL } from '../equipment'
import { normalizeDnd5eActiveEffects, validateDnd5eActiveEffectsStrict } from '../activeEffects'
import { startDnd5eHeadlessCombat, dnd5eTargetArmorClassForAttack } from '../headlessCombatEngine'
import { registerDnd5eActivityPackage, clearDnd5eActivityRegistryForTests } from './dnd5eActivityRegistry'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { applyDnd5eInventoryMutation } from '../items'
import { prepareDnd5eMapInventoryDrop } from '../mapInventoryDrop'
import { prepareDnd5eMapInventoryPickup } from '../mapInventoryPickup'
import { dnd5eCompanionSceneWornArmor, prepareDnd5eCompanionArmorChange } from '../companionWornArmor'
import { getDnd5eSrdMonster } from '../monsters'
import type { BattleMap } from '../../../store/maps'
const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'armor-binding',name:'Armor binding',activation:{kind:'free'},target:{kind:'self'},legacySource:{kind:'feature',id:'armor-binding'},automation:automationCapabilityFromLegacyStatus('full'),effects:[{schemaVersion:1,id:'bound-armor',name:'Bound armor',stacking:'replace',duration:{kind:'rounds',rounds:10,expiresAt:'target-turn-end'},modifiers:[{kind:'armor-enchantment',armorClassBonus:{kind:'constant',value:1}}]}],outcomes:[{id:'apply',when:{kind:'always'},operations:[{kind:'apply-effect',id:'bind',target:'actor',effectId:'bound-armor'}]}]}
function state(){
 const character=normalizeCharacter({id:'hero',name:'Hero',charClass:'战士',level:1,equipment:{armor:DND5E_CHAIN_MAIL}})
 const actor=createCombatantFromDnd5eCharacter({character:migrateCharacterToDnd5e(character),controller:'player',initiativeD20:20,position:{x:0,y:0}})
 actor.pluginFeatureIds=['armor-binding']
 actor.activityEquipment!.armor!.inventoryInstanceId='first-armor'
 const enemy={...structuredClone(actor),id:'enemy',controller:'dm' as const,initiative:1}
 return startDnd5eHeadlessCombat('armor-binding',[actor,enemy])
}
const run=(current:ReturnType<typeof state>,id:string)=>resolveRegisteredDnd5eActivityInCombatV1({state:current,combatRevision:1,command:{schemaVersion:1,commandId:id,actorId:'hero',packageId:'test.armor-binding',packageVersion:'1.0.0',activityId:activity.id,targetIds:['hero'],expectedRevision:1},authoritativeRolls:{},confirmedBy:'actor'})

it.each([false,true])('transfers Host-created armor effects but rejects an unstarted concentration source (%s)',concentration=>{
 const selected:Dnd5eActivityDefinitionV1={...activity,effects:[{...activity.effects![0],duration:concentration?{kind:'concentration',maximumRounds:600}:activity.effects![0].duration,modifiers:[{kind:'armor-enchantment',itemSelection:'inventory-item',requiresNonmagical:true,armorClassBonus:{kind:'constant',value:1}}]}]}
 registerDnd5eActivityPackage({packageId:'test.armor-binding',packageVersion:'1.0.0',activities:[selected]})
 try{
  const empty=normalizeCharacter({id:'hero',name:'Hero',charClass:'战士',level:1,equipment:{},dnd5eInventory:{schemaVersion:1,entries:[]}})
  const grant=applyDnd5eInventoryMutation([empty],{type:'grant',characterId:'hero',templateId:'srd-5.1:equipment:dnd5e-chain-mail',quantity:1})
  expect(grant.ok).toBe(true)
  const owner=grant.characters[0],inventory=owner.dnd5eInventory!,entry=inventory.entries[0]
  expect(entry.equippedSlot).toBeUndefined()
  const actor=createCombatantFromDnd5eCharacter({character:migrateCharacterToDnd5e(owner),controller:'player',initiativeD20:20,position:{x:0,y:0}})
  actor.pluginFeatureIds=['armor-binding']
  const initial=startDnd5eHeadlessCombat('inventory-binding',[actor,{...structuredClone(actor),id:'enemy',initiative:1,controller:'dm'}])
  const command={schemaVersion:1 as const,commandId:'inventory-binding',actorId:'hero',packageId:'test.armor-binding',packageVersion:'1.0.0',activityId:activity.id,targetIds:['hero'],expectedRevision:1,inventoryOwnerId:'hero',inventoryInstanceId:entry.instanceId,expectedInventoryRevision:inventory.revision??0}
  const invoke=(cmd=command,current=initial)=>resolveRegisteredDnd5eActivityInCombatV1({state:current,combatRevision:1,command:cmd,inventoryOwner:owner,inventoryRoster:[owner],authoritativeRolls:{},confirmedBy:'actor'})
  const before=structuredClone(initial)
  for(const invalid of [{...command,expectedInventoryRevision:command.expectedInventoryRevision+1},{...command,inventoryInstanceId:'missing'},{...command,inventoryOwnerId:'foreign'}]){
   expect(invoke(invalid).result.ok).toBe(false)
   expect(initial).toEqual(before)
  }
  const applied=invoke()
  expect(applied.result.ok,JSON.stringify(applied)).toBe(true)
  if(applied.phase!=='commit'||!applied.result.ok)throw Error('no inventory binding commit')
  const effects=applied.result.state.combatants.hero.classState.activeEffects!
  expect(effects[0].modifiers?.armorEnchantment).toMatchObject({armorId:entry.item.equipment!.id,inventoryInstanceId:entry.instanceId,armorClassBonus:1})
  expect(invoke({...command,commandId:'repeat'},applied.result.state).result.ok).toBe(false)
  const settledActor=applied.result.state.combatants.hero
  const settledOwner={...owner,concentrating:settledActor.concentrating,dnd5eCombatState:structuredClone(settledActor.classState)}
  const map:BattleMap={id:'armor-transfer',name:'Armor transfer',width:500,height:500,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,
   tokens:[{id:'hero',characterId:'hero',label:'Hero',type:'player',x:25,y:25,size:1,color:'',emoji:''},
    {id:'undead',label:'Skeleton',type:'enemy',poolId:'srd-5.1:skeleton',hp:13,maxHp:13,x:25,y:25,size:1,color:'',emoji:'',dnd5eNativeArmorRemoved:true,
     dnd5eSummon:{schemaVersion:1,pluginId:'test',featureId:'danse',sourceCharacterId:'hero',sourceTokenId:'hero',createdRound:1,expiresAfterRound:600,side:'player'}}]}
  const dropped=prepareDnd5eMapInventoryDrop({map,characters:[settledOwner],actorTokenId:'hero',instanceId:entry.instanceId,
   expectedInventoryRevision:inventory.revision??0,requestId:'actual-activity-armor',combatActive:false})
  if(!dropped.ok)throw Error(dropped.reason)
  const picked=prepareDnd5eMapInventoryPickup({map:dropped.map,characters:dropped.characters,actorTokenId:'undead',objectTokenId:dropped.objectTokenId,
   expectedReceiptId:dropped.objectTokenId,expectedQuantity:1,combatActive:false})
  if(!picked.ok)throw Error(picked.reason)
  const bearer=picked.map.tokens.find(token=>token.id==='undead')!
  const donned=prepareDnd5eCompanionArmorChange({token:bearer,itemId:bearer.dnd5eCarriedObjects![0].id,proficient:true,combatActive:false,startedWorldMinute:0,completedWorldMinute:10})!
  expect(donned.complete).toBe(true);bearer.dnd5eCarriedObjects=donned.carried
  // A feature Activity with a concentration duration is not a spell-cast
  // transaction. It must not silently invent the missing concentration source.
  expect(settledActor.concentrating).toBe(false)
  expect(dnd5eCompanionSceneWornArmor(bearer,getDnd5eSrdMonster(bearer.poolId!),picked.map,picked.characters)?.armorClass).toBe(concentration?16:17)
  const equipped=applyDnd5eInventoryMutation([{...owner,dnd5eCombatState:{schemaVersion:2,activeEffects:effects}}],{type:'equip',characterId:'hero',instanceId:entry.instanceId,slot:'armor'})
  expect(equipped.ok).toBe(true)
  const projected=createCombatantFromDnd5eCharacter({character:migrateCharacterToDnd5e(equipped.characters[0]),controller:'player',initiativeD20:20,position:{x:0,y:0}})
  const current=startDnd5eHeadlessCombat('equipped',[projected,{...structuredClone(projected),id:'enemy',initiative:1,controller:'dm'}])
  const enhanced=dnd5eTargetArmorClassForAttack(current,'enemy','hero')
  current.combatants.hero.classState.activeEffects=[]
  expect(enhanced).toBe(dnd5eTargetArmorClassForAttack(current,'enemy','hero')+1)
 }finally{clearDnd5eActivityRegistryForTests()}
})
describe('armor binding Host lifecycle',()=>{
 it('binds once to worn armor and survives persistence without leaking to a replacement',()=>{
  registerDnd5eActivityPackage({packageId:'test.armor-binding',packageVersion:'1.0.0',activities:[activity]})
  try{
   const original=state(),base=dnd5eTargetArmorClassForAttack(original,'enemy','hero')
   const applied=run(original,'first')
   expect(applied.result.ok,JSON.stringify(applied)).toBe(true)
   if(applied.phase!=='commit'||!applied.result.ok)throw Error('no commit')
   let current=applied.result.state
   expect(dnd5eTargetArmorClassForAttack(current,'enemy','hero'),JSON.stringify({effects:current.combatants.hero.classState.activeEffects,equipment:current.combatants.hero.activityEquipment})).toBe(base+1)
   expect(dnd5eTargetArmorClassForAttack(original,'enemy','hero')).toBe(base)
   const repeated=run(current,'repeat')
   expect(repeated.result.ok).toBe(true)
   if(repeated.phase!=='commit'||!repeated.result.ok)throw Error('no repeat commit')
   current=repeated.result.state
   expect(dnd5eTargetArmorClassForAttack(current,'enemy','hero')).toBe(base+1)
   const saved=JSON.parse(JSON.stringify(current.combatants.hero.classState.activeEffects))
   expect(validateDnd5eActiveEffectsStrict(saved).issues).toEqual([])
   current.combatants.hero.classState.activeEffects=normalizeDnd5eActiveEffects(saved)
   expect(dnd5eTargetArmorClassForAttack(current,'enemy','hero')).toBe(base+1)
   current.combatants.hero.activityEquipment!.armor!.inventoryInstanceId='second-armor'
   expect(dnd5eTargetArmorClassForAttack(current,'enemy','hero')).toBe(base)
   current.combatants.hero.activityEquipment!.armor=undefined
   expect(dnd5eTargetArmorClassForAttack(current,'enemy','hero')).toBe(base)
   const malformed=structuredClone(saved)
   malformed[0].modifiers.armorEnchantment.armorClassBonus=99
   expect(validateDnd5eActiveEffectsStrict(malformed).issues.length).toBeGreaterThan(0)
  }finally{clearDnd5eActivityRegistryForTests()}
 })
 it('rejects applying body armor binding when armor facts are missing',()=>{
  registerDnd5eActivityPackage({packageId:'test.armor-binding',packageVersion:'1.0.0',activities:[activity]})
  try{
   const original=state();original.combatants.hero.activityEquipment!.armor=undefined
   const before=structuredClone(original)
   expect(run(original,'missing').result.ok).toBe(false)
   expect(original).toEqual(before)
  }finally{clearDnd5eActivityRegistryForTests()}
 })
})

it('requires separate effect instances for separate item bindings',()=>{
 const effect=activity.effects![0]
 expect(validateDnd5eEffectDefinitionV1({...effect,modifiers:[...effect.modifiers!,{kind:'weapon-enchantment',weaponSlot:'main-hand',attackAndDamageBonus:{kind:'constant',value:1}}]})).toContain('effect must bind at most one physical item; use separate effects for separate items')
})

it('enforces nonmagical armor at the Host boundary, including temporary magic and unknown facts',()=>{
 const restricted={...activity,effects:[{...activity.effects![0],modifiers:[{kind:'armor-enchantment' as const,armorClassBonus:{kind:'constant' as const,value:1},requiresNonmagical:true as const}]}]}
 registerDnd5eActivityPackage({packageId:'test.armor-binding',packageVersion:'1.0.0',activities:[restricted]})
 try{
  const initial=state()
  expect(initial.combatants.hero.activityEquipment?.armor?.magical).toBe(false)
  const first=run(initial,'nonmagical-first')
  expect(first.result.ok,JSON.stringify(first)).toBe(true)
  if(first.phase!=='commit'||!first.result.ok)throw Error('no first binding')
  const before=structuredClone(first.result.state)
  expect(run(first.result.state,'already-enchanted').result.ok).toBe(false)
  expect(first.result.state).toEqual(before)
  first.result.state.combatants.hero.classState.activeEffects=[]
  expect(run(first.result.state,'after-removal').result.ok).toBe(true)
  for(const magical of [true,undefined]){
   const blocked=state();blocked.combatants.hero.activityEquipment!.armor!.magical=magical
   const saved=structuredClone(blocked)
   expect(run(blocked,'blocked-'+String(magical)).result.ok).toBe(false)
   expect(blocked).toEqual(saved)
  }
 }finally{clearDnd5eActivityRegistryForTests()}
})

it('projects explicit armor magic and unidentified inventory magic without granting a false nonmagical qualification',()=>{
 const make=(armor:any)=>normalizeCharacter({id:'hero',name:'Hero',charClass:'战士',level:1,equipment:{armor}})
 const innate=make({...DND5E_CHAIN_MAIL,id:'custom-magical-armor',dnd5e:{...DND5E_CHAIN_MAIL.dnd5e!,magical:true}})
 expect(migrateCharacterToDnd5e(innate).activityEquipment?.armor?.magical).toBe(true)
 const unidentified=make(DND5E_CHAIN_MAIL)
 expect(unidentified.dnd5eInventory?.entries.length).toBeGreaterThan(0)
 const entry=unidentified.dnd5eInventory!.entries.find(e=>e.equippedSlot==='armor')!
 entry.item={...entry.item,category:'magic-item'}
 entry.identified=false
 expect(migrateCharacterToDnd5e(unidentified).activityEquipment?.armor?.magical).toBe(true)
})

it('captures the source rest watermark from Host state and refuses missing lifecycle facts',()=>{
 const bound={...activity,effects:[{...activity.effects![0],breakOn:['source-long-rest-complete' as const]}]}
 registerDnd5eActivityPackage({packageId:'test.armor-binding',packageVersion:'1.0.0',activities:[bound]})
 try{
  for(const marker of [null,120]){
   const initial=state();initial.combatants.hero.lastLongRestWorldMinute=marker
   const result=run(initial,'watermark-'+String(marker))
   expect(result.result.ok,JSON.stringify(result)).toBe(true)
   if(result.phase!=='commit'||!result.result.ok)throw Error('no commit')
   expect(result.result.state.combatants.hero.classState.activeEffects?.[0].source.lastLongRestWorldMinute).toBe(marker)
  }
  for(const marker of [undefined,-1,NaN]){
   const unknown=state();unknown.combatants.hero.lastLongRestWorldMinute=marker
   expect(run(unknown,'unknown-watermark').result.ok).toBe(false)
  }
 }finally{clearDnd5eActivityRegistryForTests()}
})
