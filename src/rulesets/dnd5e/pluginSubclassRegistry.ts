import type { RegisteredDnd5ePluginSubclass } from './pluginApi'

/**
 * Runtime-only subclass registry.
 *
 * Keeping this state outside pluginApi prevents spellcasting discovery from
 * importing the complete plugin loader (which also imports the spell catalog).
 */
export const dnd5ePluginSubclassRegistry = new Map<string, RegisteredDnd5ePluginSubclass>()

export function dnd5ePluginSubclassRegistryEntry(
  subclassId: string,
): RegisteredDnd5ePluginSubclass | undefined {
  return dnd5ePluginSubclassRegistry.get(subclassId)
}
