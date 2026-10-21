import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { applyDnd5eInventoryMutation, normalizeDnd5eInventory, dnd5eInventoryItemTemplate } from './items'
import { dnd5eMapPhysicalItemTemplate } from './mapInventoryItemAuthoring'
import { dnd5eConditionsFromActiveEffects, normalizeDnd5eActiveEffects } from './activeEffects'
import { dnd5eConditionIncapacitated } from './conditions'
import type { Dnd5eInventoryEntry } from '../../types/inventory'
import { dnd5eInventoryContainerContents, normalizeDnd5eMapInventoryContents } from './mapInventoryContents'

export function dnd5eInventoryEntryCanDrop(entry: Dnd5eInventoryEntry): boolean {
  return (entry.quantity === 1 || !!dnd5eInventoryItemTemplate(entry.templateId)?.ammunitionKind) && !entry.condition?.destroyed && dnd5eMapPhysicalItemTemplate(entry.item) &&
    !(entry.item.equipment?.dnd5e?.kind === 'weapon' && entry.item.equipment.dnd5e.vanishesAfterRelease)
}

/** Host snapshot only. Persist the returned map and roster in one revision-guarded transaction. */
export function prepareDnd5eMapInventoryDrop(input: {
  map: BattleMap; characters: readonly Character[]; actorTokenId: string;
  instanceId: string; expectedInventoryRevision: number; requestId: string;
  combatActive: boolean; currentTokenId?: string;
}): { ok: true; map: BattleMap; characters: Character[]; objectTokenId: string } | { ok: false; reason: string } {
  const fail = (reason: string) => ({ ok: false as const, reason })
  const actor = input.map.tokens.find(t => t.id === input.actorTokenId)
  const character = input.characters.find(c => c.id === actor?.characterId)
  if (!actor || !character || character.currentHp <= 0 || ![actor.x, actor.y].every(Number.isFinite) ||
    dnd5eConditionIncapacitated({ conditions: [...(character.conditions ?? []),
      ...dnd5eConditionsFromActiveEffects(normalizeDnd5eActiveEffects(character.dnd5eCombatState?.activeEffects))] })) return fail('drop-actor-unavailable')
  if (input.combatActive && input.currentTokenId !== actor.id) return fail('drop-invalid-turn')
  if (!input.requestId || input.requestId.length > 150) return fail('drop-invalid-request')
  const inventory = normalizeDnd5eInventory(character)
  if (inventory.revision !== input.expectedInventoryRevision) return fail('drop-inventory-changed')
  const entry = inventory.entries.find(e => e.instanceId === input.instanceId)
  if (!entry || !dnd5eInventoryEntryCanDrop(entry)) return fail('drop-item-unsupported')
  const contents = dnd5eInventoryContainerContents(entry, inventory.entries).map(child => ({ ...structuredClone(child), equippedSlot: undefined }))
  if (!normalizeDnd5eMapInventoryContents(entry, contents.length ? contents : undefined)) return fail('drop-container-invalid')
  if (contents.some(child => !dnd5eMapPhysicalItemTemplate(child.item) ||
    (child.item.equipment?.dnd5e?.kind === 'weapon' && child.item.equipment.dnd5e.vanishesAfterRelease))) return fail('drop-content-unsupported')
  const physicalEntries = [entry, ...contents], physicalIds = new Set(physicalEntries.map(child => child.instanceId))
  const objectTokenId = `dropped:${input.requestId}`
  const conflicts = (item: Token['dnd5eObjectState']) => !!item?.inventoryItem &&
    [item.inventoryItem.instance, ...(item.inventoryItem.contents ?? [])].some(child => child && physicalIds.has(child.instanceId))
  if (input.characters.some(c => c.id !== character.id && normalizeDnd5eInventory(c).entries.some(e => physicalIds.has(e.instanceId))) ||
    input.map.tokens.some(t => t.id === objectTokenId || conflicts(t.dnd5eObjectState) ||
    t.dnd5eCarriedObjects?.some(held => conflicts(held.objectState)))) return fail('drop-instance-conflict')
  const boundEffects = input.characters.flatMap(c => c.dnd5eCombatState?.activeEffects ?? []).filter(effect =>
    physicalIds.has(effect.modifiers?.weaponEnchantment?.inventoryInstanceId ?? effect.modifiers?.armorEnchantment?.inventoryInstanceId ?? '')).map(effect => {
      if (effect.duration.type !== 'concentration' || effect.source.executionId) return effect
      const source = input.characters.find(c => c.id === effect.source.characterId ||
        input.map.tokens.some(t => t.characterId === c.id && t.id === effect.source.actorId))
      const anchor = source?.dnd5eCombatState?.activeEffects?.find(e => e.source.actorId === effect.source.actorId &&
        e.source.rulesId === effect.source.rulesId && e.duration.type === 'concentration' && e.source.executionId)
      return anchor ? { ...effect, source: { ...effect.source, executionId: anchor.source.executionId } } : effect
    })
  let removedCharacters = [...input.characters]
  // Capture first, then remove descendants before their container. Discard's
  // ordinary reparenting must not leave contents in the former owner's pack.
  for (const physical of [...[...contents].reverse(), entry]) {
    const removed = applyDnd5eInventoryMutation(removedCharacters, { type: 'discard', characterId: character.id, instanceId: physical.instanceId, quantity: physical.quantity })
    if (!removed.ok) return fail(removed.reason ?? 'drop-removal-failed')
    removedCharacters = removed.characters
  }
  const object: Token = { id: objectTokenId, type: 'obstacle', label: entry.quantity > 1 ? `${entry.item.name} ×${entry.quantity}` : entry.item.name,
    x: actor.x, y: actor.y, elevationFeet: actor.elevationFeet, size: 1, color: '', emoji: '',
    dnd5eObjectState: { schemaVersion: 1, surfaceProfile: entry.surfaceProfile, structureBinding: entry.structureBinding, weightPounds: physicalEntries.some(child => child.item.weightLb == null) ? undefined : physicalEntries.reduce((sum,child) => sum + child.item.weightLb! * child.quantity, 0), wornOrCarried: false,
      inventoryItem: { templateId: entry.templateId, quantity: entry.quantity, receiptId: objectTokenId, identified: entry.identified,
        instance: { ...structuredClone(entry), equippedSlot: undefined, containerInstanceId: undefined, surfaceExposed: undefined },
        ...(contents.length ? { contents } : {}),
        boundEffects: structuredClone(boundEffects).map(effect => ({ ...effect, targetId: objectTokenId,
          suspendedBy: [...new Set([...(effect.suspendedBy ?? []), 'inventory-binding:not-held'])] })) } } }
  return { ok: true, objectTokenId, characters: removedCharacters, map: { ...input.map, tokens: [...input.map.tokens, object] } }
}
