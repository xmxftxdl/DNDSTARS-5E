import {it,expect} from 'vitest'
import {pickupDnd5eMightyFortressItem,dropDnd5eMightyFortressItem,moveDnd5eMightyFortressServant,operateDnd5eMightyFortressDoor} from './pickupMightyFortressItem'
import {createFortressServants} from '../../../shared/fortress-services.mjs'
import {createEmptyMapGeometry} from '../../lib/mapGeometry'
import {createDnd5eTurnEconomyCounts} from '../../rulesets/dnd5e/turnEconomy'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import {prepareDnd5eFortressServantMove} from '../../rulesets/dnd5e/fortressServantMove'

it('commits the item transfer and commander bonus action together and rejects stale or paused requests',async()=>{
 const servants=createFortressServants();servants[0].tokenId='servant'
 const state:Record<string,any>={maps:{_sync:{revision:1},maps:[{id:'site',name:'Site',width:1000,height:1000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[
  {id:'commander',label:'Commander',type:'enemy',x:100,y:100,size:1,hp:12},
  {id:'servant',label:'Servant',type:'obstacle',x:150,y:100,size:1,hp:1,dnd5eObjectState:{schemaVersion:1,structureBinding:{schemaVersion:1,mapId:'site',structureId:'keep'}}},
  {id:'item',label:'Holy water',type:'obstacle',x:150,y:100,size:1,dnd5eObjectState:{schemaVersion:1,weightPounds:1,inventoryItem:{templateId:'srd-5.1:item:holy-water-flask',quantity:2,receiptId:'item'}}},
 ]}]},'map-geometry':{_sync:{revision:1},maps:[{...createEmptyMapGeometry('site',1),structureLifetimes:[{
  id:'keep',casterId:'commander',createdWorldMinute:0,expiresWorldMinute:10080,entityIds:['wall'],replacementGroup:'mighty-fortress',siteKey:'site',
  objectBoundary:{points:[{x:0,y:0},{x:500,y:0},{x:500,y:500},{x:0,y:500}],bottomFeet:0,topFeet:30},
  fortressServices:{authorizedCreatureIds:[],mealDay:0,mealsServed:0,mealReceipts:[],servants},
 }]}]},'campaign-time':{_sync:{revision:1},worldMinute:100},characters:null,
 combat:{_sync:{revision:1},mapId:'site',active:true,round:1,initiativeIndex:0,initiativeOrder:[{tokenId:'commander'}],
  dnd5eTurnEconomyByToken:{commander:createDnd5eTurnEconomyCounts('turn')}}}
 let conflict=true,commits=0
 const gateway={loadResource:async(name:string)=>structuredClone(state[name]),saveResourcesAtomically:async(writes:any[],options:any)=>{
  const doorWrite=writes.some(write=>write.name==='map-geometry')
  expect(writes.map(write=>write.name)).toEqual(doorWrite?['maps','map-geometry','combat']:['maps','combat'])
  expect(options.readRevisions).toEqual(doorWrite?{'campaign-time':1,characters:0}:{'map-geometry':1,'campaign-time':1,characters:0})
  if(conflict||writes.some(write=>write.expectedRevision!==state[write.name]._sync.revision))throw Error('conflict')
  for(const write of writes)state[write.name]={...structuredClone(write.data),_sync:{revision:state[write.name]._sync.revision+1}}
  commits++;return {status:'committed',transactionId:options.transactionId,revisions:{maps:2,combat:2}}
 }} as Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
 const input={gateway,mapId:'site',commanderTokenId:'commander',servantTokenId:'servant',objectTokenId:'item',expectedReceiptId:'item',expectedQuantity:2,requestId:'pickup'}
 const before=structuredClone(state)
 await expect(pickupDnd5eMightyFortressItem(input)).rejects.toThrow('conflict')
 expect(state).toEqual(before)
 conflict=false
 expect(await pickupDnd5eMightyFortressItem(input)).toMatchObject({ok:true})
 expect(state.maps.maps[0].tokens.find((t:any)=>t.id==='item').dnd5eObjectState.inventoryItem.quantity).toBe(1)
 expect(state.maps.maps[0].tokens.find((t:any)=>t.id==='servant').dnd5eCarriedObjects).toHaveLength(1)
 expect(state.combat.dnd5eTurnEconomyByToken.commander.bonusAction.current).toBe(0)
 expect(await pickupDnd5eMightyFortressItem(input)).toMatchObject({ok:false,reason:'pickup-object-changed'})
 expect(await pickupDnd5eMightyFortressItem({...input,expectedQuantity:1})).toMatchObject({ok:false,reason:'pickup-action-unavailable'})
 state.combat.flowPause={reason:'manual'}
 expect(await pickupDnd5eMightyFortressItem({...input,expectedQuantity:1})).toMatchObject({ok:false,reason:'pickup-invalid-turn'})
 expect(commits).toBe(1)
 delete state.combat.flowPause
 state.combat.dnd5eTurnEconomyByToken.commander=createDnd5eTurnEconomyCounts('next-turn')
 const held=state.maps.maps[0].tokens.find((t:any)=>t.id==='servant').dnd5eCarriedObjects[0]
 held.objectState.surfaceProfile={material:'stone',widthFeet:1,lengthFeet:1,heightFeet:1,rotationDegrees:0,surfaceId:'original-marked-item'}
 const originalMark={id:'carried-mark',label:'Mark',sourceCharacterId:'wizard',sourceTokenId:'wizard-token',createdWorldMinute:50,expiresAtWorldMinute:160,cells:[{col:1,row:1}],sourceLimit:{groupId:'mold-earth-lasting',maximum:2},visual:{preset:'surface-color',horizontalSurface:{entityId:'surface-object:original-marked-item',material:'stone',elevationFeet:1,localCornersFeet:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}],corners:[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}]}},vertical:{mode:'volume',baseElevationFeet:1,heightFeet:1}}
 state.maps.maps.push({...state.maps.maps[0],id:'old-surface-map',tokens:[],dnd5ePluginAreas:[originalMark]})
 const drop={gateway,mapId:'site',commanderTokenId:'commander',servantTokenId:'servant',carriedObjectId:held.id,expectedPickupReceipt:held.pickupReceipt,requestId:'drop'}
 conflict=true
 const beforeDrop=structuredClone(state)
 await expect(dropDnd5eMightyFortressItem(drop)).rejects.toThrow('conflict')
 expect(state).toEqual(beforeDrop)
 conflict=false
 expect(await dropDnd5eMightyFortressItem(drop)).toMatchObject({ok:true})
 expect(state.maps.maps[0].tokens.find((t:any)=>t.id==='servant').dnd5eCarriedObjects).toBeUndefined()
 expect(state.maps.maps[0].tokens.find((t:any)=>t.id===`carried:${held.id}`)).toMatchObject({x:150,y:100,dnd5eObjectState:{wornOrCarried:false,inventoryItem:{quantity:1}}})
 expect(state.combat.dnd5eTurnEconomyByToken.commander.bonusAction.current).toBe(0)
 expect(await dropDnd5eMightyFortressItem(drop)).toMatchObject({ok:false,reason:'fortress-drop-item-changed'})
 expect(state.maps.maps.find((map:any)=>map.id==='old-surface-map').dnd5ePluginAreas).toEqual([])
 expect(state.maps.maps[0].dnd5ePluginAreas).toHaveLength(1)
 expect(state.maps.maps[0].dnd5ePluginAreas[0]).toMatchObject({id:originalMark.id,expiresAtWorldMinute:160,sourceCharacterId:'wizard',sourceLimit:originalMark.sourceLimit})
 expect(commits).toBe(2)
 Object.assign(state,structuredClone(before))
 state.maps.maps[0].tokens.find((t:any)=>t.id==='servant').x=175
 state.maps.maps[0].tokens.find((t:any)=>t.id==='servant').y=125
 state.maps.maps[0].tokens.find((t:any)=>t.id==='item').x=325
 state.maps.maps[0].tokens.find((t:any)=>t.id==='item').y=125
 const moving={...input,requestId:'move-pickup',movement:{expectedPosition:{x:175,y:125,elevationFeet:0},destination:{x:275,y:125,elevationFeet:0}}}
 const beforeMove=structuredClone(state)
 const unsnappedMap=structuredClone(state.maps.maps[0])
 unsnappedMap.tokens.find((token:any)=>token.id==='servant').x=165
 unsnappedMap.tokens.find((token:any)=>token.id==='item').x=500
 const unsnapped={map:unsnappedMap,geometry:state['map-geometry'].maps[0],commanderTokenId:'commander',servantTokenId:'servant',
  worldMinute:100,expectedPosition:{x:165,y:125,elevationFeet:0},destination:{x:275,y:125,elevationFeet:0}}
 const offsetMove=prepareDnd5eFortressServantMove(unsnapped)
 expect(offsetMove.ok).toBe(true)
 if(offsetMove.ok){expect(offsetMove.path.points[0]).toEqual({x:165,y:125});expect(offsetMove.path.distanceFeet).toBe(11);expect(offsetMove.path.movementCostFeet).toBe(11)}
 expect(prepareDnd5eFortressServantMove({...unsnapped,destination:{x:325,y:125,elevationFeet:0}})).toMatchObject({ok:false})
 const obstructed={...unsnappedMap,tokens:[...unsnappedMap.tokens,{id:'blocker',type:'enemy',x:190,y:125,size:1}]}
 expect(prepareDnd5eFortressServantMove({...unsnapped,map:obstructed})).toMatchObject({ok:false})
 const alternateMap=structuredClone(unsnappedMap)
 Object.assign(alternateMap.tokens.find((token:any)=>token.id==='commander'),{x:25,y:325})
 alternateMap.tokens.push({id:'nearest-blocker',type:'enemy',x:220,y:125,size:1})
 const alternate=prepareDnd5eFortressServantMove({...unsnapped,map:alternateMap,destination:{x:75,y:225,elevationFeet:0}})
 expect(alternate.ok).toBe(true)
 if(alternate.ok){
  expect(alternate.path.points[0]).toEqual({x:165,y:125})
  expect(alternate.path.points[1]).not.toEqual({x:175,y:125})
  expect(alternate.path.movementCostFeet).toBeLessThanOrEqual(15)
 }
 expect(unsnappedMap.tokens.find((token:any)=>token.id==='servant').x).toBe(165)
 expect(await pickupDnd5eMightyFortressItem({...moving,movement:{...moving.movement,destination:{x:275,y:125,elevationFeet:20}}})).toMatchObject({ok:false,reason:'fortress-move-path-unavailable'})
 expect(await pickupDnd5eMightyFortressItem({...moving,movement:{...moving.movement,destination:{x:475,y:125,elevationFeet:0}}})).toMatchObject({ok:false,reason:'fortress-move-path-unavailable'})
 expect(await pickupDnd5eMightyFortressItem({...moving,movement:{...moving.movement,expectedPosition:{x:225,y:125,elevationFeet:0}}})).toMatchObject({ok:false,reason:'fortress-move-position-changed'})
 expect(await pickupDnd5eMightyFortressItem({...moving,expectedQuantity:3})).toMatchObject({ok:false,reason:'pickup-object-changed'})
 expect(state).toEqual(beforeMove)
 conflict=true
 await expect(pickupDnd5eMightyFortressItem(moving)).rejects.toThrow('conflict')
 expect(state).toEqual(beforeMove)
 conflict=false
 expect(await pickupDnd5eMightyFortressItem(moving)).toMatchObject({ok:true})
 expect(state.maps.maps[0].tokens.find((t:any)=>t.id==='servant')).toMatchObject({x:275,y:125,elevationFeet:0})
 expect(state.combat.dnd5eTurnEconomyByToken.commander.bonusAction.current).toBe(0)
 expect(commits).toBe(3)
 Object.assign(state,structuredClone(beforeMove))
 const approaching={...input,approach:true,requestId:'approach-pickup'}
 conflict=true
 await expect(pickupDnd5eMightyFortressItem(approaching)).rejects.toThrow('conflict')
 expect(state).toEqual(beforeMove)
 conflict=false
 expect(await pickupDnd5eMightyFortressItem(approaching)).toMatchObject({ok:true})
 const approached=state.maps.maps[0].tokens.find((t:any)=>t.id==='servant')
 expect(approached.x).toBeGreaterThan(175)
 expect(approached.dnd5eCarriedObjects).toHaveLength(1)
 expect(state.combat.dnd5eTurnEconomyByToken.commander.bonusAction.current).toBe(0)
 state.combat.dnd5eTurnEconomyByToken.commander=createDnd5eTurnEconomyCounts('drop-turn')
 const carried=approached.dnd5eCarriedObjects[0]
 expect(await dropDnd5eMightyFortressItem({...drop,requestId:'move-drop',carriedObjectId:carried.id,expectedPickupReceipt:carried.pickupReceipt,
  movement:{expectedPosition:{x:approached.x,y:approached.y,elevationFeet:0},destination:{x:275,y:125,elevationFeet:0}}})).toMatchObject({ok:true})
 expect(state.maps.maps[0].tokens.find((t:any)=>t.id===`carried:${carried.id}`)).toMatchObject({x:275,y:125})
 expect(state.combat.dnd5eTurnEconomyByToken.commander.bonusAction.current).toBe(0)
 Object.assign(state,structuredClone(beforeMove))
 state.maps.maps[0].tokens.find((t:any)=>t.id==='item').x=800
 const unreachable=structuredClone(state)
 expect(await pickupDnd5eMightyFortressItem(approaching)).toMatchObject({ok:false,reason:'fortress-move-path-unavailable'})
 expect(state).toEqual(unreachable)
 Object.assign(state,structuredClone(beforeMove))
 const standalone={gateway,mapId:'site',commanderTokenId:'commander',servantTokenId:'servant',requestId:'move-only',movement:moving.movement}
 conflict=true
 await expect(moveDnd5eMightyFortressServant(standalone)).rejects.toThrow('conflict')
 expect(state).toEqual(beforeMove)
 conflict=false
 expect(await moveDnd5eMightyFortressServant(standalone)).toMatchObject({ok:true})
 expect(state.maps.maps[0].tokens.find((t:any)=>t.id==='servant')).toMatchObject({x:275,y:125})
 expect(state.maps.maps[0].tokens.find((t:any)=>t.id==='item').dnd5eObjectState.inventoryItem.quantity).toBe(2)
 expect(state.combat.dnd5eTurnEconomyByToken.commander.bonusAction.current).toBe(0)
 Object.assign(state,structuredClone(beforeMove))
 state['map-geometry'].maps[0].doors=[{id:'door',kind:'door',label:'门',points:[{x:225,y:100},{x:225,y:150}],
  state:'closed',openState:'closed',lockState:'unlocked',physicalState:'intact',secret:false,
  blocksVision:true,blocksMovement:true,blocksLineOfEffect:true,baseHeightFeet:0,heightFeet:10,createdAt:1}]
 const doorCommand={gateway,mapId:'site',commanderTokenId:'commander',servantTokenId:'servant',requestId:'door',doorId:'door',doorOperation:'open' as const}
 const beforeDoor=structuredClone(state)
 conflict=true
 await expect(operateDnd5eMightyFortressDoor(doorCommand)).rejects.toThrow('conflict')
 expect(state).toEqual(beforeDoor)
 conflict=false
 state['map-geometry'].maps[0].doors[0].lockState='locked'
 expect(await operateDnd5eMightyFortressDoor(doorCommand)).toMatchObject({ok:false,reason:'door-locked'})
 expect(state.combat.dnd5eTurnEconomyByToken.commander.bonusAction.current).toBe(1)
 state['map-geometry'].maps[0].doors[0].lockState='unlocked'
 state['map-geometry'].maps[0].walls=[{id:'blocking-wall',kind:'wall',label:'Wall',points:[{x:200,y:50},{x:200,y:200}],
  blocksVision:true,blocksMovement:true,blocksLineOfEffect:true,baseHeightFeet:0,heightFeet:10,createdAt:1}]
 expect(await operateDnd5eMightyFortressDoor(doorCommand)).toMatchObject({ok:false,reason:'fortress-door-obstructed'})
 expect(state.combat.dnd5eTurnEconomyByToken.commander.bonusAction.current).toBe(1)
 state['map-geometry'].maps[0].walls=[]
 expect(await operateDnd5eMightyFortressDoor(doorCommand)).toMatchObject({ok:true})
 expect(state['map-geometry'].maps[0].doors[0].openState).toBe('open')
 expect(state.combat.dnd5eTurnEconomyByToken.commander.bonusAction.current).toBe(0)
 expect(await operateDnd5eMightyFortressDoor({...doorCommand,doorOperation:'close'})).toMatchObject({ok:false})
 state.combat.dnd5eTurnEconomyByToken.commander=createDnd5eTurnEconomyCounts('close-turn')
 state.maps.maps[0].tokens.push({id:'doorway-occupant',type:'enemy',x:225,y:125,size:1,hp:10})
 expect(await operateDnd5eMightyFortressDoor({...doorCommand,doorOperation:'close'})).toMatchObject({ok:false,reason:'fortress-door-occupied'})
 expect(state['map-geometry'].maps[0].doors[0].openState).toBe('open')
 expect(state.combat.dnd5eTurnEconomyByToken.commander.bonusAction.current).toBe(1)
 state.maps.maps[0].tokens=state.maps.maps[0].tokens.filter((token:any)=>token.id!=='doorway-occupant')
 expect(await operateDnd5eMightyFortressDoor({...doorCommand,doorOperation:'close'})).toMatchObject({ok:true})
 expect(state['map-geometry'].maps[0].doors[0].openState).toBe('closed')
})
