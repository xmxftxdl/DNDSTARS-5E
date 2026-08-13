import type {
  Dnd5eActivityConfirmationV1,
  Dnd5eActivityDefinitionV1,
  Dnd5eActivityTriggerContextV1,
  Dnd5eActivityTriggerRetentionV1,
} from './dnd5eActivityContracts'
import { matchDnd5eActivityInvocationV1, resolveDnd5eActivityInvocationV1 } from './dnd5eActivityInvocation'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'

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

const packages = new Map<string, { token: symbol; value: RegisteredDnd5eActivityPackage }>()

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
  if (packages.has(value.packageId)) throw new Error(`Activity package is already registered: ${value.packageId}`)
  const token = Symbol(value.packageId)
  packages.set(value.packageId, { token, value: clonePackage(value) })
  return {
    dispose() {
      if (packages.get(value.packageId)?.token === token) packages.delete(value.packageId)
    },
  }
}

export function getRegisteredDnd5eActivity(
  packageId: string,
  activityId: string,
): Dnd5eActivityDefinitionV1 | undefined {
  const activity = packages.get(packageId)?.value.activities.find((candidate) => candidate.id === activityId)
  return activity ? structuredClone(activity) : undefined
}

export function listRegisteredDnd5eActivityPackages(): readonly RegisteredDnd5eActivityPackage[] {
  return [...packages.values()].map(({ value }) => clonePackage(value))
}

/** Finds every registered Activity that the Host may offer for one event window. */
export function listAvailableRegisteredDnd5eActivitiesV1(input: {
  triggerContext: Dnd5eActivityTriggerContextV1
  actorId: string
  targetIds: readonly string[]
}): readonly AvailableRegisteredDnd5eActivityV1[] {
  const available: AvailableRegisteredDnd5eActivityV1[] = []
  for (const { value } of packages.values()) {
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
  packages.clear()
}
