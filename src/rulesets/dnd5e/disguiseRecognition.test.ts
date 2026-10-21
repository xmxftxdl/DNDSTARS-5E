import {expect,it} from 'vitest'
import {createDnd5eMechanicalEffect,normalizeDnd5eActiveEffects,validateDnd5eActiveEffectsStrict} from './activeEffects'
import {recognizeDnd5eGrantingDisguise} from './disguiseRecognition'
it('persists observers on this disguise, rejects false authority, and preserves the original input',()=>{
 const effect={...createDnd5eMechanicalEffect({definitionId:'disguise',label:'Disguise',targetId:'bard',source:{kind:'feature',actorId:'bard',pluginId:'test.disguise'},duration:{type:'rounds',remainingRounds:600,tickOn:'target-turn-end'},modifiers:{}}),disguisedCreatureIdentity:{actorId:'corpse',name:'Person'},grantedActivities:['contest']}
 const input={effects:[effect],effectId:effect.id,packageId:'test.disguise',activityId:'contest',actorId:'bard',observerId:'observer'}
 const before=structuredClone(input)
 const result=recognizeDnd5eGrantingDisguise(input)!
 expect(result[0].disguiseRecognizedByActorIds).toEqual(['observer'])
 expect(result[0].duration).toEqual(effect.duration)
 expect(result[0].disguisedCreatureIdentity).toEqual(effect.disguisedCreatureIdentity)
 expect(input).toEqual(before)
 const saved=normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify(result)))
 expect(saved[0].disguiseRecognizedByActorIds).toEqual(['observer'])
 expect(validateDnd5eActiveEffectsStrict(saved).ok).toBe(true)
 expect(recognizeDnd5eGrantingDisguise({...input,effects:saved})![0].disguiseRecognizedByActorIds).toEqual(['observer'])
 expect(recognizeDnd5eGrantingDisguise({...input,effects:saved,observerId:'other'})![0].disguiseRecognizedByActorIds).toEqual(['observer','other'])
 for(const patch of [{effectId:'forged'},{packageId:'other'},{activityId:'other'},{observerId:'bard'},{actorId:'other'},{effects:[]},{effects:[{...effect,disguisedCreatureIdentity:undefined}]}])expect(recognizeDnd5eGrantingDisguise({...input,...patch})).toBeUndefined()
 // A new disguise starts from its newly applied effect; the corpse or stable definition does not carry recognition forward.
 expect(normalizeDnd5eActiveEffects([effect])[0].disguiseRecognizedByActorIds).toBeUndefined()
 for(const bad of [[''],[42],Array(1001).fill('observer'),'observer'])expect(validateDnd5eActiveEffectsStrict([{...effect,disguiseRecognizedByActorIds:bad}]).ok).toBe(false)
 expect(validateDnd5eActiveEffectsStrict([{...effect,disguisedCreatureIdentity:undefined,disguiseRecognizedByActorIds:['observer']}]).ok).toBe(false)
})
