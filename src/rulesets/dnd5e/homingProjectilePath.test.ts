import {findHomingProjectileVolumePath} from './homingProjectileVolumePath'
import {it,expect} from 'vitest'
import {createEmptyMapGeometry,mapGeometryLineOfEffectBlocked,mapGeometryOrdinaryProjectileBlocked} from '../../lib/mapGeometry'
import type {BattleMap,Token} from '../../store/maps'
import {dnd5eHomingProjectilePath} from './homingProjectilePath'
function fixture(){
 const origin:Token={id:'origin',type:'player',label:'Archer',x:25,y:125,size:1,emoji:'A',color:'#fff'}
 const target:Token={...origin,id:'target',type:'enemy',x:225}
 const map:BattleMap={id:'homing',name:'Homing',width:250,height:250,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,feetPerCell:5,tokens:[origin,target]}
 const geometry=createEmptyMapGeometry(map.id,1)
 return {map,geometry,origin,target,maximumFeet:60}
}
it('ignores creature occupancy without moving any creature',()=>{
 const input=fixture();input.map.tokens.push({...input.target,id:'middle',x:125})
 const original=JSON.stringify(input);const path=dnd5eHomingProjectilePath(input)
 expect(path?.distanceFeet).toBe(20);expect(JSON.stringify(input)).toBe(original)
})
it('routes around a finite blocking wall, but cannot cross a sealed partition',()=>{
 const input=fixture();input.geometry.walls=[{id:'wall',kind:'wall',label:'Wall',points:[{x:100,y:50},{x:100,y:200}],edgeIds:['edge'],baseHeightFeet:0,heightFeet:20,blocksVision:true,blocksMovement:true,blocksLineOfEffect:true,createdAt:1}]
 const path=dnd5eHomingProjectilePath(input)
 expect(path).toBeDefined();expect(path!.points.some(point=>point.y<50||point.y>200)).toBe(true)
 input.geometry.walls[0].points=[{x:100,y:0},{x:100,y:250}]
 expect(dnd5eHomingProjectilePath(input)?.elevationsFeet.some(z=>z>0)).toBe(true)
 input.geometry.walls[0].heightFeet=1000
 expect(dnd5eHomingProjectilePath(input)).toBeUndefined()
})
it('rejects out-of-range routes, invalid ranges and accounts for vertical travel',()=>{
 const input=fixture()
 for(const maximumFeet of [0,-1,NaN,Infinity,19])expect(dnd5eHomingProjectilePath({...input,maximumFeet})).toBeUndefined()
 expect(dnd5eHomingProjectilePath({...input,maximumFeet:20})).toBeDefined()
 expect(dnd5eHomingProjectilePath({...input,target:{...input.target,elevationFeet:5}})?.distanceFeet).toBe(25)
})

it('routes between different heights and bounds total horizontal plus vertical distance',()=>{
 const input=fixture(),target={...input.target,elevationFeet:15}
 const path=dnd5eHomingProjectilePath({...input,target})!
 expect(path.distanceFeet).toBe(35)
 expect(path.elevationsFeet.at(-1)).toBe(15)
 expect(dnd5eHomingProjectilePath({...input,target,maximumFeet:34})).toBeUndefined()
 const vertical=dnd5eHomingProjectilePath({...input,target:{...target,x:input.origin.x,y:input.origin.y},maximumFeet:15})!
 expect(vertical.distanceFeet).toBe(15)
})
it('does not call an exhausted search a proven obstruction',()=>{
 const result=findHomingProjectileVolumePath({...fixture(),maximumVisitedNodes:0})
 expect(result.status).toBe('incomplete')
})

it('does not bypass a blocking subcell wall through the planar zero-step shortcut',()=>{
 const input=fixture();input.target.x=45
 input.geometry.walls=[{id:'wall',kind:'wall',label:'Wall',points:[{x:35,y:0},{x:35,y:250}],edgeIds:['edge'],baseHeightFeet:0,heightFeet:1000,blocksVision:true,blocksMovement:true,blocksLineOfEffect:true,createdAt:1}]
 expect(findHomingProjectileVolumePath(input).status).toBe('blocked')
 expect(dnd5eHomingProjectilePath(input)).toBeUndefined()
})

it('routes around and above a wall separating endpoints in one cell',()=>{
 const input=fixture();input.target.x=45
 input.geometry.walls=[{id:'wall',kind:'wall',label:'Wall',points:[{x:35,y:100},{x:35,y:150}],edgeIds:['edge'],baseHeightFeet:0,heightFeet:1000,blocksVision:true,blocksMovement:true,blocksLineOfEffect:true,createdAt:1}]
 const around=findHomingProjectileVolumePath(input)
 expect(around.status).toBe('reached')
 if(around.status!=='reached')return
 expect(around.path.points[0]).toEqual({x:25,y:125})
 expect(around.path.points.at(-1)).toEqual({x:45,y:125})
 expect(around.path.points.some(p=>p.y<100||p.y>150)).toBe(true)
 expect(findHomingProjectileVolumePath({...input,maximumFeet:around.path.distanceFeet-1}).status).toBe('blocked')
 input.geometry.walls[0].points=[{x:35,y:0},{x:35,y:250}]
 input.geometry.walls[0].heightFeet=10
 const above=findHomingProjectileVolumePath(input)
 expect(above.status).toBe('reached')
 if(above.status!=='reached')return
 expect(above.path.elevationsFeet.some(z=>z>=10)).toBe(true)
 expect(above.path.points.at(-1)).toEqual({x:45,y:125})
 expect(above.path.elevationsFeet.at(-1)).toBe(0)
 for(const path of [around.path,above.path]) {
  const geometry=path===around.path?{...input.geometry,walls:[{...input.geometry.walls[0],heightFeet:1000,points:[{x:35,y:100},{x:35,y:150}]}]}:input.geometry
  for(let i=1;i<path.points.length;i++) {
   const from=path.points[i-1],to=path.points[i],fromZ=path.elevationsFeet[i-1],toZ=path.elevationsFeet[i]
   expect(mapGeometryLineOfEffectBlocked({map:input.map,geometry,from,to,fromElevationFeet:fromZ,toElevationFeet:toZ,fromEyeHeightFeet:2.5,toEyeHeightFeet:2.5})).toBe(false)
   expect(mapGeometryOrdinaryProjectileBlocked({map:input.map,geometry,from:{...input.origin,...from,elevationFeet:fromZ},to:{...input.target,...to,elevationFeet:toZ},fromHeightFeet:5,toHeightFeet:5})).toBe(false)
  }
 }
 expect(findHomingProjectileVolumePath({...input,maximumVisitedNodes:0}).status).toBe('incomplete')
})
