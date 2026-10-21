import {expect,it} from 'vitest'
import {migrateMapsState,useMapStore,type BattleMap} from '../../store/maps'
import {reconcileDnd5ePersistentAreaAnchors} from './coreSpellAreas'

function fixture():BattleMap {
 return {id:'sensor-map',name:'Sensor',width:1000,height:1000,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,feetPerCell:5,tokens:[
  {id:'caster',characterId:'owner',type:'player',label:'Caster',x:25,y:25,size:1,color:'#fff',emoji:''},
  {id:'target',characterId:'observed',type:'player',label:'Target',x:175,y:175,size:1,color:'#fff',emoji:'',elevationFeet:15},
  {id:'sensor',type:'obstacle',label:'Sensor',x:175,y:175,size:0.5,color:'#fff',emoji:'',elevationFeet:15,
   dnd5eSpellEffect:{schemaVersion:1,spellId:'scrying',sourceCharacterId:'owner',sourceTokenId:'caster',concentrationId:'scrying',createdRound:1,expiresAfterRound:101}},
 ],dnd5ePluginAreas:[{id:'sensor-area',pluginId:'test.scrying',featureId:'scrying-creature',label:'Sensor',color:'#fff',sourceCharacterId:'owner',sourceTokenId:'caster',
  anchorMode:'effect-token',anchorTokenId:'sensor',anchorCell:{col:3,row:3},cells:[{col:3,row:3}],createdRound:1,expiresAfterRound:101,
  sensorTarget:{tokenId:'target',characterId:'observed'}}]}
}

it('moves the sensor and its area from a real target patch, without moving the caster or unrelated tokens',()=>{
 const previous=useMapStore.getState()
 try{
  useMapStore.setState({maps:[fixture()]})
  useMapStore.getState().updateToken('sensor-map','target',{x:375,y:225,elevationFeet:30})
  const map=useMapStore.getState().maps[0]
  expect(map.tokens.find(token=>token.id==='sensor')).toMatchObject({x:375,y:225,elevationFeet:30})
  expect(map.tokens.find(token=>token.id==='caster')).toMatchObject({x:25,y:25})
  expect(map.dnd5ePluginAreas?.[0]).toMatchObject({anchorCell:{col:7,row:4},cells:[{col:7,row:4}]})
  useMapStore.getState().updateToken('sensor-map','caster',{x:425,y:425})
  expect(useMapStore.getState().maps[0].tokens.find(token=>token.id==='sensor')).toMatchObject({x:375,y:225})
 }finally{useMapStore.setState(previous)}
})

it('restores the bound character after token renaming and removes stale or ambiguous sensors',()=>{
 const saved=migrateMapsState(JSON.parse(JSON.stringify({maps:[fixture()]}))).maps[0]
 expect(saved.dnd5ePluginAreas?.[0].sensorTarget).toEqual({tokenId:'target',characterId:'observed'})
 const moved={...saved,tokens:saved.tokens.map(token=>token.id==='target'?{...token,id:'new-token',x:425,y:275}:token)}
 expect(reconcileDnd5ePersistentAreaAnchors(moved).tokens.find(token=>token.id==='sensor')).toMatchObject({x:425,y:275})
 for(const mode of ['missing','ambiguous','reused-id']){
  const changed=structuredClone(saved)
  if(mode==='missing')changed.tokens=changed.tokens.filter(token=>token.id!=='target')
  if(mode==='ambiguous')changed.tokens.push({...changed.tokens[1],id:'duplicate'})
  if(mode==='reused-id')changed.tokens[1].characterId='different-character'
  const result=reconcileDnd5ePersistentAreaAnchors(changed)
  expect(result.tokens.some(token=>token.id==='sensor')).toBe(false)
  expect(result.dnd5ePluginAreas).toEqual([])
  expect(result.tokens.some(token=>token.id==='caster')).toBe(true)
 }
})

it('rejects malformed saved sensor bindings rather than retaining a stationary sensor area',()=>{
 for(const sensorTarget of [{tokenId:''},{tokenId:2},{tokenId:'target',characterId:''},[]]){
  const map=fixture();Object.assign(map.dnd5ePluginAreas![0],{sensorTarget})
  expect(migrateMapsState({maps:[map]}).maps[0].dnd5ePluginAreas).toEqual([])
 }
})

