import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import {BountifulOriginalParentPending} from './bountifulLuckPersistentRoomDriver'
import {bountifulOriginalDiePhase,type BountifulOriginalDieReceipt} from './bountifulLuckReceipt'
import {processBountifulHostOperationChoice,recoverBountifulHostOperation,readBountifulHostMonsterOriginalStage,persistBountifulHostNextOriginal} from './bountifulHostOperationPersistent'

type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'|'publishEvent'>
/** Drives the concrete native facade's protected original. There is no player
 * action pretending to be the statblock command, and no early HP publication.
 * The same real room UI used for ordinary originals supplies choice and dice. */
export async function driveBountifulHostMonsterOriginal(parentId:string,gateway:Gateway,ui:{showChoice:(receipt:BountifulOriginalDieReceipt)=>Promise<void>;requestRoll:(receipt:BountifulOriginalDieReceipt,refresh:()=>Promise<BountifulOriginalDieReceipt>)=>Promise<void>}){
 async function refresh(occurrence=0){
  await recoverBountifulHostOperation(parentId,gateway)
  const queue=await gateway.loadResource<{requests?:readonly {id:string;type:string;status:string;bountifulLuck?:{parentId:string}}[]}>('player-action-requests')
  for(const row of queue?.requests??[])if(row.status==='pending'&&row.type==='dnd5e-bountiful-luck'&&row.bountifulLuck?.parentId===parentId)await processBountifulHostOperationChoice(row.id,gateway)
  await recoverBountifulHostOperation(parentId,gateway)
  const combat=await gateway.loadResource<{bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}>('combat')
  const receipt=combat?.bountifulOriginalParents?.[JSON.stringify(['bountiful-original-parent',parentId,occurrence])]
  if(!receipt||receipt.consumed)throw Error('bountiful-native-driver:protected-original-required')
  return receipt
 }
 for(let attempt=0;attempt<128;attempt++){
  await refresh()
  const stage=await readBountifulHostMonsterOriginalStage(parentId,gateway)
  if(stage.status==='original-d20-ready')return stage
  if(stage.status==='pending-record'){await persistBountifulHostNextOriginal(parentId,gateway);continue}
  const receipt=stage.receipt,phase=bountifulOriginalDiePhase(receipt)
  if(phase==='owner-choice')await ui.showChoice(receipt)
  else if(phase==='roller'||phase==='host-confirmation')await ui.requestRoll(receipt,()=>refresh(receipt.identity.occurrence))
  else throw Error('bountiful-native-driver:unexpected-original-phase')
  const after=await refresh(receipt.identity.occurrence)
  if(JSON.stringify(after)===JSON.stringify(receipt))throw new BountifulOriginalParentPending(parentId,receipt.identity.occurrence)
 }
 throw Error('bountiful-native-driver:original-phase-limit')
}
