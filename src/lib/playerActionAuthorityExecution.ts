import type { SharedPlayerActionState } from './sharedCombatTypes'
import {
  preflightPlayerActionAuthority,
  reservePlayerActionExecution,
  type PlayerActionAuthorityPreflightContext,
  type PlayerActionAuthorityRejectReason,
} from './playerActionAuthorityRouter'

export type PlayerActionAuthorityRoute =
  | 'end-turn'
  | 'dnd5e-death-save'
  | 'disengage'
  | 'dnd5e-weapon-attack'
  | 'dnd5e-fighter-feature'
  | 'dnd5e-class-feature'
  | 'dnd5e-plugin-action'
  | 'dnd5e-item-use'
  | 'dnd5e-ability-check'
  | 'dnd5e-spell-cast'
  | 'dnd5e-adjudicated-spell'
  | 'dnd5e-map-interaction'
  | 'move-token'
  | 'unsupported'

export type PlayerActionAuthorityExecutionPlan =
  | { status: 'ignored' }
  | { status: 'rejected'; reason: PlayerActionAuthorityRejectReason | 'duplicate-action' }
  | { status: 'accepted'; route: PlayerActionAuthorityRoute }

export function playerActionAuthorityRoute(action: Pick<SharedPlayerActionState, 'type'>): PlayerActionAuthorityRoute {
  if (action.type === 'end-turn') return 'end-turn'
  if (action.type === 'dnd5e-death-save') return 'dnd5e-death-save'
  if (action.type === 'disengage') return 'disengage'
  if (action.type === 'dnd5e-weapon-attack') return 'dnd5e-weapon-attack'
  if (action.type === 'dnd5e-fighter-feature') return 'dnd5e-fighter-feature'
  if (action.type === 'dnd5e-class-feature') return 'dnd5e-class-feature'
  if (action.type === 'dnd5e-plugin-action') return 'dnd5e-plugin-action'
  if (action.type === 'dnd5e-item-use') return 'dnd5e-item-use'
  if (action.type === 'dnd5e-ability-check') return 'dnd5e-ability-check'
  if (action.type === 'dnd5e-spell-cast') return 'dnd5e-spell-cast'
  if (action.type === 'dnd5e-adjudicated-spell') return 'dnd5e-adjudicated-spell'
  if (action.type === 'dnd5e-map-interaction') return 'dnd5e-map-interaction'
  if (action.type === 'move-token') return 'move-token'
  return 'unsupported'
}

export function planPlayerActionAuthorityExecution(input: {
  action: SharedPlayerActionState
  preflight: PlayerActionAuthorityPreflightContext
  recentActionKeys: Map<string, number>
  now?: number
}): PlayerActionAuthorityExecutionPlan {
  const preflight = preflightPlayerActionAuthority(input.action, input.preflight)
  if (preflight.status !== 'accepted') return preflight

  if (!reservePlayerActionExecution(input.action, input.recentActionKeys, { now: input.now })) {
    return { status: 'ignored' }
  }

  return { status: 'accepted', route: playerActionAuthorityRoute(input.action) }
}
