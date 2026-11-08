import type {SharedPlayerActionState,SharedCombatState} from '../../lib/sharedCombatTypes'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {Dnd5eDamageReactionFlowOptions} from './damageReactionFlow'
import {resolvePreparedDnd5eEquipmentAttack} from './equipmentAttackAction'
import {recordBountifulOriginalAfterDice,resolveBountifulOriginalForNormalAck} from './bountifulLuckNormalAck'
import {bountifulPreparedReplayFacts,type BountifulOriginalDieReceipt} from './bountifulLuckReceipt'
import {bountifulOriginalParentReceiptId} from './bountifulLuckPersistentHost'

type Source=Parameters<typeof resolvePreparedDnd5eEquipmentAttack>[0]
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
/** Concrete local Maps continuation. The actual original facade issues its
 * private continuation first; SC gets that exact original-die replay before
 * its own hit probe. The normal Bountiful resolver signs the live room action
 * only after real damage/reaction settlement. No state or success is adopted
 * from a caller, and no preliminary HP/inventory/reaction write occurs. */
export function createBountifulEquipmentMapBoundary(input:{action:SharedPlayerActionState;gateway:Gateway;options:Dnd5eDamageReactionFlowOptions;authorityUnchanged:()=>boolean}){
 return {
  async attachReplay(source:Source){
   await recordBountifulOriginalAfterDice({action:input.action,source,resolve:resolvePreparedDnd5eEquipmentAttack,authorityUnchanged:input.authorityUnchanged},input.gateway)
   const combat=await input.gateway.loadResource<SharedCombatState&{bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}>('combat')
   const first=combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(input.action.id,0)]
   if(!first||first.consumed||!input.authorityUnchanged())throw Error('bountiful-map-boundary:real-pending-parent-required')
   const receipts=Object.values(combat?.bountifulOriginalParents??{}).filter(row=>row.identity.parentId===input.action.id).sort((a,b)=>a.identity.occurrence-b.identity.occurrence)
   return {...source,hostOriginalD20Replay:bountifulPreparedReplayFacts({parentId:input.action.id,source,receipts})}
  },
  resolve(source:Source){
   return resolveBountifulOriginalForNormalAck({action:input.action,source,resolve:resolvePreparedDnd5eEquipmentAttack,options:input.options},input.gateway)
  },
 }
}
