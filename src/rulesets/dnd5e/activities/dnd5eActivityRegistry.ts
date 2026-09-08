import type {
  Dnd5eActivityConfirmationV1,
  Dnd5eActivityDefinitionV1,
  Dnd5eActivityTriggerContextV1,
  Dnd5eActivityTriggerRetentionV1,
} from './dnd5eActivityContracts'
import { matchDnd5eActivityInvocationV1, resolveDnd5eActivityInvocationV1 } from './dnd5eActivityInvocation'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import {
  getRegisteredContentActivity,
  listRegisteredContentActivities,
  listRegisteredContentDefinitionPackages,
  type RegisteredContentDefinition,
} from '../../../domain/content/contentDefinitionRegistry'
import { registerDnd5eUnifiedContentPackageV1 } from './dnd5eUnifiedContentRegistry'

export interface RegisteredDnd5eActivityPackage {
  packageId: string
  packageVersion: string
  activities: readonly Dnd5eActivityDefinitionV1[]
}

export interface Dnd5eActivityRegistration {
  dispose(): void
}

export interface AvailableRegisteredDnd5eActivityV1 {
  packageId: string
  packageVersion: string
  activity: Dnd5eActivityDefinitionV1
  confirmation: Dnd5eActivityConfirmationV1
  retention: Dnd5eActivityTriggerRetentionV1
}

const legacyRegistrations = new Map<string, { token: symbol; dispose(): void }>()

function clonePackage(value: RegisteredDnd5eActivityPackage): RegisteredDnd5eActivityPackage {
  return structuredClone(value)
}

/**
 * Internal Activity catalog. It contains only validated data and deliberately
 * exposes no Store, DOM, network, or mutable combat object to content packages.
 */
export function registerDnd5eActivityPackage(
  value: RegisteredDnd5eActivityPackage,
): Dnd5eActivityRegistration {
  if (!value.packageId.trim() || !value.packageVersion.trim()) throw new Error('Invalid Activity package identity')
  const ids = new Set<string>()
  for (const activity of value.activities) {
    const errors = validateDnd5eActivityDefinitionV1(activity)
    if (errors.length) throw new Error(`Invalid Activity ${activity.id}: ${errors.join('; ')}`)
    if (ids.has(activity.id)) throw new Error(`Duplicate Activity id in package ${value.packageId}: ${activity.id}`)
    ids.add(activity.id)
  }
  if (legacyRegistrations.has(value.packageId)) throw new Error(`Activity package is already registered: ${value.packageId}`)
  const token = Symbol(value.packageId)
  const definitions: RegisteredContentDefinition[] = value.activities.map((activity, index) => ({
    schemaVersion: 1,
    id: `legacy-activity.${activity.id.replace(/[^a-z0-9._-]+/g, '.').slice(0, 96)}.${index}`,
    namespace: value.packageId,
    version: value.packageVersion,
    kind: 'feature',
    name: activity.name,
    source: { packageId: value.packageId, packageVersion: value.packageVersion },
    payload: { legacyActivityAdapter: true },
    activities: [structuredClone(activity)],
    automation: structuredClone(activity.automation),
  }))
  const registration = registerDnd5eUnifiedContentPackageV1({
    packageId: value.packageId,
    packageVersion: value.packageVersion,
    definitions,
  })
  legacyRegistrations.set(value.packageId, { token, dispose: registration.dispose })
  return {
    dispose() {
      const current = legacyRegistrations.get(value.packageId)
      if (current?.token !== token) return
      current.dispose()
      legacyRegistrations.delete(value.packageId)
    },
  }
}

export function getRegisteredDnd5eActivity(
  packageId: string,
  activityId: string,
): Dnd5eActivityDefinitionV1 | undefined {
  return getRegisteredContentActivity<Dnd5eActivityDefinitionV1>(packageId, activityId)
}

export function listRegisteredDnd5eActivityPackages(): readonly RegisteredDnd5eActivityPackage[] {
  return listRegisteredContentDefinitionPackages().map((value) => clonePackage({
    packageId: value.packageId,
    packageVersion: value.packageVersion,
    activities: listRegisteredContentActivities<Dnd5eActivityDefinitionV1>(value.packageId),
  }))
}

/** Finds every registered Activity that the Host may offer for one event window. */
export function listAvailableRegisteredDnd5eActivitiesV1(input: {
  triggerContext: Dnd5eActivityTriggerContextV1
  actorId: string
  targetIds: readonly string[]
}): readonly AvailableRegisteredDnd5eActivityV1[] {
  const available: AvailableRegisteredDnd5eActivityV1[] = []
  for (const value of listRegisteredDnd5eActivityPackages()) {
    for (const activity of value.activities) {
      // These Activities are the unified catalog entry for mechanics already
      // dispatched inside the authoritative attack/spell/turn transaction.
      // Offering a second generic trigger window would settle them twice.
      if (activity.authorityBinding?.execution === 'headless-event-engine') continue
      const invocation = resolveDnd5eActivityInvocationV1(activity)
      if (invocation.kind !== 'triggered') continue
      const confirmedBy = invocation.confirmation === 'automatic'
        ? 'system' as const
        : invocation.confirmation === 'target-choice'
          ? 'target' as const
          : invocation.confirmation === 'dm-approval'
            ? 'dm' as const
            : 'actor' as const
      const match = matchDnd5eActivityInvocationV1({
        activity,
        actorId: input.actorId,
        targetIds: input.targetIds,
        triggerContext: input.triggerContext,
        confirmedBy,
        dmApproved: invocation.confirmation === 'dm-approval',
      })
      if (!match.ok) continue
      available.push({
        packageId: value.packageId,
        packageVersion: value.packageVersion,
        activity: structuredClone(activity),
        confirmation: invocation.confirmation,
        retention: invocation.retention ?? 'single-event',
      })
    }
  }
  return available
}

export function clearDnd5eActivityRegistryForTests(): void {
  for (const registration of legacyRegistrations.values()) registration.dispose()
  legacyRegistrations.clear()
}
