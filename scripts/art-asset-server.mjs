import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, realpath, stat } from 'node:fs/promises'
import path from 'node:path'

export const ART_ASSET_MANIFEST_SCHEMA_VERSION = 1
export const DEFAULT_ART_ASSET_PUBLIC_PREFIX = '/assets'
export const DEFAULT_ART_ASSET_DIRECTORIES = Object.freeze([
  'assets/portraits',
  'assets/icons',
  'assets/vfx',
])
export const DEFAULT_ART_ASSET_CACHE_CONTROL = 'public, max-age=0, must-revalidate'
export const IMMUTABLE_ART_ASSET_CACHE_CONTROL = 'public, max-age=31536000, immutable'

const MAX_MANIFEST_BYTES = 8 * 1024 * 1024
const MAX_MANIFEST_FILES = 100_000
const MAX_RELATIVE_PATH_LENGTH = 512
const MAX_PATH_SEGMENT_LENGTH = 160
const FILE_HASH_CONCURRENCY = 8
const SHA256_PATTERN = /^[a-f0-9]{64}$/i
const IDENTIFIER_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/
const SAFE_PATH_SEGMENT_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/
const CONTENT_TYPE_BY_EXTENSION = new Map([
  ['.avif', 'image/avif'],
  ['.gif', 'image/gif'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
])
const packStates = new WeakMap()

export class ArtAssetPackError extends Error {
  constructor(code, details = undefined) {
    super(code)
    this.name = 'ArtAssetPackError'
    this.code = code
    this.details = details
  }
}

function plainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function sha256File(filename) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filename)
    stream.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

async function mapWithConcurrency(values, concurrency, worker) {
  const results = new Array(values.length)
  let cursor = 0
  await Promise.all(Array.from(
    { length: Math.min(concurrency, Math.max(1, values.length)) },
    async () => {
      for (;;) {
        const index = cursor
        cursor += 1
        if (index >= values.length) return
        results[index] = await worker(values[index], index)
      }
    },
  ))
  return results
}

function containedBy(root, candidate) {
  const relative = path.relative(root, candidate)
  return relative !== '' && relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
}

function normalizedPublicPrefix(value) {
  const prefix = String(value ?? DEFAULT_ART_ASSET_PUBLIC_PREFIX).trim()
  if (
    !prefix.startsWith('/') ||
    prefix === '/' ||
    prefix.endsWith('/') ||
    prefix.includes('\\') ||
    prefix.includes('\0') ||
    prefix.split('/').some((segment, index) => index > 0 && !SAFE_PATH_SEGMENT_PATTERN.test(segment))
  ) {
    throw new ArtAssetPackError('invalid-art-asset-public-prefix')
  }
  return prefix
}

function normalizedDirectories(value) {
  const directories = value == null ? [...DEFAULT_ART_ASSET_DIRECTORIES] : value
  if (
    !Array.isArray(directories) ||
    directories.length < 1 ||
    directories.length > 32 ||
    directories.some((entry) => {
      if (
        typeof entry !== 'string' ||
        entry.length < 3 ||
        entry.length > MAX_RELATIVE_PATH_LENGTH ||
        entry.startsWith('/') ||
        entry.endsWith('/') ||
        entry.includes('\\') ||
        entry.includes('\0') ||
        entry.includes('%')
      ) return true
      const segments = entry.split('/')
      return segments.some((segment) =>
        segment.length < 1 ||
        segment.length > MAX_PATH_SEGMENT_LENGTH ||
        !SAFE_PATH_SEGMENT_PATTERN.test(segment))
    })
  ) {
    throw new ArtAssetPackError('invalid-art-asset-directories')
  }
  const unique = [...new Set(directories)]
  if (unique.length !== directories.length) {
    throw new ArtAssetPackError('duplicate-art-asset-directory')
  }
  return unique
}

function normalizedCacheControl(value, immutable) {
  const cacheControl = value == null
    ? (immutable ? IMMUTABLE_ART_ASSET_CACHE_CONTROL : DEFAULT_ART_ASSET_CACHE_CONTROL)
    : String(value).trim()
  if (!cacheControl || cacheControl.length > 240 || /[\r\n]/.test(cacheControl)) {
    throw new ArtAssetPackError('invalid-art-asset-cache-control')
  }
  return cacheControl
}

function safeRelativeAssetPath(value, allowedDirectories) {
  if (
    typeof value !== 'string' ||
    value.length < 3 ||
    value.length > MAX_RELATIVE_PATH_LENGTH ||
    value.startsWith('/') ||
    value.endsWith('/') ||
    value.includes('\\') ||
    value.includes('\0') ||
    value.includes('%')
  ) {
    return null
  }
  const segments = value.split('/')
  if (
    segments.length < 2 ||
    ![...allowedDirectories].some((directory) =>
      value === directory || value.startsWith(`${directory}/`)) ||
    segments.some((segment) =>
      segment.length < 1 ||
      segment.length > MAX_PATH_SEGMENT_LENGTH ||
      segment === '.' ||
      segment === '..' ||
      !SAFE_PATH_SEGMENT_PATTERN.test(segment))
  ) {
    return null
  }
  return segments.join('/')
}

