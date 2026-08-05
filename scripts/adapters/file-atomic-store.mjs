import { readFile, rename, rm, stat, utimes, writeFile } from 'node:fs/promises'
import process from 'node:process'

const LOCK_RETRY_MS = 20
const inProcessLockChain = new Map()
const WINDOWS_RENAME_RETRY_DELAYS_MS = [8, 16, 32, 64, 128, 256, 512]
const WINDOWS_TRANSIENT_RENAME_CODES = new Set(['EPERM', 'EACCES', 'EBUSY'])

function lockTimings() {
  return {
    staleMs: Number(process.env.STARS_LOCK_STALE_MS) || 10_000,
    waitMaxMs: Number(process.env.STARS_LOCK_WAIT_MAX_MS) || 5_000,
    heartbeatMs: Number(process.env.STARS_LOCK_HEARTBEAT_MS) || 3_000,
  }
}

export class LockTimeoutError extends Error {
  constructor(lockPath) {
    super(`write lock acquire timed out: ${lockPath}`)
    this.name = 'LockTimeoutError'
    this.code = 'ELOCKTIMEOUT'
    this.statusCode = 503
  }
}

async function isLockStale(lockPath) {
  try {
    const info = await stat(lockPath)
    return Date.now() - info.mtimeMs > lockTimings().staleMs
  } catch {
    return false
  }
}

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
        await rm(lockPath, { force: true })
        continue
      }
      if (Date.now() > deadline) throw new LockTimeoutError(lockPath)
      await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS))
    }
  }
}

function startLockHeartbeat(lockPath) {
  const { heartbeatMs } = lockTimings()
  const timer = setInterval(() => {
    const now = new Date()
    void utimes(lockPath, now, now).catch(() => {})
  }, heartbeatMs)
  if (typeof timer.unref === 'function') timer.unref()
  return () => clearInterval(timer)
}

export async function withWriteLock(filePath, operation) {
  const lockPath = `${filePath}.lock`
  const previous = inProcessLockChain.get(filePath) ?? Promise.resolve()
  let release
  const current = new Promise((resolve) => { release = resolve })
  const chained = previous.then(() => current)
  inProcessLockChain.set(filePath, chained)
  await previous.catch(() => {})
  try {
    await acquireCrossProcessLock(lockPath)
    const stopHeartbeat = startLockHeartbeat(lockPath)
    try {
      return await operation()
    } finally {
      stopHeartbeat()
      await rm(lockPath, { force: true }).catch(() => {})
    }
  } finally {
    release()
    if (inProcessLockChain.get(filePath) === chained) inProcessLockChain.delete(filePath)
  }
}

export async function retryTransientWindowsRename(operation, options = {}) {
  const platform = options.platform ?? process.platform
  const delays = options.delays ?? WINDOWS_RENAME_RETRY_DELAYS_MS
  const wait = options.wait ?? ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)))
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      const code = typeof error?.code === 'string' ? error.code : ''
      if (platform !== 'win32' || !WINDOWS_TRANSIENT_RENAME_CODES.has(code) || attempt >= delays.length) throw error
      await wait(delays[attempt])
    }
  }
}

export async function atomicRename(filePath, body) {
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
  await writeFile(tmpPath, body)
  try {
    await retryTransientWindowsRename(() => rename(tmpPath, filePath))
  } finally {
    await rm(tmpPath, { force: true }).catch(() => {})
  }
}

export async function atomicWriteLocked(filePath, body) {
  await withWriteLock(filePath, () => atomicRename(filePath, body))
}

function updatedAtFromJsonBody(body) {
  try {
    const parsed = JSON.parse(Buffer.isBuffer(body) ? body.toString('utf8') : String(body))
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
        const existingUpdatedAt = updatedAtFromJsonBody(await readFile(filePath, 'utf8'))
        if (existingUpdatedAt != null && incomingUpdatedAt < existingUpdatedAt) return false
      } catch {
        // Missing state is a valid first write.
      }
    }
    await atomicRename(filePath, body)
    return true
  })
}

export async function atomicWriteImageLocked(imagePath, metaPath, blob, metaBody) {
  return withWriteLock(imagePath, async () => {
    await atomicRename(imagePath, blob)
    await atomicRename(metaPath, metaBody)
  })
}

function fnv1a(value) {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export function safeName(value) {
  const raw = String(value ?? '')
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '')
  if (cleaned === raw && raw.length > 0) return raw
  return `${cleaned}-${fnv1a(raw).toString(36)}`
}
