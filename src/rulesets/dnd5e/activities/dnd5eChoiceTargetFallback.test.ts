import {expect,it} from 'vitest'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction} from '../headlessCombatEngine'
import {registerDnd5eRulesPlugin} from '../pluginApi'
import {compileDnd5eActivityHeadlessAction} from './dnd5eActivityHeadlessCompiler'
import type {Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'

it('uses the chosen target contract for empty-area and self fallback, rejecting forged targets',()=>{
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'choice-target',name:'Choice target',
  activation:{kind:'free'},target:{kind:'self'},legacySource:{kind:'feature',id:'choice-target'},
  automation:automationCapabilityFromLegacyStatus('full'),
  choices:[{id:'mode',label:'Mode',options:[{id:'self',label:'Self',targetOverride:{kind:'self'}},
   {id:'area',label:'Area',targetOverride:{kind:'area',origin:'self',shape:'circle',radiusFeet:15,relation:'enemy',includeSelf:false}}]}],
  outcomes:[{id:'benefit',when:{kind:'always'},operations:[{id:'hp',kind:'temporary-hit-points',target:'actor',amount:{kind:'constant',value:3}}]}]}
 const packageId='test.choice-target-fallback'
 const dispose=registerDnd5eRulesPlugin({manifest:{id:packageId,name:'Test',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity))}})
 try{
  const actor=createDnd5eCombatant({id:'actor',name:'Actor',controller:'player',initiative:20,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
  const opponent={...structuredClone(actor),id:'opponent',name:'Opponent',controller:'dm' as const,initiative:10}
  const state=startDnd5eHeadlessCombat('choice-target',[actor,opponent])
  const run=(mode:string,targetIds:string[])=>resolveDnd5eHeadlessAction(state,{type:'plugin',pluginId:packageId,actionId:activity.id,actorId:'actor',targetIds,rolls:{},payload:{activityChoices:{mode}},activityAreaPlacement:{x:0,y:0,radiusFeet:15},activityAreaPlacementDistanceFeet:0})
  for(const mode of ['self','area']){
   const result=run(mode,[])
   expect(result.ok,result.ok?'':result.reason).toBe(true)
   expect(result.state.combatants.actor.temporaryHp).toBe(3)
   if(result.ok)expect(result.activityDefinition?.target).toEqual(mode==='self'?{kind:'self'}:{kind:'area',origin:'self',shape:'circle',radiusFeet:15,relation:'enemy',includeSelf:false})
  }
  expect(run('area',['actor']).ok).toBe(false)
  expect(run('unknown',[]).ok).toBe(false)
  expect(state.combatants.actor.temporaryHp).toBe(0)
 }finally{dispose()}
})
