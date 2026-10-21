import {expect,it} from 'vitest'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'
import type {Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'
import {resolveDnd5eActivity,previewDnd5eActivitySavingThrowV1,type Dnd5eActivityActorSnapshot} from './dnd5eActivityExecutor'
import {validateDnd5eActivityDefinitionV1} from './dnd5eActivityValidation'

const familiarity={heard:5,met:0,familiar:-5},connection={none:0,picture:-2,possession:-4,body:-10}
const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'scrying-save',name:'Scrying save mechanics',activation:{kind:'action'},target:{kind:'creature',relation:'any',count:1},
 choices:[{id:'familiarity',label:'Knowledge',options:Object.keys(familiarity).map(id=>({id,label:id}))},
  {id:'connection',label:'Connection',options:Object.keys(connection).map(id=>({id,label:id}))}],
 checks:[{id:'save',kind:'saving-throw',rollId:'save',ability:'wis',dc:{kind:'constant',value:16},allowWillingFailure:true,
  modifierByChoice:[{choiceId:'familiarity',modifiers:familiarity},{choiceId:'connection',modifiers:connection}]}],
 effects:[{schemaVersion:1,id:'retry-protection',name:'Retry protection',stacking:'unique-by-source',duration:{kind:'rounds',rounds:14400,expiresAt:'source-turn-end'}}],
 outcomes:[{id:'success',when:{kind:'check',checkId:'save',result:'success'},operations:[{id:'protect',kind:'apply-effect',target:'target',effectId:'retry-protection'}]}],
 automation:automationCapabilityFromLegacyStatus('partial')}
const actor:Dnd5eActivityActorSnapshot={id:'caster',controller:'players',level:14,proficiencyBonus:5,abilities:{str:10,dex:10,con:10,int:10,wis:16,cha:10},armorClass:12,conditions:[],currentHp:20,maxHp:20}
const target:Dnd5eActivityActorSnapshot={...actor,id:'target',controller:'dm',savingThrowModifiers:{wis:2}}

it('adds all twelve knowledge/connection combinations to the actual save, retaining the printed DC and matching preview',()=>{
 expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
 for(const [knowledge,a] of Object.entries(familiarity))for(const [link,b] of Object.entries(connection))for(const die of [1,10,20]){
  const input={activity:JSON.parse(JSON.stringify(activity)),actor,targets:[target],choices:{familiarity:knowledge,connection:link},rolls:{save:{values:[die]}}}
  const result=resolveDnd5eActivity(input)
  expect(result.ok).toBe(true);if(!result.ok)throw Error(JSON.stringify(result))
  expect(result.checks[0]).toMatchObject({modifier:2+a+b,total:die+2+a+b,dc:16,success:die+2+a+b>=16})
  expect(previewDnd5eActivitySavingThrowV1(input,'save','target')).toEqual(result.checks[0])
  expect(result.proposals.length).toBe(die+2+a+b>=16?1:0)
 }
})

it('honors explicit willing failure without rolling or creating successful-save protection',()=>{
 const result=resolveDnd5eActivity({activity,actor,targets:[target],choices:{familiarity:'heard',connection:'none'},rolls:{},willingTargetIds:['target']})
 expect(result.ok).toBe(true);if(!result.ok)throw Error(JSON.stringify(result))
 expect(result.checks[0]).toMatchObject({success:false,automaticOutcome:'allied-unresisted-failure',d20:0,dc:16})
 expect(result.proposals).toEqual([])
})

it('rejects unbounded, incomplete or unknown tables and invalid choices',()=>{
 for(const modifiers of [{heard:5,met:0},{heard:5,met:0,familiar:-5,invented:99},{heard:5,met:0,familiar:-101},{heard:5,met:0,familiar:1.5}]){
  const invalid=structuredClone(activity)
  Object.assign(invalid.checks![0],{modifierByChoice:[{choiceId:'familiarity',modifiers}]})
  expect(validateDnd5eActivityDefinitionV1(invalid).some(error=>error.includes('modifierByChoice'))).toBe(true)
 }
 const invalidChoices:Record<string,string>[]=[{familiarity:'invented',connection:'none'},{familiarity:'heard'}]
 for(const choices of invalidChoices){
  expect(resolveDnd5eActivity({activity,actor,targets:[target],choices,rolls:{save:{values:[10]}}}).ok).toBe(false)
 }
})
