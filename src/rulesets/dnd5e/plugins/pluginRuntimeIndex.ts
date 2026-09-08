import type { Dnd5eRulesPluginManifest } from './pluginManifestContracts'
import {
  dnd5ePluginRegistryStore,
  type Dnd5eRulesPluginRuntimeAdapterKind,
} from './pluginRegistryStore'

export interface Dnd5eRulesPluginRuntimeIndexEntry {
  manifest: Dnd5eRulesPluginManifest
  integrity?: string
  adapterKind: Dnd5eRulesPluginRuntimeAdapterKind
}

/** Runtime-index facade. The mutable maps stay private to Host registration code. */
export function unregisterDnd5eRulesPlugin(pluginId: string): boolean {
  const registered = dnd5ePluginRegistryStore.plugins.get(pluginId)
  if (!registered) return false
  registered.dispose()
  return true
}

export function registeredDnd5eRulesPlugins(): readonly Dnd5eRulesPluginManifest[] {
  return [...dnd5ePluginRegistryStore.plugins.values()].map(({ plugin }) => ({ ...plugin.manifest }))
}

export function registeredDnd5eRulesPluginRuntimeIndex(): readonly Dnd5eRulesPluginRuntimeIndexEntry[] {
  return [...dnd5ePluginRegistryStore.plugins.values()].map(({ plugin, integrity, adapterKind }) => ({
    manifest: { ...plugin.manifest },
    integrity,
    adapterKind,
  }))
}

export function subscribeDnd5eRulesPluginRegistry(listener: () => void): () => void {
  dnd5ePluginRegistryStore.listeners.add(listener)
  return () => dnd5ePluginRegistryStore.listeners.delete(listener)
}

export function dnd5eRulesPluginRegistrySnapshot(): number {
  return dnd5ePluginRegistryStore.revision
}
