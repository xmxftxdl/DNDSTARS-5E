import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { compileDnd5eActivityHeadlessAction } from './dnd5eActivityHeadlessCompiler'
import { dnd5ePluginFeatureActionFromActivityV1 } from './dnd5eActivityFeatureActionAdapter'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

it('registers and settles large formula dice pools without accepting forged dice', () => {
 const definition: Dnd5eActivityDefinitionV1 = {
  schemaVersion:1,id:'large-pool',name:'Large pool',legacySource:{kind:'feature',id:'large-pool'},
  activation:{kind:'action'},target:{kind:'self'},automation:automationCapabilityFromLegacyStatus('full'),
  outcomes:[{id:'damage',when:{kind:'always'},operations:[{id:'damage',kind:'damage',target:'actor',
   amount:{kind:'dice',rollId:'damage',count:14,sides:6},damageType:'psychic',magical:true}]}],
 }
 const compiled=compileDnd5eActivityHeadlessAction(definition)
 const plugin={manifest:{id:'local.large.pool',name:'Large pool',version:'1.0.0',apiVersion:2 as const,rulesetId:'dnd5e-2014-srd-5.1' as const,publisher:'Tests',license:'CC0'},setup(api:Parameters<Parameters<typeof registerDnd5eRulesPlugin>[0]['setup']>[0]){
  api.registerHeadlessAction(compiled)
  api.registerFeature({id:definition.id,name:definition.name,summary:'Test',description:'Test',automation:'full',action:dnd5ePluginFeatureActionFromActivityV1(definition)})
 }}
 const dispose=registerDnd5eRulesPlugin(plugin)
 try {
  const actor=createDnd5eCombatant({id:'actor',name:'Actor',controller:'player',initiative:20,level:17,
   abilities:{str:10,dex:10,con:10,int:18,wis:10,cha:10},proficiencyBonus:6,armorClass:14,
   currentHp:100,maxHp:100,temporaryHp:0,speed:30,saveDc:18,position:{x:0,y:0},concentrating:false})
  actor.pluginFeatureIds=['local.large.pool:large-pool']
  const opponent=createDnd5eCombatant({...actor,id:'opponent',name:'Opponent',controller:'dm',initiative:1})
  const state=startDnd5eHeadlessCombat('large-pool-test',[actor,opponent])
  const action={type:'plugin' as const,pluginId:'local.large.pool',actionId:definition.id,
   featureId:'local.large.pool:large-pool',actorId:'actor',targetId:'actor'}
  const result=resolveDnd5eHeadlessAction(state,{...action,rolls:{damage:{values:Array(14).fill(3),modifier:0,total:42}}})
  expect(result.ok,JSON.stringify(result)).toBe(true)
  expect(result.state.combatants.actor.currentHp).toBe(58)
  for(const values of [Array(13).fill(3),Array(15).fill(3),Array(14).fill(7)]){
   const invalid=resolveDnd5eHeadlessAction(state,{...action,rolls:{damage:{values,modifier:0,total:values.reduce((sum,value)=>sum+value,0)}}})
   expect(invalid.ok).toBe(false)
   expect(invalid.state.combatants.actor.currentHp).toBe(100)
  }
 }finally{dispose()}
 compiled.rolls=[{id:'damage',label:'Damage',count:1001,sides:6}]
 expect(()=>registerDnd5eRulesPlugin(plugin)).toThrow('Invalid plugin dice declaration')
})
