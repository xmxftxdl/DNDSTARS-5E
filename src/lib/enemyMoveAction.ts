import type { Token } from '../store/maps'
import type {
  HeadlessCombatEvent,
  HeadlessCombatFailureReason,
  HeadlessCombatResult,
  HeadlessEnemyMoveAction,
} from './headlessDmCombatEngine'
import { apSpentEvent } from './headlessCombatEvents'

export function buildEnemyMoveAction(input: {
  enemy: Token
  targetPosition: { x: number; y: number }
  apCost: number
}): HeadlessEnemyMoveAction {
  return {
    type: 'enemy-move-token',
    actorTokenId: input.enemy.id,
    targetPosition: input.targetPosition,
    apCost: input.apCost,
  }
}

export type EnemyMoveSettlementPlan =
  | {
      status: 'rejected'
      log: { text: string; kind: 'system' }
      reason: HeadlessCombatFailureReason
    }
  | {
      status: 'accepted'
      log?: { text: string; kind: 'turn' }
    }

export function planEnemyMoveSettlement(input: {
  result: HeadlessCombatResult
  enemy: Token
  actionLabel: string
  fallbackApMax: number
}): EnemyMoveSettlementPlan {
  if (!input.result.ok) {
    return {
      status: 'rejected',
      reason: input.result.reason,
      log: {
        text: `${input.enemy.label} ${input.actionLabel}失败：${input.result.reason}`,
        kind: 'system',
      },
    }
  }

  const moved = tokenMovedEvent(input.result.events, input.enemy.id)
  const apEvent = apSpentEvent(input.result.events, { tokenId: input.enemy.id, characterId: null })
  if (!apEvent) return { status: 'accepted' }

  const ap = input.result.state.enemyApByToken[input.enemy.id] ?? {
    current: apEvent.after,
    max: input.fallbackApMax,
  }
  return {
    status: 'accepted',
    log: {
      text: `${input.enemy.label} 花费 ${apEvent.amount} AP：${input.actionLabel}${
        moved ? ` ${moved.feet} 尺` : ''
      }。剩余 AP ${ap.current}/${ap.max}`,
      kind: 'turn',
    },
  }
}

function tokenMovedEvent(
  events: HeadlessCombatEvent[],
  tokenId: string,
): Extract<HeadlessCombatEvent, { type: 'token-moved' }> | undefined {
  return events.find(
    (event): event is Extract<HeadlessCombatEvent, { type: 'token-moved' }> =>
      event.type === 'token-moved' && event.tokenId === tokenId,
  )
}
