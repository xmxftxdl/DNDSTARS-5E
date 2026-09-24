import { mkdir, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { withWriteLock } from './adapters/file-atomic-store.mjs'

export const ACCOUNT_STORAGE_PLANS = Object.freeze({ basic: 5 * 1024 ** 3, upgraded: 50 * 1024 ** 3 })
export function accountStoragePolicy(account) {
  const plan = account?.storagePlan === 'upgraded' ? 'upgraded' : 'basic'
  const override = account?.storageQuotaBytes
  return { plan, limitBytes: Number.isSafeInteger(override) && override >= 0 ? override : ACCOUNT_STORAGE_PLANS[plan] }
}

async function entries(directory) {
  try { return await readdir(directory, { withFileTypes: true }) }
  catch (error) { if (error.code === 'ENOENT') return []; throw error }
}
async function assetDirectories(sharedRoot, accountId, currentDirectory) {
  const root = path.join(sharedRoot, 'images', 'rooms')
  const directories = /^[A-Z0-9]{12}$/.test(accountId ?? '')
    ? (await entries(root)).filter(entry => entry.isDirectory() && entry.name.startsWith(`campaign-${accountId}-`)).map(entry => path.join(root, entry.name))
    : []
  if (currentDirectory && !directories.includes(currentDirectory)) directories.push(currentDirectory)
  return directories
}
export async function accountAssetUsage(sharedRoot, accountId, currentDirectory) {
  let usedBytes = 0
  let assetCount = 0
  for (const directory of await assetDirectories(sharedRoot, accountId, currentDirectory)) {
    for (const entry of await entries(directory)) {
      if (!entry.isFile() || !/^[a-zA-Z0-9_-]+$/.test(entry.name)) continue
      try { usedBytes += (await stat(path.join(directory, entry.name))).size; assetCount++ }
      catch (error) { if (error.code !== 'ENOENT') throw error }
    }
  }
  return { usedBytes, assetCount }
}

/** Serialize the byte check and write across every campaign/port of one owner. Never evict assets. */
export async function withAccountAssetBudget({ sharedRoot, accountId, account, imageRoot, writes }, operation) {
  const lockRoot = path.join(sharedRoot, 'quota-locks')
  await mkdir(lockRoot, { recursive: true })
  const ownerKey = createHash('sha256').update(accountId || path.resolve(imageRoot)).digest('hex')
  return withWriteLock(path.join(lockRoot, ownerKey), async () => {
    const usage = await accountAssetUsage(sharedRoot, accountId, imageRoot)
    const policy = accountStoragePolicy(account)
    let delta = 0
    const unique = new Map(writes.map(write => [write.id, write.bytes]))
    for (const [id, bytes] of unique) {
      if (!/^[a-zA-Z0-9_-]+$/.test(id) || !Number.isSafeInteger(bytes) || bytes < 0) throw new Error('invalid-asset-budget')
      let previous = 0
      try { previous = (await stat(path.join(imageRoot, id))).size }
      catch (error) { if (error.code !== 'ENOENT') throw error }
      delta += bytes - previous
    }
    // A downgraded account may replace with equal/smaller files without losing existing content.
    if (delta > 0 && usage.usedBytes + delta > policy.limitBytes) {
      const error = new Error('account-storage-quota-exceeded')
      error.statusCode = 413
      error.quota = { ...usage, ...policy, requiredBytes: usage.usedBytes + delta }
      throw error
    }
    return operation()
  })
}

export async function handleAccountStorageRequest(req, res, parsed, ctx, { authenticateAccount, writeJson, readJsonRequest, mutateAccount, RoomProtocolError }) {
  if (parsed.pathname === '/api/accounts/me/storage' && req.method === 'GET') {
    const account = await authenticateAccount(req, ctx)
    writeJson(res, 200, { ...accountStoragePolicy(account), ...await accountAssetUsage(ctx.sharedRoot, account.accountId) })
    return true
  }
  const storageAdminMatch = parsed.pathname.match(/^\/api\/accounts\/admin\/storage\/([A-Z0-9]{12})$/)
  if (storageAdminMatch && req.method === 'PUT') {
    const administrator = await authenticateAccount(req, ctx)
    const administrators = String(process.env.STARS_ACCOUNT_ADMIN_ACCOUNT_IDS ?? '').split(',').map(value => value.trim())
    if (!administrators.includes(administrator.accountId)) throw new RoomProtocolError(403, 'account-admin-required')
    const payload = await readJsonRequest(req)
    if (!['basic', 'upgraded'].includes(payload?.plan) ||
        (payload.quotaBytes != null && (!Number.isSafeInteger(payload.quotaBytes) || payload.quotaBytes < 0))) {
      throw new RoomProtocolError(400, 'invalid-storage-plan')
    }
    const account = await mutateAccount(ctx, storageAdminMatch[1], current => ({
      ...current, storagePlan: payload.plan, storageQuotaBytes: payload.quotaBytes ?? undefined, updatedAt: Date.now(),
    }))
    writeJson(res, 200, accountStoragePolicy(account))
    return true
  }

  return false
}
