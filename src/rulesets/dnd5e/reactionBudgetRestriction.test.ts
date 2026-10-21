import {expect,it} from 'vitest'
import {automationCapabilityFromLegacyStatus} from '../../domain/automation/automationCapability'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction,commitDnd5eActivityExecution} from './headlessCombatEngine'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {compileDnd5eActivityHeadlessAction} from './activities/dnd5eActivityHeadlessCompiler'
import {dnd5ePluginFeatureActionFromActivityV1} from './activities/dnd5eActivityFeatureActionAdapter'
import {dnd5eActivityActorSnapshotFromCombatantV1} from './activities/dnd5eActivityCombatAuthority'
import {resolveDnd5eActivity} from './activities/dnd5eActivityExecutor'
import type {Dnd5eActivityDefinitionV1} from './activities/dnd5eActivityContracts'

it.each(['available','spent','prevented'] as const)('checks reaction budget separately from %s restrictions',mode=>{
  const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'react',name:'Reaction',activation:{kind:'reaction',cost:1,reactionEvent:'test event'},target:{kind:'self'},
    invocation:{kind:'active',confirmation:'actor-choice'},legacySource:{kind:'feature',id:'react'},automation:automationCapabilityFromLegacyStatus('full'),
    consumption:[{kind:'action-economy',economy:'reaction',amount:1,consumeOn:'resolve'}],outcomes:[{id:'heal',when:{kind:'always'},operations:[
      {id:'heal',kind:'healing',target:'actor',amount:{kind:'constant',value:1}}]}]}
  const dispose=registerDnd5eRulesPlugin({manifest:{id:'test.reaction-budget',name:'Test',version:'1.0.0',apiVersion:2,
    rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){
    api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity))
    api.registerFeature({id:'react',name:'React',summary:'Synthetic',description:'Synthetic',automation:'full',action:dnd5ePluginFeatureActionFromActivityV1(activity)})
  }})
  try{for(const route of ['direct','compiled']){
    const actor=createDnd5eCombatant({id:'actor',name:'Actor',controller:'player',initiative:20,
      abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,
      currentHp:10,maxHp:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
    actor.pluginFeatureIds=['test.reaction-budget:react']
    const state=startDnd5eHeadlessCombat('reaction',[actor,{...structuredClone(actor),id:'enemy',controller:'dm',initiative:10}])
    if(mode==='spent')state.combatants.actor.turn.reactionAvailable=false
    if(mode==='prevented')state.combatants.actor.classState.openHandNoReactionsAppliedTurnKeysBySource={enemy:'reaction:1:enemy'}
    const before=structuredClone(state)
    const run=(value:typeof state)=>{
      const snapshot=dnd5eActivityActorSnapshotFromCombatantV1(value.combatants.actor)
      const resolution=resolveDnd5eActivity({activity,actor:snapshot,targets:[snapshot],rolls:{},confirmedBy:'actor'})
      expect(resolution.ok,JSON.stringify(resolution)).toBe(true)
      return route==='direct'?commitDnd5eActivityExecution(value,{actorId:'actor',activityId:'react',targetIds:['actor'],
        resolution}):
        resolveDnd5eHeadlessAction(value,{type:'plugin',pluginId:'test.reaction-budget',actionId:'react',featureId:'test.reaction-budget:react',actorId:'actor',targetId:'actor',rolls:{}})
    }
    const result=run(state)
    expect(result.ok,`${route}: ${JSON.stringify(result.events)}`).toBe(mode==='available')
    expect(state).toEqual(before)
    if(mode==='available')expect(result.state.combatants.actor.turn.reactionAvailable).toBe(false)
    else expect(result.state).toEqual(before)
    if(mode==='prevented'){
      const released=structuredClone(state);released.combatants.actor.classState.openHandNoReactionsAppliedTurnKeysBySource=undefined
      expect(run(released).ok).toBe(true)
    }
  }}finally{dispose()}
})
