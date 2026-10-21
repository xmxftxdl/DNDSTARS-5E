import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import type { Dnd5eInventoryEntry } from '../../types/inventory'
import { dnd5eInventoryItemTemplate, normalizeDnd5eInventory } from './items'
import { normalizeDnd5eMapObjectStateV1 } from './mapObjectState'
import { applyDnd5eActiveEffect, normalizeDnd5eActiveEffects, type Dnd5eActiveEffectInstance } from './activeEffects'
import { mapGeometryLineOfEffectBlocked, mapGeometryRuntimeForMap, mapGeometryTokenElevation } from '../../lib/mapGeometry'
import { dnd5eMapTokenDistanceFeet } from './verticalCombatGeometry'

/** Host-only map handoff. The resolver receives the physical instance, never client item data.
 * Return this map together with the cast's resource/concentration changes in one transaction.
 */
export function prepareDnd5eMapWeaponEnchantment(input: {
  map: BattleMap
  characters: readonly Character[]
  actorTokenId: string
  objectTokenId: string
  carriedItemId?: string
  expectedReceiptId: string
  rangeFeet: number
  appliedAt: number
  resolveEffect: (entry: Dnd5eInventoryEntry) => Dnd5eActiveEffectInstance
}): { ok: true; map: BattleMap; instanceId: string } | { ok: false; reason: string } {
  const fail = (reason: string) => ({ ok: false as const, reason })
  const actor = input.map.tokens.find(token => token.id === input.actorTokenId)
  const target = input.map.tokens.find(token => token.id === input.objectTokenId)
  const carried = input.carriedItemId ? target?.dnd5eCarriedObjects?.find(item => item.id === input.carriedItemId) : undefined
  const object = normalizeDnd5eMapObjectStateV1(input.carriedItemId ? carried?.objectState : target?.dnd5eObjectState)
  const inventory = object?.inventoryItem
  if (!actor || !target || (input.carriedItemId ? target.type !== 'enemy' || !carried?.wieldedWeapon : target.type !== 'obstacle' || object?.wornOrCarried) || !inventory ||
      inventory.receiptId !== input.expectedReceiptId || inventory.quantity !== 1) return fail('invalid-map-weapon')
  if (!Number.isFinite(input.rangeFeet) || input.rangeFeet < 0 || !Number.isFinite(input.appliedAt) ||
      ![actor.x, actor.y, target.x, target.y].every(Number.isFinite)) return fail('invalid-map-weapon-position')
  const geometry = mapGeometryRuntimeForMap(input.map.id)
  if (dnd5eMapTokenDistanceFeet({ map: input.map, geometry, left: actor, right: target }) > input.rangeFeet ||
      mapGeometryLineOfEffectBlocked({ map: input.map, geometry, from: actor, to: target,
        fromElevationFeet: mapGeometryTokenElevation(geometry, actor),
        toElevationFeet: mapGeometryTokenElevation(geometry, target) })) return fail('map-weapon-out-of-reach')
  const template = inventory.instance?.item ?? dnd5eInventoryItemTemplate(inventory.templateId)
  const weapon = template?.equipment?.dnd5e
  if (!template || weapon?.kind !== 'weapon' || !['simple', 'martial'].includes(weapon.category) ||
      inventory.instance?.condition?.destroyed) return fail('invalid-map-weapon')
  const entry: Dnd5eInventoryEntry = inventory.instance ?? {
    instanceId: `map-item:${inventory.receiptId.slice(0, 250)}`, templateId: inventory.templateId,
    item: structuredClone(template), quantity: 1, acquiredAt: input.appliedAt, identified: inventory.identified,
  }
  if (input.characters.some(character => normalizeDnd5eInventory(character).entries.some(item => item.instanceId === entry.instanceId)) ||
      input.map.tokens.some(token => ((token.id !== target.id || !!input.carriedItemId) && token.dnd5eObjectState?.inventoryItem?.instance?.instanceId === entry.instanceId) ||
        token.dnd5eCarriedObjects?.some(item => !(token.id === target.id && item.id === input.carriedItemId) && item.objectState.inventoryItem?.instance?.instanceId === entry.instanceId))) {
    return fail('map-weapon-instance-conflict')
  }
  const resolved = input.resolveEffect(structuredClone(entry))
  const effect = normalizeDnd5eActiveEffects([resolved])[0]
  if (!effect || effect.source.actorId !== actor.id ||
      effect.modifiers?.weaponEnchantment?.inventoryInstanceId !== entry.instanceId) return fail('invalid-map-weapon-effect')
  const incoming = { ...effect, suspendedBy: [...new Set([...(effect.suspendedBy ?? []), 'inventory-binding:not-held'])] }
  const mutation = applyDnd5eActiveEffect({ effects: inventory.boundEffects, incoming })
  if (mutation.status.startsWith('rejected')) return fail('map-weapon-effect-rejected')
  const updatedObject = { ...object!, inventoryItem: { ...inventory, instance: structuredClone(entry), boundEffects: mutation.effects } }
  return { ok: true, instanceId: entry.instanceId, map: { ...input.map, tokens: input.map.tokens.map(token => token.id === target.id
    ? input.carriedItemId
      ? { ...token, dnd5eCarriedObjects: token.dnd5eCarriedObjects!.map(item => item.id === input.carriedItemId ? { ...item, objectState: updatedObject } : item) }
      : { ...token, dnd5eObjectState: updatedObject } : token) } }
}
