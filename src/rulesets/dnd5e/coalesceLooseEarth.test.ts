import { expect, it } from 'vitest'
import { createEmptyMapGeometry } from '../../lib/mapGeometry'
import { coalesceLooseEarth } from './coalesceLooseEarth'
import { prepareLooseEarthTransfer } from './looseEarthTransfer'
import type { BattleMap } from '../../store/maps'
import { polygonSignedArea } from '../../lib/convexPolygonPartition'
import { mapGeometryPointInPolygon } from '../../lib/mapGeometry'

const rect = (left: number, right: number) => [{x:left,y:50},{x:right,y:50},{x:right,y:100},{x:left,y:100}]
const fixture = () => {
  const geometry = createEmptyMapGeometry('map', 1)
  const soil = {kind:'obstacle' as const,label:'Soil',surfaceMaterial:'loose-earth' as const,
    baseHeightFeet:-5,heightFeet:5,terrainElevationFeet:0,terrainRegion:true,cover:'none' as const,
    blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,createdAt:1}
  geometry.obstacles.push({...soil,id:'left',points:rect(50,75)},{...soil,id:'right',points:rect(75,100)})
  return geometry
}
it('casts across a soil seam and keeps the original map immutable', () => {
  const geometry=fixture(), before=structuredClone(geometry)
  const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[]}
  const result=prepareLooseEarthTransfer({map,geometry,anchor:{x:75,y:75},angleDegrees:0,distanceFeet:5,maximumSideFeet:5,executionId:'cast',now:2})
  expect(result).toBeDefined()
  expect(result!.obstacles.find(o=>o.id==='cast:deposit')?.points).toEqual(rect(100,150))
  expect(geometry).toEqual(before)
})
it.each(['gap','overlap','depth','material','overlay'] as const)('preserves distinct regions: %s', mode => {
  const geometry=fixture()
  if(mode==='gap')geometry.obstacles[1].points=rect(76,100)
  if(mode==='overlap')geometry.obstacles[1].points=rect(74,100)
  if(mode==='depth')geometry.obstacles[1].baseHeightFeet=-6
  if(mode==='material')geometry.obstacles[1].surfaceMaterial='stone'
  if(mode==='overlay')geometry.obstacles.splice(1,0,{...geometry.obstacles[0],id:'paint',surfaceMaterial:'stone'})
  expect(coalesceLooseEarth(geometry)).toBe(geometry)
})

it.each([false,true])('transfers a complete selection across an L-shaped soil seam (reverse=%s)', reverse => {
  const geometry=fixture()
  geometry.obstacles[1].points=[{x:75,y:50},{x:100,y:50},{x:100,y:125},{x:75,y:125}]
  if(reverse)geometry.obstacles[1].points.reverse()
  const before=structuredClone(geometry), merged=coalesceLooseEarth(geometry)
  expect(merged.obstacles).toHaveLength(1)
  expect(Math.abs(polygonSignedArea(merged.obstacles[0].points))).toBe(3125)
  expect(mapGeometryPointInPolygon({x:60,y:110},merged.obstacles[0].points)).toBe(false)
  const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[]}
  const result=prepareLooseEarthTransfer({map,geometry,anchor:{x:75,y:75},angleDegrees:0,distanceFeet:5,maximumSideFeet:5,executionId:'l-cast',now:2})
  expect(result).toBeDefined()
  expect(result!.obstacles.some(o=>o.id==='l-cast:deposit')).toBe(true)
  expect(result!.obstacles.some(o=>o.surfaceMaterial==='loose-earth'&&o.terrainElevationFeet===0&&mapGeometryPointInPolygon({x:85,y:115},o.points))).toBe(true)
  expect(geometry).toEqual(before)
})

it.each(['012','021','102','120','201','210'])('transfers across three authored fragments regardless of storage order %s',order=>{
  const geometry=fixture(),template=geometry.obstacles[0]
  const fragments=[{...template,id:'left',points:rect(50,65)},{...template,id:'middle',points:rect(65,85)},{...template,id:'right',points:rect(85,100)}]
  geometry.obstacles=[...order].map(index=>fragments[Number(index)])
  const before=structuredClone(geometry)
  const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[]}
  expect(coalesceLooseEarth(geometry).obstacles).toHaveLength(1)
  const moved=prepareLooseEarthTransfer({map,geometry,anchor:{x:75,y:75},angleDegrees:0,distanceFeet:5,maximumSideFeet:5,executionId:'joined',now:2})
  expect(moved).toBeDefined()
  const deposit=moved!.obstacles.find(o=>o.id==='joined:deposit')!
  expect(deposit.points).toHaveLength(4)
  expect(deposit.points).toEqual(expect.arrayContaining(rect(100,150)))
  expect(Math.abs(polygonSignedArea(deposit.points))*deposit.heightFeet).toBe(12500)
  expect(geometry).toEqual(before)
})

it('never moves a fragment across an intervening different paint layer to join a later neighbour',()=>{
  const geometry=fixture(),template=geometry.obstacles[0]
  geometry.obstacles=[{...template,id:'left',points:rect(50,65)},
    {...template,id:'right',points:rect(85,100)},
    {...template,id:'stone',points:rect(65,85),surfaceMaterial:'stone'},
    {...template,id:'bridge',points:rect(65,85)}]
  expect(coalesceLooseEarth(geometry)).toBe(geometry)
})
