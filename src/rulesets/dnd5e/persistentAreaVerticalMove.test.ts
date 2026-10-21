import {expect,it} from 'vitest'
import {moveDnd5eCoreSpellArea} from './coreSpellAreas'
import {migrateMapsState,type BattleMap,type Dnd5ePluginArea} from '../../store/maps'
import {createEmptyMapGeometry} from '../../lib/mapGeometry'
import {stoneWallPanels,stoneWallCells} from './stoneWall'
function fixture(){
 const area:Dnd5ePluginArea={id:'wind',pluginId:'test',featureId:'wind',label:'Wind',color:'',sourceTokenId:'caster',sourceCharacterId:'owner',
 cells:[{col:2,row:2}],anchorCell:{col:2,row:2},anchorMode:'fixed',createdRound:1,expiresAfterRound:10,
 vertical:{mode:'volume',baseElevationFeet:20,heightFeet:5},movement:{economy:'bonus-action',maximumFeet:30,allowVertical:true}}
 const map:BattleMap={id:'map',name:'Map',width:1000,height:1000,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[],dnd5ePluginAreas:[area]}
 return {map,area,move:(extra:Record<string,unknown>={})=>moveDnd5eCoreSpellArea({map,areaId:area.id,sourceTokenId:'caster',targetCell:{col:3,row:2},...extra})}
}
it('keeps airborne altitude on horizontal movement and persists the opt-in',()=>{
 const {move}=fixture();const result=move();expect(result.ok).toBe(true);if(!result.ok)throw Error(result.reason)
 expect(result.area.vertical).toMatchObject({baseElevationFeet:20,heightFeet:5})
 const saved=migrateMapsState(JSON.parse(JSON.stringify({maps:[result.map]}))).maps[0]
 expect(saved.dnd5ePluginAreas![0].movement?.allowVertical).toBe(true)
 expect(saved.dnd5ePluginAreas![0].vertical).toMatchObject({baseElevationFeet:20})
})
it('accounts for vertical travel and rejects invalid or undeclared height changes',()=>{
 const {area,move}=fixture()
 expect(move({targetElevationFeet:50})).toMatchObject({ok:true,distanceFeet:30})
 expect(move({targetElevationFeet:51})).toMatchObject({ok:false,reason:'target-out-of-range'})
 for(const height of [NaN,Infinity,-1001,10001,'30'])expect(move({targetElevationFeet:height}).ok).toBe(false)
 area.movement!.allowVertical=undefined
 expect(move({targetElevationFeet:30}).ok).toBe(false)
 const legacy=move();expect(legacy.ok && legacy.area.vertical).toMatchObject({baseElevationFeet:0})
})
it('allows landing but rejects paths through higher ground or underground endpoints',()=>{
 const {move}=fixture()
 expect(move({targetElevationFeet:0}).ok).toBe(true)
 expect(move({targetElevationFeet:-1})).toMatchObject({ok:false,reason:'movement-blocked'})
 const geometry=createEmptyMapGeometry('map',1)
 geometry.obstacles=[{id:'ridge',kind:'obstacle',label:'Ridge',points:[{x:145,y:0},{x:155,y:0},{x:155,y:500},{x:145,y:500}],cover:'none',terrainElevationFeet:25,terrainRegion:true,blocksVision:false,blocksMovement:false,blocksLineOfEffect:false,baseHeightFeet:0,heightFeet:0,createdAt:1}]
 expect(move({geometry})).toMatchObject({ok:false,reason:'movement-blocked'})
})

it('blocks mapped walls at the current flight height while allowing travel above short walls',()=>{
 const {move}=fixture();const geometry=createEmptyMapGeometry('map',1)
 geometry.walls=[{id:'wall',kind:'wall',label:'Wall',points:[{x:150,y:0},{x:150,y:500}],blocksVision:true,blocksMovement:true,blocksLineOfEffect:true,baseHeightFeet:0,heightFeet:30,createdAt:1}]
 expect(move({geometry})).toMatchObject({ok:false,reason:'movement-blocked'})
 geometry.walls[0].heightFeet=10
 expect(move({geometry}).ok).toBe(true)
 geometry.walls[0].baseHeightFeet=23;geometry.walls[0].heightFeet=10
 expect(move({geometry})).toMatchObject({ok:false,reason:'movement-blocked'})
})
it('checks other persistent barriers without inserting probe tokens or mutating rejected maps',()=>{
 const {map,area,move}=fixture()
 map.dnd5ePluginAreas!.push({...area,id:'barrier',movement:undefined,cells:[{col:3,row:2}],anchorCell:{col:3,row:2},blocking:{movement:true}})
 const before=JSON.stringify(map)
 expect(move()).toMatchObject({ok:false,reason:'movement-blocked'})
 expect(JSON.stringify(map)).toBe(before)
 expect(map.tokens).toHaveLength(0)
})

