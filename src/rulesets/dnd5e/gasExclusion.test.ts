import {expect,it} from 'vitest'
import {gasExcludedAt,gasExclusionSlice,gasExclusionVisionSegments} from './gasExclusion'
import {groveVolumeOverlaps} from '../../../shared/grove-volume.mjs'
import {persistentGasVisualClip} from '../../components/map/groveFogVisualClip'
import {boxCoveredBySpheres} from './sphereUnionCoverage'
import {dnd5eTokenIntersectsPersistentAreaAt} from './persistentAreaGeometry'
import {mapGeometryCanSeeToken,mapGeometryVisibilityPolygon} from '../../lib/mapGeometry'
import {migrateMapsState,type BattleMap,type Dnd5ePluginArea,type Token} from '../../store/maps'
import {reconcileDnd5ePluginAreasOnMap} from './pluginAreas'
const token=(id:string,x:number,y=225):Token=>({id,label:id,type:'enemy',x,y,size:1,color:'#ffffff',emoji:''})
function fixture(){
 const gas:Dnd5ePluginArea={id:'gas',pluginId:'test.gas',featureId:'gas',label:'Gas',color:'#ffffff',sourceTokenId:'other',sourceCharacterId:'other',cells:Array.from({length:100},(_,i)=>({col:i%10,row:Math.floor(i/10)})),createdRound:1,expiresAfterRound:100,dispersedByStrongWind:true,obscuration:{kind:'heavy'},vertical:{mode:'volume',baseElevationFeet:-20,heightFeet:50}}
 const wind:Dnd5ePluginArea={...gas,id:'wind',featureId:'wind',sourceTokenId:'caster',sourceCharacterId:'caster',dispersedByStrongWind:undefined,obscuration:undefined,excludesWindDispersibleGas:true,anchorMode:'source-token',anchorCell:{col:4,row:4},cells:Array.from({length:25},(_,i)=>({col:2+i%5,row:2+Math.floor(i/5)})),vertical:{mode:'volume',shape:'sphere',baseElevationFeet:-10,heightFeet:20,anchorOffsetFeet:-10}}
 const map:BattleMap={id:'gas-map',name:'Gas',width:1000,height:1000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[token('caster',225),token('friend',275),token('outside',425)],dnd5ePluginAreas:[gas,wind]}
 return {map,gas,wind}
}
it('checks sphere unions throughout the volume, including uncovered gaps between covered corners',()=>{
 expect(boxCoveredBySpheres([-1,-1,-1],[1,1,1],[{center:[-.75,0,0],radius:1.61},{center:[.75,0,0],radius:1.61}])).toBe(true)
 expect(boxCoveredBySpheres([-1,-1,-1],[1,1,1],[{center:[-.75,0,0],radius:1.5},{center:[.75,0,0],radius:1.5}])).toBe(false)
 expect(boxCoveredBySpheres([-1,-1,-1],[1,1,1],Array.from({length:8},(_,i)=>({center:[i&1?1:-1,i&2?1:-1,i&4?1:-1] as [number,number,number],radius:.5})))).toBe(false)
})
it('checks curved gas intersections instead of requiring empty bounding-box corners to be covered',()=>{
 const domain={center:[0,0,0] as [number,number,number],radius:1}
 expect(boxCoveredBySpheres([-2,-2,-2],[2,2,2],[domain],domain)).toBe(true)
 expect(boxCoveredBySpheres([-2,-2,-2],[2,2,2],[{...domain,radius:.9}],domain)).toBe(false)
 expect(boxCoveredBySpheres([.5,-2,-2],[2,2,2],[{center:[1,0,0],radius:1}],domain)).toBe(true)
 expect(boxCoveredBySpheres([.4,-2,-2],[2,2,2],[{center:[1,0,0],radius:1}],domain)).toBe(false)
 expect(boxCoveredBySpheres([2,2,2],[3,3,3],[],domain)).toBe(true)
 expect(boxCoveredBySpheres([0,0,0],[.5,.5,.5],[],domain)).toBe(false)
})
it('ignores the part of a large creature outside a fully warded spherical cloud',()=>{
 const {map,gas,wind}=fixture()
 gas.anchorCell={col:4,row:4};gas.vertical={mode:'volume',shape:'sphere',baseElevationFeet:-10,heightFeet:20}
 expect(gasExcludedAt(map,gas,{x:225,y:225},0,20,100)).toBe(true)
 wind.vertical={...wind.vertical!,mode:'volume',shape:'sphere',baseElevationFeet:-9,heightFeet:18}
 expect(gasExcludedAt(map,gas,{x:225,y:225},0,20,100)).toBe(false)
})
it('combines original structure exclusions with wind coverage at each height band',()=>{
 const {map,gas}=fixture()
 const position={x:275,y:225}
 expect(gasExcludedAt(map,gas,position,0,5,60)).toBe(false)
 gas.groveVolume={minX:0,minY:0,widthPixels:1000,baseElevationFeet:-20,heightFeet:50,excludedStructures:[
  {points:[{x:275,y:0},{x:1000,y:0},{x:1000,y:1000},{x:275,y:1000}],baseElevationFeet:-20,heightFeet:50},
 ]}
 const before=JSON.stringify(gas)
 expect(gasExcludedAt(map,gas,position,0,5,60)).toBe(true)
 expect(JSON.stringify(gas)).toBe(before)
 gas.groveVolume.excludedStructures[0].baseElevationFeet=0
 gas.groveVolume.excludedStructures[0].heightFeet=2
 expect(gasExcludedAt(map,gas,position,0,5,60)).toBe(false)
})
it('combines wind volumes for a creature and checks only its actual gas contact',()=>{
 const {map,gas,wind}=fixture()
 map.tokens.push(token('second',325))
 map.dnd5ePluginAreas!.push({...wind,id:'second-wind',sourceTokenId:'second',cells:wind.cells.map(c=>({...c,col:c.col+2}))})
 expect(gasExcludedAt(map,gas,{x:275,y:225},0,5,75)).toBe(false)
 expect(gasExcludedAt(map,gas,{x:275,y:225},0,5,60)).toBe(true)
 map.dnd5ePluginAreas=[gas,wind]
 expect(gasExcludedAt(map,gas,{x:275,y:225},0,5,60)).toBe(false)
 gas.cells=[{col:4,row:4}]
 expect(gasExcludedAt(map,gas,{x:275,y:225},0,5,75)).toBe(true)
 gas.vertical={mode:'volume',baseElevationFeet:0,heightFeet:1}
 expect(gasExcludedAt(map,gas,{x:225,y:225},0,20,25)).toBe(true)
})
it('excludes only the gas volume inside a live ward without changing the cloud',()=>{
 const{map,gas}=fixture(),before=JSON.stringify(gas)
 expect(gasExcludedAt(map,gas,{x:225,y:225},0)).toBe(true)
 expect(gasExcludedAt(map,gas,{x:425,y:225},0)).toBe(false)
 expect(gasExcludedAt(map,gas,{x:225,y:225},20)).toBe(false)
 expect(dnd5eTokenIntersectsPersistentAreaAt(map.tokens[0],map,gas,map.tokens[0])).toBe(false)
 expect(dnd5eTokenIntersectsPersistentAreaAt(map.tokens[2],map,gas,map.tokens[2])).toBe(true)
 const large={...map.tokens[0],size:5}
 expect(dnd5eTokenIntersectsPersistentAreaAt(large,map,gas,large)).toBe(true)
 expect(JSON.stringify(gas)).toBe(before)
 const restored=migrateMapsState(JSON.parse(JSON.stringify({maps:[map]}))).maps[0]
 expect(restored.dnd5ePluginAreas![1].excludesWindDispersibleGas).toBe(true)
 expect(reconcileDnd5ePluginAreasOnMap(restored,[],1).dnd5ePluginAreas).toHaveLength(2)
})
it.each(['removed','paused','moved','non-gas'] as const)('restores gas exposure when %s',mode=>{
 const{map,gas,wind}=fixture()
 if(mode==='removed')map.dnd5ePluginAreas=[gas]
 if(mode==='paused')wind.modeState={paused:true,profiles:[{id:'wind'}],selectedModeId:'wind',changeReceipts:[]}
 if(mode==='moved')map.tokens[0].x=725
 if(mode==='non-gas')gas.dispersedByStrongWind=false
 expect(gasExcludedAt(map,gas,{x:225,y:225},0)).toBe(false)
})
it('sees within the cleared volume but not through the remaining fog',()=>{
 const{map}=fixture()
 const canSee=(target:Token)=>mapGeometryCanSeeToken({map,viewer:map.tokens[0],target,forceEnabled:true,fallbackRangeFeet:120})
 expect(canSee(map.tokens[1])).toBe(true)
 expect(canSee(map.tokens[2])).toBe(false)
 expect(canSee({...map.tokens[1],elevationFeet:20})).toBe(false)
 map.dnd5ePluginAreas=map.dnd5ePluginAreas!.filter(a=>a.id!=='wind')
 expect(canSee(map.tokens[1])).toBe(false)
})

