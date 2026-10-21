import { expect, it } from 'vitest'
import { createEmptyMapGeometry, type MapGeometryLight } from '../../lib/mapGeometry'
import type { BattleMap } from '../../store/maps'
import { prepareDnd5eControlledFlameMapChange } from './controlledFlameMap'

function light(id='fire',x=50): MapGeometryLight {
  return { id,kind:'light',label:id,points:[{x,y:50}],enabled:true,brightRadiusFeet:20,dimRadiusFeet:20,
    color:'#ffaa00',elevationFeet:0,createdAt:1,controlledFlame:{id,magical:false,burning:true,extentFeet:5,
      brightRadiusFeet:20,dimRadiusFeet:20,color:'#ffaa00',alterations:[]} }
}
function fixture(){
  const map:BattleMap={id:'map',name:'Map',width:1000,height:1000,gridSize:50,feetPerCell:5,
    gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'caster',label:'Caster',type:'player',x:0,y:50,size:1,color:'#fff',emoji:'C'}]}
  const geometry={...createEmptyMapGeometry('map',1),lights:[light()],
    vision:{enabled:true,ambientLight:'bright' as const,defaultRangeFeet:120,sharePartyVision:true}}
  return {map,geometries:[geometry],actorTokenId:'caster',casterId:'character:caster',actionId:'cast',worldMinute:480,
    selection:{lightId:'fire',change:{kind:'illumination' as const,multiplier:2 as const}}}
}
it('projects live map geometry into the flame rules, preserving base light and input state',()=>{
  const input=fixture(),before=structuredClone(input)
  const result=prepareDnd5eControlledFlameMapChange(input)
  expect(result.ok).toBe(true)
  if(!result.ok)throw Error(result.reason)
  expect(result.geometries[0].lights?.[0].controlledFlame).toMatchObject({id:'fire',positionFeet:{x:5,y:5,z:0},
    alterations:[{id:'cast',casterId:'character:caster',expiresAtWorldMinute:540,multiplier:2}]})
  expect(result.geometries[0].lights?.[0].brightRadiusFeet).toBe(20)
  expect(input).toEqual(before)
})
it('counts all room maps even when their local light IDs are identical, and permits owned dismissal',()=>{
  const input=fixture()
  for(let i=0;i<3;i++){
    const other={...structuredClone(input.geometries[0]),mapId:'other'+i}
    other.lights[0].controlledFlame!.alterations=[{id:'effect'+i,casterId:input.casterId,kind:'shape',shape:'curl',appliedAtWorldMinute:480,expiresAtWorldMinute:540}]
    input.geometries.push(other)
  }
  expect(prepareDnd5eControlledFlameMapChange(input)).toEqual({ok:false,reason:'flame-effect-limit'})
  expect(prepareDnd5eControlledFlameMapChange({...input,casterId:'stranger',selection:{dismissEffectId:'effect0'}})).toEqual({ok:false,reason:'flame-effect-not-owned'})
  const dismissed=prepareDnd5eControlledFlameMapChange({...input,selection:{dismissEffectId:'effect0'}})
  if(!dismissed.ok)throw Error(dismissed.reason)
  expect(dismissed.geometries[1].lights?.[0].controlledFlame!.alterations).toEqual([])
  expect(prepareDnd5eControlledFlameMapChange({...input,geometries:dismissed.geometries}).ok).toBe(true)
})
it('uses live positions for spread and refuses a forged stored destination position',()=>{
  const input=fixture(),fuel=light('fuel',100)
  fuel.controlledFlame={...fuel.controlledFlame!,burning:false,fuelAvailable:true,positionFeet:{x:999,y:999,z:999}}
  input.geometries[0].lights.push(fuel)
  const selection={lightId:'fire',change:{kind:'spread' as const,destinationId:'fuel'}}
  const result=prepareDnd5eControlledFlameMapChange({...input,selection})
  if(!result.ok)throw Error(result.reason)
  expect(result.geometries[0].lights?.[1].controlledFlame!.burning).toBe(true)
  fuel.points[0].x=300;fuel.controlledFlame.positionFeet={x:10,y:5,z:0}
  expect(prepareDnd5eControlledFlameMapChange({...input,selection})).toEqual({ok:false,reason:'invalid-flame-expansion'})
})
it.each(['range','height','wall','magic','missing-facts','duplicate-light'] as const)('rejects invalid Host scene: %s',kind=>{
  const input=fixture(),source=input.geometries[0].lights[0]
  if(kind==='range')source.points[0].x=650
  if(kind==='height')source.elevationFeet=61
  if(kind==='magic')source.controlledFlame!.magical=true
  if(kind==='missing-facts')delete source.controlledFlame
  if(kind==='duplicate-light')input.geometries[0].lights.push(structuredClone(source))
  if(kind==='wall')input.geometries[0].walls.push({id:'wall',kind:'wall',label:'wall',points:[{x:25,y:0},{x:25,y:100}],
    blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,baseHeightFeet:0,heightFeet:20,createdAt:1})
  const before=structuredClone(input)
  expect(prepareDnd5eControlledFlameMapChange(input).ok).toBe(false)
  expect(input).toEqual(before)
})
it('does not expand through a transparent physical barrier',()=>{
  const input=fixture(),fuel=light('fuel',100)
  fuel.controlledFlame={...fuel.controlledFlame!,burning:false,fuelAvailable:true}
  input.geometries[0].lights.push(fuel)
  input.geometries[0].walls.push({id:'glass',kind:'wall',label:'Glass',points:[{x:75,y:0},{x:75,y:100}],
    blocksMovement:true,blocksVision:false,blocksLineOfEffect:true,baseHeightFeet:0,heightFeet:20,createdAt:1})
  expect(prepareDnd5eControlledFlameMapChange({...input,selection:{lightId:'fire',change:{kind:'spread',destinationId:'fuel'}}}))
    .toEqual({ok:false,reason:'invalid-flame-expansion'})
})

