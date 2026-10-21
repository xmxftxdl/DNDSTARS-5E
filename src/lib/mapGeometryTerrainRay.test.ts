import { expect, it } from 'vitest'
import { createEmptyMapGeometry, mapGeometryTerrainRayImpact, type MapGeometryObstacle } from './mapGeometry'

const region=(id:string,left:number,right:number,elevation:number):MapGeometryObstacle=>({id,kind:'obstacle',label:id,
  points:[{x:left,y:0},{x:right,y:0},{x:right,y:200},{x:left,y:200}],terrainRegion:true,terrainElevationFeet:elevation,
  baseHeightFeet:0,heightFeet:0,blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,cover:'none',createdAt:1})
const from={x:0,y:75},to={x:1000,y:75}

it.each([[40,-40,.5],[20,0,1],[0,-20,0]] as const)('clips a descending ray from %s to %s feet at ground t=%s',(start,end,t)=>{
  expect(mapGeometryTerrainRayImpact({from,to,fromElevationFeet:start,toElevationFeet:end})).toMatchObject({t,elevationFeet:0})
})
it.each([[.1,.1],[0,20],[20,40]] as const)('does not invent a ground hit for clear/ascending flight from %s to %s',(start,end)=>{
  expect(mapGeometryTerrainRayImpact({from,to,fromElevationFeet:start,toElevationFeet:end})).toBeUndefined()
})
it('finds a one-pixel high terrace without ray sampling or a movement-blocking flag',()=>{
  const geometry=createEmptyMapGeometry('ground',1)
  geometry.obstacles=[region('thin-ledge',250,251,10)]
  expect(mapGeometryTerrainRayImpact({geometry,from,to,fromElevationFeet:5,toElevationFeet:5})).toEqual({t:.25,elevationFeet:10,entityId:'thin-ledge'})
})
it('uses the last authored height in overlapping regions',()=>{
  const geometry=createEmptyMapGeometry('ground',1)
  geometry.obstacles=[region('hill',0,1000,20),region('pit',0,1000,-10)]
  expect(mapGeometryTerrainRayImpact({geometry,from:{x:25,y:75},to:{x:25,y:75},fromElevationFeet:10,toElevationFeet:-30})).toEqual({t:.5,elevationFeet:-10,entityId:'pit'})
})
it('hits the far edge of a pit when the projectile cannot clear the surrounding ground',()=>{
  const geometry=createEmptyMapGeometry('ground',1)
  geometry.obstacles=[region('pit',0,250,-10)]
  expect(mapGeometryTerrainRayImpact({geometry,from:{x:25,y:75},to:{x:1025,y:75},fromElevationFeet:-5,toElevationFeet:-5})).toMatchObject({t:.225,elevationFeet:0})
})
it('does not treat a ground difficulty overlay as replacement terrain elevation',()=>{
  const geometry=createEmptyMapGeometry('ground',1)
  geometry.obstacles=[{...region('mud',0,1000,20),terrainRegion:false,traversal:'ground',terrainCostMultiplier:2}]
  expect(mapGeometryTerrainRayImpact({geometry,from,to,fromElevationFeet:5,toElevationFeet:5})).toBeUndefined()
})
