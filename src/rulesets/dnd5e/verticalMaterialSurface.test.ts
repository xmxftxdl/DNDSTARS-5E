import {expect,it} from 'vitest'
import {createEmptyMapGeometry} from '../../lib/mapGeometry'
import {selectVerticalMaterialSurface,resolveAttachedVerticalSurface} from './verticalMaterialSurface'
import {normalizeDnd5ePersistentAreaVisual} from './persistentAreaTypes'
const fixture=()=>{
 const geometry=createEmptyMapGeometry('map',1)
 geometry.obstacles=[{id:'stone',kind:'obstacle',label:'Stone',points:[{x:50,y:50},{x:150,y:50},{x:150,y:150},{x:50,y:150}],baseHeightFeet:0,heightFeet:10,surfaceMaterial:'stone',cover:'total',blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,createdAt:1}]
 return {geometry,entityId:'stone',edgeIndex:0,centerFraction:0.5,widthFeet:5,heightFeet:5,baseElevationFeet:2,pixelsPerFoot:10,maximumSideFeet:5,materials:['stone' as const]}
}
it('preserves the physical patch through persistence, translation, rotation and elevation change',()=>{
 const input=fixture(),original=selectVerticalMaterialSurface(input)!
 const saved=normalizeDnd5ePersistentAreaVisual(JSON.parse(JSON.stringify({preset:'surface-color',verticalSurface:original})))!.verticalSurface!
 expect(saved.attachment).toEqual({centerFraction:0.5,widthFeet:5,baseOffsetFeet:2})
 expect(saved.attachment).not.toBe(original.attachment)
 const moved=structuredClone(input.geometry)
 moved.obstacles[0].points=moved.obstacles[0].points.map(p=>({x:300-p.y,y:p.x+100}))
 moved.obstacles[0].baseHeightFeet=7
 const resolved=resolveAttachedVerticalSurface(saved,moved,10)!
 expect(resolved).toMatchObject({a:{x:250,y:175},b:{x:250,y:225},outward:{x:1,y:0},baseElevationFeet:9,heightFeet:5,attachment:saved.attachment})
 expect(saved).toEqual(original)
})
it.each(['deleted','material','duplicate','shrunk'] as const)('does not attach the effect to an invalid changed solid: %s',kind=>{
 const input=fixture(),surface=selectVerticalMaterialSurface(input)!
 if(kind==='deleted')input.geometry.obstacles=[]
 if(kind==='material')input.geometry.obstacles[0].surfaceMaterial='solid'
 if(kind==='duplicate')input.geometry.obstacles.push({...input.geometry.obstacles[0]})
 if(kind==='shrunk')input.geometry.obstacles[0].points[1].x=70
 expect(resolveAttachedVerticalSurface(surface,input.geometry,10)).toBeUndefined()
})
it.each([false,true])('selects the same exposed face with either polygon winding: %s',reverse=>{
 const input=fixture()
 if(reverse){input.geometry.obstacles[0].points.reverse();input.edgeIndex=2}
 const before=structuredClone(input),surface=selectVerticalMaterialSurface(input)!
 expect(surface).toBeDefined()
 expect(surface.outward.x).toBeCloseTo(0);expect(surface.outward.y).toBe(-1)
 expect([surface.a,surface.b]).toEqual(expect.arrayContaining([{x:75,y:50},{x:125,y:50}]))
 expect(surface).toMatchObject({baseElevationFeet:2,heightFeet:5,material:'stone'})
 expect(input).toEqual(before)
})
it.each(['past-edge','too-wide','too-tall','below','above','material','nan','zero','duplicate'] as const)('rejects invalid surface patch: %s',kind=>{
 const input=fixture()
 if(kind==='past-edge')input.centerFraction=0
 if(kind==='too-wide')input.widthFeet=6
 if(kind==='too-tall')input.heightFeet=6
 if(kind==='below')input.baseElevationFeet=-1
 if(kind==='above')input.baseElevationFeet=6
 if(kind==='material')input.geometry.obstacles[0].surfaceMaterial='solid'
 if(kind==='nan')input.pixelsPerFoot=NaN
 if(kind==='zero')input.widthFeet=0
 if(kind==='duplicate')input.geometry.obstacles.push({...input.geometry.obstacles[0]})
 expect(selectVerticalMaterialSurface(input)).toBeUndefined()
})
it.each([0,8])('rejects even a thin face-covering solid only at an overlapping height: %s',base=>{
 const input=fixture()
 input.geometry.obstacles.push({...input.geometry.obstacles[0],id:'cover',points:[{x:100,y:49},{x:100.1,y:49},{x:100.1,y:50},{x:100,y:50}],baseHeightFeet:base,heightFeet:2.5})
 expect(!!selectVerticalMaterialSurface(input)).toBe(base===8)
})
it('does not expose a buried face unless the adjacent ground has been excavated',()=>{
 const input=fixture()
 input.geometry.obstacles[0].baseHeightFeet=-10;input.geometry.obstacles[0].heightFeet=20
 input.baseElevationFeet=-5
 expect(selectVerticalMaterialSurface(input)).toBeUndefined()
 input.geometry.obstacles.push({...input.geometry.obstacles[0],id:'pit',points:[{x:50,y:25},{x:150,y:25},{x:150,y:50},{x:50,y:50}],terrainRegion:true,terrainElevationFeet:-6,baseHeightFeet:-6,heightFeet:0})
 expect(selectVerticalMaterialSurface(input)).toBeDefined()
})
