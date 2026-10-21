import { normalizeCharacter } from '../../store/characters'
import { createDnd5eMapCombatSnapshot, refreshDnd5eMapSpatialRelations } from './mapBridge'
import { describe, expect, it } from 'vitest'
import type { BattleMap, Dnd5ePluginArea } from '../../store/maps'
import { createEmptyMapGeometry, mapGeometryIlluminationAtPoint, mapGeometrySunlightAtPoint } from '../../lib/mapGeometry'
import { normalizeDnd5ePersistentAreaLighting } from './persistentAreaTypes'
const map: BattleMap = { id:'sunlight',name:'Test',width:2000,height:2000,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[] }
const beam: Dnd5ePluginArea = { id:'beam',pluginId:'test',featureId:'beam',sourceCharacterId:'caster',sourceTokenId:'caster',label:'Beam',color:'#ffffff',cells:[{col:12,row:12},{col:13,row:12}],anchorCell:{col:12,row:12},anchorMode:'fixed',createdRound:1,expiresAfterRound:10,vertical:{mode:'volume',baseElevationFeet:10,heightFeet:40},lighting:{kind:'light',brightRadiusFeet:30,dimRadiusFeet:0,color:'#ffffff',spellLevel:5,sunlight:true,areaOnly:true} }
const geometry=createEmptyMapGeometry(map.id,1)
geometry.vision.ambientLight='darkness'
const query=(areas:Dnd5ePluginArea[],x=625,z=10)=>({map:{...map,dnd5ePluginAreas:areas},geometry,point:{x,y:625},elevationFeet:z})
describe('persistent sunlight volumes',()=>{
 it('preserves explicit sunlight and volume bounds through JSON normalization',()=>{
  expect(normalizeDnd5ePersistentAreaLighting(JSON.parse(JSON.stringify(beam.lighting)))).toEqual(beam.lighting)
  expect(normalizeDnd5ePersistentAreaLighting({...beam.lighting,sunlight:'true'})).toBeUndefined()
  expect(normalizeDnd5ePersistentAreaLighting({...beam.lighting,areaOnly:1})).toBeUndefined()
 })
 it.each([[625,10,true],[675,49,true],[625,9,false],[625,50,false],[725,10,false]])('uses occupied volume at x=%s z=%s',(x,z,inside)=>{
  expect(mapGeometrySunlightAtPoint(query([beam],x,z))).toBe(inside)
  expect(mapGeometryIlluminationAtPoint(query([beam],x,z))).toBe(inside?'bright':'darkness')
 })
 it('does not mistake ambient or ordinary magical bright light for sunlight',()=>{
  expect(mapGeometrySunlightAtPoint({...query([]),geometry:undefined})).toBe(false)
  const ordinary={...beam,lighting:{...beam.lighting!,sunlight:undefined}} as Dnd5ePluginArea
  expect(mapGeometryIlluminationAtPoint(query([ordinary]))).toBe('bright')
  expect(mapGeometrySunlightAtPoint(query([ordinary]))).toBe(false)
 })
 it('does not restore suppressed sunlight merely because a higher spell brightens darkness',()=>{
  const dark:Dnd5ePluginArea={...beam,id:'dark',lighting:{kind:'magical-darkness',radiusFeet:60,spellLevel:8,suppressesMagicalLightThroughLevel:8,lightSuppressionScope:'within-area'}}
  const high:Dnd5ePluginArea={...beam,id:'high',lighting:{kind:'light',brightRadiusFeet:60,dimRadiusFeet:0,color:'#ffffff',spellLevel:9}}
  expect(mapGeometryIlluminationAtPoint(query([beam,dark,high]))).toBe('bright')
  expect(mapGeometrySunlightAtPoint(query([beam,dark,high]))).toBe(false)
  expect(mapGeometrySunlightAtPoint(query([beam,dark]))).toBe(false)
 })
 it('removes sunlight when the persistent area expires or is removed',()=>{
  expect(mapGeometrySunlightAtPoint(query([beam]))).toBe(true)
  expect(mapGeometrySunlightAtPoint(query([]))).toBe(false)
 })
})


it('rebuilds player and monster sunlight after movement and persisted area removal', async()=>{
 const character=normalizeCharacter({id:'sheet',name:'Caster',charClass:'法师',level:9,maxHp:50,currentHp:50})
 const tokens:BattleMap['tokens']=[
  {id:'player',characterId:character.id,label:'Player',type:'player',size:1,x:625,y:625,elevationFeet:10,color:'',emoji:''},
  {id:'monster',label:'Monster',type:'enemy',size:1,x:675,y:625,elevationFeet:10,color:'',emoji:'',hp:30,maxHp:30},
 ]
 const scene:BattleMap={...map,tokens,dnd5ePluginAreas:[beam]}
 const snapshot=createDnd5eMapCombatSnapshot({map:scene,characters:[character],combatId:'sunlight',round:1,initiativeOrder:tokens.map(token=>({tokenId:token.id,roll:10,label:token.label,emoji:'',color:''}))})
 expect(snapshot.state.combatants.player.inSunlight).toBe(true)
 expect(snapshot.state.combatants.monster.inSunlight).toBe(true)
 snapshot.state.combatants.player.position={x:725,y:625}
 snapshot.state.combatants.monster.elevationFeet=50
 refreshDnd5eMapSpatialRelations(snapshot.state,scene,[],{geometry})
 expect(snapshot.state.combatants.player.inSunlight).toBe(false)
 expect(snapshot.state.combatants.monster.inSunlight).toBe(false)
 snapshot.state.combatants.player.position={x:625,y:625}
 refreshDnd5eMapSpatialRelations(snapshot.state,scene,[],{geometry})
 expect(snapshot.state.combatants.player.inSunlight).toBe(true)
 refreshDnd5eMapSpatialRelations(snapshot.state,JSON.parse(JSON.stringify({...scene,dnd5ePluginAreas:[]})),[],{geometry})
 expect(snapshot.state.combatants.player.inSunlight).toBe(false)
})
