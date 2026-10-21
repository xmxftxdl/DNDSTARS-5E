import {expect,it} from 'vitest'
import {mutatePlayerExplorationMoveState} from '../../../scripts/player-exploration-move.mjs'

function run(path:{x:number;y:number}[],height=0,feet=5,dead=false){
 const token={id:'hero',type:'player',characterId:'pc',size:5/feet,...path[0],elevationFeet:height}
 const current={maps:[{id:'map',width:500,height:500,gridSize:50,feetPerCell:feet,tokens:[token],dnd5ePluginAreas:[{
  id:'pillar',anchorCell:{col:2,row:2},cells:[{col:2,row:2}],circularGeometry:{radiusFeet:2.5},blocking:{movement:true},
  vertical:{mode:'volume',baseElevationFeet:0,heightFeet:30},entityProfile:{hitPoints:30},entityCurrentHitPoints:dead?0:30,
 }]}]}
 const before=structuredClone(current)
 const result=mutatePlayerExplorationMoveState(current,{operation:'move-owned-token',mapId:'map',tokenId:'hero',characterId:'pc',expectedPosition:path[0],targetPosition:path.at(-1),path},100,{memberId:'owner'},{characterState:{characters:[{id:'pc',rulesetId:'dnd5e-2014-srd-5.1',roomMemberId:'owner',currentHp:20}]}})
 expect(current).toEqual(before)
 return result
}
it.each([5,10])('rejects direct player requests through the pillar at %s feet per grid',feet=>{
 expect(run([{x:50,y:125},{x:200,y:125}],0,feet)).toMatchObject({ok:false,error:'exploration-move-wall-blocked',changed:false})
})
it('allows a route around a pillar and movement above its top or after destruction',()=>{
 expect(run([{x:50,y:125},{x:50,y:225},{x:200,y:225},{x:200,y:125}]).ok).toBe(true)
 expect(run([{x:50,y:125},{x:200,y:125}],30).ok).toBe(true)
 expect(run([{x:50,y:125},{x:200,y:125}],0,5,true).ok).toBe(true)
})
it('rejects the footprint clipping a pillar even when the token center misses it',()=>{
 expect(run([{x:50,y:160},{x:200,y:160}])).toMatchObject({ok:false,error:'exploration-move-wall-blocked'})
})
