import {expect,it} from 'vitest'
import {createEmptyMapGeometry} from '../../lib/mapGeometry'
import type {BattleMap} from '../../store/maps'
import {selectDnd5eControlledWaterTarget} from './controlledWaterTarget'
function fixture(){
 const map:BattleMap={id:'map',name:'Map',width:1000,height:1000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,
  tokens:[{id:'actor',type:'player',characterId:'owner',label:'Actor',x:100,y:100,size:1,color:'',emoji:''}]}
 const geometry=createEmptyMapGeometry(map.id,1);geometry.vision.enabled=false
 geometry.obstacles.push({id:'water',kind:'obstacle',label:'Water',points:[{x:200,y:100},{x:250,y:100},{x:250,y:150},{x:200,y:150}],baseHeightFeet:0,heightFeet:5,
  cover:'none',blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,createdAt:1,
  controlledWater:{id:'water',positionFeet:{x:999,y:999,z:999},dimensionsFeet:{x:1,y:1,z:1},color:'#0088ff',opacity:0.5,alterations:[],appliedActionIds:[]}})
 return {map,geometry,actorTokenId:'actor',waterId:'water',worldMinute:10}
}
it('derives water volume and positions from Host geometry, preserving the source',()=>{
 const input=fixture(),before=structuredClone(input),target=selectDnd5eControlledWaterTarget(input)!
 expect(target.water.positionFeet).toEqual({x:22.5,y:12.5,z:0})
 expect(target.water.dimensionsFeet).toEqual({x:5,y:5,z:5})
 expect(target.containsCreatures).toBe(false)
 expect(input).toEqual(before)
 input.geometry.obstacles[0].controlledWater=undefined
 expect(selectDnd5eControlledWaterTarget(input)).toBeUndefined()
})
it('detects partially overlapping creatures and excludes creatures above the volume',()=>{
 const input=fixture()
 input.map.tokens.push({id:'enemy',type:'enemy',label:'Enemy',x:260,y:125,size:1,color:'',emoji:''})
 expect(selectDnd5eControlledWaterTarget(input)?.containsCreatures).toBe(true)
 input.map.tokens[1].elevationFeet=5
 expect(selectDnd5eControlledWaterTarget(input)?.containsCreatures).toBe(false)
 input.map.tokens[1].elevationFeet=0;input.map.tokens[1].type='obstacle'
 expect(selectDnd5eControlledWaterTarget(input)?.containsCreatures).toBe(false)
})
it('rejects mismatched scenes, duplicate targets and oversized authored water selections',()=>{
 const input=fixture()
 expect(selectDnd5eControlledWaterTarget({...input,geometry:{...input.geometry,mapId:'other'}})).toBeUndefined()
 input.geometry.obstacles[0].heightFeet=6
 expect(selectDnd5eControlledWaterTarget(input)).toBeUndefined()
 input.geometry.obstacles[0].heightFeet=5;input.geometry.obstacles.push(structuredClone(input.geometry.obstacles[0]))
 expect(selectDnd5eControlledWaterTarget(input)).toBeUndefined()
})
it('derives actual visibility and range instead of accepting saved water coordinates',()=>{
 const input=fixture();input.geometry.vision.ambientLight='bright'
 const clear=selectDnd5eControlledWaterTarget(input)!
 expect(clear.visible).toBe(true)
 expect(clear.distanceFeet).toBeCloseTo(Math.hypot(12.5,2.5,5))
 input.geometry.walls.push({id:'wall',kind:'wall',label:'Wall',points:[{x:175,y:0},{x:175,y:500}],baseHeightFeet:0,heightFeet:20,
  blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,createdAt:1})
 expect(selectDnd5eControlledWaterTarget(input)?.visible).toBe(false)
 input.map.tokens[0].x=800
 expect(selectDnd5eControlledWaterTarget(input)!.distanceFeet).toBeGreaterThan(30)
})
it('selects only a bounded part of a larger body and checks creatures in that part',()=>{
 const input=fixture(),body=input.geometry.obstacles[0]
 body.points=[{x:200,y:100},{x:500,y:100},{x:500,y:400},{x:200,y:400}];body.heightFeet=20
 const before=structuredClone(input)
 const selection={center:{x:225,y:125},dimensionsFeet:{x:5,y:5,z:5},baseElevationFeet:15}
 const selected=selectDnd5eControlledWaterTarget({...input,selection})!
 expect(selected.water.dimensionsFeet).toEqual({x:5,y:5,z:5})
 expect(selected.water.positionFeet).toEqual({x:22.5,y:12.5,z:15})
 expect(selected.footprint).toHaveLength(4)
 expect(input).toEqual(before)
 input.map.tokens.push({id:'far',type:'enemy',label:'Far',x:450,y:350,size:1,elevationFeet:15,color:'',emoji:''})
 expect(selectDnd5eControlledWaterTarget({...input,selection})?.containsCreatures).toBe(false)
 input.map.tokens[1].x=240;input.map.tokens[1].y=125
 expect(selectDnd5eControlledWaterTarget({...input,selection})?.containsCreatures).toBe(true)
 input.map.tokens[1].elevationFeet=0
 expect(selectDnd5eControlledWaterTarget({...input,selection})?.containsCreatures).toBe(false)
 for(const patch of [{center:{x:900,y:900}},{baseElevationFeet:30},{dimensionsFeet:{x:6,y:1,z:1}},{dimensionsFeet:{x:1,y:1,z:NaN}}]){
   expect(selectDnd5eControlledWaterTarget({...input,selection:{...selection,...patch}})).toBeUndefined()
 }
})
it('clips a shoreline selection to actual water rather than inventing a full cube',()=>{
 const input=fixture()
 const selected=selectDnd5eControlledWaterTarget({...input,selection:{center:{x:250,y:125},dimensionsFeet:{x:5,y:5,z:5},baseElevationFeet:3}})!
 expect(selected.water.dimensionsFeet).toEqual({x:2.5,y:5,z:2})
 expect(selected.water.positionFeet).toEqual({x:23.75,y:12.5,z:3})
})
