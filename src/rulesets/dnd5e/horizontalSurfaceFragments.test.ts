import {expect,it} from 'vitest'
import {createEmptyMapGeometry} from '../../lib/mapGeometry'
import {polygonSignedArea} from '../../lib/convexPolygonPartition'
import {partitionHorizontalMaterialSurfaces,selectHorizontalMaterialSurface,normalizeHorizontalMaterialSurface} from './horizontalMaterialSurface'
import {projectAttachedSurfaceArea} from './attachedSurfaceArea'
function fixture(){
 const geometry=createEmptyMapGeometry('map',1)
 const rect=(a:number,b:number)=>[{x:a,y:0},{x:b,y:0},{x:b,y:50},{x:a,y:50}]
 geometry.obstacles=[0,1].map(i=>({id:`stone${i}`,kind:'obstacle' as const,label:'Stone',points:rect(i*25,(i+1)*25),
  baseHeightFeet:0,heightFeet:3.5,surfaceMaterial:'stone' as const,cover:'total' as const,
  blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,createdAt:1}))
 return {geometry,corners:rect(0,50),elevationFeet:3.5,pixelsPerFoot:10,materials:['stone' as const]}
}
it('covers a seam with independent local frames and one unchanged drawing frame',()=>{
 const input=fixture(),before=JSON.stringify(input),parts=partitionHorizontalMaterialSurfaces(input)!
 expect(parts).toBeDefined()
 expect(new Set(parts.map(p=>p.entityId))).toEqual(new Set(['stone0','stone1']))
 expect(parts.reduce((a,p)=>a+Math.abs(polygonSignedArea(p.corners)),0)).toBeCloseTo(2500)
 for(const part of parts)for(let i=0;i<part.corners.length;i++){
  expect(part.drawingCornersFeet[i].x).toBeCloseTo(part.corners[i].x/10)
  expect(part.localCornersFeet[i].x).toBeCloseTo((part.corners[i].x-(part.entityId==='stone1'?25:0))/10)
 }
 expect(JSON.stringify(input)).toBe(before)
})
it.each(['gap','overlap','height','material','duplicate','covered'] as const)('rejects invalid combined surface: %s',kind=>{
 const input=fixture(),right=input.geometry.obstacles[1]
 if(kind==='gap')right.points=right.points.map(p=>({...p,x:p.x+0.01}))
 if(kind==='overlap')right.points=right.points.map(p=>({...p,x:p.x-0.01}))
 if(kind==='height')right.heightFeet=4
 if(kind==='material')right.surfaceMaterial='ice'
 if(kind==='duplicate')right.id='stone0'
 if(kind==='covered')input.geometry.obstacles.push({...right,id:'cover',baseHeightFeet:3.5,heightFeet:1})
 expect(partitionHorizontalMaterialSurfaces(input)).toBeUndefined()
})
it('persists one effect and moves only the fragments attached to the moved stone',()=>{
 const input=fixture(),surface=selectHorizontalMaterialSurface(input)!
 expect(surface.fragments?.length).toBeGreaterThan(1)
 expect(normalizeHorizontalMaterialSurface(JSON.parse(JSON.stringify(surface)))).toEqual(surface)
 const area:any={id:'art',cells:[{col:0,row:0}],sourceLimit:{groupId:'paint',maximum:2},expiresAtWorldMinute:160,
  visual:{preset:'surface-color',horizontalSurface:surface}}
 const map:any={id:'map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,tokens:[]}
 const before=JSON.stringify(area)
 input.geometry.obstacles[1].points=input.geometry.obstacles[1].points.map(p=>({...p,x:p.x+100}))
 const projected=projectAttachedSurfaceArea(area,map,input.geometry)!
 expect(projected.cells).toEqual([{col:0,row:0},{col:2,row:0}])
 expect(projected.expiresAtWorldMinute).toBe(160)
 expect(projected.sourceLimit).toEqual(area.sourceLimit)
 for(const part of projected.visual!.horizontalSurface!.fragments!){
  expect(part.corners[0].x-part.drawingCornersFeet[0].x*10).toBeCloseTo(part.entityId==='stone1'?100:0)
 }
 input.geometry.obstacles.splice(1,1)
 expect(projectAttachedSurfaceArea(area,map,input.geometry)!.visual!.horizontalSurface!.fragments!.every(p=>p.entityId==='stone0')).toBe(true)
 expect(JSON.stringify(area)).toBe(before)
})

it.each(['duplicate','stretched','mirrored','world-distorted'] as const)('rejects corrupt fragment coordinate frames: %s',kind=>{
 const surface=selectHorizontalMaterialSurface(fixture())!
 const part=surface.fragments![0]
 if(kind==='duplicate')part.drawingCornersFeet[1]={...part.drawingCornersFeet[0]}
 if(kind==='stretched')part.drawingCornersFeet=part.drawingCornersFeet.map(p=>({x:p.x*2,y:p.y*2}))
 if(kind==='mirrored')part.localCornersFeet=part.localCornersFeet.map(p=>({x:-p.x,y:p.y}))
 if(kind==='world-distorted')part.corners[2].x+=1
 expect(normalizeHorizontalMaterialSurface(surface)).toBeUndefined()
})

it('accepts independently rotated and translated fragment frames without modifying the payload',()=>{
 const surface=selectHorizontalMaterialSurface(fixture())!
 for(const part of surface.fragments!){
  part.localCornersFeet=part.localCornersFeet.map(p=>({x:8-p.y,y:3+p.x}))
  part.corners=part.corners.map(p=>({x:400-p.y,y:100+p.x}))
 }
 const before=JSON.stringify(surface)
 expect(normalizeHorizontalMaterialSurface(surface)).toEqual(surface)
 expect(JSON.stringify(surface)).toBe(before)
})
