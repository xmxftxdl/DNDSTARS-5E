import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../../store/characters'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { applyDnd5eInventoryMutation } from '../items'
import { createCombatantFromDnd5eCharacter, migrateCharacterToDnd5e } from '../character'
import { startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { compileDnd5eActivityHeadlessAction } from './dnd5eActivityHeadlessCompiler'
import { dnd5ePluginFeatureActionFromActivityV1 } from './dnd5eActivityFeatureActionAdapter'
import { registerDnd5eActivityPackage, clearDnd5eActivityRegistryForTests } from './dnd5eActivityRegistry'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { dnd5eActiveMagicWeaponBonus } from '../activeEffects'
import { dnd5eActivitySelectsInventoryItem, dnd5eActivityInventorySnapshot } from './dnd5eActivityInventorySelection'
import { settleDnd5eActivityTriggerWindowsV1 } from './dnd5eActivityTriggerSettlement'

it('projects only simple or martial physical weapons for inventory enchantment', () => {
  const owner = applyDnd5eInventoryMutation([normalizeCharacter({id:'weapon-owner',name:'Owner',equipment:{}})],
    {type:'grant',characterId:'weapon-owner',templateId:'srd-5.1:equipment:dnd5e-longsword',quantity:1}).characters[0]
  expect(owner.dnd5eInventory?.entries).toHaveLength(1)
  for (const category of ['simple','martial','natural','improvised',undefined]) {
    const changed = structuredClone(owner)
    // An unknown retained template uses its saved equipment; a registered SRD
    // template would correctly restore the authoritative category instead.
    changed.dnd5eInventory!.entries[0].templateId = 'test.retained:weapon'
    const weapon = changed.dnd5eInventory!.entries[0].item.equipment!.dnd5e!
    if (weapon.kind !== 'weapon') throw Error('weapon fixture missing')
    weapon.category = category as typeof weapon.category
    expect(dnd5eActivityInventorySnapshot(changed).items).toHaveLength(category === 'simple' || category === 'martial' ? 1 : 0)
  }
})

it.each(['armor', 'weapon'] as const)('compiled %s binding uses Host inventory facts and rejects forged/stale selection', kind => {
  const definition:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'bind',name:'Bind',activation:{kind:'free'},target:{kind:'self'},legacySource:{kind:'feature',id:'bind'},automation:automationCapabilityFromLegacyStatus('full'),
    effects:[{schemaVersion:1,id:'bound',name:'Bound',stacking:'replace',duration:{kind:'rounds',rounds:10,expiresAt:'target-turn-end'},modifiers:kind==='armor'
      ? [{kind:'armor-enchantment',itemSelection:'inventory-item',requiresNonmagical:true,armorClassBonus:{kind:'constant',value:1}}]
      : [{kind:'weapon-enchantment',weaponSlot:'inventory-item',requiresNonmagical:true,attackAndDamageBonus:{kind:'constant',value:1}}]}],
    outcomes:[{id:'apply',when:{kind:'always'},operations:[{kind:'apply-effect',id:'bind',target:'actor',effectId:'bound'}]}]}
  registerDnd5eActivityPackage({packageId:'test.inventory-route',packageVersion:'1.0.0',activities:[definition]})
  const dispose=registerDnd5eRulesPlugin({manifest:{id:'test.inventory-route',name:'Test',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){
    api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(definition))
    api.registerFeature({id:'bind',name:'Bind',summary:'Test',description:'Test',automation:'full',action:dnd5ePluginFeatureActionFromActivityV1(definition)})
  }})
  try {
    const optional:Dnd5eActivityDefinitionV1={...definition,choices:[{id:'mode',label:'Mode',defaultOptionId:'skip',options:[{id:'skip',label:'Skip'},{id:'bind',label:'Bind'}]}],outcomes:[{...definition.outcomes[0],when:{kind:'choice',choiceId:'mode',optionId:'bind'}}]}
    expect(dnd5eActivitySelectsInventoryItem(optional)).toBe(false)
    expect(dnd5eActivitySelectsInventoryItem(optional,{mode:'bind'})).toBe(true)
    const empty=normalizeCharacter({id:'hero',name:'Hero',charClass:'战士',level:1,equipment:{},dnd5eInventory:{schemaVersion:1,entries:[]}})
    const grant=applyDnd5eInventoryMutation([empty],{type:'grant',characterId:'hero',templateId:`srd-5.1:equipment:dnd5e-${kind==='armor'?'chain-mail':'longsword'}`,quantity:1})
    expect(grant.ok).toBe(true)
    const owner=grant.characters[0],inventory=owner.dnd5eInventory!,entry=inventory.entries[0]
    const actor=createCombatantFromDnd5eCharacter({character:migrateCharacterToDnd5e(owner),controller:'player',initiativeD20:20,position:{x:0,y:0}})
    actor.pluginFeatureIds=['test.inventory-route:bind']
    const initial=startDnd5eHeadlessCombat('binding',[actor,{...structuredClone(actor),id:'enemy',controller:'dm',initiative:1}])
    const payload={activityInventoryInstanceId:entry.instanceId,activityInventoryCharacterId:'hero',expectedActivityInventoryRevision:inventory.revision??0}
    const action={type:'plugin' as const,pluginId:'test.inventory-route',actionId:'bind',featureId:'test.inventory-route:bind',actorId:'hero',targetId:'hero',targetIds:['hero'],rolls:{},payload}
    for (const invalid of [{...payload,expectedActivityInventoryRevision:payload.expectedActivityInventoryRevision+1},{...payload,activityInventoryCharacterId:'foreign'},{...payload,activityInventoryInstanceId:'missing'}]) {
      const before=structuredClone(initial)
      expect(resolveDnd5eHeadlessAction(initial,{...action,payload:invalid}).ok).toBe(false)
      expect(initial).toEqual(before)
    }
    const result=resolveDnd5eHeadlessAction(initial,action)
    expect(result.ok,JSON.stringify(result)).toBe(true)
    const binding=result.state.combatants.hero.classState.activeEffects?.[0].modifiers
    expect(kind==='armor'?binding?.armorEnchantment?.inventoryInstanceId:binding?.weaponEnchantment?.inventoryInstanceId).toBe(entry.instanceId)
    expect(result.state.combatants.hero.classState.activeEffects?.[0].suspendedBy).toContain('inventory-binding:not-held')
    if (kind === 'weapon') expect(dnd5eActiveMagicWeaponBonus(result.state.combatants.hero.classState.activeEffects,entry.item.equipment!.id)).toBe(0)
    expect(resolveDnd5eHeadlessAction(result.state,action).ok).toBe(false)
    const magical=structuredClone(initial)
    magical.combatants.hero.activityEquipment!.inventory!.items[0].magical=true
    expect(resolveDnd5eHeadlessAction(magical,{...action,payload:{...payload,selectedInventoryItem:{magical:false}}}).ok).toBe(false)
  } finally { dispose(); clearDnd5eActivityRegistryForTests() }
})

