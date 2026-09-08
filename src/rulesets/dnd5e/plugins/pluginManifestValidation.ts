import {
  DND5E_RULES_PLUGIN_RULESET_ID,
  DND5E_RULES_PLUGIN_SUPPORTED_API_VERSIONS,
  type Dnd5ePluginDeclaredCapability,
  type Dnd5eRulesPluginManifest,
} from './pluginManifestContracts'
import { isDnd5ePluginContentCategory } from '../../../../shared/plugin-content-category.mjs'

function validId(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]*$/.test(value)
}

/** Fail-closed validation for every legacy and Unified plugin loading boundary. */
export function validateDnd5eRulesPluginManifest(manifest: Dnd5eRulesPluginManifest): void {
  if (!manifest || typeof manifest !== 'object') throw new Error('Invalid D&D 5e rules plugin manifest')
  if (!validId(manifest.id)) throw new Error(`Invalid D&D 5e rules plugin id: ${manifest.id}`)
  if (
    typeof manifest.name !== 'string' || typeof manifest.publisher !== 'string' ||
    typeof manifest.version !== 'string' || typeof manifest.license !== 'string' ||
    !manifest.name.trim() || !manifest.publisher.trim() || !manifest.version.trim() || !manifest.license.trim()
  ) throw new Error(`Incomplete D&D 5e rules plugin manifest: ${manifest.id}`)
  if (
    (manifest.description != null && typeof manifest.description !== 'string') ||
    (manifest.homepage != null && typeof manifest.homepage !== 'string')
  ) throw new Error(`Invalid D&D 5e rules plugin manifest metadata: ${manifest.id}`)
  if (manifest.pluginKind != null && !['content-package', 'automation-plugin'].includes(manifest.pluginKind)) {
    throw new Error(`Invalid D&D 5e plugin kind: ${manifest.id}`)
  }
  if (manifest.stateSchemaVersion != null && (
    !Number.isInteger(manifest.stateSchemaVersion) || manifest.stateSchemaVersion < 1 || manifest.stateSchemaVersion > 1_000
  )) throw new Error(`Invalid plugin state schema version: ${manifest.id}`)
  if (manifest.manifestSchemaVersion != null && manifest.manifestSchemaVersion !== 1) {
    throw new Error(`Unsupported plugin manifest schema: ${manifest.id}`)
  }
  if (manifest.minimumGameProtocolVersion != null && (
    !Number.isInteger(manifest.minimumGameProtocolVersion) || manifest.minimumGameProtocolVersion < 1
  )) throw new Error(`Invalid minimum game protocol: ${manifest.id}`)
  if (manifest.dependencies != null && (
    !Array.isArray(manifest.dependencies) || manifest.dependencies.length > 32 ||
    manifest.dependencies.some((dependency) =>
      !dependency || !validId(dependency.id) || dependency.id === manifest.id ||
      typeof dependency.versionRange !== 'string' || dependency.versionRange.length < 1 ||
      dependency.versionRange.length > 120 ||
      (dependency.optional != null && typeof dependency.optional !== 'boolean'))
  )) throw new Error(`Invalid plugin dependencies: ${manifest.id}`)
  if (manifest.conflicts != null && (
    !Array.isArray(manifest.conflicts) || manifest.conflicts.length > 32 ||
    manifest.conflicts.some((pluginId) => !validId(pluginId) || pluginId === manifest.id)
  )) throw new Error(`Invalid plugin conflicts: ${manifest.id}`)
  const capabilities = new Set<Dnd5ePluginDeclaredCapability>([
    'damage', 'healing', 'temporary-hit-points', 'standard-condition', 'movement',
    'resource', 'summon', 'persistent-area', 'spell-transaction', 'interrupt',
  ])
  if (manifest.declaredCapabilities != null && (
    !Array.isArray(manifest.declaredCapabilities) || manifest.declaredCapabilities.length > capabilities.size ||
    manifest.declaredCapabilities.some((capability) => !capabilities.has(capability))
  )) throw new Error(`Invalid plugin capabilities: ${manifest.id}`)
  if (manifest.distributionPolicy != null &&
    !['room-distributable', 'room-ephemeral', 'account-entitled', 'local-only'].includes(manifest.distributionPolicy)) {
    throw new Error(`Invalid plugin distribution policy: ${manifest.id}`)
  }
  if (manifest.contentCategory != null && !isDnd5ePluginContentCategory(manifest.contentCategory)) {
    throw new Error(`Invalid plugin content category: ${manifest.id}`)
  }
  if (!(DND5E_RULES_PLUGIN_SUPPORTED_API_VERSIONS as readonly number[]).includes(manifest.apiVersion)) {
    throw new Error(`Unsupported rules plugin API version: ${manifest.apiVersion}`)
  }
  if (manifest.rulesetId !== DND5E_RULES_PLUGIN_RULESET_ID) {
    throw new Error(`Unsupported ruleset for plugin ${manifest.id}: ${manifest.rulesetId}`)
  }
}
