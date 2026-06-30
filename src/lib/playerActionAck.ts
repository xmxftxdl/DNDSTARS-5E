import type {
  SharedPlayerActionAckState,
  SharedPlayerActionProcessedState,
  SharedPlayerActionState,
} from './sharedCombatTypes'
import {
  summarizePlayerActionResult,
  type PlayerActionResultBaseline,
} from './playerActionResult'

export const PLAYER_ACTION_QUEUE_LIMIT = 80

export interface BuildPlayerActionAckInput {
  action: SharedPlayerActionState
  status: SharedPlayerActionAckState['status']
  mapId: string
  combatId?: string
  round: number
  initiativeIndex: number
  appliedAt: number
  reason?: string
  acceptedPosition?: { x: number; y: number }
  before?: PlayerActionResultBaseline
  after?: PlayerActionResultBaseline
}

export function buildPlayerActionAck(input: BuildPlayerActionAckInput): SharedPlayerActionAckState {
  const result =
    input.status === 'accepted' && input.before && input.after
      ? summarizePlayerActionResult(input.action, input.before, input.after)
      : undefined

  return {
    id: `${input.action.id}:ack:${input.appliedAt}`,
    mapId: input.mapId,
    combatId: input.combatId,
    actionId: input.action.id,
    status: input.status,
    reason: input.reason,
    acceptedPosition: input.acceptedPosition,
    appliedAt: input.status === 'accepted' ? input.appliedAt : undefined,
    result,
    round: input.round,
    initiativeIndex: input.initiativeIndex,
    updatedAt: input.appliedAt,
  }
}

export function buildPlayerActionProcessedState(input: {
  action: SharedPlayerActionState
  current?: SharedPlayerActionProcessedState | null
  updatedAt: number
  queueLimit?: number
}): SharedPlayerActionProcessedState {
  const queueLimit = input.queueLimit ?? PLAYER_ACTION_QUEUE_LIMIT
  const current = input.current
  const currentIds =
    current && current.combatId === input.action.combatId ? current.actionIds : []
  const actionIds = [...new Set([...currentIds, input.action.id])].slice(-queueLimit * 3)

  return {
    mapId: input.action.mapId,
    combatId: input.action.combatId,
    actionIds,
    updatedAt: input.updatedAt,
  }
}
