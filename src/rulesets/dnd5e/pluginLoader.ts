import {
  DND5E_RULES_PLUGIN_API_VERSION,
  registerDnd5eRulesPlugin,
  registeredDnd5eRulesPlugins,
  unregisterDnd5eRulesPlugin,
  type JsonValue,
  type Dnd5eRulesPlugin,
  type Dnd5eRulesPluginManifest,
} from './pluginApi'
import {
  activateDnd5ePluginSandbox,
  createDnd5ePluginSandbox,
  terminateDnd5ePluginSandbox,
  type Dnd5ePluginSandboxSession,
} from './pluginSandbox'
import {
  parseDnd5eDeclarativeRulesPackageV1,
  type Dnd5eDeclarativeRulesPackageV1,
} from './declarativeSubclassAbility'
import {
  dnd5eContentPackageAutomationCoverageV2,
  dnd5eContentPackageSummaryV2,
  dnd5eRulesPluginFromContentPackageV2,
  parseDnd5eContentPackageV2,
  type Dnd5eContentAutomationCoverageReportV2,
  type Dnd5eContentPackageProvenanceV2,
  type Dnd5eContentPackageSummaryV2,
  type Dnd5eContentPackageV2,
} from './contentPackageV2'
import {
  dnd5eRulesPluginFromUnifiedContentBundleV1,
  dnd5eUnifiedContentSummaryV1,
  parseDnd5eUnifiedContentBundleV1,
  type Dnd5eUnifiedContentBundleV1,
} from './unifiedContent'
import { getRoomSession } from '../../lib/roomSession'
import {
  dnd5ePluginTrustProfile,
  type Dnd5ePluginTrustProfile,
} from '../../domain/plugins/pluginKind'

const STORAGE_KEY = 'dndstars:dnd5e-rules-plugins:v2'
const LEGACY_STORAGE_KEY = 'dndstars:dnd5e-rules-plugins:v1'
const DATABASE_NAME = 'dndstars-rules-plugins'
const DATABASE_VERSION = 1
const MODULE_STORE = 'dnd5e-modules'

export type InstalledDnd5eRulesPlugin =
  | {
      id: string
      source: 'url'
      /** A self-contained ESM bundle URL. Relative URLs are resolved against the app origin. */
      moduleUrl: string
      /** Required immutable pin, formatted as sha256-<base64>. */
      integrity: string
      enabled: boolean
    }
  | {
      id: string
      source: 'file'
      fileName: string
      /** Required immutable pin, formatted as sha256-<base64>. */
      integrity: string
      enabled: boolean
    }
  | {
      id: string
      source: 'ephemeral'
      fileName: string
      /** Required immutable pin, formatted as sha256-<base64>. */
      integrity: string
      enabled: true
    }

export interface Dnd5eRulesPluginLoadFailure {
  id: string
  error: string
}

export interface Dnd5eRulesPluginHost {
  readonly apiVersion: typeof DND5E_RULES_PLUGIN_API_VERSION
  install(descriptor: InstalledDnd5eRulesPlugin): Promise<void>
  installFile(file: File): Promise<InstalledDnd5eRulesPlugin>
  installBytes(input: {
    id: string
    version: string
    fileName: string
    integrity: string
    bytes: ArrayBuffer
  }): Promise<InstalledDnd5eRulesPlugin>
  installEphemeralBytes(input: {
    id: string
    version: string
    fileName: string
    integrity: string
    bytes: ArrayBuffer
  }): Promise<InstalledDnd5eRulesPlugin>
  inspectFile(file: File): Promise<{
    manifest: Dnd5eRulesPluginManifest
    fileName: string
    integrity: string
    bytes: ArrayBuffer
    contentSummary?: Dnd5eContentPackageSummaryV2
    automationCoverage?: Dnd5eContentAutomationCoverageReportV2
    provenance?: Dnd5eContentPackageProvenanceV2
  }>
  migrateState(input: {
    bytes: ArrayBuffer
    fromVersion: number
    state: JsonValue
  }): Promise<{ state: JsonValue; fromVersion: number; toVersion: number }>
  readBytes(pluginId: string): Promise<ArrayBuffer>
  remove(pluginId: string): Promise<void>
  clearEphemeral(): Promise<void>
  listInstalled(): readonly InstalledDnd5eRulesPlugin[]
  listActive(): ReturnType<typeof registeredDnd5eRulesPlugins>
}

