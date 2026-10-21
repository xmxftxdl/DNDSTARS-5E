import { expect,it } from 'vitest'
import { createEmptyMapGeometry,normalizeMapGeometry,mapGeometryPhysicalProjectileImpact,mapGeometryMovementBlocked,mapGeometryPlacementBlocked,mapGeometryLineOfSightBlocked,mapGeometryLineOfEffectBlocked } from '../../lib/mapGeometry'
import { compileGeometryCached,raycastGeometry } from '../../../shared/map-geometry-kernel.mjs'
import { findMapGeometryPath } from '../../lib/mapPathfinding'
import type { BattleMap } from '../../store/maps'
import { placeDnd5eStructureStairs } from './structureStairs'
import { damageGeometryEntity } from '../../../shared/map-geometry-durability.mjs'

const map:BattleMap={id:'stairs',name:'Stairs',width:600,height:600,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[]}
const input={map,geometry:createEmptyMapGeometry(map.id,1),structureId:'building',origin:{x:225,y:25},rotationDegrees:0,elevationFeet:0,createdAt:1,
  stairs:[{id:'flight',from:{x:0,y:0,elevationFeet:0},to:{x:20,y:0,elevationFeet:20},widthFeet:5,thicknessInches:6}]}
it.each([0,90])('generates reloadable, independently destructible stairs at %s degrees used by the real pathfinder',rotationDegrees=>{
  const geometry=normalizeMapGeometry(JSON.parse(JSON.stringify(placeDnd5eStructureStairs({...input,rotationDegrees}))))!
  expect(geometry.obstacles).toHaveLength(2)
  expect(geometry.obstacles[0].dnd5eDurability).toMatchObject({hitPoints:180,armorClass:15,damageImmunities:['poison','psychic']})
  const to=geometry.obstacles[1].stairPath!.points[1]
  const token={id:'walker',label:'Walker',type:'player' as const,color:'',emoji:'',size:1,...input.origin,elevationFeet:0}
  for(let step=0;step<4;step++){
    const angle=rotationDegrees*Math.PI/180
    const from={x:input.origin.x+step*50*Math.cos(angle),y:input.origin.y+step*50*Math.sin(angle)}
    const next={x:input.origin.x+(step+1)*50*Math.cos(angle),y:input.origin.y+(step+1)*50*Math.sin(angle)}
    expect(mapGeometryMovementBlocked({map,geometry,token:{...token,...from},to:next,fromElevationFeet:step*5,toElevationFeet:(step+1)*5}),`step ${step}`).toMatchObject({blocked:false})
  }
  expect(findMapGeometryPath({map,geometry,token,to,targetElevationFeet:20})).toMatchObject({elevationsFeet:[0,5,10,15,20],distanceFeet:20,movementCostFeet:20})
  Object.assign(geometry.obstacles[0],damageGeometryEntity(geometry.obstacles[0],180,'bludgeoning'))
  expect(findMapGeometryPath({map,geometry,token,to,targetElevationFeet:20})).toBeUndefined()
  expect(geometry.obstacles[1].dnd5eDurability!.hitPoints).toBe(180)
  expect(input.geometry.obstacles).toHaveLength(0)
})
it('preserves unsnapped arbitrary rotation and rejects invalid or out-of-map flights atomically',()=>{
  const geometry=placeDnd5eStructureStairs({...input,rotationDegrees:37})
  const end=geometry.obstacles[1].stairPath!.points[1]
  expect(end.x).toBeCloseTo(225+200*Math.cos(37*Math.PI/180))
  expect(end.y).toBeCloseTo(25+200*Math.sin(37*Math.PI/180))
  expect(()=>placeDnd5eStructureStairs({...input,origin:{x:590,y:25}})).toThrow('structure-outside-map')
  expect(()=>placeDnd5eStructureStairs({...input,stairs:[input.stairs[0],input.stairs[0]]})).toThrow('structure-stair-flight-invalid')
  expect(()=>placeDnd5eStructureStairs({...input,geometry})).toThrow('structure-entity-id-conflict')
  expect(input.geometry.obstacles).toHaveLength(0)
})

