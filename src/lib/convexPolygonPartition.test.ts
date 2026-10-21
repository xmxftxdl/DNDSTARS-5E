import {expect,it} from 'vitest'
import {partitionByConvexPolygon,polygonSignedArea} from './convexPolygonPartition'
const square=[{x:0,y:0},{x:50,y:0},{x:50,y:50},{x:0,y:50}]
it.each([false,true])('partitions diagonal overlap without losing area (clockwise=%s)',reverse=>{
  const clip=reverse?[...square].reverse():square
  const subject=square.map(p=>({x:p.x+20,y:p.y+10}))
  const result=partitionByConvexPolygon(subject,clip)!
  expect(Math.abs(polygonSignedArea(result.inside))).toBeCloseTo(1200)
  expect(result.outside.reduce((sum,polygon)=>sum+Math.abs(polygonSignedArea(polygon)),0)).toBeCloseTo(1300)
  expect(subject).toEqual(square.map(p=>({x:p.x+20,y:p.y+10})))
})
it('does not create area from a shared boundary or duplicate vertex',()=>{
  const result=partitionByConvexPolygon(square.map(p=>({x:p.x+50,y:p.y})),[square[0],...square])!
  expect(result.inside).toEqual([])
  expect(result.outside.reduce((sum,p)=>sum+Math.abs(polygonSignedArea(p)),0)).toBe(2500)
})
it('rejects a concave clipping region rather than silently filling its notch',()=>{
  expect(partitionByConvexPolygon(square,[{x:0,y:0},{x:50,y:0},{x:25,y:25},{x:50,y:50},{x:0,y:50}])).toBeUndefined()
})
