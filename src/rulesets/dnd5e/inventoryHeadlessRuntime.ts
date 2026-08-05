import type { Character } from '../../types/character'
import type {
  Dnd5eDamageReductionEffect,
  Dnd5eDeathPreventionEffect,
  Dnd5eInventoryHeadlessEffectSnapshot,
  Dnd5eInventoryResourceState,
  Dnd5eOnHitBonusDamageEffect,
} from '../../types/inventory'
import type { Dnd5eCombatant } from './headlessCombatEngine'
import type { Dnd5eDamageType } from './damageTypes'
import { dnd5eInventoryEntryIsActive, normalizeDnd5eInventory } from './items'

export interface Dnd5eInventoryEffectApplication {
  instanceId: string
  effectId: string
  itemName: string
  kind: 'on-hit-bonus-damage' | 'damage-reduction' | 'death-prevention'
  amount: number
  damageType?: Dnd5eDamageType
}

export interface Dnd5eOnHitBonusDamageRequirement {
  key: string
  instanceId: string
  effectId: string
  itemName: string
  count: number
  sides: number
  bonus: number
  damageType: 'inherit' | Dnd5eDamageType
}

export interface Dnd5eOnHitBonusDamageResolution {
  ok: boolean
  reason?: 'invalid-inventory-effect-rolls'
  components: readonly { total: number; type: Dnd5eDamageType; application: Dnd5eInventoryEffectApplication }[]
}

function normalizedEffectId(kind: string, index: number, id?: string): string {
  return id ?? `${kind}:${index}`
}

export function dnd5eInventoryHeadlessEffectSnapshots(
  character: Character,
): Dnd5eInventoryHeadlessEffectSnapshot[] {
  return normalizeDnd5eInventory(character).entries.flatMap((entry) => {
    if (!entry.equippedSlot || !dnd5eInventoryEntryIsActive(entry)) return []
    return (entry.item.headlessEffects ?? []).map((effect, index) => ({
      instanceId: entry.instanceId,
      templateId: entry.templateId,
      itemName: entry.item.name,
      equipmentId: entry.item.equipment?.id,
      equippedSlot: entry.equippedSlot,
      effectId: normalizedEffectId(effect.kind, index, effect.id),
      effect: structuredClone(effect),
      resources: Object.fromEntries(Object.entries(entry.resources ?? {}).map(([id, resource]) => [
        id,
        { ...resource },
      ])),
    }))
  })
}

export function dnd5eInventoryEffectRollKey(instanceId: string, effectId: string): string {
  return `${instanceId}:${effectId}`
}

function liveEffectSnapshot(
  combatant: Dnd5eCombatant,
  snapshot: Dnd5eInventoryHeadlessEffectSnapshot,
): Dnd5eInventoryHeadlessEffectSnapshot | undefined {
  return combatant.inventoryHeadlessEffects?.find((candidate) =>
    candidate.instanceId === snapshot.instanceId && candidate.effectId === snapshot.effectId,
  )
}

function effectResourceAvailable(
  combatant: Dnd5eCombatant,
  snapshot: Dnd5eInventoryHeadlessEffectSnapshot,
): boolean {
  const live = liveEffectSnapshot(combatant, snapshot) ?? snapshot
  const { resourceId, resourceCost = resourceId ? 1 : 0 } = snapshot.effect
  if (!resourceId) return resourceCost === 0
  return (live.resources[resourceId]?.current ?? 0) >= resourceCost
}

function spendEffectResource(
  combatant: Dnd5eCombatant,
  snapshot: Dnd5eInventoryHeadlessEffectSnapshot,
): boolean {
  const { resourceId, resourceCost = resourceId ? 1 : 0 } = snapshot.effect
  if (!resourceId) return resourceCost === 0
  const live = liveEffectSnapshot(combatant, snapshot)
  const resource = live?.resources[resourceId]
  if (!resource || resource.current < resourceCost) return false
  combatant.inventoryHeadlessEffects = (combatant.inventoryHeadlessEffects ?? []).map((candidate) => {
    if (candidate.instanceId !== snapshot.instanceId) return candidate
    const shared = candidate.resources[resourceId]
    if (!shared) return candidate
    return {
      ...candidate,
      resources: {
        ...candidate.resources,
        [resourceId]: { ...shared, current: Math.max(0, shared.current - resourceCost) },
      },
    }
  })
  combatant.inventoryRevision = Math.max(0, Math.floor(combatant.inventoryRevision ?? 0)) + 1
  return true
}

function effectAvailableThisTurn(
  combatant: Dnd5eCombatant,
  snapshot: Dnd5eInventoryHeadlessEffectSnapshot,
  turnKey: string,
  oncePerTurn: boolean | undefined,
): boolean {
  if (!oncePerTurn) return true
  return combatant.classState.inventoryEffectUsedTurnKeys?.[
    dnd5eInventoryEffectRollKey(snapshot.instanceId, snapshot.effectId)
  ] !== turnKey
}

