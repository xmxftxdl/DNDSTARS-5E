import {expect,it} from 'vitest'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'
import type {Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'
import {collectDnd5eActivitySaveFactsV1,dnd5eHostSaveFactsV1,dnd5eActivitySaveFactInterruptIdV1} from './dnd5eActivitySaveFacts'

const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'assessed-save',name:'Assessed save',activation:{kind:'action'},
 target:{kind:'creature',relation:'any',count:1,rangeFeet:30},
 checks:[{id:'save',kind:'saving-throw',rollId:'save',ability:'wis',scope:'per-target',dc:{kind:'constant',value:16},
  rollModeByHostFact:{id:'engaged',label:'Is the target engaged?',mode:'advantage'}}],outcomes:[],
 automation:automationCapabilityFromLegacyStatus('full')}

it('reattaches to the same fact but isolates transactions, activities, targets and facts',()=>{
 const parts=['request','activity','target','fact'] as const
 const original=dnd5eActivitySaveFactInterruptIdV1(...parts)
 expect(dnd5eActivitySaveFactInterruptIdV1(...parts)).toBe(original)
 for(let i=0;i<parts.length;i++){
  const changed:[string,string,string,string]=[...parts];changed[i]+=':other'
  expect(dnd5eActivitySaveFactInterruptIdV1(...changed)).not.toBe(original)
 }
 expect(dnd5eActivitySaveFactInterruptIdV1('a:b','c','d','e')).not.toBe(dnd5eActivitySaveFactInterruptIdV1('a','b:c','d','e'))
})

it.each([true,false])('retains Host answer %s through the UI empty-choice normalization without accepting changed choices or serialized claims',async answer=>{
 const action={actorId:'caster',pluginId:'test.save-fact',actionId:activity.id,transactionId:'request',targetId:'target',
  targetIds:['target'],payload:{activityCastLevel:4} as Record<string,unknown>}
 expect(await collectDnd5eActivitySaveFactsV1({action,activity,targets:[{id:'target',label:'Target'}],decide:async()=>answer})).toBe(true)
 action.payload={...action.payload,activityChoices:{}}
 expect(dnd5eHostSaveFactsV1({...action})).toEqual({target:{engaged:answer}})
 expect(dnd5eHostSaveFactsV1(JSON.parse(JSON.stringify(action)))).toBeUndefined()
 action.payload.activityChoices={mode:'different'}
 expect(dnd5eHostSaveFactsV1(action)).toBeUndefined()
})

it('rejects target changes even when choices are normalized at the same time',async()=>{
 const action={actorId:'caster',pluginId:'test.save-fact',actionId:activity.id,transactionId:'request',targetId:'target',
  targetIds:['target'],payload:{} as Record<string,unknown>}
 await collectDnd5eActivitySaveFactsV1({action,activity,targets:[{id:'target',label:'Target'}],decide:async()=>true})
 action.payload.activityChoices={};action.targetId='other';action.targetIds=['other']
 expect(dnd5eHostSaveFactsV1(action)).toBeUndefined()
})
