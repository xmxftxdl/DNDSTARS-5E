import { canSubmitPlayerSpellAction } from '../../lib/playerActionAuthorityRouter'
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
}): { character: Character; token: Token } | undefined {
  const playerCharacter = input.playerCharacter
  if (!input.authorityReady || input.combatFlowPaused || !input.activeMap || !playerCharacter) return undefined
  if (!canSubmitPlayerSpellAction(input)) return undefined
  if (input.combatActive) {
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
}): boolean {
  if (!input.playerCharacterId || input.targetingCharacterId !== input.playerCharacterId) {
    return false
  }
  if (!input.combatActive) return true
  return input.currentInitiativeToken?.type === 'player' &&
    input.currentInitiativeToken.characterId === input.targetingCharacterId &&
    input.turnCharacterId === input.targetingCharacterId
}
