import type {
  Dnd5eRulesPluginManifest,
  InstalledDnd5eRulesPlugin,
} from '../rulesets/dnd5e'
import type { RoomPluginRequirement } from '../lib/roomSession'

export interface ActiveRulesExtensionRecord {
  manifest: Dnd5eRulesPluginManifest
  installed: InstalledDnd5eRulesPlugin
  roomRequirement?: RoomPluginRequirement
}

export function activeRulesExtensionRecords(input: {
  installed: readonly InstalledDnd5eRulesPlugin[]
  active: readonly Dnd5eRulesPluginManifest[]
  restrictToRoom: boolean
  roomRequirements?: readonly RoomPluginRequirement[]
}): ActiveRulesExtensionRecord[] {
  const installedById = new Map(input.installed.map((entry) => [entry.id, entry]))
  const requirementById = new Map((input.roomRequirements ?? []).map((entry) => [entry.id, entry]))
  return input.active.flatMap((manifest) => {
    const installed = installedById.get(manifest.id)
    if (!installed || !installed.enabled) return []
    if (!input.restrictToRoom) return [{ manifest, installed }]
    const requirement = requirementById.get(manifest.id)
    if (!requirement ||
      requirement.version !== manifest.version ||
      requirement.integrity !== installed.integrity ||
      requirement.stateSchemaVersion !== (manifest.stateSchemaVersion ?? 1)) return []
    return [{ manifest, installed, roomRequirement: requirement }]
  })
}
