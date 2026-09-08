import type { Character } from '../../types/character'

export function resolvePlayerMapSpellHotbarCharacter(input: {
  playerCharacter?: Character | null
  activeCharacter?: Character | null
  combatActive?: boolean
}): Character | null | undefined {
  return input.playerCharacter
}