const ephemeralModuleBytes = new Map<string, ArrayBuffer>()
const ephemeralDescriptors = new Map<string, Extract<InstalledDnd5eRulesPlugin, { source: 'ephemeral' }>>()

declare global {
  interface Window {
    DNDSTARS_5E_RULES_PLUGINS?: Dnd5eRulesPluginHost
  }
}

function cloneDescriptor(descriptor: InstalledDnd5eRulesPlugin): InstalledDnd5eRulesPlugin {
  return { ...descriptor }
}

function parseInstalledDescriptor(candidate: unknown): InstalledDnd5eRulesPlugin | undefined {
  if (!candidate || typeof candidate !== 'object') return undefined
  const value = candidate as Partial<InstalledDnd5eRulesPlugin> & { moduleUrl?: string }
  if (
    typeof value.id !== 'string' ||
    typeof value.integrity !== 'string' ||
    !/^[a-z0-9][a-z0-9._-]*$/.test(value.id) ||
    !/^sha256-[A-Za-z0-9+/]+={0,2}$/.test(value.integrity)
  ) return undefined
  if (value.source === 'file' && typeof value.fileName === 'string') {
    return {
      id: value.id,
      source: 'file',
      fileName: value.fileName,
      integrity: value.integrity,
      enabled: value.enabled !== false,
    }
  }
  if ((value.source === 'url' || value.source == null) && typeof value.moduleUrl === 'string') {
    return {
      id: value.id,
      source: 'url',
      moduleUrl: value.moduleUrl,
      integrity: value.integrity,
      enabled: value.enabled !== false,
    }
  }
  return undefined
}

function readInstalledFromKey(key: string): InstalledDnd5eRulesPlugin[] {
  try {
    const value = window.localStorage.getItem(key)
    if (!value) return []
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((candidate) => {
      const descriptor = parseInstalledDescriptor(candidate)
      return descriptor ? [descriptor] : []
    })
  } catch {
    return []
  }
}

export function installedDnd5eRulesPlugins(): InstalledDnd5eRulesPlugin[] {
  const current = readInstalledFromKey(STORAGE_KEY)
  if (current.length > 0 || window.localStorage.getItem(STORAGE_KEY) != null) return current
  const legacy = readInstalledFromKey(LEGACY_STORAGE_KEY)
  if (legacy.length > 0) persistInstalled(legacy)
  return legacy
}

function persistInstalled(descriptors: readonly InstalledDnd5eRulesPlugin[]): void {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(descriptors.filter((descriptor) => descriptor.source !== 'ephemeral')),
  )
}

function assertPluginId(pluginId: string): void {
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(pluginId)) throw new Error(`无效的插件 ID：${pluginId}`)
}

function assertIntegrity(integrity: string, pluginId: string): void {
  if (!/^sha256-[A-Za-z0-9+/]+={0,2}$/.test(integrity)) {
    throw new Error(`插件 ${pluginId} 缺少有效的 SHA-256 完整性值`)
  }
}

function assertUrlDescriptor(
  descriptor: Extract<InstalledDnd5eRulesPlugin, { source: 'url' }>,
): URL {
  assertPluginId(descriptor.id)
  assertIntegrity(descriptor.integrity, descriptor.id)
  const url = new URL(descriptor.moduleUrl, window.location.href)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`插件 ${descriptor.id} 使用了不允许的 URL 协议`)
  }
  const localHttp = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.protocol === 'http:' && window.location.protocol === 'https:' && !localHttp) {
    throw new Error(`插件 ${descriptor.id} 必须通过 HTTPS 加载`)
  }
  return url
}

