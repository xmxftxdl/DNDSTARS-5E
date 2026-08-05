import type {
  Dnd5eInventoryHeadlessEffect,
  Dnd5eInventoryItemTemplate,
  Dnd5eInventoryResourceDefinition,
} from '../../../types/inventory'
import { DND5E_DAMAGE_TYPES } from '../damageTypes'

type ItemHeadlessDeclaration = Pick<
  Dnd5eInventoryItemTemplate,
  'use' | 'resources' | 'headlessEffects'
>

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/

function validId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value)
}

function finiteInteger(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum
}

export function validateAndNormalizeDnd5ePluginItemHeadlessProtocol(input: {
  itemId: string
  definition: ItemHeadlessDeclaration
  hasEquipment: boolean
}): {
  use: Dnd5eInventoryItemTemplate['use']
  resources: Dnd5eInventoryResourceDefinition[] | undefined
  headlessEffects: Dnd5eInventoryHeadlessEffect[] | undefined
} {
  const { itemId, definition } = input
  const use = definition.use
  if (use) {
    if (!['action', 'bonusAction', 'none'].includes(use.economy) || !finiteInteger(use.consumeQuantity, 0, 999)) {
      throw new Error(`Invalid plugin item use economy: ${itemId}`)
    }
    if (use.chargesPerItem != null && !finiteInteger(use.chargesPerItem, 1, 1_000_000)) {
      throw new Error(`Invalid plugin item charges: ${itemId}`)
    }
    if (use.targeting?.kind === 'map-area') {
      if (
        !['ball-bearings', 'caltrops', 'hunting-trap'].includes(use.targeting.areaKind) ||
        !finiteInteger(use.targeting.rangeFeet, 0, 10_000) ||
        !finiteInteger(use.targeting.widthFeet, 0, 10_000) ||
        !finiteInteger(use.targeting.heightFeet, 0, 10_000)
      ) throw new Error(`Invalid plugin item map targeting: ${itemId}`)
    } else if (use.targeting?.kind === 'creature') {
      if (!finiteInteger(use.targeting.rangeFeet, 0, 10_000) ||
        (use.targeting.includeSelf != null && typeof use.targeting.includeSelf !== 'boolean')) {
        throw new Error(`Invalid plugin item creature targeting: ${itemId}`)
      }
    } else if (use.targeting != null) {
      throw new Error(`Invalid plugin item targeting: ${itemId}`)
    }
    if (use.effect.kind === 'healing') {
      if (
        !finiteInteger(use.effect.dice.count, 1, 40) || !finiteInteger(use.effect.dice.sides, 2, 100) ||
        !finiteInteger(use.effect.dice.bonus, -1_000, 1_000)
      ) throw new Error(`Invalid plugin healing item: ${itemId}`)
    } else if (use.effect.kind === 'dm-adjudication') {
      if (!use.effect.adjudication.trim() || use.effect.adjudication.length > 4_000) {
        throw new Error(`Invalid plugin item adjudication: ${itemId}`)
      }
    } else if (use.effect.kind === 'spell-slot-recovery') {
      if (
        !finiteInteger(use.effect.maximumSlotLevel, 1, 9) ||
        !finiteInteger(use.effect.amount, 1, 9) ||
        use.effect.selection !== 'selected-expended-slot'
      ) throw new Error(`Invalid plugin spell-slot recovery item: ${itemId}`)
    } else {
      throw new Error(`Invalid plugin item effect: ${itemId}`)
    }
  }

  const resources = definition.resources?.map((resource) => {
    if (
      !validId(resource.id) || typeof resource.label !== 'string' || !resource.label.trim() || resource.label.length > 120 ||
      !finiteInteger(resource.maximum, 1, 1_000_000) ||
      (resource.initial != null && !finiteInteger(resource.initial, 0, resource.maximum)) ||
      !['none', 'short-rest', 'long-rest', 'dawn'].includes(resource.resetOn)
    ) throw new Error(`Invalid plugin item resource: ${itemId}:${resource.id}`)
    return { ...resource, label: resource.label.trim() }
  })
  if (resources && new Set(resources.map((resource) => resource.id)).size !== resources.length) {
    throw new Error(`Duplicate plugin item resource: ${itemId}`)
  }
  const resourceIds = new Set(resources?.map((resource) => resource.id) ?? [])
  if (use?.resourceCost && (
    !resourceIds.has(use.resourceCost.resourceId) ||
    !finiteInteger(use.resourceCost.amount, 1, 1_000_000)
  )) throw new Error(`Invalid plugin item use resource: ${itemId}`)

  const headlessEffects = definition.headlessEffects?.map((effect) => {
    if ((effect.schemaVersion != null && effect.schemaVersion !== 1) || (effect.id != null && !validId(effect.id))) {
      throw new Error(`Invalid plugin item Headless effect: ${itemId}`)
    }
    if (
      (effect.resourceId != null && !resourceIds.has(effect.resourceId)) ||
      (effect.resourceCost != null && !finiteInteger(effect.resourceCost, 1, 1_000_000))
    ) throw new Error(`Invalid plugin item Headless resource: ${itemId}`)
    if (effect.kind === 'attack-roll-reroll') {
      if (!resourceIds.has(effect.resourceId) || effect.maximumDice !== 1 || effect.trigger !== 'after-attack-roll' ||
        !['attacks-with-this-weapon', 'weapon-attacks'].includes(effect.appliesTo)) {
        throw new Error(`Invalid plugin item Headless effect: ${itemId}`)
      }
    } else if (effect.kind === 'on-hit-bonus-damage') {
      if (
        effect.trigger !== 'after-attack-hit' ||
        !['attacks-with-this-weapon', 'weapon-attacks'].includes(effect.appliesTo) ||
        !finiteInteger(effect.damage.count, 1, 40) || !finiteInteger(effect.damage.sides, 2, 100) ||
        !finiteInteger(effect.damage.bonus, -1_000, 1_000) ||
        (effect.damageType !== 'inherit' && !(DND5E_DAMAGE_TYPES as readonly string[]).includes(effect.damageType)) ||
        (effect.doubleDiceOnCritical != null && typeof effect.doubleDiceOnCritical !== 'boolean') ||
        (effect.oncePerTurn != null && typeof effect.oncePerTurn !== 'boolean')
      ) throw new Error(`Invalid plugin item bonus damage effect: ${itemId}`)
    } else if (effect.kind === 'damage-reduction') {
      if (
        effect.trigger !== 'before-damage' || !finiteInteger(effect.amount, 1, 1_000_000) ||
        (effect.oncePerTurn != null && typeof effect.oncePerTurn !== 'boolean') ||
        (effect.damageTypes != null && (
          !Array.isArray(effect.damageTypes) || effect.damageTypes.length > DND5E_DAMAGE_TYPES.length ||
          effect.damageTypes.some((type) => !(DND5E_DAMAGE_TYPES as readonly string[]).includes(type))
        ))
      ) throw new Error(`Invalid plugin item damage reduction effect: ${itemId}`)
    } else if (effect.kind === 'death-prevention') {
      if (
        effect.trigger !== 'before-drop-to-zero' || !finiteInteger(effect.hitPointsAfter, 1, 1_000_000) ||
        (effect.preventsMassiveDamage != null && typeof effect.preventsMassiveDamage !== 'boolean')
      ) throw new Error(`Invalid plugin item death prevention effect: ${itemId}`)
    } else {
      throw new Error(`Invalid plugin item Headless effect: ${itemId}`)
    }
    if (!input.hasEquipment) throw new Error(`Plugin item Headless effect requires equipment: ${itemId}`)
    return { ...effect, schemaVersion: 1 as const }
  })

  return { use, resources, headlessEffects }
}
