import type { Character } from '../../types/character'
import type { Token } from '../../store/maps'
import type { Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import { createDnd5eTurnEconomyCounts } from '../../rulesets/dnd5e/turnEconomy'

export function resolvePlayerMapSpellHotbarCharacter(input: {
  playerCharacter?: Character | null
  activeCharacter?: Character | null
  combatActive?: boolean
  currentInitiativeToken?: Token
  turnCharacter?: Character | null
}): Character | null | undefined {
  if (input.combatActive && input.currentInitiativeToken?.dnd5eSimulacrum?.sourceCharacterId === input.playerCharacter?.id &&
    input.currentInitiativeToken?.characterId === input.turnCharacter?.id) return input.turnCharacter
  return input.playerCharacter
}

export function simulacrumHotbarTurnEconomy(
  token: Token,
  byToken: Readonly<Record<string, Dnd5eTurnEconomyCounts>>,
  speed: number,
): Dnd5eTurnEconomyCounts {
  return byToken[token.id] ?? createDnd5eTurnEconomyCounts(`pending:${token.id}`, speed)
}