it.each(['valid','carried','worn','missing-custody','missing-fuel','range','height','wall','duplicate'] as const)('checks single-object touch ignition: %s',mode=>{
  const input=fixture()
  const fuel=input.geometries[0].lights[0]
  Object.assign(fuel.controlledFlame!,{burning:false,fuelAvailable:true,custody:'unattended'})
  // Same-cell objects must not be ignited together.
  const other=structuredClone(fuel);other.id='other';other.controlledFlame!.id='other'
  input.geometries[0].lights.push(other)
  if(mode==='carried'||mode==='worn')fuel.controlledFlame!.custody=mode
  if(mode==='missing-custody')delete fuel.controlledFlame!.custody
  if(mode==='missing-fuel')delete fuel.controlledFlame!.fuelAvailable
  if(mode==='range')fuel.points[0].x=76
  if(mode==='height')fuel.elevationFeet=11
  if(mode==='duplicate')input.geometries[0].lights.push(structuredClone(fuel))
  if(mode==='wall')input.geometries[0].walls.push({id:'wall',kind:'wall',points:[{x:35,y:0},{x:35,y:100}],baseHeightFeet:0,heightFeet:20,blocksMovement:true,blocksVision:false,blocksLineOfEffect:true,createdAt:1} as any)
  const before=structuredClone(input)
  const result=prepareDnd5eControlledFlameMapChange({...input,selection:{lightId:'fire',change:{kind:'ignite-touch'}}})
  expect(input).toEqual(before)
  expect(result.ok).toBe(mode==='valid')
  if(result.ok){
    expect(result.geometries[0].lights?.[0].controlledFlame).toMatchObject({burning:true,alterations:[]})
    expect(result.geometries[0].lights?.[1].controlledFlame?.burning).toBe(false)
    expect(prepareDnd5eControlledFlameMapChange({...input,geometries:result.geometries,selection:{lightId:'fire',change:{kind:'ignite-touch'}}}).ok).toBe(false)
  }
})
