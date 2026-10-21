import type { Character } from '../../types/character'

/** Spell forms that merge all carried equipment without destroying its inventory state. */
export function dnd5eEquipmentMergedBySpellForm(character: Pick<Character, 'dnd5eCombatState'>): boolean {
  return !!character.dnd5eCombatState?.wildShapeFormId &&
    ['polymorph', 'true-polymorph', 'animal-shapes'].includes(character.dnd5eCombatState.wildShapeMode ?? '')
}