function manifestContentType(relativePath, supplied) {
  const expected = CONTENT_TYPE_BY_EXTENSION.get(path.posix.extname(relativePath).toLowerCase())
  if (!expected || typeof supplied !== 'string' || supplied.toLowerCase() !== expected) {
    throw new ArtAssetPackError('invalid-art-asset-content-type', relativePath)
  }
  return expected
}

function manifestIdentifier(value, field) {
  if (typeof value !== 'string' || !IDENTIFIER_PATTERN.test(value)) {
    throw new ArtAssetPackError(`invalid-art-asset-${field}`)
  }
  return value
}

async function canonicalFileRecord(realRoot, relativePath, entry, verifyContent) {
  const candidatePath = path.resolve(realRoot, ...relativePath.split('/'))
  if (!containedBy(realRoot, candidatePath)) {
    throw new ArtAssetPackError('art-asset-path-outside-root', relativePath)
  }
  let canonicalPath
  let fileInfo
  try {
    canonicalPath = await realpath(candidatePath)
    if (!containedBy(realRoot, canonicalPath)) {
      throw new ArtAssetPackError('art-asset-symlink-outside-root', relativePath)
    }
    fileInfo = await stat(canonicalPath)
  } catch (error) {
    if (error instanceof ArtAssetPackError) throw error
    throw new ArtAssetPackError('art-asset-file-missing', relativePath)
  }
  if (!fileInfo.isFile()) {
    throw new ArtAssetPackError('art-asset-not-a-file', relativePath)
  }
  if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 1 || fileInfo.size !== entry.bytes) {
    throw new ArtAssetPackError('art-asset-size-mismatch', relativePath)
  }
  if (typeof entry.sha256 !== 'string' || !SHA256_PATTERN.test(entry.sha256)) {
    throw new ArtAssetPackError('invalid-art-asset-sha256', relativePath)
  }
  const expectedSha256 = entry.sha256.toLowerCase()
  if (verifyContent && await sha256File(canonicalPath) !== expectedSha256) {
    throw new ArtAssetPackError('art-asset-digest-mismatch', relativePath)
  }
  return Object.freeze({
    relativePath,
    candidatePath,
    contentType: manifestContentType(relativePath, entry.contentType),
    bytes: entry.bytes,
    sha256: expectedSha256,
    etag: `"sha256-${expectedSha256}"`,
    mtimeMs: fileInfo.mtimeMs,
  })
}

/**
 * Load and validate one read-only art pack. The manifest is an allowlist; files
 * absent from it are never addressable through serveArtAsset().
 */
