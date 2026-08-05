import { dnd5ePluginRegistryStore } from './pluginRegistryStore'
import type { Dnd5eRulesPluginRequirement } from './pluginManifestContracts'

export function activeDnd5eRulesPluginRequirements(): readonly Dnd5eRulesPluginRequirement[] {
  return [...dnd5ePluginRegistryStore.plugins.values()]
    .map(({ plugin, integrity }) => ({
      id: plugin.manifest.id,
      version: plugin.manifest.version,
      stateSchemaVersion: plugin.manifest.stateSchemaVersion ?? 1,
      ...(integrity ? { integrity } : {}),
    }))
    .sort((left, right) => left.id.localeCompare(right.id))
}

function requirementsForPolicies(
  policies: ReadonlySet<string>,
): readonly Dnd5eRulesPluginRequirement[] {
  const ids = new Set(
    [...dnd5ePluginRegistryStore.plugins.values()]
      .filter(({ plugin }) => policies.has(plugin.manifest.distributionPolicy ?? 'local-only'))
      .map(({ plugin }) => plugin.manifest.id),
  )
  return activeDnd5eRulesPluginRequirements().filter((requirement) => ids.has(requirement.id))
}

export function roomDistributableDnd5eRulesPluginRequirements(): readonly Dnd5eRulesPluginRequirement[] {
  return requirementsForPolicies(new Set(['room-distributable']))
}

export function roomActiveDnd5eRulesPluginRequirements(): readonly Dnd5eRulesPluginRequirement[] {
  return requirementsForPolicies(new Set(['room-distributable', 'room-ephemeral']))
}

export function missingDnd5eRulesPluginRequirements(
  required: readonly Dnd5eRulesPluginRequirement[],
  active: readonly Dnd5eRulesPluginRequirement[] = activeDnd5eRulesPluginRequirements(),
): Dnd5eRulesPluginRequirement[] {
  const activeById = new Map(active.map((plugin) => [plugin.id, plugin]))
  return required.filter((requirement) => {
    const installed = activeById.get(requirement.id)
    if (
      !installed || installed.version !== requirement.version ||
      (installed.stateSchemaVersion ?? 1) !== (requirement.stateSchemaVersion ?? 1)
    ) return true
    return !!requirement.integrity && installed.integrity !== requirement.integrity
  })
}
