// Full-emitter fixtures retain the bounding cells for every tested rotation; the exact prism still limits emission.
import {it,expect} from 'vitest'
import {createEmptyMapGeometry,mapGeometryIlluminationAtPoint,mapGeometrySpellLightingSources,mapGeometrySpellLightContributionAtPoint} from './mapGeometry'
import {rectangularLightOrigin} from './rectangularLightOrigin'
import {normalizeDnd5ePersistentAreaLighting} from '../rulesets/dnd5e/persistentAreaTypes'
import type {BattleMap,Dnd5ePluginArea} from '../store/maps'
const map:BattleMap={id:'emit',name:'Emit',width:10000,height:10000,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[]}
const area:Dnd5ePluginArea={id:'wall',pluginId:'test',featureId:'wall',sourceTokenId:'caster',sourceCharacterId:'caster',label:'Wall',color:'#fff',createdRound:1,expiresAfterRound:100,anchorCell:{col:50,row:50},cells:Array.from({length:15},(_,x)=>Array.from({length:15},(_,y)=>({col:43+x,row:43+y}))).flat(),rectGeometry:{lengthFeet:60,widthFeet:5,gridAligned:false,direction:{dc:1,dr:0}},vertical:{mode:'volume',baseElevationFeet:30,heightFeet:10},lighting:{kind:'light',emission:'rectangle-volume',brightRadiusFeet:120,dimRadiusFeet:120,spellLevel:5,color:'#ffffff'}}
it.each([0,45,90])('single-source drawing contribution agrees with authority at pitch %s',pitchDegrees=>{
 const current={...map,dnd5ePluginAreas:[{...area,rectGeometry:{...area.rectGeometry!,pitchDegrees}}]}
 const geometry=createEmptyMapGeometry(map.id,1);geometry.vision.ambientLight='darkness'
 geometry.walls=[{id:'screen',kind:'wall',label:'Screen',points:[{x:2000,y:2775},{x:3000,y:2775}],blocksVision:true,blocksMovement:true,blocksLineOfEffect:true,baseHeightFeet:0,heightFeet:100,createdAt:1}]
 const source=mapGeometrySpellLightingSources(current,geometry)[0]
 for(const x of [2525,4000,5300])for(const y of [2525,3025])for(const elevationFeet of [0,35,150]){
  const input={map:current,geometry,point:{x,y},elevationFeet}
  expect(mapGeometrySpellLightContributionAtPoint({...input,source})).toBe(mapGeometryIlluminationAtPoint(input))
 }
 expect(mapGeometrySpellLightContributionAtPoint({map:current,geometry,source,point:{x:2525,y:3025},elevationFeet:35})).toBe('darkness')
})
it('samples the actual terrain elevation when the drawing caller omits height',()=>{
 const current={...map,dnd5ePluginAreas:[area]},geometry=createEmptyMapGeometry(map.id,1)
 geometry.vision.ambientLight='darkness'
 const source=mapGeometrySpellLightingSources(current,geometry)[0],point={x:2525,y:2525}
 expect(mapGeometrySpellLightContributionAtPoint({map:current,geometry,source,point})).toBe('bright')
 geometry.obstacles=[{id:'plateau',kind:'obstacle',label:'Plateau',points:[{x:2500,y:2500},{x:2550,y:2500},{x:2550,y:2550},{x:2500,y:2550}],baseHeightFeet:500,heightFeet:0,terrainRegion:true,terrainElevationFeet:500,blocksVision:false,blocksMovement:false,blocksLineOfEffect:false,cover:'none',createdAt:1}]
 expect(mapGeometrySpellLightContributionAtPoint({map:current,geometry,source,point})).toBe('darkness')
 expect(mapGeometryIlluminationAtPoint({map:current,geometry,point})).toBe('darkness')
})
it.each([0,45,90])('measures full rectangular emission after rotation %s and shrinking',angle=>{
 const radians=angle*Math.PI/180,dc=Math.cos(radians),dr=Math.sin(radians)
 const wall={...area,rectGeometry:{...area.rectGeometry!,direction:{dc,dr}}}
 const geometry=createEmptyMapGeometry(map.id,1);geometry.vision.ambientLight='darkness'
 const at=(distance:number,z=35,length=60)=>mapGeometryIlluminationAtPoint({map:{...map,dnd5ePluginAreas:[{...wall,rectGeometry:{...wall.rectGeometry,lengthFeet:length}}]},geometry,point:{x:2525+distance*10*dc,y:2525+distance*10*dr},elevationFeet:z})
 expect(at(149)).toBe('bright');expect(at(151)).toBe('dim');expect(at(269)).toBe('dim');expect(at(271)).toBe('darkness')
 expect(at(149,35,40)).toBe('dim')
 expect(at(0,160)).toBe('bright');expect(at(0,161)).toBe('dim');expect(at(0,281)).toBe('darkness')
})
it('finds the actual edge and rejects incompatible declarations',()=>{
 expect(rectangularLightOrigin(map,area,{x:3000,y:2525,elevationFeet:60})).toEqual({x:2825,y:2525,elevationFeet:40})
 expect(normalizeDnd5ePersistentAreaLighting(area.lighting)).toMatchObject({emission:'rectangle-volume'})
 expect(normalizeDnd5ePersistentAreaLighting({...area.lighting,emission:'script'})).toBeUndefined()
 expect(normalizeDnd5ePersistentAreaLighting({...area.lighting,areaOnly:true})).toBeUndefined()
})
import {rectangularLightFootprint} from './rectangularLightOrigin'
it.each([[45,30],[90,0],[-30,-45],[0,90]])('draws tilted illumination on the analytic radius pitch=%s roll=%s',(pitchDegrees,rollDegrees)=>{
 const wall={...area,rectGeometry:{...area.rectGeometry!,pitchDegrees,rollDegrees}}
 for(const plane of [-50,0,35,100]){
  const points=rectangularLightFootprint(map,wall,120,plane)!
  expect(points).toHaveLength(128)
  for(const point of points){
   const nearest=rectangularLightOrigin(map,wall,{...point,elevationFeet:plane})!
   expect(Math.hypot((point.x-nearest.x)/10,(point.y-nearest.y)/10,plane-nearest.elevationFeet)).toBeCloseTo(120,7)
  }
 }
 expect(rectangularLightFootprint(map,wall,120,1000)).toEqual([])
})
it.each([0,45,90])('draws the flat-plane footprint at the same 3D radius after rotation %s',angle=>{
 const radians=angle*Math.PI/180,wall={...area,rectGeometry:{...area.rectGeometry!,direction:{dc:Math.cos(radians),dr:Math.sin(radians)}}}
 const points=rectangularLightFootprint(map,wall,120,0)!
 expect(points).toHaveLength(68)
 for(const point of points){
 const nearest=rectangularLightOrigin(map,wall,{...point,elevationFeet:0})!
 expect(Math.hypot((point.x-nearest.x)/10,(point.y-nearest.y)/10,nearest.elevationFeet)).toBeCloseTo(120,8)
 }
 const horizontal=Math.sqrt(120**2-30**2)
 const dc=wall.rectGeometry.direction.dc,dr=wall.rectGeometry.direction.dr
 const furthest=Math.max(...points.map(point=>((point.x-2525)*dc+(point.y-2525)*dr)/10))
 expect(furthest).toBeCloseTo(30+horizontal,8)
 const shorter=rectangularLightFootprint(map,{...wall,rectGeometry:{...wall.rectGeometry,lengthFeet:40}},120)!
 expect(Math.max(...shorter.map(point=>((point.x-2525)*dc+(point.y-2525)*dr)/10))).toBeCloseTo(20+horizontal,8)
 expect(rectangularLightFootprint(map,wall,29)).toEqual([])
})
it('receives light from a visible wall end when the nearest emitting face is occluded',()=>{
 const current={...map,dnd5ePluginAreas:[area]},geometry=createEmptyMapGeometry(map.id,1)
 geometry.vision.ambientLight='darkness'
 const wall={id:'screen',kind:'wall' as const,label:'Screen',points:[{x:2475,y:2775},{x:2575,y:2775}],blocksVision:true,blocksMovement:true,blocksLineOfEffect:true,baseHeightFeet:0,heightFeet:100,createdAt:1}
 geometry.walls=[wall]
 expect(mapGeometryIlluminationAtPoint({map:current,geometry,point:{x:2525,y:3025},elevationFeet:35})).toBe('bright')
 geometry.walls=[{...wall,points:[{x:1925,y:2775},{x:3125,y:2775}]}]
 expect(mapGeometryIlluminationAtPoint({map:current,geometry,point:{x:2525,y:3025},elevationFeet:35})).toBe('darkness')
})
it('illuminates through a narrow gap exposing only an interior part of the emitter',()=>{
 const current={...map,dnd5ePluginAreas:[area]},geometry=createEmptyMapGeometry(map.id,1)
 geometry.vision.ambientLight='darkness'
 const screen=(id:string,left:number,right:number)=>({id,kind:'wall' as const,label:id,points:[{x:left,y:2775},{x:right,y:2775}],blocksVision:true,blocksMovement:true,blocksLineOfEffect:true,baseHeightFeet:0,heightFeet:100,createdAt:1})
 for(const width of [10,1,0.1]){
 geometry.walls=[screen('left',1925,2575),screen('right',2575+width,3125)]
 expect(mapGeometryIlluminationAtPoint({map:current,geometry,point:{x:2525,y:3025},elevationFeet:35}),String(width)).toBe('bright')
 }
 geometry.walls=[screen('closed',1925,3125)]
 expect(mapGeometryIlluminationAtPoint({map:current,geometry,point:{x:2525,y:3025},elevationFeet:35})).toBe('darkness')
})
it.each([1,0.1,0.01,0])('vertical slit of %s feet reveals the emitting interior',width=>{
 const current={...map,dnd5ePluginAreas:[area]},geometry=createEmptyMapGeometry(map.id,1)
 geometry.vision.ambientLight='darkness'
 const screen=(id:string,baseHeightFeet:number,heightFeet:number)=>({id,kind:'wall' as const,label:id,points:[{x:1900,y:2775},{x:3200,y:2775}],blocksVision:true,blocksMovement:true,blocksLineOfEffect:true,baseHeightFeet,heightFeet,createdAt:1})
 geometry.walls=[screen('bottom',-100,136),screen('top',36+width,100)]
 expect(mapGeometryIlluminationAtPoint({map:current,geometry,point:{x:2525,y:3025},elevationFeet:35})).toBe(width?'bright':'darkness')
})
it('uses the nearest visible portion near the bright-radius boundary, not only an angular midpoint',()=>{
 const current={...map,dnd5ePluginAreas:[area]},geometry=createEmptyMapGeometry(map.id,1)
 geometry.vision.ambientLight='darkness'
 const screen=(id:string,left:number,right:number)=>({id,kind:'wall' as const,label:id,points:[{x:left,y:2775},{x:right,y:2775}],blocksVision:true,blocksMovement:true,blocksLineOfEffect:true,baseHeightFeet:0,heightFeet:100,createdAt:1})
 geometry.walls=[screen('left',1900,2700),screen('right',2710,3200)]
 // At the near emitter face y2550, x2741.24 passes strictly through the
 // opening and is <120ft away from the target at the same elevation.
 const target={x:2525,y:3730},witness={x:2741.24,y:2550}
 expect(Math.hypot(witness.x-target.x,witness.y-target.y)/10).toBeLessThan(120)
 const crossing=target.x+(witness.x-target.x)*(target.y-2775)/(target.y-witness.y)
 expect(crossing).toBeGreaterThan(2700);expect(crossing).toBeLessThan(2710)
 expect(mapGeometryIlluminationAtPoint({map:current,geometry,point:target,elevationFeet:35})).toBe('bright')
})

