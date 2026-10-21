import { expect,it } from 'vitest'
import { normalizeStructureStairPath } from '../../shared/structure-stair-path.mjs'
import { validateGeometryStructure } from '../../shared/map-geometry-kernel.mjs'
import { createEmptyMapGeometry,normalizeMapGeometry } from './mapGeometry'
import { mapStairWalkingEdges,mapStairSupportingElevation } from './mapStairPaths'
import { dnd5eEntitySupportElevation } from '../rulesets/dnd5e/entitySupport'
import type { BattleMap } from '../store/maps'
import { findMapGeometryPath,createMapGeometryPathTree } from './mapPathfinding'

const path={schemaVersion:1 as const,widthFeet:5,points:[{x:25,y:25,elevationFeet:0},{x:75,y:25,elevationFeet:5},{x:125,y:25,elevationFeet:10.5}]}
function fixture(){
  const geometry=createEmptyMapGeometry('stairs',1)
  geometry.obstacles=[{id:'stairs',kind:'obstacle',label:'Stairs',points:[{x:0,y:0},{x:150,y:0},{x:150,y:50},{x:0,y:50}],
    baseHeightFeet:0,heightFeet:0,cover:'none',blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,createdAt:1,stairPath:path,
    dnd5eDurability:{hitPoints:180,maxHitPoints:180,damageThreshold:0}}]
  const map:BattleMap={id:'stairs',name:'Stairs',width:200,height:200,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[]}
  return {map,geometry}
}
it('retains stair geometry across client/server validation and JSON reload without sharing input points',()=>{
  const {geometry}=fixture()
  expect(validateGeometryStructure(geometry)).toEqual([])
  const restored=normalizeMapGeometry(JSON.parse(JSON.stringify(geometry)))!
  expect(restored.obstacles[0].stairPath).toEqual(path)
  const cloned=normalizeStructureStairPath(path)!
  cloned.points[0].x=80
  expect(path.points[0].x).toBe(25)
})
it('rejects malformed, vertical teleport and nonmonotonic stair routes at both validation boundaries',()=>{
  for(const invalid of [{...path,widthFeet:0},{...path,points:[path.points[0]]},
    {...path,points:[path.points[0],{...path.points[0],elevationFeet:10}]},
    {...path,points:[path.points[0],path.points[1],{...path.points[2],elevationFeet:0}]},
    {...path,points:[path.points[0],{...path.points[1],elevationFeet:NaN}]},
    {...path,points:Array(65).fill(path.points[0])}]){
    const {geometry}=fixture()
    geometry.obstacles[0].stairPath=invalid
    expect(normalizeStructureStairPath(invalid)).toBeUndefined()
    expect(normalizeMapGeometry(geometry)).toBeUndefined()
    expect(validateGeometryStructure(geometry).length).toBeGreaterThan(0)
  }
})
it('produces paid bidirectional walking segments and excludes narrow, destroyed or off-map stairs',()=>{
  const {map,geometry}=fixture()
  const edges=mapStairWalkingEdges(map,geometry,5)
  expect(edges.map(edge=>edge.distanceFeet)).toEqual([5,5,5.5,5.5])
  expect(edges[0].from).toEqual(edges[1].to)
  expect(mapStairWalkingEdges(map,geometry,10)).toEqual([])
  expect(mapStairWalkingEdges({...map,width:100},geometry,5)).toEqual([])
  geometry.obstacles[0].dnd5eDurability!.hitPoints=0
  expect(mapStairWalkingEdges(map,geometry,5)).toEqual([])
})

it('walks stairs in both directions with matching previews and movement costs, respecting walls and occupants',()=>{
  const {map,geometry}=fixture()
  const token={id:'walker',type:'player' as const,label:'Walker',color:'',emoji:'',size:1,x:25,y:25,elevationFeet:0}
  const input={map,geometry,token,targetElevationFeet:10.5}
  const result=findMapGeometryPath({...input,to:{x:125,y:25}})
  expect(result).toMatchObject({elevationsFeet:[0,5,10.5],distanceFeet:10.5,movementCostFeet:11})
  expect(dnd5eEntitySupportElevation({map,geometry,token:{...token,x:75,elevationFeet:5},terrainElevationFeet:0,elevationFeet:5})).toBe(5)
  expect(mapStairSupportingElevation({map,geometry,position:{x:75,y:25},elevationFeet:0,creatureWidthFeet:5})).toBeUndefined()
  expect(mapStairSupportingElevation({map,geometry,position:{x:75,y:50},elevationFeet:5,creatureWidthFeet:5})).toBeUndefined()
  expect(createMapGeometryPathTree({...input,maximumMovementCostFeet:11}).pathTo({x:125,y:25})).toMatchObject({elevationsFeet:result!.elevationsFeet,distanceFeet:10.5,movementCostFeet:11})
  expect(createMapGeometryPathTree({...input,maximumMovementCostFeet:10}).pathTo({x:125,y:25})).toBeUndefined()
  expect(findMapGeometryPath({...input,token:{...token,x:125,elevationFeet:10.5},to:{x:25,y:25},targetElevationFeet:0})).toMatchObject({elevationsFeet:[10.5,5,0],distanceFeet:10.5,movementCostFeet:11})
  map.tokens=[{...token,id:'blocker',x:75,elevationFeet:5,type:'enemy'}]
  expect(findMapGeometryPath({...input,to:{x:125,y:25}})).toBeUndefined()
  map.tokens=[]
  geometry.walls=[{id:'wall',kind:'wall',label:'Wall',points:[{x:50,y:0},{x:50,y:200}],baseHeightFeet:0,heightFeet:30,
    blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,createdAt:1}]
  expect(findMapGeometryPath({...input,to:{x:125,y:25}})).toBeUndefined()
  geometry.walls=[]
  geometry.obstacles[0].dnd5eDurability!.hitPoints=0
  expect(dnd5eEntitySupportElevation({map,geometry,token:{...token,x:75,elevationFeet:5},terrainElevationFeet:0,elevationFeet:5})).toBe(0)
  expect(findMapGeometryPath({...input,to:{x:125,y:25}})).toBeUndefined()
})