export async function loadArtAssetPack(options) {
  if (!plainObject(options) || typeof options.root !== 'string' || !options.root.trim()) {
    throw new ArtAssetPackError('missing-art-asset-root')
  }
  const configuredRoot = path.resolve(options.root)
  let realRoot
  try {
    realRoot = await realpath(configuredRoot)
    if (!(await stat(realRoot)).isDirectory()) {
      throw new ArtAssetPackError('art-asset-root-not-directory')
    }
  } catch (error) {
    if (error instanceof ArtAssetPackError) throw error
    throw new ArtAssetPackError('art-asset-root-unavailable')
  }

  const manifestCandidate = options.manifestPath == null
    ? path.resolve(realRoot, 'runtime-assets', 'art-asset-pack.json')
    : path.resolve(String(options.manifestPath))
  let manifestRealPath
  let manifestBytes
  try {
    manifestRealPath = await realpath(manifestCandidate)
    const info = await stat(manifestRealPath)
    if (!info.isFile() || info.size < 2 || info.size > MAX_MANIFEST_BYTES) {
      throw new ArtAssetPackError('invalid-art-asset-manifest-size')
    }
    manifestBytes = await readFile(manifestRealPath)
  } catch (error) {
    if (error instanceof ArtAssetPackError) throw error
    throw new ArtAssetPackError('art-asset-manifest-unavailable')
  }

  const manifestSha256 = sha256(manifestBytes)
  if (options.expectedManifestSha256 != null) {
    const expected = String(options.expectedManifestSha256).trim().toLowerCase()
    if (!SHA256_PATTERN.test(expected) || expected !== manifestSha256) {
      throw new ArtAssetPackError('art-asset-manifest-digest-mismatch')
    }
  }

  let manifest
  try {
    manifest = JSON.parse(manifestBytes.toString('utf8'))
  } catch {
    throw new ArtAssetPackError('invalid-art-asset-manifest-json')
  }
  if (
    !plainObject(manifest) ||
    manifest.schemaVersion !== ART_ASSET_MANIFEST_SCHEMA_VERSION ||
    !Array.isArray(manifest.files) ||
    manifest.files.length < 1 ||
    manifest.files.length > MAX_MANIFEST_FILES
  ) {
    throw new ArtAssetPackError('invalid-art-asset-manifest')
  }

  const publicPrefix = normalizedPublicPrefix(options.publicPrefix)
  const directories = normalizedDirectories(options.allowedDirectories)
  const allowedDirectories = new Set(directories)
  const verifyContent = options.verifyContent !== false
  const records = new Map()
  const manifestEntries = []
  for (const entry of manifest.files) {
    if (!plainObject(entry)) throw new ArtAssetPackError('invalid-art-asset-entry')
    const relativePath = safeRelativeAssetPath(entry.path, allowedDirectories)
    if (!relativePath) throw new ArtAssetPackError('invalid-art-asset-path', entry.path)
    if (records.has(relativePath)) {
      throw new ArtAssetPackError('duplicate-art-asset-path', relativePath)
    }
    records.set(relativePath, null)
    manifestEntries.push({ relativePath, entry })
  }
  const loadedRecords = await mapWithConcurrency(
    manifestEntries,
    FILE_HASH_CONCURRENCY,
    ({ relativePath, entry }) =>
      canonicalFileRecord(realRoot, relativePath, entry, verifyContent),
  )
  records.clear()
  for (const record of loadedRecords) {
    records.set(record.relativePath, record)
  }

  const pack = Object.freeze({
    schemaVersion: ART_ASSET_MANIFEST_SCHEMA_VERSION,
    packId: manifestIdentifier(manifest.packId, 'pack-id'),
    version: manifestIdentifier(manifest.version, 'version'),
    root: realRoot,
    manifestPath: manifestRealPath,
    manifestSha256,
    publicPrefix,
    allowedDirectories: Object.freeze(directories),
    cacheControl: normalizedCacheControl(options.cacheControl, options.immutable === true),
    contentVerified: verifyContent,
    fileCount: records.size,
  })
  packStates.set(pack, {
    realRoot,
    allowedDirectories,
    records,
  })
  return pack
}

/**
 * Parse a single RFC 9110 byte range. Multiple ranges are deliberately rejected
 * so the server never needs to assemble multipart responses.
 */
export function parseSingleByteRange(value, size) {
  if (value == null || value === '') return { kind: 'none' }
  if (!Number.isSafeInteger(size) || size < 1 || Array.isArray(value)) {
    return { kind: 'invalid' }
  }
  const source = String(value).trim()
  if (source.includes(',')) return { kind: 'invalid' }
  const match = /^bytes=(\d*)-(\d*)$/i.exec(source)
  if (!match || (!match[1] && !match[2])) return { kind: 'invalid' }

  if (!match[1]) {
    const suffixLength = Number(match[2])
    if (!Number.isSafeInteger(suffixLength) || suffixLength < 1) return { kind: 'invalid' }
    const length = Math.min(size, suffixLength)
    return { kind: 'range', start: size - length, end: size - 1 }
  }

  const start = Number(match[1])
  if (!Number.isSafeInteger(start) || start < 0 || start >= size) return { kind: 'invalid' }
  const requestedEnd = match[2] ? Number(match[2]) : size - 1
  if (!Number.isSafeInteger(requestedEnd) || requestedEnd < start) return { kind: 'invalid' }
  return { kind: 'range', start, end: Math.min(size - 1, requestedEnd) }
}

function rawRequestPath(requestTarget) {
  const value = String(requestTarget ?? '/')
  const queryIndex = value.indexOf('?')
  const hashIndex = value.indexOf('#')
  const end = Math.min(
    queryIndex < 0 ? value.length : queryIndex,
    hashIndex < 0 ? value.length : hashIndex,
  )
  return value.slice(0, end)
}

function resolveRequestRecord(req, pack, state) {
  const rawPath = rawRequestPath(req.url)
  let decodedPath
  try {
    decodedPath = decodeURIComponent(rawPath)
  } catch {
    return rawPath.toLowerCase().startsWith(pack.publicPrefix.toLowerCase())
      ? { kind: 'invalid' }
      : { kind: 'unhandled' }
  }
  const prefix = `${pack.publicPrefix}/`
  if (!decodedPath.startsWith(prefix)) return { kind: 'unhandled' }
  const relativePath = decodedPath.slice(1)
  const controlled = [...state.allowedDirectories].some((directory) =>
    relativePath === directory || relativePath.startsWith(`${directory}/`))
  if (!controlled) return { kind: 'unhandled' }
  if (/%(?:2f|5c)/i.test(rawPath)) return { kind: 'invalid' }
  const safePath = safeRelativeAssetPath(relativePath, state.allowedDirectories)
  if (!safePath) return { kind: 'invalid' }
  return {
    kind: 'asset',
    record: state.records.get(safePath) ?? null,
  }
}

