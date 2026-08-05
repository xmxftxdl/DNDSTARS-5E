import { createServer } from 'vite'
import os from 'node:os'
import path from 'node:path'
import {
  closeAccountStorage,
  handleSharedApi,
  initializeAccountStorage,
} from './shared-server-core.mjs'
import { loadArtAssetPack, serveArtAsset } from './art-asset-server.mjs'
import { createSharedServerContext } from './shared-server-context.mjs'

const args = new Map()
for (let i = 2; i < process.argv.length; i += 1) {
  const key = process.argv[i]
  const next = process.argv[i + 1]
  if (key.startsWith('--')) {
    args.set(key.slice(2), next && !next.startsWith('--') ? next : true)
    if (next && !next.startsWith('--')) i += 1
  }
}

const host = String(args.get('host') ?? '127.0.0.1')
const port = Number(args.get('port') ?? 5273)
const strictPort = args.has('strictPort') || args.get('strict-port') === true
const optionalString = (value) => typeof value === 'string' && value.trim()
  ? value.trim()
  : null
const configuredArtAssetRoot = optionalString(
  args.get('art-asset-root') ?? process.env.STARS_ART_ASSET_ROOT,
)
const configuredArtAssetManifest = optionalString(
  args.get('art-asset-manifest') ?? process.env.STARS_ART_ASSET_MANIFEST_PATH,
)
const expectedArtAssetManifestSha256 = optionalString(
  process.env.STARS_ART_ASSET_MANIFEST_SHA256,
)
const artAssetPackRequired =
  String(process.env.STARS_REQUIRE_ART_ASSET_PACK ?? '').trim().toLowerCase() === 'true'
const verifyArtAssetContent =
  artAssetPackRequired || String(process.env.NODE_ENV ?? '').toLowerCase() === 'production'
if (args.get('art-asset-root') === true) {
  throw new Error('--art-asset-root requires a path')
}
if (args.get('art-asset-manifest') === true) {
  throw new Error('--art-asset-manifest requires a path')
}
if (artAssetPackRequired && !configuredArtAssetRoot) {
  throw new Error('STARS_REQUIRE_ART_ASSET_PACK=true requires STARS_ART_ASSET_ROOT')
}

let artAssetPack = null
let artAssetPackError = null
if (configuredArtAssetRoot) {
  try {
    artAssetPack = await loadArtAssetPack({
      root: path.resolve(process.cwd(), configuredArtAssetRoot),
      ...(configuredArtAssetManifest
        ? { manifestPath: path.resolve(process.cwd(), configuredArtAssetManifest) }
        : {}),
      ...(expectedArtAssetManifestSha256
        ? { expectedManifestSha256: expectedArtAssetManifestSha256 }
        : {}),
      verifyContent: verifyArtAssetContent,
    })
  } catch (error) {
    artAssetPackError =
      typeof error?.code === 'string' ? error.code : 'art-asset-pack-load-failed'
    if (artAssetPackRequired) throw error
    console.warn(`[art-assets] Optional art asset pack unavailable: ${artAssetPackError}`)
  }
}

function isControlledArtAssetRequest(url) {
  const rawPath = String(url ?? '/').split(/[?#]/, 1)[0]
  let pathname
  try {
    pathname = decodeURIComponent(rawPath)
  } catch {
    pathname = rawPath
  }
  return ['/assets/portraits', '/assets/icons', '/assets/vfx'].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

function sendArtAssetUnavailable(req, res, status = 404) {
  const body = status === 404 ? 'Not Found' : 'Art Asset Pack Unavailable'
  const bytes = Buffer.from(body)
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': String(bytes.length),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  if (String(req.method ?? 'GET').toUpperCase() === 'HEAD') res.end()
  else res.end(bytes)
}

const sharedRoot = process.env.STARS_SHARED_ROOT
  ? path.resolve(process.env.STARS_SHARED_ROOT)
  : path.resolve(
      process.env.LOCALAPPDATA ?? process.env.APPDATA ?? os.tmpdir(),
      'StarsApp',
      'shared',
    )
// /api 分发统一在 shared-server-core 的 handleSharedApi；本文件只挂中间件。
const apiCtx = createSharedServerContext({
  sharedRoot,
  legacyRoot: path.resolve(process.cwd(), '.stars-shared'),
  serverBuildId: process.env.STARS_BUILD_ID ?? 'vite-development',
})
const accountStorage = await initializeAccountStorage(apiCtx)
console.log(`Account storage: ${accountStorage.backend}${accountStorage.databasePath ? ` (${accountStorage.databasePath})` : ''}`)
if (artAssetPack) {
  console.log(
    `[art-assets] ${artAssetPack.packId}@${artAssetPack.version}: ` +
    `${artAssetPack.fileCount} files (verified=${artAssetPack.contentVerified})`,
  )
} else if (configuredArtAssetRoot) {
  console.warn(`[art-assets] Pack disabled after load failure: ${artAssetPackError}`)
}

const server = await createServer({
  clearScreen: false,
  server: {
    host,
    port,
    strictPort,
  },
})

const sharedApiMiddleware = (req, res, next) => {
  const parsed = new URL(req.url ?? '/', `http://${host}:${port}`)
  // handleSharedApi 返回 false 表示非 /api（走 vite 静态）；true 表示已处理（含错误响应）。
  void handleSharedApi(req, res, parsed, apiCtx).then((handled) => {
    if (!handled) next()
  })
}

const artAssetMiddleware = (req, res, next) => {
  void (async () => {
    if (artAssetPack && await serveArtAsset(req, res, artAssetPack)) return
    if (configuredArtAssetRoot && isControlledArtAssetRequest(req.url)) {
      sendArtAssetUnavailable(req, res, artAssetPackError ? 503 : 404)
      return
    }
    next()
  })().catch(() => {
    sendArtAssetUnavailable(req, res, 503)
  })
}

if (Array.isArray(server.middlewares.stack)) {
  server.middlewares.stack.unshift(
    { route: '', handle: artAssetMiddleware },
    { route: '', handle: sharedApiMiddleware },
  )
} else {
  server.middlewares.use(artAssetMiddleware)
  server.middlewares.use(sharedApiMiddleware)
}

await server.listen()
server.printUrls()

let closing = false
const close = async () => {
  if (closing) return
  closing = true
  for (const clients of apiCtx.eventClients.values()) {
    for (const response of clients) response.end()
  }
  apiCtx.eventClients.clear()
  const forceExit = setTimeout(() => process.exit(1), 10_000)
  forceExit.unref()
  try {
    await server.close()
    await closeAccountStorage(apiCtx)
    process.exit(0)
  } catch {
    process.exit(1)
  }
}

process.on('SIGINT', close)
process.on('SIGTERM', close)
