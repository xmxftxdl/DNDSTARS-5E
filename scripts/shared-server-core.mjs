// 共享服务端硬化核心：原子写锁 / 鉴权 / size cap / backlog cap / 图片配额 /
// safeName 防碰撞 / API-404。两个服务端（vite-server.mjs + static-server.mjs）都从这里
// import 同一份纯逻辑，避免双份漂移；纯函数集中在此以便 src/ 下的 vitest 直接 import .mjs。
import { mkdir, readFile, readdir, rename, rm, stat, utimes, writeFile } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { createHash, randomBytes, randomInt, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import path from 'node:path'

// ── AC3：PUT body 上限 + backlog 回放上限 ────────────────────────────────────
// 单次 PUT 请求体上限（8 MiB）。超过 → 413。图片走单独更宽的上限（见 IMAGE_MAX_BYTES）。
export const STATE_MAX_BYTES = 8 * 1024 * 1024
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
// Browser background tabs can throttle a 5-second interval to roughly one
// minute. Presence therefore needs enough grace to distinguish throttling or a
// brief network hand-off from a genuinely abandoned room. Explicit DM leave
// still closes the room immediately.
export const ROOM_HOST_TTL_MS = Math.max(30_000, Number(process.env.STARS_ROOM_HOST_TTL_MS) || 120_000)
export const ROOM_PLAYER_TTL_MS = Math.max(60_000, Number(process.env.STARS_ROOM_PLAYER_TTL_MS) || 300_000)
export const ROOM_PRESENCE_ONLINE_MS = Math.max(10_000, Number(process.env.STARS_ROOM_PRESENCE_ONLINE_MS) || 20_000)
export const ROOM_PLAYER_SLOTS = Object.freeze(['player1', 'player2', 'player3', 'player4', 'player5', 'player6', 'player7', 'player8'])
export const DND5E_2014_RULESET_ID = 'dnd5e-2014-srd-5.1'
export const SHARED_PROTOCOL_VERSION = 3
export const SHARED_MIN_CLIENT_PROTOCOL = 3
export const SHARED_STATE_SCHEMA_VERSION = 1
export const ACCOUNT_CHARACTER_SCHEMA_VERSION = 1
export const ACCOUNT_SESSION_LIMIT = 12
export const ACCOUNT_CHARACTER_LIMIT = 100
export const CAMPAIGN_BUNDLE_FORMAT = 'dndstars5e-campaign'
export const CAMPAIGN_BUNDLE_SCHEMA_VERSION = 1
export const CAMPAIGN_SNAPSHOT_LIMIT = 10
export const CAMPAIGN_IMPORT_MAX_BYTES = 128 * 1024 * 1024
export const CAMPAIGN_AUTO_SNAPSHOT_INTERVAL_MS = 2 * 60 * 1000

const PROCESS_STARTED_AT = Date.now()
const lastAutoSnapshotAt = new Map()

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
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
    await writeFile(tmpPath, body)
    await rename(tmpPath, filePath)
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
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
    await writeFile(tmpPath, body)
    await rename(tmpPath, filePath)
    return true
  })
}

// 图片 PUT 走与 state 同一把锁 + temp+rename：blob 与 meta 在同一把锁内各自
// 原子落盘，使 GET 永远看不到半写的 blob 或 blob/meta 不匹配；两个并发 PUT 在 imagePath 锁上串行，
// 胜者的 blob 与 meta 必来自同一次 PUT（不交叉配对）。图片按 id 寻址，无 freshness 比较。
async function atomicRename(filePath, body) {
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
  await writeFile(tmpPath, body)
  await rename(tmpPath, filePath)
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
    return { ok: true, revision: currentRevision + 1, value: next, writtenAt }
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
    return { ok: true, revision: currentRevision + 1, value: next, writtenAt }
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

function activeRoomPlayers(room, now) {
  return Array.isArray(room?.players)
    ? room.players.filter((player) =>
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
      slot,
      activePlugins: input.activePlugins ?? resumed.activePlugins ?? [],
      lastSeenAt: now,
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
    slot,
    activePlugins: input.activePlugins ?? [],
    joinedAt: now,
    lastSeenAt: now,
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
function applyCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Stars-Secret, X-Stars-Token, X-Stars-Account-Token, X-Stars-Member, X-Stars-Protocol, X-Stars-Writer, X-Stars-Expected-Revision, X-Stars-Plugin-Version, X-Stars-Plugin-Integrity, X-Stars-Plugin-Filename, X-Stars-Plugin-Name, X-Stars-Plugin-Publisher, X-Stars-Plugin-License')
  res.setHeader('Access-Control-Expose-Headers', 'X-Stars-State-Revision, X-Stars-Plugin-Version, X-Stars-Plugin-Integrity, X-Stars-Plugin-Filename, X-Stars-Plugin-Name, X-Stars-Plugin-Publisher, X-Stars-Plugin-License')
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
  if (typeof req?.headers?.origin !== 'string') return true
  return Number(req?.headers?.['x-stars-protocol']) === SHARED_PROTOCOL_VERSION
}

function eventStorageKey(ctx, channel) {
  return `${ctx.roomId ?? 'default'}::${channel}`
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
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
    await writeFile(tmpPath, body)
    await rename(tmpPath, filePath)
    return { ...result, next }
  })
}

