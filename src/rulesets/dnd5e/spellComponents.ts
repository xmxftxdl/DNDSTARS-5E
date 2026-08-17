import type { Character } from '../../types/character'
import type { EquipmentItem } from '../../types/equipment'
import type { Dnd5eClassId } from './classes'
import { DND5E_SRD_SPELL_DESCRIPTIONS_ZH_REVIEWED } from './spellDescriptionsZh.reviewed.generated'
import { dnd5ePluginBooleanStaticModifierForCharacter } from './pluginApi'

export interface Dnd5eSpellComponentRequirements {
  verbal: boolean
  somatic: boolean
  material: boolean
  costlyMaterial?: boolean
  consumedMaterial?: boolean
}

export interface Dnd5eSpellComponentCheck {
  verbal: 'not-required' | 'available' | 'unavailable-silenced'
  somatic: 'not-required' | 'available' | 'unavailable-hands-occupied'
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
  if (classId === 'wizard' || classId === 'sorcerer' || classId === 'warlock') {
    return id === 'arcane-focus'
  }
  if (classId === 'cleric' || classId === 'paladin') return id === 'holy-symbol'
  if (classId === 'druid') return id === 'druidic-focus'
  if (classId === 'bard') return BARD_INSTRUMENT_IDS.has(id)
  return false
}

function equipmentCanBeSpellcastingFocus(
  equipment: EquipmentItem | undefined,
  classId?: Dnd5eClassId,
): boolean {
  return !!classId && equipment?.spellcastingFocusClassIds?.includes(classId) === true
}

export interface Dnd5eHeldSpellcastingFocus {
  instanceId: string
  templateId: string
}

function inventoryEntryIsHeldSpellcastingFocus(
  candidate: NonNullable<Character['dnd5eInventory']>['entries'][number],
  classId: Dnd5eClassId,
): boolean {
  return candidate.quantity > 0 &&
    candidate.identified !== false &&
    (candidate.item.magicItem?.attunement !== 'required' || candidate.attuned === true) &&
    (candidate.equippedSlot === 'mainWeapon' || candidate.equippedSlot === 'offHand') &&
    (
      equipmentCanBeSpellcastingFocus(candidate.item.equipment, classId) ||
      entryCanBeSpellcastingFocus(candidate.templateId, classId)
    )
}

/**
 * Returns the authoritative inventory focus currently held for a class cast.
 *
 * This is deliberately separate from an item's own spell-cast action. A held
 * focus supplies components to the character's cast; it does not become the
 * source of that spell and therefore must not suppress class spell modifiers.
 */
export function dnd5eHeldSpellcastingFocus(
  actor: Pick<Character, 'dnd5eInventory'>,
  classId?: Dnd5eClassId,
): Dnd5eHeldSpellcastingFocus | undefined {
  if (!classId) return undefined
  const entry = actor.dnd5eInventory?.entries.find((candidate) =>
    inventoryEntryIsHeldSpellcastingFocus(candidate, classId),
  )
  return entry ? { instanceId: entry.instanceId, templateId: entry.templateId } : undefined
}

export function dnd5eHeldSpellcastingFocusMatches(
  actor: Pick<Character, 'dnd5eInventory'>,
  instanceId: string | undefined,
  classId?: Dnd5eClassId,
): boolean {
  return instanceId != null && classId != null && actor.dnd5eInventory?.entries.some((candidate) =>
    candidate.instanceId === instanceId && inventoryEntryIsHeldSpellcastingFocus(candidate, classId),
  ) === true
}

export function dnd5eSpellComponentCheck(
  actor: Pick<Character, 'conditions' | 'dnd5eInventory' | 'equipment'>,
  requirements: Dnd5eSpellComponentRequirements,
  classId?: Dnd5eClassId,
): Dnd5eSpellComponentCheck {
  const materialUnavailable = requirements.costlyMaterial || requirements.consumedMaterial
  const inventory = actor.dnd5eInventory
  const inventoryEntries = inventory?.entries.filter((entry) => entry.quantity > 0) ?? []
  const mainHandOccupied = !!actor.equipment?.mainWeapon || inventoryEntries.some((entry) =>
    entry.equippedSlot === 'mainWeapon',
  )
  const offHandOccupied = !!actor.equipment?.offHand || inventoryEntries.some((entry) =>
    entry.equippedSlot === 'offHand',
  )
  const hasFreeHand = !mainHandOccupied || !offHandOccupied
  const heldEquipment = [
    actor.equipment?.mainWeapon,
    actor.equipment?.offHand,
  ]
  const hasHeldFocus = heldEquipment.some((equipment) =>
    equipmentCanBeSpellcastingFocus(equipment, classId),
  ) || dnd5eHeldSpellcastingFocus(actor, classId) != null
  const hasComponentPouch = inventoryEntries.some((entry) =>
    entryTemplateKey(entry.templateId) === 'component-pouch',
  )
  // A generic holy-symbol inventory entry represents an SRD form worn visibly. It supplies
  // M by itself, but only a shield explicitly declared for this class supplies an occupied S/M hand.
  const hasHolySymbol = (classId === 'cleric' || classId === 'paladin') && inventoryEntries.some((entry) =>
    entryTemplateKey(entry.templateId) === 'holy-symbol',
  )
  const hasMaterialSubstitute = hasHeldFocus || hasHolySymbol || (hasComponentPouch && hasFreeHand)
  const somaticHandAvailable =
    dnd5ePluginBooleanStaticModifierForCharacter(
      actor as Character,
      'ignoreOccupiedHandsForSomaticComponents',
    ) || hasFreeHand || (requirements.material && hasHeldFocus)
  return {
    verbal: !requirements.verbal
      ? 'not-required'
      : dnd5eCharacterIsSilenced(actor)
        ? 'unavailable-silenced'
        : 'available',
    somatic: !requirements.somatic
      ? 'not-required'
      : somaticHandAvailable
        ? 'available'
        : 'unavailable-hands-occupied',
    material: !requirements.material
      ? 'not-required'
      : inventory == null
        ? 'inventory-untracked'
        : materialUnavailable
          ? 'unsupported-costly-material'
          : hasMaterialSubstitute
            ? 'focus-or-pouch'
            : 'missing-focus-or-pouch',
  }
}

export function dnd5eSpellComponentsAvailable(check: Dnd5eSpellComponentCheck): boolean {
  return check.verbal !== 'unavailable-silenced' &&
    check.somatic !== 'unavailable-hands-occupied' &&
    check.material !== 'missing-focus-or-pouch' &&
    check.material !== 'unsupported-costly-material'
}
