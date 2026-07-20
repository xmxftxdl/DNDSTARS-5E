import type { Character } from '../../types/character'
import type { Dnd5eAttackRollRerollEffect, Dnd5eInventoryEntry, Dnd5eInventoryResourceState } from '../../types/inventory'
import { normalizeDnd5eInventory } from './items'

export interface Dnd5eAttackRollRerollCandidate {
  instanceId: string
  itemName: string
  resource: Dnd5eInventoryResourceState
  effect: Dnd5eAttackRollRerollEffect
}

export function dnd5eAttackRollRerollCandidates(
  character: Character,
  weaponId: string,
): Dnd5eAttackRollRerollCandidate[] {
  return normalizeDnd5eInventory(character).entries.flatMap((entry) => {
    if (!entry.equippedSlot) return []
    return (entry.item.headlessEffects ?? []).flatMap((effect) => {
      if (effect.kind !== 'attack-roll-reroll') return []
      if (effect.appliesTo === 'attacks-with-this-weapon' && entry.item.equipment?.id !== weaponId) return []
      const resource = entry.resources?.[effect.resourceId]
      if (!resource || resource.current < 1) return []
      return [{ instanceId: entry.instanceId, itemName: entry.item.name, resource: { ...resource }, effect: { ...effect } }]
    })
  })
}

export function dnd5eInventoryEntryHasAttackReroll(entry: Dnd5eInventoryEntry): boolean {
  return !!entry.item.headlessEffects?.some((effect) => effect.kind === 'attack-roll-reroll')
}
