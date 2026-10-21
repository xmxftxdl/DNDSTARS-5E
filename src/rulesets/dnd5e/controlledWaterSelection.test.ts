import {expect,it} from 'vitest'
import {createEmptyMapGeometry} from '../../lib/mapGeometry'
import type {BattleMap} from '../../store/maps'
import {controlledWaterSelectionOptions,requestControlledWaterSelection} from './controlledWaterSelection'
import {prepareDnd5eWaterAppearanceMapChange} from './controlledWaterMap'
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

it('uses the selected map volume and rejects forged or stale choices',async()=>{
 const scene=fixture(),intent=scene.selection.change,region=scene.selection.region
 expect(controlledWaterSelectionOptions(scene,intent)).toEqual([])
 expect(controlledWaterSelectionOptions(scene,intent,region)).toHaveLength(1)
 expect(await requestControlledWaterSelection({readScene:()=>scene,intent,region,choose:async()=>{throw Error('unnecessary picker')}})).toEqual({waterId:'water',region})
 const other=structuredClone(scene.geometries[0].obstacles[0]);other.id='other';other.controlledWater!.id='other'
 scene.geometries[0].obstacles.push(other)
 expect(await requestControlledWaterSelection({readScene:()=>scene,intent,region,choose:async()=> 'forged'})).toBeUndefined()
 expect(await requestControlledWaterSelection({readScene:()=>scene,intent,region,choose:async options=>{
  const id=options[0].id;scene.geometries[0].obstacles=[];return id
 }})).toBeUndefined()
})
it('deduplicates fragments and lists only live effects belonging to this caster',async()=>{
 const scene=fixture(),changed=prepareDnd5eWaterAppearanceMapChange(scene)
 if(!changed.ok)throw Error(changed.reason)
 scene.geometries=changed.geometries
 const intent={kind:'dismiss' as const}
 const options=controlledWaterSelectionOptions(scene,intent)
 expect(options).toHaveLength(1)
 expect(options[0].selection).toEqual({dismissEffectId:'first'})
 expect(controlledWaterSelectionOptions({...scene,casterId:'other'},intent)).toEqual([])
 expect(controlledWaterSelectionOptions({...scene,worldMinute:70},intent)).toEqual([])
 expect(await requestControlledWaterSelection({readScene:()=>scene,intent,choose:async()=> 'cancel'})).toBeUndefined()
 expect(await requestControlledWaterSelection({readScene:()=>scene,intent,choose:async choices=>choices[0].id})).toEqual({dismissEffectId:'first'})
 expect(await requestControlledWaterSelection({readScene:()=>scene,intent,choose:async choices=>{scene.worldMinute=70;return choices[0].id}})).toBeUndefined()
})
it('uses the imported touch-freeze policy during selection and rechecks movement before accepting',async()=>{
 const scene={...fixture(),rules:{rangeFeet:5,rangeFromBody:true as const,durationMinutes:1,maximumActiveEffects:null,limitGroup:'test:touch-freeze'}}
 scene.map.tokens[0].x=150;scene.map.tokens[0].y=125
 const region=scene.selection.region,intent={kind:'freeze' as const}
 expect(controlledWaterSelectionOptions(scene,intent,region)).toHaveLength(1)
 scene.map.tokens[0].x=50
 expect(controlledWaterSelectionOptions(scene,intent,region)).toHaveLength(0)
 scene.map.tokens[0].x=150
 const other=structuredClone(scene.geometries[0].obstacles[0]);other.id='other';other.controlledWater!.id='other';scene.geometries[0].obstacles.push(other)
 expect(await requestControlledWaterSelection({readScene:()=>scene,intent,region,choose:async options=>{scene.map.tokens[0].x=50;return options[0].id}})).toBeUndefined()
})
