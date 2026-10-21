import {expect,it} from 'vitest'
import {planeHeight} from '../../lib/heightPlane'
import {dnd5ePersistentAreaAffectsTokenVerticallyAt} from './persistentAreaGeometry'
import {normalizeMaterialFallVolumes} from './fallingMaterialTransformation'
import {createEmptyMapGeometry,normalizeMapGeometry,type MapGeometryObstacle} from '../../lib/mapGeometry'
import {prepareFallingMaterialTransformation,prepareHostFallingMaterialTransformation} from './fallingMaterialTransformation'
import {normalizeMaterialVolumeTransformationReceipt,restoreMaterialVolumeTransformation} from './materialVolumeTransformation'
import {polygonSignedArea} from '../../lib/convexPolygonPartition'
function fixture(){
 const geometry=createEmptyMapGeometry('ceiling',1)
 const ceiling:MapGeometryObstacle={id:'ceiling',kind:'obstacle',label:'Ceiling',points:[{x:0,y:0},{x:600,y:0},{x:600,y:600},{x:0,y:600}],cover:'total',blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,baseHeightFeet:20,heightFeet:10,surfaceMaterial:'stone',materialMagic:'nonmagical',createdAt:1}
 geometry.obstacles=[ceiling]
 return {geometry:normalizeMapGeometry(geometry)!,executionId:'fall',entityIds:['ceiling'],center:{x:300,y:300},angleDegrees:35,widthFeet:20,lengthFeet:10,heightFeet:5,bottomFeet:20,pixelsPerFoot:10,landingElevationFeet:0}
}
it('drops the exposed converted ceiling volume and restores both the opening and fallen mud together',()=>{
 const input=fixture(),before=structuredClone(input.geometry),result=prepareFallingMaterialTransformation(input)!
 expect(result).toBeDefined()
 const mud=result.geometry.obstacles.filter(o=>o.surfaceMaterial==='mud')
 expect(mud.reduce((n,o)=>n+Math.abs(polygonSignedArea(o.points))/100*o.heightFeet,0)).toBeCloseTo(1000)
 expect(mud.every(o=>o.baseHeightFeet===0&&o.heightFeet===5&&o.terrainElevationFeet===undefined&&!o.blocksMovement)).toBe(true)
 expect(result.falls.every(f=>f.bottomFeet===0&&f.topFeet===20)).toBe(true)
 const receipt=normalizeMaterialVolumeTransformationReceipt(JSON.parse(JSON.stringify(result.receipt)))!
 expect(receipt).toBeDefined()
 expect(restoreMaterialVolumeTransformation(JSON.parse(JSON.stringify(result.geometry)),receipt)).toEqual(before)
 expect(input.geometry).toEqual(before)
 const conflict=structuredClone(result.geometry);conflict.obstacles.find(o=>o.surfaceMaterial==='mud')!.baseHeightFeet=1
 expect(restoreMaterialVolumeTransformation(conflict,receipt)).toBeUndefined()
})
it('does not drop mud through remaining ceiling stone or an intervening platform',()=>{
 const input=fixture()
 expect(prepareFallingMaterialTransformation({...input,bottomFeet:25})).toBeUndefined()
 expect(prepareFallingMaterialTransformation({...input,landingElevationFeet:18})).toBeDefined()
 expect(prepareFallingMaterialTransformation({...input,landingElevationFeet:20})).toBeUndefined()
 input.geometry.obstacles.push({...input.geometry.obstacles[0],id:'platform',baseHeightFeet:9,heightFeet:1,points:[{x:290,y:290},{x:310,y:290},{x:310,y:310},{x:290,y:310}]})
 expect(prepareFallingMaterialTransformation(input)).toBeUndefined()
})

it('splits falling volume around a small Host platform and restores the ceiling without changing the platform',()=>{
 const input=fixture()
 input.geometry.obstacles.push({...input.geometry.obstacles[0],id:'platform',baseHeightFeet:9,heightFeet:1,points:[{x:290,y:290},{x:310,y:290},{x:310,y:310},{x:290,y:310}]})
 const before=structuredClone(input.geometry),result=prepareHostFallingMaterialTransformation(input)!
 expect(result).toBeDefined()
 const mud=result.geometry.obstacles.filter(o=>o.surfaceMaterial==='mud')
 const volume=(height:number)=>mud.filter(o=>o.baseHeightFeet===height).reduce((n,o)=>n+Math.abs(polygonSignedArea(o.points))/100*o.heightFeet,0)
 expect(volume(10)).toBeCloseTo(20)
 expect(volume(0)).toBeCloseTo(980)
 expect(new Set(result.falls.map(f=>f.bottomFeet))).toEqual(new Set([0,10]))
 expect(restoreMaterialVolumeTransformation(JSON.parse(JSON.stringify(result.geometry)),JSON.parse(JSON.stringify(result.receipt)))).toEqual(before)
 expect(input.geometry).toEqual(before)
})

