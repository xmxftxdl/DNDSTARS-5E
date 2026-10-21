import {expect,it} from 'vitest'
import {createEmptyMapGeometry,normalizeMapGeometry} from '../../lib/mapGeometry'
import {migrateMapsState,type BattleMap,type Dnd5ePluginArea} from '../../store/maps'
import {prepareMaterialVolumeTransformation,normalizeMaterialVolumeTransformationReceipt as normalize} from './materialVolumeTransformation'
import {removePersistentAreaByDm} from './persistentAreaRemoval'
import {projectMapsForPlayer} from '../../../scripts/shared-server-core.mjs'

function fixture(){
 const initial=createEmptyMapGeometry('map',1)
 initial.obstacles=[{id:'stone',kind:'obstacle',label:'Stone',points:[{x:0,y:0},{x:50,y:0},{x:50,y:50},{x:0,y:50}],baseHeightFeet:0,heightFeet:10,surfaceMaterial:'stone',materialMagic:'nonmagical',cover:'total',blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,createdAt:1}]
 const geometry=normalizeMapGeometry(initial)!
 const converted=prepareMaterialVolumeTransformation({geometry,executionId:'cast',entityIds:['stone'],center:{x:25,y:25},angleDegrees:0,widthFeet:5,lengthFeet:5,heightFeet:10,bottomFeet:0,pixelsPerFoot:10,mode:'rock-to-mud'})!
 const area:Dnd5ePluginArea={id:'mud',pluginId:'local',featureId:'rock',label:'Mud',color:'#888888',sourceCharacterId:'owner',sourceTokenId:'caster',cells:[{col:0,row:0}],createdRound:1,expiresAfterRound:1,permanent:true,materialTransformation:converted.receipt}
 const map:BattleMap={id:'map',name:'Map',width:1000,height:1000,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[],dnd5ePluginAreas:[area]}
 return {geometry,converted,map}
}
it('persists the area-owned receipt and restores original geometry through real DM area removal',()=>{
 const {geometry,converted,map}=fixture()
 const loaded=migrateMapsState(JSON.parse(JSON.stringify({maps:[map]}))).maps[0]
 expect(loaded.dnd5ePluginAreas?.[0].materialTransformation).toEqual(converted.receipt)
 const ended=removePersistentAreaByDm({map:loaded,characters:[],areaId:'mud',geometry:normalizeMapGeometry(JSON.parse(JSON.stringify(converted.geometry)))!})!
 expect(ended).toBeDefined();expect(ended.map.dnd5ePluginAreas).toEqual([])
 expect(ended.geometry).toEqual(geometry)
 expect(loaded.dnd5ePluginAreas).toHaveLength(1)
 expect(converted.geometry.obstacles.every(b=>b.surfaceMaterial==='mud')).toBe(true)
})
it('cannot remove a material area without geometry or with stale fragments',()=>{
 const {converted,map}=fixture(),before=structuredClone(map)
 expect(removePersistentAreaByDm({map,characters:[],areaId:'mud'})).toBeUndefined()
 converted.geometry.obstacles[0].label='changed'
 expect(removePersistentAreaByDm({map,characters:[],areaId:'mud',geometry:converted.geometry})).toBeUndefined()
 expect(map).toEqual(before)
})
it('shares the active area without exposing Host restoration snapshots to players',()=>{
 const {converted,map}=fixture()
 map.tokens.push({id:'caster',characterId:'owner',type:'player',label:'Caster',x:25,y:25,size:1,color:'',emoji:''})
 const projected=projectMapsForPlayer({maps:[map]},{maps:[converted.geometry]},'owner').maps[0]
 expect(projected.dnd5ePluginAreas).toHaveLength(1)
 expect(projected.dnd5ePluginAreas?.[0]?.id).toBe('mud')
 expect(projected.dnd5ePluginAreas?.[0]?.materialTransformation).toBeUndefined()
 expect(projected.dnd5ePluginAreas?.[0]?.materialTransformationAvailable).toBe(true)
 expect(map.dnd5ePluginAreas![0].materialTransformation).toEqual(converted.receipt)
 expect(migrateMapsState(JSON.parse(JSON.stringify({maps:[projected]}))).maps[0].dnd5ePluginAreas?.[0]?.materialTransformationAvailable).toBe(true)
})
it('rejects corrupted, duplicate or foreign receipt identities on reload',()=>{
 const {converted,map}=fixture()
 for(const alter of [
  (r:any)=>{r.schemaVersion=2},(r:any)=>{r.replacements[0].fragments.push(r.replacements[0].fragments[0])},
  (r:any)=>{r.replacements[0].original.materialMagic='magical'},(r:any)=>{r.replacements[0].fragments[0].id='foreign'},
  (r:any)=>{r.replacements=[]},
 ]){const copy=structuredClone(converted.receipt);alter(copy);expect(normalize(copy)).toBeUndefined()}
 map.dnd5ePluginAreas![0].materialTransformation!.mapId='other'
 expect(migrateMapsState(JSON.parse(JSON.stringify({maps:[map]}))).maps[0].dnd5ePluginAreas).toEqual([])
})
it('restores a linked group atomically, preserving both areas if any owned fragment was edited',()=>{
 const {converted,map}=fixture()
 // Two receipts may never claim the same fragments: the second restoration fails.
 map.dnd5ePluginAreas!.push({...map.dnd5ePluginAreas![0],id:'duplicate-owner',linkedParentAreaId:'mud'})
 const before=JSON.stringify({map,geometry:converted.geometry})
 expect(removePersistentAreaByDm({map,characters:[],areaId:'mud',geometry:converted.geometry})).toBeUndefined()
 expect(JSON.stringify({map,geometry:converted.geometry})).toBe(before)
})
