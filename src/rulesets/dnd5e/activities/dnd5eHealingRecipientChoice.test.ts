import {resolveRegisteredDnd5eActivityInCombatV1} from './dnd5eActivityCombatAuthority'
import {expect,it} from 'vitest'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'
import {resolveDnd5eActivity,type Dnd5eActivityActorSnapshot} from './dnd5eActivityExecutor'
import type {Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'
import {validateDnd5eActivityDefinitionV1} from './dnd5eActivityValidation'
import {registerDnd5eRulesPlugin} from '../pluginApi'
import {registerDnd5eActivityPackage} from './dnd5eActivityRegistry'
import {compileDnd5eActivityHeadlessAction} from './dnd5eActivityHeadlessCompiler'
import {dnd5ePluginFeatureActionFromActivityV1} from './dnd5eActivityFeatureActionAdapter'
import {commitDnd5eActivityExecution,createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction,dnd5eCombatantPairKey} from '../headlessCombatEngine'

it('keeps the event subject Hit Dice separate from a selected healing recipient',()=>{
 const actor:Dnd5eActivityActorSnapshot={id:'actor',controller:'players',level:17,proficiencyBonus:6,abilities:{str:10,dex:10,con:10,int:10,wis:18,cha:10},armorClass:10,conditions:[],currentHp:10,maxHp:100,hitPointDice:[{sides:8,current:17,max:17}]}
 const deceased={...actor,id:'deceased',controller:'dm' as const,currentHp:0,corpse:{bodyPresent:true},hitPointDice:[{sides:8,current:0,max:11}]}
 const recipient={...actor,id:'recipient',hitPointDice:[{sides:10,current:3,max:3}]}
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'death-healing',name:'Death healing',legacySource:{kind:'feature',id:'heal'},activation:{kind:'free'},target:{kind:'creature',relation:'any',count:1,rangeFeet:60},automation:automationCapabilityFromLegacyStatus('full'),choices:[{id:'recipient',label:'Recipient',optionsFrom:'combat-creatures',options:[{id:'actor',label:'Actor'},{id:'recipient',label:'Recipient'},{id:'deceased',label:'Corpse'}]}],outcomes:[{id:'heal',when:{kind:'always'},operations:[{id:'heal',kind:'healing',target:'target',recipientChoice:{choiceId:'recipient',rangeFeet:60},amount:{kind:'reference',reference:{kind:'target-hit-dice',field:'maximum'}}}]}]}
 expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
 for(const selected of ['actor','recipient']) {
  const result=resolveDnd5eActivity({activity,actor,targets:[deceased],combatants:[actor,deceased,recipient],choices:{recipient:selected},distanceFeetByTargetId:{deceased:30,recipient:60},rolls:{}})
  expect(result.ok,JSON.stringify(result)).toBe(true)
  if(result.ok)expect(result.proposals).toEqual([expect.objectContaining({kind:'heal',targetId:selected,amount:11})])
 }
 for(const [selected,distance] of [['missing',5],['deceased',5],['recipient',61],['recipient',undefined]] as const) {
  const result=resolveDnd5eActivity({activity,actor,targets:[deceased],combatants:[actor,deceased,recipient],choices:{recipient:selected},distanceFeetByTargetId:{deceased:30,...distance==null?{}:{recipient:distance}},rolls:{}})
  expect(result.ok,JSON.stringify({selected,distance,result})).toBe(false)
 }
 const bad=structuredClone(activity);bad.choices=[]
 expect(validateDnd5eActivityDefinitionV1(bad).some(e=>e.includes('recipientChoice'))).toBe(true)
 const ns='test.healing-recipient'
 const dispose=registerDnd5eRulesPlugin({manifest:{id:ns,name:'Healing recipient',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){
  api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity))
  api.registerFeature({id:'heal',name:'Heal',summary:'Test',description:'Test',automation:'full',action:dnd5ePluginFeatureActionFromActivityV1(activity)})
 }})
 const registration=registerDnd5eActivityPackage({packageId:ns,packageVersion:'1.0.0',activities:[activity]})
 try{
  for (const [statBlockId, expected] of [[undefined, 11], ['srd-5.1:cat', 1], ['srd-5.1:tarrasque', 33]] as const) {
  const make=(snapshot:Dnd5eActivityActorSnapshot,initiative:number)=>createDnd5eCombatant({...snapshot,hitPointDice:snapshot.hitPointDice?.map(pool=>({...pool})),name:snapshot.id,controller:snapshot.id==='deceased'?'dm':'player',initiative,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false,currentHp:snapshot.currentHp!,maxHp:snapshot.maxHp!,pluginFeatureIds:snapshot.id==='actor'?[ns+':heal']:[]})
  const state=startDnd5eHeadlessCombat('recipient',[make(actor,20),make(deceased,10),make(recipient,5)])
  if (statBlockId) { state.combatants.deceased.statBlockId=statBlockId; state.combatants.deceased.hitPointDice=undefined }
  state.combatants.deceased.deathSaves.dead=true
  state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('actor','deceased')]:30,[dnd5eCombatantPairKey('actor','recipient')]:60}
  for(const binding of [undefined,[{operationId:'wrong-operation',targetId:'recipient'}],[{operationId:'heal',targetId:'actor'}]]) {
   const rejected=commitDnd5eActivityExecution(state,{actorId:'actor',activityId:activity.id,targetIds:['deceased'],healingRecipientAuthorizations:binding,resolution:{ok:true,status:'resolved',checks:[],consumptions:[],proposals:[{kind:'heal',operationId:'heal',targetId:'recipient',amount:11}]}})
   expect(rejected.ok).toBe(false)
   expect(state.combatants.recipient.currentHp).toBe(10)
  }
  for(const mode of ['far','unknown-distance','corpse'] as const) {
   const rejectedState=structuredClone(state)
   const key=dnd5eCombatantPairKey('actor','recipient')
   if(mode==='far')rejectedState.distanceFeetByCombatantPair![key]=61
   if(mode==='unknown-distance')delete rejectedState.distanceFeetByCombatantPair![key]
   if(mode==='corpse'){rejectedState.combatants.recipient.currentHp=0;rejectedState.combatants.recipient.deathSaves.dead=true}
   const before=structuredClone(rejectedState)
   const rejected=resolveRegisteredDnd5eActivityInCombatV1({state:rejectedState,combatRevision:1,authoritativeRolls:{},command:{schemaVersion:1,commandId:mode,actorId:'actor',packageId:ns,packageVersion:'1.0.0',activityId:activity.id,targetIds:['deceased'],choices:{recipient:'recipient'},expectedRevision:1}}).result
   expect(rejected.ok,mode).toBe(false)
   expect(rejectedState).toEqual(before)
  }
  const registered=resolveRegisteredDnd5eActivityInCombatV1({state,combatRevision:1,authoritativeRolls:{},command:{schemaVersion:1,commandId:'other-recipient',actorId:'actor',packageId:ns,packageVersion:'1.0.0',activityId:activity.id,targetIds:['deceased'],choices:{recipient:'recipient'},expectedRevision:1}}).result
  expect(registered.ok,JSON.stringify(registered)).toBe(true)
  if(registered.ok)expect(registered.state.combatants.recipient.currentHp).toBe(10+expected)
  const result=resolveDnd5eHeadlessAction(state,{type:'plugin',pluginId:ns,actionId:activity.id,featureId:ns+':heal',actorId:'actor',targetId:'deceased',targetIds:['deceased'],distanceFeet:30,rolls:{},payload:{activityChoices:{recipient:'recipient'}}})
  expect(result.ok,JSON.stringify(result)).toBe(true)
  expect(result.state.combatants.recipient.currentHp).toBe(10 + expected)
  expect(result.state.combatants.deceased.currentHp).toBe(0)
  expect(result.state.combatants.actor.currentHp).toBe(10)
 }
 }finally{registration.dispose();dispose()}
})
