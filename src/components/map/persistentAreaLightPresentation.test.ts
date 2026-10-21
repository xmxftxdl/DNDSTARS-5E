import { describe,expect,it } from 'vitest'
import type { BattleMap,Dnd5ePluginArea } from '../../store/maps'
import { createEmptyMapGeometry,mapGeometrySpellLightingSources,mapGeometryPointInPolygon,mapGeometryIlluminationAtPoint } from '../../lib/mapGeometry'
import { persistentAreaGroundLightPolygons } from './persistentAreaLightPresentation'
const map:BattleMap={id:'ground-light',name:'Light',width:1000,height:1000,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[]}
const area:Dnd5ePluginArea={id:'beam',pluginId:'test',featureId:'beam',sourceCharacterId:'caster',sourceTokenId:'caster',label:'Beam',color:'#ffffff',cells:[{col:2,row:2},{col:3,row:2},{col:2,row:3}],anchorCell:{col:2,row:2},anchorMode:'fixed',createdRound:1,expiresAfterRound:10,vertical:{mode:'volume',baseElevationFeet:0,heightFeet:40},lighting:{kind:'light',sunlight:true,areaOnly:true,brightRadiusFeet:30,dimRadiusFeet:0,spellLevel:5,color:'#ffffff'}}
function fixture(){const scene={...map,dnd5ePluginAreas:[structuredClone(area)]};const geometry=createEmptyMapGeometry(map.id,1);geometry.vision.ambientLight='darkness';return {scene,geometry}}
describe('persistent area ground illumination presentation',()=>{
 it('matches occupied cells and avoids brightening gaps or the old radial footprint',()=>{
  const {scene,geometry}=fixture()
  const source=mapGeometrySpellLightingSources(scene,geometry)[0]
  const polygons=persistentAreaGroundLightPolygons({map:scene,geometry,source})
  for(const [x,y,lit] of [[125,125,true],[175,125,true],[125,175,true],[175,175,false],[225,125,false]] as const){
   expect(polygons.some(polygon=>mapGeometryPointInPolygon({x,y},polygon))).toBe(lit)
   expect(mapGeometryIlluminationAtPoint({map:scene,geometry,point:{x,y}})).toBe(lit?'bright':'darkness')
  }
 })
 it('retains wall clipping inside the declared footprint',()=>{
  const {scene,geometry}=fixture()
  geometry.walls=[{id:'wall',kind:'wall',label:'Wall',points:[{x:150,y:50},{x:150,y:250}],blocksVision:true,blocksMovement:true,blocksLineOfEffect:true,baseHeightFeet:0,heightFeet:60,createdAt:1}]
  const polygons=persistentAreaGroundLightPolygons({map:scene,geometry,source:mapGeometrySpellLightingSources(scene,geometry)[0]})
  expect(polygons.some(polygon=>mapGeometryPointInPolygon({x:175,y:125},polygon))).toBe(false)
  expect(polygons.some(polygon=>mapGeometryPointInPolygon({x:125,y:125},polygon))).toBe(true)
 })
 it('does not illuminate ground below an elevated volume and preserves source elevation',()=>{
  const {scene,geometry}=fixture()
  scene.dnd5ePluginAreas[0].vertical={mode:'volume',baseElevationFeet:20,heightFeet:40}
  const source=mapGeometrySpellLightingSources(scene,geometry)[0]
  expect(source.elevationFeet).toBe(20)
  expect(persistentAreaGroundLightPolygons({map:scene,geometry,source})).toEqual([])
  expect(mapGeometryIlluminationAtPoint({map:scene,geometry,point:{x:125,y:125}})).toBe('darkness')
 })
 it('moves with persisted cells and clears when the area is removed',()=>{
  const {scene,geometry}=fixture()
  const source=mapGeometrySpellLightingSources(scene,geometry)[0]
  scene.dnd5ePluginAreas=[]
  expect(persistentAreaGroundLightPolygons({map:scene,geometry,source})).toEqual([])
  const moved={...area,cells:[{col:5,row:2}],anchorCell:{col:5,row:2}}
  scene.dnd5ePluginAreas=[JSON.parse(JSON.stringify(moved))]
  const polygons=persistentAreaGroundLightPolygons({map:scene,geometry,source:mapGeometrySpellLightingSources(scene,geometry)[0]})
  expect(polygons.some(polygon=>mapGeometryPointInPolygon({x:275,y:125},polygon))).toBe(true)
  expect(polygons.some(polygon=>mapGeometryPointInPolygon({x:125,y:125},polygon))).toBe(false)
 })
})
