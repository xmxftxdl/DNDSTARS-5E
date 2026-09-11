import fs from 'node:fs'
import assert from 'node:assert/strict'
const file = 'scripts/shared-server-core.mjs'
let source = fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n')
function replace(old, next) { assert(source.includes(old), old.slice(0,100)); source = source.replace(old, next) }
source = "import { accountStoragePolicy, accountAssetUsage, withAccountAssetBudget } from './account-storage-quota.mjs'\n" + source
replace('return { ...storage, roomId, campaignId }', 'return { ...storage, roomId, campaignId, campaignOwnerAccountId: normalizedOwnerAccountId }')
const start = source.indexOf('export async function enforceImageQuota(')
const end = source.indexOf('// ── AC3', start)
assert(start > 0 && end > start)
source = source.slice(0,start) + `// Retained for compatibility. Account byte budgets are checked before writes.
export async function enforceImageQuota() { return [] }

` + source.slice(end)
replace('await atomicWriteImageLocked(filePath, metaPath, body, metaBody)', `await withAccountAssetBudget({
          sharedRoot: ctx.sharedRoot, accountId: ctx.campaignOwnerAccountId,
          account: ctx.campaignOwnerAccountId ? await readAccount(ctx, ctx.campaignOwnerAccountId) : null,
          imageRoot: ctx.imageRoot, writes: [{ id, bytes: body.length }],
        }, () => atomicWriteImageLocked(filePath, metaPath, body, metaBody))`)
replace("if (Array.isArray(value?.images) && value.images.length > IMAGE_COUNT_LIMIT) errors.push('too-many-images')", "if (Array.isArray(value?.images) && value.images.length > 10000) errors.push('too-many-images')")
replace('async function restoreCampaignBundle(ctx, bundle, options = {}) {', `async function restoreCampaignBundle(ctx, bundle, options = {}) {
  const validation = validateCampaignBundle(bundle)
  if (!validation.ok) throw new RoomProtocolError(422, 'campaign-preflight-failed')
  return withAccountAssetBudget({
    sharedRoot: ctx.sharedRoot, accountId: ctx.campaignOwnerAccountId,
    account: ctx.campaignOwnerAccountId ? await readAccount(ctx, ctx.campaignOwnerAccountId) : null,
    imageRoot: ctx.imageRoot,
    writes: bundle.images.map(image => ({ id: safeName(image.id), bytes: Buffer.from(image.data, 'base64').length })),
  }, () => restoreCampaignBundleWithinBudget(ctx, bundle, options))
}

async function restoreCampaignBundleWithinBudget(ctx, bundle, options = {}) {`)
replace("  if (parsed.pathname === '/api/accounts/me' && req.method === 'GET') {", `  if (parsed.pathname === '/api/accounts/me/storage' && req.method === 'GET') {
    const account = await authenticateAccount(req, ctx)
    writeJson(res, 200, { ...accountStoragePolicy(account), ...await accountAssetUsage(ctx.sharedRoot, account.accountId) })
    return true
  }
  const storageAdminMatch = parsed.pathname.match(/^\\/api\\/accounts\\/admin\\/storage\\/([A-Z0-9]{12})$/)
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

  if (parsed.pathname === '/api/accounts/me' && req.method === 'GET') {`)
fs.writeFileSync(file, source)
