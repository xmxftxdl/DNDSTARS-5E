import { expect,it } from 'vitest'
import { createEmptyMapGeometry } from '../../lib/mapGeometry'
import { partitionVerticalMaterialSurfaces } from './verticalSurfaceFragments'
import {selectVerticalMaterialSurface,resolveAttachedVerticalSurface} from './verticalMaterialSurface'
import {normalizeVerticalSurfaceProjection} from './verticalSurfaceProjection'
function fixture(stacked=false){
  const geometry=createEmptyMapGeometry('map',1)
  geometry.obstacles=[0,1].map(i=>{
    const left=stacked?0:i*25,right=stacked?50:(i+1)*25
    return {id:`stone${i}`,kind:'obstacle' as const,label:'Stone',points:[{x:left,y:50},{x:right,y:50},{x:right,y:100},{x:left,y:100}],
      baseHeightFeet:stacked?i*2.5:0,heightFeet:stacked?2.5:5,surfaceMaterial:'stone' as const,cover:'total' as const,
      blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,createdAt:1}
  })
  return {geometry,entityId:'stone0',edgeIndex:0,centerFraction:stacked?0.5:1,widthFeet:5,heightFeet:5,baseElevationFeet:0,pixelsPerFoot:10,maximumSideFeet:5,materials:['stone' as const]}
}
it.each([false,true])('covers one drawing over adjacent faces (stacked=%s) without mutating geometry',stacked=>{
  const input=fixture(stacked),before=JSON.stringify(input),parts=partitionVerticalMaterialSurfaces(input)!
  expect(parts).toHaveLength(2)
  expect(parts.reduce((area,p)=>area+p.widthFeet*p.heightFeet,0)).toBeCloseTo(25)
  expect(parts.map(p=>p.surface.entityId)).toEqual(['stone0','stone1'])
  expect(parts[1]).toMatchObject(stacked?{bottomFeet:2.5,leftFeet:0}:{bottomFeet:0,leftFeet:2.5})
  expect(JSON.stringify(input)).toBe(before)
})
it.each(['gap','overlap','wrong-material','not-coplanar','covered','missing','duplicate'] as const)('rejects incomplete/ambiguous vertical coverage: %s',kind=>{
  const input=fixture(),right=input.geometry.obstacles[1]
  if(kind==='gap')right.points=right.points.map(p=>({...p,x:p.x+0.01}))
  if(kind==='overlap')right.points=right.points.map(p=>({...p,x:p.x-0.01}))
  if(kind==='wrong-material')right.surfaceMaterial='ice' as 'stone'
  if(kind==='not-coplanar')right.points=right.points.map(p=>({...p,y:p.y+0.01}))
  if(kind==='covered')input.geometry.obstacles.push({...right,id:'cover',points:right.points.map(p=>({...p,y:p.y-1}))})
  if(kind==='missing')input.geometry.obstacles.pop()
  if(kind==='duplicate')right.id='stone0'
  expect(partitionVerticalMaterialSurfaces(input)).toBeUndefined()
})
it('preserves the shared drawing direction when the neighbouring polygon winding is reversed',()=>{
  const input=fixture()
  input.geometry.obstacles[1].points.reverse()
  const parts=partitionVerticalMaterialSurfaces(input)!
  expect(parts).toHaveLength(2)
  expect(parts[1].reversed).toBe(true)
  expect(parts[1].surface.a.x).toBe(50)
  expect(parts[1].surface.b.x).toBe(25)
  expect(parts[1].leftFeet).toBe(2.5)
})
it('selects, roundtrips and independently follows two stone faces, preserving the original drawing offsets',()=>{
  const input=fixture(),selected=selectVerticalMaterialSurface(input)!
  expect(selected.fragments).toHaveLength(2)
  const saved=normalizeVerticalSurfaceProjection(JSON.parse(JSON.stringify(selected)))!
  expect(saved.fragments).toEqual(selected.fragments)
  const before=JSON.stringify(saved)
  input.geometry.obstacles[1].points=input.geometry.obstacles[1].points.map(p=>({x:p.x+100,y:p.y}))
  const moved=resolveAttachedVerticalSurface(saved,input.geometry,10)!
  expect(moved.fragments![0].surface.a).toEqual(saved.fragments![0].surface.a)
  expect(moved.fragments![1].surface.a.x).toBe(saved.fragments![1].surface.a.x+100)
  expect(moved.fragments![1].leftFeet).toBe(2.5)
  input.geometry.obstacles.pop()
  expect(resolveAttachedVerticalSurface(saved,input.geometry,10)!.fragments).toHaveLength(1)
  expect(JSON.stringify(saved)).toBe(before)
})
it.each(['outside','overlap','scale','recursive'] as const)('rejects corrupt drawing fragments: %s',kind=>{
  const surface=selectVerticalMaterialSurface(fixture())!,part=surface.fragments![1]
  if(kind==='outside')part.leftFeet=50
  if(kind==='overlap')part.leftFeet=0
  if(kind==='scale')part.surface.b.x+=1
  if(kind==='recursive')part.surface.fragments=[structuredClone(surface.fragments![0])]
  expect(normalizeVerticalSurfaceProjection(surface)).toBeUndefined()
})
