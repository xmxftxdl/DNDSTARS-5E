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

const packages = new Map<string, { token: symbol; value: RegisteredContentPackage }>()

export function registerContentDefinitionPackage(value: RegisteredContentPackage): { dispose(): void } {
  if (packages.has(value.packageId)) throw new Error(`Content Definition package is already registered: ${value.packageId}`)
  const keys = new Set<string>()
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
