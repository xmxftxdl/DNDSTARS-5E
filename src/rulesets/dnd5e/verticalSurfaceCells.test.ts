import { expect, it } from 'vitest'
import { migrateMapsState } from '../../store/maps'
import { verticalSurfaceCells } from './verticalSurfaceCells'
import type { VerticalMaterialSurface } from './verticalMaterialSurface'
const surface:VerticalMaterialSurface={entityId:'stone',edgeIndex:0,a:{x:75,y:50},b:{x:125,y:50},outward:{x:0,y:-1},baseElevationFeet:2,heightFeet:5,material:'stone'}
const map=migrateMapsState({maps:[{id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,tokens:[]}]}).maps[0]
it('includes each crossed grid cell on the exposed side exactly once',()=>{
  expect(verticalSurfaceCells(surface,map)).toEqual([{col:1,row:0},{col:2,row:0}])
  expect(verticalSurfaceCells({...surface,a:surface.b,b:surface.a},map)).toEqual([{col:2,row:0},{col:1,row:0}])
})
it('respects small grids and offsets',()=>{
  expect(verticalSurfaceCells(surface,{...map,gridSize:25})).toEqual([{col:3,row:1},{col:4,row:1}])
  expect(verticalSurfaceCells(surface,{...map,gridOffsetX:10,gridOffsetY:10})).toEqual([{col:1,row:0},{col:2,row:0}])
})
it('retains a short diagonal corner crossing and refuses off-map faces',()=>{
  const diagonal={...surface,a:{x:49,y:49},b:{x:101,y:101},outward:{x:Math.SQRT1_2,y:-Math.SQRT1_2}}
  expect(verticalSurfaceCells(diagonal,map)).toEqual([{col:0,row:0},{col:1,row:0},{col:1,row:1},{col:2,row:1},{col:2,row:2}])
  expect(verticalSurfaceCells({...surface,a:{x:-5,y:50}},map)).toEqual([])
})
it('allows a face ending exactly at the map boundary without adding an outside cell',()=>{
  expect(verticalSurfaceCells({...surface,a:{x:450,y:50},b:{x:500,y:50}},map)).toEqual([{col:9,row:0}])
})
