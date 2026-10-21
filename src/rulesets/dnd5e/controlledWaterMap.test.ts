import {expect,it} from 'vitest'
import {createEmptyMapGeometry,normalizeMapGeometry} from '../../lib/mapGeometry'
import {polygonSignedArea} from '../../lib/convexPolygonPartition'
import type {BattleMap} from '../../store/maps'
import {prepareDnd5eWaterAppearanceMapChange} from './controlledWaterMap'
import {projectDnd5eControlledWater} from './controlledWater'
function fixture(){
 const map:BattleMap={id:'map',name:'Map',width:1000,height:1000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,
  tokens:[{id:'actor',type:'player',characterId:'owner',label:'Actor',x:100,y:100,size:1,color:'',emoji:''}]}
 const geometry=createEmptyMapGeometry(map.id,1);geometry.vision.ambientLight='bright'
 geometry.obstacles.push({id:'water',kind:'obstacle',label:'Water',points:[{x:200,y:100},{x:400,y:100},{x:400,y:300},{x:200,y:300}],baseHeightFeet:0,heightFeet:5,
  cover:'none',blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,createdAt:1,
  controlledWater:{id:'water',positionFeet:{x:30,y:20,z:0},dimensionsFeet:{x:20,y:20,z:5},color:'#0088ff',opacity:0.5,alterations:[],appliedActionIds:[]}})
 return {map,geometries:[geometry],actorTokenId:'actor',casterId:'owner',actionId:'first',worldMinute:10,
  selection:{waterId:'water',region:{center:{x:225,y:125},dimensionsFeet:{x:5,y:5,z:5},baseElevationFeet:0},change:{kind:'appearance' as const,color:'#ff0000',opacity:1}}}
}
it('changes only selected water, retaining volume and source ownership through reload',()=>{
 const input=fixture(),before=structuredClone(input),result=prepareDnd5eWaterAppearanceMapChange(input)
 expect(result.ok).toBe(true);if(!result.ok)throw Error(result.reason)
 const geometry=normalizeMapGeometry(JSON.parse(JSON.stringify(result.geometries[0])))!
 const affected=geometry.obstacles.filter(o=>o.controlledWater?.alterations.length)
 expect(affected.reduce((v,o)=>v+Math.abs(polygonSignedArea(o.points))*0.01*o.heightFeet,0)).toBeCloseTo(125)
 expect(geometry.obstacles.reduce((v,o)=>v+Math.abs(polygonSignedArea(o.points))*0.01*o.heightFeet,0)).toBeCloseTo(2000)
 expect(affected.every(o=>o.controlledWater?.sourceWaterId==='water')).toBe(true)
 for(const o of geometry.obstacles)expect(projectDnd5eControlledWater(o.controlledWater!,70)).toMatchObject({color:'#0088ff',opacity:0.5})
 expect(input).toEqual(before)
 expect(prepareDnd5eWaterAppearanceMapChange({...input,geometries:result.geometries,selection:{...input.selection,waterId:affected[0].id}})).toMatchObject({ok:false,reason:'water-action-already-applied'})
})
it('reselects fragments as one water source and rejects a third ongoing effect',()=>{
 let input=fixture()
 const first=prepareDnd5eWaterAppearanceMapChange(input);if(!first.ok)throw Error(first.reason)
 const fragment=first.geometries[0].obstacles.find(o=>o.controlledWater?.alterations.length)!
 const second=prepareDnd5eWaterAppearanceMapChange({...input,geometries:first.geometries,actionId:'second',selection:{...input.selection,waterId:fragment.id}})
 expect(second.ok).toBe(true);if(!second.ok)throw Error(second.reason)
 const next=second.geometries[0].obstacles.find(o=>o.controlledWater?.alterations.length)!
 expect(prepareDnd5eWaterAppearanceMapChange({...input,geometries:second.geometries,actionId:'third',selection:{...input.selection,waterId:next.id}})).toMatchObject({ok:false,reason:'water-effect-limit'})
 const dismissed=prepareDnd5eWaterAppearanceMapChange({...input,geometries:second.geometries,actionId:'dismiss',selection:{dismissEffectId:'first'}})
 if(!dismissed.ok)throw Error(dismissed.reason)
 expect(new Set(dismissed.geometries.flatMap(g=>g.obstacles.flatMap(o=>o.controlledWater?.alterations.map(e=>e.id)??[])))).toEqual(new Set(['second']))
})
it('counts remote-map effects and refuses freezing occupied water without changing input',()=>{
 const input=fixture(),first=prepareDnd5eWaterAppearanceMapChange(input);if(!first.ok)throw Error(first.reason)
 const remote={...first.geometries[0],mapId:'remote'}
 const result=prepareDnd5eWaterAppearanceMapChange({...input,actionId:'second',geometries:[input.geometries[0],remote]})
 if(!result.ok)throw Error(result.reason)
 const id=result.geometries[0].obstacles.find(o=>o.controlledWater?.alterations.length)!.id
 expect(prepareDnd5eWaterAppearanceMapChange({...input,actionId:'third',geometries:result.geometries,selection:{...input.selection,waterId:id}})).toMatchObject({ok:false,reason:'water-effect-limit'})
 input.map.tokens.push({id:'enemy',type:'enemy',label:'Enemy',x:260,y:125,size:1,color:'',emoji:''})
 const before=structuredClone(input)
 expect(prepareDnd5eWaterAppearanceMapChange({...input,selection:{...input.selection,change:{kind:'freeze'}}})).toMatchObject({ok:false,reason:'water-freezing-occupied-or-unknown'})
 expect(input).toEqual(before)
 input.map.tokens[1].elevationFeet=5
 expect(prepareDnd5eWaterAppearanceMapChange({...input,selection:{...input.selection,change:{kind:'freeze'}}}).ok).toBe(true)
})
it('moves only selected water with conserved volume, no damage, and no timed movement effect',()=>{
 const input=fixture(),before=structuredClone(input)
 const change={kind:'move' as const,displacementFeet:{x:-3,y:0,z:4}}
 const result=prepareDnd5eWaterAppearanceMapChange({...input,selection:{...input.selection,change}})
 expect(result.ok).toBe(true);if(!result.ok)throw Error(result.reason)
 const geometry=result.geometries[0],moved=geometry.obstacles.filter(o=>o.controlledWater?.appliedActionIds.includes('first'))
 expect(moved.reduce((sum,o)=>sum+Math.abs(polygonSignedArea(o.points))*0.01*o.heightFeet,0)).toBeCloseTo(125)
 expect(geometry.obstacles.reduce((sum,o)=>sum+Math.abs(polygonSignedArea(o.points))*0.01*o.heightFeet,0)).toBeCloseTo(2000)
 expect(moved.every(o=>o.baseHeightFeet===4&&o.controlledWater!.positionFeet.z===4&&o.controlledWater!.alterations.length===0)).toBe(true)
 expect(Math.min(...moved.flatMap(o=>o.points.map(p=>p.x)))).toBeCloseTo(170)
 expect(geometry.obstacles.filter(o=>!moved.includes(o)).every(o=>o.baseHeightFeet===0)).toBe(true)
 expect(input).toEqual(before)
 expect(normalizeMapGeometry(JSON.parse(JSON.stringify(geometry)))?.obstacles).toHaveLength(geometry.obstacles.length)
})
it('rejects movement through a wall or beyond five feet without editing the source',()=>{
 const input=fixture()
 input.geometries[0].walls.push({id:'wall',kind:'wall',label:'Wall',points:[{x:180,y:0},{x:180,y:500}],baseHeightFeet:0,heightFeet:20,blocksVision:false,blocksLineOfEffect:false,blocksMovement:true,createdAt:1})
 const before=structuredClone(input)
 const move=(x:number)=>prepareDnd5eWaterAppearanceMapChange({...input,selection:{...input.selection,change:{kind:'move',displacementFeet:{x,y:0,z:0}}}})
 expect(move(-5)).toMatchObject({ok:false,reason:'water-movement-blocked'})
 expect(move(-6)).toMatchObject({ok:false,reason:'invalid-water-movement'})
 expect(input).toEqual(before)
})
it('keeps one shared drawing frame across fragments and translates it only with moved water',()=>{
 const input=fixture(),drawing={version:1 as const,strokes:[{points:[0,0,1,1],color:'#ffffff',width:0.02}]}
 input.selection.region.center={x:300,y:200}
 const result=prepareDnd5eWaterAppearanceMapChange({...input,selection:{...input.selection,change:{kind:'shape',description:'Wave',drawing}}})
 if(!result.ok)throw Error(result.reason)
 const fragments=result.geometries[0].obstacles.filter(o=>o.controlledWater?.alterations.length)
 expect(fragments.length).toBeGreaterThan(1)
 for(const o of fragments)expect(o.controlledWater!.alterations[0].drawingFrameFeet).toEqual({x:27.5,y:17.5,width:5,height:5})
 const restored=normalizeMapGeometry(JSON.parse(JSON.stringify(result.geometries[0])))!
 expect(restored.obstacles.find(o=>o.id===fragments[0].id)?.controlledWater?.alterations[0]).toMatchObject({drawing,drawingFrameFeet:{x:27.5,y:17.5,width:5,height:5}})
 const moved=prepareDnd5eWaterAppearanceMapChange({...input,actionId:'move',geometries:result.geometries,selection:{...input.selection,waterId:fragments[0].id,change:{kind:'move',displacementFeet:{x:-5,y:0,z:0}}}})
 if(!moved.ok)throw Error(moved.reason)
 for(const o of moved.geometries[0].obstacles.filter(o=>o.controlledWater?.appliedActionIds.includes('move')))
  expect(o.controlledWater!.alterations[0].drawingFrameFeet).toEqual({x:22.5,y:17.5,width:5,height:5})
})
