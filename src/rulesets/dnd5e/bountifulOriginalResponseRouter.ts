import{validBountifulMonsterZeroCommand}from'../../../shared/bountiful-monster-zero-command.mjs'
import{processBountifulMonsterZeroQueuedResponse}from'./bountifulMonsterZeroQueuedResponse'
import type{BountifulMonsterDamageZeroOriginalRawLoader}from'./bountifulMonsterDamageZeroOriginalRaw'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import {processBountifulOriginalResponse} from './bountifulLuckPersistentHost'
import {processBountifulHostOperationChoice} from './bountifulHostOperationPersistent'
import {validBountifulHostOperation} from '../../../shared/bountiful-host-operation.mjs'

/** Routing uses only the current protected parent reread by the Host. The
 * caller's action or a public payload cannot choose native authority. Both
 * processors then reread the real authenticated append and original source. */
export async function routeBountifulOriginalResponse(input:{mapId:string;requestId:string},gateway:Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'|'publishEvent'>,options:{monsterZeroOriginalSource?:BountifulMonsterDamageZeroOriginalRawLoader}={}){
 const queue=await gateway.loadResource<{requests?:readonly {id:string;type:string;mapId:string;bountifulLuck?:{parentId:string;occurrence:number}}[]}>('player-action-requests')
 const action=queue?.requests?.find(row=>row.id===input.requestId&&row.type==='dnd5e-bountiful-luck'&&row.mapId===input.mapId)
 const combat=await gateway.loadResource<{bountifulOriginalParents?:Record<string,{originalRoomAction:unknown;originalAdapterId?:string}>}>('combat')
 const scope=action?.bountifulLuck,receipt=scope&&combat?.bountifulOriginalParents?.[JSON.stringify(['bountiful-original-parent',scope.parentId,scope.occurrence])]
 const command=receipt?.originalRoomAction as {kind?:unknown}|undefined
 if(command?.kind==='monster-damage-zero-original'){
  if(!validBountifulMonsterZeroCommand(command)||receipt?.originalAdapterId!=='monster')throw Error('bountiful-router:exact-monster-zero-parent-required')
  if(!options.monsterZeroOriginalSource)throw Error('bountiful-router:private-monster-zero-source-required')
  return processBountifulMonsterZeroQueuedResponse(input,gateway,options.monsterZeroOriginalSource)
 }
 if(receipt&&validBountifulHostOperation(receipt.originalRoomAction))return processBountifulHostOperationChoice(input.requestId,gateway)
 return processBountifulOriginalResponse(input,gateway)
}
