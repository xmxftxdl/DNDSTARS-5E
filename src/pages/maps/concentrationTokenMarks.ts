import type { ConcentrationTokenMark } from '../../components/map/Dnd5eConcentrationTokenBadge'
import { concentrationTokenTooltip } from '../../components/map/tokenStatusTooltip'
import type { Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { dnd5eCharacterPresentationColors } from './combatLogPresentation'

function nonEmptySpellId(value: string | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}

/**
 * Projects authoritative concentration state into map presentation markers.
 * Linked Tokens deliberately ignore any stale Token combat projection and use
 * the Character Headless spell id as the structured lifecycle authority. The
 * legacy `concentrating` toggle remains a fallback for manually adjudicated
 * spells that do not yet have a structured Headless id. Unlinked monsters use
 * their own Headless combat state.
 */
export function buildDnd5eConcentrationTokenMarks(
  tokens: readonly Token[],
  characters: readonly Character[],
): ConcentrationTokenMark[] {
  const characterById = new Map(characters.map((character) => [character.id, character]))
  const fallback = dnd5eCharacterPresentationColors(undefined)

  return tokens.flatMap((token) => {
    if (token.characterId) {
      const character = characterById.get(token.characterId)
      const spellId = nonEmptySpellId(character?.dnd5eCombatState?.concentrationSpellId) ??
        (character?.concentrating === true ? 'manual-concentration' : undefined)
      if (!character || !spellId) return []

      const colors = dnd5eCharacterPresentationColors(character)
      const tooltip = concentrationTokenTooltip(spellId)
      return [{
        instance: {
          id: `concentration:${token.id}:${spellId}`,
          tokenId: token.id,
          kind: 'concentration',
          title: tooltip.title,
          description: tooltip.description,
          statusId: spellId,
          sourceActorId: token.id,
          sourceLabel: character.name ?? token.label,
          authority: 'headless',
        },
        tokenId: token.id,
        spellId,
        backgroundHighlightColor: colors.statusBackgroundHighlightColor,
        backgroundColor: colors.statusBackgroundColor,
        // Match other source-attributed map badges: the visible perimeter uses
        // the class banner's primary color, not the near-white status-frame slot.
        borderColor: colors.accentColor,
        glowColor: colors.glowColor,
        classId: colors.classId,
      }]
    }

    if (token.type === 'obstacle') return []
    const spellId = nonEmptySpellId(token.dnd5eCombatState?.concentrationSpellId)
    if (!spellId) return []
    const accent = token.color.trim() || fallback.statusBorderColor
    const tooltip = concentrationTokenTooltip(spellId)
    return [{
      instance: {
        id: `concentration:${token.id}:${spellId}`,
        tokenId: token.id,
        kind: 'concentration',
        title: tooltip.title,
        description: tooltip.description,
        statusId: spellId,
        sourceActorId: token.id,
        sourceLabel: token.label,
        authority: 'headless',
      },
      tokenId: token.id,
      spellId,
      backgroundHighlightColor: accent,
      backgroundColor: fallback.statusBackgroundColor,
      borderColor: accent,
      glowColor: accent,
    }]
  })
}
