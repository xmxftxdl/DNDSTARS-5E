import type { Character } from '../types/character'
import type { EquipmentItem } from '../types/equipment'
import { FIGHTER_CLASS_DEFINITION } from '../classes/fighter/classDefinition'
import { DND5E_GENERIC_CLASS_DEFINITIONS } from '../classes/dnd5e/classDefinitions'
import { DND5E_SRD_EQUIPMENT_CATALOG } from '../rulesets/dnd5e/equipment'
import type { ClassDefinition } from './classDefinitionTypes'

export * from './classDefinitionTypes'
export { DND5E_GENERIC_CLASS_DEFINITIONS, FIGHTER_CLASS_DEFINITION }

const definitions = new Map<string, ClassDefinition>([
  [FIGHTER_CLASS_DEFINITION.id, FIGHTER_CLASS_DEFINITION],
  ...DND5E_GENERIC_CLASS_DEFINITIONS.map((definition) => [definition.id, definition] as const),
])

export function registerClassDefinition(definition: ClassDefinition): () => void {
  const previous = definitions.get(definition.id)
  definitions.set(definition.id, definition)
  return () => {
    if (definitions.get(definition.id) !== definition) return
    if (previous) definitions.set(definition.id, previous)
    else definitions.delete(definition.id)
  }
}

export function registeredClassDefinitions(): readonly ClassDefinition[] {
  return [...definitions.values()]
}

export function classDefinitionForClassName(className: string): ClassDefinition | undefined {
  return [...definitions.values()].find((definition) => definition.matchesClassName(className))
}

export function classDefinitionForCharacter(character: Character): ClassDefinition | undefined {
  return classDefinitionForClassName(character.charClass)
}

export function classCombatActionAvailable(character: Character, actionType: string): boolean {
  return classDefinitionForCharacter(character)?.combatActions?.some((action) => action.type === actionType) ?? false
}

export function equipmentCatalogForCharacter(character: Character): EquipmentItem[] {
  return classDefinitionForCharacter(character)?.knownEquipment ?? [...DND5E_SRD_EQUIPMENT_CATALOG]
}
