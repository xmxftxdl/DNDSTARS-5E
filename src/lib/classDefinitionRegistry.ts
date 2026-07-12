import type { Character } from '../types/character'
import type { EquipmentItem } from '../types/equipment'
import { ARCHER_CLASS_DEFINITION } from '../classes/archer/classDefinition'
import { HEAVY_GUNNER_CLASS_DEFINITION } from '../classes/heavyGunner/classDefinition'
import { EQUIPMENT_CATALOG } from './equipmentDefaults'
import type { ClassDefinition } from './classDefinitionTypes'

export * from './classDefinitionTypes'
export { ARCHER_CLASS_DEFINITION, HEAVY_GUNNER_CLASS_DEFINITION }

const definitions = new Map<string, ClassDefinition>([
  [ARCHER_CLASS_DEFINITION.id, ARCHER_CLASS_DEFINITION],
  [HEAVY_GUNNER_CLASS_DEFINITION.id, HEAVY_GUNNER_CLASS_DEFINITION],
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
  return classDefinitionForCharacter(character)?.knownEquipment ?? EQUIPMENT_CATALOG
}
