import {it,expect} from 'vitest'
import {advanceDnd5eWithinReachMovement,dnd5eWithinReachMovementDistance} from './withinReachMovementProgress'
const from={x:0,y:0,elevationFeet:0},to={x:0,y:10,elevationFeet:0},attackerPosition={x:10,y:0,elevationFeet:0}
const first={turnKey:'combat:1:a',commitKey:'move:1',from,to,attackerPosition,reachFeet:5,distanceFeet:2.5,voluntary:true,withinReach:true}
it('carries committed distance after serialization and consumes a five-foot window once',()=>{
 const previous=JSON.parse(JSON.stringify(advanceDnd5eWithinReachMovement(first)))
 expect(dnd5eWithinReachMovementDistance({...first,from:to,previous})).toBe(2.5)
 const second={...first,previous,from:to,to:{...to,y:20},commitKey:'move:2'}
 const result=advanceDnd5eWithinReachMovement(second)!
 expect(result.distanceFeet).toBe(0)
 expect(advanceDnd5eWithinReachMovement({...second,previous:result})).toEqual(result)
 expect(previous.distanceFeet).toBe(2.5)
})
it.each(['turn','displaced','attacker-moved','reach-changed','corrupt'] as const)('discards invalid carry-over: %s',mode=>{
 const previous=advanceDnd5eWithinReachMovement(first)!
 const next={...first,from:to,previous}
 if(mode==='turn')next.turnKey='combat:2:a'
 if(mode==='displaced')next.from={...to,x:5}
 if(mode==='attacker-moved')next.attackerPosition={...attackerPosition,x:20}
 if(mode==='reach-changed')next.reachFeet=10
 if(mode==='corrupt')previous.distanceFeet=NaN
 expect(dnd5eWithinReachMovementDistance(next)).toBe(0)
})
it.each(['forced','outside','invalid'] as const)('does not record ineligible travel: %s',mode=>{
 expect(advanceDnd5eWithinReachMovement({...first,voluntary:mode!=='forced',withinReach:mode!=='outside',distanceFeet:mode==='invalid'?NaN:2.5})).toBeUndefined()
})
