import {
  canSubmitPlayerSpellAction,
  canSubmitPlayerTriggeredReactionSpellAction,
} from '../../lib/playerActionAuthorityRouter'
import type { PendingPlayerActionLock } from '../../lib/playerActionSync'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'

export function resolvePlayerSpellActionSubmission(input: {
  activeMap?: BattleMap
  mode?: 'dm' | 'player' | null
  playerCombatLocked: boolean
  combatActive: boolean
  combatActiveSnapshot: boolean
  authorityReady: boolean
  combatFlowPaused: boolean
  turnCharacter?: Character | null
  currentInitiativeToken?: Token
  pendingAction?: PendingPlayerActionLock | null
  playerCharacter?: Character | null
  characters: Character[]
  allowTriggeredReaction?: boolean
}): { character: Character; token: Token } | undefined {
  const playerCharacter = input.playerCharacter
  // A combat-flow pause has no authority outside combat.  In particular, an
  // inactive combat snapshot may briefly retain the previous pause while the
  // shared state is reconciling; that must not block exploration spell or
  // spell-granted actions.
  if (
    !input.authorityReady ||
    (input.combatActive && input.combatFlowPaused) ||
    !input.activeMap ||
    !playerCharacter
  ) return undefined
  const triggeredReaction = input.allowTriggeredReaction === true &&
    canSubmitPlayerTriggeredReactionSpellAction(input)
  if (!triggeredReaction && !canSubmitPlayerSpellAction(input)) return undefined
  if (input.combatActive) {
    if (triggeredReaction) {
      const token = input.activeMap.tokens.find((candidate) =>
        candidate.type === 'player' && candidate.characterId === playerCharacter.id,
      )
      return token ? { character: playerCharacter, token } : undefined
    }
    if (!input.turnCharacter || !input.currentInitiativeToken) return undefined
    return { character: input.turnCharacter, token: input.currentInitiativeToken }
  }
  const token = input.activeMap.tokens.find((candidate) =>
    candidate.type === 'player' && candidate.characterId === playerCharacter.id,
  )
  return token ? { character: playerCharacter, token } : undefined
}

/**
 * Target selection can outlive the click that opened it. Keep it only while
 * the same owned character is still allowed to author the cast. In combat the
 * live initiative Token is authoritative; outside combat the owned map Token
 * remains sufficient.
 */
export function playerSpellTargetingMatchesAuthority(input: {
  combatActive: boolean
  targetingCharacterId: string
  playerCharacterId?: string
  turnCharacterId?: string
  currentInitiativeToken?: Token
  allowTriggeredReaction?: boolean
}): boolean {
  if (!input.playerCharacterId || input.targetingCharacterId !== input.playerCharacterId) {
    return false
  }
  if (!input.combatActive) return true
  if (input.allowTriggeredReaction) return true
  return input.currentInitiativeToken?.type === 'player' &&
    input.currentInitiativeToken.characterId === input.targetingCharacterId &&
    input.turnCharacterId === input.targetingCharacterId
}
