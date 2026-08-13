import { createServer } from 'node:http'
import { deflateSync } from 'node:zlib'
import { randomUUID } from 'node:crypto'
import {
  MOBILE_PLAYER_PROTOCOL_VERSION,
  publicMobilePlayerSession,
  validateMobileMoveIntent,
} from '../packages/mobile-protocol/runtime.mjs'

const host = process.env.STARS_MOBILE_DEMO_HOST || '0.0.0.0'
const port = Number(process.env.STARS_MOBILE_DEMO_PORT || 8787)
const startedAt = Date.now()
const sessions = new Map()
const playerMoves = []

function writeJson(res, status, value) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type,x-stars-mobile-session',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
  })
  res.end(JSON.stringify(value))
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const name = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])))
  return Buffer.concat([length, name, data, checksum])
}

function createTilePng(level, tileX, tileY, size = 256) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  const seed = (level * 31 + tileX * 17 + tileY * 13) % 255
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1)
    raw[row] = 0
    for (let x = 0; x < size; x += 1) {
      const index = row + 1 + x * 4
      const grid = x % 64 < 2 || y % 64 < 2
      const river = Math.abs((tileX * size + x) - ((tileY * size + y) * 0.7 + 320)) < 40
      raw[index] = grid ? 67 : river ? 34 : 22 + (seed % 26)
      raw[index + 1] = grid ? 86 : river ? 109 : 74 + ((seed + x / 8) % 35)
      raw[index + 2] = grid ? 116 : river ? 142 : 58 + ((seed + y / 9) % 28)
      raw[index + 3] = 255
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, { level: 6 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

function tokenAt(index, revision) {
  const column = index % 10
  const row = Math.floor(index / 10)
  const orbit = index === 4 ? revision % 12 : 0
  return {
    id: `token-${index}`,
    name: index === 0 ? '星痕冒险者' : `可见单位 ${index}`,
    portraitColor: index === 0 ? '#8b5cf6' : index % 3 === 0 ? '#f97316' : '#14b8a6',
    x: 900 + column * 980 + orbit * 24,
    y: 900 + row * 980 + (index === 4 ? Math.sin(revision / 2) * 180 : 0),
    radius: index === 0 ? 120 : 90,
    hp: Math.max(1, 12 + (index % 7) * 5),
    maxHp: 42,
    controlled: index === 0,
    friendly: index === 0 || index % 5 === 0,
    conditions: index % 17 === 0 ? ['中毒'] : [],
  }
}

function currentRevision() {
  return Math.floor((Date.now() - startedAt) / 2000) + playerMoves.length
}

function manifest(origin) {
  const levels = [0.04, 0.08, 0.16, 0.32, 0.64].map((scale, level) => ({
    level,
    scale,
    pixelWidth: Math.ceil(12000 * scale),
    pixelHeight: Math.ceil(12000 * scale),
    columns: Math.ceil(12000 * scale / 256),
    rows: Math.ceil(12000 * scale / 256),
  }))
  return {
    schemaVersion: 1,
    assetId: 'mobile-demo-map',
    assetHash: 'mobile-demo-map-v1',
    revision: 1,
    worldWidth: 12000,
    worldHeight: 12000,
    tileSize: 256,
    imageFormat: 'png',
    zoomLevels: levels,
    preview: { url: `${origin}/tiles/mobile-demo-map-v1/0/0_0.png`, width: 480, height: 480 },
    tileUrlTemplate: `${origin}/tiles/mobile-demo-map-v1/{z}/{x}_{y}.png`,
    grid: { type: 'square', sizeWorldUnits: 300, offsetX: 0, offsetY: 0 },
  }
}

function snapshot(origin) {
  const revision = currentRevision()
  const tokens = Array.from({ length: 100 }, (_, index) => tokenAt(index, revision))
  for (const move of playerMoves) {
    const token = tokens.find((candidate) => candidate.id === move.tokenId)
    if (token) Object.assign(token, move.destination)
  }
  return {
    schemaVersion: 1,
    protocolVersion: MOBILE_PLAYER_PROTOCOL_VERSION,
    sceneId: 'mobile-demo-scene',
    revision,
    mapManifest: manifest(origin),
    cameraHint: { x: -200, y: -200, scale: 0.12 },
    controlledTokens: tokens.filter((token) => token.controlled),
    visibleTokens: tokens,
    opaqueSegments: [
      { id: 'wall-a', ax: 2800, ay: 2200, bx: 5200, by: 2200, open: false },
      { id: 'door-a', ax: 5200, ay: 2200, bx: 5800, by: 2200, open: true },
    ],
    fogChunks: [
      { chunkId: 'fog-0-0', revision, bounds: { x: 0, y: 0, width: 6000, height: 6000 }, explored: true },
      { chunkId: 'fog-1-0', revision, bounds: { x: 6000, y: 0, width: 6000, height: 6000 }, explored: false },
    ],
    initiative: { round: 2, currentTokenId: 'token-0', orderedTokenIds: tokens.slice(0, 8).map((token) => token.id) },
  }
}

function originFor(req) {
  const configured = process.env.STARS_MOBILE_DEMO_ORIGIN
  if (configured) return configured.replace(/\/$/, '')
  return `http://${req.headers.host || `127.0.0.1:${port}`}`
}

function sessionFrom(req) {
  return sessions.get(String(req.headers['x-stars-mobile-session'] || ''))
}

async function readJson(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  if (req.method === 'OPTIONS') return writeJson(res, 204, {})
  if (url.pathname === '/api/healthz') return writeJson(res, 200, { status: 'ok', service: 'stars-mobile-demo' })
  if (url.pathname === '/api/mobile-player/demo/session' && req.method === 'POST') {
    const session = publicMobilePlayerSession({
      sessionId: randomUUID(), roomId: 'DEMO01', campaignId: 'mobile-demo', userId: 'demo-user',
      playerId: 'demo-player', controlledTokenIds: ['token-0'], expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    })
    sessions.set(session.sessionId, session)
    return writeJson(res, 201, session)
  }
  const tileMatch = url.pathname.match(/^\/tiles\/mobile-demo-map-v1\/(\d+)\/(\d+)_(\d+)\.png$/)
  if (tileMatch && req.method === 'GET') {
    const [, level, x, y] = tileMatch.map(Number)
    const png = createTilePng(level, x, y)
    res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'public, max-age=31536000, immutable', 'access-control-allow-origin': '*' })
    return res.end(png)
  }
  const session = sessionFrom(req)
  if (url.pathname.startsWith('/api/mobile-player/') && !session) return writeJson(res, 401, { error: 'mobile-session-required' })
  if (url.pathname === '/api/mobile-player/demo/snapshot' && req.method === 'GET') return writeJson(res, 200, snapshot(originFor(req)))
  if (url.pathname === '/api/mobile-player/demo/deltas' && req.method === 'GET') {
    const after = Number(url.searchParams.get('after') || 0)
    const current = currentRevision()
    if (!Number.isInteger(after) || after < 0 || current - after > 30) {
      return writeJson(res, 200, { schemaVersion: 1, sceneId: 'mobile-demo-scene', afterRevision: after, currentRevision: current, requiresSnapshot: true, deltas: [] })
    }
    const deltas = []
    for (let revision = after + 1; revision <= current; revision += 1) {
      const token = tokenAt(4, revision)
      deltas.push({ type: 'token-moved', revision, tokenId: token.id, x: token.x, y: token.y })
    }
    return writeJson(res, 200, { schemaVersion: 1, sceneId: 'mobile-demo-scene', afterRevision: after, currentRevision: current, requiresSnapshot: false, deltas })
  }
  if (url.pathname === '/api/mobile-player/demo/move' && req.method === 'POST') {
    const body = await readJson(req).catch(() => null)
    const validation = validateMobileMoveIntent(body, session)
    if (!validation.ok) return writeJson(res, 403, { error: validation.reason })
    if (body.sceneId !== 'mobile-demo-scene') return writeJson(res, 409, { error: 'scene-mismatch' })
    if (body.expectedRevision !== currentRevision()) return writeJson(res, 409, { error: 'revision-conflict', currentRevision: currentRevision() })
    const destination = {
      x: Math.max(0, Math.min(12000, validation.value.destination.x)),
      y: Math.max(0, Math.min(12000, validation.value.destination.y)),
    }
    playerMoves.push({ tokenId: body.tokenId, destination })
    const revision = currentRevision()
    return writeJson(res, 200, { accepted: true, delta: { type: 'token-moved', revision, tokenId: body.tokenId, ...destination } })
  }
  if (url.pathname.startsWith('/api/dm/')) return writeJson(res, 403, { error: 'mobile-player-session-cannot-use-dm-api' })
  return writeJson(res, 404, { error: 'not-found' })
})

server.listen(port, host, () => {
  console.log(`[mobile-demo] http://${host}:${port}`)
})

