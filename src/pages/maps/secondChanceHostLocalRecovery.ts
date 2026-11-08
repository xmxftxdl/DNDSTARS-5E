import { getRoomSession } from '../../lib/roomSession'
import type { SharedRoomGatewayPort } from '../../ports/sharedRoomGateway'
import type { SecondChanceCombat } from './secondChanceHostCommit'
import { activeSecondChanceParentReceipt, secondChanceParentGroup } from './secondChanceParentGroup'
import { secondChanceParentScopeMatches, assertSecondChanceSceneScope } from './secondChanceParentScope'
import { driveSecondChancePersistentRoomParent, type SecondChancePersistentRoomUI } from './secondChancePersistentRoomDriver'
import { SecondChanceMapsSettlementSignal, verifySecondChanceMapsSettlement, type SecondChanceMapsSettlement } from './secondChanceMapsSettlement'
import { validateSecondChanceAttackReceipts } from '../../../shared/second-chance-state.mjs'

type Gateway = Pick<SharedRoomGatewayPort, 'loadResource' | 'saveResourcesAtomically'>
/** Resume only a previously issued Host parent. The original driver still owns
 * preparation, reaction cost and the single final parent transaction. */
export async function resumeSecondChanceHostLocalParent(
 input: { mapId: string; parentTransactionId: string }, gateway: Gateway, ui: SecondChancePersistentRoomUI,
): Promise<SecondChanceMapsSettlement> {
 const session = getRoomSession()
 const guard = () => { const current = getRoomSession(); if (!session || session.role !== 'dm' || current?.role !== 'dm' || current.roomId !== session.roomId || current.memberId !== session.memberId) throw Error('second-chance-host-recovery:host-room-required') }
 guard()
 const combat = await gateway.loadResource<SecondChanceCombat>('combat'); guard()
 if (!combat || !validateSecondChanceAttackReceipts(combat.secondChanceAttacks ?? {})) throw Error('second-chance-host-recovery:invalid-receipts')
 const group = secondChanceParentGroup(combat, input.parentTransactionId)
 const receipt = activeSecondChanceParentReceipt(group)
 if (!receipt || receipt.hostControllerMemberId !== session!.memberId || receipt.originalRoomAction || !group.every(row => secondChanceParentScopeMatches(combat, row, input.mapId))) throw Error('second-chance-host-recovery:local-parent-required')
 const parent = receipt.parentInput
 if (!parent || !!parent.action === !!parent.prepared) throw Error('second-chance-host-recovery:original-parent-required')
 await assertSecondChanceSceneScope(receipt,combat,gateway);guard()
 try {
  await driveSecondChancePersistentRoomParent({ ...input, action: parent.action, state: parent.state, nativeContext: parent.nativeContext, options: parent.options, preparedOriginal: parent.prepared }, gateway, ui)
 } catch (error) {
  if (!(error instanceof SecondChanceMapsSettlementSignal)) throw error
  return verifySecondChanceMapsSettlement({ settlement: error.settlement, ...input, combatId: receipt.sceneScope ? undefined : receipt.attack.combatId }, gateway)
 }
 throw Error('second-chance-host-recovery:missing-settlement')
}
