// 共享服务端硬化核心：原子写锁 / 鉴权 / size cap / backlog cap / 图片配额 /
// safeName 防碰撞 / API-404。两个服务端（vite-server.mjs + static-server.mjs）都从这里
// import 同一份纯逻辑，避免双份漂移；纯函数集中在此以便 src/ 下的 vitest 直接 import .mjs。
import { mkdir, readFile, readdir, rename, rm, stat, utimes, writeFile } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import {
  createHmac,
  createHash,
  generateKeyPairSync,
  randomBytes,
  randomInt,
  randomUUID,
  scryptSync,
  sign as signBytes,
  timingSafeEqual,
  verify as verifyBytes,
} from 'node:crypto'
import path from 'node:path'
import {
  deliverTencentVerification,
  tencentVerificationCapabilities,
} from './tencent-verification-provider.mjs'
import { openSqliteAccountStore } from './account-storage-sqlite.mjs'
import { openPostgresStorage } from './postgres-storage.mjs'
import {
  compileGeometryCached,
  doorOpenState,
  raycastGeometry,
  validateGeometryRelationships,
  validateGeometryStructure,
} from '../shared/map-geometry-kernel.mjs'
import {
  applyDnd5eEffectiveVisionProfile,
  compileDnd5eEffectiveVisionProfile,
} from '../shared/dnd5e-vision-profile.mjs'
import {
  analyzeMarketplaceDeclarativePackage,
  MARKETPLACE_CREATOR_NOTICE_VERSION,
  MARKETPLACE_CREATOR_POLICY_VERSION,
  normalizeMarketplacePublication,
} from '../shared/marketplace-publication.mjs'
import {
  activeMarketplaceEntitlement,
  canonicalMarketplaceJson,
  MARKETPLACE_ENTITLEMENT_SCHEMA_VERSION,
  MARKETPLACE_PRODUCT_MANIFEST_SCHEMA_VERSION,
} from '../shared/marketplace-entitlement.mjs'
import {
  MARKETPLACE_ORDER_SCHEMA_VERSION,
  MARKETPLACE_ORDER_TTL_MS,
  marketplaceOrderAmounts,
  marketplaceOrderIsPayable,
  marketplaceOrderPublicRecord,
} from '../shared/marketplace-order.mjs'
import {
  MARKETPLACE_LEDGER_SCHEMA_VERSION,
  MARKETPLACE_SETTLEMENT_HOLD_MS,
  marketplaceLedgerBalance,
  marketplaceRevenueSplit,
} from '../shared/marketplace-ledger.mjs'
import {
  MARKETPLACE_PAYOUT_SCHEMA_VERSION,
  marketplacePayoutMinimum,
  marketplacePayoutPublicRecord,
  marketplacePayoutRecordValid,
  marketplacePayoutTransitionAllowed,
} from '../shared/marketplace-payout.mjs'
import {
  buildMarketplaceCreatorAnalytics,
  normalizeMarketplaceAnalyticsDaily,
  normalizeMarketplaceInstallation,
  recordMarketplaceDailyMetric,
  updateMarketplaceInstallation,
} from '../shared/marketplace-analytics.mjs'
import {
  sharedAuthenticatedSystemRoute,
  sharedPublicSystemRoute,
} from './shared-server-system-routes.mjs'

// ── AC3：PUT body 上限 + backlog 回放上限 ────────────────────────────────────
// 单次 PUT 请求体上限（8 MiB）。超过 → 413。图片走单独更宽的上限（见 IMAGE_MAX_BYTES）。
export const STATE_MAX_BYTES = 8 * 1024 * 1024
export const ROOM_EPHEMERAL_PLUGIN_MAX_BYTES = 40 * 1024 * 1024
export const ROOM_RUNTIME_PROJECTION = 'room-runtime-mechanics'
export const ROOM_RUNTIME_PROSE_PLACEHOLDER = '房间临时机械数据；原始规则正文未传输。'
export const CHARACTER_PORTRAIT_MAX_DATA_URL_LENGTH = 600_000
export const CHARACTER_PORTRAIT_MAX_TOTAL_DATA_URL_LENGTH = 4_000_000
// 单张图片上限（24 MiB）。
export const IMAGE_MAX_BYTES = 24 * 1024 * 1024
// 事件 backlog 总容量（环形缓冲，保持与历史一致）。
export const EVENT_BACKLOG_LIMIT = 1200
// 新订阅者只回放最近 N 条，而不是把整 1200 条全量灌给它（AC3）。
export const EVENT_REPLAY_LIMIT = 100
// 不同 channel 名总数上限（safeName 允许任意名累积 → 无界）。超过即按
// Map 插入序淘汰最旧者（确定性 COUNT-CAP，非 TTL）。有活跃订阅者的 channel 受保护不被淘汰。
export const EVENT_CHANNEL_LIMIT = 256
export const SHARED_STATE_CHANGED_CHANNEL = 'shared-state-changed'
const EVENT_CHANNEL_POLICIES = Object.freeze({
  [SHARED_STATE_CHANGED_CHANNEL]: { publish: [], subscribe: ['dm', 'player', 'spectator'] },
  'player-action-player-to-dm': { publish: ['player'], subscribe: ['dm'] },
  'player-action-dm-to-player': { publish: ['dm'], subscribe: ['player'] },
  'dice-roll-request-player-to-dm': { publish: ['player'], subscribe: ['dm'] },
  'dice-roll-request-dm-to-player': { publish: ['dm'], subscribe: ['player', 'spectator'] },
  'dnd5e-inventory-player-to-dm': { publish: ['player'], subscribe: ['dm'] },
  'map-tabletop': { publish: ['dm', 'player'], subscribe: ['dm', 'player', 'spectator'] },
  'combat-presentation': { publish: ['dm'], subscribe: ['dm', 'player', 'spectator'] },
  'scene-presentation': { publish: ['dm'], subscribe: ['dm', 'player', 'spectator'] },
})
// Browser background tabs can throttle a 5-second interval to roughly one
// minute. Presence therefore needs enough grace to distinguish throttling or a
// brief network hand-off from a genuinely abandoned room. Explicit DM leave
// still closes the room immediately.
export const ROOM_HOST_TTL_MS = Math.max(30_000, Number(process.env.STARS_ROOM_HOST_TTL_MS) || 120_000)
export const ROOM_PLAYER_TTL_MS = Math.max(60_000, Number(process.env.STARS_ROOM_PLAYER_TTL_MS) || 300_000)
export const ROOM_PRESENCE_ONLINE_MS = Math.max(10_000, Number(process.env.STARS_ROOM_PRESENCE_ONLINE_MS) || 20_000)
export const ROOM_PLAYER_SLOTS = Object.freeze(['player1', 'player2', 'player3', 'player4', 'player5', 'player6', 'player7', 'player8'])
export const ROOM_SPECTATOR_LIMIT = 16
export const MAP_TABLETOP_CHANNEL = 'map-tabletop'
export const COMBAT_PRESENTATION_CHANNEL = 'combat-presentation'
export const MAP_PING_LIFETIME_MS = 3_200
export const MAP_ANNOTATION_LIFETIME_MS = 30 * 60 * 1_000
export const COMBAT_PRESENTATION_LIFETIME_MS = 1_600
export const SPELL_BANNER_PRESENTATION_LIFETIME_MS = 3_500
export const FIREBALL_ANIMATION_START_DELAY_MS = 1_000
export const FIREBALL_PRESENTATION_LIFETIME_MS = 3_500
export const KILL_STREAK_BANNER_START_DELAY_MS = 650
export const KILL_STREAK_PRESENTATION_LIFETIME_MS = 5_800
export const SAVING_THROW_PENDING_LIFETIME_MS = 300_000
export const SAVING_THROW_RESULT_LIFETIME_MS = 3_000
export const DND5E_2014_RULESET_ID = 'dnd5e-2014-srd-5.1'
export const SHARED_PROTOCOL_VERSION = 5
export const SHARED_MIN_CLIENT_PROTOCOL = 5
export const SHARED_STATE_SCHEMA_VERSION = 1
export const ACCOUNT_CHARACTER_SCHEMA_VERSION = 1
export const ACCOUNT_SESSION_LIMIT = 12
export const ACCOUNT_CHARACTER_LIMIT = 100
export const ACCOUNT_CAMPAIGN_SCHEMA_VERSION = 1
export const ACCOUNT_CAMPAIGN_LIMIT = 100
export const ACCOUNT_CAMPAIGN_ROOM_HISTORY_LIMIT = 100
export const ACCOUNT_PLUGIN_VERSION_LIMIT = 100
export const ACCOUNT_PLUGIN_TOTAL_BYTES_LIMIT = 128 * 1024 * 1024
export const PLUGIN_MANIFEST_SCHEMA_VERSION = 1
export const PLUGIN_DEPENDENCY_LIMIT = 32
export const PLUGIN_CONFLICT_LIMIT = 32
export const ACCOUNT_AUTH_SCHEMA_VERSION = 1
export const ACCOUNT_VERIFICATION_TTL_MS = 10 * 60 * 1000
export const ACCOUNT_VERIFICATION_ATTEMPT_LIMIT = 5
export const ACCOUNT_PASSWORD_MIN_LENGTH = 8
export const ACCOUNT_PASSWORD_MAX_LENGTH = 128
export const CAMPAIGN_BUNDLE_FORMAT = 'dndstars5e-campaign'
export const CAMPAIGN_BUNDLE_SCHEMA_VERSION = 1
export const CAMPAIGN_SNAPSHOT_LIMIT = 10
export const CAMPAIGN_IMPORT_MAX_BYTES = 128 * 1024 * 1024
export const CAMPAIGN_AUTO_SNAPSHOT_INTERVAL_MS = 2 * 60 * 1000

const PROCESS_STARTED_AT = Date.now()
const lastAutoSnapshotAt = new Map()

export function productionSecurityEnabled(env = process.env) {
  const explicit = String(env.STARS_SECURITY_MODE ?? '').trim().toLowerCase()
  if (explicit === 'production') return true
  if (explicit === 'development' || explicit === 'test') return false
  return env.NODE_ENV === 'production'
}

function normalizedHttpOrigin(value) {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const parsed = new URL(value.trim())
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
    if (parsed.username || parsed.password || parsed.search || parsed.hash) return null
    if (parsed.pathname !== '/' && parsed.pathname !== '') return null
    return parsed.origin
  } catch {
    return null
  }
}

export function validateProductionSecurityConfig(env = process.env) {
  if (!productionSecurityEnabled(env)) return { ok: true, production: false, errors: [] }
  const errors = []
  const publicOrigin = normalizedHttpOrigin(env.STARS_PUBLIC_ORIGIN)
  if (!publicOrigin) errors.push('STARS_PUBLIC_ORIGIN must be an absolute http(s) origin')
  if (
    publicOrigin?.startsWith('http://') &&
    !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(publicOrigin)
  ) {
    errors.push('STARS_PUBLIC_ORIGIN must use https outside localhost')
  }
  if (typeof env.STARS_SHARED_ROOT !== 'string' || !env.STARS_SHARED_ROOT.trim()) {
    errors.push('STARS_SHARED_ROOT must point to persistent storage')
  }
  const configuredOrigins = String(env.STARS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  if (configuredOrigins.includes('*')) errors.push('STARS_ALLOWED_ORIGINS cannot contain * in production')
  for (const origin of configuredOrigins) {
    if (!normalizedHttpOrigin(origin)) errors.push(`invalid STARS_ALLOWED_ORIGINS entry: ${origin}`)
  }
  if (String(env.STARS_ACCOUNT_STORAGE ?? '').trim().toLowerCase() === 'postgres') {
    try {
      const databaseUrl = new URL(String(env.STARS_DATABASE_URL ?? ''))
      if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) {
        errors.push('STARS_DATABASE_URL must use postgresql://')
      }
      if (
        !databaseUrl.password ||
        databaseUrl.password.length < 16 ||
        databaseUrl.password === 'development-only-change-me'
      ) {
        errors.push('PostgreSQL password must be a non-default secret of at least 16 characters')
      }
    } catch {
      errors.push('STARS_DATABASE_URL must be a valid PostgreSQL connection URL')
    }
  }
  return {
    ok: errors.length === 0,
    production: true,
    publicOrigin,
    allowedOrigins: [...new Set([publicOrigin, ...configuredOrigins.map(normalizedHttpOrigin)].filter(Boolean))],
    errors,
  }
}

export function applySecurityHeaders(res, options = {}) {
  const production = options.production ?? productionSecurityEnabled()
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
  // The 3D dice renderer is an application-owned iframe, so same-origin
  // framing must remain available while third-party framing stays blocked.
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  if (!production) return
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "form-action 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "media-src 'self' blob:",
      "worker-src 'self' blob:",
      "frame-src 'self'",
      "connect-src 'self'",
    ].join('; '),
  )
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
}

/**
 * Dedicated SRD 5.1 servers must not relay retired AP balances even when an
 * older client reconnects and writes a pre-migration snapshot. Keeping this at
 * the HTTP persistence boundary prevents stale tabs from reintroducing AP into
 * otherwise migrated DM/player sessions.
 */
export function migrateLegacyApCombatLogText(text) {
  return String(text ?? '')
    .replace(/(?:花费|消耗)\s*\d+\s*(?:点\s*)?AP\s*(?:[：:]\s*)?/giu, '')
    .replace(/(?:未|不|无需)消耗\s*AP\s*(?:[：:]\s*)?/giu, '')
    .replace(/\s*[；;,，]?\s*(?:本回合)?剩余\s*AP\s*\d+\s*\/\s*\d+/giu, '')
    .replace(/\s*[；;,，]?\s*AP\s*\d+\s*\/\s*\d+/giu, '')
    .replace(/AP\s*回满为\s*\d+\s*\/\s*\d+/giu, '')
    .replace(/保留\s*AP\s*(?:[：:]\s*)?/giu, '')
    .replace(/AP\s*不足/giu, '行动资源不足')
    .replace(/\bAP\b/giu, '')
    .replace(/\s+([，。；：,.;:])/gu, '$1')
    .replace(/([，,]){2,}/gu, '$1')
    .replace(/\s{2,}/gu, ' ')
    .trim()
}

export function normalizeDedicatedDnd5eSharedState(name, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  if (name === 'combat') {
    if (!Object.prototype.hasOwnProperty.call(value, 'enemyApByToken')) return value
    const normalized = { ...value }
    delete normalized.enemyApByToken
    return normalized
  }
  if (name !== 'combat-log' || !Array.isArray(value.entries)) return value
  return {
    ...value,
    entries: value.entries.map((entry) => entry && typeof entry === 'object'
      ? { ...entry, text: migrateLegacyApCombatLogText(entry.text) }
      : entry),
  }
}

// ── AC4：图片配额 ───────────────────────────────────────────────────────────
// 最多保留多少张共享图片（含 meta，不计 .json）。超过时按 mtime 最旧优先 GC。
export const IMAGE_COUNT_LIMIT = 128

// ── AC1：跨进程写锁（lockfile + 陈旧超时，崩溃不死锁）───────────────────────
// 锁陈旧超时：持锁进程崩溃后，锁最多被视为有效这么久；超过即判为陈旧可抢占。
// 这些时长运行时从 env 读取（默认值不变），便于测试用更短的超时触发 fail-closed 分支。
const LOCK_RETRY_MS = 20
function lockTimings() {
  return {
    staleMs: Number(process.env.STARS_LOCK_STALE_MS) || 10_000,
    waitMaxMs: Number(process.env.STARS_LOCK_WAIT_MAX_MS) || 5_000,
    // 持锁期间心跳刷新 mtime 的间隔，须显著小于 staleMs，否则慢写仍会被误判陈旧。
    heartbeatMs: Number(process.env.STARS_LOCK_HEARTBEAT_MS) || 3_000,
  }
}

// 抢锁超时的哨兵错误：withWriteLock 抛它 ⇒ 写 fail-closed，调用方映射 503/重试，
// 绝不在未持锁的情况下继续执行 fn()（旧实现超时即 return，放任两个进程同时进入 read-compare-rename）。
export class LockTimeoutError extends Error {
  constructor(lockPath) {
    super(`write lock acquire timed out: ${lockPath}`)
    this.name = 'LockTimeoutError'
    this.code = 'ELOCKTIMEOUT'
    this.statusCode = 503
  }
}

// 进程内串行化：同一文件路径的写在本进程内排队（关闭进程内交错）。
const inProcessLockChain = new Map()

async function isLockStale(lockPath) {
  try {
    const info = await stat(lockPath)
    return Date.now() - info.mtimeMs > lockTimings().staleMs
  } catch {
    // 锁文件已不存在 → 不算陈旧（让抢占循环重试创建）。
    return false
  }
}

// 跨进程：用 wx（O_EXCL）独占创建 lockfile 作为锁。Windows 与 POSIX 都支持 wx 的
// 原子「不存在才创建」语义，因此是可移植做法（不依赖 fcntl/flock 这类平台相关的字节锁）。
// 崩溃安全：锁文件带 mtime，超过 staleMs 即被判陈旧并强制移除后重抢，绝不永久死锁。
async function acquireCrossProcessLock(lockPath, pid) {
  const { waitMaxMs } = lockTimings()
  const deadline = Date.now() + waitMaxMs
  for (;;) {
    try {
      await writeFile(lockPath, String(pid ?? process.pid), { flag: 'wx' })
      return
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error
      if (await isLockStale(lockPath)) {
        // 陈旧锁（持锁者多半已崩溃）→ 移除后重抢。
        await rm(lockPath, { force: true })
        continue
      }
      if (Date.now() > deadline) {
        // 等待超时 ⇒ fail-closed：抛哨兵错误，绝不放行 fn() 无锁运行。
        throw new LockTimeoutError(lockPath)
      }
      await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS))
    }
  }
}

// 持锁期间周期性 touch lockfile 的 mtime，使「合法持锁的慢写」不会因 mtime 老化
// 被第二个进程当作陈旧锁抢占；进程崩溃后心跳停止，staleMs 后才被回收（保留崩溃兜底）。
function startLockHeartbeat(lockPath) {
  const { heartbeatMs } = lockTimings()
  const timer = setInterval(() => {
    const now = new Date()
    void utimes(lockPath, now, now).catch(() => {})
  }, heartbeatMs)
  if (typeof timer.unref === 'function') timer.unref()
  return () => clearInterval(timer)
}

/**
 * 串行化对同一资源文件的写：进程内 promise 链 + 跨进程 lockfile，二者叠加。
 * fn 在两层锁都到手后执行；无论 fn 成败都释放锁（finally），不会因抛错而泄漏锁。
 * 抢锁超时 ⇒ 抛 LockTimeoutError（fail-closed），fn 不会运行。
 */
export async function withWriteLock(filePath, fn) {
  const lockPath = `${filePath}.lock`
  const prev = inProcessLockChain.get(filePath) ?? Promise.resolve()
  let release
  const current = new Promise((resolve) => {
    release = resolve
  })
  const chained = prev.then(() => current)
  inProcessLockChain.set(filePath, chained)
  await prev.catch(() => {})
  try {
    // 抢锁超时会从这里抛出 ⇒ 跳过下面的 try，绝不运行 fn()，也不会误删他人持有的锁。
    await acquireCrossProcessLock(lockPath)
    const stopHeartbeat = startLockHeartbeat(lockPath)
    try {
      return await fn()
    } finally {
      stopHeartbeat()
      await rm(lockPath, { force: true }).catch(() => {})
    }
  } finally {
    release()
    // 链尾消费完后清理 map，防止条目无限堆积。
    if (inProcessLockChain.get(filePath) === chained) inProcessLockChain.delete(filePath)
  }
}

/**
 * 原子写：临时文件 + rename，外裹 withWriteLock。保留既有 temp+rename 语义不变。
 */
export async function atomicWriteLocked(filePath, body) {
  await withWriteLock(filePath, async () => {
    await atomicRename(filePath, body)
  })
}

function updatedAtFromJsonBody(body) {
  try {
    const text = Buffer.isBuffer(body) ? body.toString('utf8') : String(body)
    const parsed = JSON.parse(text)
    const value = Number(parsed?.updatedAt)
    return Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

export async function atomicWriteJsonStateFreshLocked(filePath, body) {
  return withWriteLock(filePath, async () => {
    const incomingUpdatedAt = updatedAtFromJsonBody(body)
    if (incomingUpdatedAt != null) {
      try {
        const existing = await readFile(filePath, 'utf8')
        const existingUpdatedAt = updatedAtFromJsonBody(existing)
        if (existingUpdatedAt != null && incomingUpdatedAt < existingUpdatedAt) {
          return false
        }
      } catch {
        // No existing state yet; accept the write.
      }
    }
    await atomicRename(filePath, body)
    return true
  })
}

// 图片 PUT 走与 state 同一把锁 + temp+rename：blob 与 meta 在同一把锁内各自
// 原子落盘，使 GET 永远看不到半写的 blob 或 blob/meta 不匹配；两个并发 PUT 在 imagePath 锁上串行，
// 胜者的 blob 与 meta 必来自同一次 PUT（不交叉配对）。图片按 id 寻址，无 freshness 比较。
const WINDOWS_RENAME_RETRY_DELAYS_MS = [8, 16, 32, 64, 128, 256, 512]
const WINDOWS_TRANSIENT_RENAME_CODES = new Set(['EPERM', 'EACCES', 'EBUSY'])

export async function retryTransientWindowsRename(operation, options = {}) {
  const platform = options.platform ?? process.platform
  const delays = options.delays ?? WINDOWS_RENAME_RETRY_DELAYS_MS
  const wait = options.wait ?? ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)))
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      const code = typeof error?.code === 'string' ? error.code : ''
      if (
        platform !== 'win32'
        || !WINDOWS_TRANSIENT_RENAME_CODES.has(code)
        || attempt >= delays.length
      ) {
        throw error
      }
      await wait(delays[attempt])
    }
  }
}

async function atomicRename(filePath, body) {
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
  await writeFile(tmpPath, body)
  try {
    await retryTransientWindowsRename(() => rename(tmpPath, filePath))
  } finally {
    await rm(tmpPath, { force: true }).catch(() => {})
  }
}

export async function atomicWriteImageLocked(imagePath, metaPath, blob, metaBody) {
  return withWriteLock(imagePath, async () => {
    await atomicRename(imagePath, blob)
    await atomicRename(metaPath, metaBody)
  })
}

// ── AC5：safeName 防碰撞 ────────────────────────────────────────────────────
// 旧实现把所有非 [a-zA-Z0-9_-] 直接删掉，会把 "a/b" 与 "ab"、"x.1" 与 "x1" 折叠成同一文件。
// 现在：保留白名单字符原样，对任何含被删字符的输入追加一段确定性 hash 后缀，使不同逻辑名
// 必映射到不同文件名（碰撞概率可忽略），同时输出仍只含文件系统安全字符。
export function safeName(value) {
  const raw = String(value ?? '')
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '')
  if (cleaned === raw && raw.length > 0) return raw
  // 含需要编码的字符（或为空）→ 追加 FNV-1a hash 后缀去碰撞。
  const hash = fnv1a(raw).toString(36)
  return `${cleaned}-${hash}`
}

function fnv1a(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

// ── AC2：鉴权（默认关闭，opt-in）────────────────────────────────────────────
// 服务端镜像 sharedApi.ts 的「玩家可写白名单」。flag 开启时，仅 DM 权威资源（不在白名单内，
// 主要是 combat / player-action-ack）才要求 secret；白名单资源玩家照常可写。
const PLAYER_WRITABLE_STATE = new Set([
  'characters',
  'dodge',
  'gale-combo',
  'stable-mind',
  'agile-leap',
  'combat-interrupts',
  'opportunity-attack',
  'player-action',
  'player-action-requests',
  'dice',
  'dice-events',
  'combat-log',
])

export function normalizeRoomId(value) {
  const raw = String(value ?? '').trim()
  return raw ? safeName(raw).slice(0, 80) : 'default'
}

export function roomScopedPath(root, roomId) {
  return roomId === 'default' ? root : path.join(root, 'rooms', roomId)
}

function sharedStateRevision(value) {
  const revision = Number(value?._sync?.revision)
  return Number.isInteger(revision) && revision >= 0 ? revision : 0
}

/**
 * P1 state transaction: freshness remains the fallback for CLI/legacy HTTP
 * clients, while protocol-aware browser clients use an exact expected
 * revision. The generic metadata lives under _sync so domain resources such as
 * combat-interrupts can keep their own top-level revision semantics.
 */
export async function atomicWriteJsonStateCasLocked(filePath, incoming, options = {}) {
  return withWriteLock(filePath, async () => {
    let current = null
    try {
      current = JSON.parse(await readFile(filePath, 'utf8'))
    } catch {
      // Missing state starts at revision zero.
    }
    const currentRevision = sharedStateRevision(current)
    const expectedRevision = Number.isInteger(options.expectedRevision) ? options.expectedRevision : null
    if (expectedRevision != null && expectedRevision !== currentRevision) {
      return { ok: false, conflict: true, currentRevision, current }
    }
    if (expectedRevision == null && current) {
      const incomingUpdatedAt = Number(incoming?.updatedAt)
      const existingUpdatedAt = Number(current?.updatedAt)
      if (Number.isFinite(incomingUpdatedAt) && Number.isFinite(existingUpdatedAt) && incomingUpdatedAt < existingUpdatedAt) {
        return { ok: false, stale: true, currentRevision, current }
      }
    }
    const candidate = typeof options.mergeIncoming === 'function'
      ? options.mergeIncoming(current, incoming)
      : incoming
    const candidateValidation = typeof options.validateIncoming === 'function'
      ? options.validateIncoming(candidate)
      : { ok: true }
    if (!candidateValidation?.ok) {
      return {
        ok: false,
        invalid: true,
        reason: candidateValidation?.reason ?? 'invalid-state',
        currentRevision,
        current,
      }
    }
    const writtenAt = Date.now()
    const next = {
      ...candidate,
      _sync: {
        schemaVersion: SHARED_STATE_SCHEMA_VERSION,
        revision: currentRevision + 1,
        writerId: normalizedLabel(options.writerId, 120) || 'legacy-http-client',
        writtenAt,
      },
    }
    await atomicRename(filePath, JSON.stringify(next))
    return { ok: true, revision: currentRevision + 1, value: next, writtenAt, currentRevision, current }
  })
}

const PLAYER_ALWAYS_SERVER_AUTHORITY_CHARACTER_FIELDS = Object.freeze([
  'conditions',
  'concentrating',
  'dnd5eCombatState',
  'dnd5eInventory',
  'dnd5eExperienceAwards',
  'dmNotes',
  'visibleToPlayers',
])

const PLAYER_COMBAT_SERVER_AUTHORITY_CHARACTER_FIELDS = Object.freeze([
  'currentHp',
  'maxHp',
  'tempHp',
  'hitPointDice',
  'deathSaveSuccesses',
  'deathSaveFailures',
  'deathSaveStable',
  'exhaustionLevel',
  'classResources',
  'equipment',
])

function preserveCharacterFields(target, source, fields) {
  for (const field of fields) target[field] = source?.[field]
  return target
}

/**
 * A player writes the shared character aggregate only as a transport detail.
 * The server keeps other members' records and all Headless-owned fields; a
 * modified browser therefore cannot forge concentration, inventory, HP, or
 * another player's character while combat is active.
 */
export function mergePlayerCharactersStateForAuthority(
  currentState,
  incomingState,
  memberId,
  options = {},
) {
  const currentCharacters = Array.isArray(currentState?.characters) ? currentState.characters : []
  const incomingCharacters = Array.isArray(incomingState?.characters) ? incomingState.characters : []
  const currentById = new Map(currentCharacters
    .filter((character) => plainObject(character) && typeof character.id === 'string' && character.id)
    .map((character) => [character.id, character]))
  const merged = []
  const includedIds = new Set()

  for (const incoming of incomingCharacters) {
    if (!plainObject(incoming) || typeof incoming.id !== 'string' || !incoming.id || includedIds.has(incoming.id)) continue
    const current = currentById.get(incoming.id)
    if (!current) {
      if (incoming.roomMemberId !== memberId) continue
      merged.push({ ...incoming, roomMemberId: memberId })
      includedIds.add(incoming.id)
      continue
    }
    if (current.roomMemberId !== memberId) continue
    const next = { ...incoming, roomId: current.roomId, roomMemberId: current.roomMemberId }
    if (current.ownerAccountId) next.ownerAccountId = current.ownerAccountId
    preserveCharacterFields(next, current, PLAYER_ALWAYS_SERVER_AUTHORITY_CHARACTER_FIELDS)
    if (options.combatActive === true) {
      preserveCharacterFields(next, current, PLAYER_COMBAT_SERVER_AUTHORITY_CHARACTER_FIELDS)
    }
    merged.push(next)
    includedIds.add(next.id)
  }

  for (const current of currentCharacters) {
    if (!plainObject(current) || typeof current.id !== 'string' || !current.id || includedIds.has(current.id)) continue
    if (current.roomMemberId === memberId) continue
    merged.push(current)
    includedIds.add(current.id)
  }

  const requestedSelectedId = typeof incomingState?.selectedId === 'string' ? incomingState.selectedId : null
  const selectedId = requestedSelectedId && merged.some((character) =>
    character.id === requestedSelectedId && character.roomMemberId === memberId)
    ? requestedSelectedId
    : (typeof currentState?.selectedId === 'string' && merged.some((character) =>
        character.id === currentState.selectedId && character.roomMemberId === memberId)
        ? currentState.selectedId
        : (merged.find((character) => character.roomMemberId === memberId)?.id ?? null))
  return { ...incomingState, characters: merged, selectedId }
}

async function sharedCombatIsActiveForAuthority(ctx) {
  for (const root of [ctx.stateRoot, ctx.legacyStateRoot]) {
    if (!root) continue
    try {
      const value = JSON.parse(await readFile(path.join(root, 'combat.json'), 'utf8'))
      return value?._deleted === true ? false : value?.active === true
    } catch (error) {
      if (error?.code === 'ENOENT') continue
      // A damaged combat snapshot must not relax player write authority.
      return true
    }
  }
  return false
}

/**
 * A delete is persisted as a revisioned tombstone instead of removing the
 * file. This prevents the ABA case where a stale client with revision zero
 * could recreate a resource after a newer client deleted it.
 */
export async function atomicDeleteJsonStateCasLocked(filePath, options = {}) {
  return withWriteLock(filePath, async () => {
    let current = null
    try {
      current = JSON.parse(await readFile(filePath, 'utf8'))
    } catch {
      // Missing state starts at revision zero.
    }
    const currentRevision = sharedStateRevision(current)
    const expectedRevision = Number.isInteger(options.expectedRevision) ? options.expectedRevision : null
    if (expectedRevision != null && expectedRevision !== currentRevision) {
      return { ok: false, conflict: true, currentRevision, current }
    }
    const writtenAt = Date.now()
    const next = {
      _deleted: true,
      updatedAt: writtenAt,
      _sync: {
        schemaVersion: SHARED_STATE_SCHEMA_VERSION,
        revision: currentRevision + 1,
        writerId: normalizedLabel(options.writerId, 120) || 'legacy-http-client',
        writtenAt,
      },
    }
    await atomicRename(filePath, JSON.stringify(next))
    return { ok: true, revision: currentRevision + 1, value: next, writtenAt, currentRevision, current }
  })
}

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function normalizeLobbyRoomCode(value) {
  return String(value ?? '').trim().toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, '').slice(0, 6)
}

export function roomHostIsOnline(room, now = Date.now()) {
  return !room?.closedAt && Number.isFinite(room?.host?.lastSeenAt) && now - room.host.lastSeenAt <= ROOM_HOST_TTL_MS
}

export function normalizeRoomPluginRequirements(value) {
  if (!Array.isArray(value) || value.length > 32) return null
  const seen = new Set()
  const normalized = []
  for (const candidate of value) {
    const id = typeof candidate?.id === 'string' ? candidate.id.trim() : ''
    const version = typeof candidate?.version === 'string' ? candidate.version.trim() : ''
    const integrity = typeof candidate?.integrity === 'string' ? candidate.integrity.trim() : ''
    const stateSchemaVersion = candidate?.stateSchemaVersion == null ? 1 : Number(candidate.stateSchemaVersion)
    if (
      !/^[a-z0-9][a-z0-9._-]{0,99}$/.test(id) ||
      version.length < 1 || version.length > 64 ||
      !/^sha256-[A-Za-z0-9+/]+={0,2}$/.test(integrity) ||
      !Number.isInteger(stateSchemaVersion) || stateSchemaVersion < 1 || stateSchemaVersion > 1_000 ||
      seen.has(id)
    ) return null
    seen.add(id)
    normalized.push({ id, version, integrity, stateSchemaVersion })
  }
  return normalized.sort((left, right) => left.id.localeCompare(right.id))
}

export function roomPluginReadiness(required, active) {
  const activeById = new Map((Array.isArray(active) ? active : []).map((plugin) => [plugin.id, plugin]))
  const missing = []
  const mismatched = []
  for (const requirement of Array.isArray(required) ? required : []) {
    const installed = activeById.get(requirement.id)
    if (!installed) missing.push(requirement)
    else if (
      installed.version !== requirement.version || installed.integrity !== requirement.integrity ||
      (installed.stateSchemaVersion ?? 1) !== (requirement.stateSchemaVersion ?? 1)
    ) {
      mismatched.push(requirement)
    }
  }
  return { ready: missing.length === 0 && mismatched.length === 0, missing, mismatched }
}

function activeRoomPlayers(room, now = Date.now()) {
  return Array.isArray(room?.players)
    ? room.players.filter((player) =>
      player?.role !== 'spectator' &&
      !player?.leftAt && !player?.removedAt && Number.isFinite(player?.lastSeenAt) &&
      now - player.lastSeenAt <= ROOM_PLAYER_TTL_MS)
    : []
}

function activeRoomSpectators(room, now = Date.now()) {
  return Array.isArray(room?.players)
    ? room.players.filter((player) =>
      player?.role === 'spectator' &&
      !player?.leftAt && !player?.removedAt && Number.isFinite(player?.lastSeenAt) &&
      now - player.lastSeenAt <= ROOM_PLAYER_TTL_MS)
    : []
}

export function roomPlayerPresence(player, now = Date.now()) {
  if (Number.isFinite(player?.removedAt) && player.removedAt > 0) return 'removed'
  if (Number.isFinite(player?.leftAt) && player.leftAt > 0) return 'left'
  if (Number.isFinite(player?.lastSeenAt) && now - player.lastSeenAt <= ROOM_PRESENCE_ONLINE_MS) return 'online'
  return 'temporarily-offline'
}

export function roomHostPresence(room, now = Date.now()) {
  if (room?.closedAt) return 'closed'
  if (!Number.isFinite(room?.host?.lastSeenAt)) return 'offline'
  const age = now - room.host.lastSeenAt
  if (age <= ROOM_PRESENCE_ONLINE_MS) return 'online'
  if (age <= ROOM_HOST_TTL_MS) return 'grace'
  return 'offline'
}

function roomMemberAccountAuthorized(member, account) {
  if (!member?.accountId) return true
  return !!account && member.accountId === account.accountId
}

function roomCommunicationPlayerMemberIds(room) {
  return (Array.isArray(room?.players) ? room.players : [])
    .filter((player) => player?.role !== 'spectator' && roomPlayerPresence(player) !== 'removed')
    .map((player) => player.memberId)
    .filter(Boolean)
}

function createRoomSessionToken() {
  return randomBytes(32).toString('base64url')
}

function roomSessionTokenHash(token) {
  return createHash('sha256').update(String(token ?? '')).digest('hex')
}

function roomMemberSessionAuthorized(member, token) {
  if (typeof member?.roomTokenHash !== 'string' || member.roomTokenHash.length !== 64) return false
  if (typeof token !== 'string' || token.length < 32 || token.length > 256) return false
  const actual = roomSessionTokenHash(token)
  return timingSafeEqual(Buffer.from(member.roomTokenHash), Buffer.from(actual))
}

/**
 * 在房间文件写锁内调用的纯席位分配器。同一个浏览器 clientId／恢复成员 ID
 * 会保留原成员身份；离线历史不占席位，但不会被删除，确保角色归属可在重连后恢复。
 */
export function assignRoomPlayer(room, input, now = Date.now()) {
  if (room?.closedAt) return { ok: false, status: 409, error: 'room-closed' }
  if (!roomHostIsOnline(room, now)) return { ok: false, status: 409, error: 'room-offline' }
  const players = Array.isArray(room?.players) ? room.players : []
  const activePlayers = activeRoomPlayers(room, now)
  const resumedByAccount = input.accountId
    ? players
      .filter((player) => player.accountId === input.accountId)
      .sort((left, right) => Number(right.lastSeenAt ?? 0) - Number(left.lastSeenAt ?? 0))[0]
    : undefined
  const resumedByClient = players
    .filter((player) => player.clientId === input.clientId && (!input.accountId || !player.accountId || player.accountId === input.accountId))
    .sort((left, right) => Number(right.lastSeenAt ?? 0) - Number(left.lastSeenAt ?? 0))[0]
  const resumedByMember = players.find((player) => player.memberId === input.memberId)
  if (!resumedByAccount && !resumedByClient && resumedByMember && resumedByMember.clientId !== input.clientId) {
    return { ok: false, status: 409, error: 'invalid-resume-member' }
  }
  const resumed = resumedByAccount ?? resumedByClient ?? resumedByMember
  const maxPlayers = Number.isInteger(room?.maxPlayers)
    ? Math.max(1, Math.min(ROOM_PLAYER_SLOTS.length, room.maxPlayers))
    : 3
  const allowedSlots = ROOM_PLAYER_SLOTS.slice(0, maxPlayers)
  if (resumed) {
    if (roomPlayerPresence(resumed, now) === 'removed') {
      return { ok: false, status: 403, error: 'member-removed' }
    }
    const usedSlots = new Set(activePlayers
      .filter((player) => player.memberId !== resumed.memberId && player.clientId !== resumed.clientId)
      .map((player) => player.slot))
    const slot = allowedSlots.includes(resumed.slot) && !usedSlots.has(resumed.slot)
      ? resumed.slot
      : allowedSlots.find((candidate) => !usedSlots.has(candidate))
    if (!slot) return { ok: false, status: 409, error: 'room-full' }
    const member = {
      ...resumed,
      ...(input.accountId ? { accountId: input.accountId } : {}),
      clientId: input.clientId,
      displayName: input.displayName,
      role: 'player',
      slot,
      activePlugins: input.activePlugins ?? resumed.activePlugins ?? [],
      lastSeenAt: now,
      ...(input.roomTokenHash ? { roomTokenHash: input.roomTokenHash } : {}),
    }
    delete member.leftAt
    delete member.removedAt
    return {
      ok: true,
      member,
      next: {
        ...room,
        players: [
          ...players.filter((player) =>
            player.memberId !== member.memberId && player.clientId !== member.clientId),
          member,
        ],
        updatedAt: now,
      },
    }
  }
  if (room?.locked) return { ok: false, status: 409, error: 'room-locked' }
  if (
    room?.host?.memberId === input.memberId || players.some((player) => player.memberId === input.memberId) ||
    (input.accountId && (room?.host?.accountId === input.accountId || players.some((player) => player.accountId === input.accountId)))
  ) {
    return { ok: false, status: 409, error: 'invalid-resume-member' }
  }
  const usedSlots = new Set(activePlayers.map((player) => player.slot))
  const slot = allowedSlots.find((candidate) => !usedSlots.has(candidate))
  if (!slot) return { ok: false, status: 409, error: 'room-full' }
  const member = {
    memberId: input.memberId,
    ...(input.accountId ? { accountId: input.accountId } : {}),
    clientId: input.clientId,
    displayName: input.displayName,
    role: 'player',
    slot,
    activePlugins: input.activePlugins ?? [],
    joinedAt: now,
    lastSeenAt: now,
    roomTokenHash: input.roomTokenHash,
  }
  return {
    ok: true,
    member,
    next: { ...room, players: [...players, member], updatedAt: now },
  }
}

export function authorizeAccessToken(providedToken) {
  const dmToken = process.env.STARS_DM_TOKEN || null
  const playerToken = process.env.STARS_PLAYER_TOKEN || null
  if (!dmToken && !playerToken) return { ok: true, role: 'open' }
  if (dmToken && providedToken === dmToken) return { ok: true, role: 'dm' }
  if (playerToken && providedToken === playerToken) return { ok: true, role: 'player' }
  return { ok: false, status: providedToken ? 403 : 401 }
}

export function consumeRateLimit(buckets, key, now = Date.now(), limit = 1200, windowMs = 10_000) {
  const current = buckets.get(key)
  if (!current || now - current.startedAt >= windowMs) {
    buckets.set(key, { startedAt: now, count: 1 })
    return { ok: true, remaining: Math.max(0, limit - 1) }
  }
  current.count += 1
  return current.count <= limit
    ? { ok: true, remaining: Math.max(0, limit - current.count) }
    : { ok: false, retryAfterMs: Math.max(1, windowMs - (now - current.startedAt)) }
}

function sharedSecret() {
  const value = process.env.STARS_SHARED_SECRET
  return value && value.length > 0 ? value : null
}

/**
 * 写鉴权判定。返回 { ok:true } 或 { ok:false, status }.
 * - flag 未设（secret==null）⇒ 永远放行（与今日行为字节等价，零回归）。
 * - flag 设了 + 资源在玩家白名单 ⇒ 放行（例如角色和玩家行动请求）。
 * - flag 设了 + DM 权威资源 + secret 正确 ⇒ 放行。
 * - flag 设了 + DM 权威资源 + secret 缺失/错误 ⇒ 401/403。
 */
export function authorizeStateWrite(resourceName, providedSecret) {
  const secret = sharedSecret()
  if (secret == null) return { ok: true }
  if (PLAYER_WRITABLE_STATE.has(resourceName)) return { ok: true }
  if (providedSecret == null || providedSecret === '') return { ok: false, status: 401 }
  if (providedSecret !== secret) return { ok: false, status: 403 }
  return { ok: true }
}

/** Scene declarations contain DM-only secrets and may never be replaced by a player or spectator client. */
export function stateResourceWriteAllowedForRole(resourceName, role) {
  if (resourceName === 'scene-orchestration' && (role === 'player' || role === 'spectator')) return false
  if (role === 'dm' && (resourceName === 'player-action' || resourceName === 'player-action-requests')) {
    return false
  }
  if (
    (role === 'player' || role === 'spectator') &&
    (resourceName === 'player-action-processed' || resourceName === 'player-action-ack')
  ) {
    return false
  }
  if (
    role === 'spectator' &&
    (resourceName === 'player-action' || resourceName === 'player-action-requests')
  ) {
    return false
  }
  return true
}

// ── AC4：图片配额 GC ────────────────────────────────────────────────────────
/**
 * 图片配额触发器（DOCUMENTED）：每次 PUT 写入新图片成功后触发一次 GC（write-trigger）。
 * 列出 imageRoot 下所有非 .json 主文件，按 mtime 升序，删除超过 IMAGE_COUNT_LIMIT 的最旧者
 * （连带其 .json meta）。这把「写时增长」即时收口，无需后台定时器，也不依赖客户端 load。
 */
export async function enforceImageQuota(imageRoot) {
  let entries
  try {
    entries = await readdir(imageRoot)
  } catch {
    return []
  }
  const mains = entries.filter((name) => !name.endsWith('.json'))
  if (mains.length <= IMAGE_COUNT_LIMIT) return []
  const withMtime = []
  for (const name of mains) {
    try {
      const info = await stat(path.join(imageRoot, name))
      withMtime.push({ name, mtime: info.mtimeMs })
    } catch {
      // 文件并发消失，跳过。
    }
  }
  withMtime.sort((a, b) => a.mtime - b.mtime)
  const removeCount = withMtime.length - IMAGE_COUNT_LIMIT
  const removed = []
  for (let i = 0; i < removeCount; i += 1) {
    const { name } = withMtime[i]
    await rm(path.join(imageRoot, name), { force: true }).catch(() => {})
    await rm(path.join(imageRoot, `${name}.json`), { force: true }).catch(() => {})
    removed.push(name)
  }
  return removed
}

// ── AC3：backlog 回放上限 ───────────────────────────────────────────────────
/** 新订阅者只取 backlog 末尾 EVENT_REPLAY_LIMIT 条。 */
export function replaySlice(backlog) {
  if (!Array.isArray(backlog)) return []
  if (backlog.length <= EVENT_REPLAY_LIMIT) return backlog
  return backlog.slice(backlog.length - EVENT_REPLAY_LIMIT)
}

/** 环形 backlog 追加，保持总量 ≤ EVENT_BACKLOG_LIMIT。 */
export function pushBacklog(backlog, payload) {
  backlog.push(payload)
  if (backlog.length > EVENT_BACKLOG_LIMIT) backlog.splice(0, backlog.length - EVENT_BACKLOG_LIMIT)
  return backlog
}

/**
 * 限制 channel 总数：Map 保留插入序，从头删即淘汰最旧 channel。
 * protectedChannels（如当前有活跃 SSE 订阅者的 channel）永不淘汰，避免会话中途清掉活跃 channel。
 * 返回被淘汰的 channel 名数组（确定性，便于单测）。
 */
export function capEventChannels(eventBacklog, limit = EVENT_CHANNEL_LIMIT, protectedChannels = null) {
  const evicted = []
  if (eventBacklog.size <= limit) return evicted
  for (const channel of [...eventBacklog.keys()]) {
    if (eventBacklog.size <= limit) break
    if (protectedChannels && protectedChannels.has(channel)) continue
    eventBacklog.delete(channel)
    evicted.push(channel)
  }
  return evicted
}

// ── 从请求头读取 secret（鉴权用）────────────────────────────────────────────
export function extractSecret(req) {
  const header = req?.headers?.['x-stars-secret']
  if (typeof header === 'string' && header.length > 0) return header
  return null
}

// ── AC5：/api 分发的单一实现 ────────────────────────────────────────────────
// 两个服务端（vite-server.mjs + static-server.mjs）此前各自复制了一份字节相同的 /api 分发逻辑
// （events / state / image），极易漂移。现集中到此处单一定义，服务端只保留各自的静态回退差异。
// ctx = { stateRoot, imageRoot, legacyStateRoot, legacyImageRoot, eventClients, eventBacklog }
export function applyCors(req, res, env = process.env) {
  const origin = typeof req?.headers?.origin === 'string' ? req.headers.origin : null
  const production = productionSecurityEnabled(env)
  const publicOrigin = normalizedHttpOrigin(env.STARS_PUBLIC_ORIGIN)
  const configured = String(env.STARS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map(normalizedHttpOrigin)
    .filter(Boolean)
  const allowedOrigins = new Set([publicOrigin, ...configured].filter(Boolean))
  if (origin) {
    if (production && !allowedOrigins.has(origin)) return false
    if (!production && allowedOrigins.size > 0 && !allowedOrigins.has(origin)) return false
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins.size > 0 ? origin : '*')
    if (allowedOrigins.size > 0) res.setHeader('Vary', 'Origin')
  } else if (!production && allowedOrigins.size === 0) {
    res.setHeader('Access-Control-Allow-Origin', '*')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Stars-Secret, X-Stars-Token, X-Stars-Account-Token, X-Stars-Member, X-Stars-Room-Token, X-Stars-Protocol, X-Stars-Writer, X-Stars-Expected-Revision, X-Stars-Undo-Group, X-Stars-Undo-Label, X-Stars-Image-Purpose, X-Stars-Plugin-Version, X-Stars-Plugin-Integrity, X-Stars-Plugin-Filename, X-Stars-Plugin-Name, X-Stars-Plugin-Publisher, X-Stars-Plugin-License, X-Stars-Plugin-Distribution-Policy, X-Stars-Plugin-State-Schema, X-Stars-Plugin-Api-Version, X-Stars-Plugin-Ruleset, X-Stars-Plugin-Description, X-Stars-Plugin-Metadata')
  res.setHeader('Access-Control-Expose-Headers', 'X-Stars-State-Revision, X-Stars-Plugin-Version, X-Stars-Plugin-Integrity, X-Stars-Plugin-Filename, X-Stars-Plugin-Name, X-Stars-Plugin-Publisher, X-Stars-Plugin-License, X-Stars-Plugin-Distribution-Policy, X-Stars-Plugin-State-Schema, X-Stars-Plugin-Api-Version, X-Stars-Plugin-Ruleset, X-Stars-Plugin-Description, X-Stars-Plugin-Metadata')
  return true
}

function extractAccessToken(req, parsed) {
  const header = req?.headers?.['x-stars-token']
  if (typeof header === 'string' && header.length > 0) return header
  return parsed.searchParams.get('token')
}

function scopedContext(ctx, roomId) {
  if (roomId === 'default') return { ...ctx, roomId }
  return {
    ...ctx,
    roomId,
    stateRoot: roomScopedPath(ctx.stateRoot, roomId),
    imageRoot: roomScopedPath(ctx.imageRoot, roomId),
    legacyStateRoot: roomScopedPath(ctx.legacyStateRoot, roomId),
    legacyImageRoot: roomScopedPath(ctx.legacyImageRoot, roomId),
    quarantineRoot: roomScopedPath(ctx.quarantineRoot, roomId),
    snapshotRoot: roomScopedPath(ctx.snapshotRoot, roomId),
  }
}

function browserProtocolIsCurrent(req) {
  return Number(req?.headers?.['x-stars-protocol']) === SHARED_PROTOCOL_VERSION
}

function eventStorageKey(ctx, channel) {
  return `${ctx.roomId ?? 'default'}::${channel}`
}

function normalizedEventRole(role) {
  return role === 'open' ? 'dm' : role
}

export function eventChannelOperationAllowed(channel, operation, role) {
  if (channel === '_all') return operation === 'subscribe'
  const policy = EVENT_CHANNEL_POLICIES[channel]
  if (!policy) return false
  if (role === 'open') return true
  return policy[operation].includes(normalizedEventRole(role))
}

function stampClientEvent(channel, payload, member) {
  if (!plainObject(payload)) return payload
  if (channel === 'player-action-player-to-dm') {
    return { ...payload, sourceMode: 'player', roomMemberId: member?.memberId }
  }
  if (channel === 'dnd5e-inventory-player-to-dm') {
    return { ...payload, sourceMode: 'player', memberId: member?.memberId }
  }
  return payload
}

function eventPayloadVisibleToViewer(channel, payload, viewer) {
  const role = normalizedEventRole(viewer?.role)
  if (!eventChannelOperationAllowed(channel, 'subscribe', role)) return false
  if (channel === 'player-action-dm-to-player') {
    return typeof payload?.recipientMemberId === 'string' && payload.recipientMemberId === viewer?.memberId
  }
  return true
}

export function projectEventPayloadForViewer(channel, payload, viewer) {
  if (channel !== '_all') {
    return eventPayloadVisibleToViewer(channel, payload, viewer) ? payload : undefined
  }
  if (!plainObject(payload) || typeof payload.channel !== 'string') return undefined
  if (eventPayloadVisibleToViewer(payload.channel, payload.payload, viewer)) return payload
  return { ...payload, channel: '_private', payload: null }
}

function nextRoomEventSequence(ctx) {
  if (!ctx.eventSequences) ctx.eventSequences = new Map()
  const roomId = ctx.roomId ?? 'default'
  const sequence = (ctx.eventSequences.get(roomId) ?? 0) + 1
  ctx.eventSequences.set(roomId, sequence)
  return sequence
}

export async function atomicMutateJsonStateLocked(filePath, updater) {
  return withWriteLock(filePath, async () => {
    let current = null
    try {
      current = JSON.parse(await readFile(filePath, 'utf8'))
    } catch {
      current = null
    }
    const result = await updater(current)
    if (!result?.changed) return result
    const next = {
      ...result.next,
      _sync: {
        schemaVersion: SHARED_STATE_SCHEMA_VERSION,
        revision: sharedStateRevision(current) + 1,
        writerId: 'atomic-server-mutation',
        writtenAt: Date.now(),
      },
    }
    const body = JSON.stringify(next)
    if (Buffer.byteLength(body, 'utf8') > STATE_MAX_BYTES) {
      return { ok: false, changed: false, status: 413, error: 'state-too-large', next: current }
    }
    await atomicRename(filePath, body)
    return { ...result, next, previous: current }
  })
}

function mutateCombatLogState(current, mutation, now = Date.now()) {
  if (mutation?.operation !== 'append') {
    return { ok: false, changed: false, status: 400, error: 'invalid-operation' }
  }
  const mapId = boundedText(mutation?.mapId, 160).trim()
  const submitted = mutation?.entry
  if (
    !mapId ||
    !plainObject(submitted) ||
    !Number.isFinite(submitted.id) ||
    submitted.id < 0 ||
    !Number.isInteger(submitted.round) ||
    submitted.round < 0 ||
    typeof submitted.text !== 'string' ||
    !submitted.text.trim() ||
    submitted.text.length > 20_000 ||
    !['system', 'turn', 'attack', 'damage'].includes(submitted.kind) ||
    typeof submitted.time !== 'string' ||
    submitted.time.length > 80 ||
    (
      submitted.actorTokenId != null &&
      (
        typeof submitted.actorTokenId !== 'string' ||
        !submitted.actorTokenId.trim() ||
        submitted.actorTokenId.length > 180
      )
    ) ||
    (
      submitted.details != null &&
      (
        !Array.isArray(submitted.details) ||
        submitted.details.length > 200 ||
        submitted.details.some((detail) => typeof detail !== 'string' || detail.length > 2_000)
      )
    )
  ) {
    return { ok: false, changed: false, status: 400, error: 'invalid-combat-log-entry' }
  }
  const entry = {
    id: submitted.id,
    round: submitted.round,
    text: migrateLegacyApCombatLogText(submitted.text),
    kind: submitted.kind,
    time: submitted.time,
    ...(submitted.actorTokenId != null ? { actorTokenId: submitted.actorTokenId } : {}),
    ...(submitted.details?.length > 0 ? { details: [...submitted.details] } : {}),
  }
  const entries = current?.mapId === mapId && Array.isArray(current.entries)
    ? current.entries
    : []
  return {
    ok: true,
    changed: true,
    next: {
      mapId,
      entries: [entry, ...entries.filter((candidate) => candidate?.id !== entry.id)].slice(0, 200),
      updatedAt: now,
    },
  }
}

export function mutateCombatInterruptQueue(
  queue,
  mutation,
  now = Date.now(),
  authorityRole = 'open',
  authorityCharacterIds,
) {
  const operation = mutation?.operation
  const mapId = String(mutation?.mapId ?? '')
  if (!mapId) return { ok: false, status: 400, error: 'invalid-map' }
  const base = queue && queue.mapId === mapId
    ? queue
    : { mapId, interrupts: [], updatedAt: now, revision: 0 }

  if (operation === 'upsert') {
    const interrupt = mutation?.interrupt
    if (!interrupt || interrupt.mapId !== mapId || !interrupt.id) {
      return { ok: false, status: 400, error: 'invalid-interrupt' }
    }
    if (
      interrupt.kind === 'roll-confirmation' && (
        !plainObject(interrupt.payload) || typeof interrupt.payload.rollId !== 'string' || !interrupt.payload.rollId ||
        typeof interrupt.payload.label !== 'string' || !interrupt.payload.label.trim() ||
        !Number.isInteger(interrupt.payload.originalValue) || interrupt.payload.originalValue < 1 || interrupt.payload.originalValue > 20 ||
        (interrupt.payload.visibility !== 'public' && interrupt.payload.visibility !== 'dm-only') ||
        !plainObject(interrupt.payload.transaction)
      )
    ) return { ok: false, status: 400, error: 'invalid-roll-confirmation' }
    const existing = base.interrupts.find((item) => item.id === interrupt.id)
    if (existing && existing.status !== 'pending') {
      return { ok: true, changed: false, next: base }
    }
    if (existing?.kind === 'roll-confirmation') {
      return { ok: true, changed: false, next: base }
    }
    const transactionId = String(interrupt.transactionId ?? interrupt.id)
    const conflictingLock = base.interrupts.find((item) =>
      String(item.transactionId ?? item.id) === transactionId &&
      item.id !== interrupt.id &&
      !['done', 'rolled-back'].includes(item.status),
    )
    if (conflictingLock) return { ok: false, status: 409, error: 'transaction-locked' }
    const normalizedInterrupt = {
      ...interrupt,
      transactionId,
      phase: ['before-action', 'after-roll', 'before-hit', 'before-damage', 'after-save', 'before-condition'].includes(interrupt.phase)
        ? interrupt.phase
        : 'before-action',
      timeoutPolicy: interrupt.timeoutPolicy === 'wait-for-dm' ? 'wait-for-dm' : 'rollback',
      ...(interrupt.kind === 'roll-confirmation' ? {
        status: 'pending',
        phase: 'after-roll',
        timeoutPolicy: 'wait-for-dm',
        response: undefined,
        contributions: [],
      } : {}),
    }
    const interrupts = [
      ...base.interrupts.filter((item) => item.id !== interrupt.id),
      normalizedInterrupt,
    ].sort((a, b) => Number(a.updatedAt ?? 0) - Number(b.updatedAt ?? 0)).slice(-32)
    return {
      ok: true,
      changed: true,
      next: { mapId, interrupts, updatedAt: now, revision: Number(base.revision ?? 0) + 1 },
    }
  }

  if (!['contribute', 'answer', 'rolling', 'finish', 'wait', 'rollback'].includes(operation)) {
    return { ok: false, status: 400, error: 'invalid-operation' }
  }
  const id = String(mutation?.id ?? '')
  const index = base.interrupts.findIndex((item) => item.id === id)
  if (index < 0) return { ok: false, status: 404, error: 'interrupt-not-found' }
  const current = base.interrupts[index]
  if (current.kind === 'roll-confirmation' && authorityRole === 'player' && operation !== 'contribute') {
    return { ok: false, status: 403, error: 'dm-authority-required' }
  }
  if (current.kind === 'plugin-choice' && authorityRole === 'player') {
    const audienceCharacterId = current.payload?.audience === 'target'
      ? current.targetCharId
      : current.payload?.audience === 'actor'
        ? current.actorCharId
        : undefined
    if (
      !audienceCharacterId ||
      !Array.isArray(authorityCharacterIds) ||
      !authorityCharacterIds.includes(audienceCharacterId)
    ) {
      return { ok: false, status: 403, error: 'character-ownership-required' }
    }
  }
  if (current.kind === 'roll-confirmation' && (operation === 'answer' || (operation === 'finish' && mutation?.response != null))) {
    const response = mutation?.response
    const originalValue = current.payload?.originalValue
    if (
      !response || response.decision !== 'continue' ||
      !Number.isInteger(originalValue) || originalValue < 1 || originalValue > 20 ||
      !Number.isInteger(response.finalValue) || response.finalValue < 1 || response.finalValue > 20 ||
      (response.acceptedContributionId != null && typeof response.acceptedContributionId !== 'string')
    ) return { ok: false, status: 400, error: 'invalid-roll-confirmation-response' }
    const acceptedContribution = response.acceptedContributionId
      ? (Array.isArray(current.contributions) ? current.contributions : [])
        .find((entry) => entry?.id === response.acceptedContributionId)
      : undefined
    if (response.acceptedContributionId && !acceptedContribution) {
      return { ok: false, status: 409, error: 'roll-contribution-not-found' }
    }
    const dmOverrideAllowed =
      current.payload?.visibility === 'dm-only' &&
      current.payload?.allowDmOverride === true &&
      !response.acceptedContributionId
    const expectedValue = dmOverrideAllowed ? response.finalValue : acceptedContribution?.replacementValue ?? originalValue
    if (response.finalValue !== expectedValue) {
      return { ok: false, status: 409, error: 'roll-confirmation-value-conflict' }
    }
  }
  if (operation === 'contribute') {
    if (
      current.kind !== 'roll-confirmation' ||
      (current.status !== 'pending' && current.status !== 'waiting-for-dm')
    ) return { ok: false, status: 409, error: 'invalid-transition' }
    const contribution = mutation?.contribution
    if (
      !contribution || contribution.kind !== 'replace-d20' ||
      typeof contribution.id !== 'string' || !contribution.id ||
      typeof contribution.characterId !== 'string' || !contribution.characterId ||
      typeof contribution.characterName !== 'string' || !contribution.characterName.trim() ||
      typeof contribution.featureLabel !== 'string' || !contribution.featureLabel.trim() ||
      contribution.dieIndex !== 0 || !Number.isInteger(contribution.replacementValue) ||
      contribution.replacementValue < 1 || contribution.replacementValue > 20 ||
      !Number.isFinite(contribution.createdAt) ||
      (contribution.featureId != null && typeof contribution.featureId !== 'string')
    ) return { ok: false, status: 400, error: 'invalid-contribution' }
    const eligibleModifiers = Array.isArray(current.payload?.eligibleModifiers)
      ? current.payload.eligibleModifiers
      : []
    const eligibleModifier = eligibleModifiers.find((entry) =>
      entry?.characterId === contribution.characterId &&
      entry?.featureId === contribution.featureId &&
      entry?.featureLabel === contribution.featureLabel,
    )
    if (!eligibleModifier) {
      return { ok: false, status: 403, error: 'ineligible-roll-modifier' }
    }
    if (
      authorityRole === 'player' &&
      (
        !Array.isArray(authorityCharacterIds) ||
        !authorityCharacterIds.includes(contribution.characterId)
      )
    ) {
      return { ok: false, status: 403, error: 'character-ownership-required' }
    }
    if (contribution.id !== `${current.id}:${contribution.characterId}`) {
      return { ok: false, status: 400, error: 'invalid-contribution-id' }
    }
    const normalizedContribution = {
      id: contribution.id.slice(0, 240),
      kind: 'replace-d20',
      characterId: contribution.characterId.slice(0, 160),
      characterName: contribution.characterName.trim().slice(0, 80),
      ...(contribution.featureId?.trim() ? { featureId: contribution.featureId.trim().slice(0, 160) } : {}),
      featureLabel: contribution.featureLabel.trim().slice(0, 120),
      dieIndex: 0,
      replacementValue: contribution.replacementValue,
      createdAt: contribution.createdAt,
    }
    const contributions = [
      ...(Array.isArray(current.contributions) ? current.contributions : [])
        .filter((entry) => entry?.id !== normalizedContribution.id),
      normalizedContribution,
    ].sort((a, b) => Number(a.createdAt ?? 0) - Number(b.createdAt ?? 0)).slice(-32)
    const interrupts = [...base.interrupts]
    interrupts[index] = { ...current, contributions, updatedAt: now }
    return {
      ok: true,
      changed: true,
      next: { ...base, interrupts, updatedAt: now, revision: Number(base.revision ?? 0) + 1 },
    }
  }
  const allowed =
    (operation === 'answer' && (current.status === 'pending' || current.status === 'rolling')) ||
    (operation === 'rolling' && current.status === 'pending') ||
    (operation === 'finish' && !['done', 'rolled-back'].includes(current.status)) ||
    (operation === 'wait' && current.status === 'pending' && current.timeoutPolicy === 'wait-for-dm') ||
    (operation === 'rollback' && !['done', 'rolled-back'].includes(current.status))
  if (!allowed) {
    const idempotent =
      (operation === 'answer' && current.status === 'answered') ||
      (operation === 'rolling' && current.status === 'rolling') ||
      (operation === 'finish' && current.status === 'done') ||
      (operation === 'wait' && current.status === 'waiting-for-dm') ||
      (operation === 'rollback' && current.status === 'rolled-back')
    const sameResponse = mutation?.response == null || JSON.stringify(mutation.response) === JSON.stringify(current.response)
    return idempotent
      ? sameResponse ? { ok: true, changed: false, next: base } : { ok: false, status: 409, error: 'settlement-conflict' }
      : { ok: false, status: 409, error: 'invalid-transition' }
  }
  const status = operation === 'answer'
    ? 'answered'
    : operation === 'rolling'
      ? 'rolling'
      : operation === 'wait'
        ? 'waiting-for-dm'
        : operation === 'rollback'
          ? 'rolled-back'
          : 'done'
  const nextInterrupt = {
    ...current,
    status,
    response: mutation?.response ?? current.response,
    ...(operation === 'wait' ? { waitingSince: now, expiresAt: undefined } : {}),
    ...(operation === 'rollback' ? { rollbackReason: mutation?.rollbackReason ?? 'cancelled' } : {}),
    updatedAt: now,
  }
  const interrupts = [...base.interrupts]
  interrupts[index] = nextInterrupt
  return {
    ok: true,
    changed: true,
    next: { ...base, interrupts, updatedAt: now, revision: Number(base.revision ?? 0) + 1 },
  }
}

// 限制请求体大小，超过 maxBytes 即抛 413 标记错误。超限后继续 drain 剩余分块再抛，
// 避免 req.destroy() 触发 ECONNRESET 让客户端拿不到干净 413。
async function readBody(req, maxBytes = STATE_MAX_BYTES) {
  const chunks = []
  let total = 0
  let over = false
  for await (const chunk of req) {
    total += chunk.length
    if (total > maxBytes) {
      over = true
      continue
    }
    if (!over) chunks.push(chunk)
  }
  if (over) {
    const err = new Error('Payload Too Large')
    err.statusCode = 413
    throw err
  }
  return Buffer.concat(chunks)
}

class RoomProtocolError extends Error {
  constructor(statusCode, code) {
    super(code)
    this.name = 'RoomProtocolError'
    this.statusCode = statusCode
    this.code = code
  }
}

function lobbyRoot(ctx) {
  return ctx.lobbyRoot ?? path.join(path.dirname(ctx.stateRoot), 'lobby')
}

function quarantineRoot(ctx) {
  return ctx.quarantineRoot ?? path.join(path.dirname(ctx.stateRoot), 'quarantine')
}

function snapshotRoot(ctx) {
  return ctx.snapshotRoot ?? path.join(path.dirname(ctx.stateRoot), 'snapshots')
}

function plainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function validActiveEffectInstance(effect) {
  if (!plainObject(effect) || effect.schemaVersion !== 1) return false
  if (typeof effect.id !== 'string' || !effect.id || typeof effect.definitionId !== 'string') return false
  if (typeof effect.label !== 'string' || typeof effect.stackingKey !== 'string') return false
  if (!['condition', 'mark', 'buff', 'debuff', 'custom'].includes(effect.kind)) return false
  if (!['reject', 'refresh-duration', 'replace', 'keep-strongest', 'stack'].includes(effect.stackingPolicy)) return false
  if (!plainObject(effect.source) || !['dm', 'spell', 'feature', 'item', 'monster', 'plugin', 'system', 'legacy'].includes(effect.source.kind)) return false
  if (!plainObject(effect.duration)) return false
  if (effect.duration.type === 'rounds' && (!Number.isInteger(effect.duration.remainingRounds) || effect.duration.remainingRounds <= 0)) return false
  if (effect.duration.type === 'until-turn-boundary' && !['source-turn-start', 'source-turn-end', 'target-turn-start', 'target-turn-end'].includes(effect.duration.boundary)) return false
  if (effect.duration.type === 'concentration' && typeof effect.duration.sourceActorId !== 'string') return false
  if (!['permanent', 'rounds', 'until-turn-boundary', 'concentration'].includes(effect.duration.type)) return false
  if (effect.repeatSave != null && (
    !plainObject(effect.repeatSave) || !['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(effect.repeatSave.ability) ||
    !Number.isInteger(effect.repeatSave.dc) || effect.repeatSave.dc <= 0 ||
    !['target-turn-start', 'target-turn-end'].includes(effect.repeatSave.timing) || effect.repeatSave.onSuccess !== 'remove'
  )) return false
  if (effect.breakOn != null && (!Array.isArray(effect.breakOn) || effect.breakOn.some((trigger) =>
    !['takes-damage', 'targeted-by-attack', 'hit-by-attack', 'makes-attack', 'casts-spell', 'moves'].includes(trigger)
  ))) return false
  if (effect.modifiers != null && (
    !plainObject(effect.modifiers) ||
    (effect.modifiers.speedPenaltyFeet != null && (!Number.isFinite(effect.modifiers.speedPenaltyFeet) || effect.modifiers.speedPenaltyFeet < 0)) ||
    (effect.modifiers.preventReactions != null && typeof effect.modifiers.preventReactions !== 'boolean')
  )) return false
  return true
}

function validateActiveEffectState(state, projectedConditions) {
  if (!plainObject(state)) return null
  if (state.activeEffects != null) {
    if (!Array.isArray(state.activeEffects)) return 'active-effects-not-array'
    const ids = new Set()
    for (const effect of state.activeEffects) {
      if (!validActiveEffectInstance(effect) || ids.has(effect.id)) return 'invalid-active-effect'
      ids.add(effect.id)
    }
  }
  if (state.schemaVersion !== 2) return null
  if (state.timedEffects != null) return 'legacy-timed-effects-in-v2'
  const projection = []
  const conditionKeys = new Set()
  for (const effect of state.activeEffects ?? []) {
    const condition = typeof effect.legacyCondition === 'string'
      ? effect.legacyCondition
      : typeof effect.standardCondition === 'string' ? effect.standardCondition : undefined
    if (!condition) continue
    const key = typeof effect.standardCondition === 'string'
      ? `standard:${effect.standardCondition}`
      : `extension:${condition}`
    if (conditionKeys.has(key)) continue
    conditionKeys.add(key)
    projection.push(condition)
  }
  if (!Array.isArray(projectedConditions) || JSON.stringify(projectedConditions) !== JSON.stringify(projection)) {
    return 'condition-projection-mismatch'
  }
  return null
}

function validTokenMovementAnimation(animation) {
  return plainObject(animation) && typeof animation.id === 'string' && !!animation.id && animation.id.length <= 200 &&
    Array.isArray(animation.points) && animation.points.length >= 2 && animation.points.length <= 128 &&
    animation.points.every((point) => plainObject(point) && Number.isFinite(point.x) && Number.isFinite(point.y) &&
      Math.abs(point.x) <= 1_000_000 && Math.abs(point.y) <= 1_000_000) &&
    Number.isFinite(animation.durationMs) && animation.durationMs >= 240 && animation.durationMs <= 3_000 &&
    Number.isFinite(animation.issuedAt) && animation.issuedAt >= 0
}

const ROOM_CHAT_MESSAGE_LIMIT = 500
const ROOM_HANDOUT_LIMIT = 100
const ROOM_JOURNAL_ENTRY_LIMIT = 200
const ROOM_SHARED_NOTE_LIMIT = 200

function boundedText(value, maxLength) {
  return String(value ?? '').trim().slice(0, maxLength)
}

export function parseRoomChatRollCommand(value) {
  const match = boundedText(value, 1_000).match(/^\/roll\s+(?:(\d{0,3})d)?(\d{1,4})(?:\s*([+-])\s*(\d{1,5}))?(?:\s+(.+))?$/i)
  if (!match) return null
  const count = match[1] ? Number(match[1]) : 1
  const sides = Number(match[2])
  const unsignedModifier = Number(match[4] ?? 0)
  const modifier = match[3] === '-' ? -unsignedModifier : unsignedModifier
  if (count < 1 || count > 100 || sides < 2 || sides > 1_000 || Math.abs(modifier) > 10_000) return null
  return {
    expression: `${count}d${sides}${modifier === 0 ? '' : modifier > 0 ? `+${modifier}` : modifier}`,
    count,
    sides,
    modifier,
    label: boundedText(match[5], 160) || undefined,
  }
}

function campaignScopedContext(ctx, roomId, campaignId, ownerAccountId) {
  const normalizedOwnerAccountId = normalizeAccountId(ownerAccountId)
  const normalizedCampaignId = normalizeCampaignId(campaignId)
  const storageKey = normalizedOwnerAccountId.length === 12
    ? `campaign-${normalizedOwnerAccountId}-${normalizedCampaignId}`
    : `campaign-${normalizedCampaignId}`
  const storage = scopedContext(ctx, storageKey)
  return { ...storage, roomId, campaignId }
}

/** 观战者不占玩家槽位，但仍是可恢复、可被 DM 移除的房间成员。 */
export function assignRoomSpectator(room, input, now = Date.now()) {
  if (room?.closedAt) return { ok: false, status: 409, error: 'room-closed' }
  if (!roomHostIsOnline(room, now)) return { ok: false, status: 409, error: 'room-offline' }
  const members = Array.isArray(room?.players) ? room.players : []
  const resumedByAccount = input.accountId
    ? members
      .filter((member) => member.accountId === input.accountId)
      .sort((left, right) => Number(right.lastSeenAt ?? 0) - Number(left.lastSeenAt ?? 0))[0]
    : undefined
  const resumedByClient = members
    .filter((member) => member.clientId === input.clientId && (!input.accountId || !member.accountId || member.accountId === input.accountId))
    .sort((left, right) => Number(right.lastSeenAt ?? 0) - Number(left.lastSeenAt ?? 0))[0]
  const resumedByMember = members.find((member) => member.memberId === input.memberId)
  if (!resumedByAccount && !resumedByClient && resumedByMember && resumedByMember.clientId !== input.clientId) {
    return { ok: false, status: 409, error: 'invalid-resume-member' }
  }
  const resumed = resumedByAccount ?? resumedByClient ?? resumedByMember
  if (resumed && roomPlayerPresence(resumed, now) === 'removed') {
    return { ok: false, status: 403, error: 'member-removed' }
  }
  if (!resumed && room?.locked) return { ok: false, status: 409, error: 'room-locked' }
  const occupied = activeRoomSpectators(room, now)
    .filter((member) => member.memberId !== resumed?.memberId && member.clientId !== resumed?.clientId)
  if (occupied.length >= ROOM_SPECTATOR_LIMIT) return { ok: false, status: 409, error: 'spectator-full' }
  const member = {
    ...(resumed ?? {}),
    memberId: resumed?.memberId ?? input.memberId,
    ...(input.accountId ? { accountId: input.accountId } : {}),
    clientId: input.clientId,
    displayName: input.displayName,
    role: 'spectator',
    activePlugins: input.activePlugins ?? resumed?.activePlugins ?? [],
    joinedAt: resumed?.joinedAt ?? now,
    lastSeenAt: now,
    ...(input.roomTokenHash ? { roomTokenHash: input.roomTokenHash } : {}),
  }
  delete member.slot
  delete member.leftAt
  delete member.removedAt
  return {
    ok: true,
    member,
    next: {
      ...room,
      players: [
        ...members.filter((candidate) =>
          candidate.memberId !== member.memberId && candidate.clientId !== member.clientId),
        member,
      ],
      updatedAt: now,
    },
  }
}

function validMapTabletopPoint(value) {
  return plainObject(value) && Number.isFinite(value.x) && Number.isFinite(value.y) &&
    Math.abs(value.x) <= 1_000_000 && Math.abs(value.y) <= 1_000_000
}

/** Validate and author ephemeral tabletop events at the room authority boundary. */
export function normalizeMapTabletopEvent(payload, actor, now = Date.now()) {
  const role = actor?.role === 'dm' || actor?.role === 'player' ? actor.role : null
  if (!role) return { ok: false, status: 403, error: 'forbidden' }
  const type = payload?.type
  const mapId = normalizedLabel(payload?.mapId, 160)
  if (!mapId) return { ok: false, status: 400, error: 'invalid-map-tabletop-event' }
  const common = {
    id: randomUUID(),
    type,
    mapId,
    memberId: normalizedLabel(actor?.memberId, 160) || 'local-dm',
    memberName: normalizedLabel(actor?.displayName, 80) || (role === 'dm' ? 'DM' : '玩家'),
    role,
    createdAt: now,
  }
  if (type === 'ping') {
    if (!validMapTabletopPoint(payload?.point)) return { ok: false, status: 400, error: 'invalid-map-tabletop-event' }
    return { ok: true, event: { ...common, point: { x: payload.point.x, y: payload.point.y }, expiresAt: now + MAP_PING_LIFETIME_MS } }
  }
  if (role !== 'dm') return { ok: false, status: 403, error: 'forbidden' }
  if (type === 'focus') {
    if (!validMapTabletopPoint(payload?.point) ||
      (payload?.scale != null && (!Number.isFinite(payload.scale) || payload.scale < 0.1 || payload.scale > 4))) {
      return { ok: false, status: 400, error: 'invalid-map-tabletop-event' }
    }
    return {
      ok: true,
      event: {
        ...common,
        point: { x: payload.point.x, y: payload.point.y },
        ...(payload.scale == null ? {} : { scale: payload.scale }),
        expiresAt: now + 15_000,
      },
    }
  }
  if (type === 'clear-annotations') {
    return { ok: true, event: { ...common, expiresAt: now + 15_000 } }
  }
  if (type === 'annotation') {
    if (
      !['arrow', 'circle'].includes(payload?.shape) ||
      !validMapTabletopPoint(payload?.from) || !validMapTabletopPoint(payload?.to) ||
      (payload?.color != null && (typeof payload.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(payload.color)))
    ) return { ok: false, status: 400, error: 'invalid-map-tabletop-event' }
    return {
      ok: true,
      event: {
        ...common,
        shape: payload.shape,
        from: { x: payload.from.x, y: payload.from.y },
        to: { x: payload.to.x, y: payload.to.y },
        color: payload.color ?? '#fbbf24',
        expiresAt: now + MAP_ANNOTATION_LIFETIME_MS,
      },
    }
  }
  return { ok: false, status: 400, error: 'invalid-map-tabletop-event' }
}

/** Author transient combat visuals without allowing them to mutate combat state. */
export function normalizeCombatPresentationEvent(payload, actor, now = Date.now()) {
  if (actor?.role !== 'dm') return { ok: false, status: 403, error: 'forbidden' }
  const common = {
    schemaVersion: payload?.schemaVersion,
    id: normalizedLabel(payload?.id, 200),
    type: payload?.type,
    mapId: normalizedLabel(payload?.mapId, 160),
    transactionId: normalizedLabel(payload?.transactionId, 200),
    spellId: normalizedLabel(payload?.spellId, 80),
    sourceTokenId: normalizedLabel(payload?.sourceTokenId, 160),
  }
  if (
    common.schemaVersion !== 1 || !common.id || !common.mapId ||
    !common.transactionId || !common.sourceTokenId
  ) return { ok: false, status: 400, error: 'invalid-combat-presentation-event' }

  if (
    common.type === 'spell-projectile' &&
    [
      'fire-bolt',
      'ray-of-frost',
      'eldritch-blast',
      'produce-flame',
      'acid-splash',
      'poison-spray',
      'vicious-mockery',
      'magic-missile',
      'scorching-ray',
      'guiding-bolt',
      'acid-arrow',
      'healing-word',
      'inflict-wounds',
    ].includes(common.spellId)
  ) {
    const targetTokenId = normalizedLabel(payload?.targetTokenId, 160)
    const outcome = payload?.outcome
    const accentColor = payload?.accentColor
    const glowColor = payload?.glowColor
    if (
      !targetTokenId ||
      (outcome != null && outcome !== 'hit' && outcome !== 'miss') ||
      (accentColor != null && (typeof accentColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(accentColor))) ||
      (glowColor != null && (typeof glowColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(glowColor)))
    ) {
      return { ok: false, status: 400, error: 'invalid-combat-presentation-event' }
    }
    return {
      ok: true,
      event: {
        ...common,
        targetTokenId,
        ...(outcome ? { outcome } : {}),
        ...(accentColor ? { accentColor } : {}),
        ...(glowColor ? { glowColor } : {}),
        createdAt: now,
        expiresAt: now + COMBAT_PRESENTATION_LIFETIME_MS,
      },
    }
  }

  if (
    common.type === 'spell-target-effect' &&
    [
      'shocking-grasp',
      'guidance',
      'resistance',
      'sanctuary',
      'spare-the-dying',
      'cure-wounds',
      'hellish-rebuke',
      'bless',
      'bane',
      'shield-of-faith',
      'mage-armor',
      'jump',
      'darkvision',
      'see-invisibility',
      'warding-bond',
      'fly',
      'heroism',
      'enlarge-reduce',
      'enhance-ability',
      'divine-favor',
      'hunters-mark',
      'magic-weapon',
      'flame-blade',
      'invisibility',
      'blur',
      'barkskin',
      'protection-from-poison',
      'longstrider',
      'protection-from-energy',
      'death-ward',
      'greater-invisibility',
      'charm-person',
      'hideous-laughter',
      'hold-person',
      'blindness-deafness',
    ].includes(common.spellId)
  ) {
    const targetTokenId = normalizedLabel(payload?.targetTokenId, 160)
    const accentColor = payload?.accentColor
    const glowColor = payload?.glowColor
    if (
      !targetTokenId ||
      ['resistance', 'spare-the-dying'].includes(common.spellId) && (
        typeof accentColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(accentColor) ||
        typeof glowColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(glowColor)
      ) ||
      (accentColor != null && (typeof accentColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(accentColor))) ||
      (glowColor != null && (typeof glowColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(glowColor)))
    ) return { ok: false, status: 400, error: 'invalid-combat-presentation-event' }
    return {
      ok: true,
      event: {
        ...common,
        targetTokenId,
        ...(accentColor ? { accentColor } : {}),
        ...(glowColor ? { glowColor } : {}),
        createdAt: now,
        expiresAt: now + COMBAT_PRESENTATION_LIFETIME_MS,
      },
    }
  }

  if (common.type === 'spell-persistent-target-effect' && common.spellId === 'chill-touch') {
    const targetTokenId = normalizedLabel(payload?.targetTokenId, 160)
    if (!targetTokenId) {
      return { ok: false, status: 400, error: 'invalid-combat-presentation-event' }
    }
    return {
      ok: true,
      event: {
        ...common,
        targetTokenId,
        createdAt: now,
        expiresAt: now + COMBAT_PRESENTATION_LIFETIME_MS,
      },
    }
  }

  if (common.type === 'spell-save-target-effect' && common.spellId === 'sacred-flame') {
    const targetTokenId = normalizedLabel(payload?.targetTokenId, 160)
    const outcome = payload?.outcome
    if (
      !targetTokenId ||
      (outcome != null && outcome !== 'failed-save' && outcome !== 'successful-save')
    ) return { ok: false, status: 400, error: 'invalid-combat-presentation-event' }
    return {
      ok: true,
      event: {
        ...common,
        targetTokenId,
        ...(outcome ? { outcome } : {}),
        createdAt: now,
        expiresAt: now + COMBAT_PRESENTATION_LIFETIME_MS,
      },
    }
  }

  if (common.type === 'spell-banner') {
    const casterName = normalizedLabel(payload?.casterName, 80)
    const spellName = normalizedLabel(payload?.spellName, 80)
    const castingClassId = normalizedLabel(payload?.castingClassId, 40)
    if (!casterName || !spellName || !castingClassId) {
      return { ok: false, status: 400, error: 'invalid-combat-presentation-event' }
    }
    return {
      ok: true,
      event: {
        ...common,
        casterName,
        spellName,
        castingClassId,
        createdAt: now,
        expiresAt: now + SPELL_BANNER_PRESENTATION_LIFETIME_MS,
      },
    }
  }

  if (common.type === 'attack-banner') {
    const actorName = normalizedLabel(payload?.actorName, 80)
    const attackName = normalizedLabel(payload?.attackName, 80)
    const attackKind = payload?.attackKind
    const classId = normalizedLabel(payload?.classId, 40)
    if (
      !actorName ||
      !attackName ||
      (attackKind !== 'melee' && attackKind !== 'ranged') ||
      !classId
    ) return { ok: false, status: 400, error: 'invalid-combat-presentation-event' }
    const { spellId: _unusedSpellId, ...attackCommon } = common
    return {
      ok: true,
      event: {
        ...attackCommon,
        actorName,
        attackName,
        attackKind,
        classId,
        createdAt: now,
        expiresAt: now + SPELL_BANNER_PRESENTATION_LIFETIME_MS,
      },
    }
  }

  if (common.type === 'spell-area-projectile' && common.spellId === 'fireball') {
    const col = payload?.targetCell?.col
    const row = payload?.targetCell?.row
    const radiusFeet = payload?.radiusFeet
    const casterName = normalizedLabel(payload?.casterName, 80)
    const spellName = normalizedLabel(payload?.spellName, 80)
    const castingClassId = normalizedLabel(payload?.castingClassId, 40)
    if (
      !casterName || !spellName || !castingClassId ||
      !Number.isInteger(col) || col < 0 || col > 10_000 ||
      !Number.isInteger(row) || row < 0 || row > 10_000 ||
      !Number.isFinite(radiusFeet) || radiusFeet <= 0 || radiusFeet > 200
    ) return { ok: false, status: 400, error: 'invalid-combat-presentation-event' }
    return {
      ok: true,
      event: {
        ...common,
        casterName,
        spellName,
        castingClassId,
        targetCell: { col, row },
        radiusFeet,
        createdAt: now,
        animationStartsAt: now + FIREBALL_ANIMATION_START_DELAY_MS,
        expiresAt: now + FIREBALL_PRESENTATION_LIFETIME_MS,
      },
    }
  }

  if (
    common.type === 'spell-area-effect' &&
    ['burning-hands', 'thunderwave', 'shatter', 'lightning-bolt'].includes(common.spellId)
  ) {
    const expected = {
      'burning-hands': { shape: 'cone', lengthFeet: 15, widthFeet: 15 },
      thunderwave: { shape: 'line', lengthFeet: 15, widthFeet: 15 },
      shatter: { shape: 'circle', radiusFeet: 10 },
      'lightning-bolt': { shape: 'line', lengthFeet: 100, widthFeet: 5 },
    }[common.spellId]
    const col = payload?.targetCell?.col
    const row = payload?.targetCell?.row
    if (
      !expected ||
      payload?.shape !== expected.shape ||
      payload?.lengthFeet !== expected.lengthFeet ||
      payload?.widthFeet !== expected.widthFeet ||
      payload?.radiusFeet !== expected.radiusFeet ||
      !Number.isInteger(col) || col < 0 || col > 10_000 ||
      !Number.isInteger(row) || row < 0 || row > 10_000
    ) return { ok: false, status: 400, error: 'invalid-combat-presentation-event' }
    return {
      ok: true,
      event: {
        ...common,
        targetCell: { col, row },
        shape: expected.shape,
        ...(expected.lengthFeet != null ? { lengthFeet: expected.lengthFeet } : {}),
        ...(expected.widthFeet != null ? { widthFeet: expected.widthFeet } : {}),
        ...(expected.radiusFeet != null ? { radiusFeet: expected.radiusFeet } : {}),
        createdAt: now,
        expiresAt: now + COMBAT_PRESENTATION_LIFETIME_MS,
      },
    }
  }

  if (common.type === 'saving-throw-status') {
    const targetTokenId = normalizedLabel(payload?.targetTokenId, 160)
    const targetName = normalizedLabel(payload?.targetName, 80)
    const phase = payload?.phase
    const dc = payload?.dc
    const total = payload?.total
    const success = payload?.success
    if (
      !targetTokenId ||
      !targetName ||
      !['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(payload?.ability) ||
      (phase !== 'rolling' && phase !== 'result') ||
      !Number.isInteger(dc) ||
      dc < 0 ||
      dc > 100 ||
      (phase === 'rolling' && (total != null || success != null)) ||
      (phase === 'result' && (
        !Number.isInteger(total) ||
        total < -100 ||
        total > 200 ||
        typeof success !== 'boolean'
      ))
    ) return { ok: false, status: 400, error: 'invalid-combat-presentation-event' }
    const { spellId: _unusedSpellId, ...savingThrowCommon } = common
    return {
      ok: true,
      event: {
        ...savingThrowCommon,
        targetTokenId,
        targetName,
        ability: payload.ability,
        phase,
        dc,
        ...(phase === 'result' ? { total, success } : {}),
        createdAt: now,
        expiresAt: now + (
          phase === 'rolling'
            ? SAVING_THROW_PENDING_LIFETIME_MS
            : SAVING_THROW_RESULT_LIFETIME_MS
        ),
      },
    }
  }

  if (common.type === 'kill-streak') {
    const actorName = normalizedLabel(payload?.actorName, 80)
    const classId = normalizedLabel(payload?.classId, 40)
    const style = payload?.style
    if (
      !actorName || !classId ||
      (style !== 'arcane' && style !== 'martial') ||
      payload?.killCount !== 3
    ) return { ok: false, status: 400, error: 'invalid-combat-presentation-event' }
    const { spellId: _unusedSpellId, ...killStreakCommon } = common
    return {
      ok: true,
      event: {
        ...killStreakCommon,
        actorName,
        classId,
        style,
        killCount: 3,
        createdAt: now,
        bannerStartsAt: now + KILL_STREAK_BANNER_START_DELAY_MS,
        expiresAt: now + KILL_STREAK_PRESENTATION_LIFETIME_MS,
      },
    }
  }

  return {
    ok: false,
    status: 400,
    error: 'invalid-combat-presentation-event',
  }
}

function communicationPersona(member, context, npcTokenId) {
  if (member?.role === 'dm' || member?.memberId === context?.host?.memberId) {
    if (npcTokenId) {
      const maps = Array.isArray(context?.maps?.maps) ? context.maps.maps : []
      const token = maps.flatMap((map) => Array.isArray(map?.tokens) ? map.tokens : [])
        .find((entry) => entry?.id === npcTokenId && (entry?.type === 'npc' || entry?.type === 'enemy'))
      if (!token) return null
      return {
        kind: 'npc',
        name: boundedText(token.label, 80) || 'NPC',
        avatar: boundedText(token.emoji, 12) || '🎭',
        sourceId: token.id,
      }
    }
    return { kind: 'dm', name: boundedText(member?.displayName, 80) || 'DM', avatar: '🎲' }
  }
  const characterId = boundedText(member?.activeCharacterId, 160)
  const characters = Array.isArray(context?.characters?.characters) ? context.characters.characters : []
  const character = characters.find((entry) =>
    entry?.id === characterId && (
      entry?.roomMemberId === member?.memberId ||
      (!entry?.roomMemberId && boundedText(entry?.name, 80) === boundedText(member?.activeCharacterName, 80))
    ))
  if (character) {
    return {
      kind: 'character',
      name: boundedText(character.name, 80) || boundedText(member?.displayName, 80),
      avatar: boundedText(character.avatar, 12) || '🧙',
      sourceId: character.id,
    }
  }
  return { kind: 'player', name: boundedText(member?.displayName, 80) || '玩家', avatar: '👤' }
}

export function projectRoomChatForMember(value, memberId, isDm = false) {
  const messages = Array.isArray(value?.messages) ? value.messages : []
  return {
    schemaVersion: 1,
    messages: messages.filter((message) =>
      message?.channel !== 'dm-private' || isDm ||
      message?.senderMemberId === memberId || message?.recipientMemberId === memberId),
    updatedAt: Number(value?.updatedAt) || 0,
    ...(plainObject(value?._sync) ? { _sync: value._sync } : {}),
  }
}

export function mutateRoomChatState(current, mutation, now, member, context = {}) {
  const channel = mutation?.channel
  if (channel !== 'ic' && channel !== 'ooc' && channel !== 'dm-private') {
    return { ok: false, status: 400, error: 'invalid-chat-channel' }
  }
  const rawText = boundedText(mutation?.text, 1_000)
  if (!rawText) return { ok: false, status: 400, error: 'empty-message' }
  const isDm = member?.memberId === context.host?.memberId || member?.role === 'dm'
  let recipientMemberId
  if (channel === 'dm-private') {
    if (isDm) {
      recipientMemberId = boundedText(mutation?.recipientMemberId, 160)
      if (!context.playerMemberIds?.includes(recipientMemberId)) {
        return { ok: false, status: 400, error: 'invalid-private-recipient' }
      }
    } else {
      recipientMemberId = boundedText(context.host?.memberId, 160)
      if (!recipientMemberId) return { ok: false, status: 409, error: 'dm-unavailable' }
    }
  }
  const npcTokenId = isDm ? boundedText(mutation?.npcTokenId, 160) : ''
  const persona = communicationPersona(member, context, npcTokenId)
  if (!persona) return { ok: false, status: 400, error: 'invalid-npc-persona' }
  const rollCommand = parseRoomChatRollCommand(rawText)
  if (/^\/roll\b/i.test(rawText) && !rollCommand) {
    return { ok: false, status: 400, error: 'invalid-roll-command' }
  }
  const roll = rollCommand ? {
    ...rollCommand,
    values: Array.from({ length: rollCommand.count }, () =>
      (context.rollDie ?? ((sides) => randomInt(1, sides + 1)))(rollCommand.sides)),
  } : undefined
  if (roll) roll.total = roll.values.reduce((sum, value) => sum + value, roll.modifier)
  const message = {
    id: `chat-${randomUUID()}`,
    channel,
    createdAt: now,
    senderMemberId: boundedText(member?.memberId, 160),
    senderRole: isDm ? 'dm' : 'player',
    senderDisplayName: boundedText(member?.displayName, 80) || (isDm ? 'DM' : '玩家'),
    ...(recipientMemberId ? { recipientMemberId } : {}),
    persona,
    text: roll ? (roll.label || '掷骰') : rawText,
    ...(roll ? { roll } : {}),
  }
  const baseMessages = Array.isArray(current?.messages) ? current.messages : []
  const next = {
    schemaVersion: 1,
    messages: [...baseMessages, message].slice(-ROOM_CHAT_MESSAGE_LIMIT),
    updatedAt: now,
  }
  return { ok: true, changed: true, next, message }
}

export function projectRoomJournalForMember(value, memberId, isDm = false) {
  const handouts = Array.isArray(value?.handouts) ? value.handouts : []
  const visibleHandouts = handouts.filter((handout) =>
    isDm || handout?.audience === 'all' ||
    (Array.isArray(handout?.audience) && handout.audience.includes(memberId)))
  const sharedNotes = Array.isArray(value?.sharedNotes) ? value.sharedNotes : []
  const stripAuthorityReceipt = (entry) => {
    const projected = { ...entry }
    delete projected.authorityReceiptId
    return projected
  }
  return {
    schemaVersion: 1,
    handouts: isDm
      ? visibleHandouts
      : visibleHandouts.map(stripAuthorityReceipt),
    campaignEntries: Array.isArray(value?.campaignEntries) ? value.campaignEntries : [],
    sharedNotes: isDm
      ? sharedNotes
      : sharedNotes.map(stripAuthorityReceipt),
    authorityMutationReceipts: isDm && Array.isArray(value?.authorityMutationReceipts)
      ? value.authorityMutationReceipts
      : [],
    updatedAt: Number(value?.updatedAt) || 0,
    ...(plainObject(value?._sync) ? { _sync: value._sync } : {}),
  }
}

function characterOwnedByRoomMember(character, member) {
  return character?.roomMemberId === member?.memberId || (
    typeof member?.accountId === 'string' && member.accountId && character?.ownerAccountId === member.accountId
  )
}

function projectUnidentifiedInventoryForPlayer(inventory) {
  if (!plainObject(inventory) || !Array.isArray(inventory.entries)) return inventory
  return {
    ...inventory,
    entries: inventory.entries.map((entry) => {
      if (!plainObject(entry) || entry.identified !== false) return entry
      const instanceId = typeof entry.instanceId === 'string' ? entry.instanceId : 'unknown'
      return {
        instanceId,
        templateId: `unidentified:${instanceId}`,
        item: {
          id: `unidentified:${instanceId}`,
          name: '未鉴定物品',
          category: 'magic-item',
          icon: 'generic',
          description: '该物品尚未鉴定。',
          rulesText: '鉴定完成后才会公开其名称与规则效果。',
          stackable: false,
          source: { book: 'SRD 5.1', license: 'CC BY 4.0' },
        },
        quantity: Number.isSafeInteger(entry.quantity) && entry.quantity > 0 ? entry.quantity : 1,
        identified: false,
        ...(typeof entry.containerInstanceId === 'string'
          ? { containerInstanceId: entry.containerInstanceId }
          : {}),
        acquiredAt: Number.isFinite(entry.acquiredAt) ? entry.acquiredAt : 0,
      }
    }),
  }
}

export function projectCharactersForRoomMember(value, member) {
  const characters = Array.isArray(value?.characters) ? value.characters : []
  return {
    ...value,
    characters: characters
      .filter((character) => characterOwnedByRoomMember(character, member) || character?.visibleToPlayers !== false)
      .map((character) => {
        const projected = { ...character }
        delete projected.dmNotes
        if (characterOwnedByRoomMember(character, member)) {
          projected.dnd5eInventory = projectUnidentifiedInventoryForPlayer(projected.dnd5eInventory)
        } else {
          delete projected.notes
          delete projected.backstory
          delete projected.dnd5eInventory
          delete projected.equipment
          delete projected.classResources
          delete projected.dnd5eAbilityGeneration
          delete projected.dnd5eCreationRecommendation
        }
        return projected
      }),
  }
}

export function projectDiceForRoomMember(value) {
  return value?.visibility === 'dm' ? null : value
}

export function projectDiceEventsForRoomMember(value) {
  return {
    ...value,
    events: (Array.isArray(value?.events) ? value.events : []).filter((event) => event?.visibility !== 'dm'),
  }
}

export function projectCombatInterruptsForRoomMember(value, member, characterState, spectator = false) {
  const characters = Array.isArray(characterState?.characters) ? characterState.characters : []
  const ownedCharacterIds = new Set(characters
    .filter((character) => characterOwnedByRoomMember(character, member))
    .map((character) => character.id))
  const visible = (Array.isArray(value?.interrupts) ? value.interrupts : []).filter((interrupt) => {
    if (spectator || !plainObject(interrupt)) return false
    if (interrupt.kind === 'dm-adjudication' || interrupt.kind === 'legendary-resistance') return false
    if (interrupt.kind === 'plugin-choice') {
      if (interrupt.payload?.audience === 'dm') return false
      const audienceCharacterId = interrupt.payload?.audience === 'target'
        ? interrupt.targetCharId
        : interrupt.actorCharId
      return ownedCharacterIds.has(audienceCharacterId)
    }
    if (interrupt.kind === 'roll-confirmation') return interrupt.payload?.visibility === 'public'
    return ownedCharacterIds.has(interrupt.actorCharId) || ownedCharacterIds.has(interrupt.targetCharId)
  })
  return { ...value, interrupts: visible }
}

function projectPlayerActionResourceForRoomMember(name, value, member) {
  if (name === 'player-action' || name === 'player-action-processed') return null
  if (name === 'player-action-requests') return { ...value, requests: [] }
  if (name === 'player-action-ack') {
    return value?.recipientMemberId === member?.memberId ? value : null
  }
  return value
}

function stampPlayerActionStateForRoomMember(name, value, member) {
  if (!member?.memberId || !plainObject(value)) return value
  const stamp = (action) => plainObject(action)
    ? { ...action, sourceMode: 'player', roomMemberId: member.memberId }
    : action
  if (name === 'player-action') return stamp(value)
  if (name === 'player-action-requests') {
    return { ...value, requests: (Array.isArray(value.requests) ? value.requests : []).map(stamp) }
  }
  return value
}

export function projectCustomMonstersForRoomMember(value) {
  return { ...value, monsters: [] }
}

export function mutateRoomJournalState(current, mutation, now, member, context = {}) {
  const isDm = member?.memberId === context.host?.memberId || member?.role === 'dm'
  const base = {
    schemaVersion: 1,
    handouts: Array.isArray(current?.handouts) ? current.handouts : [],
    campaignEntries: Array.isArray(current?.campaignEntries) ? current.campaignEntries : [],
    sharedNotes: Array.isArray(current?.sharedNotes) ? current.sharedNotes : [],
    authorityMutationReceipts: Array.isArray(current?.authorityMutationReceipts)
      ? current.authorityMutationReceipts.map((entry) => boundedText(entry, 300)).filter(Boolean).slice(-512)
      : [],
    updatedAt: now,
  }
  const authorMemberId = boundedText(member?.memberId, 160)
  const authorName = boundedText(member?.displayName, 80) || (isDm ? 'DM' : '玩家')
  const operation = mutation?.operation
  if (operation === 'add-handout') {
    if (!isDm) return { ok: false, status: 403, error: 'dm-only' }
    const authorityReceiptId = boundedText(mutation?.authorityReceiptId, 300)
    if (
      authorityReceiptId &&
      (
        base.authorityMutationReceipts.includes(authorityReceiptId) ||
        base.handouts.some((entry) => entry?.authorityReceiptId === authorityReceiptId)
      )
    ) {
      return { ok: true, changed: false, next: current ?? base }
    }
    const title = boundedText(mutation?.title, 120)
    const body = boundedText(mutation?.body, 20_000)
    const imageId = boundedText(mutation?.imageId, 160)
    if (!title || (!body && !imageId)) return { ok: false, status: 400, error: 'invalid-handout' }
    let audience = mutation?.audience
    if (audience !== 'all' && audience !== 'dm') {
      if (!Array.isArray(audience)) return { ok: false, status: 400, error: 'invalid-audience' }
      audience = [...new Set(audience.map((entry) => boundedText(entry, 160)).filter(Boolean))]
      if (audience.length < 1 || audience.some((id) => !context.playerMemberIds?.includes(id))) {
        return { ok: false, status: 400, error: 'invalid-audience' }
      }
    }
    const handout = {
      id: `handout-${randomUUID()}`,
      title,
      body,
      ...(imageId ? {
        imageId,
        imageMimeType: boundedText(mutation?.imageMimeType, 120) || 'application/octet-stream',
        imageName: boundedText(mutation?.imageName, 240) || '讲义图片',
      } : {}),
      audience,
      authorMemberId,
      authorName,
      createdAt: now,
      updatedAt: now,
      ...(authorityReceiptId ? { authorityReceiptId } : {}),
    }
    return {
      ok: true,
      changed: true,
      next: {
        ...base,
        handouts: [...base.handouts, handout].slice(-ROOM_HANDOUT_LIMIT),
        authorityMutationReceipts: authorityReceiptId
          ? [...base.authorityMutationReceipts, authorityReceiptId].slice(-512)
          : base.authorityMutationReceipts,
      },
    }
  }
  if (operation === 'remove-handout') {
    if (!isDm) return { ok: false, status: 403, error: 'dm-only' }
    const id = boundedText(mutation?.id, 120)
    if (!base.handouts.some((entry) => entry?.id === id)) return { ok: false, status: 404, error: 'handout-not-found' }
    return { ok: true, changed: true, next: { ...base, handouts: base.handouts.filter((entry) => entry?.id !== id) } }
  }
  if (operation === 'add-campaign-entry') {
    if (!isDm) return { ok: false, status: 403, error: 'dm-only' }
    const title = boundedText(mutation?.title, 120)
    const body = boundedText(mutation?.body, 40_000)
    if (!title || !body) return { ok: false, status: 400, error: 'invalid-campaign-entry' }
    const entry = {
      id: `journal-${randomUUID()}`,
      title,
      body,
      source: mutation?.source === 'combat-summary' ? 'combat-summary' : 'dm',
      ...(boundedText(mutation?.combatId, 160) ? { combatId: boundedText(mutation.combatId, 160) } : {}),
      authorMemberId,
      authorName,
      createdAt: now,
      updatedAt: now,
    }
    return { ok: true, changed: true, next: { ...base, campaignEntries: [...base.campaignEntries, entry].slice(-ROOM_JOURNAL_ENTRY_LIMIT) } }
  }
  if (operation === 'remove-campaign-entry') {
    if (!isDm) return { ok: false, status: 403, error: 'dm-only' }
    const id = boundedText(mutation?.id, 120)
    if (!base.campaignEntries.some((entry) => entry?.id === id)) return { ok: false, status: 404, error: 'journal-entry-not-found' }
    return { ok: true, changed: true, next: { ...base, campaignEntries: base.campaignEntries.filter((entry) => entry?.id !== id) } }
  }
  if (operation === 'add-shared-note') {
    const authorityReceiptId = boundedText(mutation?.authorityReceiptId, 300)
    if (authorityReceiptId && !isDm) return { ok: false, status: 403, error: 'dm-only' }
    if (
      authorityReceiptId &&
      (
        base.authorityMutationReceipts.includes(authorityReceiptId) ||
        base.sharedNotes.some((entry) => entry?.authorityReceiptId === authorityReceiptId)
      )
    ) {
      return { ok: true, changed: false, next: current ?? base }
    }
    const title = boundedText(mutation?.title, 120)
    if (!title) return { ok: false, status: 400, error: 'invalid-shared-note' }
    const note = {
      id: `note-${randomUUID()}`,
      kind: mutation?.kind === 'task' || mutation?.kind === 'clue' ? mutation.kind : 'note',
      status: 'open',
      title,
      body: boundedText(mutation?.body, 20_000),
      authorMemberId,
      authorName,
      lastEditorMemberId: authorMemberId,
      lastEditorName: authorName,
      createdAt: now,
      updatedAt: now,
      ...(authorityReceiptId ? { authorityReceiptId } : {}),
    }
    return {
      ok: true,
      changed: true,
      next: {
        ...base,
        sharedNotes: [...base.sharedNotes, note].slice(-ROOM_SHARED_NOTE_LIMIT),
        authorityMutationReceipts: authorityReceiptId
          ? [...base.authorityMutationReceipts, authorityReceiptId].slice(-512)
          : base.authorityMutationReceipts,
      },
    }
  }
  if (operation === 'update-shared-note') {
    const authorityReceiptId = boundedText(mutation?.authorityReceiptId, 300)
    if (authorityReceiptId && !isDm) return { ok: false, status: 403, error: 'dm-only' }
    if (
      authorityReceiptId &&
      (
        base.authorityMutationReceipts.includes(authorityReceiptId) ||
        base.sharedNotes.some((entry) => entry?.authorityReceiptId === authorityReceiptId)
      )
    ) {
      return { ok: true, changed: false, next: current ?? base }
    }
    const id = boundedText(mutation?.id, 120)
    const note = base.sharedNotes.find((entry) => entry?.id === id)
    if (!note) return { ok: false, status: 404, error: 'shared-note-not-found' }
    if (!isDm && note.authorMemberId !== authorMemberId) return { ok: false, status: 403, error: 'forbidden' }
    const title = mutation?.title == null ? note.title : boundedText(mutation.title, 120)
    if (!title) return { ok: false, status: 400, error: 'invalid-shared-note' }
    const updated = {
      ...note,
      title,
      body: mutation?.body == null ? note.body : boundedText(mutation.body, 20_000),
      kind: mutation?.kind === 'task' || mutation?.kind === 'clue' || mutation?.kind === 'note' ? mutation.kind : note.kind,
      status: mutation?.status === 'done' || mutation?.status === 'open' ? mutation.status : note.status,
      lastEditorMemberId: authorMemberId,
      lastEditorName: authorName,
      updatedAt: now,
      ...(authorityReceiptId ? { authorityReceiptId } : {}),
    }
    return {
      ok: true,
      changed: true,
      next: {
        ...base,
        sharedNotes: base.sharedNotes.map((entry) => entry?.id === id ? updated : entry),
        authorityMutationReceipts: authorityReceiptId
          ? [...base.authorityMutationReceipts, authorityReceiptId].slice(-512)
          : base.authorityMutationReceipts,
      },
    }
  }
  if (operation === 'remove-shared-note') {
    const id = boundedText(mutation?.id, 120)
    const note = base.sharedNotes.find((entry) => entry?.id === id)
    if (!note) return { ok: false, status: 404, error: 'shared-note-not-found' }
    if (!isDm && note.authorMemberId !== authorMemberId) return { ok: false, status: 403, error: 'forbidden' }
    return { ok: true, changed: true, next: { ...base, sharedNotes: base.sharedNotes.filter((entry) => entry?.id !== id) } }
  }
  return { ok: false, status: 400, error: 'invalid-journal-operation' }
}

const GROUP_ABILITY_CHECK_LIMIT = 40
const GROUP_ABILITY_CHECK_SKILLS = Object.freeze({
  acrobatics: 'dex', animalHandling: 'wis', arcana: 'int', athletics: 'str', deception: 'cha',
  history: 'int', insight: 'wis', intimidation: 'cha', investigation: 'int', medicine: 'wis',
  nature: 'int', perception: 'wis', performance: 'cha', persuasion: 'cha', religion: 'int',
  sleightOfHand: 'dex', stealth: 'dex', survival: 'wis',
})
const GROUP_ABILITY_KEYS = new Set(['str', 'dex', 'con', 'int', 'wis', 'cha'])
const CLASS_NAME_TO_ID = Object.freeze({
  barbarian: 'barbarian', '野蛮人': 'barbarian', bard: 'bard', '吟游诗人': 'bard',
  cleric: 'cleric', '牧师': 'cleric', druid: 'druid', '德鲁伊': 'druid',
  fighter: 'fighter', '战士': 'fighter', monk: 'monk', '武僧': 'monk',
  paladin: 'paladin', '圣武士': 'paladin', ranger: 'ranger', '游侠': 'ranger',
  rogue: 'rogue', '游荡者': 'rogue', sorcerer: 'sorcerer', '术士': 'sorcerer',
  warlock: 'warlock', '邪术师': 'warlock', wizard: 'wizard', '法师': 'wizard',
})

function groupCheckClassLevel(character, classId) {
  const explicit = Number(character?.dnd5eClassLevels?.[classId])
  if (Number.isFinite(explicit) && explicit > 0) return Math.min(20, Math.floor(explicit))
  const primary = CLASS_NAME_TO_ID[String(character?.charClass ?? '').trim().toLowerCase()] ??
    CLASS_NAME_TO_ID[String(character?.charClass ?? '').trim()]
  return primary === classId ? Math.min(20, Math.max(1, Math.floor(Number(character?.level) || 1))) : 0
}

function groupCheckProficiencyRank(character, skill) {
  if (!skill) return 0
  const choices = character?.dnd5eClassChoices?.classes ?? {}
  const bard = choices?.bard?.selections ?? {}
  const rogue = choices?.rogue?.selections ?? {}
  const warlock = choices?.warlock?.selections ?? {}
  const beguilingInfluence = groupCheckClassLevel(character, 'warlock') >= 2 &&
    (warlock['eldritch-invocations'] ?? []).includes('beguiling-influence') &&
    (skill === 'deception' || skill === 'persuasion')
  const proficient = (Array.isArray(character?.skills) && character.skills.includes(skill)) ||
    (groupCheckClassLevel(character, 'bard') >= 3 && (bard['lore-bonus-skills'] ?? []).includes(skill)) ||
    beguilingInfluence
  if (!proficient) return 0
  return [...(bard.expertise ?? []), ...(rogue.expertise ?? [])].includes(skill) ? 2 : 1
}

function groupCheckModifier(character, ability, skill, rollKind = 'ability-check') {
  const level = Math.min(20, Math.max(1, Math.floor(Number(character?.level) || 1)))
  const score = Math.min(30, Math.max(1, Math.floor(Number(character?.abilities?.[ability]) || 10)))
  const abilityModifier = Math.floor((score - 10) / 2)
  const proficiencyBonus = 2 + Math.floor((level - 1) / 4)
  if (rollKind === 'saving-throw') {
    const classLevels = character?.dnd5eClassLevels ?? {}
    const allSavingThrows = Number(classLevels.monk) >= 14
    const slipperyMind = ability === 'wis' && Number(classLevels.rogue) >= 15
    const proficient = allSavingThrows || slipperyMind || (Array.isArray(character?.savingThrows) && character.savingThrows.includes(ability))
    return { modifier: abilityModifier + (proficient ? proficiencyBonus : 0), rank: proficient ? 1 : 0, score }
  }
  const rank = groupCheckProficiencyRank(character, skill)
  if (rank > 0) return { modifier: abilityModifier + proficiencyBonus * rank, rank, score }
  const bardBonus = groupCheckClassLevel(character, 'bard') >= 2 ? Math.floor(proficiencyBonus / 2) : 0
  const championBonus = groupCheckClassLevel(character, 'fighter') >= 7 &&
    character?.dnd5eClassChoices?.fighter?.subclass === 'champion' && ['str', 'dex', 'con'].includes(ability)
    ? Math.ceil(proficiencyBonus / 2)
    : 0
  return { modifier: abilityModifier + Math.max(bardBonus, championBonus), rank: 0, score }
}

function groupCheckEffectiveMode(requestedMode, character, rollKind = 'ability-check') {
  const requestedAdvantage = requestedMode === 'advantage'
  const requestedDisadvantage = requestedMode === 'disadvantage'
  const exhaustionDisadvantage = Number(character?.exhaustionLevel) >= (rollKind === 'saving-throw' ? 3 : 1)
  const disadvantage = requestedDisadvantage || exhaustionDisadvantage
  if (requestedAdvantage && disadvantage) return 'normal'
  if (requestedAdvantage) return 'advantage'
  if (disadvantage) return 'disadvantage'
  return 'normal'
}

function groupCheckResult(character, check, now, options = {}) {
  const rollKind = check.rollKind === 'saving-throw' ? 'saving-throw' : 'ability-check'
  const { modifier, rank, score } = groupCheckModifier(character, check.ability, check.skill, rollKind)
  const mode = groupCheckEffectiveMode(check.requestedMode, character, rollKind)
  const passiveTotal = 10 + modifier + (mode === 'advantage' ? 5 : mode === 'disadvantage' ? -5 : 0)
  if (options.passiveOnly) {
    return {
      memberId: options.memberId,
      characterId: character.id,
      rolls: [], effectiveRolls: [], d20: 0, modifier,
      rolledTotal: passiveTotal, passiveTotal, finalTotal: passiveTotal,
      success: passiveTotal >= check.dc, mode, proficiencyRank: rank,
      reliableTalentApplied: false, indomitableMightApplied: false,
      source: 'passive-only', rolledAt: now,
    }
  }
  const rollDie = options.rollDie ?? (() => randomInt(1, 21))
  const rolls = Array.from({ length: mode === 'normal' ? 1 : 2 }, () => rollDie())
  const reliableTalent = rollKind === 'ability-check' && groupCheckClassLevel(character, 'rogue') >= 11 && rank > 0
  const effectiveRolls = reliableTalent ? rolls.map((roll) => Math.max(10, roll)) : [...rolls]
  const d20 = mode === 'advantage' ? Math.max(...effectiveRolls) : mode === 'disadvantage' ? Math.min(...effectiveRolls) : effectiveRolls[0]
  const rawTotal = d20 + modifier
  const indomitableMight = rollKind === 'ability-check' && groupCheckClassLevel(character, 'barbarian') >= 18 && check.ability === 'str' && rawTotal < score
  const rolledTotal = indomitableMight ? score : rawTotal
  const usePassive = check.allowPassiveFallback && passiveTotal > rolledTotal
  const finalTotal = usePassive ? passiveTotal : rolledTotal
  return {
    memberId: options.memberId,
    characterId: character.id,
    rolls,
    effectiveRolls,
    d20,
    modifier,
    rolledTotal,
    passiveTotal,
    finalTotal,
    success: finalTotal >= check.dc,
    mode,
    proficiencyRank: rank,
    reliableTalentApplied: reliableTalent && rolls.some((roll) => roll < 10),
    indomitableMightApplied: indomitableMight,
    source: usePassive ? 'roll-passive-fallback' : 'roll',
    rolledAt: now,
  }
}

function groupCheckAggregate(check) {
  const participantCount = check.participants.length
  const resolvedCount = check.results.length
  const successCount = check.results.filter((result) => result.success).length
  const requiredSuccesses = Math.ceil(participantCount / 2)
  return {
    participantCount,
    resolvedCount,
    successCount,
    failureCount: resolvedCount - successCount,
    requiredSuccesses,
    groupSuccess: resolvedCount === participantCount && successCount >= requiredSuccesses,
  }
}

function validateGroupAbilityCheckState(value) {
  if (value.schemaVersion !== 1 || !Array.isArray(value.checks) || value.checks.length > GROUP_ABILITY_CHECK_LIMIT) {
    return 'invalid-group-check-envelope'
  }
  const checkIds = new Set()
  for (const check of value.checks) {
    if (
      !plainObject(check) || typeof check.id !== 'string' || !check.id || checkIds.has(check.id) ||
      !['open', 'completed', 'cancelled'].includes(check.status) ||
      typeof check.label !== 'string' || !check.label.trim() || check.label.length > 160 ||
      !GROUP_ABILITY_KEYS.has(check.ability) ||
      !['ability-check', 'saving-throw'].includes(check.rollKind ?? 'ability-check') ||
      (check.rollKind === 'saving-throw' && check.skill != null) ||
      (check.skill != null && GROUP_ABILITY_CHECK_SKILLS[check.skill] !== check.ability) ||
      !Number.isInteger(check.dc) || check.dc < 0 || check.dc > 100 ||
      !['normal', 'advantage', 'disadvantage'].includes(check.requestedMode) ||
      typeof check.allowPassiveFallback !== 'boolean' ||
      !Array.isArray(check.participants) || check.participants.length < 1 || check.participants.length > 8 ||
      !Array.isArray(check.results) || check.results.length > check.participants.length ||
      !Number.isFinite(check.createdAt) || !Number.isFinite(check.expiresAt) || check.expiresAt < check.createdAt ||
      !Number.isFinite(check.updatedAt)
    ) return 'invalid-group-check'
    const participants = new Map()
    for (const participant of check.participants) {
      if (
        !plainObject(participant) || typeof participant.memberId !== 'string' || !participant.memberId || participants.has(participant.memberId) ||
        typeof participant.memberName !== 'string' || !participant.memberName ||
        typeof participant.characterId !== 'string' || !participant.characterId ||
        typeof participant.characterName !== 'string' || !participant.characterName ||
        typeof participant.avatar !== 'string'
      ) return 'invalid-group-check-participant'
      participants.set(participant.memberId, participant)
    }
    const resultMembers = new Set()
    for (const result of check.results) {
      const participant = participants.get(result?.memberId)
      const expectedRolls = result?.mode === 'normal' ? 1 : 2
      if (
        !plainObject(result) || !participant || participant.characterId !== result.characterId || resultMembers.has(result.memberId) ||
        !['normal', 'advantage', 'disadvantage'].includes(result.mode) ||
        !['roll', 'roll-passive-fallback', 'passive-only'].includes(result.source) ||
        !Array.isArray(result.rolls) || !Array.isArray(result.effectiveRolls) ||
        !result.rolls.every((roll) => Number.isInteger(roll) && roll >= 1 && roll <= 20) ||
        !result.effectiveRolls.every((roll) => Number.isInteger(roll) && roll >= 1 && roll <= 20) ||
        ![result.d20, result.modifier, result.rolledTotal, result.passiveTotal, result.finalTotal, result.rolledAt].every(Number.isFinite) ||
        ![0, 1, 2].includes(result.proficiencyRank) || typeof result.success !== 'boolean' ||
        typeof result.reliableTalentApplied !== 'boolean' || typeof result.indomitableMightApplied !== 'boolean' ||
        (result.source === 'passive-only'
          ? result.rolls.length !== 0 || result.effectiveRolls.length !== 0 || result.d20 !== 0
          : result.rolls.length !== expectedRolls || result.effectiveRolls.length !== expectedRolls)
      ) return 'invalid-group-check-result'
      resultMembers.add(result.memberId)
    }
    if (check.status === 'completed') {
      const expected = groupCheckAggregate(check)
      if (
        !plainObject(check.aggregate) || check.results.length !== check.participants.length ||
        Object.entries(expected).some(([key, expectedValue]) => check.aggregate[key] !== expectedValue)
      ) return 'invalid-group-check-aggregate'
    }
    checkIds.add(check.id)
  }
  return null
}

export function projectGroupAbilityChecksForMember(value, memberId, isDm = false) {
  const checks = Array.isArray(value?.checks) ? value.checks : []
  return {
    schemaVersion: 1,
    checks: isDm ? checks : checks.flatMap((check) => {
      const participant = (Array.isArray(check?.participants) ? check.participants : [])
        .find((entry) => entry?.memberId === memberId)
      if (!participant) return []
      return [{
        ...check,
        participants: [participant],
        results: (Array.isArray(check.results) ? check.results : []).filter((entry) => entry?.memberId === memberId),
        aggregate: check.status === 'completed' ? check.aggregate : undefined,
      }]
    }),
    updatedAt: Number(value?.updatedAt) || 0,
    ...(plainObject(value?._sync) ? { _sync: value._sync } : {}),
  }
}

/**
 * Hidden trigger geometry, encounter presets, checks, rewards, and queued DM actions never cross
 * to players. Explicitly public interaction points retain only the marker and prompt required for
 * the player to request a Host-authoritative interaction.
 */
export function projectSceneOrchestrationForPlayer(value) {
  return {
    schemaVersion: 1,
    scenes: (Array.isArray(value?.scenes) ? value.scenes : []).flatMap((scene) => {
      if (!plainObject(scene) || !validSceneId(scene.id) || !validSceneId(scene.mapId)) return []
      const interactionPoints = (Array.isArray(scene.interactionPoints) ? scene.interactionPoints : [])
        .filter((point) => plainObject(point) && point.enabled === true && point.visibleToPlayers === true)
        .map((point) => ({
          id: point.id,
          name: point.name,
          enabled: true,
          visibleToPlayers: true,
          icon: point.icon,
          x: point.x,
          y: point.y,
          interactionRadiusFeet: point.interactionRadiusFeet,
          prompt: point.prompt,
          repeat: point.repeat,
          successText: '',
          failureText: '',
          rewards: [],
          successEffects: [],
          failureEffects: [],
        }))
      if (interactionPoints.length < 1) return []
      return [{
        id: scene.id,
        mapId: scene.mapId,
        name: scene.name,
        description: '',
        environmentLabel: '',
        backgroundCue: 'none',
        backgroundAudioLoop: false,
        backgroundAudioVolume: 0,
        boundHandoutIds: [],
        boundJournalEntryIds: [],
        interactionPoints,
        triggers: [],
        createdAt: Number(scene.createdAt) || 0,
        updatedAt: Number(scene.updatedAt) || 0,
      }]
    }),
    runtime: { paused: false, pendingRuns: [], receipts: [], history: [] },
    updatedAt: Number.isFinite(value?.updatedAt) ? value.updatedAt : 0,
  }
}

const CAMPAIGN_TIME_DEFAULT_WORLD_MINUTE = 8 * 60
const CAMPAIGN_TIME_SCHEMA_VERSION = 2
const CAMPAIGN_TIME_TIMER_LIMIT = 256
const CAMPAIGN_TIME_ADVANCE_LIMIT = 512
const CAMPAIGN_TIME_MAX_ADVANCE_MINUTES = 365 * 24 * 60

function campaignDawnsCrossed(fromWorldMinute, toWorldMinute) {
  const from = Math.max(0, Math.floor(Number(fromWorldMinute) || 0))
  const to = Math.max(from, Math.floor(Number(toWorldMinute) || 0))
  return Math.max(0, Math.floor((to - 360) / 1_440) - Math.floor((from - 360) / 1_440))
}

function campaignGregorianDayNumber(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''))
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(0)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCFullYear(year, month - 1, day)
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return Math.floor(date.getTime() / 86_400_000)
}

function validateCampaignTimeState(value) {
  if (
    ![1, CAMPAIGN_TIME_SCHEMA_VERSION].includes(value?.schemaVersion) || !Number.isSafeInteger(value.worldMinute) || value.worldMinute < 0 ||
    !Array.isArray(value.timers) || value.timers.length > CAMPAIGN_TIME_TIMER_LIMIT ||
    !Array.isArray(value.advances) || value.advances.length > CAMPAIGN_TIME_ADVANCE_LIMIT ||
    !Number.isFinite(value.updatedAt) || value.updatedAt < 0
  ) return 'invalid-campaign-time-envelope'
  if (value.schemaVersion === CAMPAIGN_TIME_SCHEMA_VERSION && (
    !['campaign-day', 'gregorian'].includes(value.displayMode) ||
    !Number.isSafeInteger(value.displayMinuteOffset) || value.worldMinute + value.displayMinuteOffset < 0 ||
    (value.calendarEpochDate != null && campaignGregorianDayNumber(value.calendarEpochDate) == null) ||
    (value.displayMode === 'gregorian' && campaignGregorianDayNumber(value.calendarEpochDate) == null)
  )) return 'invalid-campaign-time-display'
  const timerIds = new Set()
  for (const timer of value.timers) {
    if (
      !plainObject(timer) || typeof timer.id !== 'string' || !timer.id || timer.id.length > 160 || timerIds.has(timer.id) ||
      !['reminder', 'concentration'].includes(timer.kind) || typeof timer.label !== 'string' || !timer.label.trim() || timer.label.length > 160 ||
      !['active', 'expired', 'dismissed', 'cancelled'].includes(timer.status) ||
      !Number.isSafeInteger(timer.createdAtWorldMinute) || timer.createdAtWorldMinute < 0 ||
      !Number.isSafeInteger(timer.expiresAtWorldMinute) || timer.expiresAtWorldMinute <= timer.createdAtWorldMinute ||
      !Number.isFinite(timer.createdAt) || timer.createdAt < 0 ||
      (timer.characterId != null && (typeof timer.characterId !== 'string' || !timer.characterId || timer.characterId.length > 160)) ||
      (timer.characterName != null && (typeof timer.characterName !== 'string' || timer.characterName.length > 80)) ||
      (timer.spellId != null && (typeof timer.spellId !== 'string' || !timer.spellId || timer.spellId.length > 160))
    ) return 'invalid-campaign-timer'
    timerIds.add(timer.id)
  }
  const advanceIds = new Set()
  let previousTo = 0
  for (const advance of value.advances) {
    if (
      !plainObject(advance) || typeof advance.id !== 'string' || !advance.id || advance.id.length > 160 || advanceIds.has(advance.id) ||
      !['advance', 'long-rest'].includes(advance.kind) ||
      !Number.isSafeInteger(advance.fromWorldMinute) || advance.fromWorldMinute < previousTo ||
      !Number.isSafeInteger(advance.toWorldMinute) || advance.toWorldMinute > value.worldMinute ||
      !Number.isSafeInteger(advance.minutes) || advance.minutes < 1 || advance.minutes > CAMPAIGN_TIME_MAX_ADVANCE_MINUTES ||
      advance.toWorldMinute - advance.fromWorldMinute !== advance.minutes ||
      !Number.isSafeInteger(advance.dawnsCrossed) || advance.dawnsCrossed < 0 ||
      !Array.isArray(advance.expiredTimerIds) || advance.expiredTimerIds.length > CAMPAIGN_TIME_TIMER_LIMIT ||
      advance.expiredTimerIds.some((id) => typeof id !== 'string' || !id || id.length > 160) ||
      typeof advance.reason !== 'string' || advance.reason.length > 160 ||
      !Number.isFinite(advance.createdAt) || advance.createdAt < 0
    ) return 'invalid-campaign-time-advance'
    previousTo = advance.toWorldMinute
    advanceIds.add(advance.id)
  }
  return null
}

function normalizeCampaignTimeState(value) {
  if (validateCampaignTimeState(value) != null) {
    return {
      schemaVersion: CAMPAIGN_TIME_SCHEMA_VERSION,
      worldMinute: CAMPAIGN_TIME_DEFAULT_WORLD_MINUTE,
      displayMode: 'campaign-day',
      displayMinuteOffset: 0,
      timers: [],
      advances: [],
      updatedAt: 0,
    }
  }
  if (value.schemaVersion === CAMPAIGN_TIME_SCHEMA_VERSION) return value
  return {
    ...value,
    schemaVersion: CAMPAIGN_TIME_SCHEMA_VERSION,
    displayMode: 'campaign-day',
    displayMinuteOffset: 0,
  }
}

function advanceCampaignTimeState(base, minutes, reason, kind, now) {
  const fromWorldMinute = base.worldMinute
  const toWorldMinute = fromWorldMinute + minutes
  if (!Number.isSafeInteger(toWorldMinute)) return null
  const expiredTimerIds = []
  const timers = base.timers.map((timer) => {
    if (timer.status !== 'active' || timer.expiresAtWorldMinute > toWorldMinute) return timer
    expiredTimerIds.push(timer.id)
    return { ...timer, status: 'expired', expiredAtWorldMinute: timer.expiresAtWorldMinute }
  })
  const advance = {
    id: `campaign-time-${randomUUID()}`,
    kind,
    fromWorldMinute,
    toWorldMinute,
    minutes,
    reason,
    dawnsCrossed: campaignDawnsCrossed(fromWorldMinute, toWorldMinute),
    expiredTimerIds,
    createdAt: now,
  }
  return {
    next: {
      ...base,
      schemaVersion: CAMPAIGN_TIME_SCHEMA_VERSION,
      worldMinute: toWorldMinute,
      timers,
      advances: [...base.advances, advance].slice(-CAMPAIGN_TIME_ADVANCE_LIMIT),
      updatedAt: now,
    },
    advance,
  }
}

export function mutateCampaignTimeState(current, mutation, now, member, context = {}) {
  const isDm = member?.memberId === context.host?.memberId || member?.role === 'dm'
  if (!isDm) return { ok: false, status: 403, error: 'dm-authority-required' }
  const base = normalizeCampaignTimeState(current)
  if (mutation?.operation === 'advance' || mutation?.operation === 'long-rest') {
    const minutes = mutation.operation === 'long-rest' ? 8 * 60 : Number(mutation.minutes)
    if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > CAMPAIGN_TIME_MAX_ADVANCE_MINUTES) {
      return { ok: false, status: 400, error: 'invalid-campaign-time-advance' }
    }
    const kind = mutation.operation === 'long-rest' ? 'long-rest' : 'advance'
    const reason = boundedText(mutation.reason, 160) || (kind === 'long-rest' ? '完成长休' : '推进时间')
    const advanced = advanceCampaignTimeState(base, minutes, reason, kind, now)
    if (!advanced) return { ok: false, status: 400, error: 'campaign-time-overflow' }
    return {
      ok: true,
      changed: true,
      ...advanced,
    }
  }
  if (mutation?.operation === 'set-time') {
    const displayMode = mutation.displayMode
    const hour = Number(mutation.hour)
    const minute = Number(mutation.minute)
    if (!['campaign-day', 'gregorian'].includes(displayMode) || !Number.isSafeInteger(hour) || hour < 0 || hour > 23 || !Number.isSafeInteger(minute) || minute < 0 || minute > 59) {
      return { ok: false, status: 400, error: 'invalid-campaign-time-input' }
    }
    const minuteOfDay = hour * 60 + minute
    let targetDisplayMinute
    let calendarEpochDate = base.calendarEpochDate
    let comparable = base.displayMode === displayMode
    if (displayMode === 'campaign-day') {
      const day = Number(mutation.day)
      if (!Number.isSafeInteger(day) || day < 1 || day > 999_999) return { ok: false, status: 400, error: 'invalid-campaign-day' }
      targetDisplayMinute = (day - 1) * 1_440 + minuteOfDay
    } else {
      const date = boundedText(mutation.date, 10)
      const requestedDay = campaignGregorianDayNumber(date)
      const currentEpochDay = campaignGregorianDayNumber(base.calendarEpochDate)
      if (requestedDay == null) return { ok: false, status: 400, error: 'invalid-campaign-date' }
      if (comparable && currentEpochDay != null && requestedDay >= currentEpochDay) {
        targetDisplayMinute = (requestedDay - currentEpochDay) * 1_440 + minuteOfDay
      } else {
        calendarEpochDate = date
        targetDisplayMinute = minuteOfDay
        comparable = false
      }
    }
    const currentDisplayMinute = base.worldMinute + base.displayMinuteOffset
    const advanceMinutes = comparable && targetDisplayMinute > currentDisplayMinute
      ? targetDisplayMinute - currentDisplayMinute
      : 0
    if (advanceMinutes > CAMPAIGN_TIME_MAX_ADVANCE_MINUTES) {
      return { ok: false, status: 400, error: 'campaign-time-advance-too-large' }
    }
    const reason = boundedText(mutation.reason, 160) || 'DM 手动设定战役时间'
    const advanced = advanceMinutes > 0
      ? advanceCampaignTimeState(base, advanceMinutes, reason, 'advance', now)
      : null
    if (advanceMinutes > 0 && !advanced) return { ok: false, status: 400, error: 'campaign-time-overflow' }
    const nextBase = advanced?.next ?? base
    const next = {
      ...nextBase,
      schemaVersion: CAMPAIGN_TIME_SCHEMA_VERSION,
      displayMode,
      displayMinuteOffset: targetDisplayMinute - nextBase.worldMinute,
      ...(calendarEpochDate ? { calendarEpochDate } : {}),
      updatedAt: now,
    }
    const changed = advanceMinutes > 0 || base.displayMode !== next.displayMode ||
      base.displayMinuteOffset !== next.displayMinuteOffset || base.calendarEpochDate !== next.calendarEpochDate
    return { ok: true, changed, next, ...(advanced ? { advance: advanced.advance } : {}) }
  }
  if (mutation?.operation === 'create-timer') {
    if (base.timers.length >= CAMPAIGN_TIME_TIMER_LIMIT) return { ok: false, status: 409, error: 'campaign-timer-limit-reached' }
    const label = boundedText(mutation.label, 160)
    const durationMinutes = Number(mutation.durationMinutes)
    if (!label || !['reminder', 'concentration'].includes(mutation.kind) || !Number.isSafeInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > CAMPAIGN_TIME_MAX_ADVANCE_MINUTES) {
      return { ok: false, status: 400, error: 'invalid-campaign-timer' }
    }
    const timer = {
      id: `campaign-timer-${randomUUID()}`,
      kind: mutation.kind,
      label,
      ...(boundedText(mutation.characterId, 160) ? { characterId: boundedText(mutation.characterId, 160) } : {}),
      ...(boundedText(mutation.characterName, 80) ? { characterName: boundedText(mutation.characterName, 80) } : {}),
      ...(boundedText(mutation.spellId, 160) ? { spellId: boundedText(mutation.spellId, 160) } : {}),
      createdAtWorldMinute: base.worldMinute,
      expiresAtWorldMinute: base.worldMinute + durationMinutes,
      status: 'active',
      createdAt: now,
    }
    return { ok: true, changed: true, next: { ...base, timers: [...base.timers, timer], updatedAt: now }, timer }
  }
  if (mutation?.operation === 'dismiss-timer' || mutation?.operation === 'cancel-timer') {
    const timerId = boundedText(mutation.timerId, 160)
    const index = base.timers.findIndex((timer) => timer.id === timerId)
    if (index < 0) return { ok: false, status: 404, error: 'campaign-timer-not-found' }
    const timer = base.timers[index]
    const status = mutation.operation === 'dismiss-timer' ? 'dismissed' : 'cancelled'
    if (timer.status === status) return { ok: true, changed: false, next: base }
    const timers = [...base.timers]
    timers[index] = {
      ...timer,
      status,
      ...(status === 'dismissed' ? { dismissedAt: now } : { cancelledAt: now }),
    }
    return { ok: true, changed: true, next: { ...base, timers, updatedAt: now } }
  }
  return { ok: false, status: 400, error: 'invalid-campaign-time-operation' }
}

export function mutateGroupAbilityChecksState(current, mutation, now, member, context = {}) {
  const isDm = member?.memberId === context.host?.memberId || member?.role === 'dm'
  const checks = Array.isArray(current?.checks) ? current.checks : []
  const base = { schemaVersion: 1, checks, updatedAt: now }
  const characters = Array.isArray(context?.characters?.characters) ? context.characters.characters : []
  const players = Array.isArray(context?.players) ? context.players : []
  if (mutation?.operation === 'create') {
    if (!isDm) return { ok: false, status: 403, error: 'dm-authority-required' }
    if (checks.some((check) => check?.status === 'open')) return { ok: false, status: 409, error: 'group-check-already-open' }
    const selection = boundedText(mutation?.selection, 100)
    const abilityMatch = selection.match(/^ability:(str|dex|con|int|wis|cha)$/)
    const saveMatch = selection.match(/^save:(str|dex|con|int|wis|cha)$/)
    const skillMatch = selection.match(/^skill:([a-zA-Z]+)$/)
    const skill = skillMatch?.[1]
    const ability = abilityMatch?.[1] ?? saveMatch?.[1] ?? GROUP_ABILITY_CHECK_SKILLS[skill]
    if (!GROUP_ABILITY_KEYS.has(ability) || (skill && !GROUP_ABILITY_CHECK_SKILLS[skill])) {
      return { ok: false, status: 400, error: 'invalid-group-check-selection' }
    }
    const dc = Number(mutation?.dc)
    const mode = mutation?.mode
    const characterIds = Array.isArray(mutation?.participantCharacterIds)
      ? [...new Set(mutation.participantCharacterIds.map((id) => boundedText(id, 160)).filter(Boolean))]
      : []
    if (!Number.isInteger(dc) || dc < 0 || dc > 100 || !['normal', 'advantage', 'disadvantage'].includes(mode) || characterIds.length < 1 || characterIds.length > 8) {
      return { ok: false, status: 400, error: 'invalid-group-check' }
    }
    const participants = []
    for (const characterId of characterIds) {
      const character = characters.find((entry) => entry?.id === characterId)
      const player = players.find((entry) => {
        if (entry?.memberId !== character?.roomMemberId || entry?.removedAt || entry?.leftAt) return false
        const explicitlyActive = entry?.activeCharacterId === characterId ||
          (!entry?.activeCharacterId && entry?.activeCharacterName === character?.name)
        const ownedCharacters = characters.filter((candidate) => candidate?.roomMemberId === entry.memberId)
        const unambiguousFallback = !entry?.activeCharacterId && !entry?.activeCharacterName &&
          ownedCharacters.length === 1 && ownedCharacters[0]?.id === characterId
        return explicitlyActive || unambiguousFallback
      })
      if (!character || !player || participants.some((entry) => entry.memberId === player.memberId)) {
        return { ok: false, status: 409, error: 'invalid-group-check-participant' }
      }
      participants.push({
        memberId: player.memberId,
        memberName: boundedText(player.displayName, 80) || '玩家',
        characterId: character.id,
        characterName: boundedText(character.name, 80) || '未命名角色',
        avatar: boundedText(character.avatar, 12) || '🎲',
      })
    }
    const label = boundedText(mutation?.label, 160) || '群体检定'
    const check = {
      id: `group-check-${randomUUID()}`,
      status: 'open',
      label,
      ability,
      rollKind: saveMatch ? 'saving-throw' : 'ability-check',
      ...(skill ? { skill } : {}),
      dc,
      requestedMode: mode,
      allowPassiveFallback: !saveMatch && mutation?.allowPassiveFallback === true,
      ...(boundedText(mutation?.mapId, 160) ? { mapId: boundedText(mutation.mapId, 160) } : {}),
      participants,
      results: [],
      createdByMemberId: member.memberId,
      createdByName: boundedText(member.displayName, 80) || 'DM',
      createdAt: now,
      expiresAt: now + 10 * 60 * 1_000,
      updatedAt: now,
    }
    return { ok: true, changed: true, next: { ...base, checks: [...checks, check].slice(-GROUP_ABILITY_CHECK_LIMIT) }, check }
  }
  const checkId = boundedText(mutation?.checkId, 160)
  const index = checks.findIndex((check) => check?.id === checkId)
  if (index < 0) return { ok: false, status: 404, error: 'group-check-not-found' }
  const currentCheck = checks[index]
  if (mutation?.operation === 'roll') {
    if (isDm) return { ok: false, status: 403, error: 'player-response-required' }
    if (currentCheck.status !== 'open') return { ok: false, status: 409, error: 'group-check-closed' }
    if (now >= currentCheck.expiresAt) return { ok: false, status: 409, error: 'group-check-expired' }
    const participant = currentCheck.participants.find((entry) => entry?.memberId === member?.memberId)
    if (!participant) return { ok: false, status: 403, error: 'not-a-group-check-participant' }
    if (currentCheck.results.some((entry) => entry?.memberId === member.memberId)) {
      return { ok: true, changed: false, next: base }
    }
    const character = characters.find((entry) =>
      entry?.id === participant.characterId && entry?.roomMemberId === member.memberId)
    if (!character) return { ok: false, status: 409, error: 'participant-character-missing' }
    const result = groupCheckResult(character, currentCheck, now, { memberId: member.memberId, rollDie: context.rollDie })
    const updated = { ...currentCheck, results: [...currentCheck.results, result], updatedAt: now }
    const nextChecks = [...checks]
    nextChecks[index] = updated
    return { ok: true, changed: true, next: { ...base, checks: nextChecks }, result }
  }
  if (mutation?.operation === 'finalize') {
    if (!isDm) return { ok: false, status: 403, error: 'dm-authority-required' }
    if (currentCheck.status !== 'open') return { ok: true, changed: false, next: base }
    let results = [...currentCheck.results]
    const missing = currentCheck.participants.filter((participant) => !results.some((entry) => entry.memberId === participant.memberId))
    if (missing.length > 0 && mutation?.usePassiveForPending !== true) {
      return { ok: false, status: 409, error: 'group-check-responses-pending' }
    }
    if (missing.length > 0 && !currentCheck.allowPassiveFallback) {
      return { ok: false, status: 409, error: 'passive-fallback-disabled' }
    }
    for (const participant of missing) {
      const character = characters.find((entry) => entry?.id === participant.characterId && entry?.roomMemberId === participant.memberId)
      if (!character) return { ok: false, status: 409, error: 'participant-character-missing' }
      results.push(groupCheckResult(character, currentCheck, now, { memberId: participant.memberId, passiveOnly: true }))
    }
    const complete = { ...currentCheck, status: 'completed', results, completedAt: now, updatedAt: now }
    complete.aggregate = groupCheckAggregate(complete)
    const nextChecks = [...checks]
    nextChecks[index] = complete
    return { ok: true, changed: true, next: { ...base, checks: nextChecks }, check: complete }
  }
  if (mutation?.operation === 'cancel') {
    if (!isDm) return { ok: false, status: 403, error: 'dm-authority-required' }
    if (currentCheck.status !== 'open') return { ok: true, changed: false, next: base }
    const cancelled = { ...currentCheck, status: 'cancelled', cancelledAt: now, updatedAt: now }
    const nextChecks = [...checks]
    nextChecks[index] = cancelled
    return { ok: true, changed: true, next: { ...base, checks: nextChecks } }
  }
  return { ok: false, status: 400, error: 'invalid-group-check-operation' }
}

function validDnd5eRoundLifecycle(value) {
  return plainObject(value) && Number.isInteger(value.createdRound) && value.createdRound >= 0 &&
    Number.isInteger(value.expiresAfterRound) && value.expiresAfterRound >= value.createdRound &&
    value.expiresAfterRound - value.createdRound + 1 <= 14_400 &&
    (value.expiresAtSourceTurnEndAfterRound == null || (
      Number.isInteger(value.expiresAtSourceTurnEndAfterRound) &&
      value.expiresAtSourceTurnEndAfterRound >= value.createdRound &&
      value.expiresAtSourceTurnEndAfterRound <= value.expiresAfterRound
    ))
}

function validDnd5ePersistentAreaLighting(value) {
  if (value == null) return true
  if (!plainObject(value) || !Number.isInteger(value.spellLevel) || value.spellLevel < 0 || value.spellLevel > 9) return false
  if (value.kind === 'light') {
    const allowed = new Set(['kind', 'brightRadiusFeet', 'dimRadiusFeet', 'color', 'spellLevel', 'suppressesMagicalDarknessThroughLevel'])
    return Object.keys(value).every((key) => allowed.has(key)) &&
      Number.isInteger(value.brightRadiusFeet) && value.brightRadiusFeet >= 0 && value.brightRadiusFeet <= 1_000 &&
      Number.isInteger(value.dimRadiusFeet) && value.dimRadiusFeet >= 0 && value.dimRadiusFeet <= 1_000 &&
      value.brightRadiusFeet + value.dimRadiusFeet > 0 && typeof value.color === 'string' && /^#[0-9a-f]{6}$/i.test(value.color) &&
      (value.suppressesMagicalDarknessThroughLevel == null || (
        Number.isInteger(value.suppressesMagicalDarknessThroughLevel) &&
        value.suppressesMagicalDarknessThroughLevel >= 0 && value.suppressesMagicalDarknessThroughLevel <= 9
      ))
  }
  const allowed = new Set(['kind', 'radiusFeet', 'spellLevel', 'suppressesMagicalLightThroughLevel'])
  return Object.keys(value).every((key) => allowed.has(key)) &&
    value.kind === 'magical-darkness' && Number.isInteger(value.radiusFeet) &&
    value.radiusFeet >= 1 && value.radiusFeet <= 1_000 &&
    (value.suppressesMagicalLightThroughLevel == null || (
      Number.isInteger(value.suppressesMagicalLightThroughLevel) &&
      value.suppressesMagicalLightThroughLevel >= 0 && value.suppressesMagicalLightThroughLevel <= 9
    ))
}

function validTimedLightState(light) {
  if (!plainObject(light) || typeof light.enabled !== 'boolean' ||
    !Number.isFinite(light.brightRadiusFeet) || light.brightRadiusFeet < 0 || light.brightRadiusFeet > 10_000 ||
    !Number.isFinite(light.dimRadiusFeet) || light.dimRadiusFeet < 0 || light.dimRadiusFeet > 10_000 ||
    typeof light.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(light.color) ||
    (light.sourceKind != null && !['permanent', 'torch', 'candle', 'lamp', 'hooded-lantern', 'spell', 'custom'].includes(light.sourceKind))) return false
  const timing = [light.startedAtWorldMinute, light.durationMinutes, light.expiresAtWorldMinute]
  const hasTiming = timing.some((value) => value != null)
  if (!hasTiming) return !['torch', 'candle', 'lamp', 'hooded-lantern'].includes(light.sourceKind)
  return timing.every((value) => Number.isSafeInteger(value) && value >= 0) &&
    light.durationMinutes > 0 && light.durationMinutes <= CAMPAIGN_TIME_MAX_ADVANCE_MINUTES &&
    light.expiresAtWorldMinute === light.startedAtWorldMinute + light.durationMinutes
}

function validateCustomMonsterState(value) {
  if (value.schemaVersion !== 1 || !Array.isArray(value.monsters) || value.monsters.length > 512) {
    return 'invalid-custom-monster-envelope'
  }
  const ids = new Set()
  const slugs = new Set()
  for (const monster of value.monsters) {
    if (
      !plainObject(monster) || typeof monster.id !== 'string' ||
      !/^room-monster:[a-z0-9][a-z0-9-]{0,95}$/.test(monster.id) || ids.has(monster.id) ||
      typeof monster.slug !== 'string' || !/^[a-z0-9][a-z0-9-]{0,95}$/.test(monster.slug) || slugs.has(monster.slug) ||
      monster.source !== 'DM 自定义' || typeof monster.name !== 'string' || !monster.name.trim() || monster.name.length > 240 ||
      typeof monster.englishName !== 'string' || !monster.englishName.trim() || monster.englishName.length > 240 ||
      !['微型', '小型', '中型', '大型', '超大型', '巨型'].includes(monster.size) ||
      typeof monster.creatureType !== 'string' || !monster.creatureType.trim() ||
      !plainObject(monster.armorClass) || !Number.isInteger(monster.armorClass.value) || monster.armorClass.value < 1 || monster.armorClass.value > 100 ||
      !plainObject(monster.hitPoints) || !Number.isInteger(monster.hitPoints.average) || monster.hitPoints.average < 1 ||
      typeof monster.hitPoints.dice !== 'string' || !/^\d+d\d+(?:\s*[+\-−]\s*\d+)?$/i.test(monster.hitPoints.dice) ||
      !plainObject(monster.speed) || !Number.isInteger(monster.speed.walk) || monster.speed.walk < 0 ||
      !plainObject(monster.abilities) || ['str', 'dex', 'con', 'int', 'wis', 'cha'].some((key) =>
        !Number.isInteger(monster.abilities[key]) || monster.abilities[key] < 1 || monster.abilities[key] > 30
      ) ||
      !Array.isArray(monster.senses) || !Array.isArray(monster.languages) || !Array.isArray(monster.traits) ||
      !Array.isArray(monster.actions) || monster.actions.length > 128 ||
      !plainObject(monster.challenge) || typeof monster.challenge.rating !== 'string' ||
      !Number.isSafeInteger(monster.challenge.xp) || monster.challenge.xp < 0
    ) return 'invalid-custom-monster'
    for (const action of monster.actions) {
      if (
        !plainObject(action) || typeof action.id !== 'string' || !action.id ||
        typeof action.name !== 'string' || !action.name.trim() || typeof action.description !== 'string' || !action.description.trim() ||
        !['weapon-attack', 'multiattack', 'other'].includes(action.kind) ||
        (action.automation != null && !['headless', 'dm-adjudication'].includes(action.automation))
      ) return 'invalid-custom-monster-action'
    }
    ids.add(monster.id)
    slugs.add(monster.slug)
  }
  return null
}

const SCENE_ACTION_KINDS = new Set([
  'reveal-handout', 'whisper', 'group-roll', 'door', 'light', 'fog', 'encounter',
  'sound', 'audio', 'teleport', 'task', 'journal',
])

function validSceneId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 180
}

function validSceneRegion(region) {
  if (!plainObject(region) || !Number.isFinite(region.x) || !Number.isFinite(region.y)) return false
  if (region.kind === 'circle') return Number.isFinite(region.radius) && region.radius >= 4 && region.radius <= 100_000
  return region.kind === 'rect' && Number.isFinite(region.width) && Number.isFinite(region.height) &&
    region.width >= 4 && region.width <= 100_000 && region.height >= 4 && region.height <= 100_000
}

function validSceneAction(action) {
  if (!plainObject(action) || !validSceneId(action.id) || !SCENE_ACTION_KINDS.has(action.kind) ||
    typeof action.enabled !== 'boolean' ||
    (action.delayMs != null && (!Number.isInteger(action.delayMs) || action.delayMs < 0 || action.delayMs > 30_000))) return false
  if (action.kind === 'reveal-handout') return validSceneId(action.handoutId) && ['all', 'triggering-player'].includes(action.audience)
  if (action.kind === 'whisper') return typeof action.text === 'string' && action.text.length > 0 && action.text.length <= 2_000
  if (action.kind === 'group-roll') return typeof action.label === 'string' && action.label.length > 0 && action.label.length <= 160 &&
    /^(?:ability|save):(str|dex|con|int|wis|cha)$|^skill:[a-zA-Z]+$/.test(action.selection) &&
    Number.isInteger(action.dc) && action.dc >= 0 && action.dc <= 100 &&
    ['normal', 'advantage', 'disadvantage'].includes(action.mode) && typeof action.allowPassiveFallback === 'boolean'
  if (action.kind === 'door') return validSceneId(action.doorId) && ['open', 'closed', 'locked'].includes(action.state)
  if (action.kind === 'light') return ['bright', 'dim', 'darkness'].includes(action.ambientLight)
  if (action.kind === 'fog') return ['fill', 'clear'].includes(action.operation)
  if (action.kind === 'encounter') return typeof action.startInitiative === 'boolean' && Array.isArray(action.entries) &&
    action.entries.length > 0 && action.entries.length <= 30 && action.entries.every((entry) =>
      plainObject(entry) && validSceneId(entry.monsterId) && Number.isInteger(entry.quantity) && entry.quantity >= 1 && entry.quantity <= 50)
  if (action.kind === 'sound') return ['discovery', 'danger', 'door', 'mystery', 'victory'].includes(action.cue)
  if (action.kind === 'audio') return ['play', 'stop'].includes(action.operation) && typeof action.loop === 'boolean' &&
    Number.isFinite(action.volume) && action.volume >= 0 && action.volume <= 1 &&
    (action.operation === 'stop' || (typeof action.assetId === 'string' && /^[a-zA-Z0-9_-]{1,160}$/.test(action.assetId)))
  if (action.kind === 'teleport') return validSceneId(action.targetMapId) && Number.isFinite(action.x) && Number.isFinite(action.y) && typeof action.moveTriggeringToken === 'boolean'
  return typeof action.title === 'string' && action.title.length > 0 && action.title.length <= 160 && typeof action.body === 'string' && action.body.length <= 4_000
}

const SCENE_INTERACTION_POINT_ICONS = new Set(['bookshelf', 'chest', 'search', 'altar', 'switch', 'custom'])
const SCENE_INTERACTION_CURRENCIES = new Set(['cp', 'sp', 'ep', 'gp', 'pp'])
const SCENE_INTERACTION_DAMAGE_TYPES = new Set([
  'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic',
  'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder',
])
const SCENE_INTERACTION_CONDITIONS = new Set([
  'blinded', 'charmed', 'deafened', 'frightened', 'grappled', 'incapacitated',
  'invisible', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained',
  'stunned', 'unconscious',
])

function validSceneInteractionOutcomeEffect(effect) {
  if (!plainObject(effect) || !validSceneId(effect.id)) return false
  if (effect.kind === 'currency') {
    return SCENE_INTERACTION_CURRENCIES.has(effect.currency) &&
      Number.isInteger(effect.amount) && effect.amount >= 1 && effect.amount <= 1_000_000
  }
  if (effect.kind === 'handout') {
    return validSceneId(effect.handoutId) && ['all', 'triggering-player'].includes(effect.audience)
  }
  if (effect.kind === 'task') {
    return ['add', 'complete'].includes(effect.operation) &&
      (effect.operation !== 'complete' || validSceneId(effect.taskId)) &&
      typeof effect.title === 'string' && effect.title.length <= 120 &&
      (effect.operation !== 'add' || effect.title.trim().length > 0) &&
      typeof effect.body === 'string' && effect.body.length <= 4_000
  }
  if (effect.kind === 'damage') {
    return Number.isInteger(effect.count) && effect.count >= 1 && effect.count <= 40 &&
      Number.isInteger(effect.sides) && effect.sides >= 2 && effect.sides <= 100 &&
      Number.isInteger(effect.bonus) && effect.bonus >= -1_000 && effect.bonus <= 1_000 &&
      SCENE_INTERACTION_DAMAGE_TYPES.has(effect.damageType)
  }
  if (effect.kind === 'condition') {
    return SCENE_INTERACTION_CONDITIONS.has(effect.condition) && plainObject(effect.duration) && (
      effect.duration.type === 'permanent' ||
      (
        effect.duration.type === 'rounds' &&
        Number.isInteger(effect.duration.rounds) &&
        effect.duration.rounds >= 1 &&
        effect.duration.rounds <= 10_000
      )
    )
  }
  return false
}

function validSceneInteractionPoint(point) {
  if (
    !plainObject(point) ||
    !validSceneId(point.id) ||
    typeof point.name !== 'string' ||
    !point.name.trim() ||
    point.name.length > 160 ||
    typeof point.enabled !== 'boolean' ||
    typeof point.visibleToPlayers !== 'boolean' ||
    !SCENE_INTERACTION_POINT_ICONS.has(point.icon) ||
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    !Number.isFinite(point.interactionRadiusFeet) ||
    point.interactionRadiusFeet < 5 ||
    point.interactionRadiusFeet > 120 ||
    typeof point.prompt !== 'string' ||
    !point.prompt.trim() ||
    point.prompt.length > 1_000 ||
    !['once', 'per-character', 'always'].includes(point.repeat) ||
    typeof point.successText !== 'string' ||
    point.successText.length > 1_000 ||
    typeof point.failureText !== 'string' ||
    point.failureText.length > 1_000 ||
    !plainObject(point.check) ||
    typeof point.check.label !== 'string' ||
    !point.check.label.trim() ||
    point.check.label.length > 160 ||
    !/^(?:ability):(str|dex|con|int|wis|cha)$|^skill:[a-zA-Z]+$/.test(point.check.selection) ||
    !Number.isInteger(point.check.dc) ||
    point.check.dc < 0 ||
    point.check.dc > 100 ||
    !['normal', 'advantage', 'disadvantage'].includes(point.check.mode) ||
    !Array.isArray(point.rewards) ||
    point.rewards.length > 12 ||
    (point.successEffects != null && (
      !Array.isArray(point.successEffects) ||
      point.successEffects.length > 24 ||
      !point.successEffects.every(validSceneInteractionOutcomeEffect) ||
      new Set(point.successEffects.map((effect) => effect.id)).size !== point.successEffects.length
    )) ||
    (point.failureEffects != null && (
      !Array.isArray(point.failureEffects) ||
      point.failureEffects.length > 24 ||
      !point.failureEffects.every(validSceneInteractionOutcomeEffect) ||
      new Set(point.failureEffects.map((effect) => effect.id)).size !== point.failureEffects.length
    ))
  ) return false
  return point.rewards.every((reward) =>
    plainObject(reward) &&
    validSceneId(reward.templateId) &&
    Number.isInteger(reward.quantity) &&
    reward.quantity >= 1 &&
    reward.quantity <= 999 &&
    typeof reward.identified === 'boolean')
}

function validateSceneOrchestrationState(value) {
  if (value.schemaVersion !== 1 || !Array.isArray(value.scenes) || value.scenes.length > 80 || !plainObject(value.runtime) ||
    !Array.isArray(value.runtime.pendingRuns) || value.runtime.pendingRuns.length > 50 ||
    !Array.isArray(value.runtime.receipts) || value.runtime.receipts.length > 2_000 ||
    !Array.isArray(value.runtime.history) || value.runtime.history.length > 240 ||
    typeof value.runtime.paused !== 'boolean') return 'invalid-scene-orchestration'
  const sceneIds = new Set()
  for (const scene of value.scenes) {
    if (!plainObject(scene) || !validSceneId(scene.id) || sceneIds.has(scene.id) || !validSceneId(scene.mapId) ||
      typeof scene.name !== 'string' || !scene.name || scene.name.length > 160 ||
      typeof scene.description !== 'string' || scene.description.length > 2_000 ||
      typeof scene.environmentLabel !== 'string' || scene.environmentLabel.length > 300 ||
      !['none', 'discovery', 'danger', 'door', 'mystery', 'victory'].includes(scene.backgroundCue) ||
      (scene.backgroundAudioId != null && (typeof scene.backgroundAudioId !== 'string' || !/^[a-zA-Z0-9_-]{1,160}$/.test(scene.backgroundAudioId))) ||
      (scene.backgroundAudioLoop != null && typeof scene.backgroundAudioLoop !== 'boolean') ||
      (scene.backgroundAudioVolume != null && (!Number.isFinite(scene.backgroundAudioVolume) || scene.backgroundAudioVolume < 0 || scene.backgroundAudioVolume > 1)) ||
      !Array.isArray(scene.boundHandoutIds) || scene.boundHandoutIds.length > 100 || !scene.boundHandoutIds.every(validSceneId) ||
      !Array.isArray(scene.boundJournalEntryIds) || scene.boundJournalEntryIds.length > 100 || !scene.boundJournalEntryIds.every(validSceneId) ||
      (scene.interactionPoints != null && (
        !Array.isArray(scene.interactionPoints) ||
        scene.interactionPoints.length > 160 ||
        !scene.interactionPoints.every(validSceneInteractionPoint) ||
        new Set(scene.interactionPoints.map((point) => point.id)).size !== scene.interactionPoints.length
      )) ||
      !Array.isArray(scene.triggers) || scene.triggers.length > 120 || !Number.isFinite(scene.createdAt) || !Number.isFinite(scene.updatedAt)) {
      return 'invalid-scene'
    }
    sceneIds.add(scene.id)
    const triggerIds = new Set()
    for (const trigger of scene.triggers) {
      if (!plainObject(trigger) || !validSceneId(trigger.id) || triggerIds.has(trigger.id) ||
        typeof trigger.name !== 'string' || !trigger.name || trigger.name.length > 160 || typeof trigger.enabled !== 'boolean' ||
        !validSceneRegion(trigger.region) || !Array.isArray(trigger.events) || trigger.events.length < 1 ||
        !trigger.events.every((event) => ['enter', 'leave', 'manual'].includes(event)) ||
        !['any', 'player', 'enemy'].includes(trigger.tokenFilter) || !['always', 'per-token', 'once'].includes(trigger.repeat) ||
        !Array.isArray(trigger.actions) || trigger.actions.length > 40 || !trigger.actions.every(validSceneAction)) return 'invalid-scene-trigger'
      triggerIds.add(trigger.id)
      if (new Set(trigger.actions.map((action) => action.id)).size !== trigger.actions.length) return 'duplicate-scene-action'
    }
  }
  if (value.runtime.receipts.some((receipt) => typeof receipt !== 'string' || !receipt || receipt.length > 300)) return 'invalid-scene-receipt'
  if (value.runtime.pendingRuns.some((run) => !plainObject(run) || !validSceneId(run.id) || !sceneIds.has(run.sceneId) ||
    !validSceneId(run.triggerId) || !validSceneId(run.mapId) || !['enter', 'leave', 'manual'].includes(run.event) ||
    !Number.isInteger(run.nextActionIndex) || run.nextActionIndex < 0 || !Number.isFinite(run.createdAt))) return 'invalid-scene-run'
  if (value.runtime.history.some((entry) => !plainObject(entry) || !validSceneId(entry.id) || !validSceneId(entry.runId) ||
    !validSceneId(entry.sceneId) || !validSceneId(entry.triggerId) || !validSceneId(entry.actionId) ||
    typeof entry.summary !== 'string' || entry.summary.length > 500 || !Number.isFinite(entry.executedAt) ||
    typeof entry.reversible !== 'boolean')) return 'invalid-scene-history'
  return null
}

function validSceneAudioAsset(asset) {
  return plainObject(asset) && typeof asset.id === 'string' && /^[a-zA-Z0-9_-]{1,160}$/.test(asset.id) &&
    typeof asset.name === 'string' && asset.name.trim().length > 0 && asset.name.length <= 160 &&
    typeof asset.fileName === 'string' && asset.fileName.trim().length > 0 && asset.fileName.length <= 240 &&
    typeof asset.mimeType === 'string' && /^audio\/[a-zA-Z0-9.+-]{1,80}$/.test(asset.mimeType) &&
    Number.isSafeInteger(asset.sizeBytes) && asset.sizeBytes >= 1 && asset.sizeBytes <= IMAGE_MAX_BYTES &&
    Number.isFinite(asset.durationSeconds) && asset.durationSeconds > 0 && asset.durationSeconds <= 24 * 60 * 60 &&
    ['music', 'ambience', 'sfx'].includes(asset.kind) && Number.isFinite(asset.createdAt)
}

function validateSceneAudioLibraryState(value) {
  if (value.schemaVersion !== 1 || !Array.isArray(value.assets) || value.assets.length > 80) return 'invalid-scene-audio-library'
  if (!value.assets.every(validSceneAudioAsset) || new Set(value.assets.map((asset) => asset.id)).size !== value.assets.length) {
    return 'invalid-scene-audio-asset'
  }
  return null
}

function validateSceneAudioPlaybackState(value) {
  if (value.schemaVersion !== 1 || !['stopped', 'playing', 'paused'].includes(value.status) ||
    !Number.isFinite(value.positionSeconds) || value.positionSeconds < 0 ||
    !Number.isFinite(value.anchorServerMs) || typeof value.loop !== 'boolean' ||
    !Number.isFinite(value.volume) || value.volume < 0 || value.volume > 1 ||
    !Number.isInteger(value.fadeMs) || value.fadeMs < 0 || value.fadeMs > 10_000 ||
    !Number.isFinite(value.updatedAt)) return 'invalid-scene-audio-playback'
  if (value.status !== 'stopped' && (
    typeof value.assetId !== 'string' || !/^[a-zA-Z0-9_-]{1,160}$/.test(value.assetId) ||
    typeof value.assetName !== 'string' || !value.assetName.trim() || value.assetName.length > 160
  )) return 'invalid-scene-audio-playback-asset'
  return null
}

function sceneAudioPlaybackPosition(state, now, durationSeconds) {
  const elapsed = state.status === 'playing' ? Math.max(0, now - state.anchorServerMs) / 1_000 : 0
  const position = Math.max(0, state.positionSeconds + elapsed)
  return state.loop ? position % durationSeconds : Math.min(durationSeconds, position)
}

export function mutateSceneAudioPlaybackState(current, mutation, now, member, context = {}) {
  if (member?.memberId !== context.host?.memberId) return { ok: false, status: 403, error: 'dm-authority-required' }
  const assets = Array.isArray(context.library?.assets) ? context.library.assets : []
  const base = validateSceneAudioPlaybackState(current ?? {}) == null ? current : {
    schemaVersion: 1, status: 'stopped', positionSeconds: 0, anchorServerMs: 0,
    loop: false, volume: 0.7, fadeMs: 0, updatedAt: 0,
  }
  const operation = mutation?.operation
  const currentAsset = assets.find((asset) => asset?.id === base.assetId)
  if (operation === 'play') {
    const asset = assets.find((candidate) => candidate?.id === mutation?.assetId && validSceneAudioAsset(candidate))
    const volume = Number(mutation?.volume)
    const positionSeconds = Number(mutation?.positionSeconds ?? 0)
    const fadeMs = Number(mutation?.fadeMs ?? 0)
    if (!asset || !Number.isFinite(volume) || volume < 0 || volume > 1 || !Number.isFinite(positionSeconds) || positionSeconds < 0 ||
      positionSeconds > asset.durationSeconds || !Number.isInteger(fadeMs) || fadeMs < 0 || fadeMs > 10_000) {
      return { ok: false, status: 400, error: 'invalid-scene-audio-play' }
    }
    const next = {
      schemaVersion: 1, status: 'playing', assetId: asset.id, assetName: asset.name,
      positionSeconds, anchorServerMs: now + 600, loop: mutation?.loop === true,
      volume, fadeMs, updatedAt: now,
    }
    return { ok: true, changed: true, next }
  }
  if (operation === 'stop') {
    if (base.status === 'stopped') return { ok: true, changed: false, next: base }
    return { ok: true, changed: true, next: {
      schemaVersion: 1, status: 'stopped', positionSeconds: 0, anchorServerMs: now,
      loop: false, volume: base.volume, fadeMs: 0, updatedAt: now,
    } }
  }
  if (!currentAsset || base.status === 'stopped') return { ok: false, status: 409, error: 'scene-audio-not-active' }
  const currentPosition = sceneAudioPlaybackPosition(base, now, currentAsset.durationSeconds)
  if (operation === 'pause') {
    if (base.status === 'paused') return { ok: true, changed: false, next: base }
    return { ok: true, changed: true, next: { ...base, status: 'paused', positionSeconds: currentPosition, anchorServerMs: now, updatedAt: now } }
  }
  if (operation === 'resume') {
    if (base.status === 'playing') return { ok: true, changed: false, next: base }
    return { ok: true, changed: true, next: { ...base, status: 'playing', anchorServerMs: now + 600, updatedAt: now } }
  }
  if (operation === 'seek') {
    const positionSeconds = Number(mutation?.positionSeconds)
    if (!Number.isFinite(positionSeconds) || positionSeconds < 0 || positionSeconds > currentAsset.durationSeconds) {
      return { ok: false, status: 400, error: 'invalid-scene-audio-position' }
    }
    return { ok: true, changed: true, next: {
      ...base, positionSeconds, anchorServerMs: base.status === 'playing' ? now + 300 : now, updatedAt: now,
    } }
  }
  if (operation === 'set-volume') {
    const volume = Number(mutation?.volume)
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) return { ok: false, status: 400, error: 'invalid-scene-audio-volume' }
    return { ok: true, changed: volume !== base.volume, next: { ...base, volume, updatedAt: now } }
  }
  return { ok: false, status: 400, error: 'invalid-scene-audio-operation' }
}

function validateDnd5eResourceStates(name, value) {
  if (name === 'custom-monsters') return validateCustomMonsterState(value)
  if (name === 'group-ability-checks') return validateGroupAbilityCheckState(value)
  if (name === 'scene-orchestration') return validateSceneOrchestrationState(value)
  if (name === 'scene-audio-library') return validateSceneAudioLibraryState(value)
  if (name === 'scene-audio-playback') return validateSceneAudioPlaybackState(value)
  if (name === 'characters') {
    let portraitLength = 0
    for (const character of value.characters ?? []) {
      if (!plainObject(character)) continue
      for (const field of ['portrait', 'tokenPortrait']) {
        if (character[field] == null) continue
        if (
          typeof character[field] !== 'string' ||
          character[field].length > CHARACTER_PORTRAIT_MAX_DATA_URL_LENGTH ||
          !/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=\r\n]+$/i.test(character[field])
        ) return 'invalid-character-portrait'
        portraitLength += character[field].length
      }
      const reason = validateActiveEffectState(character.dnd5eCombatState, character.conditions ?? [])
      if (reason) return reason
    }
    if (portraitLength > CHARACTER_PORTRAIT_MAX_TOTAL_DATA_URL_LENGTH) return 'character-portraits-too-large'
  }
  if (name === 'maps') {
    for (const map of value.maps ?? []) {
      if (!plainObject(map) || !Array.isArray(map.tokens)) continue
      for (const token of map.tokens) {
        if (!plainObject(token)) continue
        if (token.portraitImageId != null && (
          typeof token.portraitImageId !== 'string' ||
          !/^[a-z0-9_-]{1,160}$/i.test(token.portraitImageId)
        )) return 'invalid-token-portrait-image'
        if (token.visualVariantId != null && (
          typeof token.visualVariantId !== 'string' ||
          !/^[a-z0-9_-]{1,80}$/i.test(token.visualVariantId)
        )) return 'invalid-token-visual-variant'
        if (token.lightSource != null && !validTimedLightState(token.lightSource)) return 'invalid-token-light-source'
        if (token.movementAnimation != null && !validTokenMovementAnimation(token.movementAnimation)) {
          return 'invalid-token-movement-animation'
        }
        const reason = validateActiveEffectState(token.dnd5eCombatState, token.dnd5eCombatState?.conditions ?? [])
        if (reason) return reason
        if (token.dnd5eSummon != null && (
          !validDnd5eRoundLifecycle(token.dnd5eSummon) || token.dnd5eSummon.schemaVersion !== 1 ||
          !['player', 'enemy'].includes(token.dnd5eSummon.side)
        )) return 'invalid-dnd5e-summon'
        if (token.dnd5eSpellEffect != null && (
          !validDnd5eRoundLifecycle(token.dnd5eSpellEffect) || token.dnd5eSpellEffect.schemaVersion !== 1
        )) return 'invalid-dnd5e-spell-effect'
      }
      if (map.dnd5ePluginAreas != null) {
        if (!Array.isArray(map.dnd5ePluginAreas) || map.dnd5ePluginAreas.length > 1_024) {
          return 'invalid-dnd5e-plugin-areas'
        }
        for (const area of map.dnd5ePluginAreas) {
          if (
            !validDnd5eRoundLifecycle(area) || typeof area.label !== 'string' || !area.label || area.label.length > 120 ||
            !validDnd5ePersistentAreaLighting(area.lighting)
          ) return 'invalid-dnd5e-plugin-area'
        }
      }
    }
  }
  return null
}

const COMBAT_INTERRUPT_KINDS = new Set([
  'dodge', 'stable-mind', 'gale-combo', 'agile-leap', 'opportunity-attack', 'protection',
  'shield-spell', 'counterspell', 'uncanny-dodge', 'deflect-missiles', 'saving-throw-reroll',
  'legendary-resistance', 'bardic-inspiration', 'cutting-words', 'dark-ones-own-luck',
  'stroke-of-luck', 'empowered-spell', 'stand-against-tide', 'plugin-choice', 'dm-adjudication',
  'roll-confirmation',
])
const COMBAT_INTERRUPT_STATUSES = new Set(['pending', 'waiting-for-dm', 'rolling', 'answered', 'done', 'rolled-back'])
const COMBAT_INTERRUPT_PHASES = new Set(['before-action', 'after-roll', 'before-hit', 'before-damage', 'after-save', 'before-condition'])

function validateCombatInterruptState(value) {
  const ids = new Set()
  const activeTransactions = new Set()
  for (const interrupt of value.interrupts ?? []) {
    if (!plainObject(interrupt) || typeof interrupt.id !== 'string' || !interrupt.id || ids.has(interrupt.id)) return 'invalid-combat-interrupt'
    ids.add(interrupt.id)
    if (
      typeof interrupt.mapId !== 'string' || !COMBAT_INTERRUPT_KINDS.has(interrupt.kind) ||
      !COMBAT_INTERRUPT_STATUSES.has(interrupt.status) || !plainObject(interrupt.payload) ||
      !Number.isFinite(interrupt.createdAt) || !Number.isFinite(interrupt.updatedAt)
    ) return 'invalid-combat-interrupt'
    if (interrupt.transactionId != null && (typeof interrupt.transactionId !== 'string' || !interrupt.transactionId)) return 'invalid-interrupt-transaction'
    if (interrupt.phase != null && !COMBAT_INTERRUPT_PHASES.has(interrupt.phase)) return 'invalid-interrupt-phase'
    if (interrupt.timeoutPolicy != null && !['rollback', 'wait-for-dm'].includes(interrupt.timeoutPolicy)) return 'invalid-interrupt-timeout-policy'
    if (!['done', 'rolled-back'].includes(interrupt.status)) {
      const transactionId = interrupt.transactionId ?? interrupt.id
      if (activeTransactions.has(transactionId)) return 'duplicate-interrupt-transaction-lock'
      activeTransactions.add(transactionId)
    }
  }
  return null
}

function validGeometryPoint(point) {
  return plainObject(point) && Number.isFinite(point.x) && Number.isFinite(point.y) &&
    Math.abs(point.x) <= 1_000_000 && Math.abs(point.y) <= 1_000_000
}

function validGeometryEntity(entity, kind) {
  if (
    !plainObject(entity) || entity.kind !== kind || typeof entity.id !== 'string' || !entity.id ||
    typeof entity.label !== 'string' || !Array.isArray(entity.points) ||
    !entity.points.every(validGeometryPoint) || typeof entity.blocksVision !== 'boolean' ||
    typeof entity.blocksMovement !== 'boolean' || typeof entity.blocksLineOfEffect !== 'boolean' ||
    !Number.isFinite(entity.baseHeightFeet) || !Number.isFinite(entity.heightFeet) || entity.heightFeet < 0 ||
    !Number.isFinite(entity.createdAt)
  ) return false
  const validLegacyWallAttachment = (entity.parentWallId == null && entity.parentWallSegmentIndex == null) || (
    typeof entity.parentWallId === 'string' && entity.parentWallId.length > 0 && entity.parentWallId.length <= 160 &&
    Number.isInteger(entity.parentWallSegmentIndex) && entity.parentWallSegmentIndex >= 0 && entity.parentWallSegmentIndex <= 2_047
  )
  const validStableWallAttachment = (entity.wallEdgeId == null && entity.startT == null && entity.endT == null) || (
    typeof entity.wallEdgeId === 'string' && entity.wallEdgeId.length > 0 && entity.wallEdgeId.length <= 200 &&
    Number.isFinite(entity.startT) && entity.startT >= 0 && entity.startT <= 1 &&
    Number.isFinite(entity.endT) && entity.endT >= 0 && entity.endT <= 1 &&
    Math.abs(entity.endT - entity.startT) > 0.0001
  )
  if (!validLegacyWallAttachment || !validStableWallAttachment) return false
  if (kind === 'wall') return entity.points.length >= 2 && entity.points.length <= 2_048 &&
    (entity.material == null || ['stone', 'brick', 'wood', 'metal', 'natural'].includes(entity.material)) &&
    (entity.edgeIds == null || (
      Array.isArray(entity.edgeIds) && entity.edgeIds.length === entity.points.length - 1 &&
      entity.edgeIds.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 200) &&
      new Set(entity.edgeIds).size === entity.edgeIds.length
    ))
  if (kind === 'door') {
    if (!(entity.points.length === 2 &&
      (['open', 'closed', 'locked'].includes(entity.state) || ['open', 'closed'].includes(entity.openState)) &&
      (entity.openState == null || ['open', 'closed'].includes(entity.openState)) &&
      (entity.lockState == null || ['unlocked', 'locked', 'jammed'].includes(entity.lockState)) &&
      (entity.physicalState == null || ['intact', 'broken', 'destroyed'].includes(entity.physicalState)) &&
      typeof entity.secret === 'boolean') ||
      (entity.hinge != null && !['start', 'end'].includes(entity.hinge)) ||
      (entity.swing != null && !['clockwise', 'counterclockwise'].includes(entity.swing))) return false
    if (entity.revealedToMemberIds != null && (
      !Array.isArray(entity.revealedToMemberIds) || entity.revealedToMemberIds.length > 64 ||
      entity.revealedToMemberIds.some((id) => typeof id !== 'string' || !id || id.length > 160)
    )) return false
    if (entity.interaction != null && (
      !plainObject(entity.interaction) || !Number.isFinite(entity.interaction.lockPickDc) ||
      !Number.isFinite(entity.interaction.breakDc) || !Number.isFinite(entity.interaction.secretDc) ||
      typeof entity.interaction.requiresThievesTools !== 'boolean' ||
      (entity.interaction.keyItemId != null && typeof entity.interaction.keyItemId !== 'string')
    )) return false
    return true
  }
  if (kind === 'window') {
    return entity.points.length === 2 && ['glass', 'bars', 'shutters', 'opening'].includes(entity.windowType) &&
      (entity.windowState == null || ['closed', 'open', 'broken'].includes(entity.windowState)) &&
      (entity.cover == null || ['none', 'half', 'three-quarters', 'total'].includes(entity.cover))
  }
  return entity.points.length >= 3 && entity.points.length <= 2_048 &&
    ['none', 'half', 'three-quarters', 'total'].includes(entity.cover) &&
    (entity.terrainCostMultiplier == null || (Number.isFinite(entity.terrainCostMultiplier) && entity.terrainCostMultiplier >= 1 && entity.terrainCostMultiplier <= 10)) &&
    (entity.traversal == null || ['ground', 'climb', 'swim'].includes(entity.traversal)) &&
    (entity.terrainRegion == null || typeof entity.terrainRegion === 'boolean') &&
    (entity.terrainElevationFeet == null || (
      Number.isFinite(entity.terrainElevationFeet) && entity.terrainElevationFeet >= -1_000 && entity.terrainElevationFeet <= 10_000
    ))
}

function validGeometryLight(entity) {
  return plainObject(entity) && entity.kind === 'light' && typeof entity.id === 'string' && entity.id.length > 0 &&
    typeof entity.label === 'string' && Array.isArray(entity.points) && entity.points.length === 1 &&
    entity.points.every(validGeometryPoint) && typeof entity.enabled === 'boolean' &&
    Number.isFinite(entity.brightRadiusFeet) && entity.brightRadiusFeet >= 0 && entity.brightRadiusFeet <= 10_000 &&
    Number.isFinite(entity.dimRadiusFeet) && entity.dimRadiusFeet >= 0 && entity.dimRadiusFeet <= 10_000 &&
    typeof entity.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(entity.color) &&
    Number.isFinite(entity.elevationFeet) && Number.isFinite(entity.createdAt) && validTimedLightState(entity)
}

function validateMapGeometryState(value) {
  if (![1, 2, 3].includes(value.schemaVersion) || !Array.isArray(value.maps) || value.maps.length > 4_096) return 'invalid-map-geometry'
  const mapIds = new Set()
  for (const map of value.maps) {
    if (
      !plainObject(map) || typeof map.mapId !== 'string' || !map.mapId || mapIds.has(map.mapId) ||
      !Array.isArray(map.walls) || !Array.isArray(map.doors) || !Array.isArray(map.obstacles) ||
      (value.schemaVersion >= 2
        ? !Array.isArray(map.windows) || !Array.isArray(map.lights)
        : map.windows != null && !Array.isArray(map.windows) || map.lights != null && !Array.isArray(map.lights)) ||
      map.walls.length + map.doors.length + (Array.isArray(map.windows) ? map.windows.length : 0) +
        map.obstacles.length + (Array.isArray(map.lights) ? map.lights.length : 0) > 4_096 ||
      !plainObject(map.vision) || typeof map.vision.enabled !== 'boolean' ||
      typeof map.vision.sharePartyVision !== 'boolean' || !Number.isFinite(map.vision.defaultRangeFeet) ||
      (map.vision.ambientLight != null && !['bright', 'dim', 'darkness'].includes(map.vision.ambientLight)) ||
      map.vision.defaultRangeFeet < 0 || !Number.isFinite(map.updatedAt)
    ) return 'invalid-map-geometry'
    mapIds.add(map.mapId)
    if (
      !map.walls.every((entity) => validGeometryEntity(entity, 'wall')) ||
      !map.doors.every((entity) => validGeometryEntity(entity, 'door')) ||
      !(Array.isArray(map.windows) ? map.windows : []).every((entity) => validGeometryEntity(entity, 'window')) ||
      !map.obstacles.every((entity) => validGeometryEntity(entity, 'obstacle')) ||
      !(Array.isArray(map.lights) ? map.lights : []).every(validGeometryLight)
    ) return 'invalid-map-geometry'
    const entityIds = [
      ...map.walls, ...map.doors, ...(Array.isArray(map.windows) ? map.windows : []),
      ...map.obstacles, ...(Array.isArray(map.lights) ? map.lights : []),
    ].map((entity) => entity.id)
    if (new Set(entityIds).size !== entityIds.length) return 'duplicate-map-geometry-entity'
    if (value.schemaVersion >= 3 && (
      validateGeometryStructure(map).length > 0 ||
      validateGeometryRelationships(map).length > 0
    )) {
      return 'invalid-map-geometry-relationships'
    }
  }
  return null
}

function validateMapExplorationState(value) {
  if (value.schemaVersion !== 1 || !Array.isArray(value.maps) || value.maps.length > 4_096) return 'invalid-map-exploration'
  const mapIds = new Set()
  for (const map of value.maps) {
    if (!plainObject(map) || typeof map.mapId !== 'string' || !map.mapId || mapIds.has(map.mapId) ||
      !plainObject(map.byMemberId) || !Number.isFinite(map.updatedAt)) return 'invalid-map-exploration'
    mapIds.add(map.mapId)
    for (const [memberId, member] of Object.entries(map.byMemberId)) {
      if (!memberId || memberId.length > 160 || !plainObject(member) || !Array.isArray(member.polygons) ||
        member.polygons.length > 256 || !Number.isFinite(member.updatedAt)) return 'invalid-map-exploration'
      if (member.polygons.some((polygon) => !Array.isArray(polygon) || polygon.length < 3 || polygon.length > 512 ||
        !polygon.every(validGeometryPoint))) return 'invalid-map-exploration'
    }
  }
  return null
}

const COMBAT_STATISTIC_NUMBER_FIELDS = [
  'turnsTaken', 'turnTrackedDamageDealt', 'turnTrackedHealingDone',
  'damageDealt', 'damageTaken', 'healingDone', 'healingReceived', 'temporaryHpGranted', 'damagePrevented',
  'hostileConditionsApplied', 'attacks', 'hits', 'criticalHits', 'knockouts', 'kills', 'alliesRescued',
  'successfulSaves', 'failedSaves', 'concentrationChecks', 'concentrationMaintained', 'actionsSpent',
  'bonusActionsSpent', 'reactionsSpent', 'movementSpentFeet', 'classResourcesSpent', 'spellSlotsSpent',
]

function validateCombatStatisticsState(value) {
  if (![1, 2, 3].includes(value.schemaVersion) || !Array.isArray(value.sessions) || value.sessions.length > 24 ||
    !Number.isFinite(value.updatedAt) || value.updatedAt < 0) return 'invalid-combat-statistics'
  const combatIds = new Set()
  for (const session of value.sessions) {
    if (!plainObject(session) || typeof session.combatId !== 'string' || !session.combatId ||
      combatIds.has(session.combatId) || typeof session.mapId !== 'string' || !session.mapId ||
      !Number.isFinite(session.startedAt) || session.startedAt < 0 ||
      !Number.isFinite(session.updatedAt) || session.updatedAt < 0 ||
      !Number.isFinite(session.lastRound) || session.lastRound < 0 || !plainObject(session.combatants) ||
      Object.keys(session.combatants).length > 512 || !Array.isArray(session.receipts) || session.receipts.length > 4_096 ||
      session.receipts.some((receipt) => typeof receipt !== 'string' || !receipt || receipt.length > 160)) {
      return 'invalid-combat-statistics'
    }
    combatIds.add(session.combatId)
    for (const [combatantId, stats] of Object.entries(session.combatants)) {
      const requiredNumberFields = value.schemaVersion >= 3
        ? COMBAT_STATISTIC_NUMBER_FIELDS
        : COMBAT_STATISTIC_NUMBER_FIELDS.filter((field) =>
          field !== 'turnsTaken' &&
          field !== 'turnTrackedDamageDealt' &&
          field !== 'turnTrackedHealingDone')
      if (!combatantId || combatantId.length > 160 || !plainObject(stats) || stats.combatantId !== combatantId ||
        (stats.characterId != null && (typeof stats.characterId !== 'string' || !stats.characterId || stats.characterId.length > 160)) ||
        typeof stats.name !== 'string' || stats.name.length > 240 || !['player', 'enemy', 'npc'].includes(stats.side) ||
        requiredNumberFields.some((field) => !Number.isFinite(stats[field]) || stats[field] < 0) ||
        (value.schemaVersion >= 3 && (
          !Array.isArray(stats.combatD20FaceCounts) ||
          stats.combatD20FaceCounts.length !== 20 ||
          stats.combatD20FaceCounts.some((count) => !Number.isSafeInteger(count) || count < 0)
        ))) {
        return 'invalid-combat-statistics'
      }
    }
    const settlement = session.experienceSettlement
    if (settlement != null) {
      if (!plainObject(settlement) || settlement.combatId !== session.combatId || settlement.mapId !== session.mapId ||
        !['even', 'manual', 'none'].includes(settlement.mode) ||
        !Number.isSafeInteger(settlement.totalXp) || settlement.totalXp < 0 ||
        !Number.isSafeInteger(settlement.awardedXp) || settlement.awardedXp < 0 || settlement.awardedXp > settlement.totalXp ||
        !Number.isFinite(settlement.settledAt) || settlement.settledAt < 0 ||
        !Array.isArray(settlement.defeatedMonsters) || settlement.defeatedMonsters.length > 512 ||
        !Array.isArray(settlement.awards) || settlement.awards.length > 128) {
        return 'invalid-combat-statistics'
      }
      for (const monster of settlement.defeatedMonsters) {
        if (!plainObject(monster) || typeof monster.tokenId !== 'string' || !monster.tokenId || monster.tokenId.length > 200 ||
          typeof monster.name !== 'string' || !monster.name || monster.name.length > 240 ||
          (monster.monsterId != null && (typeof monster.monsterId !== 'string' || monster.monsterId.length > 200)) ||
          (monster.challengeRating != null && (typeof monster.challengeRating !== 'string' || monster.challengeRating.length > 16)) ||
          !Number.isSafeInteger(monster.xp) || monster.xp < 0) {
          return 'invalid-combat-statistics'
        }
      }
      const awardIds = new Set()
      let awardedXp = 0
      for (const award of settlement.awards) {
        if (!plainObject(award) || typeof award.characterId !== 'string' || !award.characterId || award.characterId.length > 200 ||
          awardIds.has(award.characterId) || typeof award.characterName !== 'string' || !award.characterName || award.characterName.length > 240 ||
          !Number.isSafeInteger(award.xp) || award.xp < 0) {
          return 'invalid-combat-statistics'
        }
        awardIds.add(award.characterId)
        awardedXp += award.xp
        if (!Number.isSafeInteger(awardedXp)) return 'invalid-combat-statistics'
      }
      if (awardedXp !== settlement.awardedXp ||
        (settlement.mode === 'none'
          ? settlement.awards.length > 0 || awardedXp !== 0
          : awardedXp !== settlement.totalXp)) {
        return 'invalid-combat-statistics'
      }
    }
  }
  return null
}

function geometryPointInPolygon(point, polygon) {
  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const currentPoint = polygon[index]
    const previousPoint = polygon[previous]
    if (
      (currentPoint.y > point.y) !== (previousPoint.y > point.y) &&
      point.x < (previousPoint.x - currentPoint.x) * (point.y - currentPoint.y) /
        ((previousPoint.y - currentPoint.y) || 1e-9) + currentPoint.x
    ) inside = !inside
  }
  return inside
}

function terrainElevationAtPoint(geometry, point) {
  let elevation = 0
  for (const obstacle of geometry?.obstacles ?? []) {
    if (!Number.isFinite(obstacle?.terrainElevationFeet) || !Array.isArray(obstacle.points)) continue
    if (geometryPointInPolygon(point, obstacle.points)) elevation = obstacle.terrainElevationFeet
  }
  return elevation
}

function tokenElevationFeet(geometry, token) {
  const terrain = terrainElevationAtPoint(geometry, token)
  return Number.isFinite(token?.elevationFeet) ? Math.max(terrain, token.elevationFeet) : terrain
}

function tokenHeightFeet(token) {
  return Math.max(5, Math.max(1, Number(token?.size) || 1) * 5)
}

function clampTokenToMap(map, token) {
  const width = Math.max(1, Number(map?.width) || 1)
  const height = Math.max(1, Number(map?.height) || 1)
  const gridSize = Math.max(1, Number(map?.gridSize) || 1)
  const creatureFootprint = {
    '微型': 1,
    '小型': 1,
    '中型': 1,
    '大型': 2,
    '超大型': 3,
    '巨型': 4,
  }[token?.creatureSize]
  const footprintCells = creatureFootprint ?? Math.max(1, Math.round(Number(token?.size) || 1))
  const halfExtent = footprintCells * gridSize / 2
  const clampAxis = (value, extent) => {
    if (extent <= halfExtent * 2) return extent / 2
    const finiteValue = Number.isFinite(value) ? Number(value) : extent / 2
    return Math.max(halfExtent, Math.min(extent - halfExtent, finiteValue))
  }
  const x = clampAxis(token?.x, width)
  const y = clampAxis(token?.y, height)
  return x === token?.x && y === token?.y ? token : { ...token, x, y }
}

function tokenVisibilitySamples(token, gridSize) {
  const radius = Math.max(1, gridSize * Math.max(1, Number(token?.size) || 1) * 0.4)
  return [
    { x: token.x, y: token.y },
    { x: token.x - radius, y: token.y - radius },
    { x: token.x + radius, y: token.y - radius },
    { x: token.x + radius, y: token.y + radius },
    { x: token.x - radius, y: token.y + radius },
  ]
}

const DEFAULT_PLAYER_VISION_RANGE_FEET = 30

// 与 src/lib/fogOfWar.ts 的 fogPointState 保持同一语义：按绘制顺序评估
// cover/reveal，后画的形状覆盖先画的；未填充地图上不在任何形状内的点为 neutral。
function fogShapeContainsPoint(shape, x, y) {
  if (!plainObject(shape)) return false
  if (shape.kind === 'rect') {
    return x >= shape.x && x <= shape.x + shape.width && y >= shape.y && y <= shape.y + shape.height
  }
  if (shape.kind === 'circle') {
    const dx = x - shape.x
    const dy = y - shape.y
    return dx * dx + dy * dy <= shape.radius * shape.radius
  }
  if (shape.kind === 'polygon') {
    const points = Array.isArray(shape.points) ? shape.points : []
    let inside = false
    for (let i = 0, j = points.length - 2; i < points.length; j = i, i += 2) {
      const xi = points[i]
      const yi = points[i + 1]
      const xj = points[j]
      const yj = points[j + 1]
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
    }
    return inside
  }
  if (shape.kind === 'brush') {
    const points = Array.isArray(shape.points) ? shape.points : []
    const radius = Math.max(0, Number(shape.width) || 0) / 2
    const radiusSquared = radius * radius
    for (let i = 0; i + 3 < points.length; i += 2) {
      const ax = points[i]
      const ay = points[i + 1]
      const dx = points[i + 2] - ax
      const dy = points[i + 3] - ay
      const lengthSquared = dx * dx + dy * dy
      const t = lengthSquared > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSquared)) : 0
      const px = ax + dx * t - x
      const py = ay + dy * t - y
      if (px * px + py * py <= radiusSquared) return true
    }
    if (points.length === 2) {
      const px = points[0] - x
      const py = points[1] - y
      return px * px + py * py <= radiusSquared
    }
  }
  return false
}

export function fogPointState(fog, x, y) {
  if (!plainObject(fog)) return 'neutral'
  let state = fog.filled === true ? 'covered' : 'neutral'
  for (const shape of Array.isArray(fog.shapes) ? fog.shapes : []) {
    if (fogShapeContainsPoint(shape, x, y)) state = shape.operation === 'cover' ? 'covered' : 'revealed'
  }
  return state
}

function campaignLightActive(light, worldMinute = null) {
  if (light?.enabled !== true) return false
  return !Number.isFinite(worldMinute) || !Number.isFinite(light.expiresAtWorldMinute) ||
    Number(worldMinute) < Number(light.expiresAtWorldMinute)
}

function geometryObstacleAffectsElevation(obstacle, elevationFeet, creatureHeightFeet = 5) {
  const baseHeightFeet = Number(obstacle?.baseHeightFeet) || 0
  const heightFeet = Number(obstacle?.heightFeet) || 0
  if (heightFeet > 0) {
    return elevationFeet < baseHeightFeet + heightFeet - 1e-7 &&
      elevationFeet + creatureHeightFeet > baseHeightFeet + 1e-7
  }
  const surfaceElevation = Number.isFinite(obstacle?.terrainElevationFeet)
    ? Number(obstacle.terrainElevationFeet)
    : baseHeightFeet
  return Math.abs(elevationFeet - surfaceElevation) <= 1e-4
}

function spellLightingRadius(source) {
  return source.kind === 'light'
    ? source.brightRadiusFeet + source.dimRadiusFeet
    : source.radiusFeet
}

function spellLightingAffectsPoint(source, point, map, elevationFeet = 0) {
  const feetPerCell = Math.max(1, Number(map.feetPerCell) || 5)
  const gridSize = Math.max(1, Number(map.gridSize) || 1)
  const horizontalDistanceFeet = Math.hypot(
    point.x - source.point.x,
    point.y - source.point.y,
  ) / gridSize * feetPerCell
  const distanceFeet = Math.hypot(
    horizontalDistanceFeet,
    elevationFeet - (Number(source.elevationFeet) || 0),
  )
  return distanceFeet <= spellLightingRadius(source)
}

function mapSpellLightingSources(map, geometry) {
  const gridSize = Math.max(1, Number(map.gridSize) || 1)
  const candidates = (Array.isArray(map?.dnd5ePluginAreas) ? map.dnd5ePluginAreas : [])
    .flatMap((area) => {
      const lighting = area?.lighting
      const anchor = area?.anchorCell ?? (Array.isArray(area?.cells) ? area.cells[0] : null)
      if (!plainObject(lighting) || !plainObject(anchor)) return []
      const point = {
        x: (Number(map.gridOffsetX) || 0) + (Number(anchor.col) + 0.5) * gridSize,
        y: (Number(map.gridOffsetY) || 0) + (Number(anchor.row) + 0.5) * gridSize,
      }
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return []
      const anchorToken = typeof area.anchorTokenId === 'string'
        ? (map.tokens ?? []).find((token) => token?.id === area.anchorTokenId)
        : null
      const elevationFeet = anchorToken
        ? tokenElevationFeet(geometry, anchorToken)
        : terrainElevationAtPoint(geometry, point)
      const spellLevel = Math.max(0, Math.floor(Number(lighting.spellLevel) || 0))
      if (lighting.kind === 'light') {
        return [{
          id: `spell-light:${area.id}`,
          kind: 'light',
          point,
          elevationFeet,
          spellLevel,
          brightRadiusFeet: Math.max(0, Number(lighting.brightRadiusFeet) || 0),
          dimRadiusFeet: Math.max(0, Number(lighting.dimRadiusFeet) || 0),
          suppressesMagicalDarknessThroughLevel:
            Number.isFinite(lighting.suppressesMagicalDarknessThroughLevel)
              ? Number(lighting.suppressesMagicalDarknessThroughLevel)
              : null,
        }]
      }
      if (lighting.kind !== 'magical-darkness') return []
      return [{
        id: `spell-darkness:${area.id}`,
        kind: 'magical-darkness',
        point,
        elevationFeet,
        spellLevel,
        radiusFeet: Math.max(0, Number(lighting.radiusFeet) || 0),
        suppressesMagicalLightThroughLevel:
          Number.isFinite(lighting.suppressesMagicalLightThroughLevel)
            ? Number(lighting.suppressesMagicalLightThroughLevel)
            : null,
      }]
    })
  const feetPerCell = Math.max(1, Number(map.feetPerCell) || 5)
  return candidates.filter((candidate) => !candidates.some((other) => {
    if (other.id === candidate.id || other.kind === candidate.kind) return false
    const distanceFeet = Math.hypot(
      candidate.point.x - other.point.x,
      candidate.point.y - other.point.y,
    ) / gridSize * feetPerCell
    if (distanceFeet > spellLightingRadius(candidate) + spellLightingRadius(other)) return false
    return candidate.kind === 'magical-darkness'
      ? other.kind === 'light' &&
          (other.suppressesMagicalDarknessThroughLevel ?? -1) >= candidate.spellLevel
      : other.kind === 'magical-darkness' &&
          (other.suppressesMagicalLightThroughLevel ?? -1) >= candidate.spellLevel
  }))
}

function magicalDarknessObstacleSuppressed(obstacle, map, spellLighting) {
  const darknessLevel = Math.max(0, Math.floor(Number(obstacle?.darknessSpellLevel) || 2))
  const gridSize = Math.max(1, Number(map.gridSize) || 1)
  const feetPerCell = Math.max(1, Number(map.feetPerCell) || 5)
  return spellLighting.some((source) => {
    if (
      source.kind !== 'light' ||
      (source.suppressesMagicalDarknessThroughLevel ?? -1) < darknessLevel
    ) return false
    const radiusPx = spellLightingRadius(source) / feetPerCell * gridSize
    if (geometryPointInPolygon(source.point, obstacle.points)) return true
    return obstacle.points.some((point) =>
      Math.hypot(point.x - source.point.x, point.y - source.point.y) <= radiusPx,
    ) || obstacle.points.some((point, index) =>
      projectPointToSegment(
        source.point,
        point,
        obstacle.points[(index + 1) % obstacle.points.length],
      ).distance <= radiusPx,
    )
  })
}

function mapIlluminationAtPoint(map, geometry, point, elevationFeet, lineBlocked) {
  const spellLighting = mapSpellLightingSources(map, geometry)
  const magicalDarkness = (geometry?.obstacles ?? []).some((obstacle) =>
    obstacle?.magicalDarkness === true &&
    Array.isArray(obstacle.points) &&
    geometryPointInPolygon(point, obstacle.points) &&
    geometryObstacleAffectsElevation(obstacle, elevationFeet) &&
    !magicalDarknessObstacleSuppressed(obstacle, map, spellLighting),
  ) || spellLighting.some((source) =>
    source.kind === 'magical-darkness' &&
      spellLightingAffectsPoint(source, point, map, elevationFeet),
  )
  if (magicalDarkness) return 'magical-darkness'

  const ambient = geometry?.vision?.ambientLight ?? 'bright'
  if (ambient === 'bright') return 'bright'
  let result = ambient
  const gridSize = Math.max(1, Number(map.gridSize) || 1)
  const feetPerCell = Math.max(1, Number(map.feetPerCell) || 5)
  for (const source of map.tokens ?? []) {
    const light = source?.lightSource
    if (!light?.enabled) continue
    const distanceFeet = Math.hypot(point.x - source.x, point.y - source.y) / gridSize * feetPerCell
    const brightRadius = Math.max(0, Number(light.brightRadiusFeet) || 0)
    const dimRadius = brightRadius + Math.max(0, Number(light.dimRadiusFeet) || 0)
    const sourceEye = tokenElevationFeet(geometry, source) + tokenHeightFeet(source) / 2
    if (distanceFeet > dimRadius || lineBlocked(source, point, sourceEye, elevationFeet + 2.5)) continue
    if (distanceFeet <= brightRadius) return 'bright'
    result = 'dim'
  }
  for (const source of geometry?.lights ?? []) {
    if (!source?.enabled || !Array.isArray(source.points) || !source.points[0]) continue
    const sourcePoint = source.points[0]
    const distanceFeet = Math.hypot(point.x - sourcePoint.x, point.y - sourcePoint.y) /
      gridSize * feetPerCell
    const brightRadius = Math.max(0, Number(source.brightRadiusFeet) || 0)
    const dimRadius = brightRadius + Math.max(0, Number(source.dimRadiusFeet) || 0)
    const sourceBase = Math.max(
      terrainElevationAtPoint(geometry, sourcePoint),
      Number.isFinite(source.elevationFeet) ? Number(source.elevationFeet) : 0,
    )
    if (distanceFeet > dimRadius || lineBlocked(sourcePoint, point, sourceBase + 2.5, elevationFeet + 2.5)) continue
    if (distanceFeet <= brightRadius) return 'bright'
    result = 'dim'
  }
  for (const source of spellLighting) {
    if (
      source.kind !== 'light' ||
      !spellLightingAffectsPoint(source, point, map, elevationFeet) ||
      lineBlocked(source.point, point, source.elevationFeet + 2.5, elevationFeet + 2.5)
    ) continue
    const distanceFeet = Math.hypot(point.x - source.point.x, point.y - source.point.y) /
      gridSize * feetPerCell
    if (distanceFeet <= source.brightRadiusFeet) return 'bright'
    result = 'dim'
  }
  return result
}

function playerCanSeeToken(map, geometry, viewer, target, fallbackRangeFeet = null, lightingEnabled = true) {
  const feetPerCell = Math.max(1, Number(map.feetPerCell) || 5)
  const gridSize = Math.max(1, Number(map.gridSize) || 1)
  const profile = compileDnd5eEffectiveVisionProfile({
    token: viewer,
    fallbackRangeFeet: Number.isFinite(fallbackRangeFeet)
      ? fallbackRangeFeet
      : Number.isFinite(geometry?.vision?.defaultRangeFeet)
        ? geometry.vision.defaultRangeFeet
        : DEFAULT_PLAYER_VISION_RANGE_FEET,
  })
  const carriedLightRangeFeet = viewer.lightSource?.enabled === true
    ? Math.max(0, Number(viewer.lightSource.brightRadiusFeet) || 0) + Math.max(0, Number(viewer.lightSource.dimRadiusFeet) || 0)
    : 0
  const rangeFeet = Math.max(
    profile.normalRangeFeet,
    profile.darkvisionRangeFeet,
    profile.darknessSightRangeFeet,
    profile.magicalDarknessSightRangeFeet,
    profile.blindsightRangeFeet,
    profile.truesightRangeFeet,
    carriedLightRangeFeet,
  )
  const rangePx = rangeFeet / feetPerCell * gridSize
  const targetRadiusPx = Math.max(0, gridSize * Math.max(1, Number(target.size) || 1) * 0.4)
  const distancePx = Math.max(0, Math.hypot(target.x - viewer.x, target.y - viewer.y) - targetRadiusPx)
  if (distancePx > rangePx) return false
  const fromElevation = tokenElevationFeet(geometry, viewer)
  const toElevation = tokenElevationFeet(geometry, target)
  const fromEyeElevation = fromElevation + tokenHeightFeet(viewer) / 2
  const toEyeElevation = toElevation + tokenHeightFeet(target) / 2
  const compiled = compileGeometryCached(geometry)
  const lineBlocked = (from, to, sourceEyeElevation = 2.5, destinationEyeElevation = 2.5) => !!raycastGeometry({
    compiled,
    from,
    to,
    purpose: 'vision',
    fromElevationFeet: sourceEyeElevation,
    toElevationFeet: destinationEyeElevation,
    ignoreStart: true,
  })
  const targetSamples = tokenVisibilitySamples(target, gridSize)
  if (targetSamples.every((sample) => lineBlocked(viewer, sample, fromEyeElevation, toEyeElevation))) return false
  const illumination = lightingEnabled
    ? mapIlluminationAtPoint(map, geometry, target, toElevation, lineBlocked)
    : 'bright'
  const distanceFeet = distancePx / gridSize * feetPerCell
  if (illumination === 'magical-darkness') {
    if (distanceFeet > Math.max(
      profile.magicalDarknessSightRangeFeet,
      profile.blindsightRangeFeet,
      profile.truesightRangeFeet,
    )) return false
  } else if (
    illumination === 'darkness' &&
    distanceFeet > Math.max(
      profile.darkvisionRangeFeet,
      profile.darknessSightRangeFeet,
      profile.blindsightRangeFeet,
      profile.truesightRangeFeet,
    )
  ) {
    return false
  }
  return true
}

function playerSpecialSenseRange(viewer, target, kind, map) {
  const property = kind === 'blindsight' ? 'blindsightRangeFeet'
    : kind === 'tremorsense' ? 'tremorsenseRangeFeet'
      : 'truesightRangeFeet'
  const rangeFeet = Number.isFinite(viewer?.[property]) ? Math.max(0, viewer[property]) : 0
  if (rangeFeet <= 0) return false
  const feetPerCell = Math.max(1, Number(map.feetPerCell) || 5)
  const gridSize = Math.max(1, Number(map.gridSize) || 1)
  const targetRadiusPx = Math.max(0, gridSize * Math.max(1, Number(target.size) || 1) * 0.4)
  return Math.max(0, Math.hypot(target.x - viewer.x, target.y - viewer.y) - targetRadiusPx) /
    gridSize * feetPerCell <= rangeFeet
}

function tokenHiddenCheckTotal(token) {
  const total = token?.dnd5eCombatState?.hiddenCheckTotal
  return Number.isFinite(total) ? Math.max(0, Math.floor(total)) : null
}

function tokenIsInvisible(token) {
  const state = token?.dnd5eCombatState
  return state?.conditions?.includes('invisible') === true ||
    state?.activeEffects?.some((effect) => effect?.standardCondition === 'invisible') === true
}

function passivePerceptionForViewer(viewer, characterById) {
  const character = typeof viewer?.characterId === 'string' ? characterById.get(viewer.characterId) : null
  if (
    Number.isFinite(character?.abilities?.wis) && Number.isFinite(character?.level) &&
    Array.isArray(character?.skills)
  ) {
    const level = Math.max(1, Math.min(20, Math.floor(character.level)))
    const proficiencyBonus = 2 + Math.floor((level - 1) / 4)
    const classId = character.charClass === '吟游诗人' ? 'bard'
      : character.charClass === '游荡者' ? 'rogue'
        : character.charClass === '邪术师' ? 'warlock'
          : null
    const selections = classId ? character.dnd5eClassChoices?.classes?.[classId]?.selections ?? {} : {}
    const loreProficiency = character.charClass === '吟游诗人' &&
      Array.isArray(selections['lore-bonus-skills']) && selections['lore-bonus-skills'].includes('perception')
    const proficient = character.skills.includes('perception') || loreProficiency
    const expertise = proficient && Array.isArray(selections.expertise) && selections.expertise.includes('perception')
    const unproficientBonus = !proficient && character.charClass === '吟游诗人' && level >= 2
      ? Math.floor(proficiencyBonus / 2)
      : 0
    const skillBonus = Math.floor((Math.max(1, Math.min(30, character.abilities.wis)) - 10) / 2) +
      (expertise ? proficiencyBonus * 2 : proficient ? proficiencyBonus : unproficientBonus)
    const passiveDisadvantage = (character.exhaustionLevel ?? 0) >= 1 ||
      (Array.isArray(character.conditions) && character.conditions.includes('poisoned')) ||
      (Array.isArray(character.dnd5eCombatState?.conditions) && character.dnd5eCombatState.conditions.includes('poisoned'))
    return Math.max(0, 10 + skillBonus - (passiveDisadvantage ? 5 : 0))
  }
  return Number.isFinite(character?.passivePerception)
    ? Math.max(0, Math.floor(character.passivePerception))
    : 10
}

function redactUnseenToken(token) {
  const {
    characterId: _characterId,
    creatureTypes: _creatureTypes,
    creatureSize: _creatureSize,
    hp: _hp,
    maxHp: _maxHp,
    poolId: _poolId,
    dnd5eCombatState: _dnd5eCombatState,
    obstacleKind: _obstacleKind,
    ...position
  } = token
  return {
    ...position,
    size: 1,
    label: '未见生物',
    emoji: '◇',
    color: '#64748b',
    showHpOnToken: false,
    showDetailOnToken: false,
    perceptionVisibility: 'detected-unseen',
  }
}

export function projectMapsForPlayer(value, geometryState, activeCharacterId = null, characterState = null, viewerIdentity = null, fogState = null, worldMinute = null) {
  if (!plainObject(value) || !Array.isArray(value.maps)) return value
  const geometryByMapId = new Map((geometryState?.maps ?? []).map((geometry) => [geometry.mapId, geometry]))
  const fogByMapId = new Map((fogState?.maps ?? []).map((fog) => [fog.mapId, fog]))
  const characterById = new Map((characterState?.characters ?? [])
    .filter((character) => plainObject(character) && typeof character.id === 'string')
    .map((character) => [character.id, character]))
  const ownsCharacter = (character) =>
    (typeof viewerIdentity?.memberId === 'string' && character.roomMemberId === viewerIdentity.memberId) ||
    (typeof viewerIdentity?.accountId === 'string' && character.ownerAccountId === viewerIdentity.accountId)
  const requestedCharacterId = typeof activeCharacterId === 'string' && activeCharacterId.length > 0
    ? activeCharacterId
    : null
  const requestedCharacter = requestedCharacterId ? characterById.get(requestedCharacterId) : null
  // 显式角色 ID 同样必须通过账号/房间成员归属校验；名字绝不能作为权限凭据。
  // viewerIdentity 为空只用于纯函数/旧测试调用；真实 HTTP 投影始终传 roomMember。
  const resolvedActiveCharacterId = requestedCharacterId && !plainObject(viewerIdentity)
    ? requestedCharacterId
    : requestedCharacter && ownsCharacter(requestedCharacter)
      ? requestedCharacter.id
    : [...characterById.values()].find(ownsCharacter)?.id ?? null
  return {
    ...value,
    maps: value.maps.map((map) => {
      if (!plainObject(map) || !Array.isArray(map.tokens)) return map
      const effectiveMap = {
        ...map,
        tokens: map.tokens.map((token) => {
          if (!plainObject(token)) return token
          const bounded = clampTokenToMap(map, token)
          return plainObject(bounded.lightSource) && !campaignLightActive(bounded.lightSource, worldMinute)
            ? { ...bounded, lightSource: { ...bounded.lightSource, enabled: false } }
            : bounded
        }),
      }
      const rawGeometry = geometryByMapId.get(map.id)
      const geometry = plainObject(rawGeometry)
        ? {
            ...rawGeometry,
            lights: (Array.isArray(rawGeometry.lights) ? rawGeometry.lights : []).map((light) =>
              plainObject(light) && !campaignLightActive(light, worldMinute)
                ? { ...light, enabled: false }
                : light),
          }
        : rawGeometry
      const fog = fogByMapId.get(map.id)
      const dynamicVision = geometry?.vision?.enabled === true
      const manualFogActive = plainObject(fog) &&
        (fog.filled === true || (Array.isArray(fog.shapes) && fog.shapes.length > 0))
      const manualFallbackRangeFeet = Number.isFinite(geometry?.vision?.defaultRangeFeet)
        ? geometry.vision.defaultRangeFeet
        : DEFAULT_PLAYER_VISION_RANGE_FEET
      const players = effectiveMap.tokens
        .filter((token) => plainObject(token) && token.type === 'player')
        .map((token) => applyDnd5eEffectiveVisionProfile(
          token,
          compileDnd5eEffectiveVisionProfile({
            token,
            character: typeof token.characterId === 'string'
              ? characterById.get(token.characterId)
              : undefined,
            fallbackRangeFeet: dynamicVision
              ? geometry?.vision?.defaultRangeFeet
              : manualFallbackRangeFeet,
          }),
        ))
      const projectedPlayerById = new Map(players.map((token) => [token.id, token]))
      const viewers = geometry?.vision?.sharePartyVision === false
        ? players.filter((token) => token.characterId === resolvedActiveCharacterId)
        : players
      const tokens = effectiveMap.tokens.flatMap((token) => {
        if (!plainObject(token)) return []
        if (token.type === 'player') {
          const projectedPlayer = projectedPlayerById.get(token.id) ?? token
          return [{
            ...projectedPlayer,
            viewerControlled: resolvedActiveCharacterId != null && token.characterId === resolvedActiveCharacterId,
          }]
        }
        if (token.visibilityMode === 'always') return [token]
        if (token.visibilityMode === 'dm-only') return []
        // Owlbear 语义：手动迷雾覆盖处的 Token 必须靠实际视野才可见；DM 明确
        // reveal 的区域即使开着动态视野也直接放行；两者都不命中时，动态视野
        // 决定是否仍要视野判定（探索过≠正在看见）。
        const fogState = manualFogActive ? fogPointState(fog, token.x, token.y) : 'neutral'
        const needVision = fogState === 'covered' || (dynamicVision && fogState !== 'revealed')
        const observingViewers = viewers.filter((viewer) =>
          !needVision ||
          playerCanSeeToken(
            effectiveMap,
            geometry,
            viewer,
            token,
            dynamicVision ? null : manualFallbackRangeFeet,
            dynamicVision,
          ),
        )
        const tremorsenseViewers = viewers.filter((viewer) =>
          playerSpecialSenseRange(viewer, token, 'tremorsense', effectiveMap) &&
          Math.abs(tokenElevationFeet(geometry, viewer) - tokenElevationFeet(geometry, token)) <= 5 &&
          tokenElevationFeet(geometry, token) <= terrainElevationAtPoint(geometry, token) + 1e-7,
        )
        if (observingViewers.length === 0) return tremorsenseViewers.length > 0 ? [redactUnseenToken(token)] : []
        const hiddenCheckTotal = tokenHiddenCheckTotal(token)
        if (
          hiddenCheckTotal != null &&
          !observingViewers.some((viewer) => passivePerceptionForViewer(viewer, characterById) >= hiddenCheckTotal)
        ) return tremorsenseViewers.length > 0 ? [redactUnseenToken(token)] : []
        const specialSenseSeesInvisible = observingViewers.some((viewer) =>
          playerSpecialSenseRange(viewer, token, 'blindsight', map) ||
          playerSpecialSenseRange(viewer, token, 'truesight', map),
        )
        return [tokenIsInvisible(token) && !specialSenseSeesInvisible ? redactUnseenToken(token) : token]
      })
      const visibleIds = new Set(tokens.map((token) => token.id))
      return {
        ...map,
        tokens,
        dnd5ePluginAreas: Array.isArray(map.dnd5ePluginAreas)
          ? map.dnd5ePluginAreas.filter((area) =>
              (!area?.sourceTokenId || visibleIds.has(area.sourceTokenId)) &&
              (area?.hiddenFromPlayers !== true || area?.sourceCharacterId === resolvedActiveCharacterId),
            )
          : map.dnd5ePluginAreas,
      }
    }),
  }
}

export function projectMapGeometryForPlayer(value, memberId = null, worldMinute = null) {
  if (!plainObject(value) || !Array.isArray(value.maps)) return value
  return {
    ...value,
    maps: value.maps.map((map) => {
      if (!plainObject(map) || !Array.isArray(map.doors) || !Array.isArray(map.walls)) return map
      const maySeeSecretDoor = (door) => door?.secret !== true || (
        typeof memberId === 'string' && Array.isArray(door.revealedToMemberIds) && door.revealedToMemberIds.includes(memberId)
      )
      const secretWalls = map.doors.flatMap((door) => {
        const parentWall = map.walls.find((wall) => wall?.id === door?.parentWallId)
        return !maySeeSecretDoor(door) && doorOpenState(door) !== 'open' ? [{
            id: `wall:${createHash('sha256').update(JSON.stringify([door.points, door.createdAt])).digest('hex').slice(0, 20)}`,
            kind: 'wall',
            label: '墙',
            points: door.points,
            material: parentWall?.material ?? 'stone',
            blocksVision: door.blocksVision,
            blocksMovement: door.blocksMovement,
            blocksLineOfEffect: door.blocksLineOfEffect,
            baseHeightFeet: door.baseHeightFeet,
            heightFeet: door.heightFeet,
            createdAt: door.createdAt,
          }] : []
      })
      const secretOpenings = map.doors.flatMap((door) => !maySeeSecretDoor(door) && doorOpenState(door) === 'open'
        ? [{
            id: `window:${createHash('sha256').update(JSON.stringify([door.points, door.createdAt, 'open'])).digest('hex').slice(0, 20)}`,
            kind: 'window',
            label: '开放通道',
            points: door.points,
            windowType: 'opening',
            parentWallId: door.parentWallId,
            parentWallSegmentIndex: door.parentWallSegmentIndex,
            blocksVision: false,
            blocksMovement: false,
            blocksLineOfEffect: false,
            baseHeightFeet: door.baseHeightFeet,
            heightFeet: door.heightFeet,
            createdAt: door.createdAt,
          }]
        : [],
      )
      return {
        ...map,
        walls: [...map.walls, ...secretWalls],
        doors: map.doors.filter(maySeeSecretDoor),
        windows: [...(Array.isArray(map.windows) ? map.windows : []), ...secretOpenings],
        lights: (Array.isArray(map.lights) ? map.lights : []).map((light) =>
          plainObject(light) && !campaignLightActive(light, worldMinute)
            ? { ...light, enabled: false }
            : light),
      }
    }),
  }
}

export function projectMapExplorationForPlayer(value, memberId = null) {
  if (!plainObject(value) || !Array.isArray(value.maps)) return value
  return {
    ...value,
    maps: value.maps.map((map) => {
      if (!plainObject(map) || !plainObject(map.byMemberId)) return map
      const member = typeof memberId === 'string' ? map.byMemberId[memberId] : undefined
      return { ...map, byMemberId: member ? { [memberId]: member } : {} }
    }),
  }
}

function validDnd5eEffectiveRulesContext(value) {
  if (!plainObject(value) || value.schemaVersion !== 1 || !Number.isInteger(value.revision) || value.revision < 1 ||
    typeof value.hash !== 'string' || value.hash.length < 1 || !plainObject(value.houseRules) ||
    !Array.isArray(value.sourceOrder) || !Array.isArray(value.requiredPlugins)) return false
  return value.requiredPlugins.every((plugin) => plainObject(plugin) &&
    typeof plugin.id === 'string' && plugin.id.length > 0 &&
    typeof plugin.version === 'string' && plugin.version.length > 0 &&
    (plugin.integrity == null || typeof plugin.integrity === 'string') &&
    (plugin.stateSchemaVersion == null || Number.isInteger(plugin.stateSchemaVersion)))
}

/**
 * Persistence-boundary validation. The browser performs more detailed
 * migrations, while this deliberately conservative shape check prevents a
 * scalar, truncated array, or wrong resource envelope from replacing a good
 * room state.
 */
export function validateSharedStateShape(name, value) {
  if (!plainObject(value)) return { ok: false, reason: 'state-must-be-object' }
  const requiredArrays = {
    characters: 'characters',
    maps: 'maps',
    spellbook: 'spells',
    'custom-monsters': 'monsters',
    'combat-log': 'entries',
    'room-chat': 'messages',
    'room-journal': 'handouts',
    'group-ability-checks': 'checks',
    'dice-events': 'events',
    'combat-interrupts': 'interrupts',
    'player-action-requests': 'requests',
    'player-action-processed': 'actionIds',
    'map-fog': 'maps',
    'map-geometry': 'maps',
    'map-exploration': 'maps',
    'combat-statistics': 'sessions',
    'scene-orchestration': 'scenes',
    'scene-audio-library': 'assets',
  }
  const arrayField = requiredArrays[name]
  if (arrayField && !Array.isArray(value[arrayField])) {
    return { ok: false, reason: `missing-array:${arrayField}` }
  }
  if (name === 'room-journal' && (!Array.isArray(value.campaignEntries) || !Array.isArray(value.sharedNotes))) {
    return { ok: false, reason: 'missing-journal-arrays' }
  }
  if (
    name === 'room-journal' &&
    value.authorityMutationReceipts != null &&
    (
      !Array.isArray(value.authorityMutationReceipts) ||
      value.authorityMutationReceipts.length > 512 ||
      value.authorityMutationReceipts.some((receipt) =>
        typeof receipt !== 'string' || !receipt.trim() || receipt.length > 300)
    )
  ) {
    return { ok: false, reason: 'invalid-journal-authority-receipts' }
  }
  if (value.updatedAt != null && (!Number.isFinite(value.updatedAt) || value.updatedAt < 0)) {
    return { ok: false, reason: 'invalid-updated-at' }
  }
  if (name === 'combat' && value.active != null && typeof value.active !== 'boolean') {
    return { ok: false, reason: 'invalid-combat-active' }
  }
  if (name === 'combat' && value.effectiveRules != null && !validDnd5eEffectiveRulesContext(value.effectiveRules)) {
    return { ok: false, reason: 'invalid-effective-rules' }
  }
  if (name === 'combat' && value.monsterControl != null) {
    const control = value.monsterControl
    if (
      !plainObject(control) ||
      control.schemaVersion !== 1 ||
      (control.mode !== 'automatic' && control.mode !== 'manual') ||
      typeof control.pauseRequested !== 'boolean' ||
      !Number.isFinite(control.updatedAt) ||
      control.updatedAt < 0 ||
      (
        control.controlledTokenId != null &&
        (
          typeof control.controlledTokenId !== 'string' ||
          !control.controlledTokenId.trim() ||
          control.controlledTokenId.length > 180
        )
      ) ||
      (
        control.requestedAt != null &&
        (!Number.isFinite(control.requestedAt) || control.requestedAt < 0)
      ) ||
      (
        control.pauseRequested &&
        (
          control.mode !== 'automatic' ||
          typeof control.controlledTokenId !== 'string' ||
          control.requestedAt == null
        )
      )
    ) {
      return { ok: false, reason: 'invalid-monster-control' }
    }
  }
  if (name === 'dm-authority-ready' && typeof value.ready !== 'boolean') {
    return { ok: false, reason: 'invalid-ready-state' }
  }
  if (value._sync != null) {
    const sync = value._sync
    if (
      !plainObject(sync) ||
      sync.schemaVersion !== SHARED_STATE_SCHEMA_VERSION ||
      !Number.isInteger(sync.revision) ||
      sync.revision < 0 ||
      typeof sync.writerId !== 'string' ||
      !Number.isFinite(sync.writtenAt)
    ) return { ok: false, reason: 'invalid-sync-metadata' }
  }
  const dnd5eStateReason = validateDnd5eResourceStates(name, value)
  if (dnd5eStateReason) return { ok: false, reason: dnd5eStateReason }
  if (name === 'combat-interrupts') {
    const interruptReason = validateCombatInterruptState(value)
    if (interruptReason) return { ok: false, reason: interruptReason }
  }
  if (name === 'map-geometry') {
    const geometryReason = validateMapGeometryState(value)
    if (geometryReason) return { ok: false, reason: geometryReason }
  }
  if (name === 'map-exploration') {
    const explorationReason = validateMapExplorationState(value)
    if (explorationReason) return { ok: false, reason: explorationReason }
  }
  if (name === 'combat-statistics') {
    const statisticsReason = validateCombatStatisticsState(value)
    if (statisticsReason) return { ok: false, reason: statisticsReason }
  }
  if (name === 'campaign-time') {
    const campaignTimeReason = validateCampaignTimeState(value)
    if (campaignTimeReason) return { ok: false, reason: campaignTimeReason }
  }
  return { ok: true }
}

async function rotateJsonDirectory(root, limit) {
  let entries = []
  try {
    entries = await readdir(root)
  } catch {
    return
  }
  const files = []
  for (const name of entries.filter((entry) => entry.endsWith('.json'))) {
    try {
      const info = await stat(path.join(root, name))
      files.push({ name, mtimeMs: info.mtimeMs })
    } catch {
      // Concurrent cleanup; the next pass will settle the directory.
    }
  }
  files.sort((left, right) => left.mtimeMs - right.mtimeMs)
  for (const entry of files.slice(0, Math.max(0, files.length - limit))) {
    await rm(path.join(root, entry.name), { force: true }).catch(() => {})
  }
}

const DM_UNDO_SCHEMA_VERSION = 1
const DM_UNDO_HISTORY_LIMIT = 100
const DM_UNDOABLE_STATE = new Set([
  'maps',
  'characters',
  'combat',
  'combat-interrupts',
  'combat-log',
  'map-geometry',
  'map-fog',
  'map-exploration',
  'campaign-time',
  'scene-orchestration',
  'scene-audio-playback',
])

function dmUndoJournalFile(ctx) {
  return path.join(snapshotRoot(ctx), 'dm-undo-journal.json')
}

function normalizeDmUndoJournal(value) {
  return {
    schemaVersion: DM_UNDO_SCHEMA_VERSION,
    revision: Number.isSafeInteger(value?.revision) ? Math.max(0, value.revision) : 0,
    transactions: Array.isArray(value?.transactions)
      ? value.transactions.filter((transaction) =>
          plainObject(transaction) &&
          typeof transaction.transactionId === 'string' &&
          Array.isArray(transaction.changes),
        ).slice(-DM_UNDO_HISTORY_LIMIT)
      : [],
    updatedAt: Number.isFinite(value?.updatedAt) ? value.updatedAt : 0,
  }
}

function dmUndoTransactionId(req) {
  const supplied = normalizedLabel(req?.headers?.['x-stars-undo-group'], 160)
  return supplied && /^[a-zA-Z0-9:_-]+$/.test(supplied)
    ? supplied
    : `request:${Date.now()}:${randomUUID()}`
}

function dmUndoLabel(req, fallback) {
  const supplied = String(req?.headers?.['x-stars-undo-label'] ?? '')
  if (!supplied) return fallback
  try {
    return normalizedLabel(decodeURIComponent(supplied), 120) || fallback
  } catch {
    return fallback
  }
}

async function appendDmUndoChange(ctx, input) {
  if (!DM_UNDOABLE_STATE.has(input.resource)) return null
  const filePath = dmUndoJournalFile(ctx)
  await mkdir(path.dirname(filePath), { recursive: true })
  return withWriteLock(filePath, async () => {
    let journal
    try {
      journal = normalizeDmUndoJournal(JSON.parse(await readFile(filePath, 'utf8')))
    } catch {
      journal = normalizeDmUndoJournal(null)
    }
    const index = journal.transactions.findIndex((candidate) =>
      candidate.transactionId === input.transactionId &&
      candidate.status === 'applied')
    const transaction = index >= 0
      ? journal.transactions[index]
      : {
          schemaVersion: DM_UNDO_SCHEMA_VERSION,
          transactionId: input.transactionId,
          label: input.label,
          actorMemberId: input.actorMemberId,
          status: 'applied',
          changes: [],
          createdAt: input.changedAt,
          updatedAt: input.changedAt,
        }
    const existingChangeIndex = transaction.changes.findIndex((change) =>
      change.resource === input.resource)
    const change = {
      resource: input.resource,
      before: input.before ?? null,
      beforeRevision: input.beforeRevision,
      afterRevision: input.afterRevision,
    }
    const changes = existingChangeIndex >= 0
      ? transaction.changes.map((candidate, changeIndex) =>
          changeIndex === existingChangeIndex
            ? { ...change, before: candidate.before, beforeRevision: candidate.beforeRevision }
            : candidate)
      : [...transaction.changes, change]
    const updatedTransaction = {
      ...transaction,
      label: transaction.label || input.label,
      changes,
      updatedAt: input.changedAt,
    }
    const transactions = index >= 0
      ? journal.transactions.map((candidate, transactionIndex) =>
          transactionIndex === index ? updatedTransaction : candidate)
      : [...journal.transactions, updatedTransaction]
    const next = {
      ...journal,
      revision: journal.revision + 1,
      transactions: transactions.slice(-DM_UNDO_HISTORY_LIMIT),
      updatedAt: input.changedAt,
    }
    await atomicRename(filePath, JSON.stringify(next))
    return updatedTransaction
  })
}

async function recordDmUndoMutation(req, ctx, member, resource, result, label) {
  if (
    ctx.accessRole !== 'dm' ||
    !member ||
    !result?.changed ||
    !DM_UNDOABLE_STATE.has(resource)
  ) return
  await appendDmUndoChange(ctx, {
    transactionId: dmUndoTransactionId(req),
    label: dmUndoLabel(req, label),
    actorMemberId: member.memberId,
    resource,
    before: result.previous,
    beforeRevision: sharedStateRevision(result.previous),
    afterRevision: sharedStateRevision(result.next),
    changedAt: Number(result.next?._sync?.writtenAt) || Date.now(),
  })
}

function dmUndoPublicTransaction(transaction) {
  return {
    transactionId: transaction.transactionId,
    label: transaction.label,
    status: transaction.status,
    resources: transaction.changes.map((change) => change.resource),
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
    ...(Number.isFinite(transaction.undoneAt) ? { undoneAt: transaction.undoneAt } : {}),
  }
}

async function readDmUndoJournal(ctx) {
  try {
    return normalizeDmUndoJournal(JSON.parse(await readFile(dmUndoJournalFile(ctx), 'utf8')))
  } catch {
    return normalizeDmUndoJournal(null)
  }
}

async function applyDmAuthoritativeUndo(ctx, requestedTransactionId, actorMemberId) {
  const journalPath = dmUndoJournalFile(ctx)
  await mkdir(path.dirname(journalPath), { recursive: true })
  return withWriteLock(journalPath, async () => {
    let journal
    try {
      journal = normalizeDmUndoJournal(JSON.parse(await readFile(journalPath, 'utf8')))
    } catch {
      journal = normalizeDmUndoJournal(null)
    }
    const transaction = [...journal.transactions].reverse().find((candidate) =>
      candidate.status === 'applied' &&
      (!requestedTransactionId || candidate.transactionId === requestedTransactionId))
    if (!transaction) throw new RoomProtocolError(404, 'dm-undo-transaction-not-found')

    const currentValues = new Map()
    for (const change of transaction.changes) {
      const resourcePath = path.join(ctx.stateRoot, `${safeName(change.resource)}.json`)
      let current = null
      try {
        current = JSON.parse(await readFile(resourcePath, 'utf8'))
      } catch {}
      const currentRevision = sharedStateRevision(current)
      if (currentRevision !== change.afterRevision) {
        throw new RoomProtocolError(409, 'dm-undo-state-changed')
      }
      currentValues.set(change.resource, current)
    }

    const restored = []
    try {
      for (const change of transaction.changes) {
        const resourcePath = path.join(ctx.stateRoot, `${safeName(change.resource)}.json`)
        const current = currentValues.get(change.resource)
        const result = change.before == null
          ? await atomicDeleteJsonStateCasLocked(resourcePath, {
              expectedRevision: change.afterRevision,
              writerId: `dm-undo:${transaction.transactionId}`,
            })
          : await atomicWriteJsonStateCasLocked(resourcePath, change.before, {
              expectedRevision: change.afterRevision,
              writerId: `dm-undo:${transaction.transactionId}`,
              validateIncoming: (candidate) => validateSharedStateShape(change.resource, candidate),
            })
        if (!result.ok) throw new RoomProtocolError(409, 'dm-undo-state-changed')
        restored.push({ change, result, current })
      }
    } catch (error) {
      for (const entry of restored.reverse()) {
        const rollbackPath = path.join(ctx.stateRoot, `${safeName(entry.change.resource)}.json`)
        const rollbackOptions = {
          expectedRevision: entry.result.revision,
          writerId: `dm-undo-rollback:${transaction.transactionId}`,
        }
        if (entry.current == null) {
          await atomicDeleteJsonStateCasLocked(rollbackPath, rollbackOptions).catch(() => {})
        } else {
          await atomicWriteJsonStateCasLocked(rollbackPath, entry.current, {
            ...rollbackOptions,
            validateIncoming: (candidate) => validateSharedStateShape(entry.change.resource, candidate),
          }).catch(() => {})
        }
      }
      throw error
    }

    const now = Date.now()
    const restoredByResource = new Map(restored.map((entry) => [
      entry.change.resource,
      entry,
    ]))
    const undoneChangesByResource = new Map(transaction.changes.map((change) => [
      change.resource,
      change,
    ]))
    const next = {
      ...journal,
      revision: journal.revision + 1,
      transactions: journal.transactions.map((candidate) => {
        if (candidate.transactionId === transaction.transactionId) {
          return {
              ...candidate,
              status: 'undone',
              undoneAt: now,
              undoneByMemberId: actorMemberId,
              updatedAt: now,
            }
        }
        if (candidate.status !== 'applied') return candidate
        let changed = false
        const changes = candidate.changes.map((change) => {
          const undoneChange = undoneChangesByResource.get(change.resource)
          const restoredEntry = restoredByResource.get(change.resource)
          if (
            undoneChange &&
            restoredEntry &&
            change.afterRevision === undoneChange.beforeRevision
          ) {
            changed = true
            return {
              ...change,
              afterRevision: restoredEntry.result.revision,
            }
          }
          return change
        })
        return changed ? { ...candidate, changes, updatedAt: now } : candidate
      }),
      updatedAt: now,
    }
    await atomicRename(journalPath, JSON.stringify(next))
    return {
      transaction: next.transactions.find((candidate) =>
        candidate.transactionId === transaction.transactionId),
      restored: restored.map((entry) => ({
        resource: entry.change.resource,
        revision: entry.result.revision,
      })),
    }
  })
}

async function quarantineSharedState(ctx, name, payload, reason) {
  const root = quarantineRoot(ctx)
  await mkdir(root, { recursive: true })
  const detectedAt = Date.now()
  const id = `${detectedAt}-${safeName(name)}-${randomUUID()}`
  await atomicWriteLocked(path.join(root, `${id}.json`), JSON.stringify({
    format: 'dndstars5e-quarantine',
    id,
    roomId: ctx.roomId ?? 'default',
    name,
    reason,
    detectedAt,
    payload,
  }))
  await rotateJsonDirectory(root, 20)
  return id
}

async function readValidStateDirectory(ctx) {
  const states = {}
  const invalid = []
  let entries = []
  try {
    entries = await readdir(ctx.stateRoot)
  } catch {
    return { states, invalid }
  }
  for (const fileName of entries.filter((entry) => entry.endsWith('.json')).sort()) {
    const name = fileName.slice(0, -5)
    try {
      const value = normalizeDedicatedDnd5eSharedState(name, JSON.parse(await readFile(path.join(ctx.stateRoot, fileName), 'utf8')))
      if (value?._deleted === true) continue
      const validation = validateSharedStateShape(name, value)
      if (!validation.ok) invalid.push({ name, reason: validation.reason })
      else states[name] = value
    } catch {
      invalid.push({ name, reason: 'invalid-json' })
    }
  }
  return { states, invalid }
}

async function readRoomForCampaign(ctx) {
  if ((ctx.roomId ?? 'default') === 'default') return null
  try {
    return JSON.parse(await readFile(roomLobbyFile(ctx, ctx.roomId), 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') throw new RoomProtocolError(404, 'room-not-found')
    throw error
  }
}

async function readMapGeometryForProjection(ctx) {
  const filePath = path.join(ctx.stateRoot, 'map-geometry.json')
  try {
    const value = JSON.parse(await readFile(filePath, 'utf8'))
    const validation = validateSharedStateShape('map-geometry', value)
    return validation.ok ? { value, corrupted: false } : { value: null, corrupted: true }
  } catch (error) {
    return error?.code === 'ENOENT'
      ? { value: null, corrupted: false }
      : { value: null, corrupted: true }
  }
}

async function readCampaignTimeForProjection(ctx) {
  const filePath = path.join(ctx.stateRoot, 'campaign-time.json')
  try {
    const value = JSON.parse(await readFile(filePath, 'utf8'))
    const validation = validateSharedStateShape('campaign-time', value)
    return validation.ok
      ? { value, worldMinute: value.worldMinute, corrupted: false }
      : { value: null, worldMinute: Number.MAX_SAFE_INTEGER, corrupted: true }
  } catch (error) {
    return error?.code === 'ENOENT'
      ? { value: null, worldMinute: CAMPAIGN_TIME_DEFAULT_WORLD_MINUTE, corrupted: false }
      : { value: null, worldMinute: Number.MAX_SAFE_INTEGER, corrupted: true }
  }
}

async function readMapFogForProjection(ctx) {
  const filePath = path.join(ctx.stateRoot, 'map-fog.json')
  try {
    const value = JSON.parse(await readFile(filePath, 'utf8'))
    const validation = validateSharedStateShape('map-fog', value)
    return validation.ok ? { value, corrupted: false } : { value: null, corrupted: true }
  } catch (error) {
    return error?.code === 'ENOENT'
      ? { value: null, corrupted: false }
      : { value: null, corrupted: true }
  }
}

async function readCharactersForProjection(ctx) {
  const filePath = path.join(ctx.stateRoot, 'characters.json')
  try {
    const value = JSON.parse(await readFile(filePath, 'utf8'))
    const validation = validateSharedStateShape('characters', value)
    return validation.ok ? { value, corrupted: false } : { value: null, corrupted: true }
  } catch (error) {
    return error?.code === 'ENOENT'
      ? { value: null, corrupted: false }
      : { value: null, corrupted: true }
  }
}

async function requireCampaignDm(ctx, req) {
  const room = await readRoomForCampaign(ctx)
  if (!room) {
    if (ctx.accessRole === 'player') throw new RoomProtocolError(403, 'forbidden')
    return null
  }
  if (room.host?.memberId !== req?.headers?.['x-stars-member']) {
    throw new RoomProtocolError(403, 'forbidden')
  }
  return room
}

function campaignRoomManifest(room) {
  if (!room) return {
    id: 'default',
    name: '本地战役',
    rulesetId: DND5E_2014_RULESET_ID,
    requiredPlugins: [],
    pluginFiles: {},
    pluginRuntimeState: {},
  }
  const persistentRoom = withoutRoomEphemeralPlugins(room)
  return {
    id: persistentRoom.id,
    name: persistentRoom.name,
    rulesetId: persistentRoom.rulesetId,
    requiredPlugins: Array.isArray(persistentRoom.requiredPlugins) ? persistentRoom.requiredPlugins : [],
    pluginFiles: plainObject(persistentRoom.pluginFiles) ? persistentRoom.pluginFiles : {},
    pluginRuntimeState: plainObject(persistentRoom.pluginRuntimeState) ? persistentRoom.pluginRuntimeState : {},
  }
}

async function collectCampaignImages(ctx) {
  const images = []
  let entries = []
  try {
    entries = await readdir(ctx.imageRoot)
  } catch {
    return images
  }
  for (const id of entries.filter((entry) => !entry.endsWith('.json') && !entry.endsWith('.lock')).sort()) {
    const meta = JSON.parse(await readFile(path.join(ctx.imageRoot, `${id}.json`), 'utf8'))
    const bytes = await readFile(path.join(ctx.imageRoot, id))
    images.push({ id, type: meta.type || 'application/octet-stream', data: bytes.toString('base64') })
  }
  return images
}

async function collectCampaignPlugins(ctx, room) {
  if (!room) return []
  const plugins = []
  for (const requirement of Array.isArray(room.requiredPlugins) ? room.requiredPlugins : []) {
    const hosted = room.pluginFiles?.[requirement.id]
    if (!hosted || hosted.distributionPolicy === 'room-ephemeral') continue
    const bytes = await readFile(roomHostedPluginFile(ctx, room.id, requirement.id, hosted))
    plugins.push({ ...hosted, ...requirement, data: bytes.toString('base64') })
  }
  return plugins
}

async function buildCampaignBundle(ctx, options = {}) {
  const { states, invalid } = await readValidStateDirectory(ctx)
  if (invalid.length > 0) {
    const error = new RoomProtocolError(409, 'campaign-state-corrupted')
    error.invalid = invalid
    throw error
  }
  const room = await readRoomForCampaign(ctx)
  const includeAssets = options.includeAssets === true
  return {
    format: CAMPAIGN_BUNDLE_FORMAT,
    schemaVersion: CAMPAIGN_BUNDLE_SCHEMA_VERSION,
    protocolVersion: SHARED_PROTOCOL_VERSION,
    exportedAt: Date.now(),
    snapshotKind: options.kind ?? 'export',
    room: campaignRoomManifest(room),
    states,
    images: includeAssets ? await collectCampaignImages(ctx) : [],
    plugins: includeAssets ? await collectCampaignPlugins(ctx, room) : [],
  }
}

function snapshotId(bundle) {
  return `${bundle.exportedAt}-${bundle.snapshotKind}-${randomUUID()}`
}

async function writeCampaignSnapshot(ctx, kind = 'manual') {
  const bundle = await buildCampaignBundle(ctx, { kind, includeAssets: false })
  const id = snapshotId(bundle)
  const root = snapshotRoot(ctx)
  await mkdir(root, { recursive: true })
  await atomicWriteLocked(path.join(root, `${id}.json`), JSON.stringify({ ...bundle, snapshotId: id }))
  await rotateJsonDirectory(root, CAMPAIGN_SNAPSHOT_LIMIT)
  return { id, createdAt: bundle.exportedAt, kind, stateCount: Object.keys(bundle.states).length }
}

async function maybeWriteAutoCampaignSnapshot(ctx) {
  const key = `${ctx.roomId ?? 'default'}:${snapshotRoot(ctx)}`
  const now = Date.now()
  if (now - (lastAutoSnapshotAt.get(key) ?? 0) < CAMPAIGN_AUTO_SNAPSHOT_INTERVAL_MS) return
  lastAutoSnapshotAt.set(key, now)
  try {
    await writeCampaignSnapshot(ctx, 'auto')
  } catch {
    // A damaged current state is quarantined/reported elsewhere. Never make a
    // normal state write fail only because its precautionary snapshot failed.
  }
}

function validateCampaignBundle(value) {
  const errors = []
  if (!plainObject(value) || value.format !== CAMPAIGN_BUNDLE_FORMAT) errors.push('invalid-format')
  if (value?.schemaVersion !== CAMPAIGN_BUNDLE_SCHEMA_VERSION) errors.push('unsupported-schema')
  if (value?.room?.rulesetId !== DND5E_2014_RULESET_ID) errors.push('unsupported-ruleset')
  if (!plainObject(value?.states)) errors.push('invalid-states')
  if (!Array.isArray(value?.images)) errors.push('invalid-images')
  if (!Array.isArray(value?.plugins)) errors.push('invalid-plugins')
  if (value?.room?.pluginRuntimeState != null && !plainObject(value.room.pluginRuntimeState)) {
    errors.push('invalid-plugin-runtime-state')
  }
  if (plainObject(value?.states) && Object.keys(value.states).length > 128) errors.push('too-many-states')
  if (Array.isArray(value?.images) && value.images.length > IMAGE_COUNT_LIMIT) errors.push('too-many-images')
  if (Array.isArray(value?.plugins) && value.plugins.length > 64) errors.push('too-many-plugins')
  if (plainObject(value?.states)) {
    for (const [name, state] of Object.entries(value.states)) {
      if (!/^[a-zA-Z0-9_-]+$/.test(name)) errors.push(`invalid-state-name:${name}`)
      const validation = validateSharedStateShape(name, state)
      if (!validation.ok) errors.push(`${name}:${validation.reason}`)
    }
  }
  if (Array.isArray(value?.images)) {
    for (const image of value.images) {
      if (!plainObject(image) || !/^[a-zA-Z0-9_-]+$/.test(image.id ?? '') || typeof image.data !== 'string') {
        errors.push('invalid-image')
      }
    }
  }
  if (Array.isArray(value?.plugins)) {
    for (const plugin of value.plugins) {
      if (!plainObject(plugin) || !/^[a-z0-9][a-z0-9._-]{0,99}$/.test(plugin.id ?? '') || typeof plugin.data !== 'string') {
        errors.push('invalid-plugin')
        continue
      }
      const bytes = Buffer.from(plugin.data, 'base64')
      const actual = `sha256-${createHash('sha256').update(bytes).digest('base64')}`
      if (actual !== plugin.integrity) errors.push(`plugin-integrity:${plugin.id}`)
    }
  }
  if (plainObject(value?.room?.pluginRuntimeState)) {
    for (const [pluginId, runtime] of Object.entries(value.room.pluginRuntimeState)) {
      if (
        !/^[a-z0-9][a-z0-9._-]{0,99}$/.test(pluginId) || !plainObject(runtime) ||
        !Number.isInteger(runtime.stateSchemaVersion) || runtime.stateSchemaVersion < 1 ||
        runtime.stateSchemaVersion > 1_000
      ) {
        errors.push(`invalid-plugin-runtime-state:${pluginId}`)
        continue
      }
      try {
        normalizedPluginState(runtime.data)
      } catch {
        errors.push(`invalid-plugin-runtime-state:${pluginId}`)
      }
    }
  }
  if (value?.snapshotKind === 'export' && Array.isArray(value?.room?.requiredPlugins) && Array.isArray(value?.plugins)) {
    for (const requirement of value.room.requiredPlugins) {
      const plugin = value.plugins.find((candidate) => candidate?.id === requirement?.id)
      if (!plugin || plugin.version !== requirement.version || plugin.integrity !== requirement.integrity) {
        errors.push(`missing-required-plugin:${requirement?.id ?? 'unknown'}`)
      }
    }
  }
  return { ok: errors.length === 0, errors }
}

async function restoreCampaignBundle(ctx, bundle, options = {}) {
  const validation = validateCampaignBundle(bundle)
  if (!validation.ok) {
    const error = new RoomProtocolError(422, 'campaign-preflight-failed')
    error.details = validation.errors
    throw error
  }
  if (options.createSafetySnapshot !== false) await writeCampaignSnapshot(ctx, 'pre-restore')
  const restoredAt = Date.now()
  await mkdir(ctx.stateRoot, { recursive: true })
  const restoredStateNames = new Set(Object.keys(bundle.states).map((name) => `${safeName(name)}.json`))
  let existingStateFiles = []
  try {
    existingStateFiles = await readdir(ctx.stateRoot)
  } catch {
    // The directory was created above; a concurrent cleanup is harmless.
  }
  for (const fileName of existingStateFiles.filter((name) => name.endsWith('.json') && !restoredStateNames.has(name))) {
    await atomicDeleteJsonStateCasLocked(path.join(ctx.stateRoot, fileName), { writerId: 'campaign-restore' })
  }
  for (const [name, value] of Object.entries(bundle.states)) {
    const normalized = normalizeDedicatedDnd5eSharedState(name, { ...value, updatedAt: restoredAt })
    await atomicWriteJsonStateCasLocked(path.join(ctx.stateRoot, `${safeName(name)}.json`), normalized, {
      writerId: 'campaign-restore',
    })
  }
  await mkdir(ctx.imageRoot, { recursive: true })
  for (const image of bundle.images) {
    const bytes = Buffer.from(image.data, 'base64')
    if (bytes.length > IMAGE_MAX_BYTES) throw new RoomProtocolError(413, 'campaign-image-too-large')
    const id = safeName(image.id)
    await atomicWriteImageLocked(
      path.join(ctx.imageRoot, id),
      path.join(ctx.imageRoot, `${id}.json`),
      bytes,
      JSON.stringify({ type: String(image.type || 'application/octet-stream') }),
    )
  }
  await enforceImageQuota(ctx.imageRoot)

  if ((ctx.roomId ?? 'default') !== 'default' && bundle.plugins.length > 0) {
    for (const plugin of bundle.plugins) {
      const bytes = Buffer.from(plugin.data, 'base64')
      if (bytes.length > STATE_MAX_BYTES) throw new RoomProtocolError(413, 'campaign-plugin-too-large')
      await mkdir(roomPluginDirectory(ctx, ctx.roomId), { recursive: true })
      const hosted = bundle.room.pluginFiles?.[plugin.id] ?? plugin
      await atomicWriteLocked(roomHostedPluginFile(ctx, ctx.roomId, plugin.id, hosted), bytes)
    }
    await mutateLobbyRoom(ctx, ctx.roomId, (room) => ({
      ok: true,
      next: {
        ...room,
        requiredPlugins: bundle.room.requiredPlugins,
        pluginFiles: bundle.room.pluginFiles,
        pluginRuntimeState: bundle.room.pluginRuntimeState ?? {},
        rulesRevision: (Number.isFinite(room.rulesRevision) ? room.rulesRevision : 1) + 1,
        rulesUpdatedAt: Date.now(),
        updatedAt: Date.now(),
      },
    }))
  }
  const updatedAt = restoredAt
  publishEvent(ctx, SHARED_STATE_CHANGED_CHANNEL, {
    id: `campaign-restore:${updatedAt}:${randomUUID()}`,
    name: '*',
    updatedAt,
  })
  return {
    ok: true,
    stateCount: Object.keys(bundle.states).length,
    imageCount: bundle.images.length,
    pluginCount: bundle.plugins.length,
    restoredAt: updatedAt,
  }
}

function roomLobbyFile(ctx, roomId) {
  return path.join(lobbyRoot(ctx), `${roomId}.json`)
}

function accountDirectory(ctx) {
  return path.join(lobbyRoot(ctx), 'accounts')
}

function accountFile(ctx, accountId) {
  return path.join(accountDirectory(ctx), `${accountId}.json`)
}

function accountStorageBackend(ctx) {
  const configured = String(
    ctx.accountStorageBackend ??
    process.env.STARS_ACCOUNT_STORAGE ??
    'json',
  ).trim().toLowerCase()
  if (!['json', 'sqlite', 'postgres'].includes(configured)) {
    throw new Error(`Unsupported STARS_ACCOUNT_STORAGE: ${configured}`)
  }
  return configured
}

function accountDatabaseFile(ctx) {
  return path.resolve(
    ctx.accountDatabasePath ??
    process.env.STARS_DATABASE_PATH ??
    path.join(path.dirname(lobbyRoot(ctx)), 'astraltrace.sqlite'),
  )
}

async function accountPersistentStore(ctx) {
  const backend = accountStorageBackend(ctx)
  if (backend === 'json') return null
  if (!ctx.accountPersistentStorePromise) {
    ctx.accountPersistentStorePromise = backend === 'postgres'
      ? openPostgresStorage(
          ctx.databaseUrl ?? process.env.STARS_DATABASE_URL ?? '',
          {
            maxConnections: Number.parseInt(
              String(process.env.STARS_DATABASE_POOL_SIZE ?? '10'),
              10,
            ),
          },
        )
      : openSqliteAccountStore(accountDatabaseFile(ctx))
  }
  return ctx.accountPersistentStorePromise
}

export async function initializeAccountStorage(ctx) {
  const backend = accountStorageBackend(ctx)
  const store = await accountPersistentStore(ctx)
  if (!store) return { backend: 'json' }
  return { backend, ...await store.diagnostics() }
}

export async function closeAccountStorage(ctx) {
  if (!ctx.accountPersistentStorePromise) return
  const store = await ctx.accountPersistentStorePromise
  await store.close()
  ctx.accountPersistentStorePromise = null
}

export async function accountStorageDiagnostics(ctx) {
  const store = await accountPersistentStore(ctx)
  if (!store) {
    await mkdir(accountDirectory(ctx), { recursive: true })
    await stat(accountDirectory(ctx))
    return { backend: 'json', integrity: 'ok' }
  }
  return {
    backend: accountStorageBackend(ctx),
    ...await store.diagnostics(),
  }
}

async function syncAccountToPersistentStore(ctx, account, options = {}) {
  const store = await accountPersistentStore(ctx)
  if (!store) return
  if (options.createOnly) await store.createAccount(account, options)
  else await store.writeAccount(account, options)
}

function accountIdentityDirectory(ctx) {
  return path.join(accountDirectory(ctx), 'identities')
}

function accountVerificationDirectory(ctx) {
  return path.join(accountDirectory(ctx), 'verifications')
}

function accountPluginBlobDirectory(ctx) {
  return path.join(lobbyRoot(ctx), 'account-plugins', 'blobs')
}

function accountPluginBlobFile(ctx, integrity) {
  const digest = createHash('sha256').update(String(integrity)).digest('hex')
  return path.join(accountPluginBlobDirectory(ctx), `${digest}.dndstars5e`)
}

function pluginRegistryFile(ctx) {
  return path.join(lobbyRoot(ctx), 'plugin-registry.json')
}

function marketplaceSigningKeyFile(ctx) {
  return path.join(lobbyRoot(ctx), '.marketplace-signing-key.json')
}

async function marketplaceSigningKey(ctx) {
  const filePath = marketplaceSigningKeyFile(ctx)
  try {
    const stored = JSON.parse(await readFile(filePath, 'utf8'))
    if (
      stored?.schemaVersion === 1 &&
      typeof stored.privateKeyPem === 'string' &&
      typeof stored.publicKeyPem === 'string' &&
      typeof stored.keyId === 'string'
    ) return stored
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()
  const generated = {
    schemaVersion: 1,
    algorithm: 'Ed25519',
    keyId: createHash('sha256').update(publicKeyPem).digest('base64url').slice(0, 24),
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKeyPem,
    createdAt: Date.now(),
  }
  await mkdir(lobbyRoot(ctx), { recursive: true })
  try {
    await writeFile(filePath, `${JSON.stringify(generated)}\n`, { flag: 'wx', mode: 0o600 })
    return generated
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error
    const stored = JSON.parse(await readFile(filePath, 'utf8'))
    if (stored?.schemaVersion !== 1 || typeof stored.privateKeyPem !== 'string') throw error
    return stored
  }
}

async function signMarketplaceProduct(ctx, manifest) {
  const key = await marketplaceSigningKey(ctx)
  const payload = Buffer.from(canonicalMarketplaceJson(manifest), 'utf8')
  const signature = signBytes(null, payload, key.privateKeyPem).toString('base64url')
  if (!verifyBytes(null, payload, key.publicKeyPem, Buffer.from(signature, 'base64url'))) {
    throw new RoomProtocolError(500, 'marketplace-signature-verification-failed')
  }
  return {
    schemaVersion: 1,
    algorithm: 'Ed25519',
    keyId: key.keyId,
    signature,
  }
}

function emptyPluginRegistry() {
  return {
    schemaVersion: 1,
    entries: [],
    reports: [],
    creators: [],
    entitlements: [],
    orders: [],
    paymentEvents: [],
    ledgerEntries: [],
    payouts: [],
    analyticsDaily: [],
    installations: [],
  }
}

function normalizePluginRegistry(value) {
  if (!plainObject(value) || value.schemaVersion !== 1) return emptyPluginRegistry()
  return {
    schemaVersion: 1,
    entries: Array.isArray(value.entries) ? value.entries.filter(plainObject).slice(0, 5_000) : [],
    reports: Array.isArray(value.reports) ? value.reports.filter(plainObject).slice(-10_000) : [],
    creators: Array.isArray(value.creators) ? value.creators.filter(plainObject).slice(0, 100_000) : [],
    entitlements: Array.isArray(value.entitlements)
      ? value.entitlements.filter(plainObject).slice(0, 1_000_000)
      : [],
    orders: Array.isArray(value.orders) ? value.orders.filter(plainObject).slice(-1_000_000) : [],
    paymentEvents: Array.isArray(value.paymentEvents)
      ? value.paymentEvents.filter(plainObject).slice(-1_000_000)
      : [],
    ledgerEntries: Array.isArray(value.ledgerEntries)
      ? value.ledgerEntries.filter(plainObject).slice(-2_000_000)
      : [],
    payouts: Array.isArray(value.payouts)
      ? value.payouts.filter(marketplacePayoutRecordValid).slice(-1_000_000)
      : [],
    analyticsDaily: Array.isArray(value.analyticsDaily)
      ? value.analyticsDaily.map(normalizeMarketplaceAnalyticsDaily).filter(Boolean).slice(-500_000)
      : [],
    installations: Array.isArray(value.installations)
      ? value.installations.map(normalizeMarketplaceInstallation).filter(Boolean).slice(-1_000_000)
      : [],
  }
}

function marketplaceCreatorPublicRecord(account, creator) {
  return {
    schemaVersion: 1,
    accountId: account.accountId,
    displayName: account.auth?.username ?? account.displayName,
    status: creator?.status ?? 'unregistered',
    ...(creator?.countryOrRegion ? { countryOrRegion: creator.countryOrRegion } : {}),
    ...(creator?.verificationReference ? { verificationReference: creator.verificationReference } : {}),
    ...(creator?.policyVersion ? { policyVersion: creator.policyVersion } : {}),
    ...(creator?.noticeVersion ? { noticeVersion: creator.noticeVersion } : {}),
    ...(Number.isFinite(creator?.appliedAt) ? { appliedAt: creator.appliedAt } : {}),
    ...(Number.isFinite(creator?.verifiedAt) ? { verifiedAt: creator.verifiedAt } : {}),
    ...(creator?.moderationNote ? { moderationNote: creator.moderationNote } : {}),
  }
}

async function readPluginRegistry(ctx) {
  const store = await accountPersistentStore(ctx)
  if (accountStorageBackend(ctx) === 'postgres' && store?.readMarketplaceRegistry) {
    const persisted = await store.readMarketplaceRegistry(normalizePluginRegistry)
    if (persisted) return persisted
    let legacy = null
    try {
      legacy = normalizePluginRegistry(JSON.parse(await readFile(pluginRegistryFile(ctx), 'utf8')))
    } catch {}
    return store.mutateMarketplaceRegistry(
      normalizePluginRegistry,
      emptyPluginRegistry,
      () => legacy ?? emptyPluginRegistry(),
    )
  }
  try {
    return normalizePluginRegistry(JSON.parse(await readFile(pluginRegistryFile(ctx), 'utf8')))
  } catch {
    return emptyPluginRegistry()
  }
}

async function assertMarketplacePackageEntitlement(ctx, accountId, integrity) {
  const registry = await readPluginRegistry(ctx)
  const publishedMatch = registry.entries.flatMap((entry) =>
    (Array.isArray(entry.versions) ? entry.versions : []).map((version) => ({ entry, version })))
    .find(({ version }) =>
      version.integrity === integrity &&
      version.status === 'published')
  if (!publishedMatch) return null
  if (publishedMatch.version.marketplace?.pricing?.kind !== 'paid') {
    return { productId: publishedMatch.entry.id, version: publishedMatch.version.version, entitlement: null }
  }
  const entitled = accountId
    ? activeMarketplaceEntitlement(registry.entitlements, {
        accountId,
        productId: publishedMatch.entry.id,
        version: publishedMatch.version.version,
      })
    : null
  if (!entitled && publishedMatch.entry.publisher?.accountId !== accountId) {
    throw new RoomProtocolError(403, 'marketplace-entitlement-required')
  }
  return { productId: publishedMatch.entry.id, version: publishedMatch.version.version, entitlement: entitled }
}

async function mutatePluginRegistry(ctx, updater) {
  const store = await accountPersistentStore(ctx)
  if (accountStorageBackend(ctx) === 'postgres' && store?.mutateMarketplaceRegistry) {
    return store.mutateMarketplaceRegistry(
      normalizePluginRegistry,
      emptyPluginRegistry,
      updater,
    )
  }
  await mkdir(lobbyRoot(ctx), { recursive: true })
  const result = await atomicMutateJsonStateLocked(pluginRegistryFile(ctx), (current) => {
    const registry = normalizePluginRegistry(current)
    const next = updater(registry)
    return { ok: true, changed: true, next }
  })
  if (!result?.ok) throw new RoomProtocolError(result?.status ?? 500, result?.error ?? 'plugin-registry-write-failed')
  return normalizePluginRegistry(result.next)
}

async function syncMarketplaceAccountInstallation(ctx, input) {
  const now = Number.isFinite(input?.timestamp) ? Number(input.timestamp) : Date.now()
  return mutatePluginRegistry(ctx, (current) => {
    const match = current.entries.flatMap((entry) =>
      (Array.isArray(entry.versions) ? entry.versions : []).map((version) => ({ entry, version })))
      .find(({ version }) =>
        version.integrity === input.integrity &&
        version.status === 'published')
    if (!match) return current
    const updated = updateMarketplaceInstallation(current.installations, {
      accountId: input.accountId,
      productId: match.entry.id,
      version: match.version.version,
      publisherAccountId: match.entry.publisher?.accountId,
      active: input.active === true,
      timestamp: now,
    })
    return {
      ...current,
      installations: updated.installations,
      analyticsDaily: updated.transition
        ? recordMarketplaceDailyMetric(current.analyticsDaily, {
            metric: updated.transition === 'installed' ? 'installs' : 'uninstalls',
            productId: match.entry.id,
            version: match.version.version,
            publisherAccountId: match.entry.publisher?.accountId,
            timestamp: now,
          })
        : current.analyticsDaily,
    }
  })
}

function pluginRegistryAdministrator(account, env = process.env) {
  const configured = String(env.STARS_PLUGIN_ADMIN_ACCOUNT_IDS ?? '')
    .split(',').map((value) => value.trim()).filter(Boolean)
  return configured.includes(account?.accountId) ||
    (!productionSecurityEnabled(env) && configured.includes('*'))
}

function pluginCatalogReviewRequired(env = process.env) {
  return productionSecurityEnabled(env) || env.STARS_PLUGIN_REVIEW_REQUIRED === 'true'
}

export function marketplacePaidPublishingEnabled(env = process.env) {
  if (!productionSecurityEnabled(env)) return true
  return env.STARS_MARKETPLACE_PAID_PUBLISHING_ENABLED === 'true' &&
    env.STARS_MARKETPLACE_KYC_PROVIDER_READY === 'true' &&
    Boolean(env.STARS_MARKETPLACE_PAYMENT_WEBHOOK_SECRET) &&
    Boolean(marketplaceCheckoutAdapter(env))
}

export function marketplaceCapabilities(env = process.env) {
  const checkout = marketplaceCheckoutAdapter(env)
  const paidPublishingEnabled = marketplacePaidPublishingEnabled(env)
  const configuredAdministrators = String(env.STARS_PLUGIN_ADMIN_ACCOUNT_IDS ?? '')
    .split(',').map((value) => value.trim()).filter((value) => value && value !== '*')
  return {
    schemaVersion: 1,
    marketMode: paidPublishingEnabled ? 'live' : 'free-beta',
    freePublishingEnabled: true,
    paidPublishingEnabled,
    checkoutAvailable: paidPublishingEnabled && Boolean(checkout),
    creatorVerificationMode: env.STARS_MARKETPLACE_KYC_PROVIDER_READY === 'true'
      ? 'provider'
      : 'manual-review',
    moderationConfigured: configuredAdministrators.length > 0,
  }
}

function marketplaceOrderProduct(registry, productId, version) {
  const entry = registry.entries.find((candidate) => candidate.id === productId)
  const productVersion = (Array.isArray(entry?.versions) ? entry.versions : []).find((candidate) =>
    candidate.version === version &&
    candidate.status === 'published' &&
    candidate.marketplace?.pricing?.kind === 'paid')
  return entry && productVersion ? { entry, version: productVersion } : null
}

function marketplaceOrderPaymentMatches(order, payload) {
  return payload.currency === order.currency &&
    Number(payload.amountMinor) === order.amountMinor
}

function fulfillMarketplaceOrder(registry, orderId, input) {
  const order = registry.orders.find((candidate) => candidate.orderId === orderId)
  if (!order) throw new RoomProtocolError(404, 'marketplace-order-not-found')
  if (!marketplaceOrderPaymentMatches(order, input)) {
    throw new RoomProtocolError(409, 'marketplace-payment-amount-mismatch')
  }
  if (order.status === 'fulfilled') {
    if (order.providerOrderId !== input.providerOrderId) {
      throw new RoomProtocolError(409, 'marketplace-provider-order-mismatch')
    }
    return registry
  }
  if (!marketplaceOrderIsPayable(order, input.now)) {
    throw new RoomProtocolError(409, 'marketplace-order-not-payable')
  }
  const netReceiptsMinor = input.netReceiptsMinor ?? order.amountMinor
  if (
    !Number.isSafeInteger(netReceiptsMinor) ||
    netReceiptsMinor < 0 ||
    netReceiptsMinor > order.amountMinor
  ) throw new RoomProtocolError(409, 'invalid-marketplace-net-receipts')
  const revenue = marketplaceRevenueSplit(
    netReceiptsMinor,
    order.creatorShareBps,
    order.platformShareBps,
  )
  if (!revenue) throw new RoomProtocolError(409, 'invalid-marketplace-settlement')
  const existing = activeMarketplaceEntitlement(registry.entitlements, {
    accountId: order.accountId,
    productId: order.productId,
    version: order.version,
  }, input.now)
  const entitlementId = existing?.entitlementId ?? randomUUID()
  const entitlement = existing ?? {
    schemaVersion: MARKETPLACE_ENTITLEMENT_SCHEMA_VERSION,
    entitlementId,
    accountId: order.accountId,
    productId: order.productId,
    version: order.version,
    licenseType: 'personal',
    source: 'purchase',
    status: 'active',
    grantedAt: input.now,
    grantedBy: `payment:${input.provider}`,
  }
  const availableAt = input.provider === 'sandbox'
    ? input.now
    : input.now + MARKETPLACE_SETTLEMENT_HOLD_MS
  const sourceEventId = input.sourceEventId ?? input.providerOrderId
  const ledgerEntries = [
    {
      schemaVersion: MARKETPLACE_LEDGER_SCHEMA_VERSION,
      entryId: randomUUID(),
      orderId: order.orderId,
      productId: order.productId,
      version: order.version,
      beneficiaryAccountId: order.publisherAccountId,
      beneficiaryRole: 'creator',
      kind: 'sale',
      currency: order.currency,
      amountMinor: revenue.creatorAmountMinor,
      sourceEventId,
      createdAt: input.now,
      availableAt,
    },
    {
      schemaVersion: MARKETPLACE_LEDGER_SCHEMA_VERSION,
      entryId: randomUUID(),
      orderId: order.orderId,
      productId: order.productId,
      version: order.version,
      beneficiaryAccountId: 'astraltrace-platform',
      beneficiaryRole: 'platform',
      kind: 'sale',
      currency: order.currency,
      amountMinor: revenue.platformAmountMinor,
      sourceEventId,
      createdAt: input.now,
      availableAt,
    },
  ]
  return {
    ...registry,
    entitlements: existing ? registry.entitlements : [...registry.entitlements, entitlement],
    ledgerEntries: [...registry.ledgerEntries, ...ledgerEntries],
    orders: registry.orders.map((candidate) => candidate.orderId === orderId
      ? {
          ...candidate,
          status: 'fulfilled',
          provider: input.provider,
          providerOrderId: input.providerOrderId,
          paidAt: input.now,
          fulfilledAt: input.now,
          updatedAt: input.now,
          entitlementId,
          netReceiptsMinor: revenue.netReceiptsMinor,
          creatorNetAmountMinor: revenue.creatorAmountMinor,
          platformNetAmountMinor: revenue.platformAmountMinor,
        }
      : candidate),
  }
}

function updateMarketplaceOrderAfterPaymentReversal(registry, orderId, input) {
  const order = registry.orders.find((candidate) => candidate.orderId === orderId)
  if (!order) throw new RoomProtocolError(404, 'marketplace-order-not-found')
  if (!marketplaceOrderPaymentMatches(order, input)) {
    throw new RoomProtocolError(409, 'marketplace-payment-amount-mismatch')
  }
  if (order.providerOrderId !== input.providerOrderId) {
    throw new RoomProtocolError(409, 'marketplace-provider-order-mismatch')
  }
  if (!['fulfilled', 'refunded', 'disputed'].includes(order.status)) {
    throw new RoomProtocolError(409, 'marketplace-order-not-reversible')
  }
  const reversalExists = registry.ledgerEntries.some((entry) =>
    entry.orderId === orderId && ['refund', 'dispute'].includes(entry.kind))
  const reversalEntries = reversalExists
    ? []
    : registry.ledgerEntries
        .filter((entry) => entry.orderId === orderId && entry.kind === 'sale')
        .map((entry) => ({
          ...entry,
          entryId: randomUUID(),
          kind: input.status === 'refunded' ? 'refund' : 'dispute',
          amountMinor: -entry.amountMinor,
          sourceEventId: input.sourceEventId ?? input.providerOrderId,
          createdAt: input.now,
        }))
  return {
    ...registry,
    ledgerEntries: [...registry.ledgerEntries, ...reversalEntries],
    orders: registry.orders.map((candidate) => candidate.orderId === orderId
      ? { ...candidate, status: input.status, updatedAt: input.now }
      : candidate),
    entitlements: registry.entitlements.map((entitlement) =>
      entitlement.entitlementId === order.entitlementId
        ? {
            ...entitlement,
            status: input.status,
            updatedAt: input.now,
            updatedBy: `payment:${input.provider}`,
            statusReason: input.status === 'refunded' ? 'payment-refunded' : 'payment-disputed',
          }
        : entitlement),
  }
}

function marketplacePaymentWebhookValid(bytes, suppliedSignature, secret) {
  if (!secret || !suppliedSignature) return false
  const expected = createHmac('sha256', secret).update(bytes).digest('hex')
  const actual = String(suppliedSignature).trim().toLowerCase()
  return actual.length === expected.length &&
    timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
}

export function marketplaceCheckoutAdapter(env = process.env) {
  const endpoint = normalizedLabel(env.STARS_MARKETPLACE_CHECKOUT_ADAPTER_URL, 1_000)
  const secret = String(env.STARS_MARKETPLACE_CHECKOUT_ADAPTER_SECRET ?? '')
  const provider = normalizedLabel(env.STARS_MARKETPLACE_CHECKOUT_PROVIDER, 40) || 'external'
  if (!endpoint || !secret) return null
  let url
  try {
    url = new URL(endpoint)
  } catch {
    return null
  }
  if (productionSecurityEnabled(env) && url.protocol !== 'https:') return null
  if (!['http:', 'https:'].includes(url.protocol)) return null
  return { endpoint: url.toString(), secret, provider }
}

export async function createMarketplaceCheckout(order, env = process.env) {
  const adapter = marketplaceCheckoutAdapter(env)
  if (!adapter) throw new RoomProtocolError(503, 'marketplace-checkout-unavailable')
  const body = JSON.stringify({
    schemaVersion: 1,
    orderId: order.orderId,
    productId: order.productId,
    version: order.version,
    amountMinor: order.amountMinor,
    currency: order.currency,
    accountId: order.accountId,
    returnUrl: `${normalizedHttpOrigin(env.STARS_PUBLIC_ORIGIN) ?? 'http://localhost:8080'}/app/extensions?section=orders`,
  })
  const signature = createHmac('sha256', adapter.secret).update(body).digest('hex')
  let response
  try {
    response = await fetch(adapter.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': order.orderId,
        'X-Stars-Checkout-Signature': signature,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new RoomProtocolError(502, 'marketplace-checkout-provider-unavailable')
  }
  const result = await response.json().catch(() => null)
  if (!response.ok || !plainObject(result)) {
    throw new RoomProtocolError(502, 'marketplace-checkout-provider-rejected')
  }
  const providerOrderId = normalizedLabel(result.providerOrderId, 160)
  const checkoutUrl = normalizedLabel(result.checkoutUrl, 2_000)
  let parsedCheckoutUrl
  try {
    parsedCheckoutUrl = new URL(checkoutUrl)
  } catch {
    throw new RoomProtocolError(502, 'invalid-marketplace-checkout-response')
  }
  if (
    !providerOrderId ||
    !['http:', 'https:'].includes(parsedCheckoutUrl.protocol) ||
    (productionSecurityEnabled(env) && parsedCheckoutUrl.protocol !== 'https:')
  ) throw new RoomProtocolError(502, 'invalid-marketplace-checkout-response')
  return {
    provider: adapter.provider,
    providerOrderId,
    checkoutUrl: parsedCheckoutUrl.toString(),
    expiresAt: Number.isFinite(result.expiresAt)
      ? Math.min(Number(result.expiresAt), order.expiresAt)
      : order.expiresAt,
  }
}

async function handleMarketplaceCommerceApi(req, res, parsed, ctx) {
  if (!parsed.pathname.startsWith('/api/marketplace/')) return false
  if (!applyLobbyRateLimit(req, res, ctx)) return true

  if (parsed.pathname === '/api/marketplace/capabilities' && req.method === 'GET') {
    writeJson(res, 200, marketplaceCapabilities())
    return true
  }

  if (parsed.pathname === '/api/marketplace/payment-methods' && req.method === 'GET') {
    const adapter = marketplacePaidPublishingEnabled() ? marketplaceCheckoutAdapter() : null
    writeJson(res, 200, {
      methods: [
        ...(!productionSecurityEnabled()
          ? [{ id: 'sandbox', label: '沙盒支付', mode: 'sandbox' }]
          : []),
        ...(adapter
          ? [{ id: adapter.provider, label: adapter.provider, mode: 'redirect' }]
          : []),
      ],
    })
    return true
  }

  if (parsed.pathname === '/api/marketplace/creators/me/ledger' && req.method === 'GET') {
    const account = await authenticateAccount(req, ctx)
    const registry = await readPluginRegistry(ctx)
    const creator = registry.creators.find((candidate) =>
      candidate.accountId === account.accountId)
    const publishedOwnProduct = registry.entries.some((entry) =>
      entry.publisher?.accountId === account.accountId)
    if (!creator && !publishedOwnProduct) {
      throw new RoomProtocolError(403, 'marketplace-creator-required')
    }
    const entries = registry.ledgerEntries
      .filter((entry) => entry.beneficiaryAccountId === account.accountId)
      .sort((left, right) => Number(right.createdAt ?? 0) - Number(left.createdAt ?? 0))
      .slice(0, 1_000)
    const now = Date.now()
    writeJson(res, 200, {
      balances: [
        marketplaceLedgerBalance(registry.ledgerEntries, account.accountId, 'CNY', now),
        marketplaceLedgerBalance(registry.ledgerEntries, account.accountId, 'USD', now),
      ],
      entries,
      settlementHoldDays: Math.round(MARKETPLACE_SETTLEMENT_HOLD_MS / 86_400_000),
    })
    return true
  }

  if (parsed.pathname === '/api/marketplace/creators/me/analytics' && req.method === 'GET') {
    const account = await authenticateAccount(req, ctx)
    const registry = await readPluginRegistry(ctx)
    const creator = registry.creators.find((candidate) =>
      candidate.accountId === account.accountId)
    const ownsPublication = registry.entries.some((entry) =>
      entry.publisher?.accountId === account.accountId)
    if (!creator && !ownsPublication) {
      throw new RoomProtocolError(403, 'marketplace-creator-required')
    }
    writeJson(res, 200, buildMarketplaceCreatorAnalytics({
      publisherAccountId: account.accountId,
      periodDays: Number(parsed.searchParams.get('days')) || 30,
      entries: registry.entries,
      daily: registry.analyticsDaily,
      installations: registry.installations,
      orders: registry.orders,
      ledgerEntries: registry.ledgerEntries,
    }))
    return true
  }

  if (parsed.pathname === '/api/marketplace/creators/me/publications' && req.method === 'GET') {
    const account = await authenticateAccount(req, ctx)
    const registry = await readPluginRegistry(ctx)
    writeJson(res, 200, {
      publications: registry.entries
        .filter((entry) => entry.publisher?.accountId === account.accountId)
        .map((entry) => ({
          id: entry.id,
          name: entry.name,
          versions: (Array.isArray(entry.versions) ? entry.versions : [])
            .map((version) => ({
              version: version.version,
              status: version.status,
              visibility: version.visibility,
              submittedAt: version.submittedAt,
              ...(Number.isFinite(version.publishedAt) ? { publishedAt: version.publishedAt } : {}),
              ...(version.moderationNote ? { moderationNote: version.moderationNote } : {}),
            }))
            .sort((left, right) => Number(right.submittedAt ?? 0) - Number(left.submittedAt ?? 0)),
        }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    })
    return true
  }

  if (parsed.pathname === '/api/marketplace/creators/me/payouts' && req.method === 'GET') {
    const account = await authenticateAccount(req, ctx)
    const registry = await readPluginRegistry(ctx)
    writeJson(res, 200, {
      payouts: registry.payouts
        .filter((payout) => payout.creatorAccountId === account.accountId)
        .sort((left, right) => Number(right.createdAt ?? 0) - Number(left.createdAt ?? 0))
        .map(marketplacePayoutPublicRecord),
    })
    return true
  }

  if (parsed.pathname === '/api/marketplace/creators/me/payouts' && req.method === 'POST') {
    const account = await authenticateAccount(req, ctx)
    const payload = await readJsonRequest(req)
    const currency = normalizedLabel(payload?.currency, 3)
    const amountMinor = Number(payload?.amountMinor)
    const idempotencyKey = normalizedLabel(
      req.headers['idempotency-key'] ?? payload?.idempotencyKey,
      128,
    )
    const minimum = marketplacePayoutMinimum(currency)
    if (
      !minimum ||
      !Number.isSafeInteger(amountMinor) ||
      amountMinor < minimum ||
      !idempotencyKey
    ) throw new RoomProtocolError(400, 'invalid-marketplace-payout')
    const now = Date.now()
    let created = false
    const registry = await mutatePluginRegistry(ctx, (current) => {
      const creator = current.creators.find((candidate) =>
        candidate.accountId === account.accountId)
      if (creator?.status !== 'verified' || !creator.verificationReference) {
        throw new RoomProtocolError(403, 'verified-creator-required')
      }
      const existing = current.payouts.find((candidate) =>
        candidate.creatorAccountId === account.accountId &&
        candidate.idempotencyKey === idempotencyKey)
      if (existing) {
        if (existing.currency !== currency || existing.amountMinor !== amountMinor) {
          throw new RoomProtocolError(409, 'marketplace-idempotency-conflict')
        }
        return current
      }
      const balance = marketplaceLedgerBalance(
        current.ledgerEntries,
        account.accountId,
        currency,
        now,
      )
      if (balance.availableMinor < amountMinor) {
        throw new RoomProtocolError(409, 'marketplace-payout-insufficient-balance')
      }
      const payoutId = randomUUID()
      created = true
      return {
        ...current,
        payouts: [...current.payouts, {
          schemaVersion: MARKETPLACE_PAYOUT_SCHEMA_VERSION,
          payoutId,
          creatorAccountId: account.accountId,
          currency,
          amountMinor,
          status: 'pending',
          idempotencyKey,
          payoutDestinationReference: creator.verificationReference,
          createdAt: now,
        }],
        ledgerEntries: [...current.ledgerEntries, {
          schemaVersion: MARKETPLACE_LEDGER_SCHEMA_VERSION,
          entryId: randomUUID(),
          orderId: payoutId,
          productId: 'creator-payout',
          version: '1',
          beneficiaryAccountId: account.accountId,
          beneficiaryRole: 'creator',
          kind: 'payout',
          currency,
          amountMinor: -amountMinor,
          sourceEventId: payoutId,
          createdAt: now,
          availableAt: now,
        }],
      }
    })
    const payout = registry.payouts.find((candidate) =>
      candidate.creatorAccountId === account.accountId &&
      candidate.idempotencyKey === idempotencyKey)
    writeJson(res, created ? 201 : 200, { payout: marketplacePayoutPublicRecord(payout) })
    return true
  }

  const payoutModerationMatch = parsed.pathname.match(
    /^\/api\/marketplace\/payouts\/([^/]+)\/moderate$/,
  )
  if (payoutModerationMatch && req.method === 'POST') {
    const administrator = await authenticateAccount(req, ctx)
    if (!pluginRegistryAdministrator(administrator)) {
      throw new RoomProtocolError(403, 'plugin-admin-required')
    }
    const payoutId = decodeURIComponent(payoutModerationMatch[1] ?? '')
    const payload = await readJsonRequest(req)
    const action = normalizedLabel(payload?.action, 24)
    const note = normalizedLabel(payload?.note, 2_000)
    const externalTransferReference = normalizedLabel(
      payload?.externalTransferReference,
      200,
    )
    if (!['approve', 'reject', 'mark-paid'].includes(action)) {
      throw new RoomProtocolError(400, 'invalid-payout-moderation')
    }
    if (action === 'reject' && !note) {
      throw new RoomProtocolError(400, 'payout-moderation-note-required')
    }
    if (action === 'mark-paid' && !externalTransferReference) {
      throw new RoomProtocolError(400, 'payout-transfer-reference-required')
    }
    const now = Date.now()
    const registry = await mutatePluginRegistry(ctx, (current) => {
      const payout = current.payouts.find((candidate) => candidate.payoutId === payoutId)
      if (!payout) throw new RoomProtocolError(404, 'marketplace-payout-not-found')
      const targetStatus = action === 'approve'
        ? 'approved'
        : action === 'reject'
          ? 'rejected'
          : 'paid'
      if (payout.status === targetStatus) return current
      if (!marketplacePayoutTransitionAllowed(payout.status, action)) {
        throw new RoomProtocolError(409, 'invalid-payout-status-transition')
      }
      const releaseEntry = action === 'reject'
        ? {
            schemaVersion: MARKETPLACE_LEDGER_SCHEMA_VERSION,
            entryId: randomUUID(),
            orderId: payout.payoutId,
            productId: 'creator-payout',
            version: '1',
            beneficiaryAccountId: payout.creatorAccountId,
            beneficiaryRole: 'creator',
            kind: 'payout-release',
            currency: payout.currency,
            amountMinor: payout.amountMinor,
            sourceEventId: `payout-rejected:${payout.payoutId}`,
            createdAt: now,
            availableAt: now,
          }
        : null
      return {
        ...current,
        payouts: current.payouts.map((candidate) => candidate.payoutId === payoutId
          ? {
              ...candidate,
              status: targetStatus,
              updatedAt: now,
              moderatedBy: administrator.accountId,
              ...(note ? { moderationNote: note } : {}),
              ...(action === 'mark-paid'
                ? { externalTransferReference, paidAt: now }
                : {}),
            }
          : candidate),
        ledgerEntries: releaseEntry
          ? [...current.ledgerEntries, releaseEntry]
          : current.ledgerEntries,
      }
    })
    writeJson(res, 200, {
      payout: marketplacePayoutPublicRecord(
        registry.payouts.find((candidate) => candidate.payoutId === payoutId),
      ),
    })
    return true
  }

  if (parsed.pathname === '/api/marketplace/orders' && req.method === 'POST') {
    const account = await authenticateAccount(req, ctx)
    if (!marketplacePaidPublishingEnabled()) {
      throw new RoomProtocolError(503, 'marketplace-paid-commerce-disabled')
    }
    const payload = await readJsonRequest(req)
    const productId = normalizedLabel(payload?.productId, 160)
    const version = normalizedLabel(payload?.version, 64)
    const idempotencyKey = normalizedLabel(
      req.headers['idempotency-key'] ?? payload?.idempotencyKey,
      128,
    )
    if (!productId || !version || !idempotencyKey) {
      throw new RoomProtocolError(400, 'invalid-marketplace-order')
    }
    const now = Date.now()
    let created = false
    const registry = await mutatePluginRegistry(ctx, (current) => {
      const existingOrder = current.orders.find((candidate) =>
        candidate.accountId === account.accountId &&
        candidate.idempotencyKey === idempotencyKey)
      if (existingOrder) {
        if (existingOrder.productId !== productId || existingOrder.version !== version) {
          throw new RoomProtocolError(409, 'marketplace-idempotency-conflict')
        }
        return current
      }
      const product = marketplaceOrderProduct(current, productId, version)
      if (!product) throw new RoomProtocolError(404, 'paid-marketplace-product-not-found')
      if (product.entry.publisher?.accountId === account.accountId) {
        throw new RoomProtocolError(409, 'marketplace-product-owned-by-account')
      }
      if (activeMarketplaceEntitlement(current.entitlements, {
        accountId: account.accountId,
        productId,
        version,
      }, now)) throw new RoomProtocolError(409, 'marketplace-product-already-owned')
      const livePendingOrders = current.orders.filter((candidate) =>
        candidate.accountId === account.accountId &&
        marketplaceOrderIsPayable(candidate, now))
      if (livePendingOrders.length >= 20) {
        throw new RoomProtocolError(429, 'marketplace-pending-order-limit')
      }
      const pricing = product.version.marketplace.pricing
      const amounts = marketplaceOrderAmounts(
        pricing.amountMinor,
        pricing.creatorShareBps,
        pricing.platformShareBps,
      )
      if (!amounts) throw new RoomProtocolError(409, 'invalid-marketplace-settlement')
      created = true
      return {
        ...current,
        orders: [...current.orders, {
          schemaVersion: MARKETPLACE_ORDER_SCHEMA_VERSION,
          orderId: randomUUID(),
          accountId: account.accountId,
          productId,
          version,
          publisherAccountId: product.entry.publisher.accountId,
          integrity: product.version.integrity,
          currency: pricing.currency,
          ...amounts,
          creatorShareBps: pricing.creatorShareBps,
          platformShareBps: pricing.platformShareBps,
          settlementBasis: pricing.settlementBasis,
          status: 'pending',
          provider: productionSecurityEnabled() ? 'external' : 'sandbox',
          idempotencyKey,
          createdAt: now,
          expiresAt: now + MARKETPLACE_ORDER_TTL_MS,
        }],
      }
    })
    const order = registry.orders.find((candidate) =>
      candidate.accountId === account.accountId && candidate.idempotencyKey === idempotencyKey)
    writeJson(res, created ? 201 : 200, {
      order: marketplaceOrderPublicRecord(order),
      sandboxAvailable: !productionSecurityEnabled(),
      checkoutAvailable: Boolean(marketplaceCheckoutAdapter()),
    })
    return true
  }

  if (parsed.pathname === '/api/marketplace/orders' && req.method === 'GET') {
    const account = await authenticateAccount(req, ctx)
    const registry = await readPluginRegistry(ctx)
    writeJson(res, 200, {
      orders: registry.orders
        .filter((order) => order.accountId === account.accountId)
        .sort((left, right) => Number(right.createdAt ?? 0) - Number(left.createdAt ?? 0))
        .map(marketplaceOrderPublicRecord),
    })
    return true
  }

  const orderMatch = parsed.pathname.match(/^\/api\/marketplace\/orders\/([^/]+)$/)
  if (orderMatch && req.method === 'GET') {
    const account = await authenticateAccount(req, ctx)
    const orderId = decodeURIComponent(orderMatch[1] ?? '')
    const registry = await readPluginRegistry(ctx)
    const order = registry.orders.find((candidate) => candidate.orderId === orderId)
    if (!order) throw new RoomProtocolError(404, 'marketplace-order-not-found')
    if (order.accountId !== account.accountId && !pluginRegistryAdministrator(account)) {
      throw new RoomProtocolError(403, 'forbidden')
    }
    writeJson(res, 200, { order: marketplaceOrderPublicRecord(order) })
    return true
  }

  const checkoutMatch = parsed.pathname.match(
    /^\/api\/marketplace\/orders\/([^/]+)\/checkout$/,
  )
  if (checkoutMatch && req.method === 'POST') {
    if (!marketplacePaidPublishingEnabled()) {
      throw new RoomProtocolError(503, 'marketplace-paid-commerce-disabled')
    }
    const account = await authenticateAccount(req, ctx)
    const orderId = decodeURIComponent(checkoutMatch[1] ?? '')
    const current = await readPluginRegistry(ctx)
    const order = current.orders.find((candidate) => candidate.orderId === orderId)
    if (!order) throw new RoomProtocolError(404, 'marketplace-order-not-found')
    if (order.accountId !== account.accountId) throw new RoomProtocolError(403, 'forbidden')
    if (!marketplaceOrderIsPayable(order)) {
      throw new RoomProtocolError(409, 'marketplace-order-not-payable')
    }
    if (order.checkoutUrl && order.providerOrderId) {
      writeJson(res, 200, {
        order: marketplaceOrderPublicRecord(order),
        checkout: {
          provider: order.provider,
          providerOrderId: order.providerOrderId,
          checkoutUrl: order.checkoutUrl,
          expiresAt: order.checkoutExpiresAt ?? order.expiresAt,
        },
      })
      return true
    }
    const checkout = await createMarketplaceCheckout(order)
    const registry = await mutatePluginRegistry(ctx, (latest) => {
      const latestOrder = latest.orders.find((candidate) => candidate.orderId === orderId)
      if (!latestOrder || latestOrder.accountId !== account.accountId) {
        throw new RoomProtocolError(409, 'marketplace-order-changed')
      }
      if (!marketplaceOrderIsPayable(latestOrder)) {
        throw new RoomProtocolError(409, 'marketplace-order-not-payable')
      }
      if (latestOrder.checkoutUrl && latestOrder.providerOrderId) return latest
      return {
        ...latest,
        orders: latest.orders.map((candidate) => candidate.orderId === orderId
          ? {
              ...candidate,
              provider: checkout.provider,
              providerOrderId: checkout.providerOrderId,
              checkoutUrl: checkout.checkoutUrl,
              checkoutExpiresAt: checkout.expiresAt,
              updatedAt: Date.now(),
            }
          : candidate),
      }
    })
    const updatedOrder = registry.orders.find((candidate) => candidate.orderId === orderId)
    writeJson(res, 201, {
      order: marketplaceOrderPublicRecord(updatedOrder),
      checkout: {
        provider: updatedOrder.provider,
        providerOrderId: updatedOrder.providerOrderId,
        checkoutUrl: updatedOrder.checkoutUrl,
        expiresAt: updatedOrder.checkoutExpiresAt ?? updatedOrder.expiresAt,
      },
    })
    return true
  }

  const sandboxPaymentMatch = parsed.pathname.match(
    /^\/api\/marketplace\/orders\/([^/]+)\/sandbox-payment$/,
  )
  if (sandboxPaymentMatch && req.method === 'POST') {
    if (productionSecurityEnabled()) throw new RoomProtocolError(404, 'not-found')
    const account = await authenticateAccount(req, ctx)
    const orderId = decodeURIComponent(sandboxPaymentMatch[1] ?? '')
    const now = Date.now()
    const registry = await mutatePluginRegistry(ctx, (current) => {
      const order = current.orders.find((candidate) => candidate.orderId === orderId)
      if (!order) throw new RoomProtocolError(404, 'marketplace-order-not-found')
      if (order.accountId !== account.accountId && !pluginRegistryAdministrator(account)) {
        throw new RoomProtocolError(403, 'forbidden')
      }
      return fulfillMarketplaceOrder(current, orderId, {
        provider: 'sandbox',
        providerOrderId: `sandbox:${orderId}`,
        amountMinor: order.amountMinor,
        currency: order.currency,
        now,
      })
    })
    const order = registry.orders.find((candidate) => candidate.orderId === orderId)
    writeJson(res, 200, { order: marketplaceOrderPublicRecord(order) })
    return true
  }

  const cancelMatch = parsed.pathname.match(/^\/api\/marketplace\/orders\/([^/]+)\/cancel$/)
  if (cancelMatch && req.method === 'POST') {
    const account = await authenticateAccount(req, ctx)
    const orderId = decodeURIComponent(cancelMatch[1] ?? '')
    const now = Date.now()
    const registry = await mutatePluginRegistry(ctx, (current) => {
      const order = current.orders.find((candidate) => candidate.orderId === orderId)
      if (!order) throw new RoomProtocolError(404, 'marketplace-order-not-found')
      if (order.accountId !== account.accountId) throw new RoomProtocolError(403, 'forbidden')
      if (order.status === 'canceled') return current
      if (order.status !== 'pending') throw new RoomProtocolError(409, 'marketplace-order-not-cancelable')
      return {
        ...current,
        orders: current.orders.map((candidate) => candidate.orderId === orderId
          ? { ...candidate, status: 'canceled', updatedAt: now }
          : candidate),
      }
    })
    writeJson(res, 200, {
      order: marketplaceOrderPublicRecord(
        registry.orders.find((candidate) => candidate.orderId === orderId),
      ),
    })
    return true
  }

  if (parsed.pathname === '/api/marketplace/payments/webhook' && req.method === 'POST') {
    const bytes = await readBody(req, 128 * 1024)
    const secret = String(process.env.STARS_MARKETPLACE_PAYMENT_WEBHOOK_SECRET ?? '')
    if (!marketplacePaymentWebhookValid(
      bytes,
      req.headers['x-stars-payment-signature'],
      secret,
    )) throw new RoomProtocolError(401, 'invalid-payment-webhook-signature')
    let payload
    try {
      payload = JSON.parse(bytes.toString('utf8'))
    } catch {
      throw new RoomProtocolError(400, 'invalid-json')
    }
    const provider = normalizedLabel(payload?.provider, 40)
    const providerEventId = normalizedLabel(payload?.providerEventId, 160)
    const providerOrderId = normalizedLabel(payload?.providerOrderId, 160)
    const orderId = normalizedLabel(payload?.orderId, 160)
    const status = normalizedLabel(payload?.status, 24)
    const currency = normalizedLabel(payload?.currency, 3)
    const amountMinor = Number(payload?.amountMinor)
    const netReceiptsMinor = payload?.netReceiptsMinor == null
      ? amountMinor
      : Number(payload.netReceiptsMinor)
    if (
      !provider ||
      !providerEventId ||
      !providerOrderId ||
      !orderId ||
      !['paid', 'refunded', 'disputed'].includes(status) ||
      !['CNY', 'USD'].includes(currency) ||
      !Number.isSafeInteger(amountMinor) ||
      !Number.isSafeInteger(netReceiptsMinor)
    ) throw new RoomProtocolError(400, 'invalid-payment-webhook')
    const now = Date.now()
    await mutatePluginRegistry(ctx, (current) => {
      if (current.paymentEvents.some((event) =>
        event.provider === provider && event.providerEventId === providerEventId)) return current
      const updated = status === 'paid'
        ? fulfillMarketplaceOrder(current, orderId, {
            provider,
            providerOrderId,
            amountMinor,
            netReceiptsMinor,
            currency,
            now,
            sourceEventId: providerEventId,
          })
        : updateMarketplaceOrderAfterPaymentReversal(current, orderId, {
            provider,
            providerOrderId,
            status,
            amountMinor,
            currency,
            now,
            sourceEventId: providerEventId,
          })
      return {
        ...updated,
        paymentEvents: [...updated.paymentEvents, {
          provider,
          providerEventId,
          providerOrderId,
          orderId,
          status,
          receivedAt: now,
        }],
      }
    })
    writeJson(res, 200, { ok: true })
    return true
  }

  throw new RoomProtocolError(405, 'method-not-allowed')
}

function pluginRegistryPublicVersion(version) {
  const marketplace = plainObject(version.marketplace)
    ? {
        ...version.marketplace,
        ...(plainObject(version.marketplace.rightsManifest)
          ? {
              rightsManifest: {
                ...version.marketplace.rightsManifest,
                assets: (Array.isArray(version.marketplace.rightsManifest.assets)
                  ? version.marketplace.rightsManifest.assets
                  : []).map(({ evidenceReference: _privateEvidence, ...asset }) => asset),
              },
            }
          : {}),
      }
    : undefined
  return {
    version: version.version,
    integrity: version.integrity,
    stateSchemaVersion: version.stateSchemaVersion,
    manifestSchemaVersion: version.manifestSchemaVersion,
    minimumGameProtocolVersion: version.minimumGameProtocolVersion,
    dependencies: version.dependencies,
    conflicts: version.conflicts,
    declaredCapabilities: version.declaredCapabilities,
    distributionPolicy: version.distributionPolicy,
    contentCategory: version.contentCategory,
    license: version.license,
    fileName: version.fileName,
    sizeBytes: version.sizeBytes,
    changelog: version.changelog,
    ...(version.storeDescription ? { storeDescription: version.storeDescription } : {}),
    visibility: version.visibility,
    status: version.status,
    submittedAt: version.submittedAt,
    ...(marketplace ? { marketplace } : {}),
    ...(plainObject(version.automatedAnalysis) ? { automatedAnalysis: version.automatedAnalysis } : {}),
    ...(plainObject(version.productManifest) ? { productManifest: version.productManifest } : {}),
    ...(plainObject(version.productSignature) ? { productSignature: version.productSignature } : {}),
    ...(version.publishedAt ? { publishedAt: version.publishedAt } : {}),
    ...(version.moderationNote ? { moderationNote: version.moderationNote } : {}),
  }
}

function pluginRegistryPublicEntry(entry, includeUnlisted = false) {
  if (!plainObject(entry)) return null
  const versions = (Array.isArray(entry.versions) ? entry.versions : [])
    .filter((version) =>
      version?.status === 'published' &&
      (includeUnlisted || version.visibility === 'public'))
    .sort((left, right) => Number(right.publishedAt ?? 0) - Number(left.publishedAt ?? 0))
    .map(pluginRegistryPublicVersion)
  if (versions.length === 0) return null
  return {
    schemaVersion: 1,
    id: entry.id,
    name: entry.name,
    description: entry.description,
    publisher: entry.publisher,
    contentCategory: entry.contentCategory,
    tags: Array.isArray(entry.tags) ? entry.tags : [],
    versions,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  }
}

function validateDeclarativePackageForPublication(bytes, plugin) {
  let parsed
  try {
    parsed = JSON.parse(bytes.toString('utf8'))
  } catch {
    throw new RoomProtocolError(400, 'public-plugin-must-be-declarative-json')
  }
  if (
    !plainObject(parsed) ||
    parsed.format !== 'dndstars5e-declarative' ||
    parsed.schemaVersion !== 1 ||
    !plainObject(parsed.manifest) ||
    parsed.manifest.id !== plugin.id ||
    parsed.manifest.name !== plugin.name ||
    parsed.manifest.version !== plugin.version ||
    parsed.manifest.publisher !== plugin.publisher ||
    parsed.manifest.license !== plugin.license ||
    parsed.manifest.apiVersion !== 2 ||
    parsed.manifest.rulesetId !== DND5E_2014_RULESET_ID ||
    parsed.manifest.distributionPolicy !== 'room-distributable'
  ) throw new RoomProtocolError(400, 'invalid-public-plugin-package')
  if (!Array.isArray(parsed.subclasses) || !plainObject(parsed.legacy)) {
    throw new RoomProtocolError(400, 'invalid-public-plugin-package')
  }
  const packageMetadata = {
    stateSchemaVersion: Number(parsed.manifest.stateSchemaVersion ?? 1),
    manifestSchemaVersion: Number(parsed.manifest.manifestSchemaVersion ?? 1),
    minimumGameProtocolVersion: Number(parsed.manifest.minimumGameProtocolVersion ?? 1),
    dependencies: normalizePluginDependencies(parsed.manifest.dependencies),
    conflicts: normalizePluginIds(parsed.manifest.conflicts, PLUGIN_CONFLICT_LIMIT),
    declaredCapabilities: normalizePluginCapabilities(parsed.manifest.declaredCapabilities),
    distributionPolicy: normalizePluginDistributionPolicy(parsed.manifest.distributionPolicy),
    contentCategory: normalizePluginContentCategory(parsed.manifest.contentCategory),
  }
  if (
    packageMetadata.stateSchemaVersion !== plugin.stateSchemaVersion ||
    packageMetadata.manifestSchemaVersion !== plugin.manifestSchemaVersion ||
    packageMetadata.minimumGameProtocolVersion !== plugin.minimumGameProtocolVersion ||
    JSON.stringify(packageMetadata.dependencies) !== JSON.stringify(plugin.dependencies) ||
    JSON.stringify(packageMetadata.conflicts) !== JSON.stringify(plugin.conflicts) ||
    JSON.stringify(packageMetadata.declaredCapabilities) !== JSON.stringify(plugin.declaredCapabilities) ||
    packageMetadata.distributionPolicy !== plugin.distributionPolicy ||
    packageMetadata.contentCategory !== plugin.contentCategory
  ) throw new RoomProtocolError(409, 'public-plugin-metadata-mismatch')
  return parsed
}

function accountAuthLockFile(ctx) {
  return path.join(accountDirectory(ctx), '.auth-registry')
}

function accountIdentityDigest(kind, value) {
  return createHash('sha256').update(`${kind}:${value}`).digest('hex')
}

function accountIdentityFile(ctx, kind, value) {
  return path.join(accountIdentityDirectory(ctx), `${kind}-${accountIdentityDigest(kind, value)}.json`)
}

function accountVerificationFile(ctx, challengeId) {
  return path.join(accountVerificationDirectory(ctx), `${challengeId}.json`)
}

function randomLobbyCode(length) {
  const bytes = randomBytes(length)
  return [...bytes].map((value) => ROOM_CODE_ALPHABET[value & 31]).join('')
}

function normalizeAccountId(value) {
  return String(value ?? '').trim().toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, '').slice(0, 12)
}

function normalizeCampaignId(value) {
  return String(value ?? '').trim().toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, '').slice(0, 12)
}

export function normalizeAccountRecoveryCode(value) {
  const normalized = String(value ?? '').trim().toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, '')
  if (!normalized.startsWith('DS5E') || normalized.length !== 36) return null
  const accountId = normalized.slice(4, 16)
  const secret = normalized.slice(16)
  if (!/^[A-HJ-NP-Z2-9]{12}$/.test(accountId) || !/^[A-HJ-NP-Z2-9]{20}$/.test(secret)) return null
  return { accountId, secret, formatted: `DS5E-${accountId}-${secret.slice(0, 5)}-${secret.slice(5, 10)}-${secret.slice(10, 15)}-${secret.slice(15)}` }
}

export function normalizeAccountUsername(value) {
  const normalized = String(value ?? '').trim().normalize('NFKC')
  if (normalized.length < 3 || normalized.length > 24) return null
  if (!/^[\p{L}\p{N}_-]+$/u.test(normalized)) return null
  // Purely numeric names are ambiguous with phone-number login identifiers.
  if (/^\d+$/.test(normalized)) return null
  return {
    value: normalized,
    key: normalized.toLocaleLowerCase('en-US'),
  }
}

export function normalizeAccountEmail(value) {
  const normalized = String(value ?? '').trim().normalize('NFKC').toLocaleLowerCase('en-US')
  if (normalized.length < 5 || normalized.length > 254) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null
  return normalized
}

export function normalizeAccountPhone(value) {
  let normalized = String(value ?? '').trim().normalize('NFKC').replace(/[\s().-]/g, '')
  if (/^1[3-9]\d{9}$/.test(normalized)) normalized = `+86${normalized}`
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) return null
  return normalized
}

function normalizeAccountContact(channel, value) {
  if (channel === 'email') return normalizeAccountEmail(value)
  if (channel === 'phone') return normalizeAccountPhone(value)
  return null
}

function normalizeAccountPassword(value) {
  if (typeof value !== 'string') return null
  if (value.length < ACCOUNT_PASSWORD_MIN_LENGTH || value.length > ACCOUNT_PASSWORD_MAX_LENGTH) return null
  if (/[\u0000-\u001f\u007f]/.test(value)) return null
  return value
}

function normalizeLoginIdentity(value) {
  const raw = String(value ?? '').trim().normalize('NFKC')
  if (!raw) return null
  if (raw.includes('@')) {
    const email = normalizeAccountEmail(raw)
    return email ? { kind: 'email', key: email } : null
  }
  const phone = normalizeAccountPhone(raw)
  if (phone && (/^\+/.test(raw) || /^\d{8,15}$/.test(raw.replace(/[\s().-]/g, '')))) {
    return { kind: 'phone', key: phone }
  }
  const username = normalizeAccountUsername(raw)
  return username ? { kind: 'username', key: username.key } : null
}

function maskedAccountContact(channel, destination) {
  if (channel === 'email') {
    const [local = '', domain = ''] = String(destination).split('@')
    return `${local.slice(0, 1)}***@${domain}`
  }
  const value = String(destination)
  return `${value.slice(0, Math.min(3, Math.max(1, value.length - 4)))}***${value.slice(-4)}`
}

function verificationWebhookUrl(channel, env = process.env) {
  const value = channel === 'email'
    ? env.STARS_EMAIL_VERIFICATION_WEBHOOK_URL || env.STARS_VERIFICATION_WEBHOOK_URL
    : env.STARS_SMS_VERIFICATION_WEBHOOK_URL || env.STARS_VERIFICATION_WEBHOOK_URL
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const parsed = new URL(value.trim())
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && !productionSecurityEnabled(env))) return null
    return parsed.toString()
  } catch {
    return null
  }
}

function verificationDeliveryConfigured(channel, env = process.env) {
  if (!verificationWebhookUrl(channel, env)) return false
  if (!productionSecurityEnabled(env)) return true
  return typeof env.STARS_VERIFICATION_WEBHOOK_SECRET === 'string' &&
    env.STARS_VERIFICATION_WEBHOOK_SECRET.trim().length >= 16
}

function accountAuthCapabilities(env = process.env) {
  const developmentDelivery = !productionSecurityEnabled(env)
  const tencent = tencentVerificationCapabilities(env)
  return {
    schemaVersion: ACCOUNT_AUTH_SCHEMA_VERSION,
    channels: {
      email: developmentDelivery || verificationDeliveryConfigured('email', env) || tencent.email,
      phone: developmentDelivery || verificationDeliveryConfigured('phone', env) || tencent.phone,
    },
    developmentDelivery,
    verificationExpiresInSeconds: Math.floor(ACCOUNT_VERIFICATION_TTL_MS / 1000),
    passwordMinLength: ACCOUNT_PASSWORD_MIN_LENGTH,
  }
}

async function deliverAccountVerification(channel, destination, code, env = process.env) {
  const webhookUrl = verificationWebhookUrl(channel, env)
  if (!webhookUrl) {
    if (!productionSecurityEnabled(env)) {
      console.info(`[account-verification:${channel}] ${destination} => ${code}`)
      return { debugCode: code }
    }
    const tencent = tencentVerificationCapabilities(env)
    if (!tencent[channel]) throw new RoomProtocolError(503, 'verification-provider-unavailable')
    try {
      await deliverTencentVerification(channel, destination, code, { env })
      return { debugCode: null }
    } catch (error) {
      console.error('[account-verification] Tencent Cloud delivery failed:', error?.message ?? error)
      throw new RoomProtocolError(503, 'verification-delivery-failed')
    }
  }
  if (productionSecurityEnabled(env) && !verificationDeliveryConfigured(channel, env)) {
    throw new RoomProtocolError(503, 'verification-provider-unavailable')
  }
  const headers = { 'Content-Type': 'application/json' }
  const secret = String(env.STARS_VERIFICATION_WEBHOOK_SECRET ?? '').trim()
  if (secret) headers.Authorization = `Bearer ${secret}`
  let response
  try {
    response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        schemaVersion: 1,
        brand: 'Astral Trace VTT',
        purpose: 'register',
        channel,
        destination,
        code,
        expiresInSeconds: Math.floor(ACCOUNT_VERIFICATION_TTL_MS / 1000),
      }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new RoomProtocolError(503, 'verification-delivery-failed')
  }
  if (!response.ok) throw new RoomProtocolError(503, 'verification-delivery-failed')
  return { debugCode: null }
}

function secretRecord(secret) {
  const salt = randomBytes(16).toString('base64')
  const hash = scryptSync(secret, salt, 32).toString('base64')
  return { salt, hash }
}

function secretMatches(record, secret) {
  if (!plainObject(record) || typeof record.salt !== 'string' || typeof record.hash !== 'string') return false
  try {
    const actual = scryptSync(secret, record.salt, 32)
    const expected = Buffer.from(record.hash, 'base64')
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

function accountSessionToken(accountId) {
  return `${accountId}.${randomBytes(32).toString('base64url')}`
}

function tokenHash(token) {
  return createHash('sha256').update(String(token)).digest('hex')
}

function accountPublicProfile(account) {
  return {
    accountId: account.accountId,
    displayName: account.displayName,
    ...(typeof account.avatar === 'string' && account.avatar ? { avatar: account.avatar } : {}),
    ...(account.auth?.username ? { username: account.auth.username } : {}),
    ...(account.auth?.channel && account.auth?.destination
      ? {
          contactChannel: account.auth.channel,
          contactLabel: maskedAccountContact(account.auth.channel, account.auth.destination),
        }
      : {}),
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    pluginAdmin: pluginRegistryAdministrator(account),
  }
}

function normalizeCampaignDescription(value) {
  if (value == null || value === '') return ''
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length <= 800 ? normalized : null
}

function accountCampaigns(account) {
  return (Array.isArray(account?.campaigns) ? account.campaigns : []).filter((campaign) =>
    plainObject(campaign) &&
    campaign.schemaVersion === ACCOUNT_CAMPAIGN_SCHEMA_VERSION &&
    normalizeCampaignId(campaign.campaignId) === campaign.campaignId &&
    campaign.campaignId.length === 12 &&
    campaign.ownerAccountId === account.accountId &&
    campaign.rulesetId === DND5E_2014_RULESET_ID &&
    typeof campaign.name === 'string' &&
    Number.isFinite(campaign.createdAt) &&
    Number.isFinite(campaign.updatedAt))
}

async function readLobbyRoomOptional(ctx, roomId) {
  const normalized = normalizeLobbyRoomCode(roomId)
  if (normalized.length !== 6) return null
  try {
    const room = JSON.parse(await readFile(roomLobbyFile(ctx, normalized), 'utf8'))
    return plainObject(room) && room.id === normalized ? room : null
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

async function accountCampaignResponse(ctx, campaign) {
  const history = Array.isArray(campaign.roomHistory) ? campaign.roomHistory : []
  const lastRoomId = normalizeLobbyRoomCode(campaign.lastRoomId)
  const room = lastRoomId.length === 6 ? await readLobbyRoomOptional(ctx, lastRoomId) : null
  const hostStatus = room ? roomHostPresence(room) : 'closed'
  return {
    schemaVersion: ACCOUNT_CAMPAIGN_SCHEMA_VERSION,
    campaignId: campaign.campaignId,
    name: campaign.name,
    description: typeof campaign.description === 'string' ? campaign.description : '',
    rulesetId: campaign.rulesetId,
    archived: campaign.archived === true,
    roomCount: Number.isSafeInteger(campaign.roomCount) && campaign.roomCount >= history.length
      ? campaign.roomCount
      : history.length,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
    ...(room
      ? {
          latestRoom: {
            roomId: room.id,
            roomName: room.name,
            createdAt: room.createdAt,
            ...(Number.isFinite(room.closedAt) ? { closedAt: room.closedAt } : {}),
            hostOnline: roomHostIsOnline(room),
            status: hostStatus,
          },
        }
      : {}),
  }
}

async function accountCampaignListResponse(ctx, account) {
  return Promise.all(accountCampaigns(account)
    .sort((left, right) => right.updatedAt - left.updatedAt || left.name.localeCompare(right.name))
    .map((campaign) => accountCampaignResponse(ctx, campaign)))
}

function accountSessionResponse(account, token) {
  return {
    accountId: account.accountId,
    displayName: account.displayName,
    ...(typeof account.avatar === 'string' && account.avatar ? { avatar: account.avatar } : {}),
    ...(account.auth?.username ? { username: account.auth.username } : {}),
    ...(account.auth?.channel && account.auth?.destination
      ? {
          contactChannel: account.auth.channel,
          contactLabel: maskedAccountContact(account.auth.channel, account.auth.destination),
        }
      : {}),
    sessionToken: token,
    createdAt: account.createdAt,
  }
}

function normalizeAccountAvatar(value) {
  if (value == null || value === '') return ''
  if (typeof value !== 'string' || value.length > 400_000) return null
  return /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(value) ? value : null
}

async function readAccount(ctx, accountId) {
  const normalized = normalizeAccountId(accountId)
  if (normalized !== accountId || normalized.length !== 12) throw new RoomProtocolError(401, 'invalid-account-session')
  const store = await accountPersistentStore(ctx)
  if (store) {
    const persisted = await store.readAccount(normalized)
    if (persisted) {
      if (!plainObject(persisted) || persisted.accountId !== normalized) {
        throw new Error('invalid persistent account record')
      }
      return persisted
    }
  }
  try {
    const account = JSON.parse(await readFile(accountFile(ctx, normalized), 'utf8'))
    if (!plainObject(account) || account.accountId !== normalized) throw new Error('invalid account record')
    // Persistent-storage rollout is deliberately lazy-compatible: an account not present in
    // the new index is imported from the untouched JSON rollback source once.
    if (store) {
      await store.writeAccount(account, { sourcePath: accountFile(ctx, normalized) })
    }
    return account
  } catch (error) {
    if (error?.code === 'ENOENT') throw new RoomProtocolError(401, 'invalid-account-session')
    throw error
  }
}

async function authenticateAccount(req, ctx, optional = false) {
  const token = req?.headers?.['x-stars-account-token']
  if (typeof token !== 'string' || token.length < 32) {
    if (optional) return null
    throw new RoomProtocolError(401, 'invalid-account-session')
  }
  const separator = token.indexOf('.')
  const accountId = separator > 0 ? token.slice(0, separator) : ''
  const account = await readAccount(ctx, accountId)
  const hash = tokenHash(token)
  const valid = (Array.isArray(account.sessions) ? account.sessions : []).some((session) =>
    typeof session?.tokenHash === 'string' && session.tokenHash.length === hash.length &&
    timingSafeEqual(Buffer.from(session.tokenHash), Buffer.from(hash)))
  if (!valid) throw new RoomProtocolError(401, 'invalid-account-session')
  return account
}

async function mutateAccount(ctx, accountId, updater) {
  const filePath = accountFile(ctx, accountId)
  return withWriteLock(filePath, async () => {
    let account
    const store = await accountPersistentStore(ctx)
    if (store) account = await store.readAccount(accountId)
    if (!account) {
      try {
        account = JSON.parse(await readFile(filePath, 'utf8'))
      } catch (error) {
        if (error?.code === 'ENOENT') throw new RoomProtocolError(401, 'invalid-account-session')
        throw error
      }
    }
    const next = await updater(account)
    if (!plainObject(next) || next.accountId !== accountId) throw new RoomProtocolError(400, 'account-operation-failed')
    if (store) await store.writeAccount(next)
    await atomicRename(filePath, JSON.stringify(next))
    return next
  })
}

async function createAccountRecord(ctx, payload, now = Date.now()) {
  const displayName = normalizedLabel(payload?.displayName, 24)
  const clientId = payload?.clientId
  if (!displayName) throw new RoomProtocolError(400, 'invalid-account-name')
  if (!validClientId(clientId)) throw new RoomProtocolError(400, 'invalid-client')
  await mkdir(accountDirectory(ctx), { recursive: true })
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const accountId = randomLobbyCode(12)
    const recoverySecret = randomLobbyCode(20)
    const recoveryCode = `DS5E-${accountId}-${recoverySecret.slice(0, 5)}-${recoverySecret.slice(5, 10)}-${recoverySecret.slice(10, 15)}-${recoverySecret.slice(15)}`
    const token = accountSessionToken(accountId)
    const account = {
      version: 1,
      accountId,
      displayName,
      recovery: secretRecord(recoverySecret),
      sessions: [{ tokenHash: tokenHash(token), clientId, createdAt: now, lastSeenAt: now }],
      characters: [],
      campaigns: [],
      createdAt: now,
      updatedAt: now,
    }
    try {
      await writeFile(accountFile(ctx, accountId), JSON.stringify(account), { flag: 'wx' })
      try {
        await syncAccountToPersistentStore(ctx, account, { createOnly: true })
      } catch (error) {
        await rm(accountFile(ctx, accountId), { force: true })
        if (error?.code === 'ACCOUNT_EXISTS') continue
        throw error
      }
      return { account, token, recoveryCode }
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error
    }
  }
  throw new RoomProtocolError(503, 'account-id-exhausted')
}

async function readAccountIdentity(ctx, kind, key) {
  const store = await accountPersistentStore(ctx)
  if (store) {
    const accountId = await store.findIdentity(kind, accountIdentityDigest(kind, key))
    if (accountId) return accountId
  }
  try {
    const value = JSON.parse(await readFile(accountIdentityFile(ctx, kind, key), 'utf8'))
    if (!plainObject(value) || normalizeAccountId(value.accountId) !== value.accountId) return null
    return value.accountId
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

function applyAccountAuthRateLimit(ctx, key, limit, windowMs, now = Date.now()) {
  if (!ctx.rateLimits) ctx.rateLimits = new Map()
  const result = consumeRateLimit(ctx.rateLimits, `account-auth:${key}`, now, limit, windowMs)
  if (!result.ok) throw new RoomProtocolError(429, 'account-auth-rate-limit')
}

async function requestAccountVerification(ctx, req, payload, now = Date.now()) {
  const channel = payload?.channel === 'email' || payload?.channel === 'phone' ? payload.channel : null
  const destination = normalizeAccountContact(channel, payload?.destination)
  if (!channel || !destination) throw new RoomProtocolError(400, 'invalid-verification-destination')
  if (!accountAuthCapabilities().channels[channel]) {
    throw new RoomProtocolError(503, 'verification-provider-unavailable')
  }
  const destinationDigest = accountIdentityDigest(channel, destination)
  const ip = req.socket?.remoteAddress ?? 'local'
  applyAccountAuthRateLimit(ctx, `verification-ip:${ip}`, 8, 10 * 60 * 1000, now)
  applyAccountAuthRateLimit(ctx, `verification-destination:${destinationDigest}`, 3, 10 * 60 * 1000, now)
  await mkdir(accountIdentityDirectory(ctx), { recursive: true })
  await mkdir(accountVerificationDirectory(ctx), { recursive: true })
  if (await readAccountIdentity(ctx, channel, destination)) {
    throw new RoomProtocolError(409, 'account-contact-exists')
  }

  const challengeId = randomUUID()
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const delivery = await deliverAccountVerification(channel, destination, code)
  const challenge = {
    version: 1,
    challengeId,
    purpose: 'register',
    channel,
    destination,
    destinationDigest,
    code: secretRecord(code),
    failedAttempts: 0,
    createdAt: now,
    expiresAt: now + ACCOUNT_VERIFICATION_TTL_MS,
  }
  await writeFile(accountVerificationFile(ctx, challengeId), JSON.stringify(challenge), { flag: 'wx', mode: 0o600 })
  return {
    challengeId,
    channel,
    destinationLabel: maskedAccountContact(channel, destination),
    expiresAt: challenge.expiresAt,
    ...(delivery.debugCode ? { debugCode: delivery.debugCode } : {}),
  }
}

function normalizeVerificationChallengeId(value) {
  const challengeId = String(value ?? '').trim().toLowerCase()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(challengeId)
    ? challengeId
    : null
}

async function readVerificationChallenge(ctx, challengeId) {
  try {
    const challenge = JSON.parse(await readFile(accountVerificationFile(ctx, challengeId), 'utf8'))
    if (!plainObject(challenge) || challenge.challengeId !== challengeId) {
      throw new RoomProtocolError(400, 'invalid-verification-code')
    }
    return challenge
  } catch (error) {
    if (error?.code === 'ENOENT') throw new RoomProtocolError(400, 'invalid-verification-code')
    throw error
  }
}

async function createRegisteredAccount(ctx, payload, now = Date.now()) {
  const username = normalizeAccountUsername(payload?.username)
  const password = normalizeAccountPassword(payload?.password)
  const challengeId = normalizeVerificationChallengeId(payload?.challengeId)
  const verificationCode = typeof payload?.verificationCode === 'string'
    ? payload.verificationCode.trim()
    : ''
  const clientId = payload?.clientId
  if (!username) throw new RoomProtocolError(400, 'invalid-account-username')
  if (!password) throw new RoomProtocolError(400, 'invalid-account-password')
  if (!challengeId || !/^\d{6}$/.test(verificationCode)) {
    throw new RoomProtocolError(400, 'invalid-verification-code')
  }
  if (!validClientId(clientId)) throw new RoomProtocolError(400, 'invalid-client')

  await mkdir(accountDirectory(ctx), { recursive: true })
  await mkdir(accountIdentityDirectory(ctx), { recursive: true })
  await mkdir(accountVerificationDirectory(ctx), { recursive: true })
  return withWriteLock(accountAuthLockFile(ctx), async () => {
    const challenge = await readVerificationChallenge(ctx, challengeId)
    if (challenge.purpose !== 'register' || challenge.consumedAt || Number(challenge.expiresAt) < now) {
      throw new RoomProtocolError(400, 'verification-code-expired')
    }
    if (Number(challenge.failedAttempts ?? 0) >= ACCOUNT_VERIFICATION_ATTEMPT_LIMIT) {
      throw new RoomProtocolError(429, 'verification-attempt-limit')
    }
    if (!secretMatches(challenge.code, verificationCode)) {
      await atomicRename(accountVerificationFile(ctx, challengeId), JSON.stringify({
        ...challenge,
        failedAttempts: Number(challenge.failedAttempts ?? 0) + 1,
        updatedAt: now,
      }))
      throw new RoomProtocolError(400, 'invalid-verification-code')
    }
    if (await readAccountIdentity(ctx, 'username', username.key)) {
      throw new RoomProtocolError(409, 'account-username-exists')
    }
    if (await readAccountIdentity(ctx, challenge.channel, challenge.destination)) {
      throw new RoomProtocolError(409, 'account-contact-exists')
    }

    const recoverySecret = randomLobbyCode(20)
    const tokenSeed = randomLobbyCode(20)
    let account = null
    let token = null
    for (let attempt = 0; attempt < 32; attempt += 1) {
      const accountId = randomLobbyCode(12)
      token = accountSessionToken(accountId)
      account = {
        version: 2,
        accountId,
        displayName: username.value,
        auth: {
          schemaVersion: ACCOUNT_AUTH_SCHEMA_VERSION,
          username: username.value,
          usernameKey: username.key,
          channel: challenge.channel,
          destination: challenge.destination,
          destinationVerifiedAt: now,
          password: secretRecord(password),
        },
        recovery: secretRecord(`${recoverySecret}${tokenSeed}`),
        sessions: [{ tokenHash: tokenHash(token), clientId, createdAt: now, lastSeenAt: now }],
        characters: [],
        campaigns: [],
        createdAt: now,
        updatedAt: now,
      }
      try {
        await writeFile(accountFile(ctx, accountId), JSON.stringify(account), { flag: 'wx', mode: 0o600 })
        break
      } catch (error) {
        account = null
        token = null
        if (error?.code !== 'EEXIST') throw error
      }
    }
    if (!account || !token) throw new RoomProtocolError(503, 'account-id-exhausted')

    const indexRecords = [
      ['username', username.key],
      [challenge.channel, challenge.destination],
    ]
    const writtenIndexes = []
    let persistentCreated = false
    try {
      for (const [kind, key] of indexRecords) {
        const filePath = accountIdentityFile(ctx, kind, key)
        await writeFile(filePath, JSON.stringify({ version: 1, accountId: account.accountId, createdAt: now }), {
          flag: 'wx',
          mode: 0o600,
        })
        writtenIndexes.push(filePath)
      }
      await syncAccountToPersistentStore(ctx, account, { createOnly: true })
      persistentCreated = accountStorageBackend(ctx) !== 'json'
      const consumed = { ...challenge, consumedAt: now, updatedAt: now }
      delete consumed.code
      await atomicRename(accountVerificationFile(ctx, challengeId), JSON.stringify(consumed))
    } catch (error) {
      if (persistentCreated) {
        const store = await accountPersistentStore(ctx).catch(() => null)
        await store?.deleteAccount(account.accountId)
      }
      await Promise.allSettled([
        rm(accountFile(ctx, account.accountId), { force: true }),
        ...writtenIndexes.map((filePath) => rm(filePath, { force: true })),
      ])
      if (error?.code === 'EEXIST') throw new RoomProtocolError(409, 'account-identity-exists')
      throw error
    }
    return { account, token }
  })
}

async function loginRegisteredAccount(ctx, req, payload, now = Date.now()) {
  const identity = normalizeLoginIdentity(payload?.identifier)
  const password = normalizeAccountPassword(payload?.password)
  const clientId = payload?.clientId
  if (!identity || !password || !validClientId(clientId)) {
    throw new RoomProtocolError(401, 'invalid-account-credentials')
  }
  const ip = req.socket?.remoteAddress ?? 'local'
  const identityDigest = accountIdentityDigest(identity.kind, identity.key)
  applyAccountAuthRateLimit(ctx, `login-ip:${ip}`, 20, 10 * 60 * 1000, now)
  applyAccountAuthRateLimit(ctx, `login-identity:${identityDigest}`, 10, 10 * 60 * 1000, now)

  const accountId = await readAccountIdentity(ctx, identity.kind, identity.key)
  const account = accountId ? await readAccount(ctx, accountId).catch(() => null) : null
  const passwordRecord = account?.auth?.password ?? {
    salt: 'tyP2VRO4rUkF4N7mM7utOw==',
    hash: 'n5J5vRJh2g/A6DDsS7E2p5g08tLcZlC2HqH+Ua9lBFQ=',
  }
  if (!secretMatches(passwordRecord, password) || !account?.auth) {
    throw new RoomProtocolError(401, 'invalid-account-credentials')
  }

  const token = accountSessionToken(account.accountId)
  const next = await mutateAccount(ctx, account.accountId, (current) => ({
    ...current,
    sessions: [
      ...(Array.isArray(current.sessions) ? current.sessions : []),
      { tokenHash: tokenHash(token), clientId, createdAt: now, lastSeenAt: now },
    ].slice(-ACCOUNT_SESSION_LIMIT),
    updatedAt: now,
  }))
  return { account: next, token }
}

async function logoutAccount(req, ctx) {
  const account = await authenticateAccount(req, ctx)
  const token = req?.headers?.['x-stars-account-token']
  const hash = tokenHash(token)
  const now = Date.now()
  await mutateAccount(ctx, account.accountId, (current) => ({
    ...current,
    sessions: (Array.isArray(current.sessions) ? current.sessions : [])
      .filter((session) => session?.tokenHash !== hash),
    updatedAt: now,
  }))
}

function normalizedAccountCharacterRecord(value, accountId, expectedId, now = Date.now()) {
  if (!plainObject(value) || !plainObject(value.character) || !plainObject(value.compatibility)) {
    throw new RoomProtocolError(400, 'invalid-account-character')
  }
  const id = normalizedLabel(value.id, 128)
  if (!id || id !== expectedId || value.character.id !== id) throw new RoomProtocolError(400, 'invalid-account-character')
  const compatibility = value.compatibility
  const requiredPlugins = normalizeRoomPluginRequirements(compatibility.requiredPlugins ?? [])
  if (
    compatibility.rulesetId !== DND5E_2014_RULESET_ID || !requiredPlugins ||
    !Number.isInteger(compatibility.characterSchemaVersion) || compatibility.characterSchemaVersion < 1 ||
    !Number.isInteger(compatibility.minimumGameProtocolVersion) || compatibility.minimumGameProtocolVersion < 1 ||
    !Number.isInteger(compatibility.lastSavedGameProtocolVersion) || compatibility.lastSavedGameProtocolVersion < 1
  ) throw new RoomProtocolError(400, 'invalid-account-character')
  const character = { ...value.character, ownerAccountId: accountId }
  delete character.roomId
  delete character.roomMemberId
  const name = normalizedLabel(character.name, 80)
  if (!name) throw new RoomProtocolError(400, 'invalid-account-character')
  return {
    id,
    name,
    updatedAt: now,
    character: { ...character, name },
    compatibility: {
      rulesetId: DND5E_2014_RULESET_ID,
      characterSchemaVersion: compatibility.characterSchemaVersion,
      minimumGameProtocolVersion: compatibility.minimumGameProtocolVersion,
      lastSavedGameProtocolVersion: compatibility.lastSavedGameProtocolVersion,
      requiredPlugins,
    },
  }
}

function normalizeAccountPluginVersion(value) {
  if (!plainObject(value)) return null
  const id = typeof value.id === 'string' ? value.id.trim() : ''
  const version = typeof value.version === 'string' ? value.version.trim() : ''
  const integrity = typeof value.integrity === 'string' ? value.integrity.trim() : ''
  const name = normalizedLabel(value.name, 100)
  const publisher = normalizedLabel(value.publisher, 100)
  const license = normalizedLabel(value.license, 120)
  const description = normalizedLabel(value.description, 2_000)
  const fileName = normalizedLabel(value.fileName, 180)
  const apiVersion = Number(value.apiVersion)
  const stateSchemaVersion = Number(value.stateSchemaVersion ?? 1)
  const manifestSchemaVersion = Number(value.manifestSchemaVersion ?? 1)
  const minimumGameProtocolVersion = Number(value.minimumGameProtocolVersion ?? 1)
  const sizeBytes = Number(value.sizeBytes)
  const dependencies = normalizePluginDependencies(value.dependencies)
  const conflicts = normalizePluginIds(value.conflicts, PLUGIN_CONFLICT_LIMIT)
  const declaredCapabilities = normalizePluginCapabilities(value.declaredCapabilities)
  const distributionPolicy = normalizePluginDistributionPolicy(value.distributionPolicy)
  const contentCategory = normalizePluginContentCategory(value.contentCategory)
  if (
    !/^[a-z0-9][a-z0-9._-]{0,99}$/.test(id) ||
    !/^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/.test(version) ||
    !/^sha256-[A-Za-z0-9+/]+={0,2}$/.test(integrity) ||
    !name || !publisher || !license || !fileName ||
    ![1, 2].includes(apiVersion) ||
    value.rulesetId !== DND5E_2014_RULESET_ID ||
    !Number.isInteger(stateSchemaVersion) || stateSchemaVersion < 1 || stateSchemaVersion > 1_000 ||
    manifestSchemaVersion !== PLUGIN_MANIFEST_SCHEMA_VERSION ||
    !Number.isInteger(minimumGameProtocolVersion) || minimumGameProtocolVersion < 1 ||
    minimumGameProtocolVersion > 10_000 ||
    !dependencies || !conflicts || !declaredCapabilities || !distributionPolicy || !contentCategory ||
    !Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > STATE_MAX_BYTES ||
    !Number.isFinite(value.createdAt) || !Number.isFinite(value.updatedAt)
  ) return null
  return {
    schemaVersion: 1,
    id,
    name,
    version,
    apiVersion,
    rulesetId: DND5E_2014_RULESET_ID,
    stateSchemaVersion,
    manifestSchemaVersion,
    minimumGameProtocolVersion,
    dependencies,
    conflicts,
    declaredCapabilities,
    distributionPolicy,
    contentCategory,
    publisher,
    license,
    ...(description ? { description } : {}),
    fileName,
    integrity,
    sizeBytes,
    visibility: 'private',
    createdAt: Number(value.createdAt),
    updatedAt: Number(value.updatedAt),
  }
}

function normalizePluginIds(value, limit) {
  if (value == null) return []
  if (!Array.isArray(value) || value.length > limit) return null
  const result = []
  for (const candidate of value) {
    const id = typeof candidate === 'string' ? candidate.trim() : ''
    if (!/^[a-z0-9][a-z0-9._-]{0,99}$/.test(id) || result.includes(id)) return null
    result.push(id)
  }
  return result
}

function normalizePluginDependencies(value) {
  if (value == null) return []
  if (!Array.isArray(value) || value.length > PLUGIN_DEPENDENCY_LIMIT) return null
  const result = []
  for (const candidate of value) {
    if (!plainObject(candidate)) return null
    const id = typeof candidate.id === 'string' ? candidate.id.trim() : ''
    const versionRange = normalizedLabel(candidate.versionRange, 120)
    if (
      !/^[a-z0-9][a-z0-9._-]{0,99}$/.test(id) ||
      !versionRange || result.some((dependency) => dependency.id === id) ||
      (candidate.optional != null && typeof candidate.optional !== 'boolean')
    ) return null
    result.push({ id, versionRange, ...(candidate.optional ? { optional: true } : {}) })
  }
  return result
}

function normalizePluginCapabilities(value) {
  const allowed = new Set([
    'damage', 'healing', 'temporary-hit-points', 'standard-condition', 'movement',
    'resource', 'summon', 'persistent-area', 'spell-transaction', 'interrupt',
  ])
  if (value == null) return []
  if (!Array.isArray(value) || value.length > allowed.size) return null
  const result = []
  for (const candidate of value) {
    if (typeof candidate !== 'string' || !allowed.has(candidate) || result.includes(candidate)) return null
    result.push(candidate)
  }
  return result
}

function normalizePluginDistributionPolicy(value) {
  if (value == null) return 'room-distributable'
  return ['room-distributable', 'room-ephemeral', 'account-entitled', 'local-only'].includes(value)
    ? value
    : null
}

function normalizePluginContentCategory(value) {
  if (value == null) return 'mixed'
  return ['rules', 'subclasses', 'spells', 'items', 'monsters', 'adventure', 'mixed'].includes(value)
    ? value
    : null
}

function decodedPluginMetadataHeader(req) {
  const raw = req?.headers?.['x-stars-plugin-metadata']
  if (raw == null || raw === '') return {}
  if (typeof raw !== 'string' || raw.length > 16_000) throw new RoomProtocolError(400, 'invalid-account-plugin')
  try {
    const parsed = JSON.parse(decodeURIComponent(raw))
    if (!plainObject(parsed)) throw new Error('metadata must be an object')
    return parsed
  } catch {
    throw new RoomProtocolError(400, 'invalid-account-plugin')
  }
}

function accountPluginVersions(account) {
  return (Array.isArray(account?.pluginLibrary) ? account.pluginLibrary : [])
    .map(normalizeAccountPluginVersion)
    .filter(Boolean)
}

function accountPluginVersionFromUpload(req, pluginId, pluginVersion, sizeBytes, now = Date.now()) {
  const metadata = decodedPluginMetadataHeader(req)
  const stateSchemaVersion = Number(req?.headers?.['x-stars-plugin-state-schema'] ?? 1)
  const apiVersion = Number(req?.headers?.['x-stars-plugin-api-version'])
  const rulesetId = typeof req?.headers?.['x-stars-plugin-ruleset'] === 'string'
    ? req.headers['x-stars-plugin-ruleset'].trim()
    : ''
  const integrity = typeof req?.headers?.['x-stars-plugin-integrity'] === 'string'
    ? req.headers['x-stars-plugin-integrity'].trim()
    : ''
  const name = decodedPluginHeader(req, 'x-stars-plugin-name', 100)
  const publisher = decodedPluginHeader(req, 'x-stars-plugin-publisher', 100)
  const license = decodedPluginHeader(req, 'x-stars-plugin-license', 120)
  const description = decodedPluginHeader(req, 'x-stars-plugin-description', 2_000)
  const encodedFileName = typeof req?.headers?.['x-stars-plugin-filename'] === 'string'
    ? req.headers['x-stars-plugin-filename']
    : ''
  let fileName = `${pluginId}.dndstars5e`
  try {
    fileName = normalizedLabel(decodeURIComponent(encodedFileName), 180) || fileName
  } catch {
    throw new RoomProtocolError(400, 'invalid-account-plugin')
  }
  const record = normalizeAccountPluginVersion({
    id: pluginId,
    name,
    version: pluginVersion,
    apiVersion,
    rulesetId,
    stateSchemaVersion,
    manifestSchemaVersion: metadata.manifestSchemaVersion,
    minimumGameProtocolVersion: metadata.minimumGameProtocolVersion,
    dependencies: metadata.dependencies,
    conflicts: metadata.conflicts,
    declaredCapabilities: metadata.declaredCapabilities,
    distributionPolicy: metadata.distributionPolicy,
    contentCategory: metadata.contentCategory,
    publisher,
    license,
    description,
    fileName,
    integrity,
    sizeBytes,
    createdAt: now,
    updatedAt: now,
  })
  if (!record) throw new RoomProtocolError(400, 'invalid-account-plugin')
  return record
}

function roomPluginDirectory(ctx, roomId) {
  return path.join(lobbyRoot(ctx), 'plugins', roomId)
}

function roomPluginFile(ctx, roomId, pluginId) {
  return path.join(roomPluginDirectory(ctx, roomId), `${safeName(pluginId)}.dndstars5e`)
}

function roomPluginVersionFile(ctx, roomId, pluginId, integrity) {
  const pin = createHash('sha256').update(String(integrity)).digest('hex').slice(0, 32)
  return path.join(roomPluginDirectory(ctx, roomId), `${safeName(pluginId)}-${pin}.dndstars5e`)
}

function roomHostedPluginFile(ctx, roomId, pluginId, hosted) {
  const storageFile = typeof hosted?.storageFile === 'string' ? hosted.storageFile : ''
  if (/^[a-zA-Z0-9._-]{1,180}\.dndstars5e$/.test(storageFile)) {
    return path.join(roomPluginDirectory(ctx, roomId), storageFile)
  }
  return roomPluginFile(ctx, roomId, pluginId)
}

function roomEphemeralPluginStoragePaths(ctx, roomId, room, onlyPluginId = null) {
  const paths = new Set()
  for (const collection of [room?.pluginFiles, room?.stagedPluginFiles]) {
    if (!plainObject(collection)) continue
    for (const [pluginId, hosted] of Object.entries(collection)) {
      if (onlyPluginId && pluginId !== onlyPluginId) continue
      if (hosted?.distributionPolicy !== 'room-ephemeral') continue
      paths.add(roomHostedPluginFile(ctx, roomId, pluginId, hosted))
    }
  }
  return [...paths]
}

function withoutRoomEphemeralPlugins(room) {
  const ephemeralIds = new Set()
  for (const collection of [room?.pluginFiles, room?.stagedPluginFiles]) {
    if (!plainObject(collection)) continue
    for (const [pluginId, hosted] of Object.entries(collection)) {
      if (hosted?.distributionPolicy === 'room-ephemeral') ephemeralIds.add(pluginId)
    }
  }
  if (ephemeralIds.size === 0) return room
  const pluginFiles = { ...(room.pluginFiles ?? {}) }
  const stagedPluginFiles = { ...(room.stagedPluginFiles ?? {}) }
  const pluginRuntimeState = { ...(room.pluginRuntimeState ?? {}) }
  for (const pluginId of ephemeralIds) {
    delete pluginFiles[pluginId]
    delete stagedPluginFiles[pluginId]
    delete pluginRuntimeState[pluginId]
  }
  return {
    ...room,
    requiredPlugins: (Array.isArray(room.requiredPlugins) ? room.requiredPlugins : [])
      .filter((requirement) => !ephemeralIds.has(requirement.id)),
    pluginFiles,
    stagedPluginFiles,
    pluginRuntimeState,
  }
}

async function removeRoomEphemeralPluginStorage(paths) {
  await Promise.all(paths.map((filePath) => rm(filePath, { force: true }).catch(() => {})))
}

function lobbyRoomMember(room, memberId) {
  if (room?.host?.memberId === memberId) return room.host
  return (Array.isArray(room?.players) ? room.players : []).find((player) => player.memberId === memberId)
}

function generatedRoomCode() {
  const bytes = randomBytes(6)
  return [...bytes].map((value) => ROOM_CODE_ALPHABET[value & 31]).join('')
}

function normalizedLabel(value, maxLength) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, maxLength)
}

function validClientId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(value)
}

function normalizedRoomPassword(value) {
  if (value == null || value === '') return ''
  return String(value).trim()
}

function roomPasswordRecord(password) {
  if (!password) return null
  const salt = randomBytes(16).toString('base64')
  const hash = scryptSync(password, salt, 32).toString('base64')
  return { salt, hash }
}

function roomPasswordMatches(room, password) {
  if (!plainObject(room?.joinSecret)) return true
  const supplied = normalizedRoomPassword(password)
  if (!supplied) return false
  try {
    const actual = scryptSync(supplied, room.joinSecret.salt, 32)
    const expected = Buffer.from(room.joinSecret.hash, 'base64')
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

async function readJsonRequest(req, maxBytes = 64 * 1024) {
  const body = await readBody(req, maxBytes)
  try {
    return JSON.parse(body.toString('utf8'))
  } catch {
    throw new RoomProtocolError(400, 'invalid-json')
  }
}

function normalizeDnd5eHouseRules(value) {
  const source = plainObject(value) ? value : {}
  const multiplier = Number(source.declarativeAbilityDamageMultiplier)
  const shortRestMinutes = Number(source.shortRestMinutes)
  const longRestHours = Number(source.longRestHours)
  return {
    declarativeAbilityDamageMultiplier: Number.isFinite(multiplier) && multiplier >= 0 && multiplier <= 10 ? multiplier : 1,
    criticalHitMode: source.criticalHitMode === 'maximum-extra-die' ? 'maximum-extra-die' : 'double-dice',
    advantageMode: source.advantageMode === 'stacking-cancel' ? 'stacking-cancel' : 'standard',
    shortRestMinutes: Number.isInteger(shortRestMinutes) && shortRestMinutes >= 1 && shortRestMinutes <= 1440 ? shortRestMinutes : 60,
    longRestHours: Number.isInteger(longRestHours) && longRestHours >= 1 && longRestHours <= 24 ? longRestHours : 8,
  }
}

function roomRulesResponse(room, member) {
  const requiredPlugins = Array.isArray(room.requiredPlugins) ? room.requiredPlugins : []
  const revision = Number.isFinite(room.rulesRevision) ? room.rulesRevision : 1
  const houseRules = normalizeDnd5eHouseRules(room.dnd5eHouseRules)
  const hash = `sha256-${createHash('sha256').update(JSON.stringify({
    schemaVersion: 1,
    rulesetId: room.rulesetId,
    revision,
    houseRules,
    requiredPlugins,
  })).digest('base64')}`
  return {
    schemaVersion: 1,
    roomId: room.id,
    rulesetId: room.rulesetId,
    revision,
    hash,
    updatedAt: room.rulesUpdatedAt ?? room.updatedAt ?? room.createdAt,
    houseRules,
    requiredPlugins,
    plugins: requiredPlugins.map((requirement) => {
      const hosted = room.pluginFiles?.[requirement.id] ?? {}
      return {
        ...requirement,
        name: normalizedLabel(hosted.name, 100) || requirement.id,
        publisher: normalizedLabel(hosted.publisher, 100) || '未知发布者',
        license: normalizedLabel(hosted.license, 120) || '未声明',
        distributionPolicy: normalizePluginDistributionPolicy(hosted.distributionPolicy) ??
          'room-distributable',
      }
    }),
    member: roomPluginReadiness(requiredPlugins, member?.activePlugins),
  }
}

function decodedPluginHeader(req, headerName, maxLength) {
  const value = req?.headers?.[headerName]
  if (typeof value !== 'string') return ''
  try {
    return normalizedLabel(decodeURIComponent(value), maxLength)
  } catch {
    throw new RoomProtocolError(400, 'invalid-plugin-manifest')
  }
}

function roomPluginDistributionPolicy(req) {
  const value = req?.headers?.['x-stars-plugin-distribution-policy']
  if (!['room-distributable', 'room-ephemeral'].includes(value)) {
    throw new RoomProtocolError(403, 'plugin-not-room-distributable')
  }
  return value
}

const ROOM_RUNTIME_PROSE_KEYS = new Set([
  'description',
  'summary',
  'sourceLabel',
  'rulesText',
  'higherLevels',
  'materialText',
  'reactionTrigger',
  'text',
  'prompt',
  'adjudication',
  'note',
  'automationReasons',
  'reasons',
])

function assertRoomRuntimeProjectionValue(value, key = '', depth = 0) {
  if (depth > 64) throw new RoomProtocolError(400, 'invalid-room-runtime-projection')
  if (typeof value === 'string') {
    if (ROOM_RUNTIME_PROSE_KEYS.has(key) && value !== ROOM_RUNTIME_PROSE_PLACEHOLDER) {
      throw new RoomProtocolError(403, 'room-runtime-prose-not-reduced')
    }
    if (
      !['dataBase64', 'tokenPortrait', 'initiativePortrait'].includes(key) &&
      (value.length > 240 || /https?:\/\//i.test(value))
    ) throw new RoomProtocolError(403, 'room-runtime-prose-not-reduced')
    return
  }
  if (Array.isArray(value)) {
    for (const entry of value) assertRoomRuntimeProjectionValue(entry, key, depth + 1)
    return
  }
  if (!plainObject(value)) return
  for (const [childKey, entry] of Object.entries(value)) {
    assertRoomRuntimeProjectionValue(entry, childKey, depth + 1)
  }
}

function assertDeclarativeRoomPluginManifest(bytes, pluginId, version, distributionPolicy) {
  const source = bytes.toString('utf8').trimStart()
  if (!source.startsWith('{')) {
    if (distributionPolicy === 'room-ephemeral') {
      throw new RoomProtocolError(403, 'room-ephemeral-must-be-content-v2')
    }
    return
  }
  let parsed
  try {
    parsed = JSON.parse(source)
  } catch {
    throw new RoomProtocolError(400, 'invalid-plugin-manifest')
  }
  if (!['dndstars5e-content', 'dndstars5e-declarative'].includes(parsed?.format)) {
    if (distributionPolicy === 'room-ephemeral') {
      throw new RoomProtocolError(403, 'room-ephemeral-must-be-content-v2')
    }
    return
  }
  if (
    parsed?.manifest?.id !== pluginId ||
    parsed?.manifest?.version !== version ||
    parsed?.manifest?.distributionPolicy !== distributionPolicy
  ) throw new RoomProtocolError(403, 'plugin-not-room-distributable')
  if (distributionPolicy === 'room-ephemeral') {
    if (
      parsed.format !== 'dndstars5e-content' ||
      parsed.schemaVersion !== 2 ||
      parsed?.provenance?.projection !== ROOM_RUNTIME_PROJECTION ||
      parsed?.provenance?.sourceFingerprint != null ||
      parsed?.manifest?.description !== ROOM_RUNTIME_PROSE_PLACEHOLDER ||
      parsed?.provenance?.sourceTitle !== ROOM_RUNTIME_PROSE_PLACEHOLDER
    ) throw new RoomProtocolError(403, 'invalid-room-runtime-projection')
    assertRoomRuntimeProjectionValue(parsed)
  }
}

function assertAccountPluginPackagePolicy(bytes, pluginId, version, distributionPolicy) {
  const source = bytes.toString('utf8').trimStart()
  if (!source.startsWith('{')) return
  let parsed
  try {
    parsed = JSON.parse(source)
  } catch {
    throw new RoomProtocolError(400, 'invalid-account-plugin')
  }
  if (!['dndstars5e-content', 'dndstars5e-declarative'].includes(parsed?.format)) return
  if (
    parsed?.manifest?.id !== pluginId ||
    parsed?.manifest?.version !== version ||
    parsed?.manifest?.distributionPolicy !== distributionPolicy
  ) throw new RoomProtocolError(409, 'account-plugin-metadata-mismatch')
  if (parsed.manifest.distributionPolicy === 'local-only') {
    throw new RoomProtocolError(409, 'plugin-local-only')
  }
  if (parsed.manifest.distributionPolicy === 'room-ephemeral') {
    throw new RoomProtocolError(409, 'plugin-ephemeral-room-only')
  }
}

function normalizedPluginState(value, depth = 0) {
  if (depth > 64) throw new RoomProtocolError(400, 'invalid-plugin-state')
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new RoomProtocolError(400, 'invalid-plugin-state')
    return value
  }
  if (Array.isArray(value)) {
    if (value.length > 10_000) throw new RoomProtocolError(400, 'invalid-plugin-state')
    return value.map((item) => normalizedPluginState(item, depth + 1))
  }
  if (!plainObject(value) || Object.keys(value).length > 1_000) {
    throw new RoomProtocolError(400, 'invalid-plugin-state')
  }
  const result = {}
  for (const [key, item] of Object.entries(value)) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
      throw new RoomProtocolError(400, 'invalid-plugin-state')
    }
    result[key] = normalizedPluginState(item, depth + 1)
  }
  return result
}

function samePluginRequirement(left, right) {
  if (!left || !right) return left == null && right == null
  return left.id === right.id && left.version === right.version && left.integrity === right.integrity &&
    (left.stateSchemaVersion ?? 1) === (right.stateSchemaVersion ?? 1)
}

function roomMemberResponse(room, member, role, roomToken = undefined) {
  return {
    roomId: room.id,
    ...(room.campaignId ? { campaignId: room.campaignId } : {}),
    roomName: room.name,
    rulesetId: room.rulesetId,
    createdAt: room.createdAt,
    hostOnline: roomHostIsOnline(room),
    locked: room.locked === true,
    passwordRequired: plainObject(room.joinSecret),
    maxPlayers: Number.isInteger(room.maxPlayers) ? room.maxPlayers : 3,
    rules: roomRulesResponse(room, member),
    member: {
      memberId: member.memberId,
      ...(roomToken ? { roomToken } : {}),
      ...(member.accountId ? { accountId: member.accountId } : {}),
      clientId: member.clientId,
      role,
      ...(member.slot ? { slot: member.slot } : {}),
      displayName: member.displayName,
    },
  }
}

async function createLobbyRoom(ctx, payload, account = null, now = Date.now(), campaignId = null) {
  const rulesetId = String(payload?.rulesetId ?? '')
  const roomName = normalizedLabel(payload?.roomName, 40)
  const displayName = normalizedLabel(payload?.displayName, 24)
  const clientId = payload?.clientId
  const activePlugins = normalizeRoomPluginRequirements(payload?.activePlugins ?? [])
  const password = normalizedRoomPassword(payload?.password)
  const maxPlayers = payload?.maxPlayers == null ? 3 : Number(payload.maxPlayers)
  if (rulesetId !== DND5E_2014_RULESET_ID) throw new RoomProtocolError(400, 'invalid-ruleset')
  if (!roomName) throw new RoomProtocolError(400, 'invalid-room-name')
  if (!displayName) throw new RoomProtocolError(400, 'invalid-display-name')
  if (!validClientId(clientId)) throw new RoomProtocolError(400, 'invalid-client')
  if (!activePlugins) throw new RoomProtocolError(400, 'invalid-plugin-manifest')
  if (password.length > 64) throw new RoomProtocolError(400, 'invalid-room-password')
  if (!Number.isInteger(maxPlayers) || maxPlayers < 1 || maxPlayers > ROOM_PLAYER_SLOTS.length) {
    throw new RoomProtocolError(400, 'invalid-room-capacity')
  }

  await mkdir(lobbyRoot(ctx), { recursive: true })
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const roomId = generatedRoomCode()
    const roomToken = createRoomSessionToken()
    const member = {
      memberId: randomUUID(),
      ...(account ? { accountId: account.accountId } : {}),
      clientId,
      displayName,
      activePlugins,
      joinedAt: now,
      lastSeenAt: now,
      roomTokenHash: roomSessionTokenHash(roomToken),
    }
    const room = {
      version: 1,
      id: roomId,
      ...(campaignId ? { campaignId, campaignOwnerAccountId: account?.accountId } : {}),
      name: roomName,
      rulesetId,
      requiredPlugins: [],
      rulesRevision: 1,
      rulesUpdatedAt: now,
      createdAt: now,
      updatedAt: now,
      locked: false,
      maxPlayers,
      joinSecret: roomPasswordRecord(password),
      host: member,
      players: [],
    }
    try {
      await writeFile(roomLobbyFile(ctx, roomId), JSON.stringify(room), { flag: 'wx' })
      return { room, member, roomToken }
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error
    }
  }
  throw new RoomProtocolError(503, 'room-code-exhausted')
}

async function mutateLobbyRoom(ctx, roomId, updater) {
  const filePath = roomLobbyFile(ctx, roomId)
  return withWriteLock(filePath, async () => {
    let room
    try {
      room = JSON.parse(await readFile(filePath, 'utf8'))
    } catch (error) {
      if (error?.code === 'ENOENT') throw new RoomProtocolError(404, 'room-not-found')
      throw error
    }
    const result = await updater(room)
    if (!result?.ok) throw new RoomProtocolError(result?.status ?? 400, result?.error ?? 'room-operation-failed')
    if (result.next) await atomicRename(filePath, JSON.stringify(result.next))
    return { ...result, room: result.next ?? room }
  })
}

function writeJson(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(value))
}

function applyLobbyRateLimit(req, res, ctx) {
  if (req.method === 'GET') return true
  if (!ctx.rateLimits) ctx.rateLimits = new Map()
  const ip = req.socket?.remoteAddress ?? 'local'
  const limit = Math.max(10, Number(process.env.STARS_RATE_LIMIT) || 1200)
  const rate = consumeRateLimit(ctx.rateLimits, `lobby:${ip}`, Date.now(), limit)
  if (rate.ok) return true
  res.writeHead(429, {
    'Content-Type': 'application/json; charset=utf-8',
    'Retry-After': String(Math.ceil(rate.retryAfterMs / 1000)),
  })
  res.end('{"error":"rate-limit"}')
  return false
}

async function handlePluginCatalogApi(req, res, parsed, ctx) {
  if (!parsed.pathname.startsWith('/api/plugins')) return false
  if (!applyLobbyRateLimit(req, res, ctx)) return true

  if (parsed.pathname === '/api/plugins/signing-key' && req.method === 'GET') {
    const key = await marketplaceSigningKey(ctx)
    writeJson(res, 200, {
      schemaVersion: 1,
      algorithm: key.algorithm,
      keyId: key.keyId,
      publicKeyPem: key.publicKeyPem,
    })
    return true
  }

  if (parsed.pathname === '/api/plugins/catalog' && req.method === 'GET') {
    const query = normalizedLabel(parsed.searchParams.get('q'), 100).toLocaleLowerCase()
    const category = normalizedLabel(parsed.searchParams.get('category'), 40)
    const publisher = normalizedLabel(parsed.searchParams.get('publisher'), 40)
    const registry = await readPluginRegistry(ctx)
    const plugins = registry.entries
      .map((entry) => pluginRegistryPublicEntry(entry))
      .filter(Boolean)
      .filter((entry) => !category || entry.contentCategory === category)
      .filter((entry) => !publisher || entry.publisher?.accountId === publisher)
      .filter((entry) => !query || [
        entry.id, entry.name, entry.description, entry.publisher?.displayName, ...(entry.tags ?? []),
      ].some((value) => String(value ?? '').toLocaleLowerCase().includes(query)))
      .sort((left, right) => Number(right.updatedAt ?? 0) - Number(left.updatedAt ?? 0))
      .slice(0, 200)
    writeJson(res, 200, { plugins })
    return true
  }

  if (parsed.pathname === '/api/plugins/moderation' && req.method === 'GET') {
    const account = await authenticateAccount(req, ctx)
    if (!pluginRegistryAdministrator(account)) throw new RoomProtocolError(403, 'plugin-admin-required')
    const registry = await readPluginRegistry(ctx)
    const pending = registry.entries.flatMap((entry) =>
      (Array.isArray(entry.versions) ? entry.versions : [])
        .filter((version) => version.status === 'pending')
        .map((version) => ({ plugin: { id: entry.id, name: entry.name, publisher: entry.publisher }, version })))
    writeJson(res, 200, {
      pending,
      reports: registry.reports.slice(-500).reverse(),
      creatorApplications: registry.creators
        .filter((creator) => creator.status === 'pending')
        .sort((left, right) => Number(left.appliedAt ?? 0) - Number(right.appliedAt ?? 0)),
      payouts: registry.payouts
        .filter((payout) => ['pending', 'approved'].includes(payout.status))
        .sort((left, right) => Number(left.createdAt ?? 0) - Number(right.createdAt ?? 0))
        .map((payout) => ({
          ...marketplacePayoutPublicRecord(payout),
          verifiedRecipientReference: payout.payoutDestinationReference,
        })),
    })
    return true
  }

  const creatorModerationMatch = parsed.pathname.match(/^\/api\/plugins\/creators\/([^/]+)\/moderate$/)
  if (creatorModerationMatch && req.method === 'POST') {
    const administrator = await authenticateAccount(req, ctx)
    if (!pluginRegistryAdministrator(administrator)) throw new RoomProtocolError(403, 'plugin-admin-required')
    const accountId = decodeURIComponent(creatorModerationMatch[1] ?? '')
    const account = await readAccount(ctx, accountId).catch(() => null)
    if (!account) throw new RoomProtocolError(404, 'account-not-found')
    const payload = await readJsonRequest(req)
    const action = payload?.action
    if (!['approve', 'reject', 'suspend'].includes(action)) {
      throw new RoomProtocolError(400, 'invalid-creator-moderation')
    }
    const now = Date.now()
    const registry = await mutatePluginRegistry(ctx, (current) => {
      const existing = current.creators.find((creator) => creator.accountId === accountId)
      if (!existing) throw new RoomProtocolError(404, 'creator-application-not-found')
      const nextCreator = {
        ...existing,
        displayName: account.auth?.username ?? account.displayName,
        status: action === 'approve' ? 'verified' : action === 'reject' ? 'rejected' : 'suspended',
        moderatedAt: now,
        moderatedBy: administrator.accountId,
        moderationNote: normalizedLabel(payload?.note, 2_000),
        ...(action === 'approve' ? { verifiedAt: now } : {}),
      }
      return {
        ...current,
        creators: [...current.creators.filter((creator) => creator.accountId !== accountId), nextCreator],
        entries: current.entries.map((entry) => entry.publisher?.accountId === accountId
          ? { ...entry, publisher: { ...entry.publisher, creatorVerified: action === 'approve' } }
          : entry),
      }
    })
    writeJson(res, 200, {
      creator: registry.creators.find((creator) => creator.accountId === accountId),
    })
    return true
  }

  const publisherMatch = parsed.pathname.match(/^\/api\/plugins\/publishers\/([^/]+)$/)
  if (publisherMatch && req.method === 'GET') {
    const accountId = decodeURIComponent(publisherMatch[1] ?? '')
    const registry = await readPluginRegistry(ctx)
    const plugins = registry.entries
      .filter((entry) => entry.publisher?.accountId === accountId)
      .map((entry) => pluginRegistryPublicEntry(entry))
      .filter(Boolean)
    const displayName = plugins[0]?.publisher?.displayName
    if (!displayName) throw new RoomProtocolError(404, 'plugin-publisher-not-found')
    writeJson(res, 200, { publisher: { accountId, displayName }, plugins })
    return true
  }

  const downloadMatch = parsed.pathname.match(
    /^\/api\/plugins\/catalog\/([^/]+)\/versions\/([^/]+)\/download$/,
  )
  if (downloadMatch && req.method === 'GET') {
    const pluginId = decodeURIComponent(downloadMatch[1] ?? '')
    const pluginVersion = decodeURIComponent(downloadMatch[2] ?? '')
    const registry = await readPluginRegistry(ctx)
    const entry = registry.entries.find((candidate) => candidate.id === pluginId)
    const version = (Array.isArray(entry?.versions) ? entry.versions : []).find((candidate) =>
      candidate.version === pluginVersion && candidate.status === 'published' &&
      ['public', 'unlisted'].includes(candidate.visibility))
    if (!entry || !version) throw new RoomProtocolError(404, 'public-plugin-not-found')
    const paid = version.marketplace?.pricing?.kind === 'paid'
    const account = paid ? await authenticateAccount(req, ctx, true) : null
    if (paid) {
      const entitlement = account
        ? activeMarketplaceEntitlement(registry.entitlements, {
            accountId: account.accountId,
            productId: pluginId,
            version: pluginVersion,
          })
        : null
      const publisherOwnsProduct = account?.accountId === entry.publisher?.accountId
      if (!entitlement && !publisherOwnsProduct) {
        throw new RoomProtocolError(account ? 403 : 401, 'marketplace-entitlement-required')
      }
    }
    const bytes = await readFile(accountPluginBlobFile(ctx, version.integrity))
    const actualIntegrity = `sha256-${createHash('sha256').update(bytes).digest('base64')}`
    if (actualIntegrity !== version.integrity) throw new RoomProtocolError(409, 'public-plugin-integrity-mismatch')
    await mutatePluginRegistry(ctx, (current) => ({
      ...current,
      analyticsDaily: recordMarketplaceDailyMetric(current.analyticsDaily, {
        metric: 'downloads',
        productId: entry.id,
        version: version.version,
        publisherAccountId: entry.publisher?.accountId,
      }),
    }))
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(bytes.length),
      'Cache-Control': paid ? 'private, no-store' : 'public, max-age=31536000, immutable',
      'X-Stars-Plugin-Version': version.version,
      'X-Stars-Plugin-Integrity': version.integrity,
      'X-Stars-Plugin-Filename': encodeURIComponent(version.fileName),
      'X-Stars-Plugin-Name': encodeURIComponent(entry.name),
      'X-Stars-Plugin-Publisher': encodeURIComponent(entry.publisher?.displayName ?? ''),
      'X-Stars-Plugin-License': encodeURIComponent(version.license),
      'X-Stars-Plugin-State-Schema': String(version.stateSchemaVersion),
      'X-Stars-Plugin-Api-Version': '2',
      'X-Stars-Plugin-Ruleset': DND5E_2014_RULESET_ID,
    })
    res.end(bytes)
    return true
  }

  const installationMatch = parsed.pathname.match(
    /^\/api\/plugins\/catalog\/([^/]+)\/versions\/([^/]+)\/installation$/,
  )
  if (installationMatch && req.method === 'POST') {
    const account = await authenticateAccount(req, ctx)
    const pluginId = decodeURIComponent(installationMatch[1] ?? '')
    const pluginVersion = decodeURIComponent(installationMatch[2] ?? '')
    const payload = await readJsonRequest(req)
    if (typeof payload?.active !== 'boolean') {
      throw new RoomProtocolError(400, 'invalid-marketplace-installation')
    }
    const now = Date.now()
    let transition = null
    const registry = await mutatePluginRegistry(ctx, (current) => {
      const entry = current.entries.find((candidate) => candidate.id === pluginId)
      const version = (Array.isArray(entry?.versions) ? entry.versions : []).find((candidate) =>
        candidate.version === pluginVersion &&
        candidate.status === 'published' &&
        ['public', 'unlisted'].includes(candidate.visibility))
      if (!entry || !version) throw new RoomProtocolError(404, 'public-plugin-not-found')
      if (version.marketplace?.pricing?.kind === 'paid') {
        const entitlement = activeMarketplaceEntitlement(current.entitlements, {
          accountId: account.accountId,
          productId: pluginId,
          version: pluginVersion,
        }, now)
        if (!entitlement && entry.publisher?.accountId !== account.accountId) {
          throw new RoomProtocolError(403, 'marketplace-entitlement-required')
        }
      }
      const updated = updateMarketplaceInstallation(current.installations, {
        accountId: account.accountId,
        productId: pluginId,
        version: pluginVersion,
        publisherAccountId: entry.publisher?.accountId,
        active: payload.active,
        timestamp: now,
      })
      transition = updated.transition
      return {
        ...current,
        installations: updated.installations,
        analyticsDaily: transition
          ? recordMarketplaceDailyMetric(current.analyticsDaily, {
              metric: transition === 'installed' ? 'installs' : 'uninstalls',
              productId: pluginId,
              version: pluginVersion,
              publisherAccountId: entry.publisher?.accountId,
              timestamp: now,
            })
          : current.analyticsDaily,
      }
    })
    const installation = registry.installations.find((candidate) =>
      candidate.accountId === account.accountId && candidate.productId === pluginId)
    writeJson(res, 200, { installation, transition })
    return true
  }

  const entitlementGrantMatch = parsed.pathname.match(
    /^\/api\/plugins\/catalog\/([^/]+)\/versions\/([^/]+)\/entitlements$/,
  )
  if (entitlementGrantMatch && req.method === 'POST') {
    const actor = await authenticateAccount(req, ctx)
    const payload = await readJsonRequest(req)
    const administrator = pluginRegistryAdministrator(actor)
    if (productionSecurityEnabled() && !administrator) {
      throw new RoomProtocolError(403, 'plugin-admin-required')
    }
    const pluginId = decodeURIComponent(entitlementGrantMatch[1] ?? '')
    const pluginVersion = decodeURIComponent(entitlementGrantMatch[2] ?? '')
    const targetAccountId = administrator && normalizedLabel(payload?.accountId, 64)
      ? normalizedLabel(payload.accountId, 64)
      : actor.accountId
    const target = await readAccount(ctx, targetAccountId).catch(() => null)
    if (!target) throw new RoomProtocolError(404, 'account-not-found')
    const now = Date.now()
    const registry = await mutatePluginRegistry(ctx, (current) => {
      const entry = current.entries.find((candidate) => candidate.id === pluginId)
      const version = (Array.isArray(entry?.versions) ? entry.versions : []).find((candidate) =>
        candidate.version === pluginVersion && candidate.status === 'published')
      if (!entry || !version || version.marketplace?.pricing?.kind !== 'paid') {
        throw new RoomProtocolError(404, 'paid-marketplace-product-not-found')
      }
      const existing = activeMarketplaceEntitlement(current.entitlements, {
        accountId: targetAccountId,
        productId: pluginId,
        version: pluginVersion,
      }, now)
      if (existing) return current
      return {
        ...current,
        entitlements: [...current.entitlements, {
          schemaVersion: MARKETPLACE_ENTITLEMENT_SCHEMA_VERSION,
          entitlementId: randomUUID(),
          accountId: targetAccountId,
          productId: pluginId,
          version: pluginVersion,
          licenseType: 'complimentary',
          source: administrator ? 'admin' : 'sandbox',
          status: 'active',
          grantedAt: now,
          grantedBy: actor.accountId,
        }],
      }
    })
    const entitlement = activeMarketplaceEntitlement(registry.entitlements, {
      accountId: targetAccountId,
      productId: pluginId,
      version: pluginVersion,
    }, now)
    writeJson(res, 201, { entitlement })
    return true
  }

  const entitlementStatusMatch = parsed.pathname.match(
    /^\/api\/plugins\/entitlements\/([^/]+)\/status$/,
  )
  if (entitlementStatusMatch && req.method === 'POST') {
    const administrator = await authenticateAccount(req, ctx)
    if (!pluginRegistryAdministrator(administrator)) {
      throw new RoomProtocolError(403, 'plugin-admin-required')
    }
    const entitlementId = decodeURIComponent(entitlementStatusMatch[1] ?? '')
    const payload = await readJsonRequest(req)
    const status = normalizedLabel(payload?.status, 24)
    if (!['active', 'refunded', 'revoked', 'disputed'].includes(status)) {
      throw new RoomProtocolError(400, 'invalid-entitlement-status')
    }
    const statusReason = normalizedLabel(payload?.reason, 1_000)
    const updatedAt = Date.now()
    const registry = await mutatePluginRegistry(ctx, (current) => {
      const entitlement = current.entitlements.find((candidate) =>
        candidate.entitlementId === entitlementId)
      if (!entitlement) throw new RoomProtocolError(404, 'marketplace-entitlement-not-found')
      return {
        ...current,
        entitlements: current.entitlements.map((candidate) =>
          candidate.entitlementId === entitlementId
            ? {
                ...candidate,
                status,
                updatedAt,
                updatedBy: administrator.accountId,
                ...(statusReason ? { statusReason } : {}),
              }
            : candidate),
      }
    })
    writeJson(res, 200, {
      entitlement: registry.entitlements.find((candidate) =>
        candidate.entitlementId === entitlementId) ?? null,
    })
    return true
  }

  const reportMatch = parsed.pathname.match(/^\/api\/plugins\/catalog\/([^/]+)\/reports$/)
  if (reportMatch && req.method === 'POST') {
    const account = await authenticateAccount(req, ctx)
    const pluginId = decodeURIComponent(reportMatch[1] ?? '')
    const payload = await readJsonRequest(req)
    const version = normalizedLabel(payload?.version, 64)
    const category = normalizedLabel(payload?.category, 40)
    const details = normalizedLabel(payload?.details, 4_000)
    if (!version || !['security', 'copyright', 'malware', 'misleading', 'other'].includes(category) || !details) {
      throw new RoomProtocolError(400, 'invalid-plugin-report')
    }
    const now = Date.now()
    const registry = await mutatePluginRegistry(ctx, (current) => {
      const entry = current.entries.find((candidate) => candidate.id === pluginId)
      const published = (Array.isArray(entry?.versions) ? entry.versions : []).some((candidate) =>
        candidate.version === version && candidate.status === 'published')
      if (!published) throw new RoomProtocolError(404, 'public-plugin-not-found')
      return {
        ...current,
        reports: [...current.reports, {
          id: randomUUID(),
          pluginId,
          version,
          category,
          details,
          reporterAccountId: account.accountId,
          status: 'open',
          createdAt: now,
        }].slice(-10_000),
      }
    })
    writeJson(res, 201, { report: registry.reports.at(-1) })
    return true
  }

  const moderationMatch = parsed.pathname.match(
    /^\/api\/plugins\/catalog\/([^/]+)\/versions\/([^/]+)\/moderate$/,
  )
  if (moderationMatch && req.method === 'POST') {
    const account = await authenticateAccount(req, ctx)
    if (!pluginRegistryAdministrator(account)) throw new RoomProtocolError(403, 'plugin-admin-required')
    const pluginId = decodeURIComponent(moderationMatch[1] ?? '')
    const pluginVersion = decodeURIComponent(moderationMatch[2] ?? '')
    const payload = await readJsonRequest(req)
    const action = payload?.action
    if (!['approve', 'reject', 'suspend'].includes(action)) {
      throw new RoomProtocolError(400, 'invalid-plugin-moderation')
    }
    const now = Date.now()
    const registry = await mutatePluginRegistry(ctx, (current) => {
      let found = false
      const entries = current.entries.map((entry) => {
        if (entry.id !== pluginId) return entry
        return {
          ...entry,
          updatedAt: now,
          versions: (Array.isArray(entry.versions) ? entry.versions : []).map((version) => {
            if (version.version !== pluginVersion) return version
            found = true
            return {
              ...version,
              status: action === 'approve' ? 'published' : action === 'reject' ? 'rejected' : 'suspended',
              moderatedAt: now,
              moderatedBy: account.accountId,
              moderationNote: normalizedLabel(payload?.note, 2_000),
              ...(action === 'approve' ? { publishedAt: now } : {}),
            }
          }),
        }
      })
      if (!found) throw new RoomProtocolError(404, 'plugin-publication-not-found')
      return { ...current, entries }
    })
    const entry = registry.entries.find((candidate) => candidate.id === pluginId)
    writeJson(res, 200, { publication: entry })
    return true
  }

  const detailMatch = parsed.pathname.match(/^\/api\/plugins\/catalog\/([^/]+)$/)
  if (detailMatch && req.method === 'GET') {
    const pluginId = decodeURIComponent(detailMatch[1] ?? '')
    const registry = await readPluginRegistry(ctx)
    const entry = pluginRegistryPublicEntry(
      registry.entries.find((candidate) => candidate.id === pluginId),
      true,
    )
    if (!entry) throw new RoomProtocolError(404, 'public-plugin-not-found')
    const latest = entry.versions?.[0]
    if (latest) {
      const ip = req.socket?.remoteAddress ?? 'local'
      const viewer = await authenticateAccount(req, ctx, true).catch(() => null)
      const day = new Date().toISOString().slice(0, 10)
      const viewKey = createHash('sha256')
        .update(`${day}:${pluginId}:${viewer?.accountId ?? ip}`)
        .digest('base64url')
      if (!ctx.marketplaceViewDedupe) ctx.marketplaceViewDedupe = new Map()
      if (!ctx.marketplaceViewDedupe.has(viewKey)) {
        ctx.marketplaceViewDedupe.set(viewKey, Date.now())
        if (ctx.marketplaceViewDedupe.size > 100_000) {
          const oldest = ctx.marketplaceViewDedupe.keys().next().value
          if (oldest) ctx.marketplaceViewDedupe.delete(oldest)
        }
        await mutatePluginRegistry(ctx, (current) => ({
          ...current,
          analyticsDaily: recordMarketplaceDailyMetric(current.analyticsDaily, {
            metric: 'views',
            productId: entry.id,
            version: latest.version,
            publisherAccountId: entry.publisher?.accountId,
          }),
        }))
      }
    }
    writeJson(res, 200, { plugin: entry })
    return true
  }

  throw new RoomProtocolError(404, 'plugin-catalog-not-found')
}

async function handleAccountApi(req, res, parsed, ctx) {
  if (!parsed.pathname.startsWith('/api/accounts')) return false
  if (!applyLobbyRateLimit(req, res, ctx)) return true

  if (parsed.pathname === '/api/accounts/auth/config' && req.method === 'GET') {
    writeJson(res, 200, accountAuthCapabilities())
    return true
  }

  if (parsed.pathname === '/api/accounts/auth/verification' && req.method === 'POST') {
    const payload = await readJsonRequest(req)
    const challenge = await requestAccountVerification(ctx, req, payload)
    writeJson(res, 201, challenge)
    return true
  }

  if (parsed.pathname === '/api/accounts/auth/register' && req.method === 'POST') {
    const payload = await readJsonRequest(req)
    const { account, token } = await createRegisteredAccount(ctx, payload)
    writeJson(res, 201, { session: accountSessionResponse(account, token) })
    return true
  }

  if (parsed.pathname === '/api/accounts/auth/login' && req.method === 'POST') {
    const payload = await readJsonRequest(req)
    const { account, token } = await loginRegisteredAccount(ctx, req, payload)
    writeJson(res, 200, { session: accountSessionResponse(account, token) })
    return true
  }

  if (parsed.pathname === '/api/accounts/auth/logout' && req.method === 'POST') {
    await logoutAccount(req, ctx)
    writeJson(res, 200, { ok: true })
    return true
  }

  if (parsed.pathname === '/api/accounts' && req.method === 'POST') {
    if (productionSecurityEnabled() && process.env.STARS_ALLOW_LEGACY_ACCOUNT_CREATION !== 'true') {
      throw new RoomProtocolError(410, 'legacy-account-creation-disabled')
    }
    const payload = await readJsonRequest(req)
    const { account, token, recoveryCode } = await createAccountRecord(ctx, payload)
    writeJson(res, 201, { session: accountSessionResponse(account, token), recoveryCode })
    return true
  }

  if (parsed.pathname === '/api/accounts/recover' && req.method === 'POST') {
    const payload = await readJsonRequest(req)
    const recovery = normalizeAccountRecoveryCode(payload?.recoveryCode)
    const clientId = payload?.clientId
    if (!recovery || !validClientId(clientId)) throw new RoomProtocolError(400, 'invalid-recovery-code')
    const account = await readAccount(ctx, recovery.accountId).catch(() => null)
    if (!account || !secretMatches(account.recovery, recovery.secret)) {
      throw new RoomProtocolError(401, 'invalid-recovery-code')
    }
    const token = accountSessionToken(account.accountId)
    const now = Date.now()
    const next = await mutateAccount(ctx, account.accountId, (current) => ({
      ...current,
      sessions: [
        ...(Array.isArray(current.sessions) ? current.sessions : []),
        { tokenHash: tokenHash(token), clientId, createdAt: now, lastSeenAt: now },
      ].slice(-ACCOUNT_SESSION_LIMIT),
      updatedAt: now,
    }))
    writeJson(res, 200, { session: accountSessionResponse(next, token) })
    return true
  }

  if (parsed.pathname === '/api/accounts/me' && req.method === 'GET') {
    const account = await authenticateAccount(req, ctx)
    writeJson(res, 200, accountPublicProfile(account))
    return true
  }

  if (parsed.pathname === '/api/accounts/me' && req.method === 'PATCH') {
    const account = await authenticateAccount(req, ctx)
    const payload = await readJsonRequest(req, 512 * 1024)
    const displayName = normalizedLabel(payload?.displayName, 24)
    const avatar = normalizeAccountAvatar(payload?.avatar)
    if (!displayName) throw new RoomProtocolError(400, 'invalid-account-name')
    if (avatar == null) throw new RoomProtocolError(400, 'invalid-account-avatar')
    const now = Date.now()
    const next = await mutateAccount(ctx, account.accountId, (current) => ({
      ...current,
      displayName,
      ...(avatar ? { avatar } : { avatar: undefined }),
      updatedAt: now,
    }))
    writeJson(res, 200, accountPublicProfile(next))
    return true
  }

  if (parsed.pathname === '/api/accounts/me/password' && req.method === 'POST') {
    const account = await authenticateAccount(req, ctx)
    const payload = await readJsonRequest(req)
    const currentPassword = normalizeAccountPassword(payload?.currentPassword)
    const newPassword = normalizeAccountPassword(payload?.newPassword)
    if (!plainObject(account.auth) || !plainObject(account.auth.password)) {
      throw new RoomProtocolError(409, 'registered-account-required')
    }
    if (!currentPassword || !secretMatches(account.auth.password, currentPassword)) {
      throw new RoomProtocolError(401, 'invalid-account-current-password')
    }
    if (!newPassword) throw new RoomProtocolError(400, 'invalid-account-password')
    const presentedToken = req.headers['x-stars-account-token']
    const presentedHash = tokenHash(presentedToken)
    const now = Date.now()
    await mutateAccount(ctx, account.accountId, (current) => ({
      ...current,
      auth: {
        ...current.auth,
        password: secretRecord(newPassword),
      },
      sessions: (Array.isArray(current.sessions) ? current.sessions : []).filter(
        (session) => session?.tokenHash === presentedHash,
      ),
      updatedAt: now,
    }))
    writeJson(res, 200, { ok: true })
    return true
  }

  if (parsed.pathname === '/api/accounts/me/campaigns') {
    const account = await authenticateAccount(req, ctx)
    if (req.method === 'GET') {
      writeJson(res, 200, { campaigns: await accountCampaignListResponse(ctx, account) })
      return true
    }
    if (req.method === 'POST') {
      const payload = await readJsonRequest(req)
      const name = normalizedLabel(payload?.name, 60)
      const description = normalizeCampaignDescription(payload?.description)
      const rulesetId = String(payload?.rulesetId ?? '')
      if (!name) throw new RoomProtocolError(400, 'invalid-campaign-name')
      if (description == null) throw new RoomProtocolError(400, 'invalid-campaign-description')
      if (rulesetId !== DND5E_2014_RULESET_ID) throw new RoomProtocolError(400, 'invalid-ruleset')
      const now = Date.now()
      let created = null
      const next = await mutateAccount(ctx, account.accountId, (current) => {
        const campaigns = accountCampaigns(current)
        if (campaigns.length >= ACCOUNT_CAMPAIGN_LIMIT) {
          throw new RoomProtocolError(409, 'account-campaign-limit')
        }
        let campaignId = ''
        for (let attempt = 0; attempt < 32; attempt += 1) {
          const candidate = randomLobbyCode(12)
          if (!campaigns.some((campaign) => campaign.campaignId === candidate)) {
            campaignId = candidate
            break
          }
        }
        if (!campaignId) throw new RoomProtocolError(503, 'campaign-id-exhausted')
        created = {
          schemaVersion: ACCOUNT_CAMPAIGN_SCHEMA_VERSION,
          campaignId,
          ownerAccountId: current.accountId,
          name,
          description,
          rulesetId,
          archived: false,
          roomCount: 0,
          roomHistory: [],
          createdAt: now,
          updatedAt: now,
        }
        return {
          ...current,
          campaigns: [...campaigns, created],
          updatedAt: now,
        }
      })
      const persisted = accountCampaigns(next).find((campaign) => campaign.campaignId === created?.campaignId)
      writeJson(res, 201, await accountCampaignResponse(ctx, persisted))
      return true
    }
    throw new RoomProtocolError(405, 'method-not-allowed')
  }

  const accountCampaignResumeRoomMatch = parsed.pathname.match(
    /^\/api\/accounts\/me\/campaigns\/([^/]+)\/rooms\/current$/,
  )
  if (accountCampaignResumeRoomMatch) {
    if (req.method !== 'POST') throw new RoomProtocolError(405, 'method-not-allowed')
    const account = await authenticateAccount(req, ctx)
    const campaignId = normalizeCampaignId(decodeURIComponent(accountCampaignResumeRoomMatch[1] ?? ''))
    if (campaignId.length !== 12) throw new RoomProtocolError(400, 'invalid-campaign-id')
    const campaign = accountCampaigns(account).find((candidate) => candidate.campaignId === campaignId)
    if (!campaign) throw new RoomProtocolError(404, 'account-campaign-not-found')
    if (campaign.archived === true) throw new RoomProtocolError(409, 'campaign-archived')
    const roomId = normalizeLobbyRoomCode(campaign.lastRoomId)
    if (roomId.length !== 6) throw new RoomProtocolError(404, 'campaign-room-not-found')
    const payload = await readJsonRequest(req)
    const clientId = payload?.clientId
    const activePlugins = normalizeRoomPluginRequirements(payload?.activePlugins ?? [])
    const displayName = normalizedLabel(payload?.displayName, 24) || account.displayName
    if (!validClientId(clientId)) throw new RoomProtocolError(400, 'invalid-client')
    if (!activePlugins) throw new RoomProtocolError(400, 'invalid-plugin-manifest')
    if (!displayName) throw new RoomProtocolError(400, 'invalid-display-name')
    const roomToken = createRoomSessionToken()
    const now = Date.now()
    const result = await mutateLobbyRoom(ctx, roomId, (room) => {
      if (room.closedAt) return { ok: false, status: 409, error: 'room-closed' }
      if (
        room.campaignId !== campaignId ||
        room.campaignOwnerAccountId !== account.accountId ||
        room.host?.accountId !== account.accountId
      ) {
        return { ok: false, status: 403, error: 'forbidden' }
      }
      const host = {
        ...room.host,
        clientId,
        displayName,
        activePlugins,
        lastSeenAt: now,
        roomTokenHash: roomSessionTokenHash(roomToken),
      }
      return {
        ok: true,
        member: host,
        next: {
          ...room,
          host,
          updatedAt: now,
        },
      }
    })
    writeJson(res, 200, roomMemberResponse(result.room, result.member, 'dm', roomToken))
    return true
  }

  const accountCampaignRoomMatch = parsed.pathname.match(/^\/api\/accounts\/me\/campaigns\/([^/]+)\/rooms$/)
  if (accountCampaignRoomMatch) {
    if (req.method !== 'POST') throw new RoomProtocolError(405, 'method-not-allowed')
    const account = await authenticateAccount(req, ctx)
    const campaignId = normalizeCampaignId(decodeURIComponent(accountCampaignRoomMatch[1] ?? ''))
    if (campaignId.length !== 12) throw new RoomProtocolError(400, 'invalid-campaign-id')
    const payload = await readJsonRequest(req)
    if (payload?.accountId != null && payload.accountId !== account.accountId) {
      throw new RoomProtocolError(401, 'invalid-account-session')
    }
    const now = Date.now()
    let createdRoom = null
    let createdMember = null
    let createdRoomToken = null
    try {
      await mutateAccount(ctx, account.accountId, async (current) => {
        const campaigns = accountCampaigns(current)
        const campaignIndex = campaigns.findIndex((campaign) => campaign.campaignId === campaignId)
        if (campaignIndex < 0) throw new RoomProtocolError(404, 'account-campaign-not-found')
        const campaign = campaigns[campaignIndex]
        if (campaign.archived === true) throw new RoomProtocolError(409, 'campaign-archived')
        const previousRoom = await readLobbyRoomOptional(ctx, campaign.lastRoomId)
        if (
          previousRoom &&
          previousRoom.campaignId === campaignId &&
          previousRoom.campaignOwnerAccountId === current.accountId &&
          !previousRoom.closedAt
        ) {
          if (roomHostIsOnline(previousRoom, now)) {
            throw new RoomProtocolError(409, 'campaign-room-active')
          }
          const closed = await mutateLobbyRoom(ctx, previousRoom.id, (room) => {
            const ephemeralStoragePaths = roomEphemeralPluginStoragePaths(ctx, previousRoom.id, room)
            const withoutEphemeral = withoutRoomEphemeralPlugins(room)
            return {
              ok: true,
              ephemeralStoragePaths,
              next: {
                ...withoutEphemeral,
                closedAt: now,
                updatedAt: now,
                host: { ...room.host, lastSeenAt: 0 },
              },
            }
          })
          await removeRoomEphemeralPluginStorage(closed.ephemeralStoragePaths ?? [])
        }
        const roomNumber = (Array.isArray(campaign.roomHistory) ? campaign.roomHistory.length : 0) + 1
        const roomPayload = {
          ...payload,
          roomName: normalizedLabel(payload?.roomName, 40) || `${campaign.name} · 第 ${roomNumber} 场`,
          rulesetId: campaign.rulesetId,
        }
        const created = await createLobbyRoom(ctx, roomPayload, current, now, campaignId)
        createdRoom = created.room
        createdMember = created.member
        createdRoomToken = created.roomToken
        const history = [
          ...(Array.isArray(campaign.roomHistory) ? campaign.roomHistory : []),
          { roomId: created.room.id, createdAt: now },
        ].slice(-ACCOUNT_CAMPAIGN_ROOM_HISTORY_LIMIT)
        const updatedCampaign = {
          ...campaign,
          roomCount: (Number.isSafeInteger(campaign.roomCount)
            ? campaign.roomCount
            : Array.isArray(campaign.roomHistory) ? campaign.roomHistory.length : 0) + 1,
          roomHistory: history,
          lastRoomId: created.room.id,
          updatedAt: now,
        }
        return {
          ...current,
          campaigns: campaigns.map((candidate, index) => index === campaignIndex ? updatedCampaign : candidate),
          updatedAt: now,
        }
      })
    } catch (error) {
      if (createdRoom?.id) await rm(roomLobbyFile(ctx, createdRoom.id), { force: true }).catch(() => {})
      throw error
    }
    writeJson(res, 201, roomMemberResponse(createdRoom, createdMember, 'dm', createdRoomToken))
    return true
  }

  const accountCampaignMatch = parsed.pathname.match(/^\/api\/accounts\/me\/campaigns\/([^/]+)$/)
  if (accountCampaignMatch) {
    const account = await authenticateAccount(req, ctx)
    const campaignId = normalizeCampaignId(decodeURIComponent(accountCampaignMatch[1] ?? ''))
    if (campaignId.length !== 12) throw new RoomProtocolError(400, 'invalid-campaign-id')
    const currentCampaign = accountCampaigns(account).find((campaign) => campaign.campaignId === campaignId)
    if (!currentCampaign) throw new RoomProtocolError(404, 'account-campaign-not-found')
    if (req.method === 'GET') {
      writeJson(res, 200, await accountCampaignResponse(ctx, currentCampaign))
      return true
    }
    if (req.method === 'PATCH') {
      const payload = await readJsonRequest(req)
      const name = payload?.name == null ? currentCampaign.name : normalizedLabel(payload.name, 60)
      const description = payload?.description == null
        ? (currentCampaign.description ?? '')
        : normalizeCampaignDescription(payload.description)
      if (!name) throw new RoomProtocolError(400, 'invalid-campaign-name')
      if (description == null) throw new RoomProtocolError(400, 'invalid-campaign-description')
      if (payload?.archived != null && typeof payload.archived !== 'boolean') {
        throw new RoomProtocolError(400, 'invalid-campaign-archive-state')
      }
      const now = Date.now()
      const next = await mutateAccount(ctx, account.accountId, (current) => {
        const campaigns = accountCampaigns(current)
        if (!campaigns.some((campaign) => campaign.campaignId === campaignId)) {
          throw new RoomProtocolError(404, 'account-campaign-not-found')
        }
        return {
          ...current,
          campaigns: campaigns.map((campaign) => campaign.campaignId === campaignId
            ? {
                ...campaign,
                name,
                description,
                archived: payload?.archived ?? campaign.archived === true,
                updatedAt: now,
              }
            : campaign),
          updatedAt: now,
        }
      })
      const updated = accountCampaigns(next).find((campaign) => campaign.campaignId === campaignId)
      writeJson(res, 200, await accountCampaignResponse(ctx, updated))
      return true
    }
    throw new RoomProtocolError(405, 'method-not-allowed')
  }

  if (parsed.pathname === '/api/accounts/me/characters' && req.method === 'GET') {
    const account = await authenticateAccount(req, ctx)
    writeJson(res, 200, { characters: Array.isArray(account.characters) ? account.characters : [] })
    return true
  }

  if (parsed.pathname === '/api/accounts/me/plugins' && req.method === 'GET') {
    const account = await authenticateAccount(req, ctx)
    writeJson(res, 200, {
      plugins: accountPluginVersions(account)
        .sort((left, right) => right.updatedAt - left.updatedAt || left.id.localeCompare(right.id)),
      limits: {
        maxVersions: ACCOUNT_PLUGIN_VERSION_LIMIT,
        maxTotalBytes: ACCOUNT_PLUGIN_TOTAL_BYTES_LIMIT,
        maxPackageBytes: STATE_MAX_BYTES,
      },
    })
    return true
  }

  if (parsed.pathname === '/api/accounts/me/creator') {
    const account = await authenticateAccount(req, ctx)
    if (req.method === 'GET') {
      const registry = await readPluginRegistry(ctx)
      const creator = registry.creators.find((candidate) => candidate.accountId === account.accountId)
      writeJson(res, 200, { creator: marketplaceCreatorPublicRecord(account, creator) })
      return true
    }
    if (req.method !== 'POST') throw new RoomProtocolError(405, 'method-not-allowed')
    const payload = await readJsonRequest(req)
    const countryOrRegion = normalizedLabel(payload?.countryOrRegion, 80)
    const verificationReference = normalizedLabel(payload?.verificationReference, 200)
    if (
      !countryOrRegion ||
      verificationReference.length < 6 ||
      payload?.acceptedPolicyVersion !== MARKETPLACE_CREATOR_POLICY_VERSION ||
      payload?.acceptedNoticeVersion !== MARKETPLACE_CREATOR_NOTICE_VERSION
    ) throw new RoomProtocolError(400, 'invalid-creator-application')
    const now = Date.now()
    const registry = await mutatePluginRegistry(ctx, (current) => {
      const existing = current.creators.find((candidate) => candidate.accountId === account.accountId)
      if (existing?.status === 'verified' || existing?.status === 'suspended') {
        throw new RoomProtocolError(409, existing.status === 'verified'
          ? 'creator-already-verified'
          : 'creator-account-suspended')
      }
      const creator = {
        schemaVersion: 1,
        accountId: account.accountId,
        displayName: account.auth?.username ?? account.displayName,
        status: 'pending',
        countryOrRegion,
        verificationReference,
        policyVersion: MARKETPLACE_CREATOR_POLICY_VERSION,
        noticeVersion: MARKETPLACE_CREATOR_NOTICE_VERSION,
        appliedAt: now,
      }
      return {
        ...current,
        creators: [...current.creators.filter((candidate) => candidate.accountId !== account.accountId), creator],
      }
    })
    const creator = registry.creators.find((candidate) => candidate.accountId === account.accountId)
    writeJson(res, 202, { creator: marketplaceCreatorPublicRecord(account, creator) })
    return true
  }

  if (parsed.pathname === '/api/accounts/me/entitlements' && req.method === 'GET') {
    const account = await authenticateAccount(req, ctx)
    const registry = await readPluginRegistry(ctx)
    writeJson(res, 200, {
      entitlements: registry.entitlements
        .filter((entitlement) => entitlement.accountId === account.accountId)
        .sort((left, right) => Number(right.grantedAt ?? 0) - Number(left.grantedAt ?? 0)),
    })
    return true
  }

  const accountPluginPublicationMatch = parsed.pathname.match(
    /^\/api\/accounts\/me\/plugins\/([^/]+)\/versions\/([^/]+)\/publication$/,
  )
  if (accountPluginPublicationMatch) {
    if (req.method !== 'POST') throw new RoomProtocolError(405, 'method-not-allowed')
    const account = await authenticateAccount(req, ctx)
    const pluginId = decodeURIComponent(accountPluginPublicationMatch[1] ?? '')
    const pluginVersion = decodeURIComponent(accountPluginPublicationMatch[2] ?? '')
    const plugin = accountPluginVersions(account).find((candidate) =>
      candidate.id === pluginId && candidate.version === pluginVersion)
    if (!plugin) throw new RoomProtocolError(404, 'account-plugin-not-found')
    const payload = await readJsonRequest(req)
    const visibility = payload?.visibility
    if (!['public', 'unlisted', 'private'].includes(visibility)) {
      throw new RoomProtocolError(400, 'invalid-plugin-publication')
    }
    const now = Date.now()
    if (visibility === 'private') {
      const registry = await mutatePluginRegistry(ctx, (current) => ({
        ...current,
        entries: current.entries.map((entry) => entry.id === pluginId && entry.publisher?.accountId === account.accountId
          ? {
              ...entry,
              updatedAt: now,
              versions: (Array.isArray(entry.versions) ? entry.versions : []).map((version) =>
                version.version === pluginVersion
                  ? { ...version, status: 'withdrawn', visibility: 'private', moderatedAt: now }
                  : version),
            }
          : entry),
      }))
      const entry = registry.entries.find((candidate) => candidate.id === pluginId)
      writeJson(res, 200, { publication: entry ?? null })
      return true
    }
    if (plugin.distributionPolicy !== 'room-distributable') {
      throw new RoomProtocolError(409, 'plugin-not-publicly-distributable')
    }
    const bytes = await readFile(accountPluginBlobFile(ctx, plugin.integrity))
    const parsedPackage = validateDeclarativePackageForPublication(bytes, plugin)
    const marketplaceResult = normalizeMarketplacePublication(payload, { allowLegacyFree: true })
    if (!marketplaceResult.ok) throw new RoomProtocolError(400, marketplaceResult.error)
    const creatorRegistry = await readPluginRegistry(ctx)
    const creator = creatorRegistry.creators.find((candidate) => candidate.accountId === account.accountId)
    if (marketplaceResult.value.pricing.kind === 'paid' && !marketplacePaidPublishingEnabled()) {
      throw new RoomProtocolError(503, 'marketplace-paid-commerce-disabled')
    }
    if (marketplaceResult.value.pricing.kind === 'paid' && creator?.status !== 'verified') {
      throw new RoomProtocolError(403, 'verified-creator-required')
    }
    const automatedAnalysis = analyzeMarketplaceDeclarativePackage(parsedPackage)
    if (automatedAnalysis.riskLevel === 'blocked') {
      throw new RoomProtocolError(400, 'marketplace-automated-analysis-blocked')
    }
    const changelog = normalizedLabel(payload?.changelog, 4_000)
    const storeDescription = normalizedLabel(payload?.storeDescription, 20_000)
    if (payload?.commerce && storeDescription.length < 20) {
      throw new RoomProtocolError(400, 'marketplace-store-description-required')
    }
    const tags = Array.isArray(payload?.tags)
      ? [...new Set(payload.tags.map((tag) => normalizedLabel(tag, 32)).filter(Boolean))].slice(0, 12)
      : []
    const productManifest = {
      schemaVersion: MARKETPLACE_PRODUCT_MANIFEST_SCHEMA_VERSION,
      productId: plugin.id,
      listingId: plugin.id,
      version: plugin.version,
      publisherAccountId: account.accountId,
      integrity: plugin.integrity,
      rulesetId: plugin.rulesetId,
      contentCategory: plugin.contentCategory,
      pricing: {
        kind: marketplaceResult.value.pricing.kind,
        currency: marketplaceResult.value.pricing.currency,
        amountMinor: marketplaceResult.value.pricing.amountMinor,
      },
      issuedAt: now,
    }
    const productSignature = await signMarketplaceProduct(ctx, productManifest)
    const status = pluginCatalogReviewRequired() ? 'pending' : 'published'
    const registry = await mutatePluginRegistry(ctx, (current) => {
      const currentCreator = current.creators.find((candidate) => candidate.accountId === account.accountId)
      if (marketplaceResult.value.pricing.kind === 'paid' && currentCreator?.status !== 'verified') {
        throw new RoomProtocolError(403, 'verified-creator-required')
      }
      const existing = current.entries.find((entry) => entry.id === pluginId)
      if (existing && existing.publisher?.accountId !== account.accountId) {
        throw new RoomProtocolError(409, 'plugin-id-owned-by-other-publisher')
      }
      const versionRecord = {
        ...plugin,
        visibility,
        status,
        changelog,
        storeDescription: storeDescription || plugin.description || '',
        marketplace: marketplaceResult.value,
        automatedAnalysis,
        productManifest,
        productSignature,
        submittedAt: now,
        ...(status === 'published' ? { publishedAt: now } : {}),
      }
      const entry = {
        schemaVersion: 1,
        id: plugin.id,
        name: plugin.name,
        description: plugin.description ?? '',
        publisher: {
          accountId: account.accountId,
          displayName: account.auth?.username ?? account.displayName,
          creatorVerified: currentCreator?.status === 'verified',
        },
        contentCategory: plugin.contentCategory,
        tags,
        versions: [
          ...(Array.isArray(existing?.versions) ? existing.versions : [])
            .filter((candidate) => candidate.version !== plugin.version),
          versionRecord,
        ],
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      }
      return {
        ...current,
        entries: [...current.entries.filter((candidate) => candidate.id !== pluginId), entry],
      }
    })
    const entry = registry.entries.find((candidate) => candidate.id === pluginId)
    writeJson(res, status === 'pending' ? 202 : 201, { publication: entry, status })
    return true
  }

  const accountPluginMatch = parsed.pathname.match(
    /^\/api\/accounts\/me\/plugins\/([^/]+)\/versions\/([^/]+)$/,
  )
  if (accountPluginMatch) {
    const account = await authenticateAccount(req, ctx)
    const pluginId = decodeURIComponent(accountPluginMatch[1] ?? '')
    const pluginVersion = decodeURIComponent(accountPluginMatch[2] ?? '')
    if (
      !/^[a-z0-9][a-z0-9._-]{0,99}$/.test(pluginId) ||
      !/^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/.test(pluginVersion)
    ) throw new RoomProtocolError(400, 'invalid-account-plugin')

    const currentVersions = accountPluginVersions(account)
    const current = currentVersions.find((candidate) =>
      candidate.id === pluginId && candidate.version === pluginVersion)

    if (req.method === 'PUT') {
      const uploadMetadata = decodedPluginMetadataHeader(req)
      const uploadDistributionPolicy = normalizePluginDistributionPolicy(uploadMetadata.distributionPolicy)
      if (uploadDistributionPolicy === 'local-only') {
        throw new RoomProtocolError(409, 'plugin-local-only')
      }
      if (uploadDistributionPolicy === 'room-ephemeral') {
        throw new RoomProtocolError(409, 'plugin-ephemeral-room-only')
      }
      const bytes = await readBody(req, STATE_MAX_BYTES)
      if (bytes.length < 1) throw new RoomProtocolError(400, 'account-plugin-file-empty')
      assertAccountPluginPackagePolicy(
        bytes,
        pluginId,
        pluginVersion,
        uploadDistributionPolicy ?? 'room-distributable',
      )
      const now = Date.now()
      const record = accountPluginVersionFromUpload(req, pluginId, pluginVersion, bytes.length, now)
      const actualIntegrity = `sha256-${createHash('sha256').update(bytes).digest('base64')}`
      if (actualIntegrity !== record.integrity) {
        throw new RoomProtocolError(409, 'account-plugin-integrity-mismatch')
      }
      const marketplaceProduct = await assertMarketplacePackageEntitlement(
        ctx,
        account.accountId,
        record.integrity,
      )
      if (current) {
        if (current.integrity !== record.integrity) {
          throw new RoomProtocolError(409, 'account-plugin-version-conflict')
        }
        if (marketplaceProduct) {
          await syncMarketplaceAccountInstallation(ctx, {
            accountId: account.accountId,
            integrity: record.integrity,
            active: true,
            timestamp: now,
          })
        }
        writeJson(res, 200, current)
        return true
      }
      if (currentVersions.length >= ACCOUNT_PLUGIN_VERSION_LIMIT) {
        throw new RoomProtocolError(409, 'account-plugin-version-limit')
      }
      const totalBytes = currentVersions.reduce((total, candidate) => total + candidate.sizeBytes, 0)
      if (totalBytes + record.sizeBytes > ACCOUNT_PLUGIN_TOTAL_BYTES_LIMIT) {
        throw new RoomProtocolError(409, 'account-plugin-storage-limit')
      }
      await mkdir(accountPluginBlobDirectory(ctx), { recursive: true })
      const blobPath = accountPluginBlobFile(ctx, record.integrity)
      try {
        await writeFile(blobPath, bytes, { flag: 'wx', mode: 0o600 })
      } catch (error) {
        if (error?.code !== 'EEXIST') throw error
        const stored = await readFile(blobPath)
        const storedIntegrity = `sha256-${createHash('sha256').update(stored).digest('base64')}`
        if (storedIntegrity !== record.integrity) {
          throw new RoomProtocolError(409, 'account-plugin-integrity-mismatch')
        }
      }
      await mutateAccount(ctx, account.accountId, (latest) => {
        const versions = accountPluginVersions(latest)
        const conflict = versions.find((candidate) =>
          candidate.id === pluginId && candidate.version === pluginVersion)
        if (conflict && conflict.integrity !== record.integrity) {
          throw new RoomProtocolError(409, 'account-plugin-version-conflict')
        }
        if (conflict) return latest
        if (versions.length >= ACCOUNT_PLUGIN_VERSION_LIMIT) {
          throw new RoomProtocolError(409, 'account-plugin-version-limit')
        }
        const latestBytes = versions.reduce((total, candidate) => total + candidate.sizeBytes, 0)
        if (latestBytes + record.sizeBytes > ACCOUNT_PLUGIN_TOTAL_BYTES_LIMIT) {
          throw new RoomProtocolError(409, 'account-plugin-storage-limit')
        }
        return {
          ...latest,
          pluginLibrary: [...versions, record],
          updatedAt: now,
        }
      })
      if (marketplaceProduct) {
        await syncMarketplaceAccountInstallation(ctx, {
          accountId: account.accountId,
          integrity: record.integrity,
          active: true,
          timestamp: now,
        })
      }
      writeJson(res, 201, record)
      return true
    }

    if (req.method === 'GET') {
      if (!current) throw new RoomProtocolError(404, 'account-plugin-not-found')
      let bytes
      try {
        bytes = await readFile(accountPluginBlobFile(ctx, current.integrity))
      } catch (error) {
        if (error?.code === 'ENOENT') throw new RoomProtocolError(404, 'account-plugin-file-not-found')
        throw error
      }
      const actualIntegrity = `sha256-${createHash('sha256').update(bytes).digest('base64')}`
      if (actualIntegrity !== current.integrity) {
        throw new RoomProtocolError(409, 'account-plugin-integrity-mismatch')
      }
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(bytes.length),
        'Cache-Control': 'private, no-store',
        'X-Stars-Plugin-Version': current.version,
        'X-Stars-Plugin-Integrity': current.integrity,
        'X-Stars-Plugin-Filename': encodeURIComponent(current.fileName),
        'X-Stars-Plugin-Name': encodeURIComponent(current.name),
        'X-Stars-Plugin-Publisher': encodeURIComponent(current.publisher),
        'X-Stars-Plugin-License': encodeURIComponent(current.license),
        'X-Stars-Plugin-State-Schema': String(current.stateSchemaVersion),
        'X-Stars-Plugin-Api-Version': String(current.apiVersion),
        'X-Stars-Plugin-Ruleset': current.rulesetId,
        'X-Stars-Plugin-Metadata': encodeURIComponent(JSON.stringify({
          manifestSchemaVersion: current.manifestSchemaVersion,
          minimumGameProtocolVersion: current.minimumGameProtocolVersion,
          dependencies: current.dependencies,
          conflicts: current.conflicts,
          declaredCapabilities: current.declaredCapabilities,
          distributionPolicy: current.distributionPolicy,
          contentCategory: current.contentCategory,
        })),
      })
      res.end(bytes)
      return true
    }

    if (req.method === 'DELETE') {
      if (!current) throw new RoomProtocolError(404, 'account-plugin-not-found')
      const usedByCharacter = (Array.isArray(account.characters) ? account.characters : []).some((character) =>
        Array.isArray(character?.compatibility?.requiredPlugins) &&
        character.compatibility.requiredPlugins.some((requirement) =>
          requirement?.id === current.id &&
          requirement?.version === current.version &&
          requirement?.integrity === current.integrity))
      if (usedByCharacter) throw new RoomProtocolError(409, 'account-plugin-in-use')
      const registry = await readPluginRegistry(ctx)
      const marketplaceProduct = registry.entries.flatMap((entry) =>
        (Array.isArray(entry.versions) ? entry.versions : []).map((version) => ({ entry, version })))
        .find(({ version }) =>
          version.integrity === current.integrity &&
          version.status === 'published')
      const usedByPublication = registry.entries.some((entry) =>
        entry.publisher?.accountId === account.accountId &&
        entry.id === current.id &&
        (Array.isArray(entry.versions) ? entry.versions : []).some((version) =>
          version.version === current.version &&
          version.integrity === current.integrity &&
          ['pending', 'published'].includes(version.status)))
      if (usedByPublication) throw new RoomProtocolError(409, 'account-plugin-in-use')
      const now = Date.now()
      await mutateAccount(ctx, account.accountId, (latest) => ({
        ...latest,
        pluginLibrary: accountPluginVersions(latest).filter((candidate) =>
          candidate.id !== pluginId || candidate.version !== pluginVersion),
        updatedAt: now,
      }))
      if (marketplaceProduct) {
        const remainingMarketplaceVersion = currentVersions
          .filter((candidate) =>
            candidate.id !== pluginId || candidate.version !== pluginVersion)
          .find((candidate) =>
            registry.entries.some((entry) =>
              entry.id === marketplaceProduct.entry.id &&
              (Array.isArray(entry.versions) ? entry.versions : []).some((version) =>
                version.integrity === candidate.integrity &&
                version.status === 'published')))
        await syncMarketplaceAccountInstallation(ctx, {
          accountId: account.accountId,
          integrity: remainingMarketplaceVersion?.integrity ?? current.integrity,
          active: Boolean(remainingMarketplaceVersion),
          timestamp: now,
        })
      }
      writeJson(res, 200, { ok: true })
      return true
    }

    throw new RoomProtocolError(405, 'method-not-allowed')
  }

  const characterMatch = parsed.pathname.match(/^\/api\/accounts\/me\/characters\/([^/]+)$/)
  if (characterMatch) {
    const account = await authenticateAccount(req, ctx)
    const characterId = decodeURIComponent(characterMatch[1] ?? '')
    if (!characterId || characterId.length > 128) throw new RoomProtocolError(400, 'invalid-account-character')
    if (req.method === 'PUT') {
      const payload = await readJsonRequest(req, 2 * 1024 * 1024)
      const now = Date.now()
      const record = normalizedAccountCharacterRecord(payload, account.accountId, characterId, now)
      await mutateAccount(ctx, account.accountId, (current) => {
        const characters = Array.isArray(current.characters) ? current.characters : []
        const exists = characters.some((candidate) => candidate?.id === characterId)
        if (!exists && characters.length >= ACCOUNT_CHARACTER_LIMIT) {
          throw new RoomProtocolError(409, 'account-character-limit')
        }
        return {
          ...current,
          characters: [...characters.filter((candidate) => candidate?.id !== characterId), record]
            .sort((left, right) => Number(right.updatedAt ?? 0) - Number(left.updatedAt ?? 0)),
          updatedAt: now,
        }
      })
      writeJson(res, 200, record)
      return true
    }
    if (req.method === 'DELETE') {
      const currentCharacters = Array.isArray(account.characters) ? account.characters : []
      if (!currentCharacters.some((candidate) => candidate?.id === characterId)) {
        throw new RoomProtocolError(404, 'account-character-not-found')
      }
      const now = Date.now()
      await mutateAccount(ctx, account.accountId, (current) => ({
        ...current,
        characters: (Array.isArray(current.characters) ? current.characters : [])
          .filter((candidate) => candidate?.id !== characterId),
        updatedAt: now,
      }))
      writeJson(res, 200, { ok: true })
      return true
    }
    throw new RoomProtocolError(405, 'method-not-allowed')
  }

  throw new RoomProtocolError(404, 'account-not-found')
}

async function handleRoomLobbyApi(req, res, parsed, ctx) {
  if (!parsed.pathname.startsWith('/api/rooms')) return false
  if (!applyLobbyRateLimit(req, res, ctx)) return true

  if (parsed.pathname === '/api/rooms' && req.method === 'POST') {
    const payload = await readJsonRequest(req)
    if (payload?.campaignId != null) {
      throw new RoomProtocolError(400, 'campaign-room-launch-required')
    }
    const account = await authenticateAccount(req, ctx, !productionSecurityEnabled())
    if (payload?.accountId != null && account?.accountId !== payload.accountId) {
      throw new RoomProtocolError(401, 'invalid-account-session')
    }
    const { room, member, roomToken } = await createLobbyRoom(ctx, payload, account)
    writeJson(res, 201, roomMemberResponse(room, member, 'dm', roomToken))
    return true
  }

  const previewMatch = parsed.pathname.match(/^\/api\/rooms\/([^/]+)\/preview$/)
  if (previewMatch) {
    if (req.method !== 'GET') throw new RoomProtocolError(405, 'method-not-allowed')
    const rawRoomId = String(previewMatch[1] ?? '').toUpperCase()
    const roomId = normalizeLobbyRoomCode(rawRoomId)
    if (roomId !== rawRoomId || roomId.length !== 6) throw new RoomProtocolError(400, 'invalid-room-code')
    const result = await mutateLobbyRoom(ctx, roomId, (room) => {
      if (room.closedAt) return { ok: false, status: 409, error: 'room-closed' }
      return { ok: true }
    })
    const rules = roomRulesResponse(result.room)
    writeJson(res, 200, {
      roomId: result.room.id,
      roomName: result.room.name,
      rulesetId: result.room.rulesetId,
      dmDisplayName: result.room.host?.displayName ?? 'DM',
      hostOnline: roomHostIsOnline(result.room),
      hostStatus: roomHostPresence(result.room),
      hostLastSeenAt: Number(result.room.host?.lastSeenAt ?? 0),
      hostGraceExpiresAt: Number(result.room.host?.lastSeenAt ?? 0) + ROOM_HOST_TTL_MS,
      gameProtocolVersion: SHARED_PROTOCOL_VERSION,
      locked: result.room.locked === true,
      passwordRequired: plainObject(result.room.joinSecret),
      playerCount: activeRoomPlayers(result.room).length,
      spectatorCount: activeRoomSpectators(result.room).length,
      maxPlayers: Number.isInteger(result.room.maxPlayers) ? result.room.maxPlayers : 3,
      plugins: rules.plugins,
    })
    return true
  }

  const protectedRoomMatch = parsed.pathname.match(/^\/api\/rooms\/([^/]+)\/(.+)$/)
  if (protectedRoomMatch && !['join', 'preview'].includes(protectedRoomMatch[2])) {
    const rawRoomId = String(protectedRoomMatch[1] ?? '').toUpperCase()
    const protectedRoomId = normalizeLobbyRoomCode(rawRoomId)
    if (protectedRoomId !== rawRoomId || protectedRoomId.length !== 6) {
      throw new RoomProtocolError(400, 'invalid-room-code')
    }
    let protectedRoom
    try {
      protectedRoom = JSON.parse(await readFile(roomLobbyFile(ctx, protectedRoomId), 'utf8'))
    } catch (error) {
      if (error?.code === 'ENOENT') throw new RoomProtocolError(404, 'room-not-found')
      throw error
    }
    const requestMember = lobbyRoomMember(protectedRoom, req?.headers?.['x-stars-member'])
    if (!requestMember || !roomMemberSessionAuthorized(requestMember, req?.headers?.['x-stars-room-token'])) {
      throw new RoomProtocolError(403, 'forbidden')
    }
  }

  const stagedPluginMatch = parsed.pathname.match(
    /^\/api\/rooms\/([^/]+)\/plugins\/([^/]+)\/(stage|migration-state|activate)$/,
  )
  if (stagedPluginMatch) {
    const rawRoomId = String(stagedPluginMatch[1] ?? '').toUpperCase()
    const roomId = normalizeLobbyRoomCode(rawRoomId)
    const pluginId = decodeURIComponent(stagedPluginMatch[2] ?? '')
    const operation = stagedPluginMatch[3]
    if (roomId !== rawRoomId || roomId.length !== 6) throw new RoomProtocolError(400, 'invalid-room-code')
    if (!/^[a-z0-9][a-z0-9._-]{0,99}$/.test(pluginId)) throw new RoomProtocolError(400, 'invalid-plugin-manifest')

    if (operation === 'migration-state') {
      if (req.method !== 'GET') throw new RoomProtocolError(405, 'method-not-allowed')
      const memberId = req?.headers?.['x-stars-member']
      const result = await mutateLobbyRoom(ctx, roomId, (room) => {
        if (room.closedAt) return { ok: false, status: 409, error: 'room-closed' }
        if (room.host?.memberId !== memberId) return { ok: false, status: 403, error: 'forbidden' }
        const active = (Array.isArray(room.requiredPlugins) ? room.requiredPlugins : [])
          .find((plugin) => plugin.id === pluginId)
        const stored = room.pluginRuntimeState?.[pluginId]
        const stateSchemaVersion = Number.isInteger(stored?.stateSchemaVersion)
          ? stored.stateSchemaVersion
          : (active?.stateSchemaVersion ?? 1)
        return {
          ok: true,
          active,
          hasState: !!stored || !!active,
          runtime: {
            stateSchemaVersion,
            data: stored?.data == null ? {} : normalizedPluginState(stored.data),
          },
        }
      })
      writeJson(res, 200, {
        installed: !!result.active,
        hasState: result.hasState,
        rulesRevision: Number.isFinite(result.room.rulesRevision) ? result.room.rulesRevision : 1,
        ...(result.active ? { active: result.active } : {}),
        stateSchemaVersion: result.runtime.stateSchemaVersion,
        data: result.runtime.data,
      })
      return true
    }

    if (operation === 'stage') {
      if (req.method !== 'PUT') throw new RoomProtocolError(405, 'method-not-allowed')
      const memberId = req?.headers?.['x-stars-member']
      const version = typeof req?.headers?.['x-stars-plugin-version'] === 'string'
        ? req.headers['x-stars-plugin-version'].trim()
        : ''
      const expectedIntegrity = typeof req?.headers?.['x-stars-plugin-integrity'] === 'string'
        ? req.headers['x-stars-plugin-integrity'].trim()
        : ''
      const stateSchemaVersion = Number(req?.headers?.['x-stars-plugin-state-schema'])
      const encodedFileName = typeof req?.headers?.['x-stars-plugin-filename'] === 'string'
        ? req.headers['x-stars-plugin-filename']
        : ''
      const pluginName = decodedPluginHeader(req, 'x-stars-plugin-name', 100)
      const publisher = decodedPluginHeader(req, 'x-stars-plugin-publisher', 100)
      const license = decodedPluginHeader(req, 'x-stars-plugin-license', 120)
      const distributionPolicy = roomPluginDistributionPolicy(req)
      if (!pluginName || !publisher || !license) throw new RoomProtocolError(400, 'invalid-plugin-manifest')
      let fileName = `${pluginId}.dndstars5e`
      try {
        const decoded = decodeURIComponent(encodedFileName)
        if (decoded && decoded.length <= 180 && !/[\\/\0]/.test(decoded)) fileName = decoded
      } catch {
        throw new RoomProtocolError(400, 'invalid-plugin-manifest')
      }
      const requirement = normalizeRoomPluginRequirements([{
        id: pluginId,
        version,
        integrity: expectedIntegrity,
        stateSchemaVersion,
      }])?.[0]
      if (!requirement) throw new RoomProtocolError(400, 'invalid-plugin-manifest')
      const authorizedStageRoom = await mutateLobbyRoom(ctx, roomId, (room) => {
        if (room.closedAt) return { ok: false, status: 409, error: 'room-closed' }
        if (room.host?.memberId !== memberId) return { ok: false, status: 403, error: 'forbidden' }
        return { ok: true }
      })
      const bytes = await readBody(
        req,
        distributionPolicy === 'room-ephemeral' ? ROOM_EPHEMERAL_PLUGIN_MAX_BYTES : STATE_MAX_BYTES,
      )
      if (bytes.length < 1) throw new RoomProtocolError(400, 'plugin-file-empty')
      assertDeclarativeRoomPluginManifest(bytes, pluginId, version, distributionPolicy)
      const actualIntegrity = `sha256-${createHash('sha256').update(bytes).digest('base64')}`
      if (actualIntegrity !== requirement.integrity) throw new RoomProtocolError(409, 'plugin-integrity-mismatch')
      await assertMarketplacePackageEntitlement(
        ctx,
        authorizedStageRoom.room.host?.accountId,
        requirement.integrity,
      )
      await mkdir(roomPluginDirectory(ctx, roomId), { recursive: true })
      const storagePath = roomPluginVersionFile(ctx, roomId, pluginId, requirement.integrity)
      await withWriteLock(storagePath, () => atomicRename(storagePath, bytes))
      const now = Date.now()
      const result = await mutateLobbyRoom(ctx, roomId, (room) => {
        if (room.closedAt) return { ok: false, status: 409, error: 'room-closed' }
        if (room.host?.memberId !== memberId) return { ok: false, status: 403, error: 'forbidden' }
        return {
          ok: true,
          member: room.host,
          next: {
            ...room,
            stagedPluginFiles: {
              ...(room.stagedPluginFiles ?? {}),
              [pluginId]: {
                ...requirement,
                name: pluginName,
                publisher,
                license,
                distributionPolicy,
                fileName,
                storageFile: path.basename(storagePath),
                size: bytes.length,
                uploadedAt: now,
              },
            },
            updatedAt: now,
          },
        }
      })
      writeJson(res, 200, roomRulesResponse(result.room, result.member))
      return true
    }

    if (operation === 'activate') {
      if (req.method !== 'POST') throw new RoomProtocolError(405, 'method-not-allowed')
      const payload = await readJsonRequest(req)
      const memberId = payload?.memberId
      const expectedRulesRevision = Number(payload?.expectedRulesRevision)
      const stateSchemaVersion = Number(payload?.stateSchemaVersion)
      const stagedVersion = typeof payload?.stagedVersion === 'string' ? payload.stagedVersion : ''
      const stagedIntegrity = typeof payload?.stagedIntegrity === 'string' ? payload.stagedIntegrity : ''
      const expectedActive = payload?.expectedActive == null
        ? null
        : normalizeRoomPluginRequirements([payload.expectedActive])?.[0]
      if (
        !Number.isInteger(expectedRulesRevision) || !Number.isInteger(stateSchemaVersion) ||
        payload?.expectedActive != null && !expectedActive
      ) throw new RoomProtocolError(400, 'invalid-plugin-activation')
      const data = normalizedPluginState(payload?.data)
      await writeCampaignSnapshot(scopedContext(ctx, roomId), 'pre-plugin-change')
      const now = Date.now()
      const result = await mutateLobbyRoom(ctx, roomId, (room) => {
        if (room.closedAt) return { ok: false, status: 409, error: 'room-closed' }
        if (room.host?.memberId !== memberId) return { ok: false, status: 403, error: 'forbidden' }
        const currentRevision = Number.isFinite(room.rulesRevision) ? room.rulesRevision : 1
        if (currentRevision !== expectedRulesRevision) {
          return { ok: false, status: 409, error: 'rules-revision-conflict' }
        }
        const current = (Array.isArray(room.requiredPlugins) ? room.requiredPlugins : [])
          .find((plugin) => plugin.id === pluginId) ?? null
        if (!samePluginRequirement(current, expectedActive)) {
          return { ok: false, status: 409, error: 'plugin-version-conflict' }
        }
        const staged = room.stagedPluginFiles?.[pluginId]
        if (!staged || staged.version !== stagedVersion || staged.integrity !== stagedIntegrity) {
          return { ok: false, status: 409, error: 'staged-plugin-conflict' }
        }
        if ((staged.stateSchemaVersion ?? 1) !== stateSchemaVersion) {
          return { ok: false, status: 409, error: 'plugin-state-schema-mismatch' }
        }
        const previousState = room.pluginRuntimeState?.[pluginId]
        const previousSchema = Number.isInteger(previousState?.stateSchemaVersion)
          ? previousState.stateSchemaVersion
          : (current?.stateSchemaVersion ?? 1)
        if (stateSchemaVersion < previousSchema) {
          return { ok: false, status: 409, error: 'plugin-state-downgrade' }
        }
        const stagedPluginFiles = { ...(room.stagedPluginFiles ?? {}) }
        delete stagedPluginFiles[pluginId]
        const requiredPlugins = [
          ...(Array.isArray(room.requiredPlugins) ? room.requiredPlugins : []).filter((plugin) => plugin.id !== pluginId),
          {
            id: staged.id,
            version: staged.version,
            integrity: staged.integrity,
            stateSchemaVersion: staged.stateSchemaVersion ?? 1,
          },
        ].sort((left, right) => left.id.localeCompare(right.id))
        return {
          ok: true,
          member: room.host,
          next: {
            ...room,
            requiredPlugins,
            pluginFiles: { ...(room.pluginFiles ?? {}), [pluginId]: staged },
            stagedPluginFiles,
            pluginRuntimeState: {
              ...(room.pluginRuntimeState ?? {}),
              [pluginId]: {
                pluginVersion: staged.version,
                stateSchemaVersion,
                data,
                updatedAt: now,
              },
            },
            rulesRevision: currentRevision + 1,
            rulesUpdatedAt: now,
            updatedAt: now,
          },
        }
      })
      writeJson(res, 200, roomRulesResponse(result.room, result.member))
      return true
    }
  }

  const pluginMatch = parsed.pathname.match(/^\/api\/rooms\/([^/]+)\/plugins\/([^/]+)$/)
  if (pluginMatch) {
    const rawRoomId = String(pluginMatch[1] ?? '').toUpperCase()
    const roomId = normalizeLobbyRoomCode(rawRoomId)
    const pluginId = decodeURIComponent(pluginMatch[2] ?? '')
    if (roomId !== rawRoomId || roomId.length !== 6) throw new RoomProtocolError(400, 'invalid-room-code')
    if (!/^[a-z0-9][a-z0-9._-]{0,99}$/.test(pluginId)) throw new RoomProtocolError(400, 'invalid-plugin-manifest')

    if (req.method === 'GET') {
      const memberId = req?.headers?.['x-stars-member']
      const result = await mutateLobbyRoom(ctx, roomId, (room) => {
        if (room.closedAt) return { ok: false, status: 409, error: 'room-closed' }
        const member = lobbyRoomMember(room, memberId)
        if (!member) return { ok: false, status: 403, error: 'forbidden' }
        if (member !== room.host && !roomHostIsOnline(room)) {
          return { ok: false, status: 409, error: 'room-offline' }
        }
        const requirement = (Array.isArray(room.requiredPlugins) ? room.requiredPlugins : [])
          .find((plugin) => plugin.id === pluginId)
        const hosted = room.pluginFiles?.[pluginId]
        if (!requirement || !hosted || hosted.integrity !== requirement.integrity || hosted.version !== requirement.version) {
          return { ok: false, status: 404, error: 'plugin-file-not-found' }
        }
        return { ok: true, member, requirement, hosted }
      })
      let bytes
      try {
        bytes = await readFile(roomHostedPluginFile(ctx, roomId, pluginId, result.hosted))
      } catch (error) {
        if (error?.code === 'ENOENT') throw new RoomProtocolError(404, 'plugin-file-not-found')
        throw error
      }
      const actualIntegrity = `sha256-${createHash('sha256').update(bytes).digest('base64')}`
      if (actualIntegrity !== result.requirement.integrity) {
        throw new RoomProtocolError(409, 'plugin-integrity-mismatch')
      }
      res.writeHead(200, {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Content-Length': String(bytes.length),
        'Cache-Control': 'private, no-store',
        'X-Stars-Plugin-Version': result.requirement.version,
        'X-Stars-Plugin-Integrity': result.requirement.integrity,
        'X-Stars-Plugin-State-Schema': String(result.requirement.stateSchemaVersion ?? 1),
        'X-Stars-Plugin-Filename': encodeURIComponent(result.hosted.fileName ?? `${pluginId}.dndstars5e`),
        'X-Stars-Plugin-Name': encodeURIComponent(result.hosted.name ?? pluginId),
        'X-Stars-Plugin-Publisher': encodeURIComponent(result.hosted.publisher ?? '未知发布者'),
        'X-Stars-Plugin-License': encodeURIComponent(result.hosted.license ?? '未声明'),
        'X-Stars-Plugin-Distribution-Policy': result.hosted.distributionPolicy ?? 'room-distributable',
      })
      res.end(bytes)
      return true
    }

    if (req.method === 'PUT') {
      const memberId = req?.headers?.['x-stars-member']
      const version = typeof req?.headers?.['x-stars-plugin-version'] === 'string'
        ? req.headers['x-stars-plugin-version'].trim()
        : ''
      const expectedIntegrity = typeof req?.headers?.['x-stars-plugin-integrity'] === 'string'
        ? req.headers['x-stars-plugin-integrity'].trim()
        : ''
      const encodedFileName = typeof req?.headers?.['x-stars-plugin-filename'] === 'string'
        ? req.headers['x-stars-plugin-filename']
        : ''
      const pluginName = decodedPluginHeader(req, 'x-stars-plugin-name', 100)
      const publisher = decodedPluginHeader(req, 'x-stars-plugin-publisher', 100)
      const license = decodedPluginHeader(req, 'x-stars-plugin-license', 120)
      const distributionPolicy = roomPluginDistributionPolicy(req)
      if (!pluginName || !publisher || !license) throw new RoomProtocolError(400, 'invalid-plugin-manifest')
      let fileName = `${pluginId}.dndstars5e`
      try {
        const decoded = decodeURIComponent(encodedFileName)
        if (decoded && decoded.length <= 180 && !/[\\/\0]/.test(decoded)) fileName = decoded
      } catch {
        throw new RoomProtocolError(400, 'invalid-plugin-manifest')
      }
      const requirement = normalizeRoomPluginRequirements([{
        id: pluginId,
        version,
        integrity: expectedIntegrity,
        stateSchemaVersion: Number(req?.headers?.['x-stars-plugin-state-schema'] ?? 1),
      }])?.[0]
      if (!requirement) throw new RoomProtocolError(400, 'invalid-plugin-manifest')
      const authorizedLegacyRoom = await mutateLobbyRoom(ctx, roomId, (room) => {
        if (room.closedAt) return { ok: false, status: 409, error: 'room-closed' }
        if (room.host?.memberId !== memberId) return { ok: false, status: 403, error: 'forbidden' }
        return { ok: true, member: room.host }
      })
      const bytes = await readBody(
        req,
        distributionPolicy === 'room-ephemeral' ? ROOM_EPHEMERAL_PLUGIN_MAX_BYTES : STATE_MAX_BYTES,
      )
      if (bytes.length < 1) throw new RoomProtocolError(400, 'plugin-file-empty')
      assertDeclarativeRoomPluginManifest(bytes, pluginId, version, distributionPolicy)
      const actualIntegrity = `sha256-${createHash('sha256').update(bytes).digest('base64')}`
      if (actualIntegrity !== requirement.integrity) throw new RoomProtocolError(409, 'plugin-integrity-mismatch')
      await assertMarketplacePackageEntitlement(
        ctx,
        authorizedLegacyRoom.room.host?.accountId,
        requirement.integrity,
      )
      await writeCampaignSnapshot(scopedContext(ctx, roomId), 'pre-plugin-change')
      await mkdir(roomPluginDirectory(ctx, roomId), { recursive: true })
      await withWriteLock(roomPluginFile(ctx, roomId, pluginId), () =>
        atomicRename(roomPluginFile(ctx, roomId, pluginId), bytes))
      const now = Date.now()
      const result = await mutateLobbyRoom(ctx, roomId, (room) => {
        if (room.closedAt) return { ok: false, status: 409, error: 'room-closed' }
        if (room.host?.memberId !== memberId) return { ok: false, status: 403, error: 'forbidden' }
        const requiredPlugins = [
          ...(Array.isArray(room.requiredPlugins) ? room.requiredPlugins : []).filter((plugin) => plugin.id !== pluginId),
          requirement,
        ].sort((left, right) => left.id.localeCompare(right.id))
        return {
          ok: true,
          member: room.host,
          next: {
            ...room,
            requiredPlugins,
            pluginFiles: {
              ...(room.pluginFiles ?? {}),
              [pluginId]: {
                ...requirement,
                name: pluginName,
                publisher,
                license,
                distributionPolicy,
                fileName,
                size: bytes.length,
                uploadedAt: now,
              },
            },
            rulesRevision: (Number.isFinite(room.rulesRevision) ? room.rulesRevision : 1) + 1,
            rulesUpdatedAt: now,
            updatedAt: now,
          },
        }
      })
      writeJson(res, 200, roomRulesResponse(result.room, result.member))
      return true
    }

    if (req.method === 'DELETE') {
      const memberId = req?.headers?.['x-stars-member']
      await mutateLobbyRoom(ctx, roomId, (room) => {
        if (room.closedAt) return { ok: false, status: 409, error: 'room-closed' }
        if (room.host?.memberId !== memberId) return { ok: false, status: 403, error: 'forbidden' }
        return { ok: true }
      })
      await writeCampaignSnapshot(scopedContext(ctx, roomId), 'pre-plugin-change')
      const now = Date.now()
      const result = await mutateLobbyRoom(ctx, roomId, (room) => {
        if (room.closedAt) return { ok: false, status: 409, error: 'room-closed' }
        if (room.host?.memberId !== memberId) return { ok: false, status: 403, error: 'forbidden' }
        const ephemeralStoragePaths = roomEphemeralPluginStoragePaths(ctx, roomId, room, pluginId)
        const pluginFiles = { ...(room.pluginFiles ?? {}) }
        delete pluginFiles[pluginId]
        const stagedPluginFiles = { ...(room.stagedPluginFiles ?? {}) }
        delete stagedPluginFiles[pluginId]
        const pluginRuntimeState = { ...(room.pluginRuntimeState ?? {}) }
        delete pluginRuntimeState[pluginId]
        return {
          ok: true,
          member: room.host,
          ephemeralStoragePaths,
          next: {
            ...room,
            requiredPlugins: (Array.isArray(room.requiredPlugins) ? room.requiredPlugins : [])
              .filter((plugin) => plugin.id !== pluginId),
            pluginFiles,
            stagedPluginFiles,
            pluginRuntimeState,
            rulesRevision: (Number.isFinite(room.rulesRevision) ? room.rulesRevision : 1) + 1,
            rulesUpdatedAt: now,
            updatedAt: now,
          },
        }
      })
      await removeRoomEphemeralPluginStorage(result.ephemeralStoragePaths ?? [])
      writeJson(res, 200, roomRulesResponse(result.room, result.member))
      return true
    }
    throw new RoomProtocolError(405, 'method-not-allowed')
  }

  const adminMatch = parsed.pathname.match(/^\/api\/rooms\/([^/]+)\/admin$/)
  if (adminMatch) {
    if (req.method !== 'PATCH') throw new RoomProtocolError(405, 'method-not-allowed')
    const rawRoomId = String(adminMatch[1] ?? '').toUpperCase()
    const roomId = normalizeLobbyRoomCode(rawRoomId)
    if (roomId !== rawRoomId || roomId.length !== 6) throw new RoomProtocolError(400, 'invalid-room-code')
    const payload = await readJsonRequest(req)
    const memberId = payload?.memberId
    const operation = payload?.operation
    const account = await authenticateAccount(req, ctx, true)
    const result = await mutateLobbyRoom(ctx, roomId, (room) => {
      if (room.closedAt) return { ok: false, status: 409, error: 'room-closed' }
      if (room.host?.memberId !== memberId || !roomMemberAccountAuthorized(room.host, account)) {
        return { ok: false, status: 403, error: 'forbidden' }
      }
      const now = Date.now()
      const players = Array.isArray(room.players) ? room.players : []
      const activePlayers = activeRoomPlayers(room, now)
      if (operation === 'set-lock') {
        return { ok: true, member: room.host, role: 'dm', next: { ...room, locked: payload.locked === true, updatedAt: now } }
      }
      if (operation === 'set-capacity') {
        const maxPlayers = Number(payload.maxPlayers)
        if (!Number.isInteger(maxPlayers) || maxPlayers < activePlayers.length || maxPlayers > ROOM_PLAYER_SLOTS.length) {
          return { ok: false, status: 400, error: 'invalid-room-capacity' }
        }
        return { ok: true, member: room.host, role: 'dm', next: { ...room, maxPlayers, updatedAt: now } }
      }
      if (operation === 'set-password') {
        const password = normalizedRoomPassword(payload.password)
        if (password.length > 64) return { ok: false, status: 400, error: 'invalid-room-password' }
        return {
          ok: true,
          member: room.host,
          role: 'dm',
          next: { ...room, joinSecret: roomPasswordRecord(password), updatedAt: now },
        }
      }
      if (operation === 'kick') {
        const target = players.find((player) => player.memberId === payload.targetMemberId && !player.removedAt)
        if (!target) return { ok: false, status: 404, error: 'member-not-found' }
        return {
          ok: true,
          member: room.host,
          role: 'dm',
          next: {
            ...room,
            players: players.map((player) => player.memberId === target.memberId
              ? { ...player, lastSeenAt: 0, removedAt: now }
              : player),
            updatedAt: now,
          },
        }
      }
      if (operation === 'restore-member') {
        const target = players.find((player) => player.memberId === payload.targetMemberId && player.removedAt)
        if (!target) return { ok: false, status: 404, error: 'member-not-found' }
        const restored = { ...target, lastSeenAt: 0, leftAt: now }
        delete restored.removedAt
        return {
          ok: true,
          member: room.host,
          role: 'dm',
          next: {
            ...room,
            players: players.map((player) => player.memberId === target.memberId ? restored : player),
            updatedAt: now,
          },
        }
      }
      if (operation === 'transfer-dm') {
        const target = activePlayers.find((player) => player.memberId === payload.targetMemberId)
        if (!target) return { ok: false, status: 404, error: 'member-not-found' }
        if (!roomPluginReadiness(room.requiredPlugins, target.activePlugins).ready) {
          return { ok: false, status: 409, error: 'target-plugins-not-ready' }
        }
        const nextHost = { ...target, lastSeenAt: now }
        delete nextHost.slot
        delete nextHost.role
        const previousHostAsPlayer = {
          ...room.host,
          role: 'player',
          slot: target.slot,
          joinedAt: room.host.joinedAt ?? room.createdAt,
          lastSeenAt: now,
        }
        return {
          ok: true,
          member: previousHostAsPlayer,
          role: 'player',
          next: {
            ...room,
            host: nextHost,
            players: [...players.filter((player) => player.memberId !== target.memberId), previousHostAsPlayer],
            authorityRevision: Number(room.authorityRevision ?? 1) + 1,
            updatedAt: now,
          },
        }
      }
      return { ok: false, status: 400, error: 'invalid-room-operation' }
    })
    writeJson(res, 200, roomMemberResponse(result.room, result.member, result.role))
    return true
  }

  const match = parsed.pathname.match(/^\/api\/rooms\/([^/]+)\/(join|heartbeat|leave|roster|rules)$/)
  if (!match) throw new RoomProtocolError(404, 'room-not-found')
  const rawRoomId = String(match[1] ?? '').toUpperCase()
  const roomId = normalizeLobbyRoomCode(rawRoomId)
  if (roomId !== rawRoomId || roomId.length !== 6) throw new RoomProtocolError(400, 'invalid-room-code')
  if (match[2] === 'rules') {
    if (req.method !== 'GET' && req.method !== 'PUT') throw new RoomProtocolError(405, 'method-not-allowed')
    const payload = req.method === 'PUT' ? await readJsonRequest(req) : null
    const memberId = req.method === 'GET' ? req?.headers?.['x-stars-member'] : payload?.memberId
    const account = await authenticateAccount(req, ctx, true)
    const result = await mutateLobbyRoom(ctx, roomId, (room) => {
      if (room.closedAt) return { ok: false, status: 409, error: 'room-closed' }
      const member = lobbyRoomMember(room, memberId)
      if (!member || !roomMemberAccountAuthorized(member, account)) return { ok: false, status: 403, error: 'forbidden' }
      if (req.method === 'GET') return { ok: true, member }
      if (room.host?.memberId !== memberId) return { ok: false, status: 403, error: 'forbidden' }
      const requiredPlugins = normalizeRoomPluginRequirements(payload?.requiredPlugins)
      if (!requiredPlugins) return { ok: false, status: 400, error: 'invalid-plugin-manifest' }
      const houseRules = payload?.houseRules == null
        ? normalizeDnd5eHouseRules(room.dnd5eHouseRules)
        : normalizeDnd5eHouseRules(payload.houseRules)
      const hosted = room.pluginFiles ?? {}
      if (requiredPlugins.some((plugin) =>
        hosted[plugin.id]?.version !== plugin.version || hosted[plugin.id]?.integrity !== plugin.integrity)) {
        return { ok: false, status: 409, error: 'plugin-file-missing' }
      }
      const now = Date.now()
      const host = { ...room.host, activePlugins: requiredPlugins, lastSeenAt: now }
      return {
        ok: true,
        member: host,
        next: {
          ...room,
          host,
          requiredPlugins,
          dnd5eHouseRules: houseRules,
          rulesRevision: (Number.isFinite(room.rulesRevision) ? room.rulesRevision : 1) + 1,
          rulesUpdatedAt: now,
          updatedAt: now,
        },
      }
    })
    writeJson(res, 200, roomRulesResponse(result.room, result.member))
    return true
  }
  if (match[2] === 'roster') {
    if (req.method !== 'GET') throw new RoomProtocolError(405, 'method-not-allowed')
    const memberId = req?.headers?.['x-stars-member']
    const account = await authenticateAccount(req, ctx, true)
    const result = await mutateLobbyRoom(ctx, roomId, (room) => {
      if (room.closedAt) return { ok: false, status: 409, error: 'room-closed' }
      if (
        typeof memberId !== 'string' || room.host?.memberId !== memberId ||
        !roomMemberAccountAuthorized(room.host, account)
      ) {
        return { ok: false, status: 403, error: 'forbidden' }
      }
      return { ok: true }
    })
    const now = Date.now()
    writeJson(res, 200, {
      roomId: result.room.id,
      locked: result.room.locked === true,
      passwordRequired: plainObject(result.room.joinSecret),
      maxPlayers: Number.isInteger(result.room.maxPlayers) ? result.room.maxPlayers : 3,
      players: (Array.isArray(result.room.players) ? result.room.players : []).map((player) => ({
        memberId: player.memberId,
        accountId: player.accountId,
        displayName: player.displayName,
        role: player.role === 'spectator' ? 'spectator' : 'player',
        slot: player.slot,
        joinedAt: player.joinedAt,
        lastSeenAt: player.lastSeenAt,
        status: roomPlayerPresence(player, now),
        online: roomPlayerPresence(player, now) === 'online',
        activeCharacterId: normalizedLabel(player.activeCharacterId, 128) || null,
        activeCharacterName: normalizedLabel(player.activeCharacterName, 80) || null,
        ...roomPluginReadiness(result.room.requiredPlugins, player.activePlugins),
      })),
    })
    return true
  }

  if (req.method !== 'POST') throw new RoomProtocolError(405, 'method-not-allowed')
  const payload = await readJsonRequest(req)

  if (match[2] === 'join') {
    const displayName = normalizedLabel(payload?.displayName, 24)
    const clientId = payload?.clientId
    const resumeMemberId = payload?.resumeMemberId
    const activePlugins = normalizeRoomPluginRequirements(payload?.activePlugins ?? [])
    const requestedRole = payload?.role === 'spectator' ? 'spectator' : 'player'
    const account = await authenticateAccount(req, ctx, !productionSecurityEnabled())
    const roomToken = createRoomSessionToken()
    const roomTokenHash = roomSessionTokenHash(roomToken)
    if (!displayName) throw new RoomProtocolError(400, 'invalid-display-name')
    if (!validClientId(clientId)) throw new RoomProtocolError(400, 'invalid-client')
    if (resumeMemberId != null && (typeof resumeMemberId !== 'string' || resumeMemberId.length < 8 || resumeMemberId.length > 128)) {
      throw new RoomProtocolError(400, 'invalid-resume-member')
    }
    if (!activePlugins) throw new RoomProtocolError(400, 'invalid-plugin-manifest')
    const result = await mutateLobbyRoom(ctx, roomId, (room) => {
      if (account && room.host?.accountId === account.accountId) {
        if (room.closedAt) return { ok: false, status: 409, error: 'room-closed' }
        const now = Date.now()
        const member = {
          ...room.host,
          clientId,
          displayName,
          activePlugins,
          lastSeenAt: now,
          roomTokenHash,
        }
        return { ok: true, member, role: 'dm', next: { ...room, host: member, updatedAt: now } }
      }
      if (!roomPasswordMatches(room, payload?.password)) return { ok: false, status: 403, error: 'invalid-room-password' }
      const assign = requestedRole === 'spectator' ? assignRoomSpectator : assignRoomPlayer
      return assign(room, {
        clientId,
        displayName,
        memberId: resumeMemberId ?? randomUUID(),
        accountId: account?.accountId,
        activePlugins,
        roomTokenHash,
      })
    })
    writeJson(res, 200, roomMemberResponse(result.room, result.member, result.role ?? requestedRole, roomToken))
    return true
  }

  const memberId = payload?.memberId
  if (typeof memberId !== 'string' || memberId.length < 8) throw new RoomProtocolError(400, 'member-not-found')
  const account = await authenticateAccount(req, ctx, true)

  if (match[2] === 'heartbeat') {
    const now = Date.now()
    const activePlugins = normalizeRoomPluginRequirements(payload?.activePlugins ?? [])
    if (!activePlugins) throw new RoomProtocolError(400, 'invalid-plugin-manifest')
    const characterPresenceProvided = Object.prototype.hasOwnProperty.call(payload ?? {}, 'activeCharacterId') ||
      Object.prototype.hasOwnProperty.call(payload ?? {}, 'activeCharacterName')
    const presencePatch = (member) => characterPresenceProvided
      ? {
          activeCharacterId: normalizedLabel(payload?.activeCharacterId, 128) || null,
          activeCharacterName: normalizedLabel(payload?.activeCharacterName, 80) || null,
        }
      : {
          activeCharacterId: member?.activeCharacterId ?? null,
          activeCharacterName: member?.activeCharacterName ?? null,
        }
    const result = await mutateLobbyRoom(ctx, roomId, (room) => {
      if (room.closedAt) return { ok: false, status: 409, error: 'room-closed' }
      if (room.host?.memberId === memberId) {
        if (!roomMemberAccountAuthorized(room.host, account)) return { ok: false, status: 403, error: 'forbidden' }
        const member = {
          ...room.host,
          activePlugins,
          lastSeenAt: now,
          ...presencePatch(room.host),
        }
        return { ok: true, member, role: 'dm', next: { ...room, host: member, updatedAt: now } }
      }
      if (!roomHostIsOnline(room, now)) return { ok: false, status: 409, error: 'room-offline' }
      const players = Array.isArray(room.players) ? room.players : []
      const member = players.find((player) => player.memberId === memberId)
      if (!member) return { ok: false, status: 404, error: 'member-not-found' }
      if (!roomMemberAccountAuthorized(member, account)) return { ok: false, status: 403, error: 'forbidden' }
      if (roomPlayerPresence(member, now) === 'removed') return { ok: false, status: 403, error: 'member-removed' }
      const memberRole = member.role === 'spectator' ? 'spectator' : 'player'
      const assign = memberRole === 'spectator' ? assignRoomSpectator : assignRoomPlayer
      const resumed = assign(room, {
        memberId: member.memberId,
        accountId: member.accountId,
        clientId: member.clientId,
        displayName: member.displayName,
        activePlugins,
      }, now)
      if (!resumed.ok) return resumed
      const refreshed = {
        ...resumed.member,
        ...presencePatch(member),
      }
      return {
        ok: true,
        member: refreshed,
        role: memberRole,
        next: {
          ...resumed.next,
          players: resumed.next.players.map((player) => player.memberId === refreshed.memberId ? refreshed : player),
        },
      }
    })
    writeJson(res, 200, roomMemberResponse(result.room, result.member, result.role))
    return true
  }

  const leaveResult = await mutateLobbyRoom(ctx, roomId, (room) => {
    const now = Date.now()
    if (room.host?.memberId === memberId) {
      if (!roomMemberAccountAuthorized(room.host, account)) return { ok: false, status: 403, error: 'forbidden' }
      const ephemeralStoragePaths = roomEphemeralPluginStoragePaths(ctx, roomId, room)
      const withoutEphemeral = withoutRoomEphemeralPlugins(room)
      return {
        ok: true,
        ephemeralStoragePaths,
        next: {
          ...withoutEphemeral,
          closedAt: now,
          updatedAt: now,
          host: { ...room.host, lastSeenAt: 0 },
        },
      }
    }
    const players = Array.isArray(room.players) ? room.players : []
    if (!players.some((player) => player.memberId === memberId)) {
      return { ok: false, status: 404, error: 'member-not-found' }
    }
    const leaving = players.find((player) => player.memberId === memberId)
    if (!roomMemberAccountAuthorized(leaving, account)) return { ok: false, status: 403, error: 'forbidden' }
    return {
      ok: true,
      // 离开只结束当前在线状态，保留房间成员身份供同一浏览器恢复角色归属。
      // DM“踢出”仍会彻底删除成员记录，因此不会绕过锁房或踢人操作。
      next: {
        ...room,
        players: players.map((player) => player.memberId === memberId
          ? { ...player, lastSeenAt: 0, leftAt: now }
          : player),
        updatedAt: now,
      },
    }
  })
  await removeRoomEphemeralPluginStorage(leaveResult.ephemeralStoragePaths ?? [])
  writeJson(res, 200, { ok: true })
  return true
}

function addEventClient(ctx, channel, res, viewer) {
  const storageKey = eventStorageKey(ctx, channel)
  const clients = ctx.eventClients.get(storageKey) ?? new Set()
  res._starsEventViewer = viewer
  clients.add(res)
  ctx.eventClients.set(storageKey, clients)
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    // no-transform + X-Accel-Buffering keep room invalidations streaming through
    // reverse proxies instead of being released in a delayed batch.
    'Cache-Control': 'no-store, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.flushHeaders?.()
  res.write(`event: ready\ndata: ${JSON.stringify({
    channel,
    streamId: ctx.serverInstanceId ?? 'legacy-stream',
    sequence: ctx.eventSequences?.get(ctx.roomId ?? 'default') ?? 0,
  })}\n\n`)
  // 只回放最近 EVENT_REPLAY_LIMIT 条，而非整 backlog。
  const backlog = replaySlice(ctx.eventBacklog.get(storageKey) ?? [])
  for (const payload of backlog) {
    const projected = projectEventPayloadForViewer(channel, payload, viewer)
    if (projected !== undefined) res.write(`event: message\ndata: ${JSON.stringify(projected)}\n\n`)
  }
  const heartbeat = setInterval(() => {
    if (res.destroyed || res.writableEnded) return
    res.write(`: heartbeat ${Date.now()}\n\n`)
  }, 15_000)
  heartbeat.unref?.()
  let removed = false
  return () => {
    if (removed) return
    removed = true
    clearInterval(heartbeat)
    delete res._starsEventViewer
    clients.delete(res)
    if (clients.size === 0) ctx.eventClients.delete(storageKey)
  }
}

function publishEventToChannel(ctx, channel, payload) {
  const storageKey = eventStorageKey(ctx, channel)
  const backlog = pushBacklog(ctx.eventBacklog.get(storageKey) ?? [], payload)
  // LRU touch：delete+set 把该 channel 移到 Map 末尾，使「活跃 channel」始终最新、最后才被 cap 淘汰。
  ctx.eventBacklog.delete(storageKey)
  ctx.eventBacklog.set(storageKey, backlog)
  // channel 总数封顶；有活跃订阅者的 channel 受保护。
  capEventChannels(ctx.eventBacklog, EVENT_CHANNEL_LIMIT, new Set(ctx.eventClients.keys()))
  const clients = ctx.eventClients.get(storageKey)
  if (!clients) return
  for (const client of clients) {
    const projected = projectEventPayloadForViewer(channel, payload, client._starsEventViewer)
    if (projected !== undefined) client.write(`event: message\ndata: ${JSON.stringify(projected)}\n\n`)
  }
}

function publishEvent(ctx, channel, payload) {
  publishEventToChannel(ctx, channel, payload)
  if (channel !== '_all') {
    publishEventToChannel(ctx, '_all', {
      channel,
      payload,
      sequence: nextRoomEventSequence(ctx),
      streamId: ctx.serverInstanceId ?? 'legacy-stream',
      emittedAt: Date.now(),
    })
  }
}

async function handleCampaignApi(req, res, parsed, ctx) {
  if (!parsed.pathname.startsWith('/api/campaign/')) return false
  await requireCampaignDm(ctx, req)

  if (parsed.pathname === '/api/campaign/export' && req.method === 'GET') {
    const bundle = await buildCampaignBundle(ctx, { kind: 'export', includeAssets: true })
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="dndstars5e-${ctx.roomId ?? 'campaign'}-${bundle.exportedAt}.json"`,
      'Cache-Control': 'no-store',
    })
    res.end(JSON.stringify(bundle))
    return true
  }

  if (parsed.pathname === '/api/campaign/import' && req.method === 'PUT') {
    const bytes = await readBody(req, CAMPAIGN_IMPORT_MAX_BYTES)
    let bundle
    try {
      bundle = JSON.parse(bytes.toString('utf8'))
    } catch {
      throw new RoomProtocolError(400, 'invalid-json')
    }
    writeJson(res, 200, await restoreCampaignBundle(ctx, bundle))
    return true
  }

  if (parsed.pathname === '/api/campaign/snapshots' && req.method === 'GET') {
    let entries = []
    try {
      entries = await readdir(snapshotRoot(ctx))
    } catch {
      writeJson(res, 200, { snapshots: [], limit: CAMPAIGN_SNAPSHOT_LIMIT })
      return true
    }
    const snapshots = []
    for (const fileName of entries.filter((entry) => entry.endsWith('.json'))) {
      try {
        const bundle = JSON.parse(await readFile(path.join(snapshotRoot(ctx), fileName), 'utf8'))
        snapshots.push({
          id: bundle.snapshotId ?? fileName.slice(0, -5),
          createdAt: bundle.exportedAt,
          kind: bundle.snapshotKind ?? 'manual',
          stateCount: Object.keys(bundle.states ?? {}).length,
        })
      } catch {
        // A broken snapshot must not hide other recovery points.
      }
    }
    snapshots.sort((left, right) => right.createdAt - left.createdAt)
    writeJson(res, 200, { snapshots, limit: CAMPAIGN_SNAPSHOT_LIMIT })
    return true
  }

  if (parsed.pathname === '/api/campaign/snapshots' && req.method === 'POST') {
    writeJson(res, 201, await writeCampaignSnapshot(ctx, 'manual'))
    return true
  }

  const restoreMatch = parsed.pathname.match(/^\/api\/campaign\/snapshots\/([a-zA-Z0-9_-]+)\/restore$/)
  if (restoreMatch && req.method === 'POST') {
    const id = safeName(restoreMatch[1])
    let bundle
    try {
      bundle = JSON.parse(await readFile(path.join(snapshotRoot(ctx), `${id}.json`), 'utf8'))
    } catch {
      throw new RoomProtocolError(404, 'snapshot-not-found')
    }
    writeJson(res, 200, await restoreCampaignBundle(ctx, bundle))
    return true
  }

  throw new RoomProtocolError(405, 'method-not-allowed')
}

/**
 * 处理 /api/* 请求。返回 true 表示已处理（含错误响应），false 表示非 /api（调用方走静态回退）。
 * 任何写锁超时（LockTimeoutError，statusCode=503）由内层 try/catch 映射为 503 fail-closed。
 */
export async function handleSharedApi(req, res, parsed, ctx) {
  if (!parsed.pathname.startsWith('/api/')) return false
  applySecurityHeaders(res)
  if (!applyCors(req, res)) {
    writeJson(res, 403, { error: 'origin-not-allowed' })
    return true
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return true
  }

  const publicSystemRoute = sharedPublicSystemRoute({
    pathname: parsed.pathname,
    method: req.method,
    rulesetId: DND5E_2014_RULESET_ID,
    protocolVersion: SHARED_PROTOCOL_VERSION,
    minimumClientProtocol: SHARED_MIN_CLIENT_PROTOCOL,
    buildId: ctx.serverBuildId ?? process.env.STARS_BUILD_ID ?? 'development',
    startedAt: ctx.serverStartedAt ?? PROCESS_STARTED_AT,
    now: Date.now(),
  })
  if (publicSystemRoute) {
    writeJson(res, publicSystemRoute.status, publicSystemRoute.body)
    return true
  }

  try {
    if (await handleMarketplaceCommerceApi(req, res, parsed, ctx)) return true
    if (await handlePluginCatalogApi(req, res, parsed, ctx)) return true
    if (await handleAccountApi(req, res, parsed, ctx)) return true
    if (await handleRoomLobbyApi(req, res, parsed, ctx)) return true
  } catch (error) {
    const status = Number(error?.statusCode) || 500
    writeJson(res, status, { error: error?.code ?? String(error?.message ?? error) })
    return true
  }

  const rootContext = ctx
  const roomId = normalizeRoomId(parsed.searchParams.get('room'))
  if (productionSecurityEnabled() && roomId === 'default') {
    writeJson(res, 403, { error: 'room-session-required' })
    return true
  }
  if (!ctx.rateLimits) ctx.rateLimits = new Map()
  ctx = scopedContext(ctx, roomId)
  const access = authorizeAccessToken(extractAccessToken(req, parsed))
  if (!access.ok) {
    res.writeHead(access.status, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: 'unauthorized' }))
    return true
  }
  ctx = { ...ctx, accessRole: access.role }
  let authenticatedRoomMember = null
  let authenticatedRoom = null
  if ((ctx.roomId ?? 'default') !== 'default') {
    try {
      const room = await readRoomForCampaign(ctx)
      authenticatedRoom = room
      if (room.closedAt) {
        writeJson(res, 409, { error: 'room-closed' })
        return true
      }
      const requestMemberId = req?.headers?.['x-stars-member'] ?? parsed.searchParams.get('member')
      const requestRoomToken = req?.headers?.['x-stars-room-token'] ?? parsed.searchParams.get('roomToken')
      authenticatedRoomMember = lobbyRoomMember(room, requestMemberId)
      if (!authenticatedRoomMember || !roomMemberSessionAuthorized(authenticatedRoomMember, requestRoomToken)) {
        writeJson(res, 403, { error: 'forbidden' })
        return true
      }
      if (authenticatedRoomMember !== room.host && roomPlayerPresence(authenticatedRoomMember) === 'removed') {
        writeJson(res, 403, { error: 'member-removed' })
        return true
      }
      if (authenticatedRoomMember === room?.host) ctx = { ...ctx, accessRole: 'dm' }
      else if (authenticatedRoomMember?.role === 'spectator') ctx = { ...ctx, accessRole: 'spectator' }
      else if (authenticatedRoomMember) ctx = { ...ctx, accessRole: 'player' }
    } catch {
      writeJson(res, 403, { error: 'forbidden' })
      return true
    }
  }
  if (authenticatedRoom?.campaignId) {
    const normalizedCampaign = normalizeCampaignId(authenticatedRoom.campaignId)
    const normalizedOwner = normalizeAccountId(authenticatedRoom.campaignOwnerAccountId)
    if (
      normalizedCampaign.length !== 12 ||
      normalizedCampaign !== authenticatedRoom.campaignId ||
      normalizedOwner.length !== 12 ||
      normalizedOwner !== authenticatedRoom.campaignOwnerAccountId
    ) {
      writeJson(res, 403, { error: 'forbidden' })
      return true
    }
    const accessRole = ctx.accessRole
    ctx = {
      ...campaignScopedContext(
        rootContext,
        roomId,
        authenticatedRoom.campaignId,
        authenticatedRoom.campaignOwnerAccountId,
      ),
      accessRole,
    }
  }
  if (ctx.accessRole === 'player') {
    const stateName = parsed.pathname.match(/^\/api\/state\/([a-zA-Z0-9_-]+)$/)?.[1]
    const playerMayWriteState = stateName && PLAYER_WRITABLE_STATE.has(safeName(stateName))
    const forbidden =
      req.method === 'DELETE' ||
      (req.method === 'PUT' && parsed.pathname.startsWith('/api/images/')) ||
      (req.method === 'PUT' && stateName && !playerMayWriteState)
    if (forbidden) {
      res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ error: 'forbidden' }))
      return true
    }
  }
  // Spectators may read the same server-projected resources as players, but
  // cannot mutate state, images, event channels, combat actions, or journals.
  if (ctx.accessRole === 'spectator' && req.method !== 'GET') {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: 'forbidden' }))
    return true
  }
  if (
    req.method !== 'GET' &&
    (parsed.pathname.startsWith('/api/state/') || parsed.pathname.startsWith('/api/events/') || parsed.pathname.startsWith('/api/images/')) &&
    ((ctx.roomId ?? 'default') !== 'default' || typeof req?.headers?.origin === 'string') &&
    !browserProtocolIsCurrent(req)
  ) {
    writeJson(res, 426, {
      error: 'client-protocol-outdated',
      protocolVersion: SHARED_PROTOCOL_VERSION,
    })
    return true
  }
  if (req.method !== 'GET') {
    const buckets = ctx.rateLimits
    const ip = req.socket?.remoteAddress ?? 'local'
    const limit = Math.max(10, Number(process.env.STARS_RATE_LIMIT) || 1200)
    const rate = consumeRateLimit(buckets, `${roomId}:${ip}`, Date.now(), limit)
    if (!rate.ok) {
      res.writeHead(429, {
        'Content-Type': 'application/json; charset=utf-8',
        'Retry-After': String(Math.ceil(rate.retryAfterMs / 1000)),
      })
      res.end(JSON.stringify({ error: 'rate-limit' }))
      return true
    }
  }

  try {
    if (await handleCampaignApi(req, res, parsed, ctx)) return true

    const authenticatedSystemRoute = sharedAuthenticatedSystemRoute({
      pathname: parsed.pathname,
      method: req.method,
      now: Date.now(),
    })
    if (authenticatedSystemRoute) {
      writeJson(res, authenticatedSystemRoute.status, authenticatedSystemRoute.body)
      return true
    }

    if (parsed.pathname === '/api/dm/undo') {
      if (!authenticatedRoomMember || ctx.accessRole !== 'dm') {
        writeJson(res, 403, { error: 'dm-authority-required' })
        return true
      }
      if (req.method === 'GET') {
        const journal = await readDmUndoJournal(ctx)
        writeJson(res, 200, {
          schemaVersion: DM_UNDO_SCHEMA_VERSION,
          transactions: journal.transactions
            .slice(-30)
            .reverse()
            .map(dmUndoPublicTransaction),
        })
        return true
      }
      if (req.method === 'POST') {
        const payload = await readJsonRequest(req)
        const requestedTransactionId = payload?.transactionId == null
          ? ''
          : normalizedLabel(payload.transactionId, 160)
        if (
          payload?.transactionId != null &&
          (!requestedTransactionId || !/^[a-zA-Z0-9:_-]+$/.test(requestedTransactionId))
        ) {
          writeJson(res, 400, { error: 'invalid-dm-undo-transaction' })
          return true
        }
        const result = await applyDmAuthoritativeUndo(
          ctx,
          requestedTransactionId,
          authenticatedRoomMember.memberId,
        )
        const now = Date.now()
        for (const restored of result.restored) {
          publishEvent(ctx, SHARED_STATE_CHANGED_CHANNEL, {
            id: `dm-undo:${result.transaction.transactionId}:${restored.resource}:${now}`,
            name: restored.resource,
            updatedAt: now,
          })
        }
        writeJson(res, 200, {
          ok: true,
          transaction: dmUndoPublicTransaction(result.transaction),
          restored: result.restored,
        })
        return true
      }
      writeJson(res, 405, { error: 'method-not-allowed' })
      return true
    }

    const eventMatch = parsed.pathname.match(/^\/api\/events\/([a-zA-Z0-9_-]+)$/)
    if (eventMatch) {
      const channel = safeName(eventMatch[1])
      const viewer = {
        role: ctx.accessRole,
        memberId: authenticatedRoomMember?.memberId,
      }
      if (req.method === 'DELETE') {
        if (channel !== '_all' && !EVENT_CHANNEL_POLICIES[channel]) {
          writeJson(res, 404, { error: 'forbidden' })
          return true
        }
        if (channel === '_all') {
          const prefix = `${roomId}::`
          for (const key of [...ctx.eventBacklog.keys()]) {
            if (key.startsWith(prefix)) ctx.eventBacklog.delete(key)
          }
        } else ctx.eventBacklog.delete(eventStorageKey(ctx, channel))
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end('{"ok":true}')
        return true
      }
      if (req.method === 'GET') {
        if (!eventChannelOperationAllowed(channel, 'subscribe', viewer.role)) {
          writeJson(res, EVENT_CHANNEL_POLICIES[channel] || channel === '_all' ? 403 : 404, { error: 'forbidden' })
          return true
        }
        const remove = addEventClient(ctx, channel, res, viewer)
        req.on('close', remove)
        return true
      }
      if (req.method === 'POST') {
        if (!eventChannelOperationAllowed(channel, 'publish', viewer.role)) {
          writeJson(res, EVENT_CHANNEL_POLICIES[channel] ? 403 : 404, { error: 'forbidden' })
          return true
        }
        const body = await readBody(req)
        let payload = JSON.parse(body.toString('utf8'))
        if (channel === MAP_TABLETOP_CHANNEL) {
          const normalized = normalizeMapTabletopEvent(payload, {
            role: ctx.accessRole === 'open' ? 'dm' : ctx.accessRole,
            memberId: authenticatedRoomMember?.memberId,
            displayName: authenticatedRoomMember?.displayName,
          })
          if (!normalized.ok) {
            writeJson(res, normalized.status, { error: normalized.error })
            return true
          }
          payload = normalized.event
        }
        if (channel === COMBAT_PRESENTATION_CHANNEL) {
          const normalized = normalizeCombatPresentationEvent(payload, {
            role: ctx.accessRole === 'open' ? 'dm' : ctx.accessRole,
            memberId: authenticatedRoomMember?.memberId,
            displayName: authenticatedRoomMember?.displayName,
          })
          if (!normalized.ok) {
            writeJson(res, normalized.status, { error: normalized.error })
            return true
          }
          payload = normalized.event
        }
        payload = stampClientEvent(channel, payload, authenticatedRoomMember)
        publishEvent(ctx, channel, payload)
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end('{"ok":true}')
        return true
      }
    }

    if (parsed.pathname === '/api/state/combat-log/entry' && req.method === 'PATCH') {
      await mkdir(ctx.stateRoot, { recursive: true })
      let mutation
      try {
        mutation = JSON.parse((await readBody(req)).toString('utf8'))
      } catch {
        writeJson(res, 400, { error: 'invalid-json' })
        return true
      }
      const now = Date.now()
      const result = await atomicMutateJsonStateLocked(
        path.join(ctx.stateRoot, 'combat-log.json'),
        (state) => mutateCombatLogState(state, mutation, now),
      )
      if (!result?.ok) {
        writeJson(res, result?.status ?? 400, { error: result?.error ?? 'mutation-failed' })
        return true
      }
      publishEvent(ctx, SHARED_STATE_CHANGED_CHANNEL, {
        id: `combat-log:${now}:${Math.random().toString(36).slice(2)}`,
        name: 'combat-log',
        updatedAt: now,
      })
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Stars-State-Revision': String(sharedStateRevision(result.next)),
      })
      res.end(JSON.stringify(result.next))
      return true
    }

    if (parsed.pathname === '/api/state/room-chat/message' && req.method === 'PATCH') {
      if (!authenticatedRoomMember) {
        writeJson(res, 403, { error: 'forbidden' })
        return true
      }
      const chatRate = consumeRateLimit(
        ctx.rateLimits,
        `room-chat:${roomId}:${authenticatedRoomMember.memberId}`,
        Date.now(),
        Math.max(5, Number(process.env.STARS_CHAT_RATE_LIMIT) || 20),
        10_000,
      )
      if (!chatRate.ok) {
        writeJson(res, 429, {
          error: 'chat-rate-limit',
          retryAfterMs: chatRate.retryAfterMs,
        })
        return true
      }
      await mkdir(ctx.stateRoot, { recursive: true })
      const body = await readBody(req)
      const mutation = JSON.parse(body.toString('utf8'))
      const room = await readRoomForCampaign(ctx)
      const readState = async (name) => {
        try {
          return JSON.parse(await readFile(path.join(ctx.stateRoot, `${name}.json`), 'utf8'))
        } catch {
          return null
        }
      }
      const [characters, maps] = await Promise.all([readState('characters'), readState('maps')])
      const now = Date.now()
      const filePath = path.join(ctx.stateRoot, 'room-chat.json')
      const result = await atomicMutateJsonStateLocked(filePath, (state) =>
        mutateRoomChatState(state, mutation, now, authenticatedRoomMember, {
          host: room.host,
          playerMemberIds: roomCommunicationPlayerMemberIds(room),
          characters,
          maps,
        }),
      )
      if (!result?.ok) {
        writeJson(res, result?.status ?? 400, { error: result?.error ?? 'mutation-failed' })
        return true
      }
      publishEvent(ctx, SHARED_STATE_CHANGED_CHANNEL, {
        id: `room-chat:${now}:${Math.random().toString(36).slice(2)}`,
        name: 'room-chat',
        updatedAt: now,
      })
      if (result.message?.roll && result.message.channel !== 'dm-private') {
        const combat = await readState('combat')
        const logPath = path.join(ctx.stateRoot, 'combat-log.json')
        const logResult = await atomicMutateJsonStateLocked(logPath, (state) => {
          const entries = Array.isArray(state?.entries) ? state.entries : []
          const nextId = Math.max(0, ...entries.map((entry) => Number(entry?.id) || 0)) + 1
          const roll = result.message.roll
          const modifierText = roll.modifier === 0 ? '' : roll.modifier > 0 ? ` + ${roll.modifier}` : ` - ${Math.abs(roll.modifier)}`
          return {
            ok: true,
            changed: true,
            next: {
              mapId: boundedText(state?.mapId || combat?.mapId || maps?.selectedId, 160),
              entries: [...entries, {
                id: nextId,
                round: Number.isInteger(combat?.round) ? combat.round : 0,
                text: `${result.message.persona.name} 掷骰 ${roll.expression}：${roll.total}`,
                kind: 'system',
                time: new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(now),
                details: [`骰面：${roll.values.join(' + ')}${modifierText}`, ...(roll.label ? [`说明：${roll.label}`] : [])],
              }].slice(-1_000),
              updatedAt: now,
            },
          }
        })
        if (logResult?.changed) {
          publishEvent(ctx, SHARED_STATE_CHANGED_CHANNEL, {
            id: `combat-log:${now}:${Math.random().toString(36).slice(2)}`,
            name: 'combat-log',
            updatedAt: now,
          })
        }
      }
      const projected = projectRoomChatForMember(
        result.next,
        authenticatedRoomMember.memberId,
        authenticatedRoomMember.memberId === room.host?.memberId,
      )
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Stars-State-Revision': String(sharedStateRevision(result.next)),
      })
      res.end(JSON.stringify(projected))
      return true
    }

    if (parsed.pathname === '/api/state/room-journal/mutation' && req.method === 'PATCH') {
      if (!authenticatedRoomMember) {
        writeJson(res, 403, { error: 'forbidden' })
        return true
      }
      await mkdir(ctx.stateRoot, { recursive: true })
      await maybeWriteAutoCampaignSnapshot(ctx)
      const body = await readBody(req)
      const mutation = JSON.parse(body.toString('utf8'))
      if (mutation?.operation === 'add-handout' && mutation?.imageId) {
        const imageId = boundedText(mutation.imageId, 160)
        if (!/^[a-zA-Z0-9_-]+$/.test(imageId)) {
          writeJson(res, 400, { error: 'invalid-handout-image' })
          return true
        }
        try {
          const metadata = JSON.parse(await readFile(path.join(ctx.imageRoot, `${imageId}.json`), 'utf8'))
          if (metadata?.purpose !== 'handout') throw new Error('wrong-purpose')
        } catch {
          writeJson(res, 400, { error: 'invalid-handout-image' })
          return true
        }
      }
      const room = await readRoomForCampaign(ctx)
      const now = Date.now()
      const filePath = path.join(ctx.stateRoot, 'room-journal.json')
      const result = await atomicMutateJsonStateLocked(filePath, (state) =>
        mutateRoomJournalState(state, mutation, now, authenticatedRoomMember, {
          host: room.host,
          playerMemberIds: roomCommunicationPlayerMemberIds(room),
        }),
      )
      if (!result?.ok) {
        writeJson(res, result?.status ?? 400, { error: result?.error ?? 'mutation-failed' })
        return true
      }
      publishEvent(ctx, SHARED_STATE_CHANGED_CHANNEL, {
        id: `room-journal:${now}:${Math.random().toString(36).slice(2)}`,
        name: 'room-journal',
        updatedAt: now,
      })
      const projected = projectRoomJournalForMember(
        result.next,
        authenticatedRoomMember.memberId,
        authenticatedRoomMember.memberId === room.host?.memberId,
      )
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Stars-State-Revision': String(sharedStateRevision(result.next)),
      })
      res.end(JSON.stringify(projected))
      return true
    }

    if (parsed.pathname === '/api/state/group-ability-checks/mutation' && req.method === 'PATCH') {
      if (!authenticatedRoomMember) {
        writeJson(res, 403, { error: 'forbidden' })
        return true
      }
      await mkdir(ctx.stateRoot, { recursive: true })
      const body = await readBody(req)
      const mutation = JSON.parse(body.toString('utf8'))
      const room = await readRoomForCampaign(ctx)
      let characters = null
      try {
        characters = JSON.parse(await readFile(path.join(ctx.stateRoot, 'characters.json'), 'utf8'))
      } catch {
        // Participant validation fails closed when the authoritative character state is unavailable.
      }
      const now = Date.now()
      const filePath = path.join(ctx.stateRoot, 'group-ability-checks.json')
      const result = await atomicMutateJsonStateLocked(filePath, (state) =>
        mutateGroupAbilityChecksState(state, mutation, now, authenticatedRoomMember, {
          host: room.host,
          players: Array.isArray(room.players) ? room.players : [],
          characters,
        }),
      )
      if (!result?.ok) {
        writeJson(res, result?.status ?? 400, { error: result?.error ?? 'mutation-failed' })
        return true
      }
      if (result.changed) {
        publishEvent(ctx, SHARED_STATE_CHANGED_CHANNEL, {
          id: `group-ability-checks:${now}:${Math.random().toString(36).slice(2)}`,
          name: 'group-ability-checks',
          updatedAt: now,
        })
      }
      const projected = projectGroupAbilityChecksForMember(
        result.next,
        authenticatedRoomMember.memberId,
        authenticatedRoomMember.memberId === room.host?.memberId,
      )
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Stars-State-Revision': String(sharedStateRevision(result.next)),
      })
      res.end(JSON.stringify(projected))
      return true
    }

    if (parsed.pathname === '/api/state/campaign-time/mutation' && req.method === 'PATCH') {
      if (!authenticatedRoomMember) {
        writeJson(res, 403, { error: 'forbidden' })
        return true
      }
      await mkdir(ctx.stateRoot, { recursive: true })
      const body = await readBody(req)
      let mutation
      try {
        mutation = JSON.parse(body.toString('utf8'))
      } catch {
        writeJson(res, 400, { error: 'invalid-json' })
        return true
      }
      const room = await readRoomForCampaign(ctx)
      const now = Date.now()
      const filePath = path.join(ctx.stateRoot, 'campaign-time.json')
      const result = await atomicMutateJsonStateLocked(filePath, (state) =>
        mutateCampaignTimeState(state, mutation, now, authenticatedRoomMember, { host: room?.host }),
      )
      if (!result?.ok) {
        writeJson(res, result?.status ?? 400, { error: result?.error ?? 'mutation-failed' })
        return true
      }
      await recordDmUndoMutation(
        req,
        ctx,
        authenticatedRoomMember,
        'campaign-time',
        result,
        '调整战役时间',
      )
      if (result.changed) {
        for (const name of ['campaign-time', 'maps', 'map-geometry']) {
          publishEvent(ctx, SHARED_STATE_CHANGED_CHANNEL, {
            id: `${name}:${now}:${Math.random().toString(36).slice(2)}`,
            name,
            updatedAt: now,
          })
        }
      }
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Stars-State-Revision': String(sharedStateRevision(result.next)),
      })
      res.end(JSON.stringify(result.next))
      return true
    }

    if (parsed.pathname === '/api/state/scene-audio/playback' && req.method === 'PATCH') {
      if (!authenticatedRoomMember || ctx.accessRole !== 'dm') {
        writeJson(res, 403, { error: 'dm-authority-required' })
        return true
      }
      await mkdir(ctx.stateRoot, { recursive: true })
      await maybeWriteAutoCampaignSnapshot(ctx)
      const body = await readBody(req)
      let mutation
      try {
        mutation = JSON.parse(body.toString('utf8'))
      } catch {
        writeJson(res, 400, { error: 'invalid-json' })
        return true
      }
      const room = await readRoomForCampaign(ctx)
      let library = null
      try {
        library = JSON.parse(await readFile(path.join(ctx.stateRoot, 'scene-audio-library.json'), 'utf8'))
      } catch {
        // Missing or damaged catalog makes every play request fail closed.
      }
      const now = Date.now()
      const filePath = path.join(ctx.stateRoot, 'scene-audio-playback.json')
      const result = await atomicMutateJsonStateLocked(filePath, (state) =>
        mutateSceneAudioPlaybackState(state, mutation, now, authenticatedRoomMember, { host: room.host, library }),
      )
      if (!result?.ok) {
        writeJson(res, result?.status ?? 400, { error: result?.error ?? 'mutation-failed' })
        return true
      }
      await recordDmUndoMutation(
        req,
        ctx,
        authenticatedRoomMember,
        'scene-audio-playback',
        result,
        '调整场景音频',
      )
      if (result.changed) {
        publishEvent(ctx, SHARED_STATE_CHANGED_CHANNEL, {
          id: `scene-audio-playback:${now}:${Math.random().toString(36).slice(2)}`,
          name: 'scene-audio-playback',
          updatedAt: now,
        })
      }
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Stars-State-Revision': String(sharedStateRevision(result.next)),
      })
      res.end(JSON.stringify(result.next))
      return true
    }

    if (parsed.pathname === '/api/state/combat-interrupts/interrupt' && req.method === 'PATCH') {
      const auth = authenticatedRoomMember
        ? { ok: true }
        : authorizeStateWrite('combat-interrupts', extractSecret(req))
      if (!auth.ok) {
        res.writeHead(auth.status, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ error: 'unauthorized' }))
        return true
      }
      await mkdir(ctx.stateRoot, { recursive: true })
      await maybeWriteAutoCampaignSnapshot(ctx)
      const body = await readBody(req)
      const mutation = JSON.parse(body.toString('utf8'))
      const filePath = path.join(ctx.stateRoot, 'combat-interrupts.json')
      let authorityCharacterIds
      if (ctx.accessRole === 'player') {
        const characters = await readCharactersForProjection(ctx)
        authorityCharacterIds = characters.corrupted || !authenticatedRoomMember
          ? []
          : characters.value.characters
            .filter((character) => characterOwnedByRoomMember(character, authenticatedRoomMember))
            .map((character) => character.id)
      }
      const result = await atomicMutateJsonStateLocked(filePath, (queue) =>
        mutateCombatInterruptQueue(queue, mutation, Date.now(), ctx.accessRole, authorityCharacterIds),
      )
      if (!result?.ok) {
        res.writeHead(result?.status ?? 400, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ error: result?.error ?? 'mutation-failed' }))
        return true
      }
      await recordDmUndoMutation(
        req,
        ctx,
        authenticatedRoomMember,
        'combat-interrupts',
        result,
        '处理战斗中断',
      )
      if (result.changed) {
        const updatedAt = result.next.updatedAt
        publishEvent(ctx, SHARED_STATE_CHANGED_CHANNEL, {
          id: `combat-interrupts:${updatedAt}:${Math.random().toString(36).slice(2)}`,
          name: 'combat-interrupts',
          updatedAt,
        })
      }
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Stars-State-Revision': String(sharedStateRevision(result.next)),
      })
      res.end(JSON.stringify(result.next))
      return true
    }

    const stateMatch = parsed.pathname.match(/^\/api\/state\/([a-zA-Z0-9_-]+)$/)
    if (stateMatch) {
      const name = safeName(stateMatch[1])
      const filePath = path.join(ctx.stateRoot, `${name}.json`)
      if (req.method === 'GET') {
        let sourcePath = filePath
        let data
        try {
          try {
            data = await readFile(filePath, 'utf8')
          } catch {
            sourcePath = path.join(ctx.legacyStateRoot, `${name}.json`)
            data = await readFile(sourcePath, 'utf8')
          }
        } catch {
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end('null')
          return true
        }
        let value
        try {
          value = normalizeDedicatedDnd5eSharedState(name, JSON.parse(data))
        } catch {
          const quarantineId = await quarantineSharedState(ctx, name, data, 'invalid-json')
          await rm(sourcePath, { force: true }).catch(() => {})
          writeJson(res, 422, { error: 'state-corrupted', name, quarantineId })
          return true
        }
        if (value?._deleted === true) {
          const revision = sharedStateRevision(value)
          res.writeHead(404, {
            'Content-Type': 'application/json; charset=utf-8',
            'X-Stars-State-Revision': String(revision),
          })
          res.end('null')
          return true
        }
        const validation = validateSharedStateShape(name, value)
        if (!validation.ok) {
          const quarantineId = await quarantineSharedState(ctx, name, value, validation.reason)
          await rm(sourcePath, { force: true }).catch(() => {})
          writeJson(res, 422, { error: 'state-corrupted', name, reason: validation.reason, quarantineId })
          return true
        }
        const storedRevision = sharedStateRevision(value)
        let roomMember = authenticatedRoomMember
        let playerRead = ctx.accessRole === 'player' || ctx.accessRole === 'spectator'
        if ((ctx.roomId ?? 'default') !== 'default' && !roomMember) {
          const room = await readRoomForCampaign(ctx)
          roomMember = lobbyRoomMember(room, req?.headers?.['x-stars-member'] ?? parsed.searchParams.get('member'))
          if (roomMember && roomMember !== room.host) playerRead = true
          if (roomMember === room.host) playerRead = false
        }
        if (playerRead && name === 'map-geometry') {
          const campaignTime = await readCampaignTimeForProjection(ctx)
          value = projectMapGeometryForPlayer(value, req.headers['x-stars-member'], campaignTime.worldMinute)
        }
        if (playerRead && name === 'map-exploration') value = projectMapExplorationForPlayer(value, req.headers['x-stars-member'])
        if (playerRead && name === 'room-chat') value = projectRoomChatForMember(value, roomMember?.memberId ?? '', false)
        if (playerRead && name === 'room-journal') value = projectRoomJournalForMember(value, roomMember?.memberId ?? '', false)
        if (playerRead && name === 'group-ability-checks') value = projectGroupAbilityChecksForMember(value, roomMember?.memberId ?? '', false)
        if (playerRead && name === 'scene-orchestration') value = projectSceneOrchestrationForPlayer(value)
        if (playerRead && name === 'characters') value = projectCharactersForRoomMember(value, roomMember)
        if (playerRead && name === 'dice') value = projectDiceForRoomMember(value)
        if (playerRead && name === 'dice-events') value = projectDiceEventsForRoomMember(value)
        if (playerRead && name === 'combat-interrupts') {
          const characters = await readCharactersForProjection(ctx)
          value = projectCombatInterruptsForRoomMember(
            value,
            roomMember,
            characters.corrupted ? null : characters.value,
            ctx.accessRole === 'spectator',
          )
        }
        if (playerRead && name === 'custom-monsters') value = projectCustomMonstersForRoomMember(value)
        if (playerRead && ['player-action', 'player-action-requests', 'player-action-processed', 'player-action-ack'].includes(name)) {
          value = projectPlayerActionResourceForRoomMember(name, value, roomMember)
        }
        if (playerRead && name === 'maps') {
          const geometry = await readMapGeometryForProjection(ctx)
          const fog = await readMapFogForProjection(ctx)
          const characters = await readCharactersForProjection(ctx)
          const campaignTime = await readCampaignTimeForProjection(ctx)
          if (geometry.corrupted || fog.corrupted || characters.corrupted || campaignTime.corrupted) {
            value = {
              ...value,
              maps: (value.maps ?? []).map((map) => ({
                ...map,
                tokens: (map.tokens ?? []).filter((token) => token?.type === 'player' || token?.visibilityMode === 'always'),
              })),
            }
          } else {
            value = projectMapsForPlayer(
              value,
              geometry.value,
              roomMember?.activeCharacterId ?? null,
              characters.value,
              roomMember,
              fog.value,
              campaignTime.worldMinute,
            )
          }
        }
        if (value == null) {
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'X-Stars-State-Revision': String(storedRevision),
          })
          res.end('null')
          return true
        }
        try {
          const revision = sharedStateRevision(value)
          if (!plainObject(value._sync)) {
            value = {
              ...value,
              _sync: {
                schemaVersion: SHARED_STATE_SCHEMA_VERSION,
                revision,
                writerId: 'legacy-state',
                writtenAt: Number(value.updatedAt) || 0,
              },
            }
          }
          data = JSON.stringify(value)
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'X-Stars-State-Revision': String(revision),
          })
          res.end(data)
        } catch {
          writeJson(res, 500, { error: 'state-serialization-failed', name })
        }
        return true
      }
      if (req.method === 'PUT') {
        if (name === 'scene-audio-playback') {
          writeJson(res, 405, { error: 'authoritative-mutation-required', name })
          return true
        }
        if (!stateResourceWriteAllowedForRole(name, ctx.accessRole)) {
          writeJson(res, 403, { error: 'dm-authority-required', name })
          return true
        }
        const auth = authenticatedRoomMember
          ? { ok: true }
          : authorizeStateWrite(name, extractSecret(req))
        if (!auth.ok) {
          res.writeHead(auth.status, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ error: 'unauthorized' }))
          return true
        }
        await mkdir(ctx.stateRoot, { recursive: true })
        const body = await readBody(req)
        let parsedBody
        try {
          parsedBody = normalizeDedicatedDnd5eSharedState(name, JSON.parse(body.toString('utf8')))
        } catch {
          const quarantineId = await quarantineSharedState(ctx, name, body.toString('utf8'), 'invalid-json-upload')
          writeJson(res, 400, { error: 'invalid-json', name, quarantineId })
          return true
        }
        if (ctx.accessRole === 'player' && authenticatedRoomMember) {
          parsedBody = stampPlayerActionStateForRoomMember(name, parsedBody, authenticatedRoomMember)
        }
        if (parsedBody?._deleted === true) {
          writeJson(res, 422, { error: 'reserved-state-marker', name })
          return true
        }
        const validation = validateSharedStateShape(name, parsedBody)
        if (!validation.ok) {
          const quarantineId = await quarantineSharedState(ctx, name, parsedBody, validation.reason)
          writeJson(res, 422, { error: 'invalid-state', name, reason: validation.reason, quarantineId })
          return true
        }
        if (name === 'scene-audio-library') {
          let backingFilesValid = true
          for (const asset of parsedBody.assets) {
            try {
              const [metadata, fileInfo] = await Promise.all([
                readFile(path.join(ctx.imageRoot, `${asset.id}.json`), 'utf8').then(JSON.parse),
                stat(path.join(ctx.imageRoot, asset.id)),
              ])
              if (metadata?.purpose !== 'scene-audio' || metadata?.type !== asset.mimeType || fileInfo.size !== asset.sizeBytes) {
                backingFilesValid = false
                break
              }
            } catch {
              backingFilesValid = false
              break
            }
          }
          if (!backingFilesValid) {
            writeJson(res, 422, { error: 'invalid-state', name, reason: 'invalid-scene-audio-backing-file' })
            return true
          }
        }
        await maybeWriteAutoCampaignSnapshot(ctx)
        const expectedHeader = req?.headers?.['x-stars-expected-revision']
        if ((ctx.roomId ?? 'default') !== 'default' && (expectedHeader == null || expectedHeader === '')) {
          writeJson(res, 428, { error: 'expected-revision-required', name })
          return true
        }
        const expectedRevision = expectedHeader == null || expectedHeader === '' ? null : Number(expectedHeader)
        if (expectedRevision != null && (!Number.isInteger(expectedRevision) || expectedRevision < 0)) {
          writeJson(res, 400, { error: 'invalid-expected-revision', name })
          return true
        }
        const playerCharacterWrite = name === 'characters' && ctx.accessRole === 'player' && authenticatedRoomMember
        const combatActive = playerCharacterWrite ? await sharedCombatIsActiveForAuthority(ctx) : false
        const writeResult = await atomicWriteJsonStateCasLocked(filePath, parsedBody, {
          expectedRevision,
          writerId: req?.headers?.['x-stars-writer'],
          mergeIncoming: playerCharacterWrite
            ? (current, incoming) => mergePlayerCharactersStateForAuthority(
                current,
                incoming,
                authenticatedRoomMember.memberId,
                { combatActive },
              )
            : undefined,
          validateIncoming: (candidate) => validateSharedStateShape(name, candidate),
        })
        if (writeResult.conflict) {
          res.writeHead(409, {
            'Content-Type': 'application/json; charset=utf-8',
            'X-Stars-State-Revision': String(writeResult.currentRevision),
          })
          res.end(JSON.stringify({
            error: 'state-revision-conflict',
            name,
            expectedRevision,
            currentRevision: writeResult.currentRevision,
          }))
          return true
        }
        if (writeResult.stale) {
          writeJson(res, 200, { ok: true, applied: false, reason: 'stale', revision: writeResult.currentRevision })
          return true
        }
        if (writeResult.invalid) {
          writeJson(res, 422, { error: 'invalid-state', name, reason: writeResult.reason })
          return true
        }
        if (
          ctx.accessRole === 'dm' &&
          authenticatedRoomMember &&
          DM_UNDOABLE_STATE.has(name)
        ) {
          await appendDmUndoChange(ctx, {
            transactionId: dmUndoTransactionId(req),
            label: dmUndoLabel(req, `更新 ${name}`),
            actorMemberId: authenticatedRoomMember.memberId,
            resource: name,
            before: writeResult.current,
            beforeRevision: writeResult.currentRevision,
            afterRevision: writeResult.revision,
            changedAt: writeResult.writtenAt,
          })
        }
        const updatedAt = Number(parsedBody?.updatedAt)
        publishEvent(ctx, SHARED_STATE_CHANGED_CHANNEL, {
          id: `${name}:${Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : Date.now()}:${Math.random().toString(36).slice(2)}`,
          name,
          updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : Date.now(),
        })
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Stars-State-Revision': String(writeResult.revision),
        })
        res.end(JSON.stringify({ ok: true, applied: true, revision: writeResult.revision }))
        return true
      }
      if (req.method === 'DELETE') {
        const auth = authenticatedRoomMember
          ? { ok: true }
          : authorizeStateWrite(name, extractSecret(req))
        if (!auth.ok) {
          writeJson(res, auth.status, { error: 'unauthorized' })
          return true
        }
        await maybeWriteAutoCampaignSnapshot(ctx)
        const expectedHeader = req?.headers?.['x-stars-expected-revision']
        if ((ctx.roomId ?? 'default') !== 'default' && (expectedHeader == null || expectedHeader === '')) {
          writeJson(res, 428, { error: 'expected-revision-required', name })
          return true
        }
        const expectedRevision = expectedHeader == null || expectedHeader === '' ? null : Number(expectedHeader)
        if (expectedRevision != null && (!Number.isInteger(expectedRevision) || expectedRevision < 0)) {
          writeJson(res, 400, { error: 'invalid-expected-revision', name })
          return true
        }
        const deleteResult = await atomicDeleteJsonStateCasLocked(filePath, {
          expectedRevision,
          writerId: req?.headers?.['x-stars-writer'],
        })
        if (deleteResult.conflict) {
          res.writeHead(409, {
            'Content-Type': 'application/json; charset=utf-8',
            'X-Stars-State-Revision': String(deleteResult.currentRevision),
          })
          res.end(JSON.stringify({
            error: 'state-revision-conflict',
            name,
            expectedRevision,
            currentRevision: deleteResult.currentRevision,
          }))
          return true
        }
        if (
          ctx.accessRole === 'dm' &&
          authenticatedRoomMember &&
          DM_UNDOABLE_STATE.has(name)
        ) {
          await appendDmUndoChange(ctx, {
            transactionId: dmUndoTransactionId(req),
            label: dmUndoLabel(req, `删除 ${name}`),
            actorMemberId: authenticatedRoomMember.memberId,
            resource: name,
            before: deleteResult.current,
            beforeRevision: deleteResult.currentRevision,
            afterRevision: deleteResult.revision,
            changedAt: deleteResult.writtenAt,
          })
        }
        await rm(path.join(ctx.legacyStateRoot, `${name}.json`), { force: true })
        const updatedAt = deleteResult.writtenAt
        publishEvent(ctx, SHARED_STATE_CHANGED_CHANNEL, {
          id: `${name}:${updatedAt}:${Math.random().toString(36).slice(2)}`,
          name,
          updatedAt,
          deleted: true,
        })
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Stars-State-Revision': String(deleteResult.revision),
        })
        res.end(JSON.stringify({ ok: true, revision: deleteResult.revision }))
        return true
      }
    }

    const imageMatch = parsed.pathname.match(/^\/api\/images\/([a-zA-Z0-9_-]+)$/)
    if (imageMatch) {
      const id = safeName(imageMatch[1])
      const filePath = path.join(ctx.imageRoot, id)
      const metaPath = path.join(ctx.imageRoot, `${id}.json`)
      if (req.method === 'GET') {
        try {
          let sourcePath = filePath
          let sourceMetaPath = metaPath
          try {
            await readFile(metaPath, 'utf8')
          } catch {
            sourcePath = path.join(ctx.legacyImageRoot, id)
            sourceMetaPath = path.join(ctx.legacyImageRoot, `${id}.json`)
          }
          const meta = JSON.parse(await readFile(sourceMetaPath, 'utf8'))
          if (ctx.accessRole === 'player' || ctx.accessRole === 'spectator') {
            if (meta?.purpose === 'scene-audio') {
              let library = null
              try {
                library = JSON.parse(await readFile(path.join(ctx.stateRoot, 'scene-audio-library.json'), 'utf8'))
              } catch {
                // Missing catalog means the media is not authorized for room playback.
              }
              if (!(Array.isArray(library?.assets) && library.assets.some((asset) => asset?.id === id))) {
                writeJson(res, 403, { error: 'forbidden' })
                return true
              }
            }
            let journal = null
            try {
              journal = JSON.parse(await readFile(path.join(ctx.stateRoot, 'room-journal.json'), 'utf8'))
            } catch {
              // A missing journal means the image is not currently attached to a handout.
            }
            const attachedToHandout = (Array.isArray(journal?.handouts) ? journal.handouts : [])
              .some((handout) => handout?.imageId === id)
            const visible = projectRoomJournalForMember(journal, authenticatedRoomMember?.memberId ?? '', false)
            if (
              (attachedToHandout || meta?.purpose === 'handout') &&
              !visible.handouts.some((handout) => handout?.imageId === id)
            ) {
              writeJson(res, 403, { error: 'forbidden' })
              return true
            }
          }
          res.writeHead(200, { 'Content-Type': meta.type || 'application/octet-stream' })
          createReadStream(sourcePath).pipe(res)
        } catch {
          res.writeHead(404)
          res.end('Not Found')
        }
        return true
      }
      if (req.method === 'PUT') {
        const auth = authenticatedRoomMember
          ? { ok: true }
          : authorizeStateWrite('shared-images', extractSecret(req))
        if (!auth.ok) {
          writeJson(res, auth.status, { error: 'unauthorized' })
          return true
        }
        await mkdir(ctx.imageRoot, { recursive: true })
        await maybeWriteAutoCampaignSnapshot(ctx)
        const body = await readBody(req, IMAGE_MAX_BYTES)
        const requestedPurpose = req.headers['x-stars-image-purpose']
        const purpose = requestedPurpose === 'handout' || requestedPurpose === 'scene-audio' ? requestedPurpose : 'general'
        const contentType = req.headers['content-type'] || 'application/octet-stream'
        if (purpose === 'scene-audio' && !String(contentType).toLowerCase().startsWith('audio/')) {
          writeJson(res, 415, { error: 'invalid-scene-audio-type' })
          return true
        }
        const metaBody = JSON.stringify({ type: contentType, purpose })
        // blob+meta 在同一把锁内原子落盘。
        await atomicWriteImageLocked(filePath, metaPath, body, metaBody)
        // 写后即触发配额 GC（write-trigger，按 mtime 最旧优先淘汰）。
        await enforceImageQuota(ctx.imageRoot)
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end('{"ok":true}')
        return true
      }
      if (req.method === 'DELETE') {
        const auth = authenticatedRoomMember
          ? { ok: true }
          : authorizeStateWrite('shared-images', extractSecret(req))
        if (!auth.ok) {
          writeJson(res, auth.status, { error: 'unauthorized' })
          return true
        }
        await maybeWriteAutoCampaignSnapshot(ctx)
        await rm(filePath, { force: true })
        await rm(metaPath, { force: true })
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end('{"ok":true}')
        return true
      }
    }

    // 未匹配的 /api/* 不回落到静态 index.html（返回 404 JSON）。
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end('{"error":"Not Found"}')
    return true
  } catch (error) {
    const status = Number(error?.statusCode) || 500
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: String(error?.message ?? error) }))
    return true
  }
}

