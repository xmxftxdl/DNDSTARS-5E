import {expect,it} from 'vitest'
import {createEmptyMapGeometry} from '../../lib/mapGeometry'
import {migrateMapsState,type BattleMap,type Dnd5ePluginArea} from '../../store/maps'
import {moveDnd5eCoreSpellArea} from './coreSpellAreas'
import {advanceDnd5ePluginAreasAtTurnBoundary,reconcileDnd5ePluginAreas} from './pluginAreas'
import {validDnd5ePersistentAreaSurfaceCloud,normalizeDnd5ePersistentAreaTurnLifecycle} from './persistentAreaTypes'
function fixture(){
 const area:Dnd5ePluginArea={id:'wind',pluginId:'test',featureId:'wind',label:'Wind',color:'',sourceTokenId:'caster',sourceCharacterId:'owner',
 cells:[{col:2,row:2}],anchorCell:{col:2,row:2},anchorMode:'fixed',createdRound:1,expiresAfterRound:10,
 vertical:{mode:'volume',baseElevationFeet:0,heightFeet:5},movement:{economy:'bonus-action',maximumFeet:30,allowVertical:true,surfaceCloud:{materials:['dust'],radiusFeet:10}}}
 const map:BattleMap={id:'map',name:'Map',width:1000,height:1000,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[{id:'caster',label:'Caster',type:'player',characterId:'owner',color:'',emoji:'',size:1,x:25,y:25}],dnd5ePluginAreas:[area]}
 const geometry=createEmptyMapGeometry('map',1)
 geometry.obstacles=[{id:'dust',kind:'obstacle',label:'Dust',points:[{x:149,y:0},{x:151,y:0},{x:151,y:500},{x:149,y:500}],surfaceMaterial:'dust',cover:'none',baseHeightFeet:0,heightFeet:0,blocksVision:false,blocksMovement:false,blocksLineOfEffect:false,createdAt:1}]
 return {map,area,geometry,move:(current=map)=>moveDnd5eCoreSpellArea({map:current,geometry,round:2,areaId:'wind',sourceTokenId:'caster',targetCell:{col:4,row:2}})}
}
it('raises a separate following cloud across thin dust, persists it, and expires it on next source start',()=>{
 const {move,geometry}=fixture();const result=move();expect(result.ok).toBe(true);if(!result.ok)throw Error(result.reason)
 expect(result.map.dnd5ePluginAreas,JSON.stringify(result.map.dnd5ePluginAreas)).toHaveLength(2)
 const saved=migrateMapsState(JSON.parse(JSON.stringify({maps:[result.map]}))).maps[0]
 expect(saved.dnd5ePluginAreas).toHaveLength(2)
 const cloud=saved.dnd5ePluginAreas!.find(a=>a.linkedParentAreaId==='wind')!
 expect(cloud.vertical).toMatchObject({baseElevationFeet:-7.5,heightFeet:20,shape:'sphere'})
 expect(cloud.obscuration).toEqual({kind:'heavy',sourceCanSeeThrough:false})
 expect(cloud.cells).toHaveLength(13)
 expect(cloud.remainingExplorationSeconds).toBe(6)
 expect(cloud.triggers??[]).toHaveLength(0)
 expect(saved.dnd5ePluginAreas![0].cells).toHaveLength(1)
 geometry.obstacles=[]
 const follow=moveDnd5eCoreSpellArea({map:saved,geometry,round:2,areaId:'wind',sourceTokenId:'caster',targetCell:{col:6,row:2}})
 expect(follow.ok).toBe(true);if(!follow.ok)throw Error(follow.reason)
 expect(follow.map.dnd5ePluginAreas!.find(a=>a.linkedParentAreaId==='wind')!.anchorCell).toEqual({col:6,row:2})
 const advance=(tokenId:string,round:number)=>advanceDnd5ePluginAreasAtTurnBoundary({map:follow.map,timing:'turn-start',tokenId,round,turnKey:`${round}:${tokenId}`}).map
 expect(advance('other',3).dnd5ePluginAreas).toHaveLength(2)
 expect(advance('caster',2).dnd5ePluginAreas).toHaveLength(2)
 expect(advance('caster',3).dnd5ePluginAreas).toHaveLength(1)
 expect(reconcileDnd5ePluginAreas([cloud],[],2,follow.map.tokens)).toEqual([])
})
it('does not raise dust on unmarked ground or airborne travel',()=>{
 const {area,geometry,move}=fixture();area.vertical={mode:'volume',baseElevationFeet:10,heightFeet:5}
 const airborne=move();expect(airborne.ok && airborne.map.dnd5ePluginAreas).toHaveLength(1)
 area.vertical.baseElevationFeet=0;geometry.obstacles=[]
 const clear=move();expect(clear.ok && clear.map.dnd5ePluginAreas).toHaveLength(1)
})
it('validates imported surface cloud and expiry declarations',()=>{
 expect(validDnd5ePersistentAreaSurfaceCloud({materials:['sand','gravel'],radiusFeet:10})).toBe(true)
 for(const value of [{materials:['solid'],radiusFeet:10},{materials:['dust','dust'],radiusFeet:10},{materials:['dust'],radiusFeet:0}])expect(validDnd5ePersistentAreaSurfaceCloud(value)).toBe(false)
 expect(normalizeDnd5ePersistentAreaTurnLifecycle({timing:'source-turn-start',expireAfterAdvances:1})).toMatchObject({expireAfterAdvances:1})
 expect(normalizeDnd5ePersistentAreaTurnLifecycle({timing:'source-turn-start',expireAfterAdvances:0})).toBeUndefined()
})

it('raises a saved cloud when only the edge of the five-foot cube crosses debris',()=>{
 const {geometry,move}=fixture()
 geometry.obstacles[0].points=[{x:174,y:145},{x:175,y:145},{x:175,y:149},{x:174,y:149}]
 const result=move()
 expect(result.ok).toBe(true);if(!result.ok)throw Error(result.reason)
 expect(migrateMapsState(JSON.parse(JSON.stringify({maps:[result.map]}))).maps[0].dnd5ePluginAreas).toHaveLength(2)
 geometry.obstacles.push({...geometry.obstacles[0],id:'paved',surfaceMaterial:'solid'})
 const paved=move()
 expect(paved.ok && paved.map.dnd5ePluginAreas).toHaveLength(1)
})