export function mutateCombatInterruptQueue(queue, mutation, now = Date.now(), authorityRole = 'open') {
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
    const expectedValue = acceptedContribution?.replacementValue ?? originalValue
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
  return {
    schemaVersion: 1,
    handouts: handouts.filter((handout) =>
      isDm || handout?.audience === 'all' ||
      (Array.isArray(handout?.audience) && handout.audience.includes(memberId))),
    campaignEntries: Array.isArray(value?.campaignEntries) ? value.campaignEntries : [],
    sharedNotes: Array.isArray(value?.sharedNotes) ? value.sharedNotes : [],
    updatedAt: Number(value?.updatedAt) || 0,
    ...(plainObject(value?._sync) ? { _sync: value._sync } : {}),
  }
}

export function mutateRoomJournalState(current, mutation, now, member, context = {}) {
  const isDm = member?.memberId === context.host?.memberId || member?.role === 'dm'
  const base = {
    schemaVersion: 1,
    handouts: Array.isArray(current?.handouts) ? current.handouts : [],
    campaignEntries: Array.isArray(current?.campaignEntries) ? current.campaignEntries : [],
    sharedNotes: Array.isArray(current?.sharedNotes) ? current.sharedNotes : [],
    updatedAt: now,
  }
  const authorMemberId = boundedText(member?.memberId, 160)
  const authorName = boundedText(member?.displayName, 80) || (isDm ? 'DM' : '玩家')
  const operation = mutation?.operation
  if (operation === 'add-handout') {
    if (!isDm) return { ok: false, status: 403, error: 'dm-only' }
    const title = boundedText(mutation?.title, 120)
    const body = boundedText(mutation?.body, 20_000)
    const imageId = boundedText(mutation?.imageId, 160)
    if (!title || (!body && !imageId)) return { ok: false, status: 400, error: 'invalid-handout' }
    let audience = mutation?.audience
    if (audience !== 'all') {
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
    }
    return { ok: true, changed: true, next: { ...base, handouts: [...base.handouts, handout].slice(-ROOM_HANDOUT_LIMIT) } }
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
    }
    return { ok: true, changed: true, next: { ...base, sharedNotes: [...base.sharedNotes, note].slice(-ROOM_SHARED_NOTE_LIMIT) } }
  }
  if (operation === 'update-shared-note') {
    const id = boundedText(mutation?.id, 120)
    const note = base.sharedNotes.find((entry) => entry?.id === id)
    if (!note) return { ok: false, status: 404, error: 'shared-note-not-found' }
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
    }
    return { ok: true, changed: true, next: { ...base, sharedNotes: base.sharedNotes.map((entry) => entry?.id === id ? updated : entry) } }
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

function groupCheckModifier(character, ability, skill) {
  const level = Math.min(20, Math.max(1, Math.floor(Number(character?.level) || 1)))
  const score = Math.min(30, Math.max(1, Math.floor(Number(character?.abilities?.[ability]) || 10)))
  const abilityModifier = Math.floor((score - 10) / 2)
  const proficiencyBonus = 2 + Math.floor((level - 1) / 4)
  const rank = groupCheckProficiencyRank(character, skill)
  if (rank > 0) return { modifier: abilityModifier + proficiencyBonus * rank, rank, score }
  const bardBonus = groupCheckClassLevel(character, 'bard') >= 2 ? Math.floor(proficiencyBonus / 2) : 0
  const championBonus = groupCheckClassLevel(character, 'fighter') >= 7 &&
    character?.dnd5eClassChoices?.fighter?.subclass === 'champion' && ['str', 'dex', 'con'].includes(ability)
    ? Math.ceil(proficiencyBonus / 2)
    : 0
  return { modifier: abilityModifier + Math.max(bardBonus, championBonus), rank: 0, score }
}

function groupCheckEffectiveMode(requestedMode, character) {
  const requestedAdvantage = requestedMode === 'advantage'
  const requestedDisadvantage = requestedMode === 'disadvantage'
  const exhaustionDisadvantage = Number(character?.exhaustionLevel) >= 1
  const disadvantage = requestedDisadvantage || exhaustionDisadvantage
  if (requestedAdvantage && disadvantage) return 'normal'
  if (requestedAdvantage) return 'advantage'
  if (disadvantage) return 'disadvantage'
  return 'normal'
}

