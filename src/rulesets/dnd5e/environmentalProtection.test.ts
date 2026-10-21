import {expect,it} from 'vitest'
import {normalizeCharacter} from '../../store/characters'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {validateDeclarativeSubclassDefinitionV1,type DeclarativeSubclassDefinitionV1} from './declarativeSubclassAbility'
import {dnd5eCharacterEnvironmentalImmunities} from './environmentalProtection'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,commitDnd5eActivityExecution} from './headlessCombatEngine'
import {dnd5eActivityActorSnapshotFromCombatantV1 as snapshot} from './activities/dnd5eActivityCombatAuthority'
import {resolveDnd5eActivity} from './activities/dnd5eActivityExecutor'
import {dnd5eActivityPerTargetRollDeclarationsV1} from './activities/dnd5eActivityPerTargetRolls'
import {validateDnd5eActivityDefinitionV1} from './activities/dnd5eActivityValidation'
import type {Dnd5eActivityDefinitionV1} from './activities/dnd5eActivityContracts'
import {automationCapabilityFromLegacyStatus} from '../../domain/automation/automationCapability'

const definition=():DeclarativeSubclassDefinitionV1=>({schemaVersion:1,id:'climate',classId:'barbarian',name:'Climate',summary:'Synthetic climate test',
 choiceGroups:[{id:'environment',level:3,name:'Environment',maxSelections:1,replaceOnClassLevelGain:true,
  options:['heat','cold','water'].map(id=>({id,name:id,summary:id}))}],
 abilities:([{id:'heat',hazard:'extreme-heat'},{id:'cold',hazard:'extreme-cold'}] as const).map(({id,hazard})=>({
  schemaVersion:1,id,name:id,description:'Synthetic protection',level:6,trigger:{kind:'passive'},targeting:{kind:'self'},
  predicates:{subclassChoices:[{groupId:'environment',optionId:id}]},mechanic:{kind:'passive-defense',environmentalImmunities:[hazard]},effects:[],automation:'full',
 }))})

it('derives climate protection from current class level and environment, without requiring rage',()=>{
 const dispose=registerDnd5eRulesPlugin({manifest:{id:'test.climate',name:'Climate',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Test',license:'CC0'},setup(api){api.registerDeclarativeSubclass(definition())}})
 try{
  for(const level of [5,6,10])for(const environment of ['heat','cold','water'])for(const raging of [false,true]){
   const hero=normalizeCharacter({id:'hero',name:'Hero',charClass:'野蛮人',level,dnd5eClassLevels:{barbarian:level},
    dnd5eClassChoices:{classes:{barbarian:{subclass:'test.climate:climate',selections:{'test.climate:climate/environment':[environment]}}}},
    dnd5eCombatState:{raging}})
   expect(dnd5eCharacterEnvironmentalImmunities(hero)).toEqual(level<6||environment==='water'?[]:[environment==='heat'?'extreme-heat':'extreme-cold'])
   expect(dnd5eCharacterEnvironmentalImmunities({...hero,dnd5eClassChoices:{classes:{barbarian:{subclass:'berserker'}}}})).toEqual([])
  }
 }finally{dispose()}
})

it.each([[],['fire'],['extreme-cold','extreme-cold'],true])('rejects malformed environmental protection: %j',value=>{
 const candidate=definition()
 Object.assign(candidate.abilities[0].mechanic!,{environmentalImmunities:value})
 expect(()=>validateDeclarativeSubclassDefinitionV1(candidate)).toThrow()
})

it('omits protected dice and commits exhaustion only after an unprotected failed climate save',()=>{
 const dispose=registerDnd5eRulesPlugin({manifest:{id:'test.climate',name:'Climate',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Test',license:'CC0'},setup(api){api.registerDeclarativeSubclass(definition())}})
 try{
  for(const level of [5,6])for(const selected of ['heat','cold'])for(const hazard of ['extreme-heat','extreme-cold'] as const)for(const roll of [1,20]){
   const actor=createDnd5eCombatant({id:'host',name:'Host',controller:'dm',initiative:20,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
   const target=createDnd5eCombatant({...actor,id:'target',name:'Target',initiative:10,classId:'barbarian',level,classLevels:{barbarian:level},subclassId:'test.climate:climate'})
   target.classSelections={'test.climate:climate/environment':[selected]}
   // Even stale supplied feature IDs must not bypass current level/selection checks.
   target.pluginFeatureIds=['test.climate:climate.heat','test.climate:climate.cold']
   const state=startDnd5eHeadlessCombat('climate',[actor,target])
   const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'exposure',name:'Exposure',activation:{kind:'free'},
    target:{kind:'creature',relation:'any',count:1},automation:automationCapabilityFromLegacyStatus('full'),
    checks:[{id:'save',kind:'saving-throw',rollId:'save',ability:'con',dc:{kind:'constant',value:10},rollMode:'host-derived',scope:'per-target',environmentalHazard:hazard}],
    outcomes:[{id:'failure',when:{kind:'check',checkId:'save',result:'failure'},operations:[{id:'exhaustion',kind:'adjust-exhaustion',target:'target',amount:{kind:'constant',value:1}}]}]}
   expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
   const protectedTarget=level>=6&&hazard===`extreme-${selected}`
   const declarations=dnd5eActivityPerTargetRollDeclarationsV1({activity,declarations:[{id:'save',label:'Save',count:1,sides:20}],actor:{...snapshot(actor),controller:'dm'},targets:[{...snapshot(target),controller:'dm'}],combatants:state.combatants,hostSavingThrowMode:()=> 'normal',hostAttackRollMode:()=> 'normal'})
   expect(declarations).toHaveLength(protectedTarget?0:1)
   const resolution=resolveDnd5eActivity({activity,actor:snapshot(actor),targets:[snapshot(target)],rolls:protectedTarget?{}:{'save:target':{values:[roll]}},checkRollModes:{'save:target':'normal'}})
   expect(resolution.ok,JSON.stringify(resolution)).toBe(true)
   if(!resolution.ok)continue
   expect(resolution.checks[0].automaticOutcome).toBe(protectedTarget?'environmental-immunity-success':undefined)
   const result=commitDnd5eActivityExecution(state,{actorId:'host',activityId:activity.id,targetIds:['target'],resolution,source:{kind:'feature',id:'exposure',packageId:'test.climate'}})
   expect(result.ok,JSON.stringify(result)).toBe(true)
   if(result.ok)expect(result.state.combatants.target.exhaustionLevel).toBe(!protectedTarget&&roll===1?1:0)
   expect(state.combatants.target.exhaustionLevel).toBe(0)
  }
 }finally{dispose()}
})