async function openPluginDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(MODULE_STORE)) database.createObjectStore(MODULE_STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('无法打开插件存储'))
  })
}

async function storeModuleBytes(pluginId: string, bytes: ArrayBuffer): Promise<void> {
  const database = await openPluginDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(MODULE_STORE, 'readwrite')
      transaction.objectStore(MODULE_STORE).put(bytes, pluginId)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('无法保存插件文件'))
      transaction.onabort = () => reject(transaction.error ?? new Error('保存插件文件已中止'))
    })
  } finally {
    database.close()
  }
}

async function loadModuleBytes(pluginId: string): Promise<ArrayBuffer | undefined> {
  const database = await openPluginDatabase()
  try {
    return await new Promise<ArrayBuffer | undefined>((resolve, reject) => {
      const transaction = database.transaction(MODULE_STORE, 'readonly')
      const request = transaction.objectStore(MODULE_STORE).get(pluginId)
      request.onsuccess = () => {
        const value = request.result
        if (value instanceof ArrayBuffer) resolve(value)
        else if (value instanceof Blob) void value.arrayBuffer().then(resolve, reject)
        else resolve(undefined)
      }
      request.onerror = () => reject(request.error ?? new Error('无法读取插件文件'))
    })
  } finally {
    database.close()
  }
}

async function deleteModuleBytes(pluginId: string): Promise<void> {
  const database = await openPluginDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(MODULE_STORE, 'readwrite')
      transaction.objectStore(MODULE_STORE).delete(pluginId)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('无法删除插件文件'))
      transaction.onabort = () => reject(transaction.error ?? new Error('删除插件文件已中止'))
    })
  } finally {
    database.close()
  }
}

export async function sha256Integrity(bytes: ArrayBuffer): Promise<string> {
  const digest = new Uint8Array(await window.crypto.subtle.digest('SHA-256', bytes))
  let binary = ''
  for (const byte of digest) binary += String.fromCharCode(byte)
  return `sha256-${window.btoa(binary)}`
}

async function inspectPluginBytes(bytes: ArrayBuffer, fileName: string) {
  if (bytes.byteLength < 1) throw new Error('插件文件为空')
  const integrity = await sha256Integrity(bytes)
  const artifact = await loadPluginArtifact(bytes)
  try {
    assertPluginId(artifact.manifest.id)
    return {
      manifest: { ...artifact.manifest },
      fileName,
      integrity,
      bytes,
      ...(artifact.kind === 'content-v2' ? {
        contentSummary: dnd5eContentPackageSummaryV2(artifact.package),
        automationCoverage: dnd5eContentPackageAutomationCoverageV2(artifact.package, integrity),
        provenance: structuredClone(artifact.package.provenance),
      } : artifact.kind === 'unified-v1' ? {
        contentSummary: dnd5eUnifiedContentSummaryV1(artifact.package),
      } : {}),
    }
  } finally {
    terminatePluginArtifact(artifact)
  }
}

async function descriptorBytes(descriptor: InstalledDnd5eRulesPlugin): Promise<ArrayBuffer> {
  if (descriptor.source === 'ephemeral') {
    const bytes = ephemeralModuleBytes.get(descriptor.id)
    if (!bytes) throw new Error(`房间临时插件文件已经释放：${descriptor.fileName}`)
    return bytes.slice(0)
  }
  if (descriptor.source === 'file') {
    const bytes = await loadModuleBytes(descriptor.id)
    if (!bytes) throw new Error(`本机插件文件不存在：${descriptor.fileName}`)
    return bytes
  }
  const url = assertUrlDescriptor(descriptor)
  const response = await window.fetch(url, { credentials: 'omit', cache: 'no-store' })
  if (!response.ok) throw new Error(`下载失败（HTTP ${response.status}）`)
  return response.arrayBuffer()
}

