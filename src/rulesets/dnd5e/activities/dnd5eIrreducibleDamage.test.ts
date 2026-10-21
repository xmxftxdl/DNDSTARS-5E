import { expect, it } from 'vitest'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, commitDnd5eActivityExecution, resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { compileDnd5eActivityHeadlessAction } from './dnd5eActivityHeadlessCompiler'
import { dnd5ePluginFeatureActionFromActivityV1 } from './dnd5eActivityFeatureActionAdapter'
import { withDnd5eDamageCommitCheckpoints } from '../damageCommitCheckpoint'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './dnd5eActivityCombatAuthority'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

it.each(['resistance','immunity','reduction','vulnerability','conditional','reactive-immunity','ward'] as const)('preserves irreducible damage events with %s', defense => {
  for (const cannotBeReduced of [false,true]) {
    const actor = createDnd5eCombatant({id:'actor',name:'Actor',controller:'player',initiative:20,
      abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,
      currentHp:30,maxHp:30,temporaryHp:2,speed:30,position:{x:0,y:0},concentrating:false})
    if(defense==='resistance')actor.damageResistances=['piercing']
    if(defense==='immunity')actor.damageImmunities=['piercing']
    if(defense==='vulnerability')actor.damageVulnerabilities=['piercing']
    if(defense==='conditional')actor.damageDefenseRules=[
      {outcome:'immune',damageTypes:['piercing'],reason:'synthetic immunity'},
      {outcome:'vulnerable',damageTypes:['piercing'],reason:'synthetic vulnerability'}]
    if(defense==='reduction')actor.pluginFeaturePassiveEffects=[{featureId:'test:ward',featureName:'Ward',effectId:'ward',
      effect:{schemaVersion:1,id:'ward',kind:'damage-reduction',trigger:'before-damage',amount:3}}]
    const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'injury',name:'Synthetic injury',activation:{kind:'free'},target:{kind:'self'},
      automation:automationCapabilityFromLegacyStatus('full'),outcomes:[{id:'injury',when:{kind:'always'},operations:[{
        id:'damage',kind:'damage',target:'actor',damageType:'piercing',amount:{kind:'constant',value:6},cannotBeReduced}]}]}
    const snapshot=dnd5eActivityActorSnapshotFromCombatantV1(actor)
    const resolution=resolveDnd5eActivity({activity,actor:snapshot,targets:[snapshot],rolls:{}})
    expect(resolution.ok).toBe(true)
    if(!resolution.ok)throw Error('Activity rejected')
    expect(resolution.status).toBe('resolved')
    expect(resolution.proposals[0]).toMatchObject({cannotBeReduced})
    const state=startDnd5eHeadlessCombat('injury',[actor,{...actor,id:'opponent',controller:'dm',initiative:10}])
    expect(state.active).toBe(true)
    const dispose=registerDnd5eRulesPlugin({manifest:{id:'test.injury',name:'Injury',version:'1.0.0',apiVersion:2,
      rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){
      api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity))
      api.registerFeature({id:activity.id,name:activity.name,summary:'Synthetic',description:'Synthetic',automation:'full',
        action:dnd5ePluginFeatureActionFromActivityV1(activity)})
      api.registerDeclarativeSubclass({schemaVersion:1,id:'defender',classId:'wizard',name:'Defender',summary:'Synthetic',abilities:[{
        schemaVersion:1,id:'ward',name:'Ward',description:'Synthetic pool',level:2,
        trigger:{kind:'after-spell-cast'},targeting:{kind:'self'},effects:[],automation:'full',
        mechanic:{kind:'ward-pool',spellcastingClassId:'wizard',ability:'int',school:'abjuration',
          minimumSpellLevel:1,classLevelMultiplier:2,restorePerSpellLevel:2}}]})
    }})
    state.combatants.actor.pluginFeatureIds=['test.injury:injury']
    if(defense==='ward'){
      state.combatants.actor.pluginFeatureIds=[...state.combatants.actor.pluginFeatureIds,'test.injury:defender.ward']
      state.combatants.actor.classState.declarativeWardPools={'test.injury:defender.ward':{current:3,max:3}}
    }
    try {
    for(const route of ['direct','compiled']) {
    let checkpoints=0
    const result=withDnd5eDamageCommitCheckpoints((checkpoint,snapshot)=>{
      checkpoints++
      expect(checkpoint.amount).toBe(defense==='vulnerability'||(defense==='conditional'&&cannotBeReduced)?12:
        (defense==='immunity'||defense==='conditional')&&!cannotBeReduced?0:defense==='resistance'&&!cannotBeReduced?3:6)
      if(defense==='reactive-immunity' && snapshot){
        snapshot.combatants.actor.damageImmunities=['piercing']
        return {target:snapshot.combatants.actor,events:[]}
      }
    },()=>route==='direct'
      ? commitDnd5eActivityExecution(state,{actorId:actor.id,activityId:activity.id,targetIds:[actor.id],resolution})
      : resolveDnd5eHeadlessAction(state,{type:'plugin',pluginId:'test.injury',actionId:activity.id,
        featureId:'test.injury:injury',actorId:actor.id,targetId:actor.id,rolls:{}}))
    expect(result.ok,result.ok?'':result.reason).toBe(true)
    const expected=defense==='vulnerability'||(defense==='conditional'&&cannotBeReduced)?12:cannotBeReduced?6:
      ['immunity','conditional','reactive-immunity'].includes(defense)?0:3
    expect(checkpoints).toBe(['immunity','conditional'].includes(defense)&&!cannotBeReduced?0:1)
    expect(result.state.combatants.actor.currentHp).toBe(30-Math.max(0,expected-2))
    expect(result.state.combatants.actor.temporaryHp).toBe(Math.max(0,2-expected))
    expect(result.events).toContainEqual(expect.objectContaining({type:'damage-applied',targetId:actor.id,amount:expected}))
    if(cannotBeReduced)expect(result.events.some(event=>event.type==='plugin-feature-passive-effect-applied')).toBe(false)
    expect(state.combatants.actor.currentHp).toBe(30)
    if(defense==='ward')expect(result.state.combatants.actor.classState.declarativeWardPools?.['test.injury:defender.ward'].current).toBe(cannotBeReduced?3:0)
    }
    } finally {dispose()}
  }
})
