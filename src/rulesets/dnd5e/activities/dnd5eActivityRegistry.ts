import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'

export interface RegisteredDnd5eActivityPackage {
  packageId: string
  packageVersion: string
  activities: readonly Dnd5eActivityDefinitionV1[]
}

export interface Dnd5eActivityRegistration {
  dispose(): void
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

export function clearDnd5eActivityRegistryForTests(): void {
  packages.clear()
}
