import { DND5E_CLASS_ICON_PALETTES } from '../../lib/dnd5eActionIcons'
import { dnd5eClassDefinition } from '../../rulesets/dnd5e/classes'
import type { Character } from '../../types/character'

const FALLBACK_PRESENTATION = {
  accentColor: '#94a3b8',
  glowColor: '#e2e8f0',
  statusBackgroundHighlightColor: '#334155',
  statusBackgroundColor: '#111827',
  statusBorderColor: '#e2e8f0',
  classId: undefined,
} as const

export function dnd5eCharacterPresentationColors(character: Character | undefined) {
  const levelClassId = Object.entries(character?.dnd5eClassLevels ?? {})
    .filter(([, level]) => Number(level ?? 0) > 0)
    .sort(([, left], [, right]) => Number(right ?? 0) - Number(left ?? 0))[0]?.[0]
  const legacyClassId = character
    ? dnd5eClassDefinition(character.charClass)?.id ??
      (DND5E_CLASS_ICON_PALETTES[character.charClass.trim().toLowerCase()]
        ? character.charClass.trim().toLowerCase()
        : undefined)
    : undefined
  const classId = levelClassId ?? legacyClassId
  const palette = classId ? DND5E_CLASS_ICON_PALETTES[classId] : undefined
  if (!palette) return FALLBACK_PRESENTATION
  return {
    accentColor: palette[0],
    glowColor: palette[3],
    statusBackgroundHighlightColor: palette[0],
    statusBackgroundColor: palette[1],
    statusBorderColor: palette[2],
    classId,
  }
}
