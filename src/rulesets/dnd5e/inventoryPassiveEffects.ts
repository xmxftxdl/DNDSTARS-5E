import type { Character } from '../../types/character'
import { createDnd5eMechanicalEffect, normalizeDnd5eActiveEffects, applyDnd5eActiveEffect } from './activeEffects'
import { dnd5eInventoryEntryIsActive, normalizeDnd5eInventory } from './items'

const prefix = 'inventory-equipped-passive:'
/** Rebuild from currently equipped, identified and attuned instances; never retain stale grants. */
export function dnd5eInventoryPassiveEffects(character: Character) {
  const persisted = normalizeDnd5eActiveEffects(character.dnd5eCombatState?.activeEffects)
    .filter(effect => !effect.id.startsWith(prefix))
  const projected = normalizeDnd5eInventory(character).entries.flatMap(entry => {
    if (!entry.equippedSlot || !dnd5eInventoryEntryIsActive(entry)) return []
    return (entry.item.headlessEffects ?? []).flatMap((effect, index) => effect.kind !== 'equipped-passive' ? [] : [createDnd5eMechanicalEffect({
      id: `${prefix}${entry.instanceId}:${effect.id ?? index}`, definitionId: `${entry.item.id}:equipped`,
      kind: 'buff', label: entry.item.name, targetId: character.id, appliedAt: entry.acquiredAt,
      source: { kind: 'item', rulesId: entry.item.id, actorId: character.id, label: entry.item.name, magical: true },
      duration: { type: 'permanent' }, modifiers: effect.modifiers,
      stackingKey: `${entry.item.id}:equipped:${effect.id ?? index}`, stackingPolicy: 'keep-strongest',
    })])
  })
  return projected.reduce((effects, incoming) => applyDnd5eActiveEffect({ effects, incoming }).effects, persisted)
}
