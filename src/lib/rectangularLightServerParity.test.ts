// Full-emitter fixtures retain the bounding cells for every tested rotation; the exact prism still limits emission.
import {it,expect} from 'vitest'
import {projectMapsForPlayer} from '../../scripts/shared-server-core.mjs'
import {createEmptyMapGeometry,mapGeometryCanSeeToken} from './mapGeometry'
import type {BattleMap,Dnd5ePluginArea,Token} from '../store/maps'
const area:Dnd5ePluginArea={id:'wall',pluginId:'test',featureId:'wall',sourceTokenId:'viewer',sourceCharacterId:'mine',label:'Wall',color:'#fff',createdRound:1,expiresAfterRound:100,anchorCell:{col:50,row:50},cells:Array.from({length:15},(_,x)=>Array.from({length:15},(_,y)=>({col:43+x,row:43+y}))).flat(),rectGeometry:{lengthFeet:60,widthFeet:5,gridAligned:false,direction:{dc:1,dr:0}},vertical:{mode:'volume',baseElevationFeet:30,heightFeet:10},blocking:{vision:true},lighting:{kind:'light',emission:'rectangle-volume',brightRadiusFeet:120,dimRadiusFeet:120,spellLevel:5,color:'#ffffff'}}
const map:BattleMap={id:'parity',name:'Parity',width:10000,height:10000,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[],dnd5ePluginAreas:[area]}
function check(x:number,y:number,elevationFeet:number,expected:boolean,lengthFeet=60,screen=false,blocker?:Dnd5ePluginArea){
 const target:Token={id:'target',type:'enemy',label:'Target',color:'',emoji:'',size:1,x,y,elevationFeet}
 const viewer:Token={...target,id:'viewer',type:'player',characterId:'mine',x:x+50}
 const current={...map,tokens:[viewer,target],dnd5ePluginAreas:[{...area,rectGeometry:{...area.rectGeometry!,lengthFeet}},...(blocker?[blocker]:[])]}
 const geometry=createEmptyMapGeometry(map.id,1);geometry.vision={enabled:true,ambientLight:'darkness',defaultRangeFeet:30,sharePartyVision:true}
 if(screen)geometry.walls=[{id:'screen-left',kind:'wall',label:'Left',points:[{x:1925,y:2775},{x:2575,y:2775}],blocksVision:true,blocksMovement:true,blocksLineOfEffect:true,baseHeightFeet:0,heightFeet:100,createdAt:1},{id:'screen-right',kind:'wall',label:'Right',points:[{x:2576,y:2775},{x:3125,y:2775}],blocksVision:true,blocksMovement:true,blocksLineOfEffect:true,baseHeightFeet:0,heightFeet:100,createdAt:1}]
 const client=mapGeometryCanSeeToken({map:current,geometry,viewer,target})
 const server=projectMapsForPlayer({maps:[current],selectedId:map.id},{maps:[geometry]},'mine').maps[0].tokens.some((t:Token)=>t.id==='target')
 expect({client,server}).toEqual({client:expected,server:expected})
}
it('keeps extended light beyond the old point-source radius visible to player projection',()=>check(5215,2525,35,true))
it.each([[5,35,false],[2,35,true],[5,500,true]])('suppression uses the emitting edge and elevation: level%s height%s',(level,height,expected)=>{
 const target:Token={id:'target',type:'enemy',label:'Target',color:'',emoji:'',size:1,x:3025,y:2525,elevationFeet:35}
 const viewer:Token={...target,id:'viewer',type:'player',characterId:'mine',x:3075}
 const darkness:Dnd5ePluginArea={...area,id:'dark',blocking:undefined,rectGeometry:undefined,
  anchorCell:{col:107,row:50},cells:[{col:107,row:50}],
  vertical:{mode:'volume',shape:'sphere',baseElevationFeet:height-15,heightFeet:30},
  lighting:{kind:'magical-darkness',radiusFeet:15,spellLevel:9,suppressesMagicalLightThroughLevel:level}}
 const current={...map,tokens:[viewer,target],dnd5ePluginAreas:[area,darkness]}
 const geometry=createEmptyMapGeometry(map.id,1);geometry.vision={enabled:true,ambientLight:'darkness',defaultRangeFeet:30,sharePartyVision:true}
 const client=mapGeometryCanSeeToken({map:current,geometry,viewer,target})
 const server=projectMapsForPlayer({maps:[current],selectedId:map.id},{maps:[geometry]},'mine').maps[0].tokens.some((t:Token)=>t.id==='target')
 expect({client,server}).toEqual({client:expected,server:expected})
})
it('hides targets beyond the full wall emission range',()=>check(5265,2525,35,false))
it('contracts player visibility when the wall shortens',()=>check(5215,2525,35,false,40))
it('agrees through a narrow opening at an interior part of the wall',()=>check(2525,3025,35,true,60,true))
it.each([10,1,0.1,0])('tilted emitter respects an interior opening of %s pixels',width=>{
 const target:Token={id:'target',type:'enemy',label:'Target',color:'',emoji:'',size:1,x:2525,y:3025,elevationFeet:35}
 const viewer:Token={...target,id:'viewer',type:'player',characterId:'mine',x:2575}
 const current={...map,tokens:[viewer,target],dnd5ePluginAreas:[{...area,rectGeometry:{...area.rectGeometry!,pitchDegrees:45,rollDegrees:30}}]}
 const geometry=createEmptyMapGeometry(map.id,1);geometry.vision={enabled:true,ambientLight:'darkness',defaultRangeFeet:30,sharePartyVision:true}
 const screen=(id:string,left:number,right:number)=>({id,kind:'wall' as const,label:id,points:[{x:left,y:2775},{x:right,y:2775}],blocksVision:true,blocksMovement:true,blocksLineOfEffect:true,baseHeightFeet:-100,heightFeet:300,createdAt:1})
 geometry.walls=[screen('left',1925,2575),screen('right',2575+width,3125)]
 const client=mapGeometryCanSeeToken({map:current,geometry,viewer,target})
 const server=projectMapsForPlayer({maps:[current],selectedId:map.id},{maps:[geometry]},'mine').maps[0].tokens.some((t:Token)=>t.id==='target')
 expect({client,server}).toEqual({client:width>0,server:width>0})
})
const screenArea:Dnd5ePluginArea={...area,id:'opaque-screen',lighting:undefined,rectGeometry:undefined,
 cells:Array.from({length:30},(_,index)=>({col:36+index,row:55})),vertical:{mode:'volume',baseElevationFeet:0,heightFeet:100}}
