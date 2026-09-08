import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const PLUGIN_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/
const INTEGRITY_PATTERN = /^sha256-([A-Za-z0-9+/]+={0,2})$/
const MAX_PACKAGE_BYTES = 64 * 1024 * 1024
const RETAINED_VERSIONS_PER_PLUGIN = 3

function validPluginId(value) {
  const normalized = String(value ?? '')
  if (!PLUGIN_ID_PATTERN.test(normalized)) throw new Error('desktop-plugin-id-invalid')
  return normalized
}

function packageHash(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function packageIntegrity(bytes) {
  return `sha256-${createHash('sha256').update(bytes).digest('base64')}`
}

function normalizeMetadata(input, bytes) {
  const pluginId = validPluginId(input.pluginId)
  const version = String(input.version ?? '').trim()
  const fileName = path.basename(String(input.fileName ?? '')).slice(0, 240)
  const integrity = String(input.integrity ?? '').trim()
  if (!version || version.length > 120) throw new Error('desktop-plugin-version-invalid')
  if (!fileName) throw new Error('desktop-plugin-filename-invalid')
  if (!INTEGRITY_PATTERN.test(integrity) || packageIntegrity(bytes) !== integrity) {
    throw new Error('desktop-plugin-integrity-failed')
  }
  return { pluginId, version, fileName, integrity, hash: packageHash(bytes) }
}

function emptyIndex() {
  return { schemaVersion: 1, active: {}, packages: [] }
}

function normalizeIndex(value) {
  if (!value || typeof value !== 'object' || value.schemaVersion !== 1) return emptyIndex()
  const packages = Array.isArray(value.packages)
    ? value.packages.filter((entry) => (
      entry &&
      typeof entry === 'object' &&
      PLUGIN_ID_PATTERN.test(String(entry.pluginId)) &&
      typeof entry.version === 'string' &&
      typeof entry.fileName === 'string' &&
      typeof entry.integrity === 'string' &&
      /^[a-f0-9]{64}$/.test(String(entry.hash)) &&
      Number.isFinite(entry.installedAt)
    )).map((entry) => ({ ...entry }))
    : []
  const active = {}
  if (value.active && typeof value.active === 'object') {
    for (const [pluginId, hash] of Object.entries(value.active)) {
      if (PLUGIN_ID_PATTERN.test(pluginId) && /^[a-f0-9]{64}$/.test(String(hash))) active[pluginId] = hash
    }
  }
  return { schemaVersion: 1, active, packages }
}

async function pathIsFile(filePath) {
  try {
    return (await stat(filePath)).isFile()
  } catch {
    return false
  }
}

async function atomicJsonWrite(filePath, value) {
  const staging = `${filePath}.${process.pid}.${Date.now()}.tmp`
  await writeFile(staging, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  const delays = [0, 15, 40, 100]
  let lastError
  for (const delay of delays) {
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))
    try {
      await rename(staging, filePath)
      return
    } catch (error) {
      lastError = error
      if (!['EACCES', 'EBUSY', 'EPERM'].includes(error?.code)) break
    }
  }
  await rm(staging, { force: true })
  throw lastError
}

