import { DND5E_CLASS_ICON_PALETTES } from '../../lib/dnd5eActionIcons'
import type { Dnd5eClassBorderPalette } from '../../lib/dnd5eClassBorderVisual'
import type { Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { dnd5eCharacterPresentationColors } from './combatLogPresentation'

export const DND5E_MONSTER_TOKEN_BORDER_COLOR = DND5E_CLASS_ICON_PALETTES.monster[3]

export interface Dnd5eTokenBorderPresentation extends Dnd5eClassBorderPalette {
  classId?: string
}

function presentationFromPalette(
  palette: readonly [string, string, string, string],
  classId?: string,
): Dnd5eTokenBorderPresentation {
  return {
    background: palette[0],
    backgroundDeep: palette[1],
    accent: palette[2],
    glow: palette[3],
    classId,
  }
}

/**
 * Resolve the canonical creature-ring color once, before entering the canvas.
 * Player characters use their exact class primary color; enemy creatures use
 * one shared red. Unlinked NPC/player tokens retain their explicitly assigned
 * color so custom tokens still have a useful fallback.
 */
export function dnd5eTokenPresentationColor(
  token: Token,
  character?: Character,
): string {
  if (token.type === 'enemy') return DND5E_MONSTER_TOKEN_BORDER_COLOR
  if (character) return dnd5eCharacterPresentationColors(character).accentColor
  return token.color?.trim() || '#94A3B8'
}

/**
 * Full spell-portrait palette for the map perimeter. Keeping the deep and glow
 * colors avoids approximating the action-icon frame from one flat class color.
 */
export function dnd5eTokenBorderPresentation(
  token: Token,
  character?: Character,
): Dnd5eTokenBorderPresentation {
  if (token.type === 'enemy') {
    return presentationFromPalette(DND5E_CLASS_ICON_PALETTES.monster, 'monster')
  }
  if (character) {
    const colors = dnd5eCharacterPresentationColors(character)
    const palette = colors.classId
      ? DND5E_CLASS_ICON_PALETTES[colors.classId]
      : undefined
    if (palette) return presentationFromPalette(palette, colors.classId)
  }
  const color = token.color?.trim() || '#94A3B8'
  return {
    background: color,
    backgroundDeep: '#0f172a',
    accent: color,
    glow: color,
  }
}

/** Only creature tokens receive the animated class/monster presentation ring. */
export function buildDnd5eTokenPresentationColors(
  tokens: readonly Token[],
  characters: readonly Character[],
): Readonly<Record<string, string>> {
  const charactersById = new Map(characters.map((character) => [character.id, character]))
  return Object.fromEntries(tokens.flatMap((token) => {
    if (token.type === 'obstacle' || token.dnd5eSpellEffect) return []
    const character = token.characterId
      ? charactersById.get(token.characterId)
      : undefined
    return [[token.id, dnd5eTokenPresentationColor(token, character)]]
  }))
}

/** Only creature tokens receive the animated spell-portrait presentation frame. */
export function buildDnd5eTokenBorderPresentations(
  tokens: readonly Token[],
  characters: readonly Character[],
): Readonly<Record<string, Dnd5eTokenBorderPresentation>> {
  const charactersById = new Map(characters.map((character) => [character.id, character]))
  return Object.fromEntries(tokens.flatMap((token) => {
    if (token.type === 'obstacle' || token.dnd5eSpellEffect) return []
    const character = token.characterId
      ? charactersById.get(token.characterId)
      : undefined
    return [[token.id, dnd5eTokenBorderPresentation(token, character)]]
  }))
}
