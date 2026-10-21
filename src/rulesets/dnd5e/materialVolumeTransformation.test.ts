import {expect,it} from 'vitest'
import {createEmptyMapGeometry,normalizeMapGeometry,type MapGeometryObstacle} from '../../lib/mapGeometry'
import {polygonSignedArea} from '../../lib/convexPolygonPartition'
import {prepareMaterialVolumeTransformation as prepare,restoreMaterialVolumeTransformation as restore,materialTransformationExecutionId,normalizeMaterialVolumeTransformationReceipt} from './materialVolumeTransformation'

const body=():MapGeometryObstacle=>({id:'rock',kind:'obstacle',label:'rock',points:[{x:-30,y:-30},{x:30,y:-30},{x:30,y:30},{x:-30,y:30}],baseHeightFeet:0,heightFeet:30,surfaceMaterial:'stone',materialMagic:'nonmagical',cover:'total',blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,createdAt:1})
function input(){
 const geometry=createEmptyMapGeometry('map',1);geometry.obstacles=[body()]
 return {geometry:normalizeMapGeometry(geometry)!,executionId:'cast1',entityIds:['rock'],center:{x:0,y:0},angleDegrees:0,widthFeet:20,lengthFeet:10,heightFeet:5,bottomFeet:10,pixelsPerFoot:1,mode:'rock-to-mud' as const}
}
const volume=(b:MapGeometryObstacle)=>Math.abs(polygonSignedArea(b.points))*b.heightFeet
it('preserves long browser action identity in a bounded stable geometry namespace',()=>{
 const actionId='tremor-test:player-action:6ed5edbc-798f-475e-bc7a-60dc8640c9de:d02f826e-f887-4ce5-94a5-474fd242d76c:1792007886543:1'
 const executionId=materialTransformationExecutionId(actionId)
 expect(executionId.length).toBeLessThanOrEqual(64)
 expect(materialTransformationExecutionId(actionId)).toBe(executionId)
 expect(materialTransformationExecutionId(actionId+'0')).not.toBe(executionId)
 const result=prepare({...input(),executionId})!
 expect(result).toBeDefined()
 expect(normalizeMaterialVolumeTransformationReceipt(JSON.parse(JSON.stringify(result.receipt)))).toEqual(result.receipt)
 expect(restore(result.geometry,result.receipt)).toEqual(input().geometry)
 expect(prepare({...input(),geometry:result.geometry,executionId})).toBeUndefined()
})
it.each([0,31,90,175])('clips only the rotated selected volume and preserves total volume (%s degrees)',angleDegrees=>{
 const request={...input(),angleDegrees};const before=structuredClone(request.geometry)
 const result=prepare(request)!
 expect(result).toBeDefined();expect(request.geometry).toEqual(before)
 expect(result.geometry.obstacles.reduce((n,b)=>n+volume(b),0)).toBeCloseTo(108000,5)
 const changed=result.geometry.obstacles.filter(b=>b.surfaceMaterial==='mud')
 expect(changed.reduce((n,b)=>n+volume(b),0)).toBeCloseTo(1000,5)
 for(const b of changed){
  expect(b.baseHeightFeet).toBe(10);expect(b.heightFeet).toBe(5)
  const a=angleDegrees*Math.PI/180
  for(const p of b.points){expect(Math.abs(p.x*Math.cos(a)+p.y*Math.sin(a))).toBeLessThanOrEqual(10.000001);expect(Math.abs(-p.x*Math.sin(a)+p.y*Math.cos(a))).toBeLessThanOrEqual(5.000001)}
 }
 expect(restore(JSON.parse(JSON.stringify(result.geometry)),JSON.parse(JSON.stringify(result.receipt)))).toEqual(before)
})
it.each(['mud','quicksand'] as const)('converts explicit nonmagical %s to solid stone',material=>{
 const request=input();request.geometry.obstacles[0].surfaceMaterial=material
 const result=prepare({...request,mode:'mud-to-rock'})!
 const changed=result.geometry.obstacles.filter(b=>b.materialMagic==='magical')
 expect(changed.length).toBeGreaterThan(0)
 for(const b of changed){expect(b.surfaceMaterial).toBe('stone');expect(b.blocksMovement).toBe(true);expect(b.cover).toBe('total')}
 expect(restore(result.geometry,result.receipt)).toEqual(request.geometry)
 expect(prepare({...request,mode:'mud-to-rock',heightFeet:11})).toBeUndefined()
})
it('preserves unrelated edits on restoration and rejects changed, missing, or already restored fragments atomically',()=>{
 const result=prepare(input())!
 const edited=structuredClone(result.geometry);edited.obstacles.push({...body(),id:'other',label:'new unrelated object'})
 const restored=restore(edited,result.receipt)!
 expect(restored.obstacles.at(-1)?.label).toBe('new unrelated object')
 expect(restore(restored,result.receipt)).toBeUndefined()
 edited.obstacles[0].label='edited after casting';const before=structuredClone(edited)
 expect(restore(edited,result.receipt)).toBeUndefined();expect(edited).toEqual(before)
 edited.obstacles.shift();expect(restore(edited,result.receipt)).toBeUndefined()
 expect(restore({...result.geometry,mapId:'other-map'},result.receipt)).toBeUndefined()
})
it('rejects unknown or magical material, absent volume, missed targets and duplicate selections',()=>{
 for(const patch of [{materialMagic:undefined},{materialMagic:'magical' as const},{heightFeet:0},{surfaceMaterial:'sand' as const}]){
  const request=input();Object.assign(request.geometry.obstacles[0],patch);expect(prepare(request)).toBeUndefined()
 }
 expect(prepare({...input(),widthFeet:41})).toBeUndefined()
 expect(prepare({...input(),bottomFeet:31})).toBeUndefined()
 expect(prepare({...input(),center:{x:100,y:100}})).toBeUndefined()
 expect(prepare({...input(),entityIds:['rock','rock']})).toBeUndefined()
 const request=input();request.geometry.obstacles.push({...body(),id:'cast1:material:0'})
 expect(prepare(request)).toBeUndefined()
})
it('keeps the restoration receipt independent of subsequent in-place geometry edits',()=>{
 const result=prepare(input())!
 const saved=structuredClone(result.receipt)
 result.geometry.obstacles[0].heightFeet+=1
 expect(result.receipt).toEqual(saved)
 expect(restore(result.geometry,result.receipt)).toBeUndefined()
})
