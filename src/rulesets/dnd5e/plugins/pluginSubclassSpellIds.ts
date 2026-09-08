import type { DeclarativeSubclassSpellListV1 } from '../declarativeSubclassAbility'
import { dnd5ePluginSubclassRegistry } from '../pluginSubclassRegistry'
import { dnd5ePluginRegistryStore } from './pluginRegistryStore'

/** Lean spell-list query used while the core spell catalog is initialized. */
export function dnd5ePluginSubclassSpellIdsV1(
  subclassId: string | undefined,
  classLevel: number,
  mode?: DeclarativeSubclassSpellListV1['mode'],
): readonly string[] {
  if (!subclassId || classLevel < 1) return []
  const subclass = dnd5ePluginSubclassRegistry.get(subclassId)
  if (!subclass) return []
  return [...new Set((subclass.spellLists ?? [])
    .filter((list) => !mode || list.mode === mode)
    .flatMap((list) => list.entries
      .filter((entry) => entry.classLevel <= classLevel)
      .flatMap((entry) => entry.spellIds))
    .map((spellId) => {
      if (dnd5ePluginRegistryStore.spells.has(spellId)) return spellId
      const ownedSpellId = `${subclass.ownerPluginId}:${spellId}`
      return dnd5ePluginRegistryStore.spells.has(ownedSpellId) ? ownedSpellId : spellId
    }))]
}
