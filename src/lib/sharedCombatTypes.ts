import type { InitiativeEntry } from '../components/map/InitiativeTracker'
import type { DiceRoll } from '../components/DiceRollOverlay'
import type { ClassFeatureKey } from '../types/character'
import type { GridCell } from './gridCombat'
import type { PlayerActionResultSummary } from './playerActionResult'

// Shared DM/player state contracts transported through sharedApi.
// Keep these runtime-free so UI, sync helpers, and headless services can depend
// on the same protocol types without importing page modules.
export type Mode = 'dm' | 'player'

export interface SharedCombatState {
  mapId: string
  combatId?: string
  active: boolean
  round: number
  initiativeIndex: number
  initiativeOrder: InitiativeEntry[]
  enemyApByToken?: Record<string, { current: number; max: number }>
  updatedAt: number
}

export interface SharedPlayerActionState {
  id: string
  mapId: string
  combatId?: string
  sourceMode: 'player' | 'dm'
  status: 'pending' | 'done'
  type:
    | 'end-turn'
    | 'attack-token'
    | 'aoe-attack'
    | 'move-token'
    | 'disengage'
    | 'use-skill'
    | 'agile-leap-move'
    | 'skill-free-move'
    | 'calm-spirit-move'
    | 'qi-reduce-cooldown'
    | 'class-resource-action'
    | 'calm-spirit'
    | 'activate-feature'
    | 'bullet-match-swap'
  actorTokenId: string
  characterId: string
  targetTokenId?: string
  targetTokenIds?: string[]
  targetCell?: GridCell
  targetPosition?: { x: number; y: number }
  aoeRectRotation?: number
  skillId?: string
  classResource?: {
    key: string
    amount: number
    operation: 'reduce-skill-cooldown'
  }
  featureKey?: ClassFeatureKey
  calmSpiritEffect?: 'move' | 'crit' | 'cooldown' | 'extraTurn'
  bulletSwap?: { from: number; to: number; seed: number }
  round: number
  initiativeIndex: number
  seq: number
  updatedAt: number
}

export interface SharedPlayerActionRequestQueueState {
  mapId?: string
  combatId?: string
  requests: SharedPlayerActionState[]
  updatedAt: number
}

export interface SharedPlayerActionProcessedState {
  mapId?: string
  combatId?: string
  actionIds: string[]
  updatedAt: number
}

export interface SharedPlayerActionAckState {
  id: string
  mapId: string
  combatId?: string
  actionId: string
  status: 'accepted' | 'rejected'
  reason?: string
  acceptedPosition?: { x: number; y: number }
  appliedAt?: number
  result?: PlayerActionResultSummary
  round: number
  initiativeIndex: number
  updatedAt: number
}

export interface SharedDiceState {
  id: string
  mapId: string
  sourceMode: Mode
  status?: 'rolling' | 'result'
  kind?: 'd20' | 'dice'
  count?: number
  sides?: number
  values?: number[]
  flyIndex?: number
  label?: string
  targetName?: string
  roll?: DiceRoll
  updatedAt: number
}

export interface SharedDiceEventsState {
  mapId: string
  events: SharedDiceState[]
  updatedAt: number
}

// Result-broadcast path. DM emits one roll-request carrying the already-decided
// values; each end renders the same terminal face from `values`.
export interface SharedRollRequestEvent {
  eventId: string
  mapId: string
  sourceMode: Mode
  requestId: string
  kind: 'd20' | 'dice'
  count: number
  sides: number
  values: number[]
  label: string
  targetName: string
  updatedAt: number
}

export type SharedRollRequestPayload = Omit<
  SharedRollRequestEvent,
  'eventId' | 'mapId' | 'sourceMode' | 'updatedAt'
>

export interface SharedCombatLogState {
  mapId: string
  entries: CombatLogEntry[]
  updatedAt: number
}

export type StatusType = 'burning' | 'poison'

export interface CombatLogEntry {
  id: number
  round: number
  text: string
  kind: 'system' | 'turn' | 'attack' | 'damage'
  time: string
}
