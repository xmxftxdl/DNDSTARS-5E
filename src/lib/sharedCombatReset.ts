import {
  emptyCombatInterruptQueue,
  type SharedCombatInterruptQueueState,
} from './combatInterruptQueue'
import type {
  SharedCombatLogState,
  SharedDiceEventsState,
  SharedPlayerActionAckState,
  SharedPlayerActionProcessedState,
  SharedPlayerActionRequestQueueState,
  SharedPlayerActionState,
} from './sharedCombatTypes'

export interface CombatMessageQueueResetState {
  interruptQueue: SharedCombatInterruptQueueState
  diceEvents: SharedDiceEventsState
  playerAction: SharedPlayerActionState
  playerActionRequests: SharedPlayerActionRequestQueueState
  playerActionProcessed: SharedPlayerActionProcessedState
  playerActionAck: SharedPlayerActionAckState
  combatLog?: SharedCombatLogState
}

export function buildCombatMessageQueueReset(input: {
  mapId: string
  combatId: string
  updatedAt: number
  clearCombatLog?: boolean
}): CombatMessageQueueResetState {
  const { mapId, combatId, updatedAt } = input
  return {
    interruptQueue: emptyCombatInterruptQueue(mapId, updatedAt),
    diceEvents: { mapId, events: [], updatedAt },
    playerAction: {
      id: `${mapId}:combat-start:player-action:${updatedAt}`,
      mapId,
      combatId,
      sourceMode: 'player',
      status: 'done',
      type: 'end-turn',
      actorTokenId: '',
      characterId: '',
      round: 1,
      initiativeIndex: 0,
      seq: 0,
      updatedAt,
    },
    playerActionRequests: {
      mapId,
      combatId,
      requests: [],
      updatedAt,
    },
    playerActionProcessed: {
      mapId,
      combatId,
      actionIds: [],
      updatedAt,
    },
    playerActionAck: {
      id: `${mapId}:combat-start:player-action-ack:${updatedAt}`,
      mapId,
      combatId,
      actionId: '',
      status: 'accepted',
      round: 1,
      initiativeIndex: 0,
      updatedAt,
    },
    combatLog: input.clearCombatLog ? { mapId, entries: [], updatedAt } : undefined,
  }
}
