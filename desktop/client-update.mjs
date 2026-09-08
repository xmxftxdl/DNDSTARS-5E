import { createHash, verify as verifySignature } from 'node:crypto'
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { unzipSync } from 'fflate'

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/

export function compareVersions(left, right) {
  const parse = (value) => {
    const [core = '', prerelease = ''] = String(value).split('-', 2)
    return {
      core: core.split('.').map((part) => Number(part) || 0),
      prerelease: prerelease ? prerelease.split('.') : [],
    }
  }
  const a = parse(left)
  const b = parse(right)
  for (let index = 0; index < 3; index += 1) {
    if (a.core[index] !== b.core[index]) return a.core[index] > b.core[index] ? 1 : -1
  }
  if (a.prerelease.length === 0 && b.prerelease.length > 0) return 1
  if (b.prerelease.length === 0 && a.prerelease.length > 0) return -1
  for (let index = 0; index < Math.max(a.prerelease.length, b.prerelease.length); index += 1) {
    const aPart = a.prerelease[index]
    const bPart = b.prerelease[index]
    if (aPart == null) return -1
    if (bPart == null) return 1
    if (aPart === bPart) continue
    const aNumber = /^\d+$/.test(aPart) ? Number(aPart) : null
    const bNumber = /^\d+$/.test(bPart) ? Number(bPart) : null
    if (aNumber != null && bNumber != null) return aNumber > bNumber ? 1 : -1
    if (aNumber != null) return -1
    if (bNumber != null) return 1
    return aPart > bPart ? 1 : -1
  }
  return 0
}

function secureDownloadUrl(value, allowLoopbackHttp = false) {
  try {
    const parsed = new URL(String(value))
    if (parsed.protocol === 'https:') return parsed.href
    if (
      allowLoopbackHttp &&
      parsed.protocol === 'http:' &&
      ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(parsed.hostname)
    ) return parsed.href
  } catch {
    // Invalid URLs are rejected below.
  }
  return null
}

export function parseClientReleaseManifest(value, options = {}) {
  if (!value || typeof value !== 'object') return null
  if (value.available === false) return { available: false }
  if (
    value.schemaVersion !== 1 ||
    value.service !== 'astraltrace-desktop-client' ||
    value.platform !== 'win32' ||
    value.arch !== 'x64' ||
    value.channel !== options.channel ||
    !VERSION_PATTERN.test(String(value.version)) ||
    !VERSION_PATTERN.test(String(value.minimumShellVersion)) ||
    !Number.isInteger(value.protocolVersion) ||
    !value.package ||
    typeof value.package !== 'object'
  ) return null
  const url = secureDownloadUrl(value.package.url, options.allowLoopbackHttp === true)
  const sha256 = String(value.package.sha256 ?? '').toLowerCase()
  if (!url || !SHA256_PATTERN.test(sha256)) return null
  if (value.package.signature != null && typeof value.package.signature !== 'string') return null
  return {
    available: true,
    schemaVersion: 1,
    service: 'astraltrace-desktop-client',
    channel: value.channel,
    platform: 'win32',
    arch: 'x64',
    version: value.version,
    protocolVersion: value.protocolVersion,
    minimumShellVersion: value.minimumShellVersion,
    publishedAt: typeof value.publishedAt === 'string' ? value.publishedAt : undefined,
    package: {
      url,
      sha256,
      ...(value.package.signature ? { signature: value.package.signature } : {}),
    },
  }
}

export function safeArchiveEntryPath(entryName) {
  const normalized = String(entryName).replaceAll('\\', '/')
  if (
    !normalized ||
    normalized.startsWith('/') ||
    /^[A-Za-z]:/.test(normalized) ||
    normalized.split('/').some((part) => part === '..' || part === '')
  ) return null
  return normalized
}

