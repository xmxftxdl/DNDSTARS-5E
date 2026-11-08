import {expect,it} from 'vitest'
import {validateDnd5eActivityDefinitionV1} from './dnd5eActivityValidation'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'
import {matchDnd5eActivityInvocationV1} from './dnd5eActivityInvocation'
import type {Dnd5eActivityDefinitionV1,Dnd5eActivityTriggerContextV1} from './dnd5eActivityContracts'
const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'burst',name:'Synthetic burst',activation:{kind:'special'},invocation:{kind:'triggered',event:'spell-resolved',confirmation:'automatic',retention:'single-event'},target:{kind:'creature',relation:'any',count:1},triggers:[{id:'after-exact-cast',event:'after-cast',activityId:'burst',predicates:[{kind:'event-source',source:'spell',activityId:'exact-cast'}]}],outcomes:[{id:'resolve',when:{kind:'always'},operations:[{id:'damage',kind:'damage',target:'target',amount:{kind:'constant',value:1},damageType:'cold'}]}],automation:automationCapabilityFromLegacyStatus('full')}
const context:Dnd5eActivityTriggerContextV1={eventId:'completion',event:'spell-resolved',source:{kind:'spell',id:'spell-a',activityId:'exact-cast',level:1},eligibleActorIds:['owner'],eligibleTargetIds:['target']}
it.each(['matching','unrelated','missing-source','wrong-kind','wrong-event','other-activity-metadata','alternative-matching','all-alternatives-fail','requirements-still-enforced','confirmation-still-enforced','no-legacy-metadata']as const)('retains declared trigger contextual gates with explicit invocation: %s',mode=>{
 const definition=structuredClone(activity),trigger=structuredClone(context)
 if(mode==='unrelated')trigger.source={kind:'spell',id:'fire-bolt',level:0}
 if(mode==='missing-source')trigger.source={kind:'spell',id:'spell-a',level:1}
 if(mode==='wrong-kind')trigger.source={kind:'feature',id:'feature-a',activityId:'exact-cast'}
 if(mode==='wrong-event')trigger.event='spell-cast'
 if(mode==='other-activity-metadata')definition.triggers![0].activityId='some-other-activity'
 if(mode==='alternative-matching')definition.triggers=[{...definition.triggers![0],id:'other-first',predicates:[{kind:'event-source',source:'spell',activityId:'other-cast'}]},...definition.triggers!]
 if(mode==='all-alternatives-fail'){definition.triggers=[...definition.triggers!,{...definition.triggers![0],id:'other-last',predicates:[{kind:'event-source',source:'spell',activityId:'other-cast'}]}];trigger.source={kind:'spell',id:'spell-a',activityId:'third-cast',level:1}}
 if(mode==='requirements-still-enforced')definition.requirements=[{kind:'spell-used',spellId:'another-spell'}]
 if(mode==='no-legacy-metadata')delete definition.triggers
 expect(validateDnd5eActivityDefinitionV1(definition)).toEqual([])
 const result=matchDnd5eActivityInvocationV1({activity:definition,actorId:'owner',targetIds:['target'],triggerContext:trigger,confirmedBy:mode==='confirmation-still-enforced'?'actor':'system'})
 expect(result.ok).toBe(['matching','other-activity-metadata','alternative-matching','no-legacy-metadata'].includes(mode))
})