it('clips the actual visibility polygon at the curved gas boundary without internal grid seams',()=>{
 const {map,gas}=fixture()
 const edges=gasExclusionVisionSegments(map,gas,2.5)!
 expect(edges.length).toBeGreaterThan(0)
 const polygon=mapGeometryVisibilityPolygon({map,viewer:map.tokens[0],forceEnabled:true,fallbackRangeFeet:120})
 // The entire visible boundary lies on the sphere's eye-height cross section.
 const radius=Math.sqrt(100-2.5**2)*10
 expect(polygon.length).toBeGreaterThan(90)
 for(const p of polygon)expect(Math.hypot(p.x-225,p.y-225)).toBeCloseTo(radius,0)
})

it('preserves original gas structure holes in the actual vision boundary',()=>{
 const {map,gas}=fixture()
 gas.groveVolume={minX:0,minY:0,widthPixels:500,baseElevationFeet:-20,heightFeet:50,excludedStructures:[
  {points:[{x:275,y:200},{x:475,y:200},{x:475,y:250},{x:275,y:250}],baseElevationFeet:-20,heightFeet:50},
 ]}
 const before=JSON.stringify(gas)
 const polygon=mapGeometryVisibilityPolygon({map,viewer:map.tokens[0],forceEnabled:true,fallbackRangeFeet:120})
 expect(Math.max(...polygon.map(p=>p.x))).toBeGreaterThan(470)
 expect(Math.max(...polygon.map(p=>p.x))).toBeLessThanOrEqual(475.01)
 gas.groveVolume.excludedStructures[0].heightFeet=21
 const lowStructure=mapGeometryVisibilityPolygon({map,viewer:map.tokens[0],forceEnabled:true,fallbackRangeFeet:120})
 expect(Math.max(...lowStructure.map(p=>p.x))).toBeLessThan(325)
 gas.groveVolume.excludedStructures[0].heightFeet=50
 expect(JSON.stringify(gas)).toBe(before)
})

