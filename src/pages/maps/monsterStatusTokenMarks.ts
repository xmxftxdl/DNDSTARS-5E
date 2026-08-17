import type { SpellStatusTokenMark } from '../../components/map/MapCanvas'
import { DND5E_CLASS_ICON_PALETTES } from '../../lib/dnd5eActionIcons'
import type { Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { getDnd5eSrdMonster } from '../../rulesets/dnd5e/monsters'
import type { Dnd5eTokenStatusMarker } from '../../rulesets/dnd5e/tokenStatusMarkers'
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
        instance: {
          id: `monster-state:${token.id}:berserk`,
          tokenId: token.id,
          kind: 'monster-state',
          title: '狂暴',
          description: '该怪物已进入狂暴状态。其回合中会按狂暴规则选择并攻击最近的可见生物。',
          statusId: 'monster-berserk',
          sourceLabel: linked?.name ?? token.label,
          authority: 'headless',
        },
        tokenId: token.id,
        statusId: 'monster-berserk',
        backgroundHighlightColor: '#fecaca',
        backgroundColor: '#7f1d1d',
        borderColor: '#fca5a5',
        glowColor: '#ef4444',
      })
    }

    const regenerationSuppressedDamageTypes = combatState?.monsterRegenerationSuppressedDamageTypes ?? []
    if (regenerationSuppressedDamageTypes.length > 0) {
      const colors = fallbackMonsterColors()
      marks.push({
        instance: {
          id: `monster-state:${token.id}:regeneration-suppressed:${[...regenerationSuppressedDamageTypes].sort().join('-')}`,
          tokenId: token.id,
          kind: 'monster-state',
          title: '再生受抑',
          description: `该怪物受到${regenerationSuppressedDamageTypes.join('／')}伤害；其下个回合开始时不会触发再生。`,
          statusId: 'monster-regeneration-suppressed',
          sourceLabel: linked?.name ?? token.label,
          authority: 'headless',
        },
        tokenId: token.id,
        statusId: 'monster-regeneration-suppressed',
        backgroundHighlightColor: colors.statusBackgroundHighlightColor,
        backgroundColor: colors.statusBackgroundColor,
        borderColor: colors.statusBorderColor,
        glowColor: colors.glowColor,
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
      instance: {
        id: `monster-state:${token.id}:damage-aversion:${sourceActorId ?? 'fire'}`,
        tokenId: token.id,
        kind: 'monster-state',
        title: '伤害畏避（火焰）',
        description: '受到火焰伤害后，攻击检定和属性检定具有劣势，直到该生物的下个回合结束。',
        statusId: 'monster-damage-aversion',
        sourceActorId,
        sourceLabel: sourceCharacter?.name ?? sourceToken?.label ?? '火焰伤害触发',
        authority: 'headless',
      },
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

export interface Dnd5eMonsterTraitTokenStatusMark {
  tokenId: string
  marker: Dnd5eTokenStatusMarker
}

/**
 * Project always-on, self-scoped monster mechanics as concrete Token badge
 * instances. This is intentionally separate from the temporary triggered
 * Damage Aversion state above: a Flesh Golem always has Fire Aversion, while
 * the disadvantage state only exists after it actually takes fire damage.
 */
export function buildDnd5eMonsterTraitTokenStatusMarks(
  tokens: readonly Token[],
  characters: readonly Character[] = [],
): Dnd5eMonsterTraitTokenStatusMark[] {
  const colors = fallbackMonsterColors()
  return tokens.flatMap((token) => {
    const monster = token.poolId ? getDnd5eSrdMonster(token.poolId) : undefined
    if (!monster) return []
    const linked = token.characterId
      ? characters.find((character) => character.id === token.characterId)
      : undefined
    const combatState = linked?.dnd5eCombatState ?? token.dnd5eCombatState
    const suppressedMarkerIds = new Set(token.dnd5eSuppressedStatusMarkerIds ?? [])
    return monster.traits.flatMap((trait, traitIndex) => {
      if (trait.rule?.kind !== 'damage-aversion' || trait.rule.damageType !== 'fire') return []
      // Fire Aversion and its triggered Damage Aversion are two phases of one
      // mechanic. The runtime mark carries the current source and expiry, so it
      // replaces the always-on trait badge while active instead of rendering a
      // second, visually duplicate status Token.
      if (combatState?.monsterDamageAversionActive === true) return []
      const markerId = `monster-trait:${token.id}:fire-averse:${traitIndex}`
      if (suppressedMarkerIds.has(markerId)) return []
      return [{
        tokenId: token.id,
        marker: {
          schemaVersion: 1,
          id: markerId,
          statusId: 'fire-averse',
          source: 'headless',
          label: '畏火',
          sourceLabel: `${monster.name} · ${trait.name || '畏火'}`,
          mechanical: true,
          detailDescription: trait.description ||
            '受到火焰伤害后，攻击检定和属性检定具有劣势，直到该生物的下个回合结束。',
          backgroundColor: colors.statusBackgroundColor,
          borderColor: colors.statusBorderColor,
          glowColor: colors.glowColor,
        },
      }]
    })
  })
}
