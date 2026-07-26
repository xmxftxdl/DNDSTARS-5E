import { createServer } from 'vite'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  closeAccountStorage,
  handleSharedApi,
  initializeAccountStorage,
} from './shared-server-core.mjs'

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
const sharedRoot = process.env.STARS_SHARED_ROOT
  ? path.resolve(process.env.STARS_SHARED_ROOT)
  : path.resolve(
      process.env.LOCALAPPDATA ?? process.env.APPDATA ?? os.tmpdir(),
      'StarsApp',
      'shared',
    )
// /api 分发统一在 shared-server-core 的 handleSharedApi；本文件只挂中间件。
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
  serverBuildId: process.env.STARS_BUILD_ID ?? 'vite-development',
}
const accountStorage = await initializeAccountStorage(apiCtx)
console.log(`Account storage: ${accountStorage.backend}${accountStorage.databasePath ? ` (${accountStorage.databasePath})` : ''}`)

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

if (Array.isArray(server.middlewares.stack)) {
  server.middlewares.stack.unshift({ route: '', handle: sharedApiMiddleware })
} else {
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
