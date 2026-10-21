import {expect,it} from 'vitest'
import {createEmptyMapGeometry,mapGeometryFootprintTerrainSamples} from './mapGeometry'
const diamond=[{x:0,y:-50},{x:50,y:0},{x:0,y:50},{x:-50,y:0}]
const fixture=()=>{
  const geometry=createEmptyMapGeometry('map',1)
  geometry.obstacles.push({id:'soil',kind:'obstacle',label:'Soil',points:[{x:-50,y:-50},{x:50,y:-50},{x:50,y:50},{x:-50,y:50}],
    surfaceMaterial:'loose-earth',terrainElevationFeet:0,baseHeightFeet:0,heightFeet:0,
    cover:'none',blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,createdAt:1})
  return geometry
}
it('does not reject a rotated footprint because of stone outside its real boundary',()=>{
  const geometry=fixture()
  geometry.obstacles.push({...geometry.obstacles[0],id:'stone',surfaceMaterial:'stone',points:[{x:40,y:40},{x:50,y:40},{x:50,y:50},{x:40,y:50}]})
  const probe={geometry,at:{x:0,y:0},halfSizePixels:50}
  expect(mapGeometryFootprintTerrainSamples(probe).some(p=>p.material==='stone')).toBe(true)
  expect(mapGeometryFootprintTerrainSamples({...probe,footprint:diamond})).toEqual([{elevationFeet:0,material:'loose-earth'}])
})
it('detects a thin patch inside the exact polygon',()=>{
  const geometry=fixture()
  geometry.obstacles.push({...geometry.obstacles[0],id:'stone',surfaceMaterial:'stone',points:[{x:0,y:0},{x:0.01,y:0},{x:0.01,y:1},{x:0,y:1}]})
  expect(mapGeometryFootprintTerrainSamples({geometry,at:{x:0,y:0},halfSizePixels:50,footprint:diamond}).some(p=>p.material==='stone')).toBe(true)
})