it('transfers a following sensor atomically through the real scene transfer store entry',()=>{
 const previous=useMapStore.getState()
 try{
  const source={...fixture(),dnd5ePlane:'material'}
  source.dnd5ePluginAreas![0].createdWorldMinute=100
  source.dnd5ePluginAreas![0].expiresAtWorldMinute=110
  const remote:BattleMap={...source,id:'remote',name:'Remote',gridSize:100,tokens:[],dnd5ePluginAreas:[]}
  useMapStore.setState({maps:[source,remote]})
  expect(useMapStore.getState().transferToken(source.id,remote.id,'target',{x:550,y:350})).toBe(true)
  const maps=useMapStore.getState().maps,old=maps[0],destination=maps[1]
  expect(old.tokens.map(token=>token.id)).toEqual(['caster'])
  expect(old.dnd5ePluginAreas).toEqual([])
  expect(destination.tokens.find(token=>token.id==='sensor')).toMatchObject({x:550,y:350,elevationFeet:15})
  expect(destination.dnd5ePluginAreas?.[0]).toMatchObject({anchorCell:{col:5,row:3},expiresAtWorldMinute:110,
   sourceTokenId:'caster',sourceCharacterId:'owner',sensorTarget:{tokenId:'target',characterId:'observed'}})
  expect(destination.tokens.some(token=>token.id==='caster')).toBe(false)
  const reloaded=migrateMapsState(JSON.parse(JSON.stringify({maps}))).maps
  expect(reloaded[1].dnd5ePluginAreas?.[0]?.sensorTarget).toEqual({tokenId:'target',characterId:'observed'})
  useMapStore.setState({maps:reloaded})
  expect(useMapStore.getState().transferToken('remote','remote','target',{x:750,y:450})).toBe(true)
  expect(useMapStore.getState().maps[1].tokens.find(token=>token.id==='sensor')).toMatchObject({x:750,y:450})
  expect(source.tokens).toHaveLength(3)
 }finally{useMapStore.setState(previous)}
})

it('does not send following sensors to unknown planes, other planes, ambiguous creatures or colliding entities',()=>{
 const previous=useMapStore.getState()
 try{
  for(const mode of ['unknown','other-plane','ambiguous','token-collision','area-collision']){
   const source={...fixture(),dnd5ePlane:'material'}
   const remote:BattleMap={...source,id:'remote',tokens:[],dnd5ePluginAreas:[],
    dnd5ePlane:mode==='unknown'?undefined:mode==='other-plane'?'ethereal':'material'}
   if(mode==='ambiguous')remote.tokens.push({...source.tokens[1],id:'duplicate'})
   if(mode==='token-collision')remote.tokens.push({...source.tokens[0],id:'sensor',characterId:'unrelated'})
   if(mode==='area-collision')remote.dnd5ePluginAreas=[{...source.dnd5ePluginAreas![0],sensorTarget:undefined,anchorMode:'fixed',anchorTokenId:undefined}]
   const before=structuredClone(remote)
   useMapStore.setState({maps:[source,remote]})
   expect(useMapStore.getState().transferToken(source.id,remote.id,'target',{x:550,y:350})).toBe(true)
   const maps=useMapStore.getState().maps
   expect(maps[0].tokens.some(token=>token.id==='sensor')).toBe(false)
   expect(maps[1].tokens.filter(token=>token.dnd5eSpellEffect)).toEqual([])
   expect(maps[1].tokens.filter(token=>token.id!=='target')).toEqual(before.tokens)
   expect(maps[1].dnd5ePluginAreas).toEqual(before.dnd5ePluginAreas)
  }
 }finally{useMapStore.setState(previous)}
})

