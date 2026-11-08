import{withBountifulMonsterZeroPrivateSource,processBountifulMonsterZeroQueuedResponse}from'./bountifulMonsterZeroQueuedResponse'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
import{BountifulOriginalParentPending}from'./bountifulLuckPersistentRoomDriver'
import{bountifulOriginalDiePhase,type BountifulOriginalDieReceipt}from'./bountifulLuckReceipt'
import{recoverBountifulMonsterZeroOriginal}from'./bountifulMonsterZeroRecovery'
import{readBountifulMonsterZeroOriginalReady,issueNextBountifulMonsterZeroOriginal}from'./bountifulMonsterZeroPersistentParent'
import type{BountifulMonsterDamageZeroOriginalRawLoader}from'./bountifulMonsterDamageZeroOriginalRaw'
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'|'publishEvent'>
type UI={nativeLuckyChoiceVersion?:1;showChoice:(receipt:BountifulOriginalDieReceipt)=>Promise<void>;requestRoll:(receipt:BountifulOriginalDieReceipt,refresh:()=>Promise<BountifulOriginalDieReceipt>)=>Promise<void>}
/** The same authenticated owner and physical-roll UI drives this distinct
 * original family. It cannot substitute a caller source or decision. */
export async function driveBountifulMonsterZeroOriginal(parentId:string,gateway:Gateway,load:BountifulMonsterDamageZeroOriginalRawLoader,ui:UI){
  async function refresh(occurrence?:number){
  const queue=await gateway.loadResource<{requests?:readonly{id:string;type:string;status:string;mapId:string;bountifulLuck?:{parentId:string}}[]}>('player-action-requests')
  for(const action of queue?.requests??[])if(action.status==='pending'&&action.type==='dnd5e-bountiful-luck'&&action.bountifulLuck?.parentId===parentId){await processBountifulMonsterZeroQueuedResponse({mapId:action.mapId,requestId:action.id},gateway,load)}
   return withBountifulMonsterZeroPrivateSource(parentId,async()=>{
   const original=await recoverBountifulMonsterZeroOriginal(parentId,gateway,load)
   const combat=await gateway.loadResource<{bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}>('combat'),rows=Object.values(combat?.bountifulOriginalParents??{}).filter(row=>row.identity.parentId===parentId).sort((a,b)=>a.identity.occurrence-b.identity.occurrence),receipt=occurrence===undefined?(rows.find(row=>!['ready','declined'].includes(bountifulOriginalDiePhase(row)))??rows.at(-1)):rows.find(row=>row.identity.occurrence===occurrence)
  if(!receipt||receipt.consumed)throw Error('monster-zero-driver:protected-original-required')
  return{...original,receipt}
  })
 }
 for(let attempt=0;attempt<128;attempt++){
   let current=await refresh()
   try{const ready=await readBountifulMonsterZeroOriginalReady(current.qualification,current.source,gateway);return{...ready,qualification:current.qualification,originalSource:current.source}}catch(error){if(!(error instanceof Error))throw error;if(error.message==='monster-zero-parent:next-actual-receipt-required'){const next=await issueNextBountifulMonsterZeroOriginal(current.qualification,current.source,gateway,{nativeLuckyChoiceVersion:ui.nativeLuckyChoiceVersion});if(!next)throw Error('monster-zero-driver:actual-next-required');current=await refresh(next.identity.occurrence)}else if(error.message!=='bountiful-parent:decision-still-pending')throw error}
  const receipt=current.receipt,phase=bountifulOriginalDiePhase(receipt)
  if(phase==='native-lucky-choice')throw new BountifulOriginalParentPending(parentId,receipt.identity.occurrence)
  if(phase==='owner-choice')await ui.showChoice(receipt)
  else if(phase==='roller'||phase==='host-confirmation')await ui.requestRoll(receipt,async()=>(await refresh(receipt.identity.occurrence)).receipt)
  else throw Error('monster-zero-driver:actual-next-original-required')
  const after=await refresh(receipt.identity.occurrence)
  if(JSON.stringify(after.receipt)===JSON.stringify(receipt))throw new BountifulOriginalParentPending(parentId,receipt.identity.occurrence)
 }
 throw Error('monster-zero-driver:original-phase-limit')
}
