import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  accountStorageDiagnostics,
  applySecurityHeaders,
  closeAccountStorage,
  handleSharedApi,
  initializeAccountStorage,
  productionSecurityEnabled,
  validateProductionSecurityConfig,
} from './shared-server-core.mjs'
import { ServerObservability } from './server-observability.mjs'

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
const port = Number(args.get('port') ?? 5274)
const root = path.resolve(process.cwd(), String(args.get('root') ?? 'dist'))
const rootWithSeparator = root.endsWith(path.sep) ? root : `${root}${path.sep}`
const sharedRoot = process.env.STARS_SHARED_ROOT
  ? path.resolve(process.env.STARS_SHARED_ROOT)
  : path.resolve(
      process.env.LOCALAPPDATA ?? process.env.APPDATA ?? os.tmpdir(),
      'StarsApp',
      'shared',
    )
const securityConfig = validateProductionSecurityConfig()
if (!securityConfig.ok) {
  throw new Error(`Unsafe production configuration:\n- ${securityConfig.errors.join('\n- ')}`)
}
// /api 分发统一在 shared-server-core 的 handleSharedApi；本文件只保留静态回退。
const apiCtx = {
  lobbyRoot: path.join(sharedRoot, 'lobby'),
  stateRoot: path.join(sharedRoot, 'state'),
  imageRoot: path.join(sharedRoot, 'images'),
  quarantineRoot: path.join(sharedRoot, 'quarantine'),
  snapshotRoot: path.join(sharedRoot, 'snapshots'),
  legacyStateRoot: path.join(path.resolve(process.cwd(), '.stars-shared'), 'state'),
  legacyImageRoot: path.join(path.resolve(process.cwd(), '.stars-shared'), 'images'),
  eventClients: new Map(),
  eventBacklog: new Map(),
  eventSequences: new Map(),
  serverInstanceId: randomUUID(),
  serverStartedAt: Date.now(),
  serverBuildId: process.env.STARS_BUILD_ID ?? 'static-development',
}
const accountStorage = await initializeAccountStorage(apiCtx)
const observability = new ServerObservability({
  service: 'dndstars-5e-shared',
  buildId: apiCtx.serverBuildId,
  startedAt: apiCtx.serverStartedAt,
})
observability.log('info', 'account_storage_ready', {
  backend: accountStorage.backend,
  ...(accountStorage.databasePath ? { databasePath: accountStorage.databasePath } : {}),
})
const readinessCheck = () => accountStorageDiagnostics(apiCtx)
await observability.checkReadiness(readinessCheck)
const readinessTimer = setInterval(() => {
  void observability.checkReadiness(readinessCheck)
}, 30_000)
readinessTimer.unref()

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.woff2', 'font/woff2'],
])

function resolveRequestPath(url) {
  const parsed = new URL(url, `http://${host}:${port}`)
  const decoded = decodeURIComponent(parsed.pathname)
  const normalized = path.normalize(decoded).replace(/^([/\\])+/, '')
  const filePath = path.resolve(root, normalized)
  if (filePath !== root && !filePath.startsWith(rootWithSeparator)) return null
  return filePath
}

async function findStaticFile(requestPath) {
  let filePath = requestPath
  try {
    const info = await stat(filePath)
    if (info.isDirectory()) filePath = path.join(filePath, 'index.html')
    await stat(filePath)
    return filePath
  } catch {
    return path.join(root, 'index.html')
  }
}

const server = http.createServer(async (req, res) => {
  applySecurityHeaders(res, { production: productionSecurityEnabled() })
  const parsed = new URL(req.url ?? '/', `http://${host}:${port}`)
  observability.observeRequest(req, res, parsed)
  if (parsed.pathname === '/api/metrics') {
    if (req.method !== 'GET' || !observability.metricsAuthorized(req)) {
      res.writeHead(404)
      res.end('Not Found')
      return
    }
    const sseClients = [...apiCtx.eventClients.values()]
      .reduce((total, clients) => total + clients.size, 0)
    res.writeHead(200, {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      'Cache-Control': 'no-store',
    })
    res.end(observability.metrics({
      astraltrace_sse_clients: sseClients,
      astraltrace_event_backlog_channels: apiCtx.eventBacklog.size,
    }))
    return
  }
  if (parsed.pathname === '/api/readyz') {
    if (req.method !== 'GET') {
      res.writeHead(405)
      res.end('Method Not Allowed')
      return
    }
    const readiness = await observability.checkReadiness(readinessCheck)
    res.writeHead(readiness.ready ? 200 : 503, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    })
    res.end(JSON.stringify({
      status: readiness.ready ? 'ready' : 'unavailable',
      backend: readiness.details?.backend ?? accountStorage.backend,
      ...(readiness.ready ? {} : { error: 'dependency-unavailable' }),
    }))
    return
  }
  if (parsed.pathname.startsWith('/api/')) {
    // handleSharedApi 内部已自带 try/catch（含锁超时 503）；返回 true 即已处理（含错误响应）。
    if (await handleSharedApi(req, res, parsed, apiCtx)) return
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405)
    res.end('Method Not Allowed')
    return
  }

  const requestPath = resolveRequestPath(req.url ?? '/')
  if (!requestPath) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  const filePath = await findStaticFile(requestPath)
  const contentType = mimeTypes.get(path.extname(filePath).toLowerCase()) ?? 'application/octet-stream'
  res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' })
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  createReadStream(filePath).pipe(res)
})

server.listen(port, host, () => {
  observability.log('info', 'server_listening', { host, port, root })
})

let closing = false
const close = () => {
  if (closing) return
  closing = true
  observability.log('info', 'server_shutdown_started')
  clearInterval(readinessTimer)
  server.close(() => {
    void closeAccountStorage(apiCtx).finally(() => process.exit(0))
  })
  const forceExit = setTimeout(() => process.exit(1), 10_000)
  forceExit.unref()
}

process.on('SIGINT', close)
process.on('SIGTERM', close)