it.each([[false,true],[true,true],[false,false],[true,false]])('persistent rectangular screens tilted=%s open=%s',(tilted,open)=>{
 const target:Token={id:'target',type:'enemy',label:'Target',color:'',emoji:'',size:1,x:2525,y:3025,elevationFeet:35}
 const viewer:Token={...target,id:'viewer',type:'player',characterId:'mine',x:2575}
 const screens=[{col:45,length:60},{col:57,length:open?59.8:60.2}].map(({col,length},i)=>({...screenArea,id:'screen-'+i,anchorCell:{col,row:55},
  rectGeometry:{lengthFeet:length,widthFeet:0.01,gridAligned:false,direction:{dc:1,dr:0}}}))
 const emitter={...area,rectGeometry:{...area.rectGeometry!,...(tilted?{pitchDegrees:45,rollDegrees:30}:{})}}
 const current={...map,tokens:[viewer,target],dnd5ePluginAreas:[emitter,...screens]}
 const geometry=createEmptyMapGeometry(map.id,1);geometry.vision={enabled:true,ambientLight:'darkness',defaultRangeFeet:30,sharePartyVision:true}
 const client=mapGeometryCanSeeToken({map:current,geometry,viewer,target})
 const server=projectMapsForPlayer({maps:[current],selectedId:map.id},{maps:[geometry]},'mine').maps[0].tokens.some((t:Token)=>t.id==='target')
 expect({client,server}).toEqual({client:open,server:open})
})
it('keeps another opaque persistent volume from leaking light on the client',()=>check(2525,3025,35,false,60,false,screenArea))
it('allows light above a short persistent screen',()=>check(2525,3025,35,true,60,false,{...screenArea,vertical:{mode:'volume',baseElevationFeet:0,heightFeet:20}}))
it('blocks emission with heavy area obscuration as well as physical walls',()=>check(2525,3025,35,false,60,false,
 {...screenArea,blocking:undefined,obscuration:{kind:'heavy'}}))


