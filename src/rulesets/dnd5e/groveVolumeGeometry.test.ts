import {expect,it} from 'vitest'
import {groveVolumeOverlaps,groveCellVisionSegments,groveAreaFootprintOverlaps} from '../../../shared/grove-volume.mjs'
const polygon=[{x:0,y:0},{x:70,y:0},{x:70,y:20},{x:60,y:20},{x:60,y:50},{x:0,y:50}]
const volume={minX:0,minY:0,widthPixels:300,baseElevationFeet:0,heightFeet:30,
  excludedStructures:[{points:polygon,baseElevationFeet:0,heightFeet:5}]}
it('clips footprint rectangles to selected cells, concave structures and vertical intervals',()=>{
  const map={gridSize:50,gridOffsetX:0,gridOffsetY:0}, cells=[{col:1,row:0}]
  expect(groveAreaFootprintOverlaps(volume,cells,map,{x:55,y:10},10,0,4)).toBe(false)
  expect(groveAreaFootprintOverlaps(volume,cells,map,{x:55,y:25},10,0,4)).toBe(true)
  expect(groveAreaFootprintOverlaps(volume,cells,map,{x:55,y:10},10,0,6)).toBe(true)
  expect(groveAreaFootprintOverlaps(volume,cells,map,{x:55,y:10},10,30,5)).toBe(false)
  expect(groveAreaFootprintOverlaps(volume,cells,map,{x:125,y:25},20,0,5)).toBe(false)
  const full={...volume,excludedStructures:[...volume.excludedStructures,
    {points:[{x:60,y:0},{x:100,y:0},{x:100,y:50},{x:60,y:50}],baseElevationFeet:0,heightFeet:5}]}
  expect(groveAreaFootprintOverlaps(full,cells,map,{x:75,y:25},25,0,4)).toBe(false)
})
it('subtracts concave structures only at their actual height and preserves upper volume',()=>{
  expect(groveVolumeOverlaps(volume,{x:65,y:10},2)).toBe(false)
  expect(groveVolumeOverlaps(volume,{x:65,y:30},2)).toBe(true)
  expect(groveVolumeOverlaps(volume,{x:65,y:10},5)).toBe(true)
  expect(groveVolumeOverlaps(volume,{x:65,y:10},0,4)).toBe(false)
  expect(groveVolumeOverlaps(volume,{x:65,y:10},0,6)).toBe(true)
  expect(groveVolumeOverlaps(volume,{x:65,y:10},30)).toBe(false)
})
it('builds concave cut boundaries below a structure top and whole-cell boundaries above it',()=>{
  const edges=groveCellVisionSegments(volume,{x:50,y:0,size:50},0,10)
  expect(edges.some(e=>e.baseHeightFeet===0&&e.heightFeet===5&&e.a.x===70&&e.b.x===70)).toBe(true)
  expect(edges.some(e=>e.baseHeightFeet===0&&e.a.x===60&&e.b.x===60)).toBe(true)
  expect(edges.some(e=>e.baseHeightFeet===0&&e.a.x===50&&e.b.x===50)).toBe(false)
  expect(edges.some(e=>e.baseHeightFeet===5&&e.heightFeet===5&&e.a.x===50&&e.b.x===50)).toBe(true)
  expect(edges.some(e=>e.baseHeightFeet===5&&e.a.x===70&&e.b.x===70)).toBe(false)
})
