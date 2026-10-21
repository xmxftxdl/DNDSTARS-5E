import {expect,it} from 'vitest'
import {dnd5eActivityControlUnavailableReason as reason} from './dnd5eActivityControlAvailability'
import {normalizeCharacter} from '../../../store/characters'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'
import type {Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'
const character=normalizeCharacter({charClass:'德鲁伊',level:8,dnd5eClassLevels:{druid:4,fighter:4},abilities:{str:10,dex:10,con:10,int:10,wis:16,cha:10},classResources:{pool:{current:2,max:4}}})
const activity: Dnd5eActivityDefinitionV1={schemaVersion:1,id:'availability',name:'Availability',activation:{kind:'free'},target:{kind:'self'},outcomes:[],automation:automationCapabilityFromLegacyStatus('full'),requirements:[{kind:'class-level',classId:'druid',minimum:4},{kind:'resource',resourceId:'pool',minimum:{kind:'constant',value:2}}],consumption:[{kind:'resource',resourceId:'pool',amount:{kind:'constant',value:2},consumeOn:'resolve'}]}
it('uses class level rather than total level and updates resource availability',()=>{
 expect(reason(activity,character)).toBeUndefined()
 expect(reason({...activity,requirements:[{kind:'class-level',classId:'druid',minimum:6}]},character)).toBe('职业等级不足')
 expect(reason(activity,{...character,classResources:{pool:{current:1,max:4}}})).toBe('资源不足')
 expect(reason(activity,{...character,classResources:{}})).toBe('资源不足')
})
it('aggregates same-pool costs while leaving unknown target-dependent costs to Host',()=>{
 expect(reason({...activity,consumption:[...activity.consumption!,...activity.consumption!]},character)).toBe('资源不足')
 expect(reason({...activity,consumption:[{kind:'resource',resourceId:'pool',amount:{kind:'reference',reference:{kind:'target-level'}},consumeOn:'resolve'}]},character)).toBeUndefined()
})
