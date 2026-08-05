import type { Dnd5ePluginHeadlessActionDefinition } from './pluginHeadlessContracts'
import { dnd5ePluginRegistryStore } from './pluginRegistryStore'

export function dnd5ePluginHeadlessActionDefinition(
  pluginId: string,
  actionId: string,
): Dnd5ePluginHeadlessActionDefinition | undefined {
  const definition = dnd5ePluginRegistryStore.headlessActions.get(`${pluginId}:${actionId}`)?.definition
  return definition ? {
    ...definition,
    rolls: definition.rolls?.map((roll) => ({ ...roll })),
  } : undefined
}
