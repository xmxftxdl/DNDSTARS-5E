import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { liveDnd5eMapInventoryBoundEffects } from './mapInventoryBoundEffects'
import { dnd5ePersistentAreaOccupantModifiersAt } from './persistentAreaGeometry'
import type { Dnd5eMonsterStatBlock } from './monsters'
import { normalizeDnd5eCompanionCarriedObjects, type Dnd5eCompanionCarriedObject } from './companionCarriedObjects'
import { dnd5eInventoryItemTemplate } from './items'
import { dnd5eConditionsFromActiveEffects, type Dnd5eActiveEffectInstance } from './activeEffects'
import { dnd5eConditionIncapacitated } from './conditions'
import { dnd5eSummonDurationExpired } from '../../../shared/summon-linger.mjs'

export function dnd5eCompanionSceneWornArmor(token: Token, monster: Dnd5eMonsterStatBlock | undefined,
  map: BattleMap, characters: readonly Character[]) {
  const suppressed = dnd5ePersistentAreaOccupantModifiersAt({ map, token, position: token }).suppressesMagic
  return dnd5eCompanionWornArmor(token, monster, effect => !suppressed &&
    liveDnd5eMapInventoryBoundEffects([effect], map, characters).length > 0)
}

export function dnd5eCompanionArmorDefinition(item: Dnd5eCompanionCarriedObject) {
  const inventory = item.objectState.inventoryItem
  const template = dnd5eInventoryItemTemplate(inventory?.templateId ?? '')
  const armor = template?.equipment?.dnd5e
  return armor?.kind === 'armor' && !armor.magical && !template?.equipment?.effects && !inventory?.instance?.condition?.destroyed
    ? armor : undefined
}

/** Produces a complete time+equipment transaction proposal, never an immediate equip mutation. */
export function prepareDnd5eCompanionArmorChange(input: {
  token: Token; itemId: string | null; proficient: boolean; combatActive: boolean
  startedWorldMinute: number; completedWorldMinute: number
  /** Armor scraps have no published armor category; DM supplies their removal time. */
  nativeArmorDoffMinutes?: number
}) {
  const { token } = input
  if (input.combatActive || token.type !== 'enemy' || (token.hp ?? 0) <= 0 ||
    typeof input.proficient !== 'boolean' || token.dnd5eCombatState?.stunnedByActorId ||
    !Number.isSafeInteger(input.startedWorldMinute) || !Number.isSafeInteger(input.completedWorldMinute) ||
    input.startedWorldMinute < 0 || input.completedWorldMinute < input.startedWorldMinute ||
    dnd5eConditionIncapacitated({ conditions: [...(token.dnd5eCombatState?.conditions ?? []),
      ...dnd5eConditionsFromActiveEffects(token.dnd5eCombatState?.activeEffects ?? [])] })) return undefined
  if (token.dnd5eSummon && dnd5eSummonDurationExpired(token.dnd5eSummon, 0, input.startedWorldMinute)) return undefined
  const carried = normalizeDnd5eCompanionCarriedObjects(token.dnd5eCarriedObjects)
  if (!carried) return undefined
  const previous = carried.find(item => item.wornArmor)
  const next = input.itemId === null ? undefined : carried.find(item => item.id === input.itemId)
  if ((!previous && !next) || previous?.id === input.itemId || (input.itemId !== null && !next)) return undefined
  const previousArmor = previous && dnd5eCompanionArmorDefinition(previous)
  const nextArmor = next && dnd5eCompanionArmorDefinition(next)
  if ((previous && !previousArmor) || (next && !nextArmor)) return undefined
  const nativeArmorPresent = token.poolId === 'srd-5.1:skeleton' && !token.dnd5eNativeArmorRemoved && !previous
  if (nativeArmorPresent && (!Number.isSafeInteger(input.nativeArmorDoffMinutes) ||
    input.nativeArmorDoffMinutes! < 1 || input.nativeArmorDoffMinutes! > 60)) return undefined
  const minutes = (nativeArmorPresent ? input.nativeArmorDoffMinutes! : 0) + (previousArmor ? previousArmor.category === 'heavy' ? 5 : 1 : 0) +
    (nextArmor ? nextArmor.category === 'heavy' ? 10 : nextArmor.category === 'medium' ? 5 : 1 : 0)
  const elapsed = input.completedWorldMinute - input.startedWorldMinute >= minutes
  const interrupted = elapsed && !!token.dnd5eSummon &&
    dnd5eSummonDurationExpired(token.dnd5eSummon, 0, input.completedWorldMinute)
  // The caller must persist the matching clock advancement together with these objects.
  // A preview at the start minute exposes cost, but cannot produce completed equipment.
  return {
    minutes,
    complete: elapsed && !interrupted,
    interrupted,
    nativeArmorRemoved: token.dnd5eNativeArmorRemoved || nativeArmorPresent || (token.poolId === 'srd-5.1:skeleton' && !!previous) || undefined,
    carried: !elapsed || interrupted ? undefined : carried.map(item => ({ ...item,
      wornArmor: item.id === next?.id ? { proficient: input.proficient } : undefined,
    })),
  }
}

/** Ordinary physical armor. Donning authority must settle its time before setting wornArmor. */
export function dnd5eCompanionWornArmor(token: Token, monster: Dnd5eMonsterStatBlock | undefined,
  effectIsLive?: (effect: Dnd5eActiveEffectInstance) => boolean) {
  if (!monster) return undefined
  const worn = normalizeDnd5eCompanionCarriedObjects(token.dnd5eCarriedObjects)?.find(item => item.wornArmor)
  const armor = worn && dnd5eCompanionArmorDefinition(worn)
  const dex = Math.floor((monster.abilities.dex - 10) / 2)
  if (!worn || !armor) return token.dnd5eNativeArmorRemoved && monster.id === 'srd-5.1:skeleton' ? {
    armorClass: 10 + dex, wearingArmor: false, wearingHeavyArmor: false, wearingMetalArmor: false,
    wearingUnproficientArmor: false, armorStealthDisadvantage: false, speedPenaltyFeet: 0,
  } : undefined
  const dexBonus = armor.dexterityBonus === 'none' ? 0 : armor.dexterityBonus === 'max-2' ? Math.min(2, dex) : dex
  const inventory = worn.objectState.inventoryItem
  const template = dnd5eInventoryItemTemplate(inventory?.templateId ?? '')
  const armorId = template?.equipment?.baseEquipmentId ?? template?.equipment?.id
  // Detached item snapshots are not proof that their source is still active.
  // Only the matching physical instance receives a caller-validated enchantment.
  const enchantmentBonus = (inventory?.boundEffects ?? []).reduce((highest, effect) => {
    const binding = effect.modifiers?.armorEnchantment
    return inventory?.instance && binding?.inventoryInstanceId === inventory.instance.instanceId &&
      binding.armorId === armorId && effectIsLive?.(effect) &&
      !effect.suspendedBy?.some(reason => reason !== 'inventory-binding:not-held')
      ? Math.max(highest, binding.armorClassBonus) : highest
  }, 0)
  return {
    armorClass: armor.baseArmorClass + dexBonus + enchantmentBonus,
    wearingArmor: true,
    wearingHeavyArmor: armor.category === 'heavy',
    wearingMetalArmor: armor.material === 'metal',
    wearingUnproficientArmor: !worn.wornArmor!.proficient,
    armorStealthDisadvantage: armor.stealthDisadvantage === true,
    speedPenaltyFeet: armor.strengthRequirement != null && monster.abilities.str < armor.strengthRequirement ? 10 : 0,
  }
}
