import {
  DmActionTransactionCoordinator,
  type DmAuthoritativeActionOutcome,
} from '../../lib/dmActionTransactionCoordinator'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'

export interface RunMapsPlayerActionTransactionInput {
  coordinator: DmActionTransactionCoordinator
  action: SharedPlayerActionState
  run: () => Promise<void>
  waitForAuthorityCommit: () => Promise<void>
  readOutcome: (actionId: string) => DmAuthoritativeActionOutcome | undefined
  clearOutcome: (actionId: string) => void
  setTransactionActive: (active: boolean, transactionId: string | null) => void
  recover: (error: unknown) => Promise<void>
  now?: number
}

/**
 * MapsPage 的唯一 DM 玩家行动入口。这里统一串行化、CombatTransaction
 * 生命周期、共享快照提交等待和异常恢复，具体规则分支只负责 prepare/resolve。
 */
export function runMapsPlayerActionTransaction(input: RunMapsPlayerActionTransactionInput): Promise<void> {
  const { action } = input
  return input.coordinator.enqueueCombatTransaction(
    {
      id: action.id,
      mapId: action.mapId,
      combatId: action.combatId,
      actorId: action.characterId ?? action.actorTokenId,
      actionId: action.id,
      actionKind: action.type,
      now: input.now,
    },
    async () => {
      // Only the invocation that actually owns the coordinator slot may clear
      // an earlier result. A coalesced SSE replay must not erase the outcome
      // while the first delivery is waiting for its authority commit barrier.
      input.clearOutcome(action.id)
      input.setTransactionActive(true, action.id)
      try {
        await input.run()
        await input.waitForAuthorityCommit()
        const outcome = input.readOutcome(action.id)
        if (!outcome) throw new Error('missing-player-action-authority-outcome')
        input.clearOutcome(action.id)
        return outcome
      } finally {
        input.setTransactionActive(false, null)
      }
    },
    async (error) => {
      input.setTransactionActive(false, null)
      input.clearOutcome(action.id)
      await input.recover(error)
    },
  )
}