export function createDesktopPluginPackageStore(root) {
  const storeRoot = path.resolve(root)
  const packagesRoot = path.join(storeRoot, 'packages')
  const quarantineRoot = path.join(storeRoot, 'quarantine')
  const indexPath = path.join(storeRoot, 'index.json')

  async function initialize() {
    await mkdir(packagesRoot, { recursive: true })
    await mkdir(quarantineRoot, { recursive: true })
  }

  async function readIndex() {
    await initialize()
    try {
      return normalizeIndex(JSON.parse(await readFile(indexPath, 'utf8')))
    } catch {
      return emptyIndex()
    }
  }

  async function removeUnreferencedPackages(index, hashes) {
    const referenced = new Set(index.packages.map((entry) => entry.hash))
    for (const hash of hashes) {
      if (!referenced.has(hash)) await rm(path.join(packagesRoot, `${hash}.astralplugin`), { force: true })
    }
  }

  async function put(input) {
    const bytes = Buffer.from(input.bytes)
    if (bytes.byteLength < 1 || bytes.byteLength > MAX_PACKAGE_BYTES) throw new Error('desktop-plugin-size-invalid')
    const metadata = normalizeMetadata(input, bytes)
    const packagePath = path.join(packagesRoot, `${metadata.hash}.astralplugin`)
    await initialize()
    if (!(await pathIsFile(packagePath))) {
      const staging = `${packagePath}.${process.pid}.${Date.now()}.tmp`
      await writeFile(staging, bytes, { flag: 'wx' })
      try {
        await rename(staging, packagePath)
      } catch (error) {
        await rm(staging, { force: true })
        if (!(await pathIsFile(packagePath))) throw error
      }
    }

    const now = Date.now()
    const index = await readIndex()
    const previousHashes = index.packages.filter((entry) => entry.pluginId === metadata.pluginId).map((entry) => entry.hash)
    const samePackage = index.packages.find((entry) => entry.pluginId === metadata.pluginId && entry.hash === metadata.hash)
    const entry = {
      ...metadata,
      installedAt: samePackage?.installedAt ?? now,
      lastUsedAt: now,
      size: bytes.byteLength,
    }
    const otherPackages = index.packages.filter((candidate) => (
      candidate.pluginId !== metadata.pluginId || candidate.hash !== metadata.hash
    ))
    const pluginPackages = [...otherPackages.filter((candidate) => candidate.pluginId === metadata.pluginId), entry]
      .sort((left, right) => right.lastUsedAt - left.lastUsedAt)
      .slice(0, RETAINED_VERSIONS_PER_PLUGIN)
    index.packages = [
      ...otherPackages.filter((candidate) => candidate.pluginId !== metadata.pluginId),
      ...pluginPackages,
    ]
    index.active[metadata.pluginId] = metadata.hash
    await atomicJsonWrite(indexPath, index)
    await removeUnreferencedPackages(index, previousHashes)
    return { ...entry }
  }

  async function get(pluginIdInput, expectedIntegrity) {
    const pluginId = validPluginId(pluginIdInput)
    const index = await readIndex()
    if (expectedIntegrity != null && !INTEGRITY_PATTERN.test(String(expectedIntegrity))) {
      throw new Error('desktop-plugin-integrity-invalid')
    }
    const hash = index.active[pluginId]
    const entry = index.packages.find((candidate) => (
      candidate.pluginId === pluginId &&
      (expectedIntegrity ? candidate.integrity === expectedIntegrity : candidate.hash === hash)
    ))
    if (!entry) return null
    const packagePath = path.join(packagesRoot, `${entry.hash}.astralplugin`)
    let bytes
    try {
      bytes = await readFile(packagePath)
    } catch {
      return null
    }
    if (packageHash(bytes) !== entry.hash || packageIntegrity(bytes) !== entry.integrity) {
      const quarantinePath = path.join(quarantineRoot, `${entry.hash}-${Date.now()}.astralplugin`)
      await rename(packagePath, quarantinePath).catch(() => undefined)
      index.packages = index.packages.filter((candidate) => candidate.hash !== entry.hash)
      for (const [candidateId, activeHash] of Object.entries(index.active)) {
        if (activeHash === entry.hash) delete index.active[candidateId]
      }
      await atomicJsonWrite(indexPath, index)
      throw new Error('desktop-plugin-package-corrupted')
    }
    entry.lastUsedAt = Date.now()
    index.active[pluginId] = entry.hash
    await atomicJsonWrite(indexPath, index)
    return { ...entry, bytes }
  }

  async function remove(pluginIdInput) {
    const pluginId = validPluginId(pluginIdInput)
    const index = await readIndex()
    const removedHashes = index.packages.filter((entry) => entry.pluginId === pluginId).map((entry) => entry.hash)
    index.packages = index.packages.filter((entry) => entry.pluginId !== pluginId)
    delete index.active[pluginId]
    await atomicJsonWrite(indexPath, index)
    await removeUnreferencedPackages(index, removedHashes)
  }

  async function list() {
    const index = await readIndex()
    return Object.entries(index.active).flatMap(([pluginId, hash]) => {
      const entry = index.packages.find((candidate) => candidate.pluginId === pluginId && candidate.hash === hash)
      return entry ? [{ ...entry }] : []
    })
  }

  return Object.freeze({ put, get, remove, list })
}
