import type {SharedPlayerActionState,SharedCombatState} from '../../lib/sharedCombatTypes'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {OriginalD20Ready} from './allyNaturalOneCheckpoint'
import type {BountifulOriginalDieReceipt} from './bountifulLuckReceipt'
import {bountifulPreparedReplayFacts} from './bountifulLuckReceipt'
import {bountifulOriginalParentReceiptId} from './bountifulLuckPersistentHost'
import {beginBountifulEquipmentOriginal} from './bountifulLuckEquipmentOriginal'
import {driveBountifulEquipmentContinuation} from './bountifulEquipmentContinuationHost'
import {bountifulDeferredD20RequestId} from './bountifulLuckDeferredD20'

type Source=Parameters<typeof beginBountifulEquipmentOriginal>[0]['source']&{hostOriginalRollId:string;hostOriginalDiceCursor:number}
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
/** Concrete Host sequence: actual original die -> eligible BL owners -> only
 * independent unreplaced original dice may use ordinary self rerolls -> real
 * equipped-item choice. Returned faces are previews; raw source stays intact. */
export async function continueBountifulEquipmentOriginal(input:{action:SharedPlayerActionState;source:Source},gateway:Gateway,ui:{original:Parameters<typeof beginBountifulEquipmentOriginal>[2];equipment:Parameters<typeof driveBountifulEquipmentContinuation>[2];confirmSelfReroll:(request:{rollId:string;originalValue:number;dieIndex:number;ready:OriginalD20Ready;bountifulParent:{parentId:string;sourceOccurrence:number;dieIndex:number;rawRollId:string}})=>Promise<number>}){
 const stage=await beginBountifulEquipmentOriginal(input,gateway,ui.original)
 if(!stage)return undefined
 const read=async()=>{
  const combat=await gateway.loadResource<SharedCombatState>('combat'),first=combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(input.action.id,0)]
  if(!first||first.consumed)throw Error('bountiful-equipment-flow:real-pending-parent-required')
  return {first,receipts:Object.values(combat.bountifulOriginalParents??{}).filter(row=>row.identity.parentId===input.action.id).sort((a,b)=>a.identity.occurrence-b.identity.occurrence)}
 }
 let current=await read()
 if(!current.first.postOriginalEquipmentD20){
  const origin=stage.receipts.filter(row=>row.request.kind==='attack'&&row.request.actorId===stage.originalReady.actorId&&JSON.stringify(row.request.originalRolls)===JSON.stringify(stage.originalReady.originalRolls)).at(-1)
  if(!origin)throw Error('bountiful-equipment-flow:actual-original-occurrence-required')
  for(let dieIndex=0;dieIndex<stage.originalReady.values.length;dieIndex++){
   current=await read()
   if(stage.originalReady.finalizedDice.includes(dieIndex)||current.first.postOriginalD20?.some(row=>row.readyOrdinal===stage.originalReady.ordinal&&row.dieIndex===dieIndex))continue
   const parent={parentId:input.action.id,sourceOccurrence:origin.identity.occurrence,dieIndex,rawRollId:input.source.hostOriginalRollId}
   const adopted=await ui.confirmSelfReroll({rollId:bountifulDeferredD20RequestId(parent.parentId,parent.rawRollId,parent.sourceOccurrence,dieIndex),originalValue:stage.originalReady.values[dieIndex],dieIndex,ready:stage.originalReady,bountifulParent:parent})
   current=await read()
   const fact=current.first.postOriginalD20?.find(row=>row.readyOrdinal===stage.originalReady.ordinal&&row.dieIndex===dieIndex)
   if(fact?fact.selectedValue!==adopted:adopted!==stage.originalReady.values[dieIndex])throw Error('bountiful-equipment-flow:authenticated-self-reroll-required')
  }
 }
 const gear=await driveBountifulEquipmentContinuation({mapId:input.action.mapId,parentId:input.action.id},gateway,ui.equipment)
 current=await read()
 const receipts:readonly BountifulOriginalDieReceipt[]=current.receipts
 return {...stage,retainedDice:gear.retainedDice,originalReady:gear.ready,previewState:gear.previewState,previewCharacter:gear.previewCharacter,equipmentReceipt:gear.receipt,receipts,
  hostOriginalD20Replay:bountifulPreparedReplayFacts({parentId:input.action.id,source:stage.originalSource,receipts})}
}
