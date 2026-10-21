import {expect,it} from 'vitest'
import {normalizeControlledWaterState} from '../../../shared/controlled-water-state.mjs'
import {validateSharedStateShape,projectMapGeometryForPlayer} from '../../../scripts/shared-server-core.mjs'
import {createEmptyMapGeometry,normalizeMapGeometryEntity} from '../../lib/mapGeometry'
import {changeDnd5eControlledWater,projectDnd5eControlledWater,type Dnd5eControlledWater} from './controlledWater'
function fixture(){
  const water:Dnd5eControlledWater={id:'water',positionFeet:{x:0,y:0,z:0},dimensionsFeet:{x:5,y:5,z:5},color:'#0088ff',opacity:0.5,alterations:[],appliedActionIds:[]}
  const changed=changeDnd5eControlledWater({waters:[water],waterId:'water',casterId:'caster',actionId:'cast',worldMinute:10,distanceFeet:5,visible:true,
    change:{kind:'appearance',color:'#ff0000',opacity:1}})
  if(!changed.ok)throw Error(changed.reason)
  return {id:'water',kind:'obstacle' as const,label:'Water',points:[{x:0,y:0},{x:50,y:0},{x:50,y:50},{x:0,y:50}],
    baseHeightFeet:0,heightFeet:5,cover:'none' as const,blocksMovement:false,blocksVision:false,blocksLineOfEffect:false,createdAt:1,controlledWater:changed.waters[0]}
}
const payload=(obstacle:unknown)=>({schemaVersion:3,maps:[{...createEmptyMapGeometry('map',1),obstacles:[obstacle]}],updatedAt:1})
it('retains water and effect ownership through server validation, player projection and browser reload',()=>{
  const source=fixture(),state=payload(source)
  expect(validateSharedStateShape('map-geometry',state)).toEqual({ok:true})
  const shared=projectMapGeometryForPlayer(state,null,20)
  const restored=normalizeMapGeometryEntity(JSON.parse(JSON.stringify(shared.maps[0].obstacles[0])))
  expect(restored?.kind).toBe('obstacle');if(restored?.kind!=='obstacle')throw Error('missing water')
  expect(restored.controlledWater).toEqual(source.controlledWater)
  expect(projectDnd5eControlledWater(restored.controlledWater!,69)).toMatchObject({color:'#ff0000',opacity:1})
  expect(projectDnd5eControlledWater(restored.controlledWater!,70)).toMatchObject({color:'#0088ff',opacity:0.5})
})
it('rejects corrupted ownership, duration, dimensions and duplicate receipts on both persistence boundaries',()=>{
  const source=fixture()
  for(const mutate of [
    (w:Dnd5eControlledWater)=>{w.id='other'},
    (w:Dnd5eControlledWater)=>{w.dimensionsFeet.z=NaN},
    (w:Dnd5eControlledWater)=>{w.alterations[0].expiresAtWorldMinute=80},
    (w:Dnd5eControlledWater)=>{w.alterations[0].casterId=''},
    (w:Dnd5eControlledWater)=>{w.appliedActionIds=[]},
    (w:Dnd5eControlledWater)=>{w.appliedActionIds.push('cast')},
  ]){
    const changed=structuredClone(source);mutate(changed.controlledWater)
    expect(normalizeMapGeometryEntity(changed)).toBeUndefined()
    expect(validateSharedStateShape('map-geometry',payload(changed))).toMatchObject({ok:false})
  }
  const copy=normalizeControlledWaterState(source.controlledWater)!
  copy.appliedActionIds.push('different')
  expect(source.controlledWater.appliedActionIds).toEqual(['cast'])
})