it('trigger confirmation carries only inventory selection and rejects a stale selection without consuming its resource',async()=>{
 const definition:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'trigger-bind',name:'Trigger bind',activation:{kind:'free'},invocation:{kind:'triggered',event:'after-damage',confirmation:'actor-choice',retention:'single-event'},target:{kind:'self'},legacySource:{kind:'feature',id:'trigger-bind'},automation:automationCapabilityFromLegacyStatus('full'),
 consumption:[{kind:'resource',resourceId:'focus',amount:{kind:'constant',value:1},consumeOn:'resolve'}],
 effects:[{schemaVersion:1,id:'bound',name:'Bound',duration:{kind:'rounds',rounds:10,expiresAt:'target-turn-end'},stacking:'replace',modifiers:[{kind:'armor-enchantment',itemSelection:'inventory-item',armorClassBonus:{kind:'constant',value:1}}]}],
 outcomes:[{id:'apply',when:{kind:'always'},operations:[{id:'bind',kind:'apply-effect',target:'actor',effectId:'bound'}]}]}
 registerDnd5eActivityPackage({packageId:'test.inventory-trigger',packageVersion:'1.0.0',activities:[definition]})
 try{
  const owner=applyDnd5eInventoryMutation([normalizeCharacter({id:'hero',name:'Hero',equipment:{},dnd5eInventory:{schemaVersion:1,entries:[]},dnd5ePluginFeatureIds:['trigger-bind']})],{type:'grant',characterId:'hero',templateId:'srd-5.1:equipment:dnd5e-chain-mail',quantity:1}).characters[0]
  const inventory=owner.dnd5eInventory!
  const actor=createCombatantFromDnd5eCharacter({character:migrateCharacterToDnd5e(owner),controller:'player',initiativeD20:1,position:{x:0,y:0}})
  actor.classResources={focus:{current:1,max:1}}
  actor.pluginFeatureIds=['trigger-bind']
  const state=startDnd5eHeadlessCombat('inventory-trigger',[actor,{...structuredClone(actor),id:'enemy',controller:'dm',initiative:20,pluginFeatureIds:[]}])
  const hit=resolveDnd5eHeadlessAction(state,{type:'attack',actorId:'enemy',targetId:'hero',attackModifier:10,d20:18,damage:{count:1,sides:4,bonus:0,rolls:[1],type:'bludgeoning'}})
  expect(hit.ok).toBe(true)
  if(!hit.ok)throw Error('attack failed')
  const run=(revision:number)=>settleDnd5eActivityTriggerWindowsV1({state:hit.state,events:hit.events,eventBatchId:'inventory-trigger-event',combatRevision:1,charactersByCombatantId:{hero:owner},confirm:async()=>({accepted:true,inventorySelection:{ownerId:'hero',instanceId:inventory.entries[0].instanceId,revision}}),roll:async()=>[]})
  const rejected=await run((inventory.revision??0)+1)
  expect(rejected.diagnostics).toContainEqual(expect.objectContaining({activityId:'trigger-bind',status:'rejected'}))
  expect(rejected.state.combatants.hero.classResources?.focus.current).toBe(1)
  const accepted=await run(inventory.revision??0)
  expect(accepted.diagnostics,JSON.stringify(accepted.diagnostics)).toContainEqual(expect.objectContaining({activityId:'trigger-bind',status:'resolved'}))
  expect(accepted.state.combatants.hero.classResources?.focus.current).toBe(0)
  expect(accepted.state.combatants.hero.classState.activeEffects?.[0].modifiers?.armorEnchantment?.inventoryInstanceId).toBe(inventory.entries[0].instanceId)
 }finally{clearDnd5eActivityRegistryForTests()}
})