function markEffectUsedThisTurn(
  combatant: Dnd5eCombatant,
  snapshot: Dnd5eInventoryHeadlessEffectSnapshot,
  turnKey: string,
  oncePerTurn: boolean | undefined,
): void {
  if (!oncePerTurn) return
  combatant.classState.inventoryEffectUsedTurnKeys = {
    ...(combatant.classState.inventoryEffectUsedTurnKeys ?? {}),
    [dnd5eInventoryEffectRollKey(snapshot.instanceId, snapshot.effectId)]: turnKey,
  }
}

function weaponEffectApplies(
  snapshot: Dnd5eInventoryHeadlessEffectSnapshot,
  appliesTo: 'attacks-with-this-weapon' | 'weapon-attacks',
  weaponId: string | undefined,
): boolean {
  return appliesTo === 'weapon-attacks' || (!!weaponId && snapshot.equipmentId === weaponId)
}

export function dnd5eOnHitBonusDamageRequirements(input: {
  combatant: Dnd5eCombatant
  weaponId?: string
  critical: boolean
  turnKey: string
}): Dnd5eOnHitBonusDamageRequirement[] {
  const remainingResources = new Map<string, number>()
  const requirements: Dnd5eOnHitBonusDamageRequirement[] = []
  const candidates = (input.combatant.inventoryHeadlessEffects ?? [])
    .filter((snapshot): snapshot is Dnd5eInventoryHeadlessEffectSnapshot & { effect: Dnd5eOnHitBonusDamageEffect } =>
      snapshot.effect.kind === 'on-hit-bonus-damage',
    )
    .sort((left, right) => dnd5eInventoryEffectRollKey(left.instanceId, left.effectId)
      .localeCompare(dnd5eInventoryEffectRollKey(right.instanceId, right.effectId)))
  for (const snapshot of candidates) {
    const effect = snapshot.effect
    if (
      !weaponEffectApplies(snapshot, effect.appliesTo, input.weaponId) ||
      !effectResourceAvailable(input.combatant, snapshot) ||
      !effectAvailableThisTurn(input.combatant, snapshot, input.turnKey, effect.oncePerTurn)
    ) continue
    if (effect.resourceId) {
      const resourceKey = `${snapshot.instanceId}:${effect.resourceId}`
      const available = remainingResources.get(resourceKey)
        ?? snapshot.resources[effect.resourceId]?.current
        ?? 0
      const cost = effect.resourceCost ?? 1
      if (available < cost) continue
      remainingResources.set(resourceKey, available - cost)
    }
    const count = effect.damage.count * (input.critical && effect.doubleDiceOnCritical !== false ? 2 : 1)
    requirements.push({
      key: dnd5eInventoryEffectRollKey(snapshot.instanceId, snapshot.effectId),
      instanceId: snapshot.instanceId,
      effectId: snapshot.effectId,
      itemName: snapshot.itemName,
      count,
      sides: effect.damage.sides,
      bonus: effect.damage.bonus,
      damageType: effect.damageType,
    })
  }
  return requirements
}

export function resolveDnd5eOnHitBonusDamage(input: {
  combatant: Dnd5eCombatant
  weaponId?: string
  inheritedDamageType: Dnd5eDamageType
  critical: boolean
  turnKey: string
  rolls?: Readonly<Record<string, readonly number[]>>
}): Dnd5eOnHitBonusDamageResolution {
  const requirements = dnd5eOnHitBonusDamageRequirements(input)
  const supplied = input.rolls ?? {}
  const requirementKeys = new Set(requirements.map((entry) => entry.key))
  if (Object.keys(supplied).some((key) => !requirementKeys.has(key))) {
    return { ok: false, reason: 'invalid-inventory-effect-rolls', components: [] }
  }
  for (const requirement of requirements) {
    const rolls = supplied[requirement.key]
    if (
      !rolls || rolls.length !== requirement.count ||
      rolls.some((roll) => !Number.isInteger(roll) || roll < 1 || roll > requirement.sides)
    ) return { ok: false, reason: 'invalid-inventory-effect-rolls', components: [] }
  }

  const components: Dnd5eOnHitBonusDamageResolution['components'][number][] = []
  for (const requirement of requirements) {
    const snapshot = input.combatant.inventoryHeadlessEffects?.find((candidate) =>
      candidate.instanceId === requirement.instanceId && candidate.effectId === requirement.effectId,
    )
    if (!snapshot || snapshot.effect.kind !== 'on-hit-bonus-damage' || !spendEffectResource(input.combatant, snapshot)) {
      return { ok: false, reason: 'invalid-inventory-effect-rolls', components: [] }
    }
    markEffectUsedThisTurn(input.combatant, snapshot, input.turnKey, snapshot.effect.oncePerTurn)
    const total = Math.max(0, (supplied[requirement.key] ?? []).reduce((sum, roll) => sum + roll, 0) + requirement.bonus)
    const type = requirement.damageType === 'inherit' ? input.inheritedDamageType : requirement.damageType
    components.push({
      total,
      type,
      application: {
        instanceId: snapshot.instanceId,
        effectId: snapshot.effectId,
        itemName: snapshot.itemName,
        kind: 'on-hit-bonus-damage',
        amount: total,
        damageType: type,
      },
    })
  }
  return { ok: true, components }
}