it('subtracts the union of overlapping winds and restores it when the second ward ends',()=>{
 const {map,gas,wind}=fixture()
 map.tokens.push(token('second',325))
 const second={...wind,id:'second-wind',sourceTokenId:'second',anchorCell:{col:6,row:4},cells:wind.cells.map(c=>({...c,col:c.col+2}))}
 map.dnd5ePluginAreas!.push(second)
 const before=JSON.stringify(gas)
 const slice=gasExclusionSlice(map,gas,0)!
 for(const x of [225,275,325,400])expect(groveVolumeOverlaps(slice,{x,y:225},0)).toBe(false)
 expect(groveVolumeOverlaps(slice,{x:450,y:225},0)).toBe(true)
 const polygon=mapGeometryVisibilityPolygon({map,viewer:map.tokens[0],forceEnabled:true})
 expect(Math.max(...polygon.map(p=>p.x))).toBeGreaterThan(420)
 expect(Math.max(...polygon.map(p=>p.x))).toBeLessThan(423)
 map.dnd5ePluginAreas=[gas,wind]
 expect(groveVolumeOverlaps(gasExclusionSlice(map,gas,0)!,{x:400,y:225},0)).toBe(true)
 expect(gasExclusionSlice(map,gas,20)).toBeUndefined()
 expect(JSON.stringify(gas)).toBe(before)
})

it('renders holes in overlapping wind regions without erasing the remaining cloud',()=>{
 const {map,gas,wind}=fixture()
 map.tokens.push(token('second',325))
 map.dnd5ePluginAreas!.push({...wind,id:'second-wind',sourceTokenId:'second',cells:wind.cells.map(c=>({...c,col:c.col+2}))})
 type Point={x:number;y:number}
 let paths:Point[][]=[],current:Point[]=[]
 const masks:Point[][][]=[]
 const context={
  beginPath(){paths=[];current=[]},
  moveTo(x:number,y:number){current=[{x,y}];paths.push(current)},
  lineTo(x:number,y:number){current.push({x,y})},
  closePath(){},
  rect(x:number,y:number,w:number,h:number){paths.push([{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}])},
  clip(){masks.push(paths)},
 }
 persistentGasVisualClip(gas,map)!(context)
 const inside=(p:Point,loop:Point[])=>{
  let yes=false
  for(let i=0,j=loop.length-1;i<loop.length;j=i++){
   const a=loop[i],b=loop[j]
   if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes
  }
  return yes
 }
 const visible=(p:Point)=>masks.every(mask=>mask.filter(loop=>inside(p,loop)).length%2===1)
 expect(masks.length).toBe(1)
 for(const x of [225,275,325,400])expect(visible({x,y:225})).toBe(false)
 expect(visible({x:475,y:225})).toBe(true)
 expect(visible({x:725,y:225})).toBe(false)
})
