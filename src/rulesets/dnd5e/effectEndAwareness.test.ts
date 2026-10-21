import {expect,it} from 'vitest'
import {createDnd5eConditionEffect,normalizeDnd5eActiveEffects,removeDnd5eActiveEffectsByIds,retainDnd5eEndedEffectAwareness,validateDnd5eActiveEffectsStrict} from './activeEffects'
import {dnd5eActiveAttitudeTowardSource} from './sourceCharmEligibility'
import {dnd5eTokenStatusMarkersFromActiveEffects} from './tokenStatusMarkers'
function charm(source='caster') {return createDnd5eConditionEffect({id:'charm-'+source,condition:'charmed',targetId:'target',
 source:{kind:'spell',actorId:source,actorName:source,magical:true},sourceAttitude:'friendly',onEndAwareness:'charmed-by-source',
 duration:{type:'rounds',remainingRounds:600,tickOn:'target-turn-start'},appliedAt:100})}
it('only creates awareness when charm ends; suspension or retaining the effect is not an ending',()=>{
 const original=charm()
 expect(retainDnd5eEndedEffectAwareness([original],[original])).toEqual([original])
 const suspended={...original,suspendedBy:['antimagic']}
 expect(retainDnd5eEndedEffectAwareness([original],[suspended])).toEqual([suspended])
})
it('preserves one nonmagical source record across expiry, JSON reload and repeated removal',()=>{
 const original=charm(),removed=removeDnd5eActiveEffectsByIds({effects:[original],ids:[original.id]})
 expect(removed.removed).toEqual([original])
 const saved=normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify(removed.effects)))
 expect(saved).toHaveLength(1)
 expect(saved[0]).toMatchObject({definitionId:'awareness:charmed-by-source',kind:'mark',source:{actorId:'caster',magical:false,kind:'system'},duration:{type:'permanent'}})
 expect(saved[0].standardCondition).toBeUndefined();expect(saved[0].sourceAttitude).toBeUndefined();expect(saved[0].onEndAwareness).toBeUndefined()
 expect(dnd5eActiveAttitudeTowardSource(saved,{actorId:'caster'})).toBeUndefined()
 expect(removeDnd5eActiveEffectsByIds({effects:saved,ids:[original.id]}).effects).toEqual(saved)
 expect(retainDnd5eEndedEffectAwareness([original],saved)).toEqual(saved)
 expect(dnd5eTokenStatusMarkersFromActiveEffects(saved)[0]?.label).toContain('知晓曾被caster魅惑')
})
it('records distinct charmers independently without duplicating an already known source',()=>{
 const first=charm(),second=charm('other'),third={...charm(),id:'another-cast'}
 const ended=retainDnd5eEndedEffectAwareness([first,second,third],[])
 expect(ended).toHaveLength(2);expect(ended.map(e=>e.source.actorId)).toEqual(['caster','other'])
})
it('allows the DM to clear an awareness annotation without recreating it',()=>{
 const ended=retainDnd5eEndedEffectAwareness([charm()],[])
 expect(removeDnd5eActiveEffectsByIds({effects:ended,ids:ended.map(e=>e.id)}).effects).toEqual([])
})
it('does not infer awareness from an ordinary charm or another condition',()=>{
 expect(retainDnd5eEndedEffectAwareness([{...charm(),onEndAwareness:undefined}],[])).toEqual([])
 expect(retainDnd5eEndedEffectAwareness([{...charm(),standardCondition:'poisoned'}],[])).toEqual([])
})
it.each(['anything',true])('rejects invalid persisted end-awareness %j',value=>{
 expect(validateDnd5eActiveEffectsStrict([{...charm(),onEndAwareness:value}]).ok).toBe(false)
})
