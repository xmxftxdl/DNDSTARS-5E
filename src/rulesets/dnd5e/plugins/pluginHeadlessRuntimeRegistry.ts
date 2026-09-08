import type { Dnd5ePluginHeadlessActionDefinition } from './pluginHeadlessContracts'
import { dnd5ePluginRegistryStore } from './pluginRegistryStore'
import { DND5E_SRD_AUDITED_SPELL_PACKAGE_ID } from '../activities/dnd5eSrdAuditedSpellActivities'
import { ensureDnd5eCoreSpellActivitiesRegisteredV1 } from '../activities/dnd5eCoreSpellActivities'
import { getRegisteredDnd5eActivity } from '../activities/dnd5eActivityRegistry'
import { compileDnd5eActivityHeadlessAction } from '../activities/dnd5eActivityHeadlessCompiler'

export function dnd5ePluginHeadlessActionDefinition(
  pluginId: string,
  actionId: string,
): Dnd5ePluginHeadlessActionDefinition | undefined {
  const definition = dnd5ePluginRegistryStore.headlessActions.get(`${pluginId}:${actionId}`)?.definition
  if (definition) return {
    ...definition,
    rolls: definition.rolls?.map((roll) => ({ ...roll })),
    perTargetRolls: definition.perTargetRolls?.map((roll) => ({ ...roll })),
  }
  if (pluginId !== DND5E_SRD_AUDITED_SPELL_PACKAGE_ID) return undefined
  ensureDnd5eCoreSpellActivitiesRegisteredV1()
  const activity = getRegisteredDnd5eActivity(pluginId, actionId)
  if (!activity || activity.authorityBinding || activity.legacySource?.kind !== 'spell') return undefined
  return compileDnd5eActivityHeadlessAction(activity, {
    outerSpellTransaction: (activity.consumption ?? []).some((entry) => entry.kind === 'spell-slot'),
  })
}
