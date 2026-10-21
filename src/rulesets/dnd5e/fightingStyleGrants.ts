import type { Character } from '../../types/character'
import { fighterSelectedFightingStyles } from './fighter'
import { dnd5eCharacterClassLevel } from './multiclass'
import { dnd5eClassDefinitionForCharacter } from './classes'

export const DND5E_BUILD_FIGHTING_STYLES = ['archery', 'defense', 'dueling', 'great-weapon-fighting', 'protection', 'two-weapon-fighting'] as const

/** Core training and imported build receipts share the same mechanical styles. */
export function dnd5eGrantedFightingStyles(character: Character): readonly string[] {
  const fighterLevel = dnd5eCharacterClassLevel(character, 'fighter')
  const styles: string[] = fighterLevel > 0 ? [...fighterSelectedFightingStyles({ ...character, level: fighterLevel })] : []
  for (const classId of ['paladin', 'ranger'] as const) {
    if (dnd5eCharacterClassLevel(character, classId) < 2) continue
    const definition = dnd5eClassDefinitionForCharacter({ charClass: classId === 'paladin' ? '圣武士' : '游侠' })
    const allowed = new Set(definition?.choiceGroups?.find(group => group.id === 'fighting-style')?.options.map(option => option.id) ?? [])
    styles.push(...(character.dnd5eClassChoices?.classes?.[classId]?.selections?.['fighting-style'] ?? []).filter(style => allowed.has(style)))
  }
  for (const receipt of Object.values(character.dnd5eContentChoices ?? {})) {
    if (receipt.schemaVersion !== 1) continue
    for (const grant of receipt.resolvedGrants) {
      if (grant.kind === 'tag' && grant.key === 'fighting-style' &&
        DND5E_BUILD_FIGHTING_STYLES.some(style => style === grant.value)) styles.push(grant.value)
    }
  }
  return [...new Set(styles)]
}
