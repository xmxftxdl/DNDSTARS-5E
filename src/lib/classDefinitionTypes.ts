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
