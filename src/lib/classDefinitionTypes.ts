import type { Character } from '../types/character'
import type { CharacterEquipment, EquipmentItem } from '../types/equipment'

export type ClassResourceReset = 'combat' | 'short-rest' | 'long-rest'

export interface ClassResourceDefinition {
  key: string
  label: string
  shortLabel?: string
  isAvailable(character: Character): boolean
  max(character: Character): number
  /** 规则上的无限次数；存档仍使用有限安全整数，界面显示为 ∞。 */
  unlimited?: (character: Character) => boolean
  resetOn: ClassResourceReset
  /**
   * Resources sharing a key normally keep the highest maximum. Additive
   * contributions increase that shared pool instead (for example a feat that
   * grants one extra superiority die to an existing class resource).
   */
  stacking?: 'maximum' | 'additive'
}

/** Merge same-key resource contributions without making their content source significant. */
export function mergeClassResourceDefinitions(
  _character: Character,
  definitions: readonly ClassResourceDefinition[],
): readonly ClassResourceDefinition[] {
  const groups = new Map<string, ClassResourceDefinition[]>()
  for (const definition of definitions) {
    const group = groups.get(definition.key) ?? []
    group.push(definition)
    groups.set(definition.key, group)
  }
  return [...groups.values()].map((group) => {
    const representative = group.find((definition) => definition.stacking !== 'additive') ?? group[0]
    return {
      ...representative,
      stacking: 'maximum',
      isAvailable: (candidate) => group.some((definition) => definition.isAvailable(candidate)),
      max: (candidate) => {
        const available = group.filter((definition) => definition.isAvailable(candidate))
        const maximum = available
          .filter((definition) => definition.stacking !== 'additive')
          .reduce((result, definition) => Math.max(result, definition.max(candidate)), 0)
        const additive = available
          .filter((definition) => definition.stacking === 'additive')
          .reduce((result, definition) => result + definition.max(candidate), 0)
        return Math.max(0, maximum + additive)
      },
      unlimited: (candidate) => group.some((definition) =>
        definition.isAvailable(candidate) && definition.unlimited?.(candidate) === true),
    }
  })
}

export interface ClassCombatActionDefinition {
  type: string
}

export interface ClassDefinition {
  id: string
  classNames: readonly string[]
  matchesClassName(className: string): boolean
  defaultEquipment?: CharacterEquipment
  knownEquipment?: EquipmentItem[]
  resources?: readonly ClassResourceDefinition[] | ((character: Character) => readonly ClassResourceDefinition[])
  combatActions?: readonly ClassCombatActionDefinition[]
}