export function packageSha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function verifyPackageSignature(bytes, signature, publicKeyPem) {
  if (!publicKeyPem) return !signature
  if (!signature) return false
  try {
    return verifySignature(null, bytes, publicKeyPem, Buffer.from(signature, 'base64'))
  } catch {
    return false
  }
}

async function pathIsDirectory(directory) {
  try {
    return (await stat(directory)).isDirectory()
  } catch {
    return false
  }
}

export async function readActiveClientVersion(clientRoot) {
  try {
    const pointer = JSON.parse(await readFile(path.join(clientRoot, 'current.json'), 'utf8'))
    if (!VERSION_PATTERN.test(String(pointer.version))) return null
    const root = path.join(clientRoot, 'versions', pointer.version)
    await stat(path.join(root, 'index.html'))
    return { version: pointer.version, root }
  } catch {
    return null
  }
}

async function writeActivePointer(clientRoot, version) {
  const pointerPath = path.join(clientRoot, 'current.json')
  const stagingPath = `${pointerPath}.${process.pid}.tmp`
  await writeFile(stagingPath, `${JSON.stringify({ version, activatedAt: Date.now() }, null, 2)}\n`, 'utf8')
  const retryDelays = [0, 15, 40, 100]
  let lastError
  for (const delay of retryDelays) {
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))
    try {
      await rename(stagingPath, pointerPath)
      return
    } catch (error) {
      lastError = error
      if (!['EACCES', 'EBUSY', 'EPERM'].includes(error?.code)) break
    }
  }
  await rm(stagingPath, { force: true })
  throw lastError
}

async function retainNewestVersions(versionsRoot, activeVersion, keep = 2) {
  let entries = []
  try {
    entries = await readdir(versionsRoot, { withFileTypes: true })
  } catch {
    return
  }
  const candidates = []
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === activeVersion) continue
    const root = path.join(versionsRoot, entry.name)
    const details = await stat(root).catch(() => null)
    if (details) candidates.push({ root, modifiedAt: details.mtimeMs })
  }
  candidates.sort((left, right) => right.modifiedAt - left.modifiedAt)
  for (const stale of candidates.slice(Math.max(0, keep - 1))) {
    await rm(stale.root, { recursive: true, force: true })
  }
}

export async function installClientBundle({
  archiveBytes,
  manifest,
  clientRoot,
  releasePublicKeyPem = '',
}) {
  const bytes = Buffer.from(archiveBytes)
  if (packageSha256(bytes) !== manifest.package.sha256) throw new Error('client-package-integrity-failed')
  if (!verifyPackageSignature(bytes, manifest.package.signature, releasePublicKeyPem)) {
    throw new Error('client-package-signature-failed')
  }

  const versionsRoot = path.join(clientRoot, 'versions')
  const finalRoot = path.join(versionsRoot, manifest.version)
  const stagingRoot = path.join(clientRoot, 'staging', `${manifest.version}-${process.pid}-${Date.now()}`)
  await mkdir(stagingRoot, { recursive: true })
  try {
    const archive = unzipSync(new Uint8Array(bytes))
    for (const [entryName, contents] of Object.entries(archive)) {
      const safeName = safeArchiveEntryPath(entryName)
      if (!safeName) throw new Error('client-package-unsafe-path')
      const outputPath = path.join(stagingRoot, ...safeName.split('/'))
      await mkdir(path.dirname(outputPath), { recursive: true })
      await writeFile(outputPath, contents)
    }
    await stat(path.join(stagingRoot, 'index.html'))
    await mkdir(versionsRoot, { recursive: true })
    if (await pathIsDirectory(finalRoot)) await rm(finalRoot, { recursive: true, force: true })
    await rename(stagingRoot, finalRoot)
    await writeActivePointer(clientRoot, manifest.version)
    await retainNewestVersions(versionsRoot, manifest.version)
    return { version: manifest.version, root: finalRoot }
  } catch (error) {
    await rm(stagingRoot, { recursive: true, force: true })
    throw error
  }
}
