import { expect, it } from 'vitest'
import { createEmptyMapGeometry, mapGeometryTerrainElevationAtPoint } from '../../lib/mapGeometry'
import { buildLooseEarthTransferGeometry } from './looseEarthTransferGeometry'

const fixture = () => {
  const geometry = createEmptyMapGeometry('map', 1)
  geometry.obstacles.push({ id: 'soil', kind: 'obstacle', label: '松土体积',
    points: [{x:0,y:0},{x:50,y:0},{x:50,y:50},{x:0,y:50}],
    terrainRegion: true, terrainElevationFeet: 0, baseHeightFeet: -5, heightFeet: 5,
    surfaceMaterial: 'loose-earth', cover: 'none', blocksMovement: false,
    blocksVision: false, blocksLineOfEffect: false, createdAt: 1 })
  return geometry
}
it('constructs a real depression and equal-volume deposit without changing the input', () => {
  const geometry=fixture(), before=structuredClone(geometry)
  const moved=buildLooseEarthTransferGeometry({geometry,sourceVolumeId:'soil',translation:{x:50,y:0},pixelsPerFoot:10,maximumSideFeet:5,maximumDisplacementFeet:5,destinationGroundFeet:0,executionId:'cast1',now:2})!
  expect(geometry).toEqual(before)
  expect(mapGeometryTerrainElevationAtPoint(moved,{x:25,y:25})).toBe(-5)
  expect(mapGeometryTerrainElevationAtPoint(moved,{x:75,y:25})).toBe(5)
  expect(moved.obstacles[1].heightFeet).toBe(5)
  expect(moved.obstacles[0].surfaceMaterial).toBeUndefined()
  expect(buildLooseEarthTransferGeometry({geometry:moved,sourceVolumeId:'cast1:deposit',translation:{x:50,y:0},pixelsPerFoot:10,maximumSideFeet:5,maximumDisplacementFeet:5,destinationGroundFeet:0,executionId:'cast1',now:3})).toBeUndefined()
})
it.each(['stone','unknown','surface-only','wrong-top'] as const)('does not fabricate excavation volume from %s', kind => {
  const geometry=fixture(), region=geometry.obstacles[0]
  if(kind==='stone')region.surfaceMaterial='stone'
  if(kind==='unknown')delete region.surfaceMaterial
  if(kind==='surface-only')region.heightFeet=0
  if(kind==='wrong-top')region.terrainElevationFeet=10
  expect(buildLooseEarthTransferGeometry({geometry,sourceVolumeId:'soil',translation:{x:50,y:0},pixelsPerFoot:10,maximumSideFeet:5,maximumDisplacementFeet:5,destinationGroundFeet:0,executionId:'cast1',now:2})).toBeUndefined()
})

it.each(['too-far','too-deep','too-wide','nan','zero-area','zero-move'] as const)('rejects invalid geometry before creating terrain: %s',kind=>{
 const geometry=fixture(), region=geometry.obstacles[0]
 const translation={x:50,y:0}
 if(kind==='too-far')translation.x=50.01
 if(kind==='zero-move')translation.x=0
 if(kind==='too-deep'){region.heightFeet=6;region.baseHeightFeet=-6}
 if(kind==='too-wide')region.points=region.points.map(p=>({...p,x:p.x*2}))
 if(kind==='nan')region.points[0].x=NaN
 if(kind==='zero-area')region.points=region.points.map(p=>({...p,y:0}))
 expect(buildLooseEarthTransferGeometry({geometry,sourceVolumeId:'soil',translation,pixelsPerFoot:10,maximumSideFeet:5,maximumDisplacementFeet:5,destinationGroundFeet:0,executionId:'cast1',now:2})).toBeUndefined()
})
it('accepts a rotated five-foot square',()=>{
 const geometry=fixture()
 geometry.obstacles[0].points=geometry.obstacles[0].points.map(p=>({x:(p.x-p.y)/Math.sqrt(2),y:(p.x+p.y)/Math.sqrt(2)}))
 expect(buildLooseEarthTransferGeometry({geometry,sourceVolumeId:'soil',translation:{x:50,y:0},pixelsPerFoot:10,maximumSideFeet:5,maximumDisplacementFeet:5,destinationGroundFeet:0,executionId:'cast1',now:2})).toBeDefined()
})

it('rejects terrain outside the authority store height range before staging',()=>{
 const geometry=fixture()
 expect(buildLooseEarthTransferGeometry({geometry,sourceVolumeId:'soil',translation:{x:50,y:0},pixelsPerFoot:10,maximumSideFeet:5,maximumDisplacementFeet:5,destinationGroundFeet:10000,executionId:'cast1',now:2})).toBeUndefined()
})
