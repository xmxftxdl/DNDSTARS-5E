import {expect,it} from 'vitest'
import {createEmptyMapGeometry,mapGeometryMovementBlocked,mapGeometryPlacementBlocked,mapGeometryVolumeMovementBlocked,setMapGeometryWorldMinuteReader} from '../../lib/mapGeometry'
import type {BattleMap} from '../../store/maps'
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

it('blocks frozen water at its actual height and restores movement on expiry or dismissal',()=>{
 const scene=fixture(),geometry=scene.geometries[0],token=scene.map.tokens[0]
 geometry.obstacles[0].controlledWater!.alterations=[{id:'ice',casterId:'owner',kind:'freeze',appliedAtWorldMinute:10,expiresAtWorldMinute:70}]
 const before=structuredClone(geometry)
 const movement={geometry,map:scene.map,token,to:{x:450,y:100},worldMinute:69}
 expect(mapGeometryMovementBlocked(movement).blocked).toBe(true)
 expect(mapGeometryMovementBlocked({...movement,fromElevationFeet:5,toElevationFeet:5}).blocked).toBe(false)
 expect(mapGeometryMovementBlocked({...movement,worldMinute:70}).blocked).toBe(false)
 const placement={geometry,map:scene.map,token,at:{x:250,y:150},worldMinute:69}
 expect(mapGeometryPlacementBlocked(placement).blocked).toBe(true)
 expect(mapGeometryPlacementBlocked({...placement,elevationFeet:5}).blocked).toBe(false)
 expect(mapGeometryPlacementBlocked({...placement,worldMinute:70}).blocked).toBe(false)
 const volume={geometry,map:scene.map,from:{x:100,y:150},to:{x:450,y:150},fromElevationFeet:0,toElevationFeet:0,halfSizePixels:10,heightFeet:2,worldMinute:69}
 expect(mapGeometryVolumeMovementBlocked(volume).blocked).toBe(true)
 expect(mapGeometryVolumeMovementBlocked({...volume,worldMinute:70}).blocked).toBe(false)
 expect(geometry).toEqual(before)
 geometry.obstacles[0].controlledWater!.alterations=[]
 expect(mapGeometryMovementBlocked(movement).blocked).toBe(false)
})
it('uses the live clock when callers omit it and keeps unknown-time ice conservative',()=>{
 const scene=fixture(),geometry=scene.geometries[0],token=scene.map.tokens[0]
 geometry.obstacles[0].controlledWater!.alterations=[{id:'ice',casterId:'owner',kind:'freeze',appliedAtWorldMinute:10,expiresAtWorldMinute:70}]
 let minute:number|undefined=69
 setMapGeometryWorldMinuteReader(()=>minute)
 try{
 const input={geometry,map:scene.map,token,at:{x:250,y:150}}
 expect(mapGeometryPlacementBlocked(input).blocked).toBe(true)
 minute=70;expect(mapGeometryPlacementBlocked(input).blocked).toBe(false)
 minute=undefined;expect(mapGeometryPlacementBlocked(input).blocked).toBe(true)
 }finally{setMapGeometryWorldMinuteReader(()=>undefined)}
})
it('sweeps a narrow water footprint through a corridor without using its larger square bounds',()=>{
 const scene=fixture(),geometry=scene.geometries[0]
 geometry.obstacles=[]
 geometry.walls=[180,220].map((x,i)=>({id:'wall'+i,kind:'wall' as const,label:'Wall',points:[{x,y:0},{x,y:500}],baseHeightFeet:0,heightFeet:20,blocksVision:false,blocksLineOfEffect:false,blocksMovement:true,createdAt:1}))
 const input={geometry,map:scene.map,from:{x:200,y:125},to:{x:200,y:175},fromElevationFeet:0,toElevationFeet:0,halfSizePixels:25,heightFeet:5,worldMinute:10}
 expect(mapGeometryVolumeMovementBlocked(input).blocked).toBe(true)
 const footprint=[{x:195,y:100},{x:205,y:100},{x:205,y:150},{x:195,y:150}]
 expect(mapGeometryVolumeMovementBlocked({...input,footprint}).blocked).toBe(false)
 expect(mapGeometryVolumeMovementBlocked({...input,footprint,to:{x:250,y:175}}).blocked).toBe(true)
})
it('does not collide with empty corners of a triangular water fragment',()=>{
 const scene=fixture(),geometry=scene.geometries[0];geometry.obstacles=[]
 geometry.walls=[{id:'corner',kind:'wall',label:'Corner',points:[{x:240,y:140},{x:260,y:140}],baseHeightFeet:0,heightFeet:20,blocksVision:false,blocksLineOfEffect:false,blocksMovement:true,createdAt:1}]
 const input={geometry,map:scene.map,from:{x:225,y:125},to:{x:215,y:125},fromElevationFeet:0,toElevationFeet:0,halfSizePixels:25,heightFeet:5,worldMinute:10}
 expect(mapGeometryVolumeMovementBlocked(input).blocked).toBe(true)
 const footprint=[{x:200,y:100},{x:250,y:100},{x:200,y:150}]
 expect(mapGeometryVolumeMovementBlocked({...input,footprint}).blocked).toBe(false)
 expect(mapGeometryVolumeMovementBlocked({...input,footprint,to:{x:275,y:125}}).blocked).toBe(true)
})
