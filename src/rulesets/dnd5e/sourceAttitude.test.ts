import {expect,it} from 'vitest'
import {createDnd5eConditionEffect,normalizeDnd5eActiveEffects,validateDnd5eActiveEffectsStrict,removeDnd5eActiveEffectsByIds} from './activeEffects'
import {dnd5eActiveAttitudeTowardSource} from './sourceCharmEligibility'
import {dnd5eActiveEffectMechanicalDescription} from './activeEffectPresentation'
import {validateDnd5eActivityDefinitionV1} from './activities/dnd5eActivityValidation'
import type {Dnd5eActivityDefinitionV1} from './activities/dnd5eActivityContracts'
import {automationCapabilityFromLegacyStatus} from '../../domain/automation/automationCapability'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import Dnd5eActiveEffectDetailsDialog from '../../components/map/Dnd5eActiveEffectDetailsDialog'
function effect(){return createDnd5eConditionEffect({id:'friendly-effect',condition:'charmed',sourceAttitude:'friendly',targetId:'target',
 source:{kind:'spell',actorId:'caster',characterId:'caster-sheet',actorName:'施法者甲'},duration:{type:'rounds',remainingRounds:600,tickOn:'target-turn-start'}})}
it('persists friendly attitude toward its actual source only, including the same character on another map',()=>{
 const saved=normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify([effect()])))
 expect(saved[0].sourceAttitude).toBe('friendly')
 expect(dnd5eActiveAttitudeTowardSource(saved,{actorId:'caster'})).toBe('friendly')
 expect(dnd5eActiveAttitudeTowardSource(saved,{actorId:'new-token',characterId:'caster-sheet'})).toBe('friendly')
 expect(dnd5eActiveAttitudeTowardSource(saved,{actorId:'caster-ally'})).toBeUndefined()
 expect(dnd5eActiveAttitudeTowardSource(saved,{actorId:'target'})).toBeUndefined()
 expect(dnd5eActiveEffectMechanicalDescription(saved[0])).toContain('视施法者甲为友好')
})
it('suspends attitude with its magical effect and removes it when that effect ends',()=>{
 const original=effect()
 expect(dnd5eActiveAttitudeTowardSource([{...original,suspendedBy:['antimagic']}],{actorId:'caster'})).toBeUndefined()
 expect(dnd5eActiveAttitudeTowardSource([original],{actorId:'caster'},true)).toBeUndefined()
 const removed=removeDnd5eActiveEffectsByIds({effects:[original],ids:[original.id]})
 expect(dnd5eActiveAttitudeTowardSource(removed.effects,{actorId:'caster'})).toBeUndefined()
 expect(dnd5eActiveAttitudeTowardSource([original],{actorId:'caster'})).toBe('friendly')
})
it('shows the named source relationship in the actual effect-details component',()=>{
 const html=renderToStaticMarkup(createElement(Dnd5eActiveEffectDetailsDialog,{targetName:'目标乙',effects:[effect()],onClose:()=>{}}))
 expect(html).toContain('视施法者甲为友好')
 expect(html).toContain('目标乙')
})
it.each(['hostile',true,{actorId:'forged'}])('rejects unsupported persisted source attitude %j',value=>{
 expect(validateDnd5eActiveEffectsStrict([{...effect(),sourceAttitude:value}]).ok).toBe(false)
})
it('rejects an attitude without a bound source and invalid imported declaration values',()=>{
 expect(validateDnd5eActiveEffectsStrict([{...effect(),source:{kind:'spell'}}]).ok).toBe(false)
 const definition:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'test',name:'Test',activation:{kind:'action'},target:{kind:'self'},
  outcomes:[{id:'apply',when:{kind:'always'},operations:[{id:'apply',kind:'apply-effect',effectId:'friend',target:'actor'}]}],
  effects:[{schemaVersion:1,id:'friend',name:'Friend',duration:{kind:'permanent'},stacking:'replace',sourceAttitude:'friendly'}],automation:automationCapabilityFromLegacyStatus('full')}
 expect(validateDnd5eActivityDefinitionV1(definition)).toEqual([])
 Object.assign(definition.effects![0],{sourceAttitude:'hostile'})
 expect(validateDnd5eActivityDefinitionV1(definition).some(s=>s.includes('sourceAttitude'))).toBe(true)
})
