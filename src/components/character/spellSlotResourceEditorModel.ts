import { classResourceDefinitions, getClassResource } from '../../lib/classResources'
import { isEditableDnd5eSpellSlotResourceKey } from '../../store/roomCommands'
import type { Character } from '../../types/character'

export interface EditableSpellSlotResource {
  key: string
  label: string
  current: number
  max: number
}

export function editableSpellSlotResources(character: Character): EditableSpellSlotResource[] {
  return classResourceDefinitions(character)
    .filter((definition) => isEditableDnd5eSpellSlotResourceKey(definition.key))
    .map((definition) => {
      const resource = getClassResource(character, definition.key)
      return resource
        ? { key: definition.key, label: definition.label, current: resource.current, max: resource.max }
        : undefined
    })
    .filter((resource): resource is EditableSpellSlotResource => !!resource && resource.max > 0)
}
