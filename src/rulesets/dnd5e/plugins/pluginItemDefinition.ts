import type { EquipmentItem } from '../../../types/equipment'
import { DND5E_INVENTORY_ICON_IDS } from '../../../types/inventory'
import type { Dnd5ePluginItemDefinition } from '../pluginApi'
import type { Dnd5eRulesPluginManifest } from './pluginManifestContracts'
import type { RegisteredDnd5ePluginItem } from './pluginRegistryContracts'
import { validateAndNormalizeDnd5ePluginItemHeadlessProtocol } from './pluginItemHeadlessProtocol'

const INVENTORY_CATEGORIES = ['equipment', 'magic-item', 'adventuring-gear', 'consumable', 'tool', 'container'] as const
const INVENTORY_ICONS: readonly string[] = DND5E_INVENTORY_ICON_IDS
const EQUIPMENT_SLOTS = ['mainWeapon', 'offHand', 'armor', 'helmet', 'shoes', 'ring', 'ring2', 'belt', 'necklace'] as const

function finiteInteger(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum
}

function boundedText(value: unknown, label: string, maximum: number, optional = false): string | undefined {
  if (value == null && optional) return undefined
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) {
    throw new Error(`Invalid plugin item ${label}`)
  }
  return value.trim()
}

export function clonePluginItemDefinition(
  manifest: Dnd5eRulesPluginManifest,
  definition: Dnd5ePluginItemDefinition,
  itemId: string,
  resolveIconAsset: (pluginId: string, value: unknown, label: string) => string | undefined,
): RegisteredDnd5ePluginItem {
  const name = boundedText(definition.name, `${itemId} name`, 160)!
  const englishName = boundedText(definition.englishName, `${itemId} English name`, 160, true)
  const description = boundedText(definition.description, `${itemId} description`, 20_000)!
  const rulesText = boundedText(definition.rulesText, `${itemId} rules text`, 20_000)!
  const iconAssetId = resolveIconAsset(manifest.id, definition.iconAssetId, itemId)
  if (!(INVENTORY_CATEGORIES as readonly unknown[]).includes(definition.category)) {
    throw new Error(`Invalid plugin item category: ${itemId}`)
  }
  if (!(INVENTORY_ICONS as readonly unknown[]).includes(definition.icon) || typeof definition.stackable !== 'boolean') {
    throw new Error(`Invalid plugin item presentation: ${itemId}`)
  }
  if (definition.weightLb != null && (
    typeof definition.weightLb !== 'number' || !Number.isFinite(definition.weightLb) ||
    definition.weightLb < 0 || definition.weightLb > 1_000_000
  )) throw new Error(`Invalid plugin item weight: ${itemId}`)
  if (definition.containerCapacityWeightLb != null && (
    definition.category !== 'container' ||
    typeof definition.containerCapacityWeightLb !== 'number' ||
    !Number.isFinite(definition.containerCapacityWeightLb) ||
    definition.containerCapacityWeightLb <= 0 ||
    definition.containerCapacityWeightLb > 1_000_000
  )) throw new Error(`Invalid plugin item container capacity: ${itemId}`)
  if (definition.cost && (
    typeof definition.cost.amount !== 'number' || !Number.isFinite(definition.cost.amount) ||
    definition.cost.amount < 0 || definition.cost.amount > 1_000_000_000 ||
    !['cp', 'sp', 'gp'].includes(definition.cost.currency)
  )) throw new Error(`Invalid plugin item cost: ${itemId}`)
  const spellcastingMaterial = definition.spellcastingMaterial
  if (spellcastingMaterial && (
    !Array.isArray(spellcastingMaterial.tags) || spellcastingMaterial.tags.length < 1 ||
    spellcastingMaterial.tags.length > 32 || spellcastingMaterial.tags.some((tag) =>
      typeof tag !== 'string' || !/^[a-z0-9][a-z0-9._:-]{0,159}$/.test(tag)
    ) ||
    (spellcastingMaterial.unitValueGp != null && (
      typeof spellcastingMaterial.unitValueGp !== 'number' ||
      !Number.isFinite(spellcastingMaterial.unitValueGp) ||
      spellcastingMaterial.unitValueGp < 0 || spellcastingMaterial.unitValueGp > 1_000_000_000
    ))
  )) throw new Error(`Invalid plugin spellcasting material metadata: ${itemId}`)

  const magicItem = definition.magicItem
  if (magicItem && (
    !['armor', 'weapon', 'ammunition', 'wondrous-item', 'potion', 'ring', 'rod', 'scroll', 'staff', 'wand'].includes(magicItem.kind) ||
    !['common', 'uncommon', 'rare', 'very-rare', 'legendary', 'artifact', 'varies'].includes(magicItem.rarity) ||
    !['none', 'required'].includes(magicItem.attunement) ||
    !['headless', 'dm-adjudication'].includes(magicItem.automation) ||
    (magicItem.attunementRequirement != null && (
      magicItem.attunement !== 'required' || typeof magicItem.attunementRequirement !== 'string' ||
      !magicItem.attunementRequirement.trim() || magicItem.attunementRequirement.length > 240
    ))
  )) throw new Error(`Invalid plugin magic item metadata: ${itemId}`)

  let equipment: EquipmentItem | undefined
  if (definition.equipment) {
    if (definition.category !== 'equipment' || definition.stackable) {
      throw new Error(`Plugin equipment must use the equipment category and cannot stack: ${itemId}`)
    }
    if (!(EQUIPMENT_SLOTS as readonly unknown[]).includes(definition.equipment.slot)) {
      throw new Error(`Invalid plugin equipment slot: ${itemId}`)
    }
    if (definition.equipment.allowedSlots != null && (
      !Array.isArray(definition.equipment.allowedSlots) || definition.equipment.allowedSlots.length > EQUIPMENT_SLOTS.length ||
      definition.equipment.allowedSlots.some((slot) => !(EQUIPMENT_SLOTS as readonly unknown[]).includes(slot))
    )) throw new Error(`Invalid plugin equipment allowed slots: ${itemId}`)
    const spellcastingFocusClassIds = definition.equipment.spellcastingFocusClassIds
    if (spellcastingFocusClassIds != null && (
      !Array.isArray(spellcastingFocusClassIds) || spellcastingFocusClassIds.length < 1 || spellcastingFocusClassIds.length > 32 ||
      spellcastingFocusClassIds.some((classId) =>
        typeof classId !== 'string' || !classId.trim() || classId.length > 160 || !/^[a-z0-9][a-z0-9._:-]*$/i.test(classId)
      )
    )) throw new Error(`Invalid plugin equipment spellcasting focus: ${itemId}`)
    if (definition.equipment.baseEquipmentId != null && (
      typeof definition.equipment.baseEquipmentId !== 'string' || !definition.equipment.baseEquipmentId.trim() ||
      definition.equipment.baseEquipmentId.length > 160
    )) throw new Error(`Invalid plugin base equipment id: ${itemId}`)
    const effects = definition.equipment.effects
    if (effects) {
      for (const [key, value] of Object.entries(effects)) {
        const limit = key === 'speedBonusFeet' ? 500 : 20
        if (!['weaponAttackBonus', 'weaponDamageBonus', 'armorClassBonus', 'savingThrowBonus', 'speedBonusFeet'].includes(key) ||
          !finiteInteger(value, -limit, limit)) throw new Error(`Invalid plugin equipment effect ${key}: ${itemId}`)
      }
    }
    const rules = definition.equipment.dnd5e
    if (rules?.kind === 'weapon') {
      if (
        !['simple', 'martial'].includes(rules.category) || !['melee', 'ranged'].includes(rules.mode) ||
        !['str', 'dex', 'finesse'].includes(rules.attackAbility) ||
        !finiteInteger(rules.damage.count, 0, 20) || !finiteInteger(rules.damage.sides, 2, 1_000) ||
        !['slashing', 'piercing', 'bludgeoning'].includes(rules.damage.type) ||
        (rules.reachFeet != null && !finiteInteger(rules.reachFeet, 0, 500)) ||
        (rules.rangeFeet != null && (!finiteInteger(rules.rangeFeet.normal, 0, 10_000) ||
          !finiteInteger(rules.rangeFeet.long, rules.rangeFeet.normal, 10_000))) ||
        (rules.properties != null && (!Array.isArray(rules.properties) || rules.properties.length > 32 ||
          rules.properties.some((property: string) => typeof property !== 'string' || !property.trim() || property.length > 120)))
      ) throw new Error(`Invalid plugin weapon rules: ${itemId}`)
    } else if (rules?.kind === 'armor') {
      if (
        !['light', 'medium', 'heavy'].includes(rules.category) || !finiteInteger(rules.baseArmorClass, 0, 50) ||
        !['full', 'max-2', 'none'].includes(rules.dexterityBonus) ||
        (rules.material != null && !['metal', 'nonmetal'].includes(rules.material)) ||
        (rules.strengthRequirement != null && !finiteInteger(rules.strengthRequirement, 1, 30)) ||
        (rules.stealthDisadvantage != null && typeof rules.stealthDisadvantage !== 'boolean')
      ) throw new Error(`Invalid plugin armor rules: ${itemId}`)
    } else if (rules?.kind === 'shield') {
      if (!finiteInteger(rules.armorClassBonus, -20, 20)) throw new Error(`Invalid plugin shield rules: ${itemId}`)
    } else if (rules != null) throw new Error(`Invalid plugin equipment rules: ${itemId}`)
    equipment = structuredClone({ ...definition.equipment, id: itemId, name }) as EquipmentItem
  } else if (definition.category === 'equipment') {
    throw new Error(`Plugin equipment template is missing equipment data: ${itemId}`)
  }

  const { use, useActions, resources, headlessEffects } = validateAndNormalizeDnd5ePluginItemHeadlessProtocol({
    itemId,
    definition,
    hasEquipment: !!equipment,
  })
  return {
    id: itemId,
    name,
    ...(englishName ? { englishName } : {}),
    category: definition.category,
    icon: definition.icon,
    ...(iconAssetId ? { iconAssetId } : {}),
    description,
    rulesText,
    ...(definition.weightLb != null ? { weightLb: definition.weightLb } : {}),
    ...(definition.cost ? { cost: { ...definition.cost } } : {}),
    ...(definition.containerCapacityWeightLb != null
      ? { containerCapacityWeightLb: definition.containerCapacityWeightLb }
      : {}),
    stackable: definition.stackable,
    ...(spellcastingMaterial ? {
      spellcastingMaterial: {
        tags: [...new Set(spellcastingMaterial.tags)],
        ...(spellcastingMaterial.unitValueGp != null
          ? { unitValueGp: spellcastingMaterial.unitValueGp }
          : {}),
      },
    } : {}),
    ...(equipment ? { equipment } : {}),
    ...(magicItem ? { magicItem: { ...magicItem } } : {}),
    ...(resources?.length ? { resources } : {}),
    ...(headlessEffects?.length ? { headlessEffects } : {}),
    ...(use ? { use: structuredClone(use) } : {}),
    ...(useActions?.length ? { useActions: structuredClone(useActions) } : {}),
    source: { book: manifest.name, license: manifest.license },
    ownerPluginId: manifest.id,
    ownerPluginName: manifest.name,
    ownerPluginLicense: manifest.license,
  }
}
