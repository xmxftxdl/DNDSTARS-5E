import { expect, it } from 'vitest'
import { joinAdjacentPolygons } from './joinAdjacentPolygons'
import { polygonSignedArea } from './convexPolygonPartition'

const rect=(x:number,y:number,w:number,h:number)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}]
it('joins partial shared edges without filling the missing corner',()=>{
  const result=joinAdjacentPolygons(rect(0,0,2,2),rect(2,0,1,3))
  expect(result).toBeDefined()
  expect(Math.abs(polygonSignedArea(result!))).toBe(7)
})
it.each([rect(3,0,1,2),rect(1,0,2,2),rect(2,2,1,1)].map(other=>({other})))('rejects gaps, overlaps and corner-only contact',({other})=>{
  expect(joinAdjacentPolygons(rect(0,0,2,2),other)).toBeUndefined()
})
it('does not close a hole with a separate ring boundary',()=>{
  const u=[{x:0,y:0},{x:3,y:0},{x:3,y:3},{x:2,y:3},{x:2,y:1},{x:1,y:1},{x:1,y:3},{x:0,y:3}]
  expect(joinAdjacentPolygons(u,rect(1,2,1,1))).toBeUndefined()
})
