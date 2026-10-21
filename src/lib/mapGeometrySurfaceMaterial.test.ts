import {expect,it} from 'vitest'
import {createEmptyMapGeometry,normalizeMapGeometry,mapGeometryPathTouchesSurface,mapGeometryFootprintTouchesSurface,mapGeometrySurfaceMaterialAtPoint,type MapGeometryObstacle} from './mapGeometry'
const region=(id:string,material?:MapGeometryObstacle['surfaceMaterial']):MapGeometryObstacle=>({id,kind:'obstacle',label:id,
 points:[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}],cover:'none',blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,
 baseHeightFeet:0,heightFeet:0,terrainElevationFeet:0,surfaceMaterial:material,createdAt:1})
it('persists explicit loose materials and does not infer absent or malformed data',()=>{
 for(const material of ['solid','sand','dust','loose-earth','gravel','stone','mud','quicksand'] as const){
  const geometry=createEmptyMapGeometry('map',1);geometry.obstacles=[region('surface',material)]
  const restored=normalizeMapGeometry(JSON.parse(JSON.stringify(geometry)))!
  expect(mapGeometrySurfaceMaterialAtPoint(restored,{x:50,y:50})).toBe(material)
  expect(mapGeometrySurfaceMaterialAtPoint(restored,{x:150,y:50})).toBeUndefined()
 }
 const geometry=createEmptyMapGeometry('map',1);geometry.obstacles=[region('unknown')]
 expect(mapGeometrySurfaceMaterialAtPoint(geometry,{x:50,y:50})).toBeUndefined()
 const malformed=JSON.parse(JSON.stringify(geometry));malformed.obstacles[0].surfaceMaterial='lava'
 expect(normalizeMapGeometry(malformed)).toBeUndefined()
})
it('persists explicit magical classification without inferring unknown or accepting a forged value',()=>{
 const geometry=createEmptyMapGeometry('map',1)
 for(const materialMagic of ['nonmagical','magical'] as const){
  geometry.obstacles=[{...region('material','mud'),materialMagic}]
  expect(normalizeMapGeometry(JSON.parse(JSON.stringify(geometry)))?.obstacles[0].materialMagic).toBe(materialMagic)
 }
 geometry.obstacles=[region('unknown','stone')]
 expect(normalizeMapGeometry(JSON.parse(JSON.stringify(geometry)))?.obstacles[0].materialMagic).toBeUndefined()
 for(const invalid of [false,['nonmagical'],'unknown',1]){
  const malformed=JSON.parse(JSON.stringify(geometry));malformed.obstacles[0].materialMagic=invalid
  expect(normalizeMapGeometry(malformed)).toBeUndefined()
 }
})
it('allows solid paint to override debris and excludes lower surfaces below a platform',()=>{
 const geometry=createEmptyMapGeometry('map',1);geometry.obstacles=[region('dust','dust'),region('paved','solid')]
 expect(mapGeometrySurfaceMaterialAtPoint(geometry,{x:50,y:50})).toBe('solid')
 geometry.obstacles=[region('dust','dust'),{...region('platform'),terrainElevationFeet:10,terrainRegion:true}]
 expect(mapGeometrySurfaceMaterialAtPoint(geometry,{x:50,y:50})).toBeUndefined()
 geometry.obstacles[1].surfaceMaterial='sand'
 expect(mapGeometrySurfaceMaterialAtPoint(geometry,{x:50,y:50})).toBe('sand')
})

