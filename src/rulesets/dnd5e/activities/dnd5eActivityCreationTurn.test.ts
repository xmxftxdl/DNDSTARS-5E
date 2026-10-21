import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { normalizeDnd5eActiveEffects, validateDnd5eActiveEffectsStrict, dnd5eActiveEffectRemainingLabel } from '../activeEffects'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, commitDnd5eActivityExecution, resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { compileDnd5eActivityHeadlessAction } from './dnd5eActivityHeadlessCompiler'
import { dnd5ePluginFeatureActionFromActivityV1 } from './dnd5eActivityFeatureActionAdapter'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './dnd5eActivityCombatAuthority'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import type { Dnd5eEffectDurationV1 } from './dnd5eEffectContracts'

it.each(['source-turn-end','target-turn-end'] as const)('expires at %s with explicit creation-turn policy', expiresAt => {
  for(const includeCreationTurn of [undefined,false,true]) for(const operation of ['condition','effect'] as const) {
    const duration:Dnd5eEffectDurationV1={kind:'rounds',rounds:1,expiresAt,includeCreationTurn}
    const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'blind',name:'Synthetic boundary',
      activation:{kind:'free'},target:{kind:'self'},legacySource:{kind:'feature',id:'blind'},
      automation:automationCapabilityFromLegacyStatus('full'),
      effects:[{schemaVersion:1,id:'blind',name:'Blind',duration,conditions:['blinded'],stacking:'replace'}],
      outcomes:[{id:'blind',when:{kind:'always'},operations:[operation==='effect'
        ? {id:'blind',kind:'apply-effect',target:'actor',effectId:'blind'}
        : {id:'blind',kind:'apply-standard-condition',target:'actor',condition:'blinded',duration}]}]}
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    const dispose=registerDnd5eRulesPlugin({manifest:{id:'test.boundary',name:'Boundary',version:'1.0.0',apiVersion:2,
      rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){
      api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity))
      api.registerFeature({id:'blind',name:'Blind',summary:'Synthetic',description:'Synthetic',automation:'full',
        action:dnd5ePluginFeatureActionFromActivityV1(activity)})
    }})
    try { for(const route of ['direct','compiled']) {
      const actor=createDnd5eCombatant({id:'actor',name:'Actor',controller:'player',initiative:20,
        abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,
        currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
      actor.pluginFeatureIds=['test.boundary:blind']
      const state=startDnd5eHeadlessCombat('boundary',[actor,{...structuredClone(actor),id:'enemy',controller:'dm',initiative:10}])
      const snapshot=dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.actor)
      const result=route==='direct'
        ? commitDnd5eActivityExecution(state,{actorId:'actor',activityId:'blind',targetIds:['actor'],
          resolution:resolveDnd5eActivity({activity,actor:snapshot,targets:[snapshot],rolls:{}})})
        : resolveDnd5eHeadlessAction(state,{type:'plugin',pluginId:'test.boundary',actionId:'blind',
          featureId:'test.boundary:blind',actorId:'actor',targetId:'actor',rolls:{}})
      expect(result.ok,`${route}/${operation}/${includeCreationTurn}`).toBe(true)
      expect(result.state.combatants.actor.conditions).toContain('blinded')
      const reloaded=JSON.parse(JSON.stringify(result.state)) as typeof state
      reloaded.combatants.actor.classState.activeEffects=normalizeDnd5eActiveEffects(reloaded.combatants.actor.classState.activeEffects)
      if(includeCreationTurn) expect(dnd5eActiveEffectRemainingLabel(reloaded.combatants.actor.classState.activeEffects![0])).toContain('包含当前回合')
      const ended=resolveDnd5eHeadlessAction(reloaded,{type:'end-turn',actorId:'actor'})
      expect(ended.ok).toBe(true)
      expect(ended.state.combatants.actor.conditions.includes('blinded'),`${route}/${operation}/${includeCreationTurn}`).toBe(includeCreationTurn!==true)
      const next=resolveDnd5eHeadlessAction(ended.state,{type:'end-turn',actorId:'enemy'})
      expect(next.ok).toBe(true)
      const expired=resolveDnd5eHeadlessAction(next.state,{type:'end-turn',actorId:'actor'})
      expect(expired.ok).toBe(true)
      expect(expired.state.combatants.actor.conditions).not.toContain('blinded')
      expect(state.combatants.actor.conditions).not.toContain('blinded')
    }} finally{dispose()}
  }
})

it.each(['source-turn-end','target-turn-end'] as const)('keeps separate source and target ownership for %s',expiresAt=>{
  const actor=createDnd5eCombatant({id:'source',name:'Source',controller:'player',initiative:20,
    abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,
    currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
  const state=startDnd5eHeadlessCombat('separate',[actor,{...structuredClone(actor),id:'target',controller:'dm',initiative:10}])
  const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'blind',name:'Blind',activation:{kind:'free'},
    target:{kind:'creature',relation:'any',count:1},automation:automationCapabilityFromLegacyStatus('full'),
    outcomes:[{id:'blind',when:{kind:'always'},operations:[{id:'blind',kind:'apply-standard-condition',target:'target',condition:'blinded',
      duration:{kind:'rounds',rounds:1,expiresAt,includeCreationTurn:true}}]}]}
  const resolution=resolveDnd5eActivity({activity,actor:dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.source),
    targets:[dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.target)],rolls:{}})
  const result=commitDnd5eActivityExecution(state,{actorId:'source',activityId:'blind',targetIds:['target'],resolution})
  expect(result.ok).toBe(true)
  const ended=resolveDnd5eHeadlessAction(result.state,{type:'end-turn',actorId:'source'})
  expect(ended.ok).toBe(true)
  expect(ended.state.combatants.target.conditions.includes('blinded')).toBe(expiresAt==='target-turn-end')
  const targetEnded=resolveDnd5eHeadlessAction(ended.state,{type:'end-turn',actorId:'target'})
  expect(targetEnded.ok).toBe(true)
  expect(targetEnded.state.combatants.target.conditions).not.toContain('blinded')
  const effects=result.state.combatants.target.classState.activeEffects!
  const malformed=structuredClone(effects) as unknown as Array<{duration:Record<string,unknown>}>
  malformed[0].duration.includeCreationTurn='yes'
  expect(validateDnd5eActiveEffectsStrict(malformed).issues.some(issue=>issue.includes('includeCreationTurn'))).toBe(true)
})

it('rejects creation-turn flags on incompatible durations',()=>{
  for(const duration of [
    {kind:'rounds',rounds:2,expiresAt:'source-turn-end',includeCreationTurn:true},
    {kind:'rounds',rounds:1,expiresAt:'source-turn-start',includeCreationTurn:true},
    {kind:'rounds',rounds:1,expiresAt:'target-turn-start',includeCreationTurn:true},
    {kind:'rounds',rounds:1,expiresAt:'target-turn-end',includeCreationTurn:'yes'},
  ]) {
    const activity={schemaVersion:1,id:'bad',name:'Bad',activation:{kind:'free'},target:{kind:'self'},
      automation:automationCapabilityFromLegacyStatus('full'),outcomes:[{id:'bad',when:{kind:'always'},operations:[
        {id:'bad',kind:'apply-standard-condition',target:'actor',condition:'blinded',duration}]}]} as unknown as Dnd5eActivityDefinitionV1
    expect(validateDnd5eActivityDefinitionV1(activity).some(error=>error.includes('includeCreationTurn'))).toBe(true)
  }
})
