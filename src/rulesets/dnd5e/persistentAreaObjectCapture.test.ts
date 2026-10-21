import {it,expect} from 'vitest'
import {captureDnd5eAreaObjects,dnd5eAreaMayCaptureObject,releaseDnd5eEndedAreaObjects} from './persistentAreaObjectCapture'
import {migrateMapsState,type BattleMap,type Token,type Dnd5ePluginArea} from '../../store/maps'
import {reconcileDnd5eAreaCaptivesAcrossMaps} from './persistentAreaEnd'
import {createEmptyMapGeometry} from '../../lib/mapGeometry'
const object:Token={id:'box',type:'obstacle',label:'Box',x:525,y:525,size:1,color:'',emoji:'',dnd5eObjectState:{schemaVersion:1,attached:false,wornOrCarried:false,magical:true,animateObjects:{size:'medium',mobility:'walk',damageType:'bludgeoning'}}}
const area:Dnd5ePluginArea={id:'wind',pluginId:'test',featureId:'wind',label:'Wind',sourceTokenId:'caster',sourceCharacterId:'caster',color:'',anchorMode:'fixed',anchorCell:{col:10,row:10},cells:[{col:10,row:10}],vertical:{mode:'volume',baseElevationFeet:0,heightFeet:30},circularGeometry:{radiusFeet:10},createdRound:1,expiresAfterRound:11,movement:{economy:'action',maximumFeet:30,carryRestrainedTargets:true,collectObjectsMaximumSizeRank:2}}
const map:BattleMap={id:'objects',name:'Objects',width:2000,height:2000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[object],dnd5ePluginAreas:[area]}
it('lands released objects on physical support without dropping held, secured, transferred or still-bound objects',()=>{
 const captured=captureDnd5eAreaObjects(map,area)!
 const elevated={...captured,tokens:[{...captured.tokens[0],elevationFeet:25}],dnd5ePluginAreas:[]}
 const geometry=createEmptyMapGeometry(map.id,1)
 expect(releaseDnd5eEndedAreaObjects(elevated,geometry).tokens[0].elevationFeet).toBe(0)
 geometry.obstacles.push({id:'platform',kind:'obstacle',label:'Platform',points:[{x:500,y:500},{x:550,y:500},{x:550,y:550},{x:500,y:550}],baseHeightFeet:10,heightFeet:1,blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,cover:'total',createdAt:1})
 expect(releaseDnd5eEndedAreaObjects(elevated,geometry).tokens[0].elevationFeet).toBeCloseTo(11)
 for(const patch of [{attached:true},{wornOrCarried:true,carrierTokenId:'carrier'}]){
  const held={...elevated,tokens:[{...elevated.tokens[0],dnd5eObjectState:{...elevated.tokens[0].dnd5eObjectState!,...patch}}]}
  expect(releaseDnd5eEndedAreaObjects(held,geometry).tokens[0].elevationFeet).toBe(25)
 }
 expect(releaseDnd5eEndedAreaObjects({...elevated,id:'destination'},geometry).tokens[0].elevationFeet).toBe(25)
 expect(releaseDnd5eEndedAreaObjects({...elevated,dnd5ePluginAreas:[area]},geometry).tokens[0].elevationFeet).toBe(25)
 expect(elevated.tokens[0].elevationFeet).toBe(25)
})
it('settles simultaneously released objects from the bottom up independent of token order',()=>{
 const captured=captureDnd5eAreaObjects(map,area)!.tokens[0]
 const objects=[{...captured,id:'lower',elevationFeet:15},{...captured,id:'upper',elevationFeet:30}]
 for(const tokens of [objects,[...objects].reverse()]){
  const released=releaseDnd5eEndedAreaObjects({...map,tokens,dnd5ePluginAreas:[]})
  expect(released.tokens.find(t=>t.id==='lower')?.elevationFeet).toBe(0)
  expect(released.tokens.find(t=>t.id==='upper')?.elevationFeet).toBe(5)
  expect(releaseDnd5eEndedAreaObjects(released)).toBe(released)
 }
})
it('checks every carried-object path leg against physical barriers at its actual altitude',()=>{
 const captured=captureDnd5eAreaObjects(map,area)!,before=structuredClone(captured)
 const geometry=createEmptyMapGeometry(map.id,1)
 geometry.walls.push({id:'wall',kind:'wall',label:'Wall',points:[{x:650,y:0},{x:650,y:600}],blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,baseHeightFeet:0,heightFeet:10,createdAt:1})
 const straight=[{x:525,y:525,elevationFeet:0},{x:825,y:525,elevationFeet:0}]
 expect(captureDnd5eAreaObjects(captured,area,straight,geometry)).toBeUndefined()
 const elevated={...captured,tokens:[{...captured.tokens[0],elevationFeet:15}]}
 expect(captureDnd5eAreaObjects(elevated,area,straight,geometry)?.tokens[0]).toMatchObject({x:825,elevationFeet:15})
 const detour=[straight[0],{x:525,y:675,elevationFeet:0},{x:825,y:675,elevationFeet:0},straight[1]]
 expect(captureDnd5eAreaObjects(captured,area,detour,geometry)?.tokens[0]).toMatchObject({x:825,y:525})
 expect(captured).toEqual(before)
})
it('does not apply pre-contact path legs to a newly collected object',()=>{
 const geometry=createEmptyMapGeometry(map.id,1)
 geometry.walls.push({id:'behind',kind:'wall',label:'Behind',points:[{x:575,y:0},{x:575,y:1000}],blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,baseHeightFeet:0,heightFeet:10,createdAt:1})
 const passed={...map,tokens:[{...object,x:825}]}
 const path=[{x:525,y:525,elevationFeet:0},{x:625,y:525,elevationFeet:0},{x:825,y:525,elevationFeet:0}]
 expect(captureDnd5eAreaObjects(passed,area,path,geometry)?.tokens[0]).toMatchObject({x:950})
})
it.each([{wornOrCarried:true,carrierTokenId:'carrier'},{attached:true}])('releases newly held or secured objects before carrying them: %j',patch=>{
 const captured=structuredClone(captureDnd5eAreaObjects(map,area)!)
 Object.assign(captured.tokens[0].dnd5eObjectState!,patch)
 const original=structuredClone(captured)
 const moved=captureDnd5eAreaObjects(captured,area,[{x:525,y:525,elevationFeet:0},{x:825,y:525,elevationFeet:0}])!
 expect(moved.tokens[0].x).toBe(525)
 expect(moved.tokens[0].dnd5eObjectState?.areaCapture).toBeUndefined()
 expect(moved.tokens[0].dnd5eObjectState).toMatchObject(patch)
 expect(releaseDnd5eEndedAreaObjects(captured).tokens[0].dnd5eObjectState?.areaCapture).toBeUndefined()
 expect(captured).toEqual(original)
})
it('reconciles ended areas and cross-map transfers without keeping remote object bindings',()=>{
 const captured=captureDnd5eAreaObjects(map,area)!
 const transferred={...captured,id:'destination',dnd5ePluginAreas:[]}
 const ended={...captured,dnd5ePluginAreas:[]}
 const result=reconcileDnd5eAreaCaptivesAcrossMaps({maps:[captured,transferred,ended],characters:[],round:2})
 expect(result.maps[0].tokens[0].dnd5eObjectState?.areaCapture).toBeDefined()
 for(const released of result.maps.slice(1)){
  expect(released.tokens[0].dnd5eObjectState?.areaCapture).toBeUndefined()
  expect(released.tokens[0].x).toBe(525)
 }
 expect(captured.tokens[0].dnd5eObjectState?.areaCapture).toBeDefined()
 expect(reconcileDnd5eAreaCaptivesAcrossMaps({...result,round:2}).maps).toBe(result.maps)
})
it('requires explicit unsecured, unattended and known Medium-or-smaller facts; magic is not excluded',()=>{
 expect(dnd5eAreaMayCaptureObject(object,2)).toBe(true)
 for(const patch of [{attached:true},{attached:undefined},{wornOrCarried:true},{wornOrCarried:undefined},{animateObjects:undefined},{animateObjects:{size:'large',mobility:'walk',damageType:'bludgeoning'}}]){
  expect(dnd5eAreaMayCaptureObject({...object,dnd5eObjectState:{...object.dnd5eObjectState,...patch} as any},2)).toBe(false)
 }
})
it('captures on creation, persists binding and policy, carries existing and newly swept objects without damage',()=>{
 const captured=captureDnd5eAreaObjects(map,area)!
 expect(captured.tokens[0].dnd5eObjectState?.areaCapture).toEqual({mapId:'objects',areaId:'wind',sourceTokenId:'caster'})
 expect(map.tokens[0].dnd5eObjectState?.areaCapture).toBeUndefined()
 const saved=migrateMapsState(JSON.parse(JSON.stringify({maps:[captured]}))).maps[0]
 expect(saved.dnd5ePluginAreas![0].movement?.collectObjectsMaximumSizeRank).toBe(2)
 expect(saved.tokens[0].dnd5eObjectState?.areaCapture?.areaId).toBe('wind')
 const swept=captureDnd5eAreaObjects({...saved,tokens:[...saved.tokens,{...object,id:'passed',x:675},{...object,id:'above',x:675,elevationFeet:40}]},area,
  [{x:525,y:525,elevationFeet:0},{x:825,y:525,elevationFeet:0}])!
 expect(swept.tokens.find(t=>t.id==='box')?.x).toBe(825)
 expect(swept.tokens.find(t=>t.id==='passed')?.x).toBe(950)
 expect(swept.tokens.find(t=>t.id==='above')?.dnd5eObjectState?.areaCapture).toBeUndefined()
 expect(releaseDnd5eEndedAreaObjects({...swept,dnd5ePluginAreas:[]}).tokens.every(t=>!t.dnd5eObjectState?.areaCapture)).toBe(true)
})
it('does not steal a different area binding, and rejects moving a carried object outside the map',()=>{
 const foreign={...object,dnd5eObjectState:{...object.dnd5eObjectState!,areaCapture:{mapId:map.id,areaId:'other',sourceTokenId:'caster'}}}
 expect(captureDnd5eAreaObjects({...map,tokens:[foreign]},area)?.tokens[0]).toEqual(foreign)
 const captured=captureDnd5eAreaObjects(map,area)!
 expect(captureDnd5eAreaObjects(captured,area,[{x:525,y:525,elevationFeet:0},{x:2025,y:525,elevationFeet:0}])).toBeUndefined()
})
