import { expect, it } from 'vitest'
import { createEmptyMapGeometry } from '../../lib/mapGeometry'
import { snapWallDrawingPoint } from './wallEndpointSnap'
const geometry = createEmptyMapGeometry('map')
geometry.walls.push({ id:'wall', kind:'wall', label:'Wall', createdAt:1, baseHeightFeet:0, heightFeet:10, blocksVision:true, blocksMovement:true, blocksLineOfEffect:true, points:[{x:113,y:147},{x:213,y:147}] })
const grid = {enabled:true,size:50,x:0,y:0}
it('uses nearby wall vertices ahead of the grid at every zoom level', () => {
  for (const zoom of [0.25,1,4]) expect(snapWallDrawingPoint({x:113+5/zoom,y:147},geometry,'wall',zoom,grid)).toEqual({x:113,y:147})
})
it('supports endpoint alignment without forcing other tools to wall vertices', () => {
  expect(snapWallDrawingPoint({x:115,y:147},geometry,'wall',1,{...grid,enabled:false})).toEqual({x:113,y:147})
  expect(snapWallDrawingPoint({x:115,y:147},geometry,'obstacle',1,grid)).toEqual({x:100,y:150})
  expect(snapWallDrawingPoint({x:350,y:350},geometry,'wall',1,{...grid,enabled:false})).toEqual({x:350,y:350})
})