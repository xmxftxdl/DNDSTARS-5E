import {expect,it} from 'vitest'
import {persistentAreaMovementScope as scope,persistentAreaMovementScopeMatches as matches} from './persistentAreaMovementScope'
it('binds pending exploration movement to its original six-second interval and actor',()=>{
 const input={mapId:'map',actorId:'caster',round:1,worldMinute:100,worldSecondRemainder:0}
 const expected=scope(input)
 expect(matches(expected,scope({...input,worldSecondRemainder:5}))).toBe(true)
 for(const patch of [{worldSecondRemainder:6},{worldMinute:101},{actorId:'other'},{mapId:'other'},{worldMinute:undefined}])expect(matches(expected,scope({...input,...patch}))).toBe(false)
})
it('rejects combat turnover and mode changes during settlement',()=>{
 const input={mapId:'map',actorId:'caster',round:1,combatId:'fight',turnKey:'turn1'}
 const expected=scope(input)
 expect(matches(expected,scope(input))).toBe(true)
 for(const patch of [{round:2},{turnKey:'turn2'},{combatId:'other'},{combatId:undefined}])expect(matches(expected,scope({...input,...patch}))).toBe(false)
 expect(matches(scope({mapId:'map',actorId:'caster',round:1,worldMinute:100}),expected)).toBe(false)
})
