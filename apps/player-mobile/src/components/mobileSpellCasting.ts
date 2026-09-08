import type { MobileCharacterView, MobileSpellView } from '../../../../packages/mobile-protocol/src'

export function mobileSpellBaseSlotLevel(spell: MobileSpellView, character: MobileCharacterView) {
  if (spell.racialInnate) return spell.racialCastAtLevel ?? spell.level
  if (spell.level === 0) return 0
  if (spell.castingClassId === 'warlock') return pactSlotLevel(character.classLevels?.warlock ?? 0)
  return spell.level
}

export function mobileAvailableSpellSlotLevels(spell: MobileSpellView, character: MobileCharacterView) {
  if (spell.racialInnate) return [spell.racialCastAtLevel ?? spell.level]
  if (spell.level === 0) return [0]
  if (spell.castingClassId === 'warlock') {
    const level = pactSlotLevel(character.classLevels?.warlock ?? 0)
    return level >= spell.level && (character.classResources?.['dnd5e-pact-slot']?.current ?? 0) > 0 ? [level] : []
  }
  return Array.from({ length: 10 - spell.level }, (_, index) => spell.level + index)
    .filter((level) => (character.classResources?.[`dnd5e-spell-slot-${level}`]?.current ?? 0) > 0)
}

function pactSlotLevel(level: number) {
  if (level >= 9) return 5
  if (level >= 7) return 4
  if (level >= 5) return 3
  if (level >= 3) return 2
  return 1
}
