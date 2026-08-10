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
