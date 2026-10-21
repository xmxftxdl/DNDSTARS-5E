import { expect, it } from 'vitest'
import { createEmptyMapGeometry, mapGeometryPointInPolygon, mapGeometryTerrainElevationAtPoint } from '../../lib/mapGeometry'
import { polygonSignedArea } from '../../lib/convexPolygonPartition'
import { selectLooseEarthExcavation } from './looseEarthExcavation'
import { prepareLooseEarthTransfer } from './looseEarthTransfer'
import type { BattleMap } from '../../store/maps'

const fixture=()=>{
  const geometry=createEmptyMapGeometry('map',1)
  geometry.obstacles.push({id:'soil',kind:'obstacle',label:'Soil',surfaceMaterial:'loose-earth',
    points:[{x:50,y:50},{x:200,y:50},{x:200,y:100},{x:100,y:100},{x:100,y:200},{x:50,y:200}],
    baseHeightFeet:-10,heightFeet:10,terrainElevationFeet:0,terrainRegion:true,cover:'none',
    blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,createdAt:1})
  return geometry
}
it.each([false,true])('excavates within an irregular soil region, conserving all soil (reversed=%s)', reversed=>{
  const geometry=fixture();if(reversed)geometry.obstacles[0].points.reverse()
  const before=structuredClone(geometry)
  const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[]}
  const result=prepareLooseEarthTransfer({map,geometry,anchor:{x:75,y:75},angleDegrees:0,distanceFeet:5,maximumSideFeet:5,executionId:'cast',now:2})
  expect(result).toBeDefined()
  const volume=(g:typeof geometry)=>g.obstacles.reduce((v,o)=>v+Math.abs(polygonSignedArea(o.points))*o.heightFeet,0)
  expect(volume(result!)).toBeCloseTo(volume(geometry))
  expect(result!.obstacles.find(o=>o.id==='cast:soil:below')?.heightFeet).toBe(5)
  expect(geometry).toEqual(before)
})
it('does not invent soil across a missing concave corner',()=>{
  const geometry=fixture()
  const selected=selectLooseEarthExcavation({geometry,source:geometry.obstacles[0],footprint:[{x:75,y:75},{x:125,y:75},{x:125,y:125},{x:75,y:125}],maximumDepthFeet:5,executionId:'cast'})
  expect(selected).toBeDefined()
  expect(Math.abs(polygonSignedArea(selected!.source.points))).toBe(1875)
  expect(mapGeometryPointInPolygon({x:110,y:110},selected!.source.points)).toBe(false)
})
it.each([1,5])('moves concave soil %s feet with equal volume and an intact missing corner',distanceFeet=>{
  const geometry=fixture(), before=structuredClone(geometry)
  const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[]}
  const result=prepareLooseEarthTransfer({map,geometry,anchor:{x:99,y:99},angleDegrees:0,distanceFeet,maximumSideFeet:5,executionId:'concave',now:2})
  expect(result).toBeDefined()
  const volume=(g:typeof geometry)=>g.obstacles.reduce((v,o)=>v+Math.abs(polygonSignedArea(o.points))*o.heightFeet,0)
  expect(volume(result!)).toBeCloseTo(volume(geometry))
  expect(mapGeometryTerrainElevationAtPoint(result!,{x:115+distanceFeet*10,y:115})).toBe(0)
  expect(geometry).toEqual(before)
})
it('rejects self-intersecting soil without mutation',()=>{
  const geometry=fixture();geometry.obstacles[0].points=[{x:50,y:50},{x:100,y:100},{x:50,y:100},{x:100,y:50}]
  expect(selectLooseEarthExcavation({geometry,source:geometry.obstacles[0],footprint:[{x:0,y:0},{x:200,y:0},{x:200,y:200},{x:0,y:200}],maximumDepthFeet:5,executionId:'cast'})).toBeUndefined()
})
it.each([false,true])('checks the actual concave travel area instead of filling its notch (inside=%s)',inside=>{
  const geometry=fixture(), x=inside?90:113,y=113
  geometry.obstacles.push({id:'barrier',kind:'obstacle',label:'Barrier',points:[{x,y},{x:x+2,y},{x:x+2,y:y+2},{x,y:y+2}],baseHeightFeet:0,heightFeet:2,cover:'none',blocksMovement:true,blocksLineOfEffect:true,blocksVision:false,createdAt:1})
  const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[]}
  const result=prepareLooseEarthTransfer({map,geometry,anchor:{x:99,y:99},angleDegrees:0,distanceFeet:1,maximumSideFeet:5,executionId:'notch',now:2})
  expect(!!result).toBe(!inside)
})
