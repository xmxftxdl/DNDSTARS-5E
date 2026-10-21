import {expect,it} from 'vitest'
import {createEmptyMapGeometry} from './mapGeometry'
import type {MapGeometryPoint} from './mapGeometry'
import {findMapGeometryPath,createMapGeometryPathTree} from './mapPathfinding'
import type {BattleMap,Token} from '../store/maps'
import {planEtherealReturn} from './mapEtherealGeometry'

function returnFixture(){
 const token:Token={id:'returner',type:'player',label:'Returner',x:125,y:125,size:1,color:'',emoji:''}
 const map:BattleMap={id:'return',name:'Return',width:250,height:250,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[token]}
 return {map,geometry:createEmptyMapGeometry(map.id),token,at:{x:125,y:125},elevationFeet:0}
}
it.each(['stone','earth','solid','gravel','ice','sand',undefined] as const)('returns from %s matter into a free space and accounts for displacement',material=>{
 const input=returnFixture()
 input.geometry.obstacles=[{id:'solid',kind:'obstacle',label:'Solid',
  points:[{x:100,y:100},{x:150,y:100},{x:150,y:150},{x:100,y:150}],surfaceMaterial:material,
  blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,baseHeightFeet:0,heightFeet:10,cover:'total',createdAt:1}]
 const before=structuredClone(input)
 expect(planEtherealReturn(input)).toEqual({ok:true,displaced:true,position:{x:75,y:75},elevationFeet:0,distanceFeet:5,forceDamage:10})
 expect(input).toEqual(before)
})
it('preserves an unobstructed off-grid airborne position without damage',()=>{
 const input=returnFixture()
 input.at={x:122,y:128};input.elevationFeet=12
 expect(planEtherealReturn(input)).toEqual({ok:true,displaced:false,position:input.at,elevationFeet:12,distanceFeet:0,forceDamage:0})
})
it('ejects from a creature and excludes an occupied nearest destination',()=>{
 const input=returnFixture()
 input.map.tokens.push({...input.token,id:'occupant'},{...input.token,id:'other',x:75,y:75})
 expect(planEtherealReturn(input)).toMatchObject({ok:true,displaced:true,position:{x:125,y:75},distanceFeet:5,forceDamage:10})
})
it('chooses a nearer vertical exit rather than a farther ground cell',()=>{
 const input=returnFixture()
 input.geometry.obstacles=[{id:'low-solid',kind:'obstacle',label:'Solid',points:[{x:100,y:100},{x:150,y:100},{x:150,y:150},{x:100,y:150}],
  surfaceMaterial:'solid',blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,baseHeightFeet:0,heightFeet:2,cover:'total',createdAt:1}]
 expect(planEtherealReturn(input)).toEqual({ok:true,displaced:true,position:input.at,elevationFeet:2,distanceFeet:2,forceDamage:4})
})
it('reports no map exit without moving or damaging anything',()=>{
 const input=returnFixture()
 input.geometry.obstacles=[{id:'solid-map',kind:'obstacle',label:'Solid',points:[{x:0,y:0},{x:250,y:0},{x:250,y:250},{x:0,y:250}],
  blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,baseHeightFeet:0,heightFeet:20000,cover:'total',createdAt:1}]
 const before=structuredClone(input)
 expect(planEtherealReturn(input)).toEqual({ok:false,reason:'no-free-ejection-space'})
 expect(input).toEqual(before)
})
it.each(['wall','open-door'] as const)('retains temple %s collision for ethereal movement in both path solvers',kind=>{
 const token:Token={id:'ghost',type:'player',label:'Ghost',x:25,y:25,size:1,color:'',emoji:'',elevationFeet:5}
 const map:BattleMap={id:'temple',name:'Temple',width:150,height:50,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[token]}
 const geometry=createEmptyMapGeometry(map.id)
 const base={id:'force-boundary',label:'Force',points:[{x:75,y:0},{x:75,y:50}] as [MapGeometryPoint,MapGeometryPoint],blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,baseHeightFeet:0,heightFeet:20,createdAt:1}
 if(kind==='wall')geometry.walls=[{...base,kind:'wall'}]
 else geometry.doors=[{...base,kind:'door',state:'open',openState:'open',lockState:'unlocked',secret:false}]
 const options={map,geometry,token,ignoreGeometryCollision:true,ignoreTokens:true,canFly:true,targetElevationFeet:5}
 const to={x:125,y:25}
 expect(findMapGeometryPath({...options,to})).toBeDefined()
 geometry.structureLifetimes=[{id:'temple',casterId:'caster',createdWorldMinute:0,expiresWorldMinute:1440,entityIds:[base.id],replacementGroup:'temple-of-the-gods',siteKey:'site',
 templeWard:{hostileCreatureTypes:['fiend'],saveDc:18,healingBonus:5,lighting:'none'}}]
 const before=JSON.stringify(geometry)
 expect(findMapGeometryPath({...options,to})).toBeUndefined()
 expect(createMapGeometryPathTree(options).pathTo(to)).toBeUndefined()
 expect(JSON.stringify(geometry)).toBe(before)
 geometry.structureLifetimes=[]
 expect(findMapGeometryPath({...options,to})).toBeDefined()
})
