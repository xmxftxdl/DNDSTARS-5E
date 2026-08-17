import { validateAutomationCapability } from '../automation/automationCapability'
import {
  validateContentDefinitionIdentity,
  type ContentDefinitionEnvelope,
  type ContentDefinitionKind,
} from './contentDefinition'

export type RegisteredContentDefinition = ContentDefinitionEnvelope<ContentDefinitionKind, unknown, unknown, unknown, unknown>

export interface RegisteredContentPackage {
  packageId: string
  packageVersion: string
  definitions: readonly RegisteredContentDefinition[]
}

export interface RegisteredContentExecutableContribution {
  id: string
}

const packages = new Map<string, { token: symbol; value: RegisteredContentPackage }>()

export function registerContentDefinitionPackage(value: RegisteredContentPackage): { dispose(): void } {
  if (packages.has(value.packageId)) throw new Error(`Content Definition package is already registered: ${value.packageId}`)
  const keys = new Set<string>()
  const activityIds = new Set<string>()
  const effectIds = new Set<string>()
  for (const definition of value.definitions) {
    const identityErrors = validateContentDefinitionIdentity(definition)
    const automationErrors = validateAutomationCapability(definition.automation)
    const errors = [...identityErrors, ...automationErrors]
    if (definition.namespace !== value.packageId || definition.version !== value.packageVersion) {
      errors.push('content definition package identity does not match its registration')
    }
    const key = `${definition.kind}:${definition.id}`
    if (keys.has(key)) errors.push(`duplicate content definition: ${key}`)
    keys.add(key)
    for (const activity of definition.activities ?? []) {
      const id = typeof activity === 'object' && activity != null && 'id' in activity && typeof activity.id === 'string'
        ? activity.id
        : ''
      if (!id || activityIds.has(id)) errors.push(`duplicate or invalid Activity contribution: ${id || '<missing>'}`)
      activityIds.add(id)
    }
    for (const effect of definition.effects ?? []) {
      const id = typeof effect === 'object' && effect != null && 'id' in effect && typeof effect.id === 'string'
        ? effect.id
        : ''
      if (!id || effectIds.has(id)) errors.push(`duplicate or invalid Effect contribution: ${id || '<missing>'}`)
      effectIds.add(id)
    }
    if (errors.length) throw new Error(`Invalid Content Definition ${key}: ${errors.join('; ')}`)
  }
  const token = Symbol(value.packageId)
  packages.set(value.packageId, { token, value: structuredClone(value) })
  return {
    dispose() {
      if (packages.get(value.packageId)?.token === token) packages.delete(value.packageId)
    },
  }
}

/**
 * Removes a package by identity even when its original disposer was lost.
 *
 * The plugin Host normally unregisters contributions through the disposer it
 * owns. During a development hot reload (or an interrupted room-plugin
 * activation), however, the Host registry can be recreated while this
 * content registry still contains the previous package. Keeping this narrow
 * identity cleanup here lets the Host repair that orphan before activating
 * the same plugin again without making ordinary registration an implicit
 * last-writer-wins operation.
 */
export function unregisterContentDefinitionPackage(packageId: string): boolean {
  return packages.delete(packageId)
}

export function getRegisteredContentActivity<T extends RegisteredContentExecutableContribution = RegisteredContentExecutableContribution>(
  packageId: string,
  activityId: string,
): T | undefined {
  const activity = packages.get(packageId)?.value.definitions
    .flatMap((definition) => definition.activities ?? [])
    .find((entry) => typeof entry === 'object' && entry != null && 'id' in entry && entry.id === activityId)
  return activity ? structuredClone(activity as T) : undefined
}

export function listRegisteredContentActivities<T extends RegisteredContentExecutableContribution = RegisteredContentExecutableContribution>(
  packageId: string,
): readonly T[] {
  return (packages.get(packageId)?.value.definitions.flatMap((definition) => definition.activities ?? []) ?? [])
    .map((activity) => structuredClone(activity as T))
}

export function getRegisteredContentDefinition(
  packageId: string,
  kind: ContentDefinitionKind,
  id: string,
): RegisteredContentDefinition | undefined {
  const definition = packages.get(packageId)?.value.definitions.find((entry) => entry.kind === kind && entry.id === id)
  return definition ? structuredClone(definition) : undefined
}

export function listRegisteredContentDefinitionPackages(): readonly RegisteredContentPackage[] {
  return [...packages.values()].map(({ value }) => structuredClone(value))
}

export function clearContentDefinitionRegistryForTests(): void {
  packages.clear()
}
