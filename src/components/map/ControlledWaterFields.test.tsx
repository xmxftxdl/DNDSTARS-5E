import {expect,it} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {ControlledWaterFields,createControlledWaterPatch} from './ControlledWaterFields'
import {normalizeMapGeometryEntity,type MapGeometryObstacle} from '../../lib/mapGeometry'
const body:MapGeometryObstacle={id:'pond',kind:'obstacle',label:'Pond',points:[{x:100,y:100},{x:300,y:100},{x:300,y:200},{x:100,y:200}],
 baseHeightFeet:-5,heightFeet:5,cover:'none',blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,createdAt:1}
it('authors a water volume from map scale and preserves it across JSON normalization',()=>{
 const before=structuredClone(body),patch=createControlledWaterPatch(body,0.1)!
 const saved=normalizeMapGeometryEntity(JSON.parse(JSON.stringify({...body,...patch})))
 expect(saved).toMatchObject({blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,
  controlledWater:{id:'pond',positionFeet:{x:20,y:15,z:-5},dimensionsFeet:{x:20,y:10,z:5},alterations:[],appliedActionIds:[]}})
 expect(body).toEqual(before)
 expect(createControlledWaterPatch(body,0)).toBeUndefined()
 expect(createControlledWaterPatch({...body,heightFeet:0},0.1)).toBeUndefined()
 expect(createControlledWaterPatch({...body,points:[{x:0,y:0}]},0.1)).toBeUndefined()
})
it('leaves ordinary polygons unclassified and explains depth before enabling water',()=>{
 const html=renderToStaticMarkup(<ControlledWaterFields body={body} feetPerPixel={0.1} onChange={()=>{}}/>)
 expect(html).toContain('供操水术选择');expect(html).not.toContain('checked=""')
 const invalid=renderToStaticMarkup(<ControlledWaterFields body={{...body,heightFeet:0}} feetPerPixel={0.1} onChange={()=>{}}/>)
 expect(invalid).toContain('disabled=""');expect(invalid).toContain('水深')
 const marked={...body,...createControlledWaterPatch(body,0.1)} as MapGeometryObstacle
 const editor=renderToStaticMarkup(<ControlledWaterFields body={marked} feetPerPixel={0.1} onChange={()=>{}}/>)
 expect(editor).toContain('水体原始颜色');expect(editor).toContain('水体原始不透明度');expect(editor).toContain('checked=""')
})
