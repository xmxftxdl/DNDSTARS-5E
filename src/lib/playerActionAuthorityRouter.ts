import type { BattleMap, Token } from '../store/maps'
import type { ClassFeatureKey } from './traitRegistry'

export const PLAYER_ACTION_DEDUPE_WINDOW_MS = 8000

export type PlayerActionAuthorityRejectReason =
  | 'stale-combat'
  | 'combat-ended'
  | 'stale-turn'
  | 'duplicate-action'

export interface PlayerActionAuthorityAction {
  id: string
  mapId: string
  combatId?: string
  status: 'pending' | 'done'
  type: string
  actorTokenId: string
  characterId: string
  round: number
  initiativeIndex: number
  featureKey?: ClassFeatureKey
}

export interface PlayerActionAuthorityPreflightContext {
  isDm: boolean
  activeMap?: BattleMap
  combatId?: string
  combatActive: boolean
  round: number
  initiativeIndex: number
  currentTokenId?: string
  processedActionIds: ReadonlySet<string>
  seenActionIds: ReadonlySet<string>
}

export type PlayerActionAuthorityPreflightResult =
  | { status: 'ignored' }
  | { status: 'rejected'; reason: PlayerActionAuthorityRejectReason }
  | { status: 'accepted'; currentToken: Token }

export function preflightPlayerActionAuthority(
  action: PlayerActionAuthorityAction,
  context: PlayerActionAuthorityPreflightContext,
): PlayerActionAuthorityPreflightResult {
  const map = context.activeMap
  if (!context.isDm || !map || action.mapId !== map.id || action.status !== 'pending') {
    return { status: 'ignored' }
  }

  if (!action.combatId || action.combatId !== context.combatId) {
    return { status: 'rejected', reason: 'stale-combat' }
  }

  const currentToken = map.tokens.find((token) => token.id === context.currentTokenId)
  if (!context.combatActive || !currentToken) {
    return { status: 'rejected', reason: 'combat-ended' }
  }

  if (context.processedActionIds.has(action.id) || context.seenActionIds.has(action.id)) {
    return { status: 'ignored' }
  }

  const validTurn =
    action.round === context.round &&
    action.initiativeIndex === context.initiativeIndex &&
    currentToken.id === action.actorTokenId &&
    currentToken.type === 'player' &&
    currentToken.characterId === action.characterId

  if (!validTurn) {
    return { status: 'rejected', reason: 'stale-turn' }
  }

  return { status: 'accepted', currentToken }
}

export function playerActionNeedsExecutionDedupe(action: Pick<PlayerActionAuthorityAction, 'type'>): boolean {
  return action.type === 'attack-token' || action.type === 'aoe-attack'
}

export function getPlayerActionExecutionKey(action: Pick<PlayerActionAuthorityAction, 'id'>): string {
  return action.id
}

export function reservePlayerActionExecution(
  action: PlayerActionAuthorityAction,
  recentActionKeys: Map<string, number>,
  options: { now?: number; windowMs?: number } = {},
): boolean {
  if (!playerActionNeedsExecutionDedupe(action)) return true

  const now = options.now ?? Date.now()
  const windowMs = options.windowMs ?? PLAYER_ACTION_DEDUPE_WINDOW_MS
  for (const [key, at] of recentActionKeys) {
    if (now - at > windowMs) recentActionKeys.delete(key)
  }

  const key = getPlayerActionExecutionKey(action)
  if (recentActionKeys.has(key)) return false
  recentActionKeys.set(key, now)
  return true
}
