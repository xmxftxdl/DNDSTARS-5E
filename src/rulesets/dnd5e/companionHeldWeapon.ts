import { DND5E_DAMAGE_TYPE_LABELS } from './damageTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { liveDnd5eMapInventoryBoundEffects } from './mapInventoryBoundEffects'
import { dnd5ePersistentAreaOccupantModifiersAt } from './persistentAreaGeometry'
import { dnd5eInventoryItemTemplate } from './items'
import { dnd5eMapPhysicalItemTemplate } from './mapInventoryItemAuthoring'
import { normalizeDnd5eCompanionCarriedObjects, type Dnd5eCompanionCarriedObject } from './companionCarriedObjects'
import { dnd5eMonsterProficiencyBonus, type Dnd5eMonsterStatBlock, type Dnd5eMonsterAction } from './monsters'
import type { Dnd5eActiveEffectInstance } from './activeEffects'
import { dnd5eConditionsFromActiveEffects } from './activeEffects'
import { dnd5eConditionIncapacitated } from './conditions'
import type { Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import { spendDnd5eTurnResource } from './turnEconomy'
import { ammunitionKindForWeaponId, dnd5eAmmunitionEntryAccessible } from './ammunitionBindings'

/** Ordinary melee weapons and recognized ammunition weapons; special/magic items remain separate. */
export function dnd5eCompanionHeldWeaponDefinition(item: Dnd5eCompanionCarriedObject) {
  const template = dnd5eInventoryItemTemplate(item.objectState.inventoryItem?.templateId ?? '')
  const weapon = template?.equipment?.dnd5e
  if (!template || !dnd5eMapPhysicalItemTemplate(template) || weapon?.kind !== 'weapon' ||
    weapon.magical || template.equipment?.effects || weapon.properties?.some(p => /特殊|special/.test(p))) return undefined
  if (weapon.mode === 'ranged' && !ammunitionKindForWeaponId(template.equipment!.baseEquipmentId ?? template.equipment!.id)) return undefined
  return { template, weapon, twoHanded: weapon.properties?.some(p => /双手|two-handed/.test(p)) === true }
}

/** Reserve actual accessible ammunition; callers commit only a successful attack transaction. */
function companionAmmunition(carried: readonly Dnd5eCompanionCarriedObject[], weaponId: string,
  effectIsLive?: (effect: Dnd5eActiveEffectInstance) => boolean) {
  const kind = ammunitionKindForWeaponId(weaponId)
  const instances = carried.flatMap(item => item.objectState.inventoryItem?.instance
    ? [item.objectState.inventoryItem.instance, ...(item.objectState.inventoryItem.contents ?? [])] : [])
  const candidates: (Dnd5eCompanionCarriedObject & { packedIn?: Dnd5eCompanionCarriedObject; drawEffect?: Dnd5eActiveEffectInstance })[] = carried.flatMap(item => {
    const inventory = item.objectState.inventoryItem!
    return [item, ...(inventory.contents ?? []).map(instance => ({
      id: `${item.id}:${instance.instanceId}`, pickupReceipt: item.pickupReceipt, label: instance.item.name, packedIn: item,
      objectState: { schemaVersion: 1 as const, wornOrCarried: true,
        inventoryItem: { templateId: instance.templateId, quantity: instance.quantity, receiptId: inventory.receiptId, instance,
          boundEffects: inventory.boundEffects?.filter(effect => effect.modifiers?.weaponEnchantment?.inventoryInstanceId === instance.instanceId) } },
    }))]
  })
  return candidates.filter(item => {
    const inventory = item.objectState.inventoryItem!
    const live = (effect: Dnd5eActiveEffectInstance) => effectIsLive?.(effect) &&
      !effect.suspendedBy?.some(reason => reason !== 'inventory-binding:not-held')
    if (inventory.instance?.containerInstanceId && ['arrow', 'crossbow-bolt'].includes(kind ?? '') &&
      !(inventory.boundEffects ?? []).some(effect => effect.modifiers?.weaponEnchantment?.ammunitionStack && live(effect))) {
      item.drawEffect = carried.flatMap(owner => owner.objectState.inventoryItem?.boundEffects ?? [])
        .filter(effect => effect.modifiers?.weaponEnchantment?.ammunitionContainer && effect.modifiers.weaponEnchantment.consumeOnDraw &&
          effect.modifiers.weaponEnchantment.inventoryInstanceId === inventory.instance!.containerInstanceId &&
          (effect.modifiers.weaponEnchantment.remainingAttacks ?? 0) > 0 && live(effect))
        .sort((left, right) => left.id.localeCompare(right.id))[0]
    }
    return inventory.quantity > 0 && dnd5eInventoryItemTemplate(inventory.templateId)?.ammunitionKind === kind &&
      (!inventory.instance || dnd5eAmmunitionEntryAccessible(inventory.instance, instances)) &&
      // Drawn stacks have their own quota. Container draw enchantments need a separate draw transaction.
      (inventory.boundEffects ?? []).every(effect => effect.modifiers?.weaponEnchantment?.ammunitionStack === true)
  })
}

export function consumeDnd5eCompanionAmmunition(token: Token | undefined, actionIds: readonly string[],
  effectIsLive?: (effect: Dnd5eActiveEffectInstance) => boolean) {
  const held = token?.dnd5eCarriedObjects?.find(item => item.wieldedWeapon)
  const definition = held && dnd5eCompanionHeldWeaponDefinition(held)
  const count = held ? actionIds.filter(id => id === `held-weapon:${held.id}`).length : 0
  if (!definition || definition.weapon.mode !== 'ranged' || count === 0) return { ok: true as const, consumed: 0 }
  if (count > 1 && definition.weapon.properties?.some(property => /装填|loading/i.test(property))) return { ok: false as const }
  const weaponId = definition.template.equipment!.baseEquipmentId ?? definition.template.equipment!.id
  const carried = structuredClone(normalizeDnd5eCompanionCarriedObjects(token?.dnd5eCarriedObjects) ?? [])
  const endedDrawEffects: Dnd5eActiveEffectInstance[] = []
  let remaining = count
  for (const item of companionAmmunition(carried, weaponId, effectIsLive)) {
    const inventory = item.objectState.inventoryItem!
    const used = Math.min(remaining, inventory.quantity)
    if (item.packedIn?.objectState.weightPounds != null) item.packedIn.objectState.weightPounds = Math.max(0,
      item.packedIn.objectState.weightPounds - used * (dnd5eInventoryItemTemplate(inventory.templateId)?.weightLb ?? 0))
    if (item.objectState.weightPounds != null) item.objectState.weightPounds *= (inventory.quantity - used) / inventory.quantity
    inventory.quantity -= used
    if (inventory.instance) inventory.instance.quantity = inventory.quantity
    const draw = item.drawEffect?.modifiers?.weaponEnchantment
    if (draw?.remainingAttacks != null) {
      draw.remainingAttacks = Math.max(0, draw.remainingAttacks - used)
      if (draw.remainingAttacks === 0 && item.drawEffect!.duration.type === 'concentration') endedDrawEffects.push(item.drawEffect!)
    }
    for (const effect of inventory.boundEffects ?? []) {
      const enchantment = effect.modifiers?.weaponEnchantment
      if (enchantment && inventory.instance && enchantment.inventoryInstanceId === inventory.instance.instanceId && enchantment.remainingAttacks != null) {
        enchantment.remainingAttacks = Math.max(0, enchantment.remainingAttacks - used)
      }
    }
    inventory.boundEffects = inventory.boundEffects?.filter(effect => (effect.modifiers?.weaponEnchantment?.remainingAttacks ?? 0) > 0)
    remaining -= used
    if (!remaining) break
  }
  if (remaining) return { ok: false as const }
  for (const item of carried) {
    const inventory = item.objectState.inventoryItem!
    if (inventory.contents) inventory.contents = inventory.contents.filter(entry => entry.quantity > 0)
    inventory.boundEffects = inventory.boundEffects?.filter(effect => !(effect.modifiers?.weaponEnchantment?.ammunitionStack || effect.modifiers?.weaponEnchantment?.consumeOnDraw) ||
      (effect.modifiers.weaponEnchantment.remainingAttacks ?? 0) > 0)
  }
  return { ok: true as const, consumed: count, carried: carried.filter(item => item.objectState.inventoryItem!.quantity > 0), endedDrawEffects }
}

/** Derive the heavy property from the actual held item for both preview and authority. */
export function dnd5eHeldHeavyWeaponDisadvantage(token: Token | undefined, actionId: string, sizeRank: number): boolean {
  if (!token || sizeRank >= 2) return false
  const held = normalizeDnd5eCompanionCarriedObjects(token.dnd5eCarriedObjects)?.find(item =>
    item.wieldedWeapon && (actionId === `held-weapon:${item.id}` || actionId === `held-weapon:${item.id}:two-handed`))
  return !!held && dnd5eCompanionHeldWeaponDefinition(held)?.weapon.properties?.some(property => /重型|heavy/i.test(property)) === true
}

/** Adds one exact held-instance attack without mutating the shared monster catalog. */
export function dnd5eMonsterWithHeldWeapon(monster: Dnd5eMonsterStatBlock | undefined, token: Token | undefined,
  effectIsLive?: (effect: Dnd5eActiveEffectInstance) => boolean): Dnd5eMonsterStatBlock | undefined {
  if (!monster || !token || token.type !== 'enemy') return monster
  const held = normalizeDnd5eCompanionCarriedObjects(token.dnd5eCarriedObjects)?.find(item => item.wieldedWeapon)
  const definition = held && dnd5eCompanionHeldWeaponDefinition(held)
  if (!held || !definition) return monster
  const { weapon, template, twoHanded } = definition
  const item = held.objectState.inventoryItem
  const enchantments = (item?.boundEffects ?? []).filter(effect =>
    item?.instance && effect.modifiers?.weaponEnchantment?.inventoryInstanceId === item.instance.instanceId &&
    effectIsLive?.(effect) && !effect.suspendedBy?.some(reason => reason !== 'inventory-binding:not-held'))
    .map(effect => effect.modifiers!.weaponEnchantment!)
  const weaponId = template.equipment!.baseEquipmentId ?? template.equipment!.id
  const ammunitionCandidate = weapon.mode === 'ranged'
    ? companionAmmunition(normalizeDnd5eCompanionCarriedObjects(token.dnd5eCarriedObjects) ?? [], weaponId, effectIsLive)[0] : undefined
  const ammunition = ammunitionCandidate?.objectState.inventoryItem
  const ammunitionEnchantment = (ammunition?.boundEffects ?? []).filter(effect => {
    const enchantment = effect.modifiers?.weaponEnchantment
    return ammunition?.instance && enchantment?.inventoryInstanceId === ammunition.instance.instanceId &&
      enchantment.ammunitionStack && (enchantment.remainingAttacks ?? 0) > 0 &&
      // weaponIds is the previous inventory owner's projection, not a restriction on the arrow.
      // Selection above already checked the actual stack against this bearer's weapon.
      effectIsLive?.(effect) && !effect.suspendedBy?.some(reason => reason !== 'inventory-binding:not-held')
  }).sort((a, b) => a.id.localeCompare(b.id))[0]?.modifiers?.weaponEnchantment ?? (
    // Match the inventory draw lifecycle: the draw which exhausts a concentration
    // source ends that source before the arrow's subsequent attack.
    ammunitionCandidate?.drawEffect && (ammunitionCandidate.drawEffect.duration.type !== 'concentration' ||
      (ammunitionCandidate.drawEffect.modifiers?.weaponEnchantment?.remainingAttacks ?? 0) > 1)
      ? ammunitionCandidate.drawEffect.modifiers?.weaponEnchantment : undefined)
  const appliedEnchantments = [...enchantments, ...(ammunitionEnchantment ? [ammunitionEnchantment] : [])]
  const enchantmentBonus = Math.max(0, ...enchantments.map(effect => effect.attackAndDamageBonus)) + (ammunitionEnchantment?.attackAndDamageBonus ?? 0)
  const riders = appliedEnchantments.flatMap(effect => effect.bonusDamage ? [{ ...effect.bonusDamage, bonus: 0,
    average: Math.floor(effect.bonusDamage.count * (effect.bonusDamage.sides + 1) / 2) }] : [])
  const ability = weapon.attackAbility === 'finesse'
    ? monster.abilities.dex > monster.abilities.str ? 'dex' : 'str' : weapon.attackAbility
  const bonus = Math.floor((monster.abilities[ability] - 10) / 2) + enchantmentBonus
  const toHit = bonus + (held.wieldedWeapon!.proficient ? dnd5eMonsterProficiencyBonus(monster.challenge.rating) : 0)
  const baseDamage = weapon.damage.sides === 1
    ? { ...weapon.damage, count: 0, sides: 4, bonus: bonus + weapon.damage.count,
        average: Math.max(0, bonus + weapon.damage.count) }
    : { ...weapon.damage, bonus, average: Math.max(0, Math.floor(weapon.damage.count * (weapon.damage.sides + 1) / 2 + bonus)) }
  const baseAction: Dnd5eMonsterAction = { id: `held-weapon:${held.id}`, name: `${template.name}（持用）`,
    kind: 'weapon-attack', automation: 'headless', description: `${template.name}，${twoHanded ? '双手' : '单手'}${weapon.mode === 'ranged' ? '远程（消耗弹药）' : '近战'}。${held.wieldedWeapon!.proficient ? '熟练' : '不熟练'}。${riders.map(damage => `额外 ${damage.count}d${damage.sides} ${DND5E_DAMAGE_TYPE_LABELS[damage.type]}伤害。`).join('')}`,
    ...(twoHanded || weapon.mode === 'ranged' ? { relationRequirement: { kind: 'none-from-source' as const, slotGroup: 'free-hand' } } : {}),
    attack: { mode: weapon.mode, rangeFeet: weapon.rangeFeet, magical: appliedEnchantments.length > 0 || undefined, attackAbility: ability, toHit, reachFeet: weapon.reachFeet ?? 5, target: 'one target',
      damage: [baseDamage, ...riders] } }
  const versatile = weapon.properties?.find(property => /多才多艺|versatile/i.test(property))
  const versatileSides = Number(versatile?.match(/1d(\d+)/i)?.[1] ?? 0)
  const twoHandedAction: Dnd5eMonsterAction[] = !twoHanded && versatileSides > 0 ? [{
    ...baseAction, id: `held-weapon:${held.id}:two-handed`, name: `${template.name}（双手攻击）`,
    description: `${template.name}，双手近战。需要空出维持擒抱的手。`,
    relationRequirement: { kind: 'none-from-source', slotGroup: 'free-hand' },
    attack: { ...baseAction.attack!, damage: [{ ...weapon.damage, count: 1, sides: versatileSides,
      bonus, average: Math.max(0, Math.floor((versatileSides + 1) / 2 + bonus)) }, ...riders] },
  }] : []
  return { ...monster, actions: [...monster.actions, baseAction, ...twoHandedAction] }
}

/** Shared scene projection for UI, planning and the attack preparation boundary. */
export function dnd5eMonsterWithSceneHeldWeapon(monster: Dnd5eMonsterStatBlock | undefined, token: Token | undefined,
  map: BattleMap, characters: readonly Character[]): Dnd5eMonsterStatBlock | undefined {
  if (!token) return monster
  const suppressed = dnd5ePersistentAreaOccupantModifiersAt({ map, token, position: token }).suppressesMagic
  return dnd5eMonsterWithHeldWeapon(monster, token, effect => !suppressed &&
    liveDnd5eMapInventoryBoundEffects([effect], map, characters).length > 0)
}

/** DM equipment preparation, outside combat. Does not claim combat-time equipping economy. */
export function prepareDnd5eCompanionHeldWeapon(token: Token, itemId: string | null, proficient: boolean, occupiedHands = 0) {
  const carried = normalizeDnd5eCompanionCarriedObjects(token.dnd5eCarriedObjects)
  if (token.type !== 'enemy' || !carried || typeof proficient !== 'boolean') return undefined
  if (itemId === null) return carried.map(item => ({ ...item, wieldedWeapon: undefined }))
  // This route equips one single-handed weapon, after stowing any previous one.
  // Maintained free-hand relations are counted by the authoritative scene snapshot.
  if (!Number.isInteger(occupiedHands) || occupiedHands < 0 || occupiedHands >= 2) return undefined
  const selected = carried?.find(item => item.id === itemId)
  if (token.type !== 'enemy' || !selected || !dnd5eCompanionHeldWeaponDefinition(selected) || typeof proficient !== 'boolean') return undefined
  return carried!.map(item => ({ ...item, wieldedWeapon: item.id === itemId ? { proficient } : undefined }))
}

/** One interaction to draw or stow; replacing an existing weapon requires both. */
export function prepareDnd5eCompanionCombatWeaponChange(input: {
  token: Token; itemId: string | null; proficient: boolean
  currentTokenId: string | undefined; economy: Dnd5eTurnEconomyCounts
  occupiedHands?: number
}) {
  const { token, itemId, proficient } = input
  if (input.currentTokenId !== token.id || (token.hp ?? 0) <= 0 ||
    token.dnd5eCombatState?.stunnedByActorId || dnd5eConditionIncapacitated({ conditions: [
      ...(token.dnd5eCombatState?.conditions ?? []),
      ...dnd5eConditionsFromActiveEffects(token.dnd5eCombatState?.activeEffects ?? []),
    ] })) return undefined
  const carried = prepareDnd5eCompanionHeldWeapon(token, itemId, proficient, input.occupiedHands)
  if (!carried) return undefined
  const held = token.dnd5eCarriedObjects?.find(item => item.wieldedWeapon)
  // Repeating a settled request cannot spend again or change proficiency mid-turn.
  if (held?.id === itemId || (!held && itemId === null)) return undefined
  let economy = input.economy
  const interactions = held && itemId !== null ? 2 : 1
  for (let index = 0; index < interactions; index++) {
    const free = spendDnd5eTurnResource(economy, 'objectInteraction')
    const spent = free.ok ? free : spendDnd5eTurnResource(economy, 'action')
    if (!spent.ok) return undefined
    economy = spent.economy
  }
  return { carried, economy, interactions }
}