it('continues onto the upper floor instead of resetting to the original ground height',()=>{
  const {map,geometry}=fixture()
  geometry.obstacles.push({id:'landing',kind:'obstacle',label:'Upper floor',points:[{x:150,y:0},{x:200,y:0},{x:200,y:50},{x:150,y:50}],
    surfaceMaterial:'stone',baseHeightFeet:10,heightFeet:0.5,cover:'total',blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,createdAt:1})
  const token={id:'walker',type:'player' as const,label:'Walker',color:'',emoji:'',size:1,x:25,y:25,elevationFeet:0}
  const input={map,geometry,token,targetElevationFeet:10.5}
  const result=findMapGeometryPath({...input,to:{x:175,y:25}})
  expect(result).toMatchObject({elevationsFeet:[0,5,10.5,10.5],distanceFeet:15.5,movementCostFeet:16})
  expect(createMapGeometryPathTree({...input,maximumMovementCostFeet:16}).pathTo({x:175,y:25})).toMatchObject({elevationsFeet:result!.elevationsFeet,distanceFeet:15.5,movementCostFeet:16})
})

it('blocks swept bodies between diagonal stair endpoints while allowing vertically separated actors',()=>{
  const {map,geometry}=fixture()
  geometry.obstacles[0].points=[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}]
  geometry.obstacles[0].stairPath={schemaVersion:1,widthFeet:5,points:[{x:25,y:25,elevationFeet:0},{x:75,y:75,elevationFeet:10.5}]}
  const token={id:'walker',type:'player' as const,label:'Walker',color:'',emoji:'',size:1,x:25,y:25,elevationFeet:0}
  const input={map,geometry,token,targetElevationFeet:10.5}
  map.tokens=[{...token,id:'east',x:75,type:'enemy'},{...token,id:'south',y:75,type:'enemy'}]
  expect(findMapGeometryPath({...input,to:{x:75,y:75}})).toBeUndefined()
  expect(createMapGeometryPathTree({...input,maximumMovementCostFeet:11}).pathTo({x:75,y:75})).toBeUndefined()
  for(const blocker of map.tokens)blocker.elevationFeet=100
  expect(findMapGeometryPath({...input,to:{x:75,y:75}})).toMatchObject({elevationsFeet:[0,10.5],distanceFeet:10.5})
  expect(createMapGeometryPathTree({...input,maximumMovementCostFeet:11}).pathTo({x:75,y:75})).toMatchObject({elevationsFeet:[0,10.5],distanceFeet:10.5})
})

it('subdivides a long authored stair flight and checks the intermediate landing cells',()=>{
  const {map,geometry}=fixture()
  geometry.obstacles[0].stairPath={schemaVersion:1,widthFeet:5,points:[{x:25,y:25,elevationFeet:0},{x:175,y:25,elevationFeet:15}]}
  const token={id:'walker',type:'player' as const,label:'Walker',color:'',emoji:'',size:1,x:25,y:25,elevationFeet:0}
  const input={map,geometry,token,targetElevationFeet:15}
  expect(findMapGeometryPath({...input,to:{x:175,y:25}})).toMatchObject({elevationsFeet:[0,5,10,15],distanceFeet:15,movementCostFeet:15})
  expect(createMapGeometryPathTree({...input,maximumMovementCostFeet:15}).pathTo({x:175,y:25})).toMatchObject({elevationsFeet:[0,5,10,15],distanceFeet:15})
  map.tokens=[{...token,id:'middle-blocker',type:'enemy',x:125,elevationFeet:10}]
  expect(findMapGeometryPath({...input,to:{x:175,y:25}})).toBeUndefined()
  expect(createMapGeometryPathTree({...input,maximumMovementCostFeet:15}).pathTo({x:175,y:25})).toBeUndefined()
})
