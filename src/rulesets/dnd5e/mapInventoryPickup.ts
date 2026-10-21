import { getDnd5eSrdMonster } from './monsters'
import {resolveDnd5eFortressServantControl} from './fortressServantControl'
import { dnd5eCarriedLoadCapacityPounds } from './carryingCapacity'
import { normalizeDnd5eCompanionCarriedObjects, dnd5eCompanionCarriedWeightPounds, dnd5eMapInventoryUnitWeightPounds } from './companionCarriedObjects'
import { dnd5eCompanionControlBinding } from './companionControlBinding'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import type { Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import { tokenFootprintDistanceCells } from '../../lib/gridCombat'
import { mapGeometryLineOfEffectBlocked, mapGeometryRuntimeForMap, mapGeometryTokenElevation } from '../../lib/mapGeometry'
import { applyDnd5eInventoryGrantBundle, dnd5eInventoryItemTemplate, normalizeDnd5eInventory } from './items'
import { dnd5eMapPhysicalItemTemplate } from './mapInventoryItemAuthoring'
import { normalizeDnd5eMapObjectStateV1 } from './mapObjectState'
import { dnd5eConditionIncapacitated } from './conditions'
import { dnd5eConditionsFromActiveEffects, normalizeDnd5eActiveEffects } from './activeEffects'
import { spendDnd5eTurnResource } from './turnEconomy'
import { reconcileDnd5eInventoryEffectBindings } from './inventoryEffectBindings'
import { dnd5eDestroyedMapObject } from './mapObjectCombatProfile'
import { liveDnd5eMapInventoryBoundEffects } from './mapInventoryBoundEffects'
import { expireDnd5eGroundInventoryAlterations } from './mapInventoryAlteration'

export type MapInventoryPickupResult =
  | { ok: true; map: BattleMap; characters: Character[]; turnEconomy?: Dnd5eTurnEconomyCounts; message: string }
  | { ok: false; reason: string }

/** Host snapshot only. Commit map, characters and turn economy together with revision guards. */
export function prepareDnd5eMapInventoryPickup(input: {
  /** Authoritative combatant capacity, including current ability/effect overrides. */
  companionCapacityPounds?: number;
  /** Host-resolved command source; never authorizes a servant without its live roster. */
  fortressOrder?: {commanderTokenId:string;worldMinute:number};
  geometry?: import('../../lib/mapGeometry').MapGeometryState | null;
  map: BattleMap; characters: readonly Character[]; actorTokenId: string; objectTokenId: string;
  expectedReceiptId: string; expectedQuantity: number;
  combatActive: boolean; combat?: { currentTokenId: string; turnEconomy: Dnd5eTurnEconomyCounts };
}): MapInventoryPickupResult {
  input = { ...input, map: expireDnd5eGroundInventoryAlterations(input.map, input.characters) }
  const fail = (reason: string): MapInventoryPickupResult => ({ ok: false, reason })
  const actor = input.map.tokens.find(t => t.id === input.actorTokenId)
  const character = actor && input.characters.find(c => c.id === actor.characterId)
  const target = input.map.tokens.find(t => t.id === input.objectTokenId)
  const binding = dnd5eCompanionControlBinding(input.map, actor)
  const companion = actor?.type === 'enemy' && !!binding && !binding.controlEnded
  const fortress=input.fortressOrder&&input.geometry?resolveDnd5eFortressServantControl({map:input.map,geometry:input.geometry,
    servantTokenId:input.actorTokenId,...input.fortressOrder}):undefined
  if(input.fortressOrder&&!fortress)return fail('pickup-fortress-unauthorized')
  if (!actor || (!character && !companion&&!fortress) || !target || actor.id === target.id) return fail('pickup-target-unavailable')
  const conditions = [...(character?.conditions ?? []),
    ...dnd5eConditionsFromActiveEffects(normalizeDnd5eActiveEffects([
      ...(character?.dnd5eCombatState?.activeEffects ?? []), ...(actor.dnd5eCombatState?.activeEffects ?? []),
    ]))]
  if ((character?.currentHp ?? actor.hp ?? 0) <= 0 || dnd5eConditionIncapacitated({ conditions }) || character?.dnd5eCombatState?.stunnedByActorId || actor.dnd5eCombatState?.stunnedByActorId) return fail('pickup-actor-unavailable')
  const object = normalizeDnd5eMapObjectStateV1(target.dnd5eObjectState)
  const surfaceProfile = object?.surfaceProfile && {...object.surfaceProfile,surfaceId:object.surfaceProfile.surfaceId ?? target.id}
  const item = object?.inventoryItem
  if (target.type !== 'obstacle' || target.dnd5eSpellEffect || target.dnd5eSummon || !item ||
    object.creation || object.sequester || object.wornOrCarried || object.locked || object.arcaneLock ||
    (object.waterContainer && item.quantity !== 1) || item.instance?.condition?.destroyed ||
    dnd5eDestroyedMapObject(target)) return fail('pickup-object-unsupported')
  if (item.receiptId !== input.expectedReceiptId || item.quantity !== input.expectedQuantity) return fail('pickup-object-changed')
  const template = dnd5eInventoryItemTemplate(item.templateId)
  if (!template || !dnd5eMapPhysicalItemTemplate(template)) return fail('pickup-object-unsupported')
  if (item.instance && item.quantity > 1 && !template.ammunitionKind) return fail('pickup-object-unsupported')
  const contents = item.contents ?? []
  if (contents.length && (template.category !== 'container' || contents.some(child => {
    const definition = dnd5eInventoryItemTemplate(child.templateId)
    return !definition || !dnd5eMapPhysicalItemTemplate(definition) || definition.category !== child.item.category
  }))) return fail('pickup-object-unsupported')
  const physicalIds = new Set([item.instance?.instanceId, ...contents.map(child => child.instanceId)].filter((id): id is string => !!id))
  const conflicts = (state: typeof object | undefined) => !!state?.inventoryItem && [state.inventoryItem.instance, ...(state.inventoryItem.contents ?? [])]
    .some(child => child && physicalIds.has(child.instanceId))
  // A physical instance cannot simultaneously exist on the ground and in an inventory.
  if (item.instance && (input.characters.some(c => normalizeDnd5eInventory(c).entries.some(e => physicalIds.has(e.instanceId))) ||
    input.map.tokens.some(t => t.id !== target.id && (conflicts(t.dnd5eObjectState) ||
      t.dnd5eCarriedObjects?.some(held => conflicts(held.objectState)))))) return fail('pickup-instance-conflict')
  const feet = input.map.feetPerCell ?? 5
  if (!Number.isFinite(feet) || feet <= 0 || !Number.isFinite(input.map.gridSize) || input.map.gridSize <= 0 ||
    ![actor.x, actor.y, target.x, target.y].every(Number.isFinite)) return fail('pickup-invalid-position')
  const geometry = input.geometry === undefined ? mapGeometryRuntimeForMap(input.map.id) : (input.geometry ?? undefined)
  const elevation = mapGeometryTokenElevation(geometry, actor), targetElevation = mapGeometryTokenElevation(geometry, target)
  if (tokenFootprintDistanceCells(actor, target, input.map) * feet > 5 || Math.abs(elevation - targetElevation) > 5 ||
    mapGeometryLineOfEffectBlocked({ geometry, map: input.map, from: actor, to: target,
      fromElevationFeet: elevation, toElevationFeet: targetElevation })) return fail('pickup-out-of-reach')
  let turnEconomy: Dnd5eTurnEconomyCounts | undefined
  if (input.combatActive) {
    if (!input.combat || input.combat.currentTokenId !== (fortress?.commander.id??actor.id)) return fail('pickup-invalid-turn')
    const free = spendDnd5eTurnResource(input.combat.turnEconomy, fortress?'bonusAction':'objectInteraction')
    if(fortress&&!free.ok)return fail('pickup-action-unavailable')
    const spent = free.ok ? free : spendDnd5eTurnResource(input.combat.turnEconomy, 'action')
    if (!spent.ok) return fail('pickup-action-unavailable')
    turnEconomy = spent.economy
  }
  if (!character) {
    const carried=normalizeDnd5eCompanionCarriedObjects(actor.dnd5eCarriedObjects)??[]
    const pickupReceipt=`pickup:${item.receiptId}:${item.quantity}`
    if(carried.some(entry=>entry.pickupReceipt===pickupReceipt))return fail('pickup-already-completed')
    if(carried.length>=1000)return fail('pickup-capacity-unavailable')
    const monster=actor.poolId?getDnd5eSrdMonster(actor.poolId):undefined
    const capacity=fortress?30:input.companionCapacityPounds??(monster?dnd5eCarriedLoadCapacityPounds({abilities:monster.abilities,
      sizeRank:({微型:0,小型:1,中型:2,大型:3,超大型:4,巨型:5} as const)[actor.creatureSize??monster.size],
      classState:actor.dnd5eCombatState}):undefined)
    if(capacity==null||!Number.isFinite(capacity)||capacity<=0)return fail('pickup-capacity-unavailable')
    const unitWeight=dnd5eMapInventoryUnitWeightPounds(object)
    if(fortress&&object.weightPounds==null&&template.weightLb==null)return fail('pickup-weight-unavailable')
    const pickupQuantity = item.instance ? item.quantity : 1
    const nextWeight=dnd5eCompanionCarriedWeightPounds(carried)+unitWeight * pickupQuantity
    if(nextWeight>capacity*(fortress?1:2))return fail('pickup-too-heavy')

    const held={id:crypto.randomUUID(),pickupReceipt,label:target.label,
      objectState:{...structuredClone(object),areaCapture:undefined,surfaceProfile,weightPounds:object.weightPounds==null?undefined:unitWeight * pickupQuantity,wornOrCarried:true,
        inventoryItem:{...item,quantity:pickupQuantity,...(item.instance ? {instance:{...structuredClone(item.instance),containerInstanceId:undefined}} : {})}}}
    return {ok:true,characters:[...input.characters],turnEconomy,message:`${actor.label} 拾取 ${template.name}。`,
      map:{...input.map,tokens:input.map.tokens.flatMap(t=>t.id===actor.id?[{...t,dnd5eCarriedObjects:[...carried,held]}]:
        t.id!==target.id?[t]:item.quantity===pickupQuantity?[]:[{...t,dnd5eObjectState:{...object,surfaceProfile:object.surfaceProfile?{...object.surfaceProfile,surfaceId:crypto.randomUUID()}:undefined,weightPounds:object.weightPounds==null?undefined:object.weightPounds-unitWeight,inventoryItem:{...item,quantity:item.quantity-1}}}])}}
  }
  if (item.instance) {
    const inventory = normalizeDnd5eInventory(character)
    const receipt = `pickup:${item.receiptId}:${item.quantity}`
    if (inventory.authorityGrantReceipts?.includes(receipt)) return fail('pickup-already-completed')
    let restoredEntries: import('../../types/inventory').Dnd5eInventoryEntry[]
    try {
      restoredEntries = normalizeDnd5eInventory({ ...character, equipment: {}, dnd5eInventory: { schemaVersion: 3,
        entries: [{ ...structuredClone(item.instance), surfaceProfile: surfaceProfile ?? item.instance.surfaceProfile, structureBinding: object.structureBinding ?? item.instance.structureBinding,
          equippedSlot: undefined, containerInstanceId: undefined }, ...structuredClone(contents)] } }).entries
    } catch { return fail('pickup-object-unsupported') }
    const expectedEntries = [item.instance, ...contents]
    if (restoredEntries.length !== expectedEntries.length || expectedEntries.some(expected => !restoredEntries.some(restored =>
      restored.instanceId === expected.instanceId && restored.quantity === expected.quantity &&
      restored.containerInstanceId === (expected.instanceId === item.instance!.instanceId ? undefined : expected.containerInstanceId)))) return fail('pickup-object-unsupported')
    return { ok: true, turnEconomy, message: `${character.name} 拾取 ${template.name}。`,
      characters: reconcileDnd5eInventoryEffectBindings(input.characters.map(c => c.id !== character.id ? c : { ...c,
        dnd5eCombatState: { ...c.dnd5eCombatState, schemaVersion: 2, activeEffects: [
          ...(c.dnd5eCombatState?.activeEffects ?? []), ...liveDnd5eMapInventoryBoundEffects(item.boundEffects ?? [], input.map, input.characters)] }, dnd5eInventory: { ...inventory,
        revision: (inventory.revision ?? 0) + 1, entries: [...inventory.entries, ...restoredEntries],
        authorityGrantReceipts: [...(inventory.authorityGrantReceipts ?? []), receipt].slice(-512) } })),
      map: { ...input.map, tokens: input.map.tokens.filter(t => t.id !== target.id) } }
  }
  const grant = applyDnd5eInventoryGrantBundle(input.characters, { characterId: character.id,
    receiptId: `pickup:${item.receiptId}:${item.quantity}`,
    grants: [{ templateId: item.templateId, quantity: 1, identified: item.identified, contaminants: object.consumable?.contaminants,
      waterContainer: object.waterContainer, surfaceProfile, structureBinding: object.structureBinding }],
  })
  if (!grant.ok || grant.deduplicated) return fail(grant.deduplicated ? 'pickup-already-completed' : grant.reason ?? 'pickup-grant-failed')
  return { ok: true, characters: grant.characters, turnEconomy, message: `${character.name} 拾取 ${template.name}。`,
    map: { ...input.map, tokens: input.map.tokens.flatMap(t => t.id !== target.id ? [t] : item.quantity === 1 ? [] : [{
      ...t, dnd5eObjectState: { ...object,
        surfaceProfile:object.surfaceProfile?{...object.surfaceProfile,surfaceId:crypto.randomUUID()}:undefined,
        weightPounds: object.weightPounds == null ? undefined : object.weightPounds - dnd5eMapInventoryUnitWeightPounds(object),
        inventoryItem: { ...item, quantity: item.quantity - 1 } },
    }]) } }
}
