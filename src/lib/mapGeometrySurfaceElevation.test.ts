import {expect,it} from 'vitest'
import {createEmptyMapGeometry,mapGeometrySurfaceMaterialAtElevation,mapGeometryFootprintTerrainSamples} from './mapGeometry'
const rect=(x:number,y:number,w:number,h:number)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}]
const fixture=()=>{
 const g=createEmptyMapGeometry('map',1)
 g.obstacles=[{id:'stone',kind:'obstacle',label:'Stone',points:rect(0,0,100,100),baseHeightFeet:0,heightFeet:10,surfaceMaterial:'stone',cover:'total',blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,createdAt:1}]
 return g
}
it.each([0,5,9.9,10,10.1,20])('accepts only the exposed top at height %s',height=>{
 expect(mapGeometrySurfaceMaterialAtElevation(fixture(),{x:50,y:50},height)).toBe(height===10?'stone':undefined)
})
it('samples every surface partition, rejecting a thin unknown material covering the target',()=>{
 const g=fixture()
 expect(mapGeometryFootprintTerrainSamples({geometry:g,at:{x:50,y:50},halfSizePixels:25,surfaceElevationFeet:10})).toEqual([{elevationFeet:10,material:'stone'}])
 g.obstacles.push({...g.obstacles[0],id:'cover',points:rect(51,0,0.25,100),baseHeightFeet:8,heightFeet:4,surfaceMaterial:undefined})
 expect(mapGeometryFootprintTerrainSamples({geometry:g,at:{x:50,y:50},halfSizePixels:25,surfaceElevationFeet:10}).some(s=>s.material==null)).toBe(true)
})
it('retains ordinary ground material when no solid occupies the point',()=>{
 const g=createEmptyMapGeometry('map',1)
 g.obstacles=[{...fixture().obstacles[0],heightFeet:0,terrainRegion:true,terrainElevationFeet:3,baseHeightFeet:3,surfaceMaterial:'earth'}]
 expect(mapGeometrySurfaceMaterialAtElevation(g,{x:50,y:50},3)).toBe('earth')
 expect(mapGeometrySurfaceMaterialAtElevation(g,{x:50,y:50},0)).toBeUndefined()
})
