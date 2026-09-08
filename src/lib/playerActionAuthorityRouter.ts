import type { BattleMap, Token } from '../store/maps'
import type { Character } from '../types/character'
import { isTokenAlive } from './combatTokens'
import type { PendingPlayerActionLock } from './playerActionSync'

export const PLAYER_ACTION_DEDUPE_WINDOW_MS = 8000

export type PlayerActionAuthorityRejectReason =
  | 'stale-combat'
  | 'combat-ended'
  | 'stale-turn'
  | 'invalid-action-origin'
  | 'character-owner-mismatch'
  | 'duplicate-action'

export interface PlayerActionAuthorityAction {
  id: string
  mapId: string
  combatId?: string
  roomMemberId?: string
  sourceMode: 'dm' | 'player'
  status: 'pending' | 'done'
  type: string
  actorTokenId: string
  characterId: string
  round: number
  initiativeIndex: number
}

export interface PlayerActionAuthorityPreflightContext {
  isDm: boolean
  activeMap?: BattleMap
  combatId?: string
  combatActive: boolean
  round: number
  initiativeIndex: number
  currentTokenId?: string
  /** Host-validated reaction caster allowed to act without becoming the current initiative Token. */
  authorizedOutOfTurnActorTokenId?: string
  characters: readonly Pick<Character, 'id' | 'roomMemberId'>[]
  /**
   * Local table/dev mode has no room identity service. It may accept an action
   * only when both sides are genuinely unowned; a partially supplied or
   * mismatched identity remains fail-closed.
   */
  allowUnownedLegacySession?: boolean
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

  if (action.sourceMode !== 'player') {
    return { status: 'rejected', reason: 'invalid-action-origin' }
  }

  const actorToken = map.tokens.find((token) => token.id === action.actorTokenId)
  const controllingTokenId = actorToken?.dnd5eCombatState?.spellControlledByActorId
  const controllingToken = controllingTokenId
    ? map.tokens.find((token) => token.id === controllingTokenId)
    : undefined
  const effectiveCharacterId = controllingToken?.characterId ?? actorToken?.characterId
  if (
    !actorToken || (!actorToken.characterId && !controllingToken?.characterId) ||
    effectiveCharacterId !== action.characterId ||
    (actorToken.type !== 'player' && !controllingToken)
  ) return { status: 'rejected', reason: 'stale-turn' }

  const actorCharacter = context.characters.find((character) => character.id === action.characterId)
  if (!actorCharacter) return { status: 'rejected', reason: 'stale-turn' }
  // 玩家行动必须携带可核验的房间身份；旧角色缺少归属信息时不能退化成
  // “任何房间成员都可操作”，而应交给 DM 的归属修复流程。
  const localUnownedCharacter =
    context.allowUnownedLegacySession === true &&
    !actorCharacter.roomMemberId &&
    !action.roomMemberId
  if (!localUnownedCharacter && (
    !actorCharacter.roomMemberId ||
    !action.roomMemberId ||
    action.roomMemberId !== actorCharacter.roomMemberId
  )) {
    return { status: 'rejected', reason: 'character-owner-mismatch' }
  }

  if (action.type === 'dnd5e-spell-whisper-reply') {
    // Message grants an immediate reply to the target, even when it is not that
    // creature's initiative turn. The Host later validates the exact live,
    // single-use route and original cast identity.
    if (context.combatActive) {
      if (!action.combatId || action.combatId !== context.combatId) {
        return { status: 'rejected', reason: 'stale-combat' }
      }
    } else if (action.combatId) {
      return { status: 'rejected', reason: 'stale-combat' }
    }
    if (context.processedActionIds.has(action.id) || context.seenActionIds.has(action.id)) {
      return { status: 'ignored' }
    }
    return { status: 'accepted', currentToken: actorToken }
  }

  if (action.type === 'dnd5e-map-interaction') {
    if (context.processedActionIds.has(action.id) || context.seenActionIds.has(action.id)) {
      return { status: 'ignored' }
    }
    if (context.combatActive && actorToken.id !== context.currentTokenId) {
      return { status: 'rejected', reason: 'stale-turn' }
    }
    return { status: 'accepted', currentToken: actorToken }
  }

  if (action.type === 'move-token' && !context.combatActive) {
    // Exploration movement must be authored outside any combat snapshot. This
    // prevents a delayed packet from the previous initiative from moving a
    // Token after combat has ended.
    if (action.combatId) return { status: 'rejected', reason: 'stale-combat' }
    if (context.processedActionIds.has(action.id) || context.seenActionIds.has(action.id)) {
      return { status: 'ignored' }
    }
    return { status: 'accepted', currentToken: actorToken }
  }

