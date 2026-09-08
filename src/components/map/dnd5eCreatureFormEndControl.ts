import type { Character } from '../../types/character'

export interface Dnd5eCreatureFormEndControl {
  mode: 'wild-shape' | 'polymorph' | 'true-polymorph' | 'animal-shapes' | 'shapechange'
  label: string
  detail: string
  available: boolean
}

function dnd5eCreatureFormConcentrationMode(
  spellId: string | undefined,
): 'polymorph' | 'true-polymorph' | 'animal-shapes' | 'shapechange' | undefined {
  const normalized = spellId?.trim().toLowerCase()
  if (!normalized) return undefined
  if (normalized.includes('animal-shapes')) return 'animal-shapes'
  if (normalized.includes('shapechange')) return 'shapechange'
  if (normalized.includes('true-polymorph')) return 'true-polymorph'
  if (normalized.includes('polymorph')) return 'polymorph'
  return undefined
}

export function dnd5eCreatureFormEndControl(
  character: Character,
): Dnd5eCreatureFormEndControl | undefined {
  const activeFormId = character.dnd5eCombatState?.wildShapeFormId
  const concentrationMode = character.concentrating === true
    ? dnd5eCreatureFormConcentrationMode(character.dnd5eCombatState?.concentrationSpellId)
    : undefined
  if (!activeFormId && !concentrationMode) return undefined
  const mode = activeFormId
    ? character.dnd5eCombatState?.wildShapeMode ?? 'wild-shape'
    : concentrationMode!
  if (mode === 'wild-shape') {
    return {
      mode,
      label: '恢复原形',
      detail: '附赠动作；形态生命归零时无需动作并自动恢复',
      available: true,
    }
  }
  const spellName = mode === 'true-polymorph'
    ? '完全变形术'
    : mode === 'polymorph' ? '变形术' : mode === 'shapechange' ? '形体变化' : '动物形态'
  const maintainsForm = concentrationMode === mode
  return maintainsForm
    ? {
        mode,
        label: `结束${spellName}专注`,
        detail: '无需动作；结束专注并恢复所有受此法术影响的形态',
        available: true,
      }
    : {
        mode,
        label: `等待施法者结束${spellName}`,
        detail: '只有维持该法术专注的施法者可以主动结束形态',
        available: false,
      }
}