type LoadedDnd5ePluginArtifact =
  | {
      kind: 'worker'
      manifest: Dnd5eRulesPluginManifest
      trust: Dnd5ePluginTrustProfile
      session: Dnd5ePluginSandboxSession
    }
  | {
      kind: 'declarative-v1'
      manifest: Dnd5eRulesPluginManifest
      trust: Dnd5ePluginTrustProfile
      package: Dnd5eDeclarativeRulesPackageV1
      plugin: Dnd5eRulesPlugin
    }
  | {
      kind: 'content-v2'
      manifest: Dnd5eRulesPluginManifest
      trust: Dnd5ePluginTrustProfile
      package: Dnd5eContentPackageV2
      plugin: Dnd5eRulesPlugin
    }
  | {
      kind: 'unified-v1'
      manifest: Dnd5eRulesPluginManifest
      trust: Dnd5ePluginTrustProfile
      package: Dnd5eUnifiedContentBundleV1
      plugin: Dnd5eRulesPlugin
    }

async function loadPluginArtifact(bytes: ArrayBuffer): Promise<LoadedDnd5ePluginArtifact> {
  const content = parseDnd5eContentPackageV2(bytes)
  if (content) {
    const plugin = dnd5eRulesPluginFromContentPackageV2(content)
    const trust = dnd5ePluginTrustProfile(content.manifest.pluginKind, 'content-v2')
    return { kind: 'content-v2', manifest: { ...content.manifest }, trust, package: content, plugin }
  }
  const unified = parseDnd5eUnifiedContentBundleV1(bytes)
  if (unified) {
    const plugin = dnd5eRulesPluginFromUnifiedContentBundleV1(unified)
    const trust = dnd5ePluginTrustProfile(unified.manifest.pluginKind, 'unified-v1')
    return { kind: 'unified-v1', manifest: { ...unified.manifest }, trust, package: unified, plugin }
  }
  const declaration = parseDnd5eDeclarativeRulesPackageV1(bytes)
  if (declaration) {
    // Constructing the Host plugin performs the existing v2 contribution validation too.
    const { dnd5eRulesPluginFromDeclarativePackageV1 } = await import('./declarativePluginPackage')
    const plugin = dnd5eRulesPluginFromDeclarativePackageV1(declaration)
    const trust = dnd5ePluginTrustProfile(declaration.manifest.pluginKind, 'declarative-v1')
    return { kind: 'declarative-v1', manifest: { ...declaration.manifest }, trust, package: declaration, plugin }
  }
  const session = await createDnd5ePluginSandbox(bytes)
  const trust = dnd5ePluginTrustProfile(session.manifest.pluginKind, 'worker-module')
  return { kind: 'worker', manifest: { ...session.manifest }, trust, session }
}

function terminatePluginArtifact(artifact: LoadedDnd5ePluginArtifact): void {
  if (artifact.kind === 'worker') artifact.session.terminate()
}

async function importPinnedPlugin(descriptor: InstalledDnd5eRulesPlugin): Promise<LoadedDnd5ePluginArtifact> {
  assertPluginId(descriptor.id)
  assertIntegrity(descriptor.integrity, descriptor.id)
  const bytes = await descriptorBytes(descriptor)
  const actualIntegrity = await sha256Integrity(bytes)
  if (actualIntegrity !== descriptor.integrity) {
    throw new Error(`完整性校验失败；期望 ${descriptor.integrity}，实际 ${actualIntegrity}`)
  }
  const artifact = await loadPluginArtifact(bytes)
  if (artifact.manifest.id !== descriptor.id) {
    terminatePluginArtifact(artifact)
    throw new Error(`清单 ID 不匹配：${artifact.manifest.id}`)
  }
  return artifact
}

