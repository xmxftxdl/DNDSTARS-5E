import type { MobileRoomRules } from '../../../../packages/mobile-protocol/src'
import {
  dnd5eRulesPluginFromContentPackageV2,
  parseDnd5eContentPackageV2,
} from '../../../../src/rulesets/dnd5e/contentPackageV2'
import { dnd5eRulesPluginFromDeclarativePackageV1 } from '../../../../src/rulesets/dnd5e/declarativePluginPackage'
import { parseDnd5eDeclarativeRulesPackageV1 } from '../../../../src/rulesets/dnd5e/declarativeSubclassAbility'
import { dnd5ePluginCompatibilityReport } from '../../../../src/rulesets/dnd5e/pluginCompatibility'
import {
  registerDnd5eRulesPlugin,
  registeredDnd5eRulesPlugins,
  type Dnd5eRulesPlugin,
  type Dnd5eRulesPluginManifest,
} from '../../../../src/rulesets/dnd5e/pluginApi'
import { downloadMobileRoomPlugin, type MobileCredentials } from './mobileApi'

type Requirement = MobileRoomRules['requiredPlugins'][number]

interface PreparedRoomPlugin {
  requirement: Requirement
  value: unknown
  manifest: Dnd5eRulesPluginManifest
  plugin: Dnd5eRulesPlugin
}

interface ActiveRoomPlugin extends PreparedRoomPlugin {
  dispose: () => void
}

const packageCache = new Map<string, Promise<unknown>>()
let activeRoomId = ''
let activeSignature = ''
let activePlugins: ActiveRoomPlugin[] = []

function requirementKey(roomId: string, requirement: Requirement): string {
  return `${roomId}:${requirement.id}:${requirement.version}:${requirement.integrity}:${requirement.stateSchemaVersion}`
}

function roomSignature(roomId: string, requirements: readonly Requirement[]): string {
  return `${roomId}|${requirements.map((entry) =>
    `${entry.id}@${entry.version}#${entry.integrity}:${entry.stateSchemaVersion}`).sort().join('|')}`
}

function assertPureJsonValue(value: unknown, seen: WeakSet<object>): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('plugin-package-not-json')
    return
  }
  if (typeof value !== 'object') throw new Error('plugin-package-not-json')
  if (seen.has(value)) throw new Error('plugin-package-not-json')
  seen.add(value)
  if (Array.isArray(value)) {
    for (const entry of value) assertPureJsonValue(entry, seen)
    return
  }
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) throw new Error('plugin-package-not-json')
  for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
    if (!('value' in descriptor)) throw new Error('plugin-package-not-json')
    assertPureJsonValue(descriptor.value, seen)
  }
}

function encodePureJson(value: unknown): ArrayBuffer {
  let source: string | undefined
  try {
    assertPureJsonValue(value, new WeakSet())
    source = JSON.stringify(value)
  } catch {
    throw new Error('plugin-package-not-json')
  }
  if (!source || !source.trimStart().startsWith('{')) throw new Error('plugin-package-not-json')
  return new TextEncoder().encode(source).buffer
}

function parsePreparedPlugin(requirement: Requirement, value: unknown): PreparedRoomPlugin {
  const bytes = encodePureJson(value)
  const v2 = parseDnd5eContentPackageV2(bytes)
  const legacy = v2 ? null : parseDnd5eDeclarativeRulesPackageV1(bytes)
  if (!v2 && !legacy) throw new Error('unsupported-plugin-package')
  const manifest = (v2?.manifest ?? legacy!.manifest) as Dnd5eRulesPluginManifest
  if (
    manifest.id !== requirement.id ||
    manifest.version !== requirement.version ||
    (manifest.stateSchemaVersion ?? 1) !== requirement.stateSchemaVersion
  ) throw new Error('plugin-manifest-mismatch')
  if (manifest.rulesetId !== 'dnd5e-2014-srd-5.1' || manifest.apiVersion !== 2) {
    throw new Error('plugin-ruleset-or-api-incompatible')
  }
  if (manifest.distributionPolicy !== 'room-distributable' && manifest.distributionPolicy !== 'room-ephemeral') {
    throw new Error('plugin-not-room-distributable')
  }
  return {
    requirement,
    value,
    manifest,
    plugin: v2
      ? dnd5eRulesPluginFromContentPackageV2(v2)
      : dnd5eRulesPluginFromDeclarativePackageV1(legacy!),
  }
}