function ifNoneMatchMatches(value, etag) {
  if (value == null) return false
  const normalizedEtag = etag.replace(/^W\//i, '')
  return String(value).split(',').some((candidate) => {
    const normalized = candidate.trim()
    return normalized === '*' || normalized.replace(/^W\//i, '') === normalizedEtag
  })
}

function ifRangeAllows(value, etag, mtimeMs) {
  if (value == null || value === '') return true
  const source = String(value).trim()
  if (source.startsWith('"') || source.startsWith('W/')) return source === etag
  const timestamp = Date.parse(source)
  return Number.isFinite(timestamp) && Math.floor(mtimeMs / 1000) * 1000 <= timestamp
}

function responseHeaders(pack, record, mtimeMs) {
  return {
    'Accept-Ranges': 'bytes',
    'Cache-Control': pack.cacheControl,
    'Content-Type': record.contentType,
    ETag: record.etag,
    'Last-Modified': new Date(mtimeMs).toUTCString(),
    'X-Content-Type-Options': 'nosniff',
  }
}

function sendText(req, res, status, body, headers = {}) {
  const bytes = Buffer.from(body)
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': String(bytes.length),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  })
  if (String(req.method ?? 'GET').toUpperCase() === 'HEAD') res.end()
  else res.end(bytes)
}

async function currentFile(state, record) {
  let canonicalPath
  let info
  try {
    canonicalPath = await realpath(record.candidatePath)
    if (!containedBy(state.realRoot, canonicalPath)) return null
    info = await stat(canonicalPath)
  } catch {
    return null
  }
  if (
    !info.isFile() ||
    info.size !== record.bytes ||
    info.mtimeMs !== record.mtimeMs
  ) return null
  return { canonicalPath, mtimeMs: info.mtimeMs }
}

/**
 * Serve a request when it targets an allowlisted art directory.
 *
 * Returns false only for paths outside the configured art prefixes, allowing
 * callers to continue into Vite or the normal static-file handler.
 */
export async function serveArtAsset(req, res, pack) {
  const state = packStates.get(pack)
  if (!state) throw new TypeError('serveArtAsset requires a pack returned by loadArtAssetPack')
  const resolved = resolveRequestRecord(req, pack, state)
  if (resolved.kind === 'unhandled') return false

  const method = String(req.method ?? 'GET').toUpperCase()
  if (method !== 'GET' && method !== 'HEAD') {
    sendText(req, res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' })
    return true
  }
  if (resolved.kind === 'invalid') {
    sendText(req, res, 400, 'Bad Request')
    return true
  }
  if (!resolved.record) {
    sendText(req, res, 404, 'Not Found')
    return true
  }

  const file = await currentFile(state, resolved.record)
  if (!file) {
    sendText(req, res, 503, 'Art Asset Pack Unavailable')
    return true
  }
  const headers = responseHeaders(pack, resolved.record, file.mtimeMs)
  if (ifNoneMatchMatches(req.headers?.['if-none-match'], resolved.record.etag)) {
    res.writeHead(304, headers)
    res.end()
    return true
  }

  const requestedRange = parseSingleByteRange(req.headers?.range, resolved.record.bytes)
  const range = requestedRange.kind === 'range' &&
    ifRangeAllows(req.headers?.['if-range'], resolved.record.etag, file.mtimeMs)
    ? requestedRange
    : requestedRange.kind === 'invalid'
      ? requestedRange
      : { kind: 'none' }
  if (range.kind === 'invalid') {
    res.writeHead(416, {
      ...headers,
      'Content-Range': `bytes */${resolved.record.bytes}`,
      'Content-Length': '0',
    })
    res.end()
    return true
  }

  if (range.kind === 'range') {
    const length = range.end - range.start + 1
    res.writeHead(206, {
      ...headers,
      'Content-Length': String(length),
      'Content-Range': `bytes ${range.start}-${range.end}/${resolved.record.bytes}`,
    })
    if (method === 'HEAD') {
      res.end()
      return true
    }
    const stream = createReadStream(file.canonicalPath, { start: range.start, end: range.end })
    stream.on('error', () => res.destroy())
    stream.pipe(res)
    return true
  }

  res.writeHead(200, {
    ...headers,
    'Content-Length': String(resolved.record.bytes),
  })
  if (method === 'HEAD') {
    res.end()
    return true
  }
  const stream = createReadStream(file.canonicalPath)
  stream.on('error', () => res.destroy())
  stream.pipe(res)
  return true
}
