import {expect,it} from 'vitest'
import {serveDnd5eMightyFortressFeast} from './serveMightyFortressFeast'
import {createEmptyMapGeometry} from '../../lib/mapGeometry'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'

it('commits food and quota together, guards campaign time and refuses a replay',async()=>{
 const state:Record<string,any>={
  maps:{_sync:{revision:1},selectedId:'site',maps:[{id:'site',name:'Site',width:1000,height:1000,gridSize:50,feetPerCell:5,tokens:[
   {id:'caster-token',characterId:'caster',type:'player',x:100,y:100,elevationFeet:0,size:1,hp:12,label:'Caster',color:'',emoji:''}]}]},
  'map-geometry':{_sync:{revision:1},schemaVersion:3,maps:[{...createEmptyMapGeometry('site',1),structureLifetimes:[{
   id:'keep',casterId:'caster',createdWorldMinute:0,expiresWorldMinute:10080,entityIds:['wall'],replacementGroup:'mighty-fortress',siteKey:'site',
   objectBoundary:{points:[{x:0,y:0},{x:500,y:0},{x:500,y:500},{x:0,y:500}],bottomFeet:0,topFeet:30},
   fortressServices:{authorizedCreatureIds:[],mealDay:0,mealsServed:0,mealReceipts:[],mealTemplateId:'srd-5.1:item:conjured-food-portion'}}]}]},
  'campaign-time':{_sync:{revision:1},worldMinute:100},
 }
 let conflict=true,commits=0
 const gateway={loadResource:async(name:string)=>structuredClone(state[name]),saveResourcesAtomically:async(writes:any[],options:any)=>{
  expect(writes.map(write=>write.name)).toEqual(['maps','map-geometry'])
  expect(options.readRevisions).toEqual({'campaign-time':1})
  if(conflict||writes.some(write=>write.expectedRevision!==state[write.name]._sync.revision))throw Error('conflict')
  for(const write of writes)state[write.name]={...structuredClone(write.data),_sync:{revision:state[write.name]._sync.revision+1}}
  commits++;return {status:'committed',transactionId:options.transactionId,revisions:{maps:2,'map-geometry':2}}
 }} as Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
 const input={gateway,mapId:'site',structureId:'keep',actorTokenId:'caster-token',requestId:'meal',expectedWorldDay:0,guests:100}
 expect(await serveDnd5eMightyFortressFeast({...input,mealTemplateId:'srd-5.1:item:potion-of-healing'})).toEqual({ok:false,reason:'fortress-feast-recipe-mismatch'})
 const before=structuredClone(state)
 await expect(serveDnd5eMightyFortressFeast(input)).rejects.toThrow('conflict')
 expect(state).toEqual(before)
 conflict=false
 expect(await serveDnd5eMightyFortressFeast(input)).toEqual({ok:true,remainingGuests:0})
 expect(state.maps.maps[0].tokens).toHaveLength(2)
 expect(state.maps.maps[0].tokens[1].dnd5eObjectState.inventoryItem.quantity).toBe(100)
 expect(state['map-geometry'].maps[0].structureLifetimes[0].fortressServices.mealsServed).toBe(100)
 expect(await serveDnd5eMightyFortressFeast(input)).toEqual({ok:false,reason:'fortress-feast-already-served'})
 expect(commits).toBe(1)
 state['campaign-time'].worldMinute=1440
 expect(await serveDnd5eMightyFortressFeast({...input,requestId:'late'})).toEqual({ok:false,reason:'fortress-feast-clock-changed'})
 expect(commits).toBe(1)
})