function activatePlugin(artifact: LoadedDnd5ePluginArtifact, integrity: string): void {
  if (artifact.manifest.distributionPolicy === 'local-only' && getRoomSession()) {
    terminatePluginArtifact(artifact)
    throw new Error('local-only 内容包只能在未连接联网房间时运行；离开房间并重新加载后可恢复本地使用')
  }
  unregisterDnd5eRulesPlugin(artifact.manifest.id)
  const plugin = artifact.kind === 'worker'
    ? activateDnd5ePluginSandbox(artifact.session)
    : artifact.plugin
  try {
    registerDnd5eRulesPlugin(plugin, { integrity })
  } catch (error) {
    if (artifact.kind === 'worker') terminateDnd5ePluginSandbox(artifact.manifest.id)
    throw error
  }
}

async function installFileBytes(input: {
  bytes: ArrayBuffer
  fileName: string
  expectedId?: string
  expectedVersion?: string
  expectedIntegrity?: string
}): Promise<InstalledDnd5eRulesPlugin> {
  if (input.bytes.byteLength < 1) throw new Error('插件文件为空')
  const integrity = await sha256Integrity(input.bytes)
  if (input.expectedIntegrity && integrity !== input.expectedIntegrity) {
    throw new Error(`完整性校验失败；期望 ${input.expectedIntegrity}，实际 ${integrity}`)
  }
  const artifact = await loadPluginArtifact(input.bytes)
  assertPluginId(artifact.manifest.id)
  if (artifact.manifest.distributionPolicy === 'room-ephemeral') {
    terminatePluginArtifact(artifact)
    throw new Error('room-ephemeral 内容包不能永久安装；请在房间内使用“导入临时合集”')
  }
  if (input.expectedId && artifact.manifest.id !== input.expectedId) {
    terminatePluginArtifact(artifact)
    throw new Error(`清单 ID 不匹配：期望 ${input.expectedId}，实际 ${artifact.manifest.id}`)
  }
  if (input.expectedVersion && artifact.manifest.version !== input.expectedVersion) {
    terminatePluginArtifact(artifact)
    throw new Error(`清单版本不匹配：期望 ${input.expectedVersion}，实际 ${artifact.manifest.version}`)
  }
  const previousDescriptor = installedDnd5eRulesPlugins().find((item) => item.id === artifact.manifest.id)
  let previousBytes: ArrayBuffer | undefined
  try {
    previousBytes = previousDescriptor ? await descriptorBytes(previousDescriptor) : undefined
  } catch (error) {
    terminatePluginArtifact(artifact)
    throw error
  }
  const descriptor: InstalledDnd5eRulesPlugin = {
    id: artifact.manifest.id,
    source: 'file',
    fileName: input.fileName,
    integrity,
    enabled: true,
  }
  const next = installedDnd5eRulesPlugins().filter((item) => item.id !== descriptor.id)
  try {
    activatePlugin(artifact, integrity)
    await storeModuleBytes(artifact.manifest.id, input.bytes)
    persistInstalled([...next, descriptor])
  } catch (error) {
    unregisterDnd5eRulesPlugin(artifact.manifest.id)
    if (artifact.kind === 'worker') terminateDnd5ePluginSandbox(artifact.manifest.id)
    let rollbackError: unknown
    try {
      if (previousDescriptor && previousBytes) {
        const previousArtifact = await loadPluginArtifact(previousBytes)
        activatePlugin(previousArtifact, previousDescriptor.integrity)
        if (previousDescriptor.source === 'file') await storeModuleBytes(previousDescriptor.id, previousBytes)
      } else {
        await deleteModuleBytes(artifact.manifest.id)
      }
    } catch (reason) {
      rollbackError = reason
    }
    if (rollbackError) {
      const original = error instanceof Error ? error.message : String(error)
      const rollback = rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
      throw new Error(`${original}；旧规则包回滚失败：${rollback}`, { cause: error })
    }
    throw error
  }
  return cloneDescriptor(descriptor)
}

