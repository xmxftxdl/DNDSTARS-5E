import type { SpellStatusTokenMark } from '../../components/map/MapCanvas'
import { DND5E_CLASS_ICON_PALETTES } from '../../lib/dnd5eActionIcons'
import type { Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { dnd5eCharacterPresentationColors } from './combatLogPresentation'

function fallbackMonsterColors() {
  const palette = DND5E_CLASS_ICON_PALETTES.monster
  return {
    statusBackgroundHighlightColor: palette[0],
    statusBackgroundColor: palette[1],
    statusBorderColor: palette[2],
    glowColor: palette[3],
  }
}

/** Build non-spell monster status marks while reusing the shared Token badge renderer. */
export function buildDnd5eMonsterStatusTokenMarks(
  tokens: readonly Token[],
  characters: readonly Character[],
): SpellStatusTokenMark[] {
  return tokens.flatMap((token) => {
    const linked = token.characterId
      ? characters.find((character) => character.id === token.characterId)
      : undefined
    const combatState = linked?.dnd5eCombatState ?? token.dnd5eCombatState
    const marks: SpellStatusTokenMark[] = []

    if (combatState?.monsterBerserk === true) {
      marks.push({
        tokenId: token.id,
        statusId: 'monster-berserk',
        backgroundHighlightColor: '#fecaca',
        backgroundColor: '#7f1d1d',
        borderColor: '#fca5a5',
        glowColor: '#ef4444',
      })
    }

    if (combatState?.monsterDamageAversionActive !== true) return marks

    const sourceActorId = combatState.monsterDamageAversionSourceActorId
    const sourceToken = sourceActorId
      ? tokens.find((candidate) => candidate.id === sourceActorId)
      : undefined
    const sourceCharacter = sourceToken?.characterId
      ? characters.find((character) => character.id === sourceToken.characterId)
      : characters.find((character) => character.id === sourceActorId)
    const colors = sourceCharacter
      ? dnd5eCharacterPresentationColors(sourceCharacter)
      : fallbackMonsterColors()

    marks.push({
      tokenId: token.id,
      statusId: 'monster-damage-aversion',
      backgroundHighlightColor: colors.statusBackgroundHighlightColor,
      backgroundColor: colors.statusBackgroundColor,
      borderColor: colors.statusBorderColor,
      glowColor: colors.glowColor,
    })
    return marks
  })
}