it('honors painted depressions and overlapping solid platform heights independently of obstacle order',()=>{
 const input=fixture()
 const points=[{x:290,y:290},{x:310,y:290},{x:310,y:310},{x:290,y:310}]
 const terrain={...input.geometry.obstacles[0],id:'depression',points,baseHeightFeet:0,heightFeet:0,terrainRegion:true,terrainElevationFeet:-5,blocksMovement:false,blocksVision:false,blocksLineOfEffect:false}
 input.geometry.obstacles.push(terrain)
 const depression=prepareHostFallingMaterialTransformation(input)!
 expect(depression.falls.some(f=>f.bottomFeet===-5)).toBe(true)
 const low={...terrain,id:'low',terrainElevationFeet:undefined,terrainRegion:false,baseHeightFeet:0,heightFeet:6,blocksMovement:true}
 const high={...low,id:'high',heightFeet:10}
 for(const platforms of [[low,high],[high,low]]){
  const result=prepareHostFallingMaterialTransformation({...input,geometry:{...input.geometry,obstacles:[...input.geometry.obstacles,...platforms]}})!
  expect(result).toBeDefined()
  expect(new Set(result.falls.map(f=>f.bottomFeet))).toEqual(new Set([0,10]))
 }
 expect(prepareHostFallingMaterialTransformation({...input,geometry:{...input.geometry,obstacles:[...input.geometry.obstacles,{...high,heightFeet:18}]}})).toBeDefined()
 expect(prepareHostFallingMaterialTransformation({...input,geometry:{...input.geometry,obstacles:[...input.geometry.obstacles,{...high,heightFeet:20}]}})).toBeUndefined()
})

it('does not silently pass through generated zero-height stair bodies',()=>{
 const input=fixture()
 const stair={...input.geometry.obstacles[0],id:'stairs',baseHeightFeet:2,heightFeet:0,
  points:[{x:200,y:250},{x:400,y:250},{x:400,y:350},{x:200,y:350}],
  stairPath:{schemaVersion:1 as const,widthFeet:10,widthMapUnits:100,thicknessInches:6,
   points:[{x:200,y:300,elevationFeet:2},{x:400,y:300,elevationFeet:10}]}}
 input.geometry.obstacles.push(stair)
 const before=structuredClone(input.geometry)
 const result=prepareHostFallingMaterialTransformation(input)!
 expect(result).toBeDefined()
 expect(result.falls.some(v=>v.bottomPlane)).toBe(true)
 const mud=result.geometry.obstacles.filter(o=>o.surfaceMaterial==='mud')
 expect(mud.some(o=>o.materialLayer)).toBe(true)
 expect(mud.reduce((sum,o)=>sum+Math.abs(polygonSignedArea(o.points))/100*(o.materialLayer?.depthFeet??o.heightFeet),0)).toBeCloseTo(1000)
 expect(restoreMaterialVolumeTransformation(JSON.parse(JSON.stringify(result.geometry)),JSON.parse(JSON.stringify(result.receipt)))).toEqual(normalizeMapGeometry(before))
 const falls=normalizeMaterialFallVolumes(JSON.parse(JSON.stringify(result.falls)))!
 expect(falls).toBeDefined()
 const area:any={materialFallVolumes:falls,cells:[]},map:any={id:'ceiling',gridSize:10,feetPerCell:1,tokens:[]}
 const token:any={id:'below-stairs',size:1,x:300,y:300,elevationFeet:0}
 const affected=(elevationFeet:number)=>dnd5ePersistentAreaAffectsTokenVerticallyAt({area,map,token,position:token,elevationFeet})
 expect(affected(0)).toBe(false)
 expect(affected(6)).toBe(true)
 expect(affected(12)).toBe(true)
 expect(affected(20)).toBe(false)
 for(const body of mud.filter(o=>o.materialLayer))expect(body.points.every(p=>planeHeight(body.materialLayer!.basePlane,p)>=body.baseHeightFeet-1e-6)).toBe(true)
 const invalidLayer=JSON.parse(JSON.stringify(result.geometry))
 invalidLayer.obstacles.find((o:any)=>o.materialLayer).materialLayer.depthFeet=40
 expect(normalizeMapGeometry(invalidLayer)?.obstacles.some(o=>o.materialLayer)).not.toBe(true)
 const invalidFalls=JSON.parse(JSON.stringify(falls))
 invalidFalls.find((v:any)=>v.bottomPlane).bottomPlane.offset=10000
 expect(normalizeMaterialFallVolumes(invalidFalls)).toBeUndefined()
 // A level platform crossing the ramp wins below the crossing; the ramp wins above it.
 const platform={...input.geometry.obstacles[0],id:'crossing-platform',points:stair.points,baseHeightFeet:5,heightFeet:1}
 const crossed=prepareHostFallingMaterialTransformation({...input,geometry:{...input.geometry,obstacles:[...input.geometry.obstacles,platform]}})!
 expect(crossed).toBeDefined()
 for(const volume of crossed.falls.filter(v=>v.bottomPlane)){
  expect(volume.points.every(p=>planeHeight(volume.bottomPlane!,p)>=6-1e-6)).toBe(true)
 }
 expect(crossed.falls.some(v=>!v.bottomPlane&&Math.abs(v.bottomFeet-6)<1e-6)).toBe(true)
 expect(prepareFallingMaterialTransformation(input)).toBeUndefined()
 expect(input.geometry).toEqual(before)
 // A separate upper flight must not block a fall beneath it.
 stair.stairPath.points=stair.stairPath.points.map(p=>({...p,elevationFeet:p.elevationFeet+40}))
 expect(prepareHostFallingMaterialTransformation(input)).toBeDefined()
})