function orderedForDependencies(prepared: readonly PreparedRoomPlugin[]): PreparedRoomPlugin[] {
  const pending = new Map(prepared.map((entry) => [entry.manifest.id, entry]))
  if (pending.size !== prepared.length) throw new Error('plugin-id-duplicated')
  const result: PreparedRoomPlugin[] = []
  const activeIds = new Set(activePlugins.map((entry) => entry.manifest.id))
  const external = registeredDnd5eRulesPlugins().filter((entry) => !activeIds.has(entry.id))
  const externalIds = new Set(external.map((entry) => entry.id))
  const installed = [...external, ...prepared.map((entry) => entry.manifest)]
  for (const entry of prepared) {
    const report = dnd5ePluginCompatibilityReport({
      candidate: entry.manifest,
      installed: installed.filter((candidate) => candidate.id !== entry.manifest.id),
    })
    if (!report.compatible) {
      throw new Error(`plugin-incompatible:${entry.manifest.id}:${report.errors[0]?.code ?? 'unknown'}`)
    }
  }
  while (pending.size > 0) {
    let progressed = false
    for (const [id, entry] of pending) {
      const unresolved = (entry.manifest.dependencies ?? []).filter((dependency) =>
        !dependency.optional && pending.has(dependency.id) && !result.some((candidate) => candidate.manifest.id === dependency.id))
      const missing = (entry.manifest.dependencies ?? []).filter((dependency) =>
        !dependency.optional && !pending.has(dependency.id) &&
        !result.some((candidate) => candidate.manifest.id === dependency.id) && !externalIds.has(dependency.id))
      if (missing.length > 0) throw new Error(`plugin-dependency-missing:${id}:${missing[0]!.id}`)
      if (unresolved.length > 0) continue
      result.push(entry)
      pending.delete(id)
      progressed = true
    }
    if (!progressed) throw new Error('plugin-dependency-cycle')
  }
  return result
}

async function cachedRoomPlugin(credentials: MobileCredentials, requirement: Requirement): Promise<unknown> {
  const key = requirementKey(credentials.room.roomId, requirement)
  const cached = packageCache.get(key)
  if (cached) return cached
  const pending = downloadMobileRoomPlugin(credentials, requirement)
  packageCache.set(key, pending)
  pending.catch(() => {
    if (packageCache.get(key) === pending) packageCache.delete(key)
  })
  return pending
}

function disposeActivePlugins(): void {
  for (const entry of [...activePlugins].reverse()) entry.dispose()
  activePlugins = []
  activeRoomId = ''
  activeSignature = ''
}

/**
 * Download, validate and register the exact data-only packages enabled by the
 * room DM. A failed package leaves no custom rules active, so the heartbeat
 * cannot claim a partially installed ruleset is ready.
 */
export async function prepareMobileRoomPlugins(
  credentials: MobileCredentials,
  rules: MobileRoomRules,
  options: { loadPlugin?: (requirement: Requirement) => Promise<unknown> } = {},
): Promise<void> {
  const signature = roomSignature(credentials.room.roomId, rules.requiredPlugins)
  if (activeRoomId === credentials.room.roomId && activeSignature === signature) return
  let prepared: PreparedRoomPlugin[]
  try {
    const values = await Promise.all(rules.requiredPlugins.map(async (requirement) => ({
      requirement,
      value: await (options.loadPlugin?.(requirement) ?? cachedRoomPlugin(credentials, requirement)),
    })))
    prepared = orderedForDependencies(values.map(({ requirement, value }) =>
      parsePreparedPlugin(requirement, value)))
  } catch (cause) {
    // A changed room requirement must never leave the previous package set in
    // the process-wide registries while the UI reports the new set as failed.
    disposeActivePlugins()
    throw cause
  }

  // Registries are process-scoped: rules from an old room must never leak into
  // a new room or remain active after the DM changes the package revision.
  disposeActivePlugins()
  const installed: ActiveRoomPlugin[] = []
  try {
    for (const entry of prepared) {
      if (registeredDnd5eRulesPlugins().some((plugin) => plugin.id === entry.manifest.id)) {
        throw new Error(`plugin-id-already-registered:${entry.manifest.id}`)
      }
      installed.push({
        ...entry,
        dispose: registerDnd5eRulesPlugin(entry.plugin, { integrity: entry.requirement.integrity }),
      })
    }
  } catch (cause) {
    for (const entry of [...installed].reverse()) entry.dispose()
    throw cause
  }
  activePlugins = installed
  activeRoomId = credentials.room.roomId
  activeSignature = signature
}

export function mobileRoomPluginPackage(requirement: Requirement): unknown {
  return activePlugins.find((entry) =>
    entry.requirement.id === requirement.id &&
    entry.requirement.version === requirement.version &&
    entry.requirement.integrity === requirement.integrity)?.value
}

export function clearMobileRoomPluginRuntime(): void {
  disposeActivePlugins()
}

export function activeMobileRoomPluginIds(): readonly string[] {
  return activePlugins.map((entry) => entry.manifest.id)
}
