// Full-emitter fixtures retain the bounding cells for every tested rotation; the exact prism still limits emission.
import {expect,it} from 'vitest'
import {rasterizeContinuousLight} from './continuousLightRaster'
import {createEmptyMapGeometry,mapGeometrySpellLightingSources,mapGeometrySpellLightContributionAtPoint} from './mapGeometry'
import type {BattleMap,Dnd5ePluginArea} from '../store/maps'
const area:Dnd5ePluginArea={id:'wall',pluginId:'test',featureId:'wall',label:'Wall',color:'#fff',sourceTokenId:'caster',sourceCharacterId:'caster',createdRound:1,expiresAfterRound:100,anchorCell:{col:50,row:50},cells:Array.from({length:15},(_,x)=>Array.from({length:15},(_,y)=>({col:43+x,row:43+y}))).flat(),rectGeometry:{lengthFeet:60,widthFeet:5,gridAligned:false,direction:{dc:1,dr:0}},vertical:{mode:'volume',baseElevationFeet:30,heightFeet:10},lighting:{kind:'light',emission:'rectangle-volume',brightRadiusFeet:120,dimRadiusFeet:120,spellLevel:5,color:'#ffffff'}}
const map:BattleMap={id:'raster',name:'Raster',width:6000,height:6000,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[],dnd5ePluginAreas:[area]}
it('writes bright/dim/unlit alpha from the extended source, without adding dim lights together',()=>{
 const source=mapGeometrySpellLightingSources(map)[0]
 for(const [x,alpha] of [[3980,255],[4100,133],[5300,0]]){
  const result=rasterizeContinuousLight({map,sources:[source,source],bounds:{x:x-.5,y:2524.5,width:1,height:1},pixelSize:1})
  expect([...result.rgba]).toEqual([0,0,0,alpha])
 }
})
it('rasterizes blocked points as transparent rather than cutting through the screen',()=>{
 const geometry=createEmptyMapGeometry(map.id,1)
 geometry.walls=[{id:'screen',kind:'wall',label:'Screen',points:[{x:1900,y:2775},{x:3200,y:2775}],blocksVision:true,blocksMovement:true,blocksLineOfEffect:true,baseHeightFeet:0,heightFeet:100,createdAt:1}]
 const input={map,geometry,sources:mapGeometrySpellLightingSources(map),bounds:{x:2520,y:3020,width:10,height:10},pixelSize:2}
 expect([...rasterizeContinuousLight(input).rgba].every(value=>value===0)).toBe(true)
 geometry.walls=[]
 const clear=rasterizeContinuousLight(input)
 expect(clear.width).toBe(5);expect(clear.height).toBe(5)
 expect(Array.from({length:25},(_,i)=>clear.rgba[i*4+3])).toEqual(Array(25).fill(255))
})
it('refuses an oversized allocation before sampling',()=>{
 expect(()=>rasterizeContinuousLight({map,sources:[],bounds:{x:0,y:0,width:100000,height:100000},pixelSize:1})).toThrow('continuous-light-raster-too-large')
})

it('whole-emitter shadow shortcut matches authority for tilt, height, partial walls and magical openings',()=>{
 for(const pitchDegrees of [0,45,90])for(const heightFeet of [20,100])for(const passage of [false,true]){
  const tilted={...area,rectGeometry:{...area.rectGeometry!,pitchDegrees,rollDegrees:30}}
  const scene={...map,dnd5ePluginAreas:[tilted,...(passage?[{...area,id:'passage',lighting:undefined,blocking:{suppressesMappedBarriers:true as const},cells:[{col:50,row:55}],vertical:{mode:'volume' as const,baseElevationFeet:0,heightFeet:100}}]:[])]}
  const geometry=createEmptyMapGeometry(map.id,1)
  geometry.walls=[{id:'screen',kind:'wall',label:'Screen',points:[{x:2450,y:2775},{x:2700,y:2775}],blocksVision:true,blocksMovement:true,blocksLineOfEffect:true,baseHeightFeet:0,heightFeet,createdAt:1}]
  const source=mapGeometrySpellLightingSources(scene)[0]
  const bounds={x:2200,y:2800,width:600,height:400},pixelSize=50
  const result=rasterizeContinuousLight({map:scene,geometry,sources:[source],bounds,pixelSize})
  for(let row=0;row<result.height;row++)for(let col=0;col<result.width;col++){
   const point={x:bounds.x+(col+.5)*pixelSize,y:bounds.y+(row+.5)*pixelSize}
   const expected=mapGeometrySpellLightContributionAtPoint({map:scene,geometry,source,point})
   expect(result.rgba[(row*result.width+col)*4+3]).toBe(expected==='bright'?255:expected==='dim'?133:0)
  }
 }
})

it.each([0.1,0])('raster retains a vertical opening of %s without combining separate wall shadows',gap=>{
 const emitter={...area,vertical:{mode:'volume' as const,baseElevationFeet:0,heightFeet:10}}
 const scene={...map,dnd5ePluginAreas:[emitter]},geometry=createEmptyMapGeometry(map.id,1)
 const wall=(id:string,baseHeightFeet:number,heightFeet:number)=>({id,kind:'wall' as const,label:id,points:[{x:1900,y:2775},{x:3200,y:2775}],blocksVision:true,blocksMovement:true,blocksLineOfEffect:true,baseHeightFeet,heightFeet,createdAt:1})
 geometry.walls=[wall('bottom',-100,101),wall('top',1+gap,100)]
 const result=rasterizeContinuousLight({map:scene,geometry,sources:mapGeometrySpellLightingSources(scene),bounds:{x:2524.5,y:3024.5,width:1,height:1},pixelSize:1})
 expect(result.rgba[3]).toBe(gap?255:0)
})

