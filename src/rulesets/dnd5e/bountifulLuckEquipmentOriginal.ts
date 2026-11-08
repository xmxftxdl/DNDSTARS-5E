import {createDnd5eOriginalD20Session} from './damageCommitSession'
import {cloneDnd5eHostTransactionInput} from './hostTransactionClone'
import type {SharedPlayerActionState,SharedCombatState} from '../../lib/sharedCombatTypes'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import {resolvePreparedDnd5eEquipmentAttack} from './equipmentAttackAction'
import {dnd5eAllyNaturalOneOptions} from './headlessCombatEngine'
import {getRoomSession} from '../../lib/roomSession'
import {bountifulOriginalParentReceiptId,persistBountifulOriginalParent} from './bountifulLuckPersistentHost'
import {driveBountifulOriginalParent,readBountifulOriginalSource} from './bountifulLuckPersistentRoomDriver'
import {bountifulPreparedReplayFacts,type BountifulOriginalDieReceipt} from './bountifulLuckReceipt'

type Source=Parameters<typeof resolvePreparedDnd5eEquipmentAttack>[0]
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
type UI=Parameters<typeof driveBountifulOriginalParent>[2]
/** Concrete equipment parent entry for Maps: called with retained raw faces
 * before UI hit previews or damage dice. Returns separate preview faces;
 * the raw d20 fields are never rewritten to the replacement result. */
export async function beginBountifulEquipmentOriginal(input:{action:SharedPlayerActionState;source:Source},gateway:Gateway,ui:UI){
 const host=getRoomSession()
 if(!host||host.role!=='dm')throw Error('bountiful-equipment:host-required')
 const combat=await gateway.loadResource<SharedCombatState&{bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}>('combat')
 const prior=combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(input.action.id,0)]
 let source=cloneDnd5eHostTransactionInput(input.source)
 if(prior){
  if(prior.originalAdapterId!=='equipment'||prior.identity.roller.tokenId!==input.action.actorTokenId||prior.identity.roomId!==host.roomId||prior.identity.hostMemberId!==host.memberId)throw Error('bountiful-equipment:wrong-private-parent')
  // Only the actual equipment facade can issue this private input. The driver
  // below rechecks queue identity, geometry, owners and original revisions.
  const original=await readBountifulOriginalSource(prior)
  source=original.source as Source
 }else{
  if(![source.d20,source.d20Second].includes(1))return undefined
  const state=structuredClone(source.prepared.state)
  for(const actor of Object.values(state.combatants)){
   const economy=combat?.dnd5eTurnEconomyByToken?.[actor.id]
   const active=state.initiativeOrder[state.initiativeIndex]===actor.id
   const slot=state.initiativeSlotIds?.[state.initiativeIndex]??actor.id
   if(economy&&(!active||economy.turnKey===state.combatId+':'+state.round+':'+slot))actor.turn.reactionAvailable=economy.reaction.current>0
  }
  const raw=source.d20Second==null?[source.d20]:[source.d20,source.d20Second]
  const qualified=raw.some((value,dieIndex)=>value===1&&dnd5eAllyNaturalOneOptions(state,{actorId:input.action.actorTokenId,kind:'attack',originalRolls:raw,dieIndex}).length>0)
  if(!qualified)return undefined // Preserve the existing no-feat/native Lucky path.
  // Protection and other pre-original mechanics can spend a potential owner's
  // reaction. Probe the real facade, not merely the published token snapshot.
  const actualSource=cloneDnd5eHostTransactionInput(source)
  actualSource.prepared.state=state
  const probe=createDnd5eOriginalD20Session(actualSource,resolvePreparedDnd5eEquipmentAttack,input.action.actorTokenId,'attack')
  let pending:ReturnType<typeof probe.run>
  try{pending=probe.run(state)}finally{probe.cancel()}
  if(pending.status!=='pending-ally-natural-one')return undefined
  if(pending.occurrence!==0)throw Error('bountiful-equipment:unexpected-original-occurrence')
  await persistBountifulOriginalParent({parentId:input.action.id,source,resolve:resolvePreparedDnd5eEquipmentAttack,actorId:input.action.actorTokenId,kind:'attack'},gateway)
 }
 const stage=await driveBountifulOriginalParent({mapId:input.action.mapId,parentId:input.action.id},gateway,ui)
 return {originalReady:structuredClone(stage.request),originalSource:source,rawDice:source.d20Second==null?[source.d20]:[source.d20,source.d20Second],retainedDice:stage.request.values,
  previewState:stage.snapshot,receipts:stage.receipts,hostOriginalD20Replay:bountifulPreparedReplayFacts({parentId:input.action.id,source,receipts:stage.receipts})}
}
