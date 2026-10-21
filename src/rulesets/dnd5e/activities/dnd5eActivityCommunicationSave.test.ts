import {expect,it} from 'vitest'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'
import {applyDnd5eStandardConditionEffect,createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction,dnd5eCombatantPairKey} from '../headlessCombatEngine'
import {registerDnd5eRulesPlugin} from '../pluginApi'
import {registerDnd5eActivityPackage} from './dnd5eActivityRegistry'
import {compileDnd5eActivityHeadlessAction} from './dnd5eActivityHeadlessCompiler'
import {dnd5ePluginFeatureActionFromActivityV1} from './dnd5eActivityFeatureActionAdapter'
import {dnd5eActivityActorSnapshotFromCombatantV1} from './dnd5eActivityCombatAuthority'
import {resolveDnd5eActivity} from './dnd5eActivityExecutor'
import {dnd5eActivityPerTargetRollDeclarationsV1} from './dnd5eActivityPerTargetRolls'
import {validateDnd5eActivityDefinitionV1} from './dnd5eActivityValidation'
import type {Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'
const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'communication-save',name:'Communication save',activation:{kind:'action'},target:{kind:'creature',relation:'any',count:1,rangeFeet:30},legacySource:{kind:'feature',id:'communication-save'},automation:automationCapabilityFromLegacyStatus('full'),
 consumption:[{kind:'action-economy',economy:'action',amount:1,consumeOn:'resolve'}],
 checks:[{id:'save',kind:'saving-throw',rollId:'save',scope:'per-target',ability:'wis',rollMode:'host-derived',dc:{kind:'constant',value:15},automaticSuccessIfCannotHearSource:true,automaticSuccessIfNoSharedLanguage:true}],
 outcomes:[{id:'failed',when:{kind:'check',checkId:'save',result:'failure'},operations:[{id:'notice',kind:'narrative-prompt',prompt:'Failed save'}]}]}
const make=(id:string)=>createDnd5eCombatant({id,name:id,controller:'dm',initiative:id==='actor'?20:10,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
it.each(['hearing','deaf','silent-source','different-language','alias'] as const)('uses the same automatic save in dice planning, executor and native action: %s',mode=>{
 expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
 const state=startDnd5eHeadlessCombat('communication',[make('actor'),make('target')]);const actor=state.combatants.actor,target=state.combatants.target
 actor.languages=['common'];target.languages=mode==='different-language'?['elvish']:mode==='alias'?['通用语']:['common']
 if(mode==='deaf')applyDnd5eStandardConditionEffect(target,actor,{rulesId:'test-deaf',condition:'deafened',duration:{type:'rounds',remainingRounds:10,tickOn:'target-turn-end'},sourceKind:'feature'},[]);if(mode==='silent-source')actor.soundSuppressed=true
 const auto=['deaf','silent-source','different-language'].includes(mode)
 const snapshots={actor:dnd5eActivityActorSnapshotFromCombatantV1(actor,actor),target:dnd5eActivityActorSnapshotFromCombatantV1(target,actor)}
 const dice=dnd5eActivityPerTargetRollDeclarationsV1({activity,actor:{id:'actor'},targets:[{id:'target'}],combatants:state.combatants,declarations:[{id:'save',label:'Save',count:1,sides:20}],hostSavingThrowMode:()=> 'normal',hostAttackRollMode:()=> 'normal'})
 expect(dice.map(d=>d.id)).toEqual(auto?[]:['save:target'])
 const rolls:Record<string,{values:number[];modifier:number;total:number}>=auto?{}:{'save:target':{values:[1],modifier:0,total:1}}
 const result=resolveDnd5eActivity({activity,actor:snapshots.actor,targets:[snapshots.target],rolls,checkRollModes:{'save:target':'normal'},distanceFeetByTargetId:{target:5}})
 expect(result.ok,result.ok?'':result.reason).toBe(true);if(!result.ok)return
 expect(result.checks[0]).toMatchObject({success:auto,d20:auto?0:1,automaticOutcome:auto?'communication-immunity-success':undefined})
 expect(result.consumptions).toHaveLength(1)
 const packageId='test.communication-save';const registration=registerDnd5eActivityPackage({packageId,packageVersion:'1.0.0',activities:[activity]})
 const dispose=registerDnd5eRulesPlugin({manifest:{id:packageId,name:'Communication',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity));api.registerFeature({id:activity.id,name:activity.name,summary:'Test',description:'Test',automation:'full',action:dnd5ePluginFeatureActionFromActivityV1(activity)})}})
 try{actor.pluginFeatureIds=[`${packageId}:${activity.id}`];state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('actor','target')]:5}
 const native=resolveDnd5eHeadlessAction(state,{type:'plugin',pluginId:packageId,actionId:activity.id,featureId:`${packageId}:${activity.id}`,actorId:'actor',targetId:'target',distanceFeet:5,rolls})
 expect(native.ok,native.ok?'':native.reason).toBe(true)
 if(native.ok){expect(native.state.combatants.actor.turn.actionAvailable).toBe(false);expect(native.events.some(e=>e.type==='activity-narrative-prompt')).toBe(!auto)}
 }finally{dispose();registration.dispose()}
})
it.each(['automaticSuccessIfCannotHearSource','automaticSuccessIfNoSharedLanguage'])('rejects malformed automatic-save flag %s',key=>{
 for(const value of [false,'true',1]){const bad=structuredClone(activity);Object.assign(bad.checks![0],{[key]:value});expect(validateDnd5eActivityDefinitionV1(bad)).toContainEqual(expect.stringContaining(key))}
 const bad=structuredClone(activity);Object.assign(bad.checks![0],{scope:'once'});expect(validateDnd5eActivityDefinitionV1(bad)).toContainEqual(expect.stringContaining(key))
})