export function resolveDnd5eInventoryDamageReduction(input: {
  combatant: Dnd5eCombatant
  amount: number
  damageTypes: readonly Dnd5eDamageType[]
  turnKey: string
}): { amount: number; applications: Dnd5eInventoryEffectApplication[] } {
  let amount = Math.max(0, input.amount)
  const applications: Dnd5eInventoryEffectApplication[] = []
  const candidates = (input.combatant.inventoryHeadlessEffects ?? [])
    .filter((snapshot): snapshot is Dnd5eInventoryHeadlessEffectSnapshot & { effect: Dnd5eDamageReductionEffect } =>
      snapshot.effect.kind === 'damage-reduction',
    )
    .sort((left, right) => dnd5eInventoryEffectRollKey(left.instanceId, left.effectId)
      .localeCompare(dnd5eInventoryEffectRollKey(right.instanceId, right.effectId)))
  for (const snapshot of candidates) {
    const effect = snapshot.effect
    if (
      amount <= 0 || !effectResourceAvailable(input.combatant, snapshot) ||
      !effectAvailableThisTurn(input.combatant, snapshot, input.turnKey, effect.oncePerTurn) ||
      (effect.damageTypes?.length && !effect.damageTypes.some((type) => input.damageTypes.includes(type)))
    ) continue
    const reduction = Math.min(amount, effect.amount)
    if (reduction <= 0 || !spendEffectResource(input.combatant, snapshot)) continue
    amount -= reduction
    markEffectUsedThisTurn(input.combatant, snapshot, input.turnKey, effect.oncePerTurn)
    applications.push({
      instanceId: snapshot.instanceId,
      effectId: snapshot.effectId,
      itemName: snapshot.itemName,
      kind: 'damage-reduction',
      amount: reduction,
    })
  }
  return { amount, applications }
}

export function resolveDnd5eInventoryDeathPrevention(input: {
  combatant: Dnd5eCombatant
  remainingDamageAfterZero: number
}): Dnd5eInventoryEffectApplication | undefined {
  const candidate = (input.combatant.inventoryHeadlessEffects ?? [])
    .filter((snapshot): snapshot is Dnd5eInventoryHeadlessEffectSnapshot & { effect: Dnd5eDeathPreventionEffect } =>
      snapshot.effect.kind === 'death-prevention' && effectResourceAvailable(input.combatant, snapshot),
    )
    .sort((left, right) => dnd5eInventoryEffectRollKey(left.instanceId, left.effectId)
      .localeCompare(dnd5eInventoryEffectRollKey(right.instanceId, right.effectId)))
    .find((snapshot) => snapshot.effect.preventsMassiveDamage === true || input.remainingDamageAfterZero < input.combatant.maxHp)
  if (!candidate || !spendEffectResource(input.combatant, candidate)) return undefined
  input.combatant.currentHp = Math.max(1, Math.min(input.combatant.maxHp, candidate.effect.hitPointsAfter))
  if (input.combatant.classState.wildShapeFormId) {
    input.combatant.classState.wildShapeCurrentHp = input.combatant.currentHp
  }
  return {
    instanceId: candidate.instanceId,
    effectId: candidate.effectId,
    itemName: candidate.itemName,
    kind: 'death-prevention',
    amount: input.combatant.currentHp,
  }
}

export function applyDnd5eInventoryHeadlessSnapshotToCharacter(input: {
  character: Character
  snapshots: readonly Dnd5eInventoryHeadlessEffectSnapshot[] | undefined
  revision: number | undefined
}): Character {
  if (!input.snapshots || input.snapshots.length === 0 || input.revision == null) return input.character
  const inventory = normalizeDnd5eInventory(input.character)
  if (input.revision === inventory.revision) return input.character
  const byInstance = new Map<string, Record<string, Dnd5eInventoryResourceState>>()
  for (const snapshot of input.snapshots) {
    const current = byInstance.get(snapshot.instanceId) ?? {}
    for (const [resourceId, resource] of Object.entries(snapshot.resources)) {
      const prior = current[resourceId]
      current[resourceId] = prior && prior.current < resource.current ? prior : { ...resource }
    }
    byInstance.set(snapshot.instanceId, current)
  }
  return {
    ...input.character,
    dnd5eInventory: {
      ...inventory,
      revision: input.revision,
      entries: inventory.entries.map((entry) => {
        const resources = byInstance.get(entry.instanceId)
        return resources ? { ...entry, resources } : entry
      }),
    },
  }
}
