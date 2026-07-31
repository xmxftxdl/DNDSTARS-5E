import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import {
  mkdir,
  open,
  readFile,
  readdir,
  stat,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url))
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, '..')
const DEFAULT_ENEMY_POOL = 'src/lib/enemyPool.ts'
const DEFAULT_OUTPUT = 'public/runtime-assets/art-asset-pack.json'
const ASSET_DIRECTORIES = {
  portraits: 'public/assets/portraits',
  icons: 'public/assets/icons',
  vfx: 'public/assets/vfx',
}
const LFS_POINTER_HEADER = 'version https://git-lfs.github.com/spec/v1'
const LITERAL_ASSET_PATTERN = /(['"`])(\/assets\/(?:portraits|icons|vfx)\/[^'"`\r\n]+)\1/g

function commandLineValue(argumentsList, name, fallback) {
  const index = argumentsList.indexOf(name)
  if (index < 0) return fallback
  const value = argumentsList[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`)
  return value
}

function absoluteFrom(root, value) {
  return path.isAbsolute(value) ? value : path.resolve(root, value)
}

function repositoryPath(root, absolute) {
  return path.relative(root, absolute).split(path.sep).join('/')
}

function assetUrlFromPublicPath(root, absolute) {
  const publicRoot = path.join(root, 'public')
  const relative = path.relative(publicRoot, absolute).split(path.sep).join('/')
  if (relative.startsWith('../') || relative === '..') {
    throw new Error(`Art asset is outside public/: ${absolute}`)
  }
  return `/${relative}`
}

async function filesBelow(directory) {
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(`Required art asset directory is missing: ${directory}`)
    }
    throw error
  }
  const files = []
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await filesBelow(absolute))
    else if (entry.isFile()) files.push(absolute)
  }
  return files.sort((left, right) => left.localeCompare(right, 'en'))
}

function mediaTypeFor(filename) {
  switch (path.extname(filename).toLowerCase()) {
    case '.avif': return 'image/avif'
    case '.png': return 'image/png'
    case '.webp': return 'image/webp'
    case '.jpg':
    case '.jpeg': return 'image/jpeg'
    case '.gif': return 'image/gif'
    case '.svg': return 'image/svg+xml'
    default: return 'application/octet-stream'
  }
}

async function assertNotLfsPointer(filename) {
  const handle = await open(filename, 'r')
  try {
    const buffer = Buffer.alloc(160)
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    const prefix = buffer.subarray(0, bytesRead).toString('utf8')
    if (prefix.startsWith(LFS_POINTER_HEADER)) {
      throw new Error(
        `Git LFS pointer detected instead of image bytes: ${filename}. Run git lfs pull before generating the art manifest.`,
      )
    }
  } finally {
    await handle.close()
  }
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

async function assetRecord(root, absolute) {
  await assertNotLfsPointer(absolute)
  const [metadata, sha256] = await Promise.all([stat(absolute), sha256File(absolute)])
  const mediaType = mediaTypeFor(absolute)
  if (!metadata.isFile() || metadata.size < 1) {
    throw new Error(`Art asset is empty or not a regular file: ${absolute}`)
  }
  if (mediaType === 'application/octet-stream') {
    throw new Error(`Unsupported art asset file type: ${absolute}`)
  }
  return {
    path: assetUrlFromPublicPath(root, absolute),
    mediaType,
    bytes: metadata.size,
    sha256,
  }
}

function literalAssetUrls(source) {
  return [...source.matchAll(LITERAL_ASSET_PATTERN)]
    .map((match) => match[2])
    .filter((value) => !value.includes('${'))
}

function portraitRole(assetUrl) {
  if (/-token\.[a-z0-9]+$/i.test(assetUrl)) return 'token'
  if (/-initiative\.[a-z0-9]+$/i.test(assetUrl)) return 'initiative'
  return undefined
}

function pairedPortraitUrl(assetUrl, targetRole) {
  const role = portraitRole(assetUrl)
  if (!role) return undefined
  return assetUrl.replace(
    new RegExp(`-${role}(\\.[a-z0-9]+)$`, 'i'),
    `-${targetRole}$1`,
  )
}

function sumBytes(collection) {
  return collection.reduce((total, asset) => total + asset.bytes, 0)
}

function countCollections(collections) {
  const runtimeGroups = [
    collections.runtime.catalogPortraits.token,
    collections.runtime.catalogPortraits.initiative,
    collections.runtime.legacyDerivatives.token,
    collections.runtime.legacyDerivatives.initiative,
    collections.runtime.icons,
    collections.runtime.vfx,
  ]
  const authoringGroups = [
    collections.authoring.masters,
    collections.authoring.raw,
  ]
  const runtimeFiles = runtimeGroups.reduce((total, group) => total + group.length, 0)
  const runtimeBytes = runtimeGroups.reduce((total, group) => total + sumBytes(group), 0)
  const authoringFiles = authoringGroups.reduce((total, group) => total + group.length, 0)
  const authoringBytes = authoringGroups.reduce((total, group) => total + sumBytes(group), 0)
  return {
    totalFiles: runtimeFiles + authoringFiles,
    totalBytes: runtimeBytes + authoringBytes,
    runtimeFiles,
    runtimeBytes,
    authoringFiles,
    authoringBytes,
    catalogTokenPortraits: collections.runtime.catalogPortraits.token.length,
    catalogInitiativePortraits: collections.runtime.catalogPortraits.initiative.length,
    legacyTokenDerivatives: collections.runtime.legacyDerivatives.token.length,
    legacyInitiativeDerivatives: collections.runtime.legacyDerivatives.initiative.length,
    authoringMasters: collections.authoring.masters.length,
    authoringRaw: collections.authoring.raw.length,
    icons: collections.runtime.icons.length,
    vfx: collections.runtime.vfx.length,
  }
}

export async function generateArtAssetManifest({
  root = REPOSITORY_ROOT,
  enemyPool = DEFAULT_ENEMY_POOL,
} = {}) {
  const resolvedRoot = path.resolve(root)
  const enemyPoolPath = absoluteFrom(resolvedRoot, enemyPool)
  const enemyPoolSource = await readFile(enemyPoolPath, 'utf8')
  const catalogUrls = [...new Set(literalAssetUrls(enemyPoolSource))].sort((left, right) =>
    left.localeCompare(right, 'en'))
  const catalogPortraitUrls = catalogUrls.filter((assetUrl) =>
    assetUrl.startsWith('/assets/portraits/'))
  const unsupportedCatalogAssets = catalogUrls.filter((assetUrl) =>
    !assetUrl.startsWith('/assets/portraits/'))
  if (unsupportedCatalogAssets.length > 0) {
    throw new Error(
      `enemyPool contains unsupported non-portrait art literals: ${unsupportedCatalogAssets.join(', ')}`,
    )
  }

  const catalogSet = new Set(catalogPortraitUrls)
  for (const assetUrl of catalogPortraitUrls) {
    const role = portraitRole(assetUrl)
    if (!role) {
      throw new Error(`enemyPool portrait literal is neither token nor initiative art: ${assetUrl}`)
    }
    const pair = pairedPortraitUrl(assetUrl, role === 'token' ? 'initiative' : 'token')
    if (!pair || !catalogSet.has(pair)) {
      throw new Error(`enemyPool portrait is missing its ${role === 'token' ? 'initiative' : 'token'} pair: ${assetUrl}`)
    }
    const absolute = path.resolve(resolvedRoot, 'public', assetUrl.replace(/^[/\\]+/, ''))
    try {
      const metadata = await stat(absolute)
      if (!metadata.isFile()) throw new Error('not a file')
    } catch {
      throw new Error(`enemyPool references a missing art asset: ${assetUrl}`)
    }
  }

  const [portraitFiles, iconFiles, vfxFiles] = await Promise.all([
    filesBelow(absoluteFrom(resolvedRoot, ASSET_DIRECTORIES.portraits)),
    filesBelow(absoluteFrom(resolvedRoot, ASSET_DIRECTORIES.icons)),
    filesBelow(absoluteFrom(resolvedRoot, ASSET_DIRECTORIES.vfx)),
  ])
  const allFiles = [...portraitFiles, ...iconFiles, ...vfxFiles]
  const records = await mapWithConcurrency(allFiles, 8, (absolute) =>
    assetRecord(resolvedRoot, absolute))
  const recordByPath = new Map(records.map((record) => [record.path, record]))

  for (const assetUrl of catalogPortraitUrls) {
    if (!recordByPath.has(assetUrl)) {
      throw new Error(`enemyPool references an art asset outside the scanned pack: ${assetUrl}`)
    }
  }

  const catalogToken = []
  const catalogInitiative = []
  const legacyToken = []
  const legacyInitiative = []
  const authoringMasters = []
  const authoringRaw = []
  for (const absolute of portraitFiles) {
    const assetUrl = assetUrlFromPublicPath(resolvedRoot, absolute)
    const record = recordByPath.get(assetUrl)
    const role = portraitRole(assetUrl)
    if (catalogSet.has(assetUrl)) {
      if (role === 'token') catalogToken.push(record)
      else if (role === 'initiative') catalogInitiative.push(record)
      continue
    }
    if (role === 'token') legacyToken.push(record)
    else if (role === 'initiative') legacyInitiative.push(record)
    else if (/-master\.[a-z0-9]+$/i.test(assetUrl)) authoringMasters.push(record)
    else authoringRaw.push(record)
  }

  const recordsFor = (files) => files
    .map((absolute) => recordByPath.get(assetUrlFromPublicPath(resolvedRoot, absolute)))
    .sort((left, right) => left.path.localeCompare(right.path, 'en'))
  const sortRecords = (values) => values.sort((left, right) =>
    left.path.localeCompare(right.path, 'en'))
  const collections = {
    runtime: {
      catalogPortraits: {
        token: sortRecords(catalogToken),
        initiative: sortRecords(catalogInitiative),
      },
      legacyDerivatives: {
        token: sortRecords(legacyToken),
        initiative: sortRecords(legacyInitiative),
      },
      icons: recordsFor(iconFiles),
      vfx: recordsFor(vfxFiles),
    },
    authoring: {
      masters: sortRecords(authoringMasters),
      raw: sortRecords(authoringRaw),
    },
  }
  const summary = countCollections(collections)
  const runtimeRecords = [
    ...collections.runtime.catalogPortraits.token,
    ...collections.runtime.catalogPortraits.initiative,
    ...collections.runtime.legacyDerivatives.token,
    ...collections.runtime.legacyDerivatives.initiative,
    ...collections.runtime.icons,
    ...collections.runtime.vfx,
  ]
  const files = runtimeRecords
    .map((record) => ({
      path: record.path.replace(/^\//, ''),
      bytes: record.bytes,
      sha256: record.sha256,
      contentType: record.mediaType,
    }))
    .sort((left, right) => left.path.localeCompare(right.path, 'en'))
  if (new Set(files.map((entry) => entry.path)).size !== files.length) {
    throw new Error('Runtime art asset allowlist contains duplicate paths')
  }
  const contentPayload = {
    schemaVersion: 1,
    packId: 'astraltrace.dnd5e-2014.art',
    assetBasePath: '/assets/',
    sourceCatalog: repositoryPath(resolvedRoot, enemyPoolPath),
    summary,
    files,
    collections,
  }
  const contentSha256 = createHash('sha256')
    .update(JSON.stringify(contentPayload))
    .digest('hex')
  return {
    schemaVersion: contentPayload.schemaVersion,
    packId: contentPayload.packId,
    version: `content-${contentSha256.slice(0, 16)}`,
    assetBasePath: contentPayload.assetBasePath,
    sourceCatalog: contentPayload.sourceCatalog,
    summary,
    files,
    collections,
    contentSha256,
  }
}

export function serializeArtAssetManifest(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`
}

async function run() {
  const argumentsList = process.argv.slice(2)
  const root = absoluteFrom(
    REPOSITORY_ROOT,
    commandLineValue(argumentsList, '--root', REPOSITORY_ROOT),
  )
  const enemyPool = commandLineValue(argumentsList, '--enemy-pool', DEFAULT_ENEMY_POOL)
  const output = absoluteFrom(
    root,
    commandLineValue(argumentsList, '--output', DEFAULT_OUTPUT),
  )
  const check = argumentsList.includes('--check')
  const manifest = await generateArtAssetManifest({ root, enemyPool })
  const serialized = serializeArtAssetManifest(manifest)

  if (check) {
    let current
    try {
      current = await readFile(output, 'utf8')
    } catch (error) {
      if (error?.code === 'ENOENT') {
        throw new Error(`Art asset manifest is missing: ${repositoryPath(root, output)}`)
      }
      throw error
    }
    if (current !== serialized) {
      throw new Error(
        `Art asset manifest is stale: ${repositoryPath(root, output)}. Run node scripts/generate-art-asset-manifest.mjs.`,
      )
    }
    process.stdout.write(
      `Art asset manifest is current (${manifest.summary.totalFiles} files, ${manifest.contentSha256}).\n`,
    )
    return
  }

  await mkdir(path.dirname(output), { recursive: true })
  await writeFile(output, serialized, 'utf8')
  process.stdout.write(
    `Wrote ${repositoryPath(root, output)} (${manifest.summary.totalFiles} files, ${manifest.contentSha256}).\n`,
  )
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
