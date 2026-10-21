import {expect,it} from 'vitest'
import {commandDnd5eMightyFortressServants} from './commandMightyFortressServants'
import {createEmptyMapGeometry} from '../../lib/mapGeometry'
import {createFortressServants} from '../../../shared/fortress-services.mjs'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import {resolveDnd5eFortressServantControl} from '../../rulesets/dnd5e/fortressServantControl'

it('guards authority snapshots, persists selected assignments and refuses unauthorized or expired orders',async()=>{
 const state:Record<string,any>={
  maps:{_sync:{revision:1},maps:[{id:'site',name:'Site',width:1000,height:1000,gridSize:50,feetPerCell:5,tokens:[
   {id:'actor',characterId:'guest',type:'player',x:100,y:100,elevationFeet:0,size:1,hp:12,label:'Guest',color:'',emoji:''}]}]},
  'map-geometry':{_sync:{revision:1},schemaVersion:3,maps:[{...createEmptyMapGeometry('site',1),structureLifetimes:[{
   id:'keep',casterId:'caster',createdWorldMinute:0,expiresWorldMinute:10080,entityIds:['wall'],replacementGroup:'mighty-fortress',siteKey:'site',
   objectBoundary:{points:[{x:0,y:0},{x:500,y:0},{x:500,y:500},{x:0,y:500}],bottomFeet:0,topFeet:30},
   fortressServices:{authorizedCreatureIds:['guest'],mealDay:0,mealsServed:0,mealReceipts:[],servants:createFortressServants()}}]}]},
  'campaign-time':{_sync:{revision:1},worldMinute:100},
 }
 let conflict=true,commits=0
 state.maps.maps[0].tokens.push({id:'servant-1',type:'obstacle',x:100,y:100,size:1,hp:1,maxHp:1,
  dnd5eObjectState:{schemaVersion:1,structureBinding:{schemaVersion:1,mapId:'site',structureId:'keep'}}})
 state['map-geometry'].maps[0].structureLifetimes[0].fortressServices.servants[0].tokenId='servant-1'
 const control=()=>resolveDnd5eFortressServantControl({map:state.maps.maps[0],geometry:state['map-geometry'].maps[0],
  servantTokenId:'servant-1',commanderTokenId:'actor',worldMinute:state['campaign-time'].worldMinute})
 expect(control()?.member.number).toBe(1)
 state.maps.maps[0].tokens[1].dnd5eObjectState.structureBinding.structureId='other'
 expect(control()).toBeUndefined()
 state.maps.maps[0].tokens[1].dnd5eObjectState.structureBinding.structureId='keep'
 const fakeGeometry=structuredClone(state['map-geometry'].maps[0])
 delete fakeGeometry.structureLifetimes[0].fortressServices.servants[0].tokenId
 expect(resolveDnd5eFortressServantControl({map:state.maps.maps[0],geometry:fakeGeometry,servantTokenId:'servant-1',commanderTokenId:'actor',worldMinute:100})).toBeUndefined()
 const gateway={loadResource:async(name:string)=>structuredClone(state[name]),saveResourcesAtomically:async(writes:any[],options:any)=>{
  expect(writes.map(write=>write.name)).toEqual(['map-geometry'])
  expect(options.readRevisions).toEqual({maps:1,'campaign-time':1})
  if(conflict||writes.some(write=>write.expectedRevision!==state[write.name]._sync.revision))throw Error('conflict')
  for(const write of writes)state[write.name]={...structuredClone(write.data),_sync:{revision:state[write.name]._sync.revision+1}}
  commits++;return {status:'committed',transactionId:options.transactionId,revisions:{'map-geometry':2}}
 }} as Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
 const input={gateway,mapId:'site',structureId:'keep',actorTokenId:'actor',requestId:'order',servantNumbers:[1,100],instruction:'清理餐桌'}
 const before=structuredClone(state)
 state.maps.maps[0].tokens[1].dnd5eObjectState.structureBinding.structureId='other'
 expect(await commandDnd5eMightyFortressServants(input)).toMatchObject({ok:false,reason:'fortress-command-servant-unavailable'})
 state.maps.maps[0].tokens[1].dnd5eObjectState.structureBinding.structureId='keep'
 await expect(commandDnd5eMightyFortressServants(input)).rejects.toThrow('conflict')
 expect(state).toEqual(before)
 conflict=false
 expect(await commandDnd5eMightyFortressServants(input)).toEqual({ok:true})
 const roster=()=>state['map-geometry'].maps[0].structureLifetimes[0].fortressServices.servants
 expect(roster()[0].assignment).toEqual({actorId:'guest',instruction:'清理餐桌'})
 expect(roster()[99].assignment).toEqual(roster()[0].assignment)
 expect(roster()[1].assignment).toBeUndefined()
 expect(await commandDnd5eMightyFortressServants({...input,servantNumbers:[1],instruction:''})).toEqual({ok:true})
 expect(roster()[0].assignment).toBeUndefined()
 expect(control()?.member.tokenId).toBe('servant-1')
 expect(roster()[99].assignment.instruction).toBe('清理餐桌')
 expect(await commandDnd5eMightyFortressServants({...input,servantNumbers:[1,1]})).toMatchObject({ok:false,reason:'fortress-command-invalid'})
 state.maps.maps[0].tokens[0].characterId='stranger'
 expect(control()).toBeUndefined()
 expect(await commandDnd5eMightyFortressServants(input)).toMatchObject({ok:false,reason:'fortress-command-unauthorized'})
 state.maps.maps[0].tokens[0].characterId='guest'
 state.maps.maps[0].tokens[0].x=600
 expect(await commandDnd5eMightyFortressServants(input)).toMatchObject({ok:false,reason:'fortress-command-outside'})
 state.maps.maps[0].tokens[0].x=100
 state['campaign-time'].worldMinute=10080
 expect(control()).toBeUndefined()
 expect(await commandDnd5eMightyFortressServants(input)).toMatchObject({ok:false,reason:'fortress-command-unavailable'})
 expect(commits).toBe(2)
})