it.each([0,45,90].flatMap(pitch=>[1,0.1,0.01,0].map(width=>[pitch,width])))('client and server see light at pitch%s through vertical slit%s',(pitchDegrees,width)=>{
 const target:Token={id:'target',type:'enemy',label:'Target',color:'',emoji:'',size:1,x:2525,y:3025,elevationFeet:35}
 const viewer:Token={...target,id:'viewer',type:'player',characterId:'mine',x:2575}
 const current={...map,tokens:[viewer,target],dnd5ePluginAreas:[{...area,rectGeometry:{...area.rectGeometry!,pitchDegrees,rollDegrees:30}}]}
 const geometry=createEmptyMapGeometry(map.id,1);geometry.vision={enabled:true,ambientLight:'darkness',defaultRangeFeet:30,sharePartyVision:true}
 const screen=(id:string,baseHeightFeet:number,heightFeet:number)=>({id,kind:'wall' as const,label:id,points:[{x:1900,y:2775},{x:3200,y:2775}],blocksVision:true,blocksMovement:true,blocksLineOfEffect:true,baseHeightFeet,heightFeet,createdAt:1})
 geometry.walls=[screen('bottom',-100,136),screen('top',36+width,100)]
 const client=mapGeometryCanSeeToken({map:current,geometry,viewer,target})
 const server=projectMapsForPlayer({maps:[current],selectedId:map.id},{maps:[geometry]},'mine').maps[0].tokens.some((t:Token)=>t.id==='target')
 expect({client,server}).toEqual({client:width>0,server:width>0})
})
it.each([[undefined,0,false],[2,0,false],[undefined,500,true],[2,500,true]] as const)('wall light preserves mapped darkness level%s height%s',(darknessSpellLevel,baseHeightFeet,expected)=>{
 const target:Token={id:'target',type:'enemy',label:'Target',color:'',emoji:'',size:1,x:4000,y:2525,elevationFeet:35}
 const viewer:Token={...target,id:'viewer',type:'player',characterId:'mine',x:3900}
 const current={...map,tokens:[viewer,target]},geometry=createEmptyMapGeometry(map.id,1)
 geometry.vision={enabled:true,ambientLight:'darkness',defaultRangeFeet:30,sharePartyVision:true}
 geometry.obstacles=[{id:'dark-polygon',kind:'obstacle',label:'Darkness',points:[{x:3975,y:2500},{x:4025,y:2500},{x:4025,y:2550},{x:3975,y:2550}],baseHeightFeet,heightFeet:100,magicalDarkness:true,darknessSpellLevel,blocksVision:false,blocksMovement:false,blocksLineOfEffect:false,cover:'none',createdAt:1}]
 const client=mapGeometryCanSeeToken({map:current,geometry,viewer,target})
 const server=projectMapsForPlayer({maps:[current],selectedId:map.id},{maps:[geometry]},'mine').maps[0].tokens.some((t:Token)=>t.id==='target')
 expect({client,server}).toEqual({client:expected,server:expected})
 // Ordinary Wall of Light has no dispel-darkness declaration.
 expect(area.lighting).not.toHaveProperty('suppressesMagicalDarknessThroughLevel')
})
it.each([0,45].flatMap(pitch=>[0.1,0.01,0].map(gap=>[pitch,gap])))('persistent vertical aperture at pitch%s gap%s',(pitchDegrees,gap)=>{
 const target:Token={id:'target',type:'enemy',label:'Target',color:'',emoji:'',size:1,x:2525,y:3025,elevationFeet:35}
 const viewer:Token={...target,id:'viewer',type:'player',characterId:'mine',x:2575}
 const screens=[[-100,136],[36+gap,100]].map(([baseElevationFeet,heightFeet],i)=>({...screenArea,id:'vertical-screen-'+i,anchorCell:{col:50,row:55},rectGeometry:{lengthFeet:130,widthFeet:0.001,gridAligned:false,direction:{dc:1,dr:0}},vertical:{mode:'volume' as const,baseElevationFeet,heightFeet}}))
 const current={...map,tokens:[viewer,target],dnd5ePluginAreas:[{...area,rectGeometry:{...area.rectGeometry!,pitchDegrees,rollDegrees:30}},...screens]}
 const geometry=createEmptyMapGeometry(map.id,1);geometry.vision={enabled:true,ambientLight:'darkness',defaultRangeFeet:30,sharePartyVision:true}
 const client=mapGeometryCanSeeToken({map:current,geometry,viewer,target})
 const server=projectMapsForPlayer({maps:[current],selectedId:map.id},{maps:[geometry]},'mine').maps[0].tokens.some((t:Token)=>t.id==='target')
 expect({client,server}).toEqual({client:gap>0,server:gap>0})
})
it.each([15,30].flatMap(tilt=>[0.01,0].map(gap=>[tilt,gap])))('tilted persistent screens angle%s gap%s',(tilt,gap)=>{
 const target:Token={id:'target',type:'enemy',label:'Target',color:'',emoji:'',size:1,x:2525,y:3025,elevationFeet:35}
 const viewer:Token={...target,id:'viewer',type:'player',characterId:'mine',x:2575}
 const radians=tilt*Math.PI/180
 const screens=[[-100,136],[36+gap,100]].map(([base,heightFeet],i)=>{
  const delta=base+heightFeet/2-36,centerZ=36+delta*Math.cos(radians)
  return {...screenArea,id:'tilted-screen-'+i,anchorCell:{col:50-delta*Math.sin(radians)/5,row:55},rectGeometry:{lengthFeet:130,widthFeet:0.0001,gridAligned:false,direction:{dc:1,dr:0},pitchDegrees:tilt},vertical:{mode:'volume' as const,baseElevationFeet:centerZ-heightFeet/2,heightFeet}}
 })
 const current={...map,tokens:[viewer,target],dnd5ePluginAreas:[area,...screens]}
 const geometry=createEmptyMapGeometry(map.id,1);geometry.vision={enabled:true,ambientLight:'darkness',defaultRangeFeet:30,sharePartyVision:true}
 const client=mapGeometryCanSeeToken({map:current,geometry,viewer,target})
 const server=projectMapsForPlayer({maps:[current],selectedId:map.id},{maps:[geometry]},'mine').maps[0].tokens.some((t:Token)=>t.id==='target')
 expect({client,server}).toEqual({client:gap>0,server:gap>0})
})
it.each([0.5,0])('grid-based persistent volume vertical aperture %s',gap=>{
 const target:Token={id:'target',type:'enemy',label:'Target',color:'',emoji:'',size:1,x:2525,y:3025,elevationFeet:35}
 const viewer:Token={...target,id:'viewer',type:'player',characterId:'mine',x:2575}
 const screens=[[-100,136],[36+gap,100]].map(([baseElevationFeet,heightFeet],i)=>({...screenArea,id:'grid-screen-'+i,vertical:{mode:'volume' as const,baseElevationFeet,heightFeet}}))
 const current={...map,tokens:[viewer,target],dnd5ePluginAreas:[area,...screens]}
 const geometry=createEmptyMapGeometry(map.id,1);geometry.vision={enabled:true,ambientLight:'darkness',defaultRangeFeet:30,sharePartyVision:true}
 const client=mapGeometryCanSeeToken({map:current,geometry,viewer,target})
 const server=projectMapsForPlayer({maps:[current],selectedId:map.id},{maps:[geometry]},'mine').maps[0].tokens.some((t:Token)=>t.id==='target')
 expect({client,server}).toEqual({client:gap>0,server:gap>0})
})