async function installEphemeralFileBytes(input: {
  bytes: ArrayBuffer
  fileName: string
  expectedId: string
  expectedVersion: string
  expectedIntegrity: string
}): Promise<InstalledDnd5eRulesPlugin> {
  if (!getRoomSession()) throw new Error('room-ephemeral 内容包只能在联网房间内临时运行')
  if (input.bytes.byteLength < 1) throw new Error('插件文件为空')
  const integrity = await sha256Integrity(input.bytes)
  if (integrity !== input.expectedIntegrity) {
    throw new Error(`完整性校验失败；期望 ${input.expectedIntegrity}，实际 ${integrity}`)
  }
  const artifact = await loadPluginArtifact(input.bytes)
  assertPluginId(artifact.manifest.id)
  if (
    artifact.manifest.id !== input.expectedId ||
    artifact.manifest.version !== input.expectedVersion
  ) {
    terminatePluginArtifact(artifact)
    throw new Error('房间临时内容包的清单 ID 或版本与房间锁定值不一致')
  }
  if (artifact.manifest.distributionPolicy !== 'room-ephemeral') {
    terminatePluginArtifact(artifact)
    throw new Error('内存安装入口只接受 room-ephemeral 内容包')
  }
  const descriptor: Extract<InstalledDnd5eRulesPlugin, { source: 'ephemeral' }> = {
    id: artifact.manifest.id,
    source: 'ephemeral',
    fileName: input.fileName,
    integrity,
    enabled: true,
  }
  try {
    activatePlugin(artifact, integrity)
    ephemeralModuleBytes.set(descriptor.id, input.bytes.slice(0))
    ephemeralDescriptors.set(descriptor.id, descriptor)
  } catch (error) {
    ephemeralModuleBytes.delete(descriptor.id)
    ephemeralDescriptors.delete(descriptor.id)
    throw error
  }
  return cloneDescriptor(descriptor)
}

async function clearEphemeralPlugins(): Promise<void> {
  const pluginIds = [...ephemeralDescriptors.keys()]
  ephemeralDescriptors.clear()
  ephemeralModuleBytes.clear()
  for (const pluginId of pluginIds) {
    unregisterDnd5eRulesPlugin(pluginId)
    terminateDnd5ePluginSandbox(pluginId)
    const persistent = installedDnd5eRulesPlugins().find((descriptor) => descriptor.id === pluginId)
    if (persistent?.enabled) activatePlugin(await importPinnedPlugin(persistent), persistent.integrity)
  }
}

export async function loadInstalledDnd5eRulesPlugins(): Promise<Dnd5eRulesPluginLoadFailure[]> {
  const failures: Dnd5eRulesPluginLoadFailure[] = []
  for (const descriptor of installedDnd5eRulesPlugins()) {
    if (!descriptor.enabled || registeredDnd5eRulesPlugins().some((plugin) => plugin.id === descriptor.id)) continue
    try {
      activatePlugin(await importPinnedPlugin(descriptor), descriptor.integrity)
    } catch (error) {
      failures.push({ id: descriptor.id, error: error instanceof Error ? error.message : String(error) })
    }
  }
  return failures
}

