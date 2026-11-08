import {it,expect} from 'vitest'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'
import {applyDnd5eStandardConditionEffect,createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction,dnd5eCombatantPairKey} from '../headlessCombatEngine'
import {registerDnd5eRulesPlugin} from '../pluginApi'
import {registerDnd5eActivityPackage} from './dnd5eActivityRegistry'
import {compileDnd5eActivityHeadlessAction} from './dnd5eActivityHeadlessCompiler'
import {dnd5ePluginFeatureActionFromActivityV1} from './dnd5eActivityFeatureActionAdapter'
import {dnd5eActivityActorSnapshotFromCombatantV1} from './dnd5eActivityCombatAuthority'
import {resolveDnd5eActivity} from './dnd5eActivityExecutor'
import {dnd5eActivityPerTargetRollDeclarationsV1} from './dnd5eActivityPerTargetRolls'
import {dnd5eActivityCommunicationSaveSucceeds} from './dnd5eActivityCommunicationSave'
import {validateDnd5eActivityDefinitionV1} from './dnd5eActivityValidation'
import type {Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'

const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'perception-save',name:'Perception save',activation:{kind:'action'},target:{kind:'creature',relation:'any',count:1,rangeFeet:30},legacySource:{kind:'feature',id:'perception-save'},automation:automationCapabilityFromLegacyStatus('full'),consumption:[{kind:'action-economy',economy:'action',amount:1,consumeOn:'resolve'}],checks:[{id:'save',kind:'saving-throw',rollId:'save',scope:'per-target',ability:'wis',rollMode:'host-derived',dc:{kind:'constant',value:15},automaticSuccessIfCannotHearOrSeeSource:true}],outcomes:[{id:'failed',when:{kind:'check',checkId:'save',result:'failure'},operations:[{id:'notice',kind:'narrative-prompt',prompt:'Failed save'}]}]}
const make=(id:string)=>createDnd5eCombatant({id,name:id,controller:'dm',initiative:id==='actor'?20:10,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
for(const hearing of [true,false])for(const sight of [true,false])it(`requires neither hearing nor sight for automatic success: hear=${hearing}, see=${sight}`,()=>{
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  const state=startDnd5eHeadlessCombat('perception',[make('actor'),make('target')]),actor=state.combatants.actor,target=state.combatants.target
  for(const condition of [...(!hearing?['deafened' as const]:[]),...(!sight?['blinded' as const]:[])])applyDnd5eStandardConditionEffect(target,actor,{rulesId:'test-'+condition,condition,duration:{type:'rounds',remainingRounds:10,tickOn:'target-turn-end'},sourceKind:'feature'},[])
  state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('actor','target')]:5}
  const snapshot={...dnd5eActivityActorSnapshotFromCombatantV1(target,actor,state),controller:'dm' as const},source={...dnd5eActivityActorSnapshotFromCombatantV1(actor,actor,state),controller:'dm' as const}
  expect(snapshot.canHearActivitySource).toBe(hearing)
  expect(snapshot.canSeeActivitySource).toBe(sight)
  const auto=!hearing&&!sight
  const dice=dnd5eActivityPerTargetRollDeclarationsV1({activity,actor:source,targets:[snapshot],combatants:state.combatants,declarations:[{id:'save',label:'Save',count:1,sides:20}],hostSavingThrowMode:()=> 'normal',hostAttackRollMode:()=> 'normal'})
  expect(dice.map(d=>d.id)).toEqual(auto?[]:['save:target'])
  const rolls:Record<string,{values:number[];modifier:number;total:number}>=auto?{}:{'save:target':{values:[1],modifier:0,total:1}}
  const result=resolveDnd5eActivity({activity,actor:source,targets:[snapshot],rolls,checkRollModes:{'save:target':'normal'},distanceFeetByTargetId:{target:5}})
  expect(result.ok,result.ok?'':result.reason).toBe(true)
  if(result.ok)expect(result.checks[0]).toMatchObject({success:auto,d20:auto?0:1,automaticOutcome:auto?'communication-immunity-success':undefined})
  const pkg='test.perception-save',registration=registerDnd5eActivityPackage({packageId:pkg,packageVersion:'1.0.0',activities:[activity]})
  const dispose=registerDnd5eRulesPlugin({manifest:{id:pkg,name:'Perception',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity));api.registerFeature({id:activity.id,name:activity.name,summary:'Test',description:'Test',automation:'full',action:dnd5ePluginFeatureActionFromActivityV1(activity)})}})
  try{
    actor.pluginFeatureIds=[`${pkg}:${activity.id}`]
    const native=resolveDnd5eHeadlessAction(state,{type:'plugin',pluginId:pkg,actionId:activity.id,featureId:`${pkg}:${activity.id}`,actorId:'actor',targetId:'target',distanceFeet:5,rolls,payload:{canHearActivitySource:!hearing,canSeeActivitySource:!sight}})
    expect(native.ok,native.ok?'':native.reason).toBe(true)
    if(native.ok){expect(native.state.combatants.actor.turn.actionAvailable).toBe(false);expect(native.events.some(e=>e.type==='activity-narrative-prompt')).toBe(!auto)}
  }finally{dispose();registration.dispose()}
})
it('does not treat unknown perception as immunity and preserves the hear-only declaration',()=>{
  for(const target of [{},{canHearActivitySource:false},{canSeeActivitySource:false}])expect(dnd5eActivityCommunicationSaveSucceeds({automaticSuccessIfCannotHearOrSeeSource:true},{},target)).toBe(false)
  expect(dnd5eActivityCommunicationSaveSucceeds({automaticSuccessIfCannotHearSource:true},{},{canHearActivitySource:false,canSeeActivitySource:true})).toBe(true)
  for(const value of [false,'true',1]){const bad=structuredClone(activity);Object.assign(bad.checks![0],{automaticSuccessIfCannotHearOrSeeSource:value});expect(validateDnd5eActivityDefinitionV1(bad)).toContainEqual(expect.stringContaining('automaticSuccessIfCannotHearOrSeeSource'))}
})