it('moves a bound sensor in the same portal proposal while preserving source ownership and the portal',async()=>{
 const {createTeleportationCircle,travelThroughTeleportationCircle}=await import('./teleportationCircle')
 const source={...fixture(),dnd5ePlane:'material'}
 const remote:BattleMap={...source,id:'remote',tokens:[],dnd5ePluginAreas:[]}
 const portal=createTeleportationCircle({id:'portal',map:source,caster:source.tokens[0],round:1,
  exit:{mapId:'remote',x:525,y:325,elevationFeet:30}})
 source.dnd5ePluginAreas!.push(portal)
 const before=structuredClone([source,remote])
 const result=travelThroughTeleportationCircle([source,remote],source.id,'portal','target')!
 const target=result[1].tokens.find(token=>token.id==='target')!
 expect(result[1].tokens.find(token=>token.id==='sensor')).toMatchObject({x:target.x,y:target.y,elevationFeet:30})
 expect(result[0].dnd5ePluginAreas?.map(area=>area.id)).toEqual(['portal'])
 expect(result[0].tokens.map(token=>token.id)).toEqual(['caster'])
 expect(result[1].dnd5ePluginAreas?.[0].sourceCharacterId).toBe('owner')
 expect([source,remote]).toEqual(before)
})

it('keeps the sensor aligned when a portal teleports the observed creature within one scene',async()=>{
 const {createTeleportationCircle,travelThroughTeleportationCircle}=await import('./teleportationCircle')
 const source=fixture()
 const portal=createTeleportationCircle({id:'portal',map:source,caster:source.tokens[0],round:1,
  exit:{mapId:source.id,x:525,y:325,elevationFeet:30}})
 source.dnd5ePluginAreas!.push(portal)
 const result=travelThroughTeleportationCircle([source],source.id,'portal','target')![0]
 const target=result.tokens.find(token=>token.id==='target')!
 expect(result.tokens.find(token=>token.id==='sensor')).toMatchObject({x:target.x,y:target.y,elevationFeet:30})
 expect(result.dnd5ePluginAreas?.find(area=>area.id==='portal')).toEqual(portal)
})

it('projects a transferred sensor only to its owner and retains live source vision after reload',async()=>{
 const {projectMapsForPlayer}=await import('../../../scripts/shared-server-core.mjs')
 const {normalizeCharacter}=await import('../../store/characters')
 const {projectCharacterTokenPresentations}=await import('../../store/maps')
 const {travelThroughTeleportationCircle,createTeleportationCircle}=await import('./teleportationCircle')
 const source={...fixture(),dnd5ePlane:'material'}
 source.tokens[0].visionRangeFeet=75
 Object.assign(source.tokens[2].dnd5eSpellEffect!,{visionFromSource:true,shareVisionWithSource:true,hearingFromSource:true,hiddenBody:true})
 Object.assign(source.dnd5ePluginAreas![0],{concentrationId:'scrying',createdWorldMinute:100,expiresAtWorldMinute:110})
 source.dnd5ePluginAreas!.push(createTeleportationCircle({id:'portal',map:source,caster:source.tokens[0],round:1,exit:{mapId:'remote',x:525,y:325}}))
 const remote:BattleMap={...source,id:'remote',tokens:[],dnd5ePluginAreas:[]}
 const travelled=travelThroughTeleportationCircle([source,remote],source.id,'portal','target')!
 const maps=migrateMapsState(JSON.parse(JSON.stringify({maps:travelled}))).maps
 const owner=normalizeCharacter({id:'owner',name:'Owner',roomMemberId:'member-owner',dnd5eCombatState:{concentrationSpellId:'scrying'}})
 const project=(memberId='member-owner',minute=100)=>projectMapsForPlayer({maps,selectedId:source.id},{maps:[]},'owner',
  {characters:[owner]},{memberId},null,minute) as {selectedId:string;maps:BattleMap[]}
 const visible=project()
 expect(visible.selectedId).toBe('remote')
 const sensor=visible.maps[1].tokens.find(token=>token.id==='sensor')!
 expect(sensor).toMatchObject({visionRangeFeet:75,viewerControlled:true,dnd5eSpellEffect:{hearingFromSource:true}})
 expect(projectCharacterTokenPresentations([sensor],[owner],visible.maps.flatMap(map=>map.tokens))[0]).toMatchObject({visionRangeFeet:75})
 expect(project('unrelated-member').maps[1].tokens.some(token=>token.id==='sensor')).toBe(false)
 expect(project('member-owner',110).selectedId).toBe(source.id)
})