function groupCheckResult(character, check, now, options = {}) {
  const { modifier, rank, score } = groupCheckModifier(character, check.ability, check.skill)
  const mode = groupCheckEffectiveMode(check.requestedMode, character)
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
  const reliableTalent = groupCheckClassLevel(character, 'rogue') >= 11 && rank > 0
  const effectiveRolls = reliableTalent ? rolls.map((roll) => Math.max(10, roll)) : [...rolls]
  const d20 = mode === 'advantage' ? Math.max(...effectiveRolls) : mode === 'disadvantage' ? Math.min(...effectiveRolls) : effectiveRolls[0]
  const rawTotal = d20 + modifier
  const indomitableMight = groupCheckClassLevel(character, 'barbarian') >= 18 && check.ability === 'str' && rawTotal < score
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

const CAMPAIGN_TIME_DEFAULT_WORLD_MINUTE = 8 * 60
const CAMPAIGN_TIME_TIMER_LIMIT = 256
const CAMPAIGN_TIME_ADVANCE_LIMIT = 512
const CAMPAIGN_TIME_MAX_ADVANCE_MINUTES = 365 * 24 * 60

function campaignDawnsCrossed(fromWorldMinute, toWorldMinute) {
  const from = Math.max(0, Math.floor(Number(fromWorldMinute) || 0))
  const to = Math.max(from, Math.floor(Number(toWorldMinute) || 0))
  return Math.max(0, Math.floor((to - 360) / 1_440) - Math.floor((from - 360) / 1_440))
}

function validateCampaignTimeState(value) {
  if (
    value?.schemaVersion !== 1 || !Number.isSafeInteger(value.worldMinute) || value.worldMinute < 0 ||
    !Array.isArray(value.timers) || value.timers.length > CAMPAIGN_TIME_TIMER_LIMIT ||
    !Array.isArray(value.advances) || value.advances.length > CAMPAIGN_TIME_ADVANCE_LIMIT ||
    !Number.isFinite(value.updatedAt) || value.updatedAt < 0
  ) return 'invalid-campaign-time-envelope'
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

export function mutateCampaignTimeState(current, mutation, now, member, context = {}) {
  const isDm = member?.memberId === context.host?.memberId || member?.role === 'dm'
  if (!isDm) return { ok: false, status: 403, error: 'dm-authority-required' }
  const base = validateCampaignTimeState(current) == null
    ? current
    : { schemaVersion: 1, worldMinute: CAMPAIGN_TIME_DEFAULT_WORLD_MINUTE, timers: [], advances: [], updatedAt: 0 }
  if (mutation?.operation === 'advance' || mutation?.operation === 'long-rest') {
    const minutes = mutation.operation === 'long-rest' ? 8 * 60 : Number(mutation.minutes)
    if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > CAMPAIGN_TIME_MAX_ADVANCE_MINUTES) {
      return { ok: false, status: 400, error: 'invalid-campaign-time-advance' }
    }
    const fromWorldMinute = base.worldMinute
    const toWorldMinute = fromWorldMinute + minutes
    if (!Number.isSafeInteger(toWorldMinute)) return { ok: false, status: 400, error: 'campaign-time-overflow' }
    const expiredTimerIds = []
    const timers = base.timers.map((timer) => {
      if (timer.status !== 'active' || timer.expiresAtWorldMinute > toWorldMinute) return timer
      expiredTimerIds.push(timer.id)
      return { ...timer, status: 'expired', expiredAtWorldMinute: timer.expiresAtWorldMinute }
    })
    const kind = mutation.operation === 'long-rest' ? 'long-rest' : 'advance'
    const reason = boundedText(mutation.reason, 160) || (kind === 'long-rest' ? '完成长休' : '推进时间')
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
      ok: true,
      changed: true,
      next: {
        schemaVersion: 1,
        worldMinute: toWorldMinute,
        timers,
        advances: [...base.advances, advance].slice(-CAMPAIGN_TIME_ADVANCE_LIMIT),
        updatedAt: now,
      },
      advance,
    }
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
    const skillMatch = selection.match(/^skill:([a-zA-Z]+)$/)
    const skill = skillMatch?.[1]
    const ability = abilityMatch?.[1] ?? GROUP_ABILITY_CHECK_SKILLS[skill]
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
      ...(skill ? { skill } : {}),
      dc,
      requestedMode: mode,
      allowPassiveFallback: mutation?.allowPassiveFallback === true,
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
    value.expiresAfterRound - value.createdRound + 1 <= 14_400
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

function validateDnd5eResourceStates(name, value) {
  if (name === 'custom-monsters') return validateCustomMonsterState(value)
  if (name === 'group-ability-checks') return validateGroupAbilityCheckState(value)
  if (name === 'characters') {
    let portraitLength = 0
    for (const character of value.characters ?? []) {
      if (!plainObject(character)) continue
      if (character.portrait != null) {
        if (
          typeof character.portrait !== 'string' ||
          character.portrait.length > CHARACTER_PORTRAIT_MAX_DATA_URL_LENGTH ||
          !/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=\r\n]+$/i.test(character.portrait)
        ) return 'invalid-character-portrait'
        portraitLength += character.portrait.length
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
            !validDnd5eRoundLifecycle(area) || typeof area.label !== 'string' || !area.label || area.label.length > 120
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
  const validWallAttachment = (entity.parentWallId == null && entity.parentWallSegmentIndex == null) || (
    typeof entity.parentWallId === 'string' && entity.parentWallId.length > 0 && entity.parentWallId.length <= 160 &&
    Number.isInteger(entity.parentWallSegmentIndex) && entity.parentWallSegmentIndex >= 0 && entity.parentWallSegmentIndex <= 2_047
  )
  if (!validWallAttachment) return false
  if (kind === 'wall') return entity.points.length >= 2 && entity.points.length <= 2_048 &&
    (entity.material == null || ['stone', 'brick', 'wood', 'metal', 'natural'].includes(entity.material))
  if (kind === 'door') {
    if (!(entity.points.length === 2 && ['open', 'closed', 'locked'].includes(entity.state) && typeof entity.secret === 'boolean') ||
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
    (entity.traversal == null || ['ground', 'climb', 'swim'].includes(entity.traversal))
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
  if (![1, 2].includes(value.schemaVersion) || !Array.isArray(value.maps) || value.maps.length > 4_096) return 'invalid-map-geometry'
  const mapIds = new Set()
  for (const map of value.maps) {
    if (
      !plainObject(map) || typeof map.mapId !== 'string' || !map.mapId || mapIds.has(map.mapId) ||
      !Array.isArray(map.walls) || !Array.isArray(map.doors) || !Array.isArray(map.obstacles) ||
      (value.schemaVersion === 2
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
  'damageDealt', 'damageTaken', 'healingDone', 'healingReceived', 'temporaryHpGranted', 'damagePrevented',
  'hostileConditionsApplied', 'attacks', 'hits', 'criticalHits', 'knockouts', 'kills', 'alliesRescued',
  'successfulSaves', 'failedSaves', 'concentrationChecks', 'concentrationMaintained', 'actionsSpent',
  'bonusActionsSpent', 'reactionsSpent', 'movementSpentFeet', 'classResourcesSpent', 'spellSlotsSpent',
]

function validateCombatStatisticsState(value) {
  if (![1, 2].includes(value.schemaVersion) || !Array.isArray(value.sessions) || value.sessions.length > 24 ||
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
      if (!combatantId || combatantId.length > 160 || !plainObject(stats) || stats.combatantId !== combatantId ||
        typeof stats.name !== 'string' || stats.name.length > 240 || !['player', 'enemy', 'npc'].includes(stats.side) ||
        COMBAT_STATISTIC_NUMBER_FIELDS.some((field) => !Number.isFinite(stats[field]) || stats[field] < 0)) {
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

function geometrySegments(geometry) {
  if (!geometry) return []
  const segments = []
  const add = (entity, closed) => {
    const count = closed ? entity.points.length : entity.points.length - 1
    for (let index = 0; index < count; index += 1) {
      segments.push({
        entityId: entity.id,
        a: entity.points[index],
        b: entity.points[(index + 1) % entity.points.length],
        blocksVision: entity.blocksVision,
        baseHeightFeet: entity.baseHeightFeet,
        heightFeet: entity.heightFeet,
      })
    }
  }
  for (const wall of geometry.walls ?? []) add(wall, false)
  for (const door of geometry.doors ?? []) {
    if (door.state !== 'open') add(door, false)
  }
  for (const obstacle of geometry.obstacles ?? []) add(obstacle, true)
  return segments
}

function cross2d(a, b) {
  return a.x * b.y - a.y * b.x
}

function segmentIntersectionParameter(from, to, a, b) {
  const r = { x: to.x - from.x, y: to.y - from.y }
  const s = { x: b.x - a.x, y: b.y - a.y }
  const denominator = cross2d(r, s)
  if (Math.abs(denominator) < 1e-8) return null
  const delta = { x: a.x - from.x, y: a.y - from.y }
  const t = cross2d(delta, s) / denominator
  const u = cross2d(delta, r) / denominator
  return t > 1e-5 && t <= 1 + 1e-7 && u >= -1e-7 && u <= 1 + 1e-7 ? t : null
}

function tokenElevationFeet(token) {
  return Number.isFinite(token?.elevationFeet) ? token.elevationFeet : 0
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

function playerCanSeeToken(map, geometry, viewer, target, fallbackRangeFeet = null, lightingEnabled = true) {
  const feetPerCell = Math.max(1, Number(map.feetPerCell) || 5)
  const gridSize = Math.max(1, Number(map.gridSize) || 1)
  const normalRangeFeet = Number.isFinite(viewer.visionRangeFeet)
    ? Math.max(0, viewer.visionRangeFeet)
    : Number.isFinite(fallbackRangeFeet)
      ? Math.max(0, fallbackRangeFeet)
      : Number.isFinite(geometry?.vision?.defaultRangeFeet)
        ? Math.max(0, geometry.vision.defaultRangeFeet)
        : DEFAULT_PLAYER_VISION_RANGE_FEET
  const darkvisionRangeFeet = Number.isFinite(viewer.darkvisionRangeFeet) ? Math.max(0, viewer.darkvisionRangeFeet) : 0
  const blindsightRangeFeet = Number.isFinite(viewer.blindsightRangeFeet) ? Math.max(0, viewer.blindsightRangeFeet) : 0
  const truesightRangeFeet = Number.isFinite(viewer.truesightRangeFeet) ? Math.max(0, viewer.truesightRangeFeet) : 0
  const carriedLightRangeFeet = viewer.lightSource?.enabled === true
    ? Math.max(0, Number(viewer.lightSource.brightRadiusFeet) || 0) + Math.max(0, Number(viewer.lightSource.dimRadiusFeet) || 0)
    : 0
  const rangeFeet = Math.max(normalRangeFeet, darkvisionRangeFeet, blindsightRangeFeet, truesightRangeFeet, carriedLightRangeFeet)
  const rangePx = rangeFeet / feetPerCell * gridSize
  const distancePx = Math.hypot(target.x - viewer.x, target.y - viewer.y)
  if (distancePx > rangePx) return false
  const fromElevation = tokenElevationFeet(viewer)
  const toElevation = tokenElevationFeet(target)
  const lineBlocked = (from, to, sourceElevation = 0, destinationElevation = 0) => geometrySegments(geometry).some((segment) => {
    if (!segment.blocksVision) return false
    const t = segmentIntersectionParameter(from, to, segment.a, segment.b)
    if (t == null) return false
    const rayHeight = sourceElevation + 2.5 + (destinationElevation - sourceElevation) * t
    return rayHeight >= segment.baseHeightFeet && rayHeight < segment.baseHeightFeet + segment.heightFeet
  })
  if (lineBlocked(viewer, target, fromElevation, toElevation)) return false
  const ambient = lightingEnabled ? geometry?.vision?.ambientLight ?? 'bright' : 'bright'
  if (ambient !== 'bright') {
    let illuminated = ambient === 'dim'
    for (const source of map.tokens ?? []) {
      const light = source?.lightSource
      if (!light?.enabled) continue
      const distanceFeet = Math.hypot(target.x - source.x, target.y - source.y) / gridSize * feetPerCell
      const lightRange = Math.max(0, Number(light.brightRadiusFeet) || 0) + Math.max(0, Number(light.dimRadiusFeet) || 0)
      if (distanceFeet <= lightRange && !lineBlocked(source, target, tokenElevationFeet(source), toElevation)) {
        illuminated = true
        break
      }
    }
    if (!illuminated) {
      for (const source of geometry?.lights ?? []) {
        if (!source?.enabled || !Array.isArray(source.points) || !source.points[0]) continue
        const point = source.points[0]
        const distanceFeet = Math.hypot(target.x - point.x, target.y - point.y) / gridSize * feetPerCell
        const lightRange = Math.max(0, Number(source.brightRadiusFeet) || 0) +
          Math.max(0, Number(source.dimRadiusFeet) || 0)
        if (
          distanceFeet <= lightRange &&
          !lineBlocked(point, target, Number(source.elevationFeet) || 0, toElevation)
        ) {
          illuminated = true
          break
        }
      }
    }
    const distanceFeet = distancePx / gridSize * feetPerCell
    if (!illuminated && distanceFeet > Math.max(darkvisionRangeFeet, blindsightRangeFeet, truesightRangeFeet)) return false
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
  return Math.hypot(target.x - viewer.x, target.y - viewer.y) / gridSize * feetPerCell <= rangeFeet
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
  const resolvedActiveCharacterId = typeof activeCharacterId === 'string' && activeCharacterId.length > 0
    ? activeCharacterId
    : [...characterById.values()].find((character) =>
        (typeof viewerIdentity?.memberId === 'string' && character.roomMemberId === viewerIdentity.memberId) ||
        (typeof viewerIdentity?.accountId === 'string' && character.ownerAccountId === viewerIdentity.accountId),
      )?.id ?? null
  return {
    ...value,
    maps: value.maps.map((map) => {
      if (!plainObject(map) || !Array.isArray(map.tokens)) return map
      const effectiveMap = {
        ...map,
        tokens: map.tokens.map((token) => plainObject(token) && plainObject(token.lightSource) &&
          !campaignLightActive(token.lightSource, worldMinute)
          ? { ...token, lightSource: { ...token.lightSource, enabled: false } }
          : token),
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
      const players = effectiveMap.tokens.filter((token) => plainObject(token) && token.type === 'player')
      const viewers = geometry?.vision?.sharePartyVision === false
        ? players.filter((token) => token.characterId === resolvedActiveCharacterId)
        : players
      const tokens = effectiveMap.tokens.flatMap((token) => {
        if (!plainObject(token)) return []
        if (token.type === 'player' || token.visibilityMode === 'always') return [token]
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
          Math.abs(tokenElevationFeet(viewer) - tokenElevationFeet(token)) <= 5 &&
          token.airborne !== true,
        )
        if (observingViewers.length === 0) return tremorsenseViewers.length > 0 ? [redactUnseenToken(token)] : []
        const hiddenCheckTotal = tokenHiddenCheckTotal(token)
        if (
          hiddenCheckTotal != null &&
          !observingViewers.some((viewer) => passivePerceptionForViewer(viewer, characterById) >= hiddenCheckTotal)
        ) return []
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
          ? map.dnd5ePluginAreas.filter((area) => !area?.sourceTokenId || visibleIds.has(area.sourceTokenId))
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
        return !maySeeSecretDoor(door) && door.state !== 'open' ? [{
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
      const secretOpenings = map.doors.flatMap((door) => !maySeeSecretDoor(door) && door.state === 'open'
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
  }
  const arrayField = requiredArrays[name]
  if (arrayField && !Array.isArray(value[arrayField])) {
    return { ok: false, reason: `missing-array:${arrayField}` }
  }
  if (name === 'room-journal' && (!Array.isArray(value.campaignEntries) || !Array.isArray(value.sharedNotes))) {
    return { ok: false, reason: 'missing-journal-arrays' }
  }
  if (value.updatedAt != null && (!Number.isFinite(value.updatedAt) || value.updatedAt < 0)) {
    return { ok: false, reason: 'invalid-updated-at' }
  }
  if (name === 'combat' && value.active != null && typeof value.active !== 'boolean') {
    return { ok: false, reason: 'invalid-combat-active' }
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
  return {
    id: room.id,
    name: room.name,
    rulesetId: room.rulesetId,
    requiredPlugins: Array.isArray(room.requiredPlugins) ? room.requiredPlugins : [],
    pluginFiles: plainObject(room.pluginFiles) ? room.pluginFiles : {},
    pluginRuntimeState: plainObject(room.pluginRuntimeState) ? room.pluginRuntimeState : {},
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
    if (!hosted) continue
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

function randomLobbyCode(length) {
  const bytes = randomBytes(length)
  return [...bytes].map((value) => ROOM_CODE_ALPHABET[value & 31]).join('')
}

function normalizeAccountId(value) {
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
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  }
}

function accountSessionResponse(account, token) {
  return {
    accountId: account.accountId,
    displayName: account.displayName,
    sessionToken: token,
    createdAt: account.createdAt,
  }
}

async function readAccount(ctx, accountId) {
  const normalized = normalizeAccountId(accountId)
  if (normalized !== accountId || normalized.length !== 12) throw new RoomProtocolError(401, 'invalid-account-session')
  try {
    const account = JSON.parse(await readFile(accountFile(ctx, normalized), 'utf8'))
    if (!plainObject(account) || account.accountId !== normalized) throw new Error('invalid account record')
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
    try {
      account = JSON.parse(await readFile(filePath, 'utf8'))
    } catch (error) {
      if (error?.code === 'ENOENT') throw new RoomProtocolError(401, 'invalid-account-session')
      throw error
    }
    const next = await updater(account)
    if (!plainObject(next) || next.accountId !== accountId) throw new RoomProtocolError(400, 'account-operation-failed')
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
      createdAt: now,
      updatedAt: now,
    }
    try {
      await writeFile(accountFile(ctx, accountId), JSON.stringify(account), { flag: 'wx' })
      return { account, token, recoveryCode }
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error
    }
  }
  throw new RoomProtocolError(503, 'account-id-exhausted')
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

function roomRulesResponse(room, member) {
  const requiredPlugins = Array.isArray(room.requiredPlugins) ? room.requiredPlugins : []
  return {
    roomId: room.id,
    rulesetId: room.rulesetId,
    revision: Number.isFinite(room.rulesRevision) ? room.rulesRevision : 1,
    updatedAt: room.rulesUpdatedAt ?? room.updatedAt ?? room.createdAt,
    requiredPlugins,
    plugins: requiredPlugins.map((requirement) => {
      const hosted = room.pluginFiles?.[requirement.id] ?? {}
      return {
        ...requirement,
        name: normalizedLabel(hosted.name, 100) || requirement.id,
        publisher: normalizedLabel(hosted.publisher, 100) || '未知发布者',
        license: normalizedLabel(hosted.license, 120) || '未声明',
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

function roomMemberResponse(room, member, role) {
  return {
    roomId: room.id,
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
      ...(member.accountId ? { accountId: member.accountId } : {}),
      clientId: member.clientId,
      role,
      ...(member.slot ? { slot: member.slot } : {}),
      displayName: member.displayName,
    },
  }
}

async function createLobbyRoom(ctx, payload, account = null, now = Date.now()) {
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
    const member = {
      memberId: randomUUID(),
      ...(account ? { accountId: account.accountId } : {}),
      clientId,
      displayName,
      activePlugins,
      joinedAt: now,
      lastSeenAt: now,
    }
    const room = {
      version: 1,
      id: roomId,
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
      return { room, member }
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

async function handleAccountApi(req, res, parsed, ctx) {
  if (!parsed.pathname.startsWith('/api/accounts')) return false
  if (!applyLobbyRateLimit(req, res, ctx)) return true

  if (parsed.pathname === '/api/accounts' && req.method === 'POST') {
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

  if (parsed.pathname === '/api/accounts/me/characters' && req.method === 'GET') {
    const account = await authenticateAccount(req, ctx)
    writeJson(res, 200, { characters: Array.isArray(account.characters) ? account.characters : [] })
    return true
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
    const account = await authenticateAccount(req, ctx, true)
    if (payload?.accountId != null && account?.accountId !== payload.accountId) {
      throw new RoomProtocolError(401, 'invalid-account-session')
    }
    const { room, member } = await createLobbyRoom(ctx, payload, account)
    writeJson(res, 201, roomMemberResponse(room, member, 'dm'))
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
      maxPlayers: Number.isInteger(result.room.maxPlayers) ? result.room.maxPlayers : 3,
      plugins: rules.plugins,
    })
    return true
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
      await mutateLobbyRoom(ctx, roomId, (room) => {
        if (room.closedAt) return { ok: false, status: 409, error: 'room-closed' }
        if (room.host?.memberId !== memberId) return { ok: false, status: 403, error: 'forbidden' }
        return { ok: true }
      })
      const bytes = await readBody(req, STATE_MAX_BYTES)
      if (bytes.length < 1) throw new RoomProtocolError(400, 'plugin-file-empty')
      const actualIntegrity = `sha256-${createHash('sha256').update(bytes).digest('base64')}`
      if (actualIntegrity !== requirement.integrity) throw new RoomProtocolError(409, 'plugin-integrity-mismatch')
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
      await mutateLobbyRoom(ctx, roomId, (room) => {
        if (room.closedAt) return { ok: false, status: 409, error: 'room-closed' }
        if (room.host?.memberId !== memberId) return { ok: false, status: 403, error: 'forbidden' }
        return { ok: true, member: room.host }
      })
      const bytes = await readBody(req, STATE_MAX_BYTES)
      if (bytes.length < 1) throw new RoomProtocolError(400, 'plugin-file-empty')
      const actualIntegrity = `sha256-${createHash('sha256').update(bytes).digest('base64')}`
      if (actualIntegrity !== requirement.integrity) throw new RoomProtocolError(409, 'plugin-integrity-mismatch')
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
        const pluginFiles = { ...(room.pluginFiles ?? {}) }
        delete pluginFiles[pluginId]
        const stagedPluginFiles = { ...(room.stagedPluginFiles ?? {}) }
        delete stagedPluginFiles[pluginId]
        return {
          ok: true,
          member: room.host,
          next: {
            ...room,
            requiredPlugins: (Array.isArray(room.requiredPlugins) ? room.requiredPlugins : [])
              .filter((plugin) => plugin.id !== pluginId),
            pluginFiles,
            stagedPluginFiles,
            rulesRevision: (Number.isFinite(room.rulesRevision) ? room.rulesRevision : 1) + 1,
            rulesUpdatedAt: now,
            updatedAt: now,
          },
        }
      })
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
        const previousHostAsPlayer = {
          ...room.host,
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
    const account = await authenticateAccount(req, ctx, true)
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
        }
        return { ok: true, member, role: 'dm', next: { ...room, host: member, updatedAt: now } }
      }
      if (!roomPasswordMatches(room, payload?.password)) return { ok: false, status: 403, error: 'invalid-room-password' }
      return assignRoomPlayer(room, {
        clientId,
        displayName,
        memberId: resumeMemberId ?? randomUUID(),
        accountId: account?.accountId,
        activePlugins,
      })
    })
    writeJson(res, 200, roomMemberResponse(result.room, result.member, result.role ?? 'player'))
    return true
  }

  const memberId = payload?.memberId
  if (typeof memberId !== 'string' || memberId.length < 8) throw new RoomProtocolError(400, 'member-not-found')
  const account = await authenticateAccount(req, ctx, true)

  if (match[2] === 'heartbeat') {
    const now = Date.now()
    const activePlugins = normalizeRoomPluginRequirements(payload?.activePlugins ?? [])
    if (!activePlugins) throw new RoomProtocolError(400, 'invalid-plugin-manifest')
    const result = await mutateLobbyRoom(ctx, roomId, (room) => {
      if (room.closedAt) return { ok: false, status: 409, error: 'room-closed' }
      if (room.host?.memberId === memberId) {
        if (!roomMemberAccountAuthorized(room.host, account)) return { ok: false, status: 403, error: 'forbidden' }
        const member = {
          ...room.host,
          activePlugins,
          lastSeenAt: now,
          activeCharacterId: normalizedLabel(payload?.activeCharacterId, 128) || null,
          activeCharacterName: normalizedLabel(payload?.activeCharacterName, 80) || null,
        }
        return { ok: true, member, role: 'dm', next: { ...room, host: member, updatedAt: now } }
      }
      if (!roomHostIsOnline(room, now)) return { ok: false, status: 409, error: 'room-offline' }
      const players = Array.isArray(room.players) ? room.players : []
      const member = players.find((player) => player.memberId === memberId)
      if (!member) return { ok: false, status: 404, error: 'member-not-found' }
      if (!roomMemberAccountAuthorized(member, account)) return { ok: false, status: 403, error: 'forbidden' }
      if (roomPlayerPresence(member, now) === 'removed') return { ok: false, status: 403, error: 'member-removed' }
      const resumed = assignRoomPlayer(room, {
        memberId: member.memberId,
        accountId: member.accountId,
        clientId: member.clientId,
        displayName: member.displayName,
        activePlugins,
      }, now)
      if (!resumed.ok) return resumed
      const refreshed = {
        ...resumed.member,
        activeCharacterId: normalizedLabel(payload?.activeCharacterId, 128) || null,
        activeCharacterName: normalizedLabel(payload?.activeCharacterName, 80) || null,
      }
      return {
        ok: true,
        member: refreshed,
        role: 'player',
        next: {
          ...resumed.next,
          players: resumed.next.players.map((player) => player.memberId === refreshed.memberId ? refreshed : player),
        },
      }
    })
    writeJson(res, 200, roomMemberResponse(result.room, result.member, result.role))
    return true
  }

  await mutateLobbyRoom(ctx, roomId, (room) => {
    const now = Date.now()
    if (room.host?.memberId === memberId) {
      if (!roomMemberAccountAuthorized(room.host, account)) return { ok: false, status: 403, error: 'forbidden' }
      return {
        ok: true,
        next: { ...room, closedAt: now, updatedAt: now, host: { ...room.host, lastSeenAt: 0 } },
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
  writeJson(res, 200, { ok: true })
  return true
}

function addEventClient(ctx, channel, res) {
  const storageKey = eventStorageKey(ctx, channel)
  const clients = ctx.eventClients.get(storageKey) ?? new Set()
  clients.add(res)
  ctx.eventClients.set(storageKey, clients)
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  })
  res.write(`event: ready\ndata: ${JSON.stringify({
    channel,
    streamId: ctx.serverInstanceId ?? 'legacy-stream',
    sequence: ctx.eventSequences?.get(ctx.roomId ?? 'default') ?? 0,
  })}\n\n`)
  // 只回放最近 EVENT_REPLAY_LIMIT 条，而非整 backlog。
  const backlog = replaySlice(ctx.eventBacklog.get(storageKey) ?? [])
  for (const payload of backlog) {
    res.write(`event: message\ndata: ${JSON.stringify(payload)}\n\n`)
  }
  return () => {
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
  const text = `event: message\ndata: ${JSON.stringify(payload)}\n\n`
  for (const client of clients) client.write(text)
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
  applyCors(res)
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return true
  }

  if (parsed.pathname === '/api/meta' && req.method === 'GET') {
    writeJson(res, 200, {
      service: 'dndstars-5e-shared',
      rulesetId: DND5E_2014_RULESET_ID,
      protocolVersion: SHARED_PROTOCOL_VERSION,
      minimumClientProtocol: SHARED_MIN_CLIENT_PROTOCOL,
      buildId: ctx.serverBuildId ?? process.env.STARS_BUILD_ID ?? 'development',
      startedAt: ctx.serverStartedAt ?? PROCESS_STARTED_AT,
    })
    return true
  }

  try {
    if (await handleAccountApi(req, res, parsed, ctx)) return true
    if (await handleRoomLobbyApi(req, res, parsed, ctx)) return true
  } catch (error) {
    const status = Number(error?.statusCode) || 500
    writeJson(res, status, { error: error?.code ?? String(error?.message ?? error) })
    return true
  }

  const roomId = normalizeRoomId(parsed.searchParams.get('room'))
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
  if ((ctx.roomId ?? 'default') !== 'default') {
    try {
      const room = await readRoomForCampaign(ctx)
      const requestMemberId = req?.headers?.['x-stars-member'] ?? parsed.searchParams.get('member')
      authenticatedRoomMember = lobbyRoomMember(room, requestMemberId)
      if (!authenticatedRoomMember) {
        writeJson(res, 403, { error: 'forbidden' })
        return true
      }
      if (authenticatedRoomMember === room?.host) ctx = { ...ctx, accessRole: 'dm' }
      else if (authenticatedRoomMember) ctx = { ...ctx, accessRole: 'player' }
    } catch {
      writeJson(res, 403, { error: 'forbidden' })
      return true
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
  if (
    req.method !== 'GET' &&
    (parsed.pathname.startsWith('/api/state/') || parsed.pathname.startsWith('/api/events/') || parsed.pathname.startsWith('/api/images/')) &&
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

    const eventMatch = parsed.pathname.match(/^\/api\/events\/([a-zA-Z0-9_-]+)$/)
    if (eventMatch) {
      const channel = safeName(eventMatch[1])
      if (req.method === 'DELETE') {
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
        const remove = addEventClient(ctx, channel, res)
        req.on('close', remove)
        return true
      }
      if (req.method === 'POST') {
        const body = await readBody(req)
        const payload = JSON.parse(body.toString('utf8'))
        publishEvent(ctx, channel, payload)
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end('{"ok":true}')
        return true
      }
    }

    if (parsed.pathname === '/api/state/room-chat/message' && req.method === 'PATCH') {
      if (!authenticatedRoomMember) {
        writeJson(res, 403, { error: 'forbidden' })
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
          playerMemberIds: (Array.isArray(room.players) ? room.players : []).map((player) => player.memberId),
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
      const room = await readRoomForCampaign(ctx)
      const now = Date.now()
      const filePath = path.join(ctx.stateRoot, 'room-journal.json')
      const result = await atomicMutateJsonStateLocked(filePath, (state) =>
        mutateRoomJournalState(state, mutation, now, authenticatedRoomMember, {
          host: room.host,
          playerMemberIds: (Array.isArray(room.players) ? room.players : []).map((player) => player.memberId),
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

    if (parsed.pathname === '/api/state/combat-interrupts/interrupt' && req.method === 'PATCH') {
      const auth = authorizeStateWrite('combat-interrupts', extractSecret(req))
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
      const result = await atomicMutateJsonStateLocked(filePath, (queue) =>
        mutateCombatInterruptQueue(queue, mutation, Date.now(), ctx.accessRole),
      )
      if (!result?.ok) {
        res.writeHead(result?.status ?? 400, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ error: result?.error ?? 'mutation-failed' }))
        return true
      }
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
        let roomMember = authenticatedRoomMember
        let playerRead = ctx.accessRole === 'player'
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
        const auth = authorizeStateWrite(name, extractSecret(req))
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
        await maybeWriteAutoCampaignSnapshot(ctx)
        const expectedHeader = req?.headers?.['x-stars-expected-revision']
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
        await maybeWriteAutoCampaignSnapshot(ctx)
        const expectedHeader = req?.headers?.['x-stars-expected-revision']
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
          if (ctx.accessRole === 'player' && id.startsWith('handout-image-')) {
            let journal = null
            try {
              journal = JSON.parse(await readFile(path.join(ctx.stateRoot, 'room-journal.json'), 'utf8'))
            } catch {
              // Missing or damaged metadata denies access to a protected handout image.
            }
            const visible = projectRoomJournalForMember(journal, authenticatedRoomMember?.memberId ?? '', false)
            if (!visible.handouts.some((handout) => handout?.imageId === id)) {
              writeJson(res, 403, { error: 'forbidden' })
              return true
            }
          }
          let sourcePath = filePath
          let sourceMetaPath = metaPath
          try {
            await readFile(metaPath, 'utf8')
          } catch {
            sourcePath = path.join(ctx.legacyImageRoot, id)
            sourceMetaPath = path.join(ctx.legacyImageRoot, `${id}.json`)
          }
          const meta = JSON.parse(await readFile(sourceMetaPath, 'utf8'))
          res.writeHead(200, { 'Content-Type': meta.type || 'application/octet-stream' })
          createReadStream(sourcePath).pipe(res)
        } catch {
          res.writeHead(404)
          res.end('Not Found')
        }
        return true
      }
      if (req.method === 'PUT') {
        await mkdir(ctx.imageRoot, { recursive: true })
        await maybeWriteAutoCampaignSnapshot(ctx)
        const body = await readBody(req, IMAGE_MAX_BYTES)
        const metaBody = JSON.stringify({ type: req.headers['content-type'] || 'application/octet-stream' })
        // blob+meta 在同一把锁内原子落盘。
        await atomicWriteImageLocked(filePath, metaPath, body, metaBody)
        // 写后即触发配额 GC（write-trigger，按 mtime 最旧优先淘汰）。
        await enforceImageQuota(ctx.imageRoot)
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end('{"ok":true}')
        return true
      }
      if (req.method === 'DELETE') {
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

