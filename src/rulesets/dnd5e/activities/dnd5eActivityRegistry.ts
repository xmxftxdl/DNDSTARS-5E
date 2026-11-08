import type {
  Dnd5eActivityConfirmationV1,
  Dnd5eActivityDefinitionV1,
  Dnd5eActivityTriggerContextV1,
  Dnd5eActivityTriggerRetentionV1,
} from './dnd5eActivityContracts'
import { matchDnd5eActivityInvocationV1, resolveDnd5eActivityInvocationV1 } from './dnd5eActivityInvocation'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import {
  contentDefinitionRegistryRevision,
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

let currentActivityCatalogSignature: { revision: number; signature: string } | undefined

/** Only detached plain-data graphs are eligible. structuredClone can retain
 * shared backing memory in nonplain objects, so those keep the original path. */
function plainActivityCatalogData(value: unknown): boolean {
  try {
    const pending: unknown[] = [value], seen = new WeakSet<object>()
    while (pending.length) {
      const current = pending.pop()
      if (current === null || typeof current !== 'object') {
        if (typeof current === 'function' || typeof current === 'symbol') return false
        continue
      }
      if (seen.has(current)) continue
      if (!Array.isArray(current) && ![Object.prototype, null].includes(Object.getPrototypeOf(current))) return false
      seen.add(current)
      for (const child of Object.values(current)) pending.push(child)
    }
    return true
  } catch {
    // Eligibility is optional; its failure must preserve the original JSON path.
    return false
  }
}

/** Primitive canonical catalog data only. Every registry epoch is freshly read;
 * mutable public copies, Source authority and Native results are never retained. */
export function registeredDnd5eActivityCatalogSignature(): string {
  const revision = contentDefinitionRegistryRevision()
  if (currentActivityCatalogSignature?.revision === revision) return currentActivityCatalogSignature.signature
  const snapshot = listRegisteredDnd5eActivityPackages()
  const signature = JSON.stringify(snapshot)
  // A thrown serialization never publishes an entry. A synchronous registry
  // change during serialization also cannot publish a stale-epoch entry.
  if (contentDefinitionRegistryRevision() === revision && plainActivityCatalogData(snapshot)) currentActivityCatalogSignature = { revision, signature }
  return signature
}

let currentRuntimeActivityCatalog: { revision: number; packages: readonly RegisteredDnd5eActivityPackage[] } | undefined
/** Private detached mechanical definitions only; no Source/Native/result authority.
 * The public catalog and every selected output retain their editable copies. */
function runtimeActivityCatalogForSelection(): readonly RegisteredDnd5eActivityPackage[] {
  const revision = contentDefinitionRegistryRevision()
  if (currentRuntimeActivityCatalog?.revision === revision) return currentRuntimeActivityCatalog.packages
  const snapshot = listRegisteredDnd5eActivityPackages()
  if (contentDefinitionRegistryRevision() !== revision || !plainActivityCatalogData(snapshot)) return snapshot
  try {
    const pending: object[] = [snapshot], seen = new WeakSet<object>()
    while (pending.length) {
      const current = pending.pop()!
      if (seen.has(current)) continue
      seen.add(current)
      for (const child of Object.values(current)) if (child !== null && typeof child === 'object') pending.push(child)
      Object.freeze(current)
    }
    if (contentDefinitionRegistryRevision() === revision) currentRuntimeActivityCatalog = { revision, packages: snapshot }
  } catch {
    // Optional private reuse must not replace the original lookup's outcome.
  }
  return snapshot
}

/** Finds every registered Activity that the Host may offer for one event window. */
export function listAvailableRegisteredDnd5eActivitiesV1(input: {
  triggerContext: Dnd5eActivityTriggerContextV1
  actorId: string
  targetIds: readonly string[]
}): readonly AvailableRegisteredDnd5eActivityV1[] {
  const available: AvailableRegisteredDnd5eActivityV1[] = []
  for (const value of runtimeActivityCatalogForSelection()) {
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
  return available.sort((a,b)=>(b.activity.invocation?.kind==='triggered'?b.activity.invocation.priority??0:0)-
    (a.activity.invocation?.kind==='triggered'?a.activity.invocation.priority??0:0))
}

export function clearDnd5eActivityRegistryForTests(): void {
  for (const registration of legacyRegistrations.values()) registration.dispose()
  legacyRegistrations.clear()
}
