import {expect,it} from 'vitest'
import {normalizeCharacter} from '../../store/characters'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {registerDnd5eActivityPackage,clearDnd5eActivityRegistryForTests} from './activities/dnd5eActivityRegistry'
import {automationCapabilityFromLegacyStatus} from '../../domain/automation/automationCapability'
import {resolveDnd5eActivityCommand} from './activities/dnd5eActivityCommand'
import {beginDnd5eInventoryExchangeRitual,dnd5eInventoryExchangeRitualReady} from './inventoryExchangeRitual'
import {dnd5eInventoryExchangeSavedSelection} from './inventoryExchangeRitualState'
import {requestInventoryExchangeMaterials} from '../../components/map/inventoryExchangeChoices'
import {applyDnd5eInventoryMutation} from './items'
import {validateDnd5eActivityDefinitionV1} from './activities/dnd5eActivityValidation'
import {resolveAndCommitDnd5eActivityCommand} from './activities/dnd5eActivityHeadlessAuthorityBridge'
import {createCombatantFromDnd5eCharacter,migrateCharacterToDnd5e} from './character'
import {startDnd5eHeadlessCombat} from './headlessCombatEngine'
import type {Dnd5eActivityDefinitionV1} from './activities/dnd5eActivityContracts'
it.each([false,true])('selects an authorized output, validates price and locks the exact output across the ritual (dynamic=%s)',async(dynamic)=>{
 const ns='test.output-choice', secondId=dynamic?'test.late-output:second':ns+':second'
 const dispose=registerDnd5eRulesPlugin({manifest:{id:ns,name:'Test',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Test',license:'CC0'},setup(api){
  for(const [id,value] of [['first',1],['second',2],['expensive',101]] as const){if(dynamic&&id==='second')continue;api.registerItem({id,name:id,description:'Private fixture',rulesText:'Fixture',category:'adventuring-gear',icon:'generic',stackable:false,spellcastingMaterial:{tags:['test:metal'],unitValueGp:value}})}
 }})
 const policy={inputTags:['test:metal'],outputTags:['test:metal'],maximumValueCp:10000,maximumInclusive:true,requiresOriginal:false}
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'make',name:'Make',activation:{kind:'hour',value:1},target:{kind:'self'},automation:automationCapabilityFromLegacyStatus('full'),outcomes:[{id:'make',when:{kind:'always'},operations:[{id:'exchange',kind:'exchange-inventory-items',target:'actor',templateId:ns+':first',...(dynamic?{templateSource:'registered-items' as const}:{templateOptions:[ns+':first',secondId,ns+':expensive']}),quantity:{kind:'constant',value:1},policy}]}]}
 expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
 registerDnd5eActivityPackage({packageId:ns,packageVersion:'1.0.0',activities:[activity]})
 const disposeLate=dynamic?registerDnd5eRulesPlugin({manifest:{id:'test.late-output',name:'Later imported item',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Test',license:'CC0'},setup(api){api.registerItem({id:'second',name:'second',description:'Fixture',rulesText:'Fixture',category:'adventuring-gear',icon:'generic',stackable:false,spellcastingMaterial:{tags:['test:metal'],unitValueGp:2}})}}):undefined
 try{
  const owner=applyDnd5eInventoryMutation([normalizeCharacter({id:'owner',name:'Owner',currentHp:10,maxHp:10,equipment:{},dnd5eInventory:{schemaVersion:3,entries:[]}})],{type:'adjust-currency',characterId:'owner',currency:'gp',delta:2}).characters[0]
  const actor:any={id:'owner',characterId:'owner',level:1,controller:'players',proficiencyBonus:2,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},armorClass:10,conditions:[],currentHp:10,maxHp:10,resources:{}}
  const selection={expectedInventoryRevision:owner.dnd5eInventory!.revision!,inputs:[],coins:[{currency:'gp' as const,amount:2}],outputTemplateId:secondId}
  const authority:any={command:{schemaVersion:1,commandId:'ritual',actorId:'owner',packageId:ns,packageVersion:'1.0.0',activityId:'make',targetIds:['owner'],expectedRevision:0,inventoryExchange:selection},currentRevision:0,combatActive:false,actor,targets:[actor],authoritativeRolls:{},inventoryOwner:owner}
  const result=resolveDnd5eActivityCommand(authority);expect(result.ok).toBe(true)
  if(!result.ok)throw Error('resolution failed')
  expect(result.proposals).toContainEqual(expect.objectContaining({kind:'exchange-inventory-items',templateId:secondId}))
  expect(resolveDnd5eActivityCommand({...authority,command:{...authority.command,inventoryExchange:{...selection,outputTemplateId:'unknown:forged'}}}).ok).toBe(false)
  const begun=beginDnd5eInventoryExchangeRitual(authority,100);expect(begun.ok).toBe(true)
  if(!begun.ok)throw Error('begin failed')
  const saved=normalizeCharacter(JSON.parse(JSON.stringify(begun.character)))
  expect(dnd5eInventoryExchangeSavedSelection(saved.dnd5eInventory!.pendingExchangeRitual!)?.outputTemplateId).toBe(secondId)
  const completion={...authority,command:begun.command,inventoryOwner:saved}
  expect(dnd5eInventoryExchangeRitualReady(completion,159)).toBe(false)
  expect(dnd5eInventoryExchangeRitualReady(completion,160)).toBe(true)
  expect(dnd5eInventoryExchangeRitualReady({...completion,command:{...begun.command,inventoryExchange:{...begun.command.inventoryExchange!,outputTemplateId:ns+':first'}}},160)).toBe(false)
  const combatant=createCombatantFromDnd5eCharacter({character:migrateCharacterToDnd5e(saved),controller:'player',initiativeD20:10,position:{x:0,y:0}})
  const state={...startDnd5eHeadlessCombat('craft',[combatant]),active:false}
  const committed=resolveAndCommitDnd5eActivityCommand(state,completion,{worldMinute:160})
  expect(committed.result.ok,JSON.stringify(committed)).toBe(true)
  if(!committed.result.ok)throw Error('commit failed')
  expect(committed.result.inventoryOwner?.dnd5eInventory?.entries.map(entry=>entry.templateId)).toEqual([secondId])
  expect(committed.result.inventoryOwner?.dnd5eInventory?.currency?.gp).toBe(0)
  expect(committed.result.inventoryOwner?.dnd5eInventory?.pendingExchangeRitual).toBeUndefined()
  expect(beginDnd5eInventoryExchangeRitual({...authority,command:{...authority.command,inventoryExchange:{...selection,outputTemplateId:ns+':expensive'}}},100).ok).toBe(false)
  let choices=0
  const picked=await requestInventoryExchangeMaterials({character:owner,templateId:ns+':first',...(dynamic?{templateSource:'registered-items' as const}:{templateOptions:[ns+':first',secondId,ns+':expensive']}),outputQuantity:1,policy,dialogs:{choose:async prompt=>{choices++;expect(prompt.options.map(o=>o.id)).toEqual([ns+':first',secondId]);return secondId},multiple:async()=>['coin:gp'],quantity:async()=>({value:2,direction:'up'}),alert:async()=>{throw Error('unexpected alert')}}})
  expect(choices).toBe(1);expect(picked?.outputTemplateId).toBe(secondId)
 }finally{disposeLate?.();dispose();clearDnd5eActivityRegistryForTests()}
})