export function exposeDnd5eRulesPluginHost(): Dnd5eRulesPluginHost {
  const existing = window.DNDSTARS_5E_RULES_PLUGINS
  if (existing) return existing
  const host: Dnd5eRulesPluginHost = {
    apiVersion: DND5E_RULES_PLUGIN_API_VERSION,
    async install(descriptor) {
      if (descriptor.source === 'ephemeral') {
        throw new Error('房间临时插件必须通过 installEphemeralBytes 提供内存字节')
      }
      const candidate = cloneDescriptor({ ...descriptor, enabled: true })
      const artifact = await importPinnedPlugin(candidate)
      activatePlugin(artifact, candidate.integrity)
      const next = installedDnd5eRulesPlugins().filter((item) => item.id !== candidate.id)
      persistInstalled([...next, candidate])
    },
    async installFile(file) {
      return installFileBytes({ bytes: await file.arrayBuffer(), fileName: file.name })
    },
    async installBytes(input) {
      return installFileBytes({
        bytes: input.bytes,
        fileName: input.fileName,
        expectedId: input.id,
        expectedVersion: input.version,
        expectedIntegrity: input.integrity,
      })
    },
    async installEphemeralBytes(input) {
      return installEphemeralFileBytes({
        bytes: input.bytes,
        fileName: input.fileName,
        expectedId: input.id,
        expectedVersion: input.version,
        expectedIntegrity: input.integrity,
      })
    },
    async inspectFile(file) {
      return inspectPluginBytes(await file.arrayBuffer(), file.name)
    },
    async migrateState(input) {
      const artifact = await loadPluginArtifact(input.bytes)
      try {
        if (artifact.kind === 'declarative-v1' || artifact.kind === 'content-v2' || artifact.kind === 'unified-v1') {
          const target = artifact.manifest.stateSchemaVersion ?? 1
          if (input.fromVersion !== target) throw new Error('声明式内容包不包含可执行状态迁移；请保持 stateSchemaVersion 不变')
          return { state: input.state, fromVersion: input.fromVersion, toVersion: target }
        }
        return await artifact.session.migrateState(input.fromVersion, input.state)
      } finally {
        terminatePluginArtifact(artifact)
      }
    },
    async readBytes(pluginId) {
      const descriptor = ephemeralDescriptors.get(pluginId) ??
        installedDnd5eRulesPlugins().find((item) => item.id === pluginId)
      if (!descriptor) throw new Error(`本机未安装插件：${pluginId}`)
      return descriptorBytes(descriptor)
    },
    async remove(pluginId) {
      unregisterDnd5eRulesPlugin(pluginId)
      terminateDnd5ePluginSandbox(pluginId)
      if (ephemeralDescriptors.has(pluginId)) {
        ephemeralDescriptors.delete(pluginId)
        ephemeralModuleBytes.delete(pluginId)
        const persistent = installedDnd5eRulesPlugins().find((descriptor) => descriptor.id === pluginId)
        if (persistent?.enabled) activatePlugin(await importPinnedPlugin(persistent), persistent.integrity)
        return
      }
      persistInstalled(installedDnd5eRulesPlugins().filter((item) => item.id !== pluginId))
      await deleteModuleBytes(pluginId)
    },
    clearEphemeral: clearEphemeralPlugins,
    listInstalled: () => [
      ...installedDnd5eRulesPlugins(),
      ...ephemeralDescriptors.values(),
    ].map(cloneDescriptor),
    listActive: () => registeredDnd5eRulesPlugins(),
  }
  window.DNDSTARS_5E_RULES_PLUGINS = Object.freeze(host)
  return host
}

let pluginHostInitialization: Promise<Dnd5eRulesPluginLoadFailure[]> | null = null

/**
 * Public pages deliberately avoid loading the rules runtime. A login can then
 * enter a campaign through client-side navigation without re-running
 * `main.tsx`, so the workspace must be able to initialize the host lazily.
 * Keep the operation shared and retryable because the app heartbeat and route
 * bootstrap may reach it at the same time.
 */
export function ensureDnd5eRulesPluginHost(): Promise<Dnd5eRulesPluginLoadFailure[]> {
  if (pluginHostInitialization) return pluginHostInitialization
  pluginHostInitialization = (async () => {
    exposeDnd5eRulesPluginHost()
    return loadInstalledDnd5eRulesPlugins()
  })().catch((error) => {
    pluginHostInitialization = null
    throw error
  })
  return pluginHostInitialization
}