it('rejects crossing a thin overhead slab even when both endpoints are clear',()=>{
 const {map,move}=fixture(),geometry=createEmptyMapGeometry('map',1)
 geometry.obstacles=[{id:'ceiling',kind:'obstacle',label:'Ceiling',points:[{x:50,y:50},{x:250,y:50},{x:250,y:250},{x:50,y:250}],baseHeightFeet:30,heightFeet:1,cover:'total',blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,createdAt:1}]
 const before=JSON.stringify(map)
 expect(move({geometry,targetCell:{col:2,row:2},targetElevationFeet:40})).toMatchObject({ok:false,reason:'movement-blocked'})
 expect(move({geometry,targetElevationFeet:40})).toMatchObject({ok:false,reason:'movement-blocked'})
 expect(JSON.stringify(map)).toBe(before)
 geometry.obstacles[0].blocksMovement=false
 expect(move({geometry,targetElevationFeet:40}).ok).toBe(true)
})

it('uses the square footprint at corners instead of an inscribed token circle',()=>{
 const {move}=fixture(),geometry=createEmptyMapGeometry('map',1)
 geometry.walls=[{id:'corner',kind:'wall',label:'Corner',points:[{x:148,y:148},{x:149,y:149}],baseHeightFeet:20,heightFeet:5,blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,createdAt:1}]
 expect(move({geometry,targetCell:{col:2,row:3}})).toMatchObject({ok:false,reason:'movement-blocked'})
 geometry.walls[0].points=[{x:151,y:148},{x:152,y:149}]
 expect(move({geometry,targetCell:{col:2,row:3}}).ok).toBe(true)
 geometry.walls[0].points=[{x:150,y:50},{x:150,y:250}]
 expect(move({geometry,targetCell:{col:2,row:3}}).ok).toBe(true)
})

it('does not confuse an overhead slab at an earlier position with a later altitude',()=>{
 const {move}=fixture(),geometry=createEmptyMapGeometry('map',1)
 geometry.obstacles=[{id:'ceiling',kind:'obstacle',label:'Ceiling',points:[{x:50,y:50},{x:150,y:50},{x:150,y:200},{x:50,y:200}],baseHeightFeet:30,heightFeet:1,cover:'total',blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,createdAt:1}]
 expect(move({geometry,targetCell:{col:8,row:2},targetElevationFeet:40}).ok).toBe(true)
 expect(move({geometry,targetCell:{col:2,row:2},targetElevationFeet:25}).ok).toBe(true)
 expect(move({geometry,targetCell:{col:2,row:2},targetElevationFeet:26})).toMatchObject({ok:false,reason:'movement-blocked'})
})

it('respects stone ice and force panels, their altitude, and destroyed-panel openings',()=>{
 for(const kind of ['stone','ice','force'] as const){
  const {map,area,move}=fixture()
  const layout={mode:'thick' as const,start:{col:3,row:1},angles:[90]}
  const panels=stoneWallPanels(layout,map)
  const barrier:Dnd5ePluginArea={...area,id:'barrier',movement:undefined,cells:stoneWallCells(panels),anchorCell:layout.start,
   vertical:{mode:'volume',baseElevationFeet:20,heightFeet:10},blocking:{movement:true},
   ...(kind==='force'?{forceWall:layout}:{stoneWall:{mode:kind==='ice'?'ice' as const:'thick' as const,panels,saveDc:15}})}
  map.dnd5ePluginAreas!.push(barrier)
  expect(move({targetCell:{col:4,row:2}}),kind).toMatchObject({ok:false,reason:'movement-blocked'})
  area.vertical={mode:'volume',baseElevationFeet:35,heightFeet:5}
  expect(move({targetCell:{col:4,row:2}}).ok,kind).toBe(true)
  area.vertical.baseElevationFeet=20
  if(barrier.stoneWall){barrier.stoneWall.panels[0].hitPoints=0;expect(move({targetCell:{col:4,row:2}}).ok,kind).toBe(true)}
 }
})

