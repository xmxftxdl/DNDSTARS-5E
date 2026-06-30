import {
  emptyCombatInterruptQueue,
  type SharedCombatInterruptQueueState,
} from './combatInterruptQueue'
import type {
  SharedAgileLeapState,
  SharedCombatLogState,
  SharedDiceEventsState,
  SharedDodgeState,
  SharedGaleComboState,
  SharedPlayerActionAckState,
  SharedPlayerActionProcessedState,
  SharedPlayerActionRequestQueueState,
  SharedPlayerActionState,
  SharedStableMindState,
} from './sharedCombatTypes'

export interface CombatMessageQueueResetState {
  interruptQueue: SharedCombatInterruptQueueState
  diceEvents: SharedDiceEventsState
  dodge: SharedDodgeState
  stableMind: SharedStableMindState
  galeCombo: SharedGaleComboState
  agileLeap: SharedAgileLeapState
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
    dodge: {
      id: `${mapId}:combat-start:dodge:${updatedAt}`,
      mapId,
      status: 'done',
      result: { moved: false, attacked: false, message: 'cleared' },
      targetCharId: '',
      updatedAt,
    },
    stableMind: {
      id: `${mapId}:combat-start:stable-mind:${updatedAt}`,
      mapId,
      status: 'done',
      targetCharId: '',
      targetName: '',
      fullDamage: 0,
      damageAfterSave: 0,
      saveD20: 0,
      saveMod: 0,
      saveTotal: 0,
      dc: 0,
      updatedAt,
    },
    galeCombo: {
      id: `${mapId}:combat-start:gale-combo:${updatedAt}`,
      mapId,
      status: 'done',
      casterCharId: '',
      casterName: '',
      triggerLabel: '',
      updatedAt,
    },
    agileLeap: {
      id: `${mapId}:combat-start:agile-leap:${updatedAt}`,
      mapId,
      status: 'done',
      targetCharId: '',
      targetName: '',
      feet: 0,
      uses: 0,
      maxUses: 0,
      updatedAt,
    },
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