it('blocks the sloping stone slab while preserving clearance underneath and walking on top',()=>{
  const geometry=normalizeMapGeometry(JSON.parse(JSON.stringify(placeDnd5eStructureStairs(input))))!
  expect(geometry.obstacles[1].stairPath!.thicknessInches).toBe(6)
  const ray=(elevationFeet:number,toElevationFeet=elevationFeet)=>mapGeometryPhysicalProjectileImpact({map,geometry,
    from:{x:375,y:25},to:{x:375,y:25},elevationFeet,toElevationFeet})
  expect(ray(20,10)?.t).toBeCloseTo(0.5)
  expect(ray(14.75)?.entityId).toBe('building:stairs:flight.1')
  expect(ray(10)).toBeUndefined()
  const token={id:'walker',label:'Walker',type:'player' as const,color:'',emoji:'',size:1,x:375,y:25,elevationFeet:0}
  expect(mapGeometryPlacementBlocked({map,geometry,token,at:token,elevationFeet:0}).blocked).toBe(false)
  expect(mapGeometryPlacementBlocked({map,geometry,token,at:token,elevationFeet:11}).blocked).toBe(true)
  expect(mapGeometryPlacementBlocked({map,geometry,token,at:token,elevationFeet:15}).blocked).toBe(false)
  expect(mapGeometryMovementBlocked({map,geometry,token:{...token,x:325,elevationFeet:10},to:{x:375,y:25},fromElevationFeet:10,toElevationFeet:15}).blocked).toBe(false)
  expect(mapGeometryMovementBlocked({map,geometry,token:{...token,y:0,elevationFeet:11},to:{x:375,y:50},fromElevationFeet:11,toElevationFeet:11}).blocked).toBe(true)
  Object.assign(geometry.obstacles[1],damageGeometryEntity(geometry.obstacles[1],180,'bludgeoning'))
  expect(ray(20,10)).toBeUndefined()
  expect(mapGeometryPlacementBlocked({map,geometry,token,at:token,elevationFeet:11}).blocked).toBe(false)
})

it('uses the same stair slab for client and shared server vision and line-of-effect queries',()=>{
  const geometry=normalizeMapGeometry(JSON.parse(JSON.stringify(placeDnd5eStructureStairs({...input,origin:{x:225,y:125}}))))!
  const ray={geometry,from:{x:375,y:50},to:{x:375,y:200},fromElevationFeet:14.75,toElevationFeet:14.75,fromEyeHeightFeet:0,toEyeHeightFeet:0}
  const shared=(purpose:'vision'|'line-of-effect',height=14.75)=>raycastGeometry({...ray,compiled:compileGeometryCached(geometry),purpose,fromElevationFeet:height,toElevationFeet:height,ignoreStart:true})
  expect(shared('vision')?.segment.entityId).toBe('building:stairs:flight.1')
  expect(shared('vision')?.t).toBeCloseTo(1/3)
  expect(shared('line-of-effect')).not.toBeNull()
  expect(mapGeometryLineOfSightBlocked({...ray,map})).toBe(true)
  expect(mapGeometryLineOfEffectBlocked({...ray,map})).toBe(true)
  expect(shared('vision',10)).toBeNull()
  expect(mapGeometryLineOfSightBlocked({...ray,map,fromElevationFeet:10,toElevationFeet:10})).toBe(false)
  expect(raycastGeometry({...ray,purpose:'vision',ignoreSegment:segment=>segment.entityId==='building:stairs:flight.1'})).toBeNull()
  Object.assign(geometry.obstacles[1],damageGeometryEntity(geometry.obstacles[1],180,'bludgeoning'))
  expect(shared('vision')).toBeNull()
  expect(mapGeometryLineOfEffectBlocked({...ray,map})).toBe(false)
})

it.each([0,37,90])('checks the whole body at a rotated stair side rather than only its center (%s degrees)',rotationDegrees=>{
  const geometry=placeDnd5eStructureStairs({...input,origin:{x:225,y:125},rotationDegrees})
  const angle=rotationDegrees*Math.PI/180
  const at=(sideFeet:number)=>({x:225+150*Math.cos(angle)-sideFeet*10*Math.sin(angle),y:125+150*Math.sin(angle)+sideFeet*10*Math.cos(angle)})
  const token={id:'walker',label:'Walker',type:'player' as const,color:'',emoji:'',size:1,...at(4),elevationFeet:11}
  expect(mapGeometryPhysicalProjectileImpact({map,geometry,from:token,to:token,elevationFeet:14.75})).toBeUndefined()
  expect(mapGeometryPlacementBlocked({map,geometry,token,at:token,elevationFeet:11}).blocked).toBe(true)
  expect(mapGeometryPlacementBlocked({map,geometry,token,at:at(8),elevationFeet:11}).blocked).toBe(false)
  expect(mapGeometryMovementBlocked({map,geometry,token:{...token,...at(8)},to:at(4),fromElevationFeet:11,toElevationFeet:11}).blocked).toBe(true)
  Object.assign(geometry.obstacles[1],damageGeometryEntity(geometry.obstacles[1],180,'bludgeoning'))
  expect(mapGeometryPlacementBlocked({map,geometry,token,at:token,elevationFeet:11}).blocked).toBe(false)
})