it('blocks crossing force shells while allowing movement wholly inside a large shell',()=>{
 for(const shape of ['sphere','hemisphere'] as const){
  const {map,area,move}=fixture()
  const barrier:Dnd5ePluginArea={...area,id:'shell',movement:undefined,anchorCell:{col:4,row:2},cells:Array.from({length:7},(_,col)=>({col:col+1,row:2})),
   vertical:{mode:'volume',baseElevationFeet:0,heightFeet:shape==='sphere'?40:20},forceShell:{shape,radiusFeet:20},blocking:{movement:true,movementMode:'boundary'}}
  map.dnd5ePluginAreas!.push(barrier)
  area.vertical={mode:'volume',baseElevationFeet:5,heightFeet:5}
  area.anchorCell={col:4,row:2};area.cells=[{col:4,row:2}]
  expect(move({targetCell:{col:5,row:2}}).ok,shape).toBe(true)
  expect(move({targetCell:{col:9,row:2}}),shape).toMatchObject({ok:false,reason:'movement-blocked'})
  area.vertical.baseElevationFeet=shape==='sphere'?26:6
  expect(move({targetCell:{col:7,row:2}}),shape).toMatchObject({ok:false,reason:'movement-blocked'})
 }
})

it('blocks an intermediate cube corner entering a shell even when center rays and endpoints are clear',()=>{
 for(const shape of ['sphere','hemisphere'] as const){
  const {map,area,move}=fixture()
  const shell:Dnd5ePluginArea={...area,id:'shell',movement:undefined,anchorCell:{col:3,row:3},cells:[{col:3,row:3}],
   vertical:{mode:'volume',baseElevationFeet:shape==='sphere'?17:20,heightFeet:shape==='sphere'?6:3},forceShell:{shape,radiusFeet:3},blocking:{movement:true,movementMode:'boundary'}}
  map.dnd5ePluginAreas!.push(shell)
  const before=JSON.stringify(map)
  expect(move({targetCell:{col:4,row:2}}),shape).toMatchObject({ok:false,reason:'movement-blocked'})
  expect(JSON.stringify(map)).toBe(before)
  shell.forceShell!.radiusFeet=2.5
  if(shape==='sphere')shell.vertical={mode:'volume',baseElevationFeet:17.5,heightFeet:5}
  expect(move({targetCell:{col:4,row:2}}).ok,shape).toBe(true)
 }
})

it('requires a passage to cover the full height of the moving cube',()=>{
 const {map,area,move}=fixture(),geometry=createEmptyMapGeometry('map',1)
 geometry.walls=[{id:'wall',kind:'wall',label:'Wall',points:[{x:175,y:0},{x:175,y:500}],baseHeightFeet:0,heightFeet:50,blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,createdAt:1}]
 const passage:Dnd5ePluginArea={...area,id:'opening',movement:undefined,anchorCell:{col:3,row:2},cells:[{col:3,row:2}],
  vertical:{mode:'volume',baseElevationFeet:20,heightFeet:5},blocking:{suppressesMappedBarriers:true}}
 map.dnd5ePluginAreas!.push(passage)
 expect(move({geometry,targetCell:{col:4,row:2}}).ok).toBe(true)
 passage.vertical={mode:'volume',baseElevationFeet:20,heightFeet:1}
 expect(move({geometry,targetCell:{col:4,row:2}})).toMatchObject({ok:false,reason:'movement-blocked'})
 passage.vertical={mode:'volume',baseElevationFeet:24,heightFeet:5}
 expect(move({geometry,targetCell:{col:4,row:2}})).toMatchObject({ok:false,reason:'movement-blocked'})
 passage.vertical={mode:'volume',baseElevationFeet:20,heightFeet:1}
 geometry.walls[0].baseHeightFeet=20;geometry.walls[0].heightFeet=1
 expect(move({geometry,targetCell:{col:4,row:2}}).ok).toBe(true)
})

it('checks the entire crossing footprint against the width of a mapped opening',()=>{
 const {map,area,move}=fixture(),geometry=createEmptyMapGeometry('map',1)
 geometry.walls=[{id:'wall',kind:'wall',label:'Wall',points:[{x:133,y:0},{x:133,y:500}],baseHeightFeet:0,heightFeet:50,blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,createdAt:1}]
 map.dnd5ePluginAreas!.push({...area,id:'opening',movement:undefined,anchorCell:{col:2,row:2},cells:[{col:2,row:2}],
  vertical:{mode:'volume',baseElevationFeet:20,heightFeet:5},blocking:{suppressesMappedBarriers:true}})
 expect(move({geometry,targetCell:{col:6,row:2}}).ok).toBe(true)
 expect(move({geometry,targetCell:{col:6,row:3}})).toMatchObject({ok:false,reason:'movement-blocked'})
 map.dnd5ePluginAreas![1].cells.push({col:2,row:3})
 expect(move({geometry,targetCell:{col:6,row:3}}).ok).toBe(true)
})
