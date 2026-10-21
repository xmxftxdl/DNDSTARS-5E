import {expect,it} from 'vitest'
import {prepareDnd5eLocalContentJson} from './localContentCollection'
import {dnd5eRulesPluginFromContentPackageV2} from './contentPackageV2'
import {registerDnd5eRulesPlugin,dnd5ePluginFeatureDefinition,dnd5ePluginHeadlessActionDefinition} from './pluginApi'
import {compileDnd5eActivityPatternV1} from './activities/dnd5eActivityPatterns'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction} from './headlessCombatEngine'
import {createDnd5eMechanicalEffect} from './activeEffects'

it('registers imported spell continuation controls as executable native actions including the finisher',async()=>{
 const base={schemaVersion:1 as const,id:'cast',name:'Synthetic',source:{kind:'spell' as const,id:'chain'},activation:{kind:'free' as const},target:{kind:'creature' as const,relation:'any' as const,count:1,includeSelf:true},pattern:'roll-effect' as const,result:{kind:'damage' as const,damageType:'force' as const,amount:{kind:'constant' as const,value:1}}}
 const rule={nextActivityId:'next',finishActivityId:'finish',maximumSteps:3,excludePreviousTargets:true}
 const activities=[compileDnd5eActivityPatternV1({...base,continuation:rule}),
  compileDnd5eActivityPatternV1({...base,id:'next',requiresContinuationFrom:'cast',continuation:rule}),
  compileDnd5eActivityPatternV1({...base,id:'finish',requiresContinuationFrom:'cast',target:{kind:'self'},result:{kind:'temporary-hit-points',amount:{kind:'constant',value:1}}})]
 const imported=await prepareDnd5eLocalContentJson(JSON.stringify({name:'Imported spell chain',spells:[{id:'chain',name:'Chain',level:1,school:'evocation',ritual:false,castingTime:{value:1,unit:'action'},range:{type:'distance',feet:60},components:{verbal:true,somatic:false,material:false},duration:{type:'instantaneous',concentration:false},classes:['wizard'],description:'Synthetic chain.',automation:{mode:'full'}}],activities}),'chain.json',{targetCollection:'spells'})
 const pkg=imported.package.manifest.id
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(imported.package))
 try{
  for(const id of ['next','finish']){
   expect(dnd5ePluginHeadlessActionDefinition(pkg,id)).toBeDefined()
   expect(dnd5ePluginFeatureDefinition(pkg+':effect-control.'+id)?.action?.id).toBe(id)
  }
  const actor=createDnd5eCombatant({id:'actor',name:'Actor',controller:'player',initiative:20,abilities:{str:10,dex:10,con:10,int:18,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
  const target={...structuredClone(actor),id:'target',name:'Target',controller:'dm' as const,initiative:10}
  const state=startDnd5eHeadlessCombat('imported-chain',[actor,target])
  // Granting a control alone cannot fabricate a continuation receipt.
  state.combatants.actor.classState.activeEffects=[createDnd5eMechanicalEffect({id:'forged-grant',definitionId:'synthetic',label:'Synthetic',kind:'buff',targetId:'actor',source:{kind:'feature',rulesId:'synthetic',actorId:'actor',pluginId:pkg},duration:{type:'permanent'},grantedActivities:['next']})]
  const rejected=resolveDnd5eHeadlessAction(state,{type:'plugin',pluginId:pkg,actionId:'next',featureId:pkg+':effect-control.next',actorId:'actor',targetId:'target',targetIds:['target'],hostEntitlement:{kind:'active-effect',effectId:'forged-grant'},rolls:{},transactionId:'forged-next',distanceFeet:5})
  expect(rejected.ok).toBe(false)
  expect(rejected.state.combatants.target.currentHp).toBe(20)
 }finally{dispose()}
})
