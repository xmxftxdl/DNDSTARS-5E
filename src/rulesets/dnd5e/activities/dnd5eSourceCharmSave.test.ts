import {expect,it} from 'vitest'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'
import {resolveDnd5eActivity,type Dnd5eActivityActorSnapshot} from './dnd5eActivityExecutor'
import type {Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'
import {validateDnd5eActivityDefinitionV1} from './dnd5eActivityValidation'
import {planDnd5eAutomaticAlliedSavingThrowRolls} from './dnd5eActivityAutomaticRolls'

const actor:Dnd5eActivityActorSnapshot={id:'bard',controller:'player',level:6,proficiencyBonus:3,
 abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:16},armorClass:10,currentHp:20,maxHp:20,conditions:[]}
const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'source-charm-save',name:'Source charm save',
 activation:{kind:'free'},target:{kind:'creature',relation:'any',count:1,rangeFeet:60},automation:automationCapabilityFromLegacyStatus('full'),
 checks:[{id:'save',kind:'saving-throw',rollId:'save',ability:'wis',dc:{kind:'constant',value:14},scope:'per-target',rollMode:'normal',automaticFailureIfCharmedByActor:true}],
 outcomes:[{id:'failed',when:{kind:'check',checkId:'save',result:'failure'},operations:[{id:'mark',kind:'temporary-hit-points',target:'target',amount:{kind:'constant',value:1}}]}]}

it.each([
 {charmed:true,sources:['bard'],fails:true},
 {charmed:true,sources:['other'],fails:false},
 {charmed:true,sources:[],fails:false},
 {charmed:false,sources:['bard'],fails:false},
 {charmed:true,sources:['other','bard'],fails:true},
])('uses current charm and exact actor identity: %j',({charmed,sources,fails})=>{
 expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
 const snapshot={...actor,id:'target',controller:actor.controller,conditions:charmed?['charmed' as const]:[],charmedByActorIds:sources}
 const plan=planDnd5eAutomaticAlliedSavingThrowRolls({activity,actor,targets:[snapshot],
  declarations:[{id:'save:target',label:'save',count:1,sides:20}]})
 expect(plan.declarations).toHaveLength(fails?0:1)
 expect(Object.keys(plan.automaticRolls)).toEqual(fails?['save:target']:[])
 const result=resolveDnd5eActivity({activity:JSON.parse(JSON.stringify(activity)),actor,
  targets:[snapshot],
  distanceFeetByTargetId:{target:5},rolls:fails?plan.automaticRolls:{'save:target':{values:[20]}}})
 expect(result.ok,JSON.stringify(result)).toBe(true)
 if(result.ok){expect(result.checks[0].success).toBe(!fails);expect(result.checks[0].automaticOutcome).toBe(fails?'source-charm-failure':undefined)}
})

it('rejects malformed source charm declarations',()=>{
 for(const value of [false,'true',1]){
  const invalid=structuredClone(activity);Object.assign(invalid.checks![0],{automaticFailureIfCharmedByActor:value})
  expect(validateDnd5eActivityDefinitionV1(invalid).some(error=>error.includes('automaticFailureIfCharmedByActor'))).toBe(true)
 }
})

it('validates imported feature spell references and their operation boundaries',()=>{
 const valid:Dnd5eActivityDefinitionV1={...structuredClone(activity),activation:{kind:'bonus-action'},
  spellInvocation:{spellId:'command',castAtLevel:1,operationIds:['mark']}}
 expect(validateDnd5eActivityDefinitionV1(JSON.parse(JSON.stringify(valid)))).toEqual([])
 for(const invocation of [false,[],{},
  {...valid.spellInvocation,spellId:'../command'},
  {...valid.spellInvocation,castAtLevel:-1},
  {...valid.spellInvocation,castAtLevel:10},
  {...valid.spellInvocation,castAtLevel:1.5},
  {...valid.spellInvocation,operationIds:undefined},
  {...valid.spellInvocation,operationIds:[]},
  {...valid.spellInvocation,operationIds:['mark','mark']},
  {...valid.spellInvocation,operationIds:['missing']},
  {...valid.spellInvocation,operationIds:[null]},
 ]){
  const malformed=Object.assign(structuredClone(valid),{spellInvocation:invocation})
  expect(validateDnd5eActivityDefinitionV1(malformed).some(error=>error.includes('spellInvocation'))).toBe(true)
 }
 for(const outcomes of [null,{},[null],[{operations:null}],[{operations:[null]}]]){
  const malformed=Object.assign(structuredClone(valid),{outcomes})
  expect(validateDnd5eActivityDefinitionV1(malformed).some(error=>error.includes('spellInvocation'))).toBe(true)
 }
 expect(validateDnd5eActivityDefinitionV1({...valid,activation:{kind:'free'}}).some(error=>error.includes('spellInvocation'))).toBe(true)
})