it('detects a thin crossed strip even when neither endpoint nor a grid center touches it',()=>{
 const geometry=createEmptyMapGeometry('map',1)
 geometry.obstacles=[{...region('thin','dust'),points:[{x:41,y:0},{x:42,y:0},{x:42,y:100},{x:41,y:100}]}]
 const path={geometry,from:{x:0,y:50},to:{x:100,y:50},materials:['dust'] as const}
 expect(mapGeometryPathTouchesSurface(path)).toBe(true)
 expect(mapGeometryPathTouchesSurface({...path,materials:['sand']})).toBe(false)
 expect(mapGeometryPathTouchesSurface({...path,fromElevationFeet:5,toElevationFeet:5})).toBe(false)
 expect(mapGeometryPathTouchesSurface({...path,fromElevationFeet:0,toElevationFeet:0})).toBe(true)
 expect(mapGeometryPathTouchesSurface({...path,fromElevationFeet:0})).toBe(false)
 geometry.obstacles.push({...geometry.obstacles[0],id:'paving',surfaceMaterial:'solid'})
 expect(mapGeometryPathTouchesSurface(path)).toBe(false)
})
it('checks sloped airborne travel against each crossed ground height, not the endpoint alone',()=>{
 const geometry=createEmptyMapGeometry('map',1)
 geometry.obstacles=[{...region('ledge','sand'),terrainElevationFeet:10}]
 const path={geometry,from:{x:10,y:50},to:{x:90,y:50},materials:['sand'] as const}
 expect(mapGeometryPathTouchesSurface({...path,fromElevationFeet:15,toElevationFeet:15})).toBe(false)
 expect(mapGeometryPathTouchesSurface({...path,fromElevationFeet:15,toElevationFeet:5})).toBe(true)
 expect(mapGeometryPathTouchesSurface({...path,fromElevationFeet:0,toElevationFeet:0})).toBe(false)
 expect(mapGeometryPathTouchesSurface({...path,from:{x:NaN,y:0}})).toBe(false)
})

it('sweeps the full square across a tiny side patch and respects later paving',()=>{
 const geometry=createEmptyMapGeometry('map',1)
 const patch={...region('patch','dust'),points:[{x:41,y:69},{x:42,y:69},{x:42,y:70},{x:41,y:70}]}
 geometry.obstacles=[patch]
 const path={geometry,from:{x:0,y:50},to:{x:100,y:50},halfSizePixels:25,materials:['dust'] as const,fromElevationFeet:0,toElevationFeet:0}
 expect(mapGeometryPathTouchesSurface(path)).toBe(false)
 expect(mapGeometryFootprintTouchesSurface(path)).toBe(true)
 geometry.obstacles.push({...patch,id:'paved',surfaceMaterial:'solid'})
 expect(mapGeometryFootprintTouchesSurface(path)).toBe(false)
 geometry.obstacles[1].points=[{x:41,y:69},{x:41.5,y:69},{x:41.5,y:70},{x:41,y:70}]
 expect(mapGeometryFootprintTouchesSurface(path)).toBe(true)
 expect(mapGeometryFootprintTouchesSurface({...path,fromElevationFeet:5,toElevationFeet:5})).toBe(false)
})

it('excludes diagonal bounding-box corners and includes enclosed patches',()=>{
 const geometry=createEmptyMapGeometry('map',1)
 const patch={...region('patch','sand'),points:[{x:85,y:5},{x:90,y:5},{x:90,y:10},{x:85,y:10}]}
 geometry.obstacles=[patch]
 const path={geometry,from:{x:0,y:0},to:{x:100,y:100},halfSizePixels:25,materials:['sand'] as const}
 expect(mapGeometryFootprintTouchesSurface(path)).toBe(false)
 patch.points=patch.points.map(p=>({x:p.x-40,y:p.y+40}))
 expect(mapGeometryFootprintTouchesSurface(path)).toBe(true)
 expect(mapGeometryFootprintTouchesSurface({...path,from:{x:50,y:50},to:{x:50,y:50}})).toBe(true)
 expect(mapGeometryFootprintTouchesSurface({...path,halfSizePixels:NaN})).toBe(false)
})

it('matches the footprint at the exact height crossing rather than any point of the sweep',()=>{
 const geometry=createEmptyMapGeometry('map',1)
 const ledge={...region('ledge','gravel'),terrainElevationFeet:10,points:[{x:49,y:65},{x:51,y:65},{x:51,y:70},{x:49,y:70}]}
 geometry.obstacles=[ledge]
 const path={geometry,from:{x:0,y:50},to:{x:100,y:50},halfSizePixels:25,materials:['gravel'] as const,fromElevationFeet:20,toElevationFeet:0}
 expect(mapGeometryFootprintTouchesSurface(path)).toBe(true)
 ledge.points=ledge.points.map(p=>({x:p.x+50,y:p.y}))
 expect(mapGeometryFootprintTouchesSurface(path)).toBe(false)
 expect(mapGeometryFootprintTouchesSurface({...path,fromElevationFeet:10,toElevationFeet:10})).toBe(true)
 expect(mapGeometryFootprintTouchesSurface({...path,toElevationFeet:undefined})).toBe(false)
})
