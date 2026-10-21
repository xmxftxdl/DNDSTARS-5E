import { expect,it } from 'vitest'
import { polygonUnionSupportsCircle } from './polygonUnionSupport'
const rect=(x:number,y:number,w:number,h:number)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}]
it('supports seams, four-way joins and overlapping or reversed polygons',()=>{
  const tiles=[rect(0,0,10,10),rect(10,0,10,10),rect(0,10,10,10),rect(10,10,10,10)]
  expect(polygonUnionSupportsCircle(tiles,{x:10,y:10},8)).toBe(true)
  expect(polygonUnionSupportsCircle(tiles.map(p=>p.toReversed()),{x:10,y:10},8)).toBe(true)
  expect(polygonUnionSupportsCircle([rect(0,0,12,10),rect(8,0,12,10)],{x:10,y:5},4)).toBe(true)
})
it('does not bridge real gaps, holes, missing corners or protruding footprints',()=>{
  expect(polygonUnionSupportsCircle([rect(0,0,10,10),rect(10.01,0,10,10)],{x:9,y:5},2)).toBe(false)
  const ring=[rect(0,0,20,9),rect(0,11,20,9),rect(0,9,9,2),rect(11,9,9,2)]
  expect(polygonUnionSupportsCircle(ring,{x:8,y:10},3)).toBe(false)
  expect(polygonUnionSupportsCircle([rect(0,0,10,10),rect(10,0,10,10),rect(0,10,10,10)],{x:9,y:9},3)).toBe(false)
  expect(polygonUnionSupportsCircle([rect(0,0,10,10)],{x:1,y:5},2)).toBe(false)
})
it('handles rotated tiles and T junctions with partial shared edges',()=>{
  const transform=(p:{x:number;y:number})=>({x:100+p.x*Math.cos(.7)-p.y*Math.sin(.7),y:200+p.x*Math.sin(.7)+p.y*Math.cos(.7)})
  const polygons=[rect(0,0,10,20),rect(10,0,10,10),rect(10,10,10,10)]
  expect(polygonUnionSupportsCircle(polygons.map(p=>p.map(transform)),transform({x:10,y:10}),8)).toBe(true)
})
