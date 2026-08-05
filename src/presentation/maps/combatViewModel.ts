import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import type { Token } from '../../store/maps'
import type { Character } from '../../types/character'

export interface CombatInitiativeProjectionPorts {
  resolvePortrait: (character: Character | undefined, token: Token | undefined) => string | undefined
  resolveColor: (token: Token, character: Character | undefined) => string
}

/**
 * Pure presentation projection for the initiative rail. It is deliberately
 * independent from React, Zustand and Headless settlement.
 */
export function projectCombatInitiativeOrder(
  entries: readonly InitiativeEntry[],
  tokens: readonly Token[],
  characters: readonly Character[],
  ports: CombatInitiativeProjectionPorts,
): InitiativeEntry[] {
  const tokensById = new Map(tokens.map((token) => [token.id, token]))
  const charactersById = new Map(characters.map((character) => [character.id, character]))
  return entries.map((entry) => {
    const token = tokensById.get(entry.tokenId)
    const character = token?.characterId ? charactersById.get(token.characterId) : undefined
    const portrait = ports.resolvePortrait(character, token)
    const color = token ? ports.resolveColor(token, character) : entry.color
    if (!token || (
      token.emoji === entry.emoji &&
      token.label === entry.label &&
      portrait === entry.portrait &&
      token.portraitImageId === entry.portraitImageId &&
      color === entry.color &&
      color === entry.turnGlowColor
    )) return entry
    return {
      ...entry,
      emoji: token.emoji,
      label: token.label,
      portrait,
      portraitImageId: token.portraitImageId,
      color,
      turnGlowColor: color,
    }
  })
}

export interface CombatHotbarSelectionViewModel {
  baseSelectionId?: string
  activeCharacterId?: string | null
  spell?: { characterId: string; castingClassId?: string; spellId: string } | null
  item?: { characterId: string; instanceId: string } | null
  moveActive?: boolean
  playerCanControlTurn?: boolean
  weapon?: { characterId: string; featureBonusWeaponAttack?: boolean } | null
  teleport?: { characterId: string } | null
  persistentArea?: { characterId: string; areaId: string } | null
}

export function combatHotbarActiveActionId(view: CombatHotbarSelectionViewModel): string | undefined {
  let result = view.baseSelectionId
  const spell = view.spell
  const item = view.item
  const weapon = view.weapon
  const teleport = view.teleport
  const persistentArea = view.persistentArea
  if (spell && spell.characterId === view.activeCharacterId) {
    result = `spell:${spell.castingClassId}:${spell.spellId}`
  }
  if (item && item.characterId === view.activeCharacterId) result = `item:${item.instanceId}`
  if (view.moveActive && view.playerCanControlTurn) result = 'system:move'
  if (weapon && weapon.characterId === view.activeCharacterId) {
    result = weapon.featureBonusWeaponAttack
      ? 'feature:martial-spell-synergy-cantrip-then-bonus-attack-attack'
      : 'system:weapon-attack'
  }
  if (teleport && teleport.characterId === view.activeCharacterId) result = 'feature:feature-extra-action-teleport'
  if (persistentArea && persistentArea.characterId === view.activeCharacterId) {
    result = `feature:persistent-area-move:${persistentArea.areaId}`
  }
  return result
}
