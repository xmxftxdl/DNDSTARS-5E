import type { Character } from '../../types/character'
import type { Dnd5eClassId } from './classes'
import { DND5E_SRD_SPELL_DESCRIPTIONS_ZH_REVIEWED } from './spellDescriptionsZh.reviewed.generated'

export interface Dnd5eSpellComponentRequirements {
  verbal: boolean
  somatic: boolean
  material: boolean
  costlyMaterial?: boolean
  consumedMaterial?: boolean
}

export interface Dnd5eSpellComponentCheck {
  verbal: 'not-required' | 'available' | 'unavailable-silenced'
  somatic: 'not-required' | 'available'
  material:
    | 'not-required'
    | 'focus-or-pouch'
    | 'inventory-untracked'
    | 'missing-focus-or-pouch'
    | 'unsupported-costly-material'
}

const BARD_INSTRUMENT_IDS = new Set([
  'bagpipes',
  'drum',
  'dulcimer',
  'flute',
  'horn',
  'lute',
  'lyre',
  'pan-flute',
  'shawm',
  'viol',
])

export function dnd5eCoreSpellComponentRequirements(
  spellId: string,
): Dnd5eSpellComponentRequirements {
  const text = DND5E_SRD_SPELL_DESCRIPTIONS_ZH_REVIEWED[spellId]?.components ?? ''
  return {
    verbal: /言语|\bV\b/i.test(text),
    somatic: /姿势|\bS\b/i.test(text),
    material: /材料|\bM\b/i.test(text),
    costlyMaterial: /价值|worth at least|costs? at least/i.test(text),
    consumedMaterial: /消耗|consume[sd]?/i.test(text),
  }
}

export function dnd5eCharacterIsSilenced(
  actor: Pick<Character, 'conditions'>,
): boolean {
  return actor.conditions.some((condition) =>
    ['silenced', 'silence', '沉默'].includes(condition.trim().toLowerCase()),
  )
}

function entryTemplateKey(templateId: string): string {
  return templateId.trim().toLowerCase().split(':').at(-1) ?? ''
}

function entryCanBeSpellcastingFocus(templateId: string, classId?: Dnd5eClassId): boolean {
  const id = entryTemplateKey(templateId)
  if (id === 'component-pouch') return true
  if (classId === 'wizard' || classId === 'sorcerer' || classId === 'warlock') {
    return id === 'arcane-focus'
  }
  if (classId === 'cleric' || classId === 'paladin') return id === 'holy-symbol'
  if (classId === 'druid') return id === 'druidic-focus'
  if (classId === 'bard') return BARD_INSTRUMENT_IDS.has(id)
  return false
}

export function dnd5eSpellComponentCheck(
  actor: Pick<Character, 'conditions' | 'dnd5eInventory'>,
  requirements: Dnd5eSpellComponentRequirements,
  classId?: Dnd5eClassId,
): Dnd5eSpellComponentCheck {
  const materialUnavailable = requirements.costlyMaterial || requirements.consumedMaterial
  const inventory = actor.dnd5eInventory
  const hasFocusOrPouch = inventory?.entries.some((entry) =>
    entry.quantity > 0 && entryCanBeSpellcastingFocus(entry.templateId, classId),
  ) === true
  return {
    verbal: !requirements.verbal
      ? 'not-required'
      : dnd5eCharacterIsSilenced(actor)
        ? 'unavailable-silenced'
        : 'available',
    somatic: requirements.somatic ? 'available' : 'not-required',
    material: !requirements.material
      ? 'not-required'
      : inventory == null
        ? 'inventory-untracked'
        : materialUnavailable
          ? 'unsupported-costly-material'
          : hasFocusOrPouch
            ? 'focus-or-pouch'
            : 'missing-focus-or-pouch',
  }
}

export function dnd5eSpellComponentsAvailable(check: Dnd5eSpellComponentCheck): boolean {
  return check.verbal !== 'unavailable-silenced' &&
    check.material !== 'missing-focus-or-pouch' &&
    check.material !== 'unsupported-costly-material'
}
