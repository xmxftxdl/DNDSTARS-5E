import type { Character } from '../../types/character'
import type { Dnd5eAttackRollRerollEffect, Dnd5eInventoryEntry, Dnd5eInventoryResourceState } from '../../types/inventory'
import { dnd5eInventoryEntryIsActive, normalizeDnd5eInventory } from './items'

export interface Dnd5eAttackRollRerollCandidate {
  instanceId: string
  effectId: string
  itemName: string
  resource: Dnd5eInventoryResourceState
  effect: Dnd5eAttackRollRerollEffect
}

export function dnd5eAttackRollRerollCandidates(
  character: Character,
  weaponId: string,
): Dnd5eAttackRollRerollCandidate[] {
  return normalizeDnd5eInventory(character).entries.flatMap((entry) => {
    if (!entry.equippedSlot || !dnd5eInventoryEntryIsActive(entry)) return []
    return (entry.item.headlessEffects ?? []).flatMap((effect, effectIndex) => {
      if (effect.kind !== 'attack-roll-reroll') return []
      if (effect.appliesTo === 'attacks-with-this-weapon' && entry.item.equipment?.id !== weaponId) return []
      const resource = entry.resources?.[effect.resourceId]
      if (!resource || resource.current < 1) return []
      return [{
        instanceId: entry.instanceId,
        effectId: effect.id ?? `attack-roll-reroll:${effectIndex}`,
        itemName: entry.item.name,
        resource: { ...resource },
        effect: { ...effect },
      }]
    })
  })
}

/** Includes a depleted resource so a durable receipt can still deduplicate replay. */
export function dnd5eAttackRollRerollCandidateForInstance(
  character: Character,
  weaponId: string,
  instanceId: string,
  effectId: string,
): Dnd5eAttackRollRerollCandidate | undefined {
  const entry = normalizeDnd5eInventory(character).entries.find((candidate) =>
    candidate.instanceId === instanceId && candidate.equippedSlot && dnd5eInventoryEntryIsActive(candidate),
  )
  if (!entry) return undefined
  for (const [effectIndex, effect] of (entry.item.headlessEffects ?? []).entries()) {
    if (effect.kind !== 'attack-roll-reroll') continue
    const normalizedEffectId = effect.id ?? `attack-roll-reroll:${effectIndex}`
    if (normalizedEffectId !== effectId) continue
    if (effect.appliesTo === 'attacks-with-this-weapon' && entry.item.equipment?.id !== weaponId) return undefined
    const resource = entry.resources?.[effect.resourceId]
    if (!resource) return undefined
    return {
      instanceId: entry.instanceId,
      effectId: normalizedEffectId,
      itemName: entry.item.name,
      resource: { ...resource },
      effect: { ...effect },
    }
  }
  return undefined
}

export function dnd5eInventoryEntryHasAttackReroll(entry: Dnd5eInventoryEntry): boolean {
  return !!entry.item.headlessEffects?.some((effect) => effect.kind === 'attack-roll-reroll')
}