  const explorationRulesAction =
    action.type === 'dnd5e-ability-check' ||
    action.type === 'dnd5e-spell-cast' ||
    action.type === 'dnd5e-adjudicated-spell' ||
    action.type === 'dnd5e-persistent-area-move' ||
    action.type === 'dnd5e-class-feature' ||
    action.type === 'dnd5e-plugin-action' ||
    action.type === 'dnd5e-item-use'
  if (explorationRulesAction && !context.combatActive) {
    // Exploration rules requests must be authored without a combat identity.
    // This prevents a delayed request from a previous initiative from being
    // reinterpreted as an out-of-combat cast after that combat has ended.
    if (action.combatId) return { status: 'rejected', reason: 'stale-combat' }
    if (context.processedActionIds.has(action.id) || context.seenActionIds.has(action.id)) {
      return { status: 'ignored' }
    }
    return { status: 'accepted', currentToken: actorToken }
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
    (currentToken.type === 'player' || !!currentToken.dnd5eCombatState?.spellControlledByActorId) &&
    (map.tokens.find((token) =>
      token.id === currentToken.dnd5eCombatState?.spellControlledByActorId)?.characterId ??
      currentToken.characterId) === action.characterId

  const validHostAuthorizedReaction =
    action.round === context.round &&
    action.initiativeIndex === context.initiativeIndex &&
    actorToken.id === context.authorizedOutOfTurnActorTokenId

  if (!validTurn && !validHostAuthorizedReaction) {
    return { status: 'rejected', reason: 'stale-turn' }
  }

  return { status: 'accepted', currentToken: validTurn ? currentToken : actorToken }
}

export function canSubmitPlayerCombatAction(input: {
  activeMap?: BattleMap
  mode?: 'dm' | 'player' | null
  playerCombatLocked: boolean
  combatActive: boolean
  combatActiveSnapshot: boolean
  turnCharacter?: Pick<Character, 'id'> | null
  currentInitiativeToken?: Token
  pendingAction?: PendingPlayerActionLock | null
  playerCharacter?: Pick<Character, 'id'> | null
  characters: Character[]
}): boolean {
  if (!input.activeMap || input.mode !== 'player') return false
  if (input.playerCombatLocked) return false
  if (!input.combatActiveSnapshot || !input.combatActive) return false
  if (!input.turnCharacter || !input.currentInitiativeToken) return false
  if (input.pendingAction) return false
  if (input.currentInitiativeToken.type !== 'player') return false
  if (input.currentInitiativeToken.characterId !== input.turnCharacter.id) return false
  if (input.turnCharacter.id !== input.playerCharacter?.id) return false
  return isTokenAlive(input.currentInitiativeToken, input.characters)
}

export function canSubmitPlayerSpellAction(input: {
  activeMap?: BattleMap
  mode?: 'dm' | 'player' | null
  playerCombatLocked: boolean
  combatActive: boolean
  combatActiveSnapshot: boolean
  turnCharacter?: Pick<Character, 'id'> | null
  currentInitiativeToken?: Token
  pendingAction?: PendingPlayerActionLock | null
  playerCharacter?: Pick<Character, 'id'> | null
  characters: Character[]
}): boolean {
  if (!input.activeMap || input.mode !== 'player') return false
  if (input.pendingAction || !input.playerCharacter) return false
  if (input.combatActive && input.playerCombatLocked) return false

  // A transition where the rendered state and the authority snapshot disagree
  // is deliberately fail-closed. Once combat is live, the existing strict
  // initiative check is the only path that may authorize a spell.
  if (input.combatActive !== input.combatActiveSnapshot) return false
  if (input.combatActive) return canSubmitPlayerCombatAction(input)

  const actorToken = input.activeMap.tokens.find((token) =>
    token.type === 'player' && token.characterId === input.playerCharacter?.id,
  )
  return !!actorToken && isTokenAlive(actorToken, input.characters)
}

/**
 * A Host-opened spell reaction belongs to the assigned character, not the
 * current initiative actor. The trigger itself is rebuilt again by the DM
 * before execution; this helper only keeps the player UI fail-closed.
 */
export function canSubmitPlayerTriggeredReactionSpellAction(input: {
  activeMap?: BattleMap
  mode?: 'dm' | 'player' | null
  combatActive: boolean
  combatActiveSnapshot: boolean
  pendingAction?: PendingPlayerActionLock | null
  playerCharacter?: Pick<Character, 'id'> | null
  characters: Character[]
}): boolean {
  if (!input.activeMap || input.mode !== 'player' || !input.playerCharacter) return false
  if (!input.combatActive || !input.combatActiveSnapshot || input.pendingAction) return false
  const actorToken = input.activeMap.tokens.find((token) =>
    token.type === 'player' && token.characterId === input.playerCharacter?.id,
  )
  return !!actorToken && isTokenAlive(actorToken, input.characters)
}

export function playerActionNeedsExecutionDedupe(action: Pick<PlayerActionAuthorityAction, 'type'>): boolean {
  return action.type.startsWith('dnd5e-')
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
