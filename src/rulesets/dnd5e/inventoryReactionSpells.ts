import type { Character } from '../../types/character'
import type { Dnd5eInventoryReactionSpellSnapshot } from '../../types/inventory'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'
import { dnd5eInventoryEntryIsActive, normalizeDnd5eInventory } from './items'
import { dnd5eEffectiveSpellcastingSources } from './subclassSpellcasting'

const REACTION_SPELL_IDS = new Set(['shield', 'counterspell', 'hellish-rebuke'])

export function dnd5eInventoryReactionSpellSnapshots(
  character: Character,
): Dnd5eInventoryReactionSpellSnapshot[] {
  const sources = dnd5eEffectiveSpellcastingSources(character)
  return normalizeDnd5eInventory(character).entries.flatMap((entry) => {
    if (
      entry.quantity < 1 || entry.identified === false ||
      !dnd5eInventoryEntryIsActive(entry)
    ) return []
    const uses = [entry.item.use, ...(entry.item.useActions ?? [])].filter(
      (use): use is NonNullable<typeof use> => use != null,
    )
    return uses.flatMap((use) => {
      const effect = use.effect.kind === 'spell-cast' ? use.effect : undefined
      if (!effect || !REACTION_SPELL_IDS.has(effect.spellId)) return []
      const compatibleSources = effect.spellcastingClassIds?.length
        ? sources.filter((source) => effect.spellcastingClassIds!.includes(source.spellListClassId))
        : sources
      if (compatibleSources.length < 1) return []
      const spellcastingAbility = compatibleSources
        .flatMap((source) => source.definition.spellcasting?.ability
          ? [source.definition.spellcasting.ability]
          : [])
        .sort((left, right) =>
          rules.abilityModifier(character.abilities[right]) -
          rules.abilityModifier(character.abilities[left]))[0]
      if (!spellcastingAbility) return []
      return [{
        instanceId: entry.instanceId,
        templateId: entry.templateId,
        itemName: entry.item.name,
        spellId: effect.spellId as Dnd5eInventoryReactionSpellSnapshot['spellId'],
        castAtLevel: effect.castAtLevel,
        spellSaveDc: effect.spellSaveDc,
        spellAttackBonus: effect.spellAttackBonus,
        spellcastingAbility,
        quantity: entry.quantity,
      }]
    })
  })
}

export function applyDnd5eInventoryReactionSpellSnapshotsToCharacter(input: {
  character: Character
  snapshots: readonly Dnd5eInventoryReactionSpellSnapshot[] | undefined
  revision: number | undefined
}): Character {
  if (!input.snapshots?.length || input.revision == null) return input.character
  const inventory = normalizeDnd5eInventory(input.character)
  const quantities = new Map(input.snapshots.map((snapshot) => [snapshot.instanceId, snapshot.quantity]))
  const entries = inventory.entries.flatMap((entry) => {
    const quantity = quantities.get(entry.instanceId)
    if (quantity == null) return [entry]
    if (quantity < 1) return []
    return [{ ...entry, quantity }]
  })
  if (
    input.revision === inventory.revision &&
    entries.length === inventory.entries.length &&
    entries.every((entry, index) => entry === inventory.entries[index])
  ) return input.character
  return {
    ...input.character,
    dnd5eInventory: {
      ...inventory,
      revision: Math.max(inventory.revision ?? 0, input.revision),
      entries,
    },
  }
}
