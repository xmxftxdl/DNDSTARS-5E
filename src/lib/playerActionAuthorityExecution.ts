import type { SharedPlayerActionState } from './sharedCombatTypes'
import {
  preflightPlayerActionAuthority,
  reservePlayerActionExecution,
  type PlayerActionAuthorityPreflightContext,
  type PlayerActionAuthorityRejectReason,
} from './playerActionAuthorityRouter'
import { isSimpleHeadlessPlayerActionType } from './simpleHeadlessPlayerAction'

export type PlayerActionAuthorityRoute =
  | 'activate-feature'
  | 'simple'
  | 'attack-token'
  | 'aoe-attack'
  | 'move-token'
  | 'unsupported'

export type PlayerActionAuthorityExecutionPlan =
  | { status: 'ignored' }
  | { status: 'rejected'; reason: PlayerActionAuthorityRejectReason | 'duplicate-action' }
  | { status: 'accepted'; route: PlayerActionAuthorityRoute }

export function playerActionAuthorityRoute(action: Pick<SharedPlayerActionState, 'type'>): PlayerActionAuthorityRoute {
  if (action.type === 'activate-feature') return 'activate-feature'
  if (isSimpleHeadlessPlayerActionType(action.type)) return 'simple'
  if (action.type === 'attack-token') return 'attack-token'
  if (action.type === 'aoe-attack') return 'aoe-attack'
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
