import { afterEach, expect, it, vi } from 'vitest'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { accountStoragePolicy, accountAssetUsage, withAccountAssetBudget, handleAccountStorageRequest } from '../../scripts/account-storage-quota.mjs'

const roots: string[] = []
const owner = 'ABCDEFGHIJKL'
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'stars-quota-test-'))
  roots.push(root)
  const imageRoot = path.join(root, 'images', 'rooms', `campaign-${owner}-ONE`)
  await mkdir(imageRoot, { recursive: true })
  return { root, imageRoot }
}
afterEach(async () => {
  vi.unstubAllEnvs()
  for (const root of roots.splice(0)) {
    expect(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep)).toBe(true)
    await rm(root, { recursive: true, force: true })
  }
})
it('restricts upgrades to configured administrators and persists the selected quota', async () => {
  const mutateAccount = vi.fn<Parameters<typeof handleAccountStorageRequest>[4]['mutateAccount']>(async (_ctx, accountId, update) => update({ accountId }))
  const writeJson = vi.fn()
  class ProtocolError extends Error { statusCode: number; constructor(statusCode: number, code: string) { super(code); this.statusCode = statusCode } }
  const dependencies = { authenticateAccount: async () => ({ accountId: owner }), readJsonRequest: async () => ({ plan: 'upgraded', quotaBytes: null }), mutateAccount, writeJson, RoomProtocolError: ProtocolError }
  const route = new URL(`http://localhost/api/accounts/admin/storage/${owner}`)
  vi.stubEnv('STARS_ACCOUNT_ADMIN_ACCOUNT_IDS', '')
  await expect(handleAccountStorageRequest({ method: 'PUT' }, {}, route, {}, dependencies)).rejects.toMatchObject({ statusCode: 403 })
  expect(mutateAccount).not.toHaveBeenCalled()
  vi.stubEnv('STARS_ACCOUNT_ADMIN_ACCOUNT_IDS', owner)
  expect(await handleAccountStorageRequest({ method: 'PUT' }, {}, route, {}, dependencies)).toBe(true)
  expect(writeJson).toHaveBeenLastCalledWith({}, 200, { plan: 'upgraded', limitBytes: 50 * 1024 ** 3 })
})
it('grants 5 GiB / 50 GiB and applies only server-stored quota overrides', () => {
  expect(accountStoragePolicy({}).limitBytes).toBe(5 * 1024 ** 3)
  expect(accountStoragePolicy({ storagePlan: 'upgraded' }).limitBytes).toBe(50 * 1024 ** 3)
  expect(accountStoragePolicy({ storageQuotaBytes: -1 }).limitBytes).toBe(5 * 1024 ** 3)
})
it('counts all owner campaigns, excludes other accounts, and preserves old images on rejection', async () => {
  const { root, imageRoot } = await fixture()
  const second = path.join(root, 'images', 'rooms', `campaign-${owner}-TWO`)
  const foreign = path.join(root, 'images', 'rooms', 'campaign-ZYXWVUTSRQPO-OTHER')
  await mkdir(second, { recursive: true }); await mkdir(foreign, { recursive: true })
  await writeFile(path.join(imageRoot, 'active-map'), '123')
  await writeFile(path.join(second, 'handout'), '45')
  await writeFile(path.join(foreign, 'foreign'), '12345678')
  expect(await accountAssetUsage(root, owner)).toEqual({ usedBytes: 5, assetCount: 2 })
  await expect(withAccountAssetBudget({ sharedRoot: root, accountId: owner, account: { storageQuotaBytes: 5 }, imageRoot, writes: [{ id: 'new', bytes: 1 }] }, () => writeFile(path.join(imageRoot, 'new'), 'x'))).rejects.toMatchObject({ statusCode: 413 })
  expect(await readFile(path.join(imageRoot, 'active-map'), 'utf8')).toBe('123')
})
it('serializes competing uploads and allows shrinking after downgrade', async () => {
  const { root, imageRoot } = await fixture()
  const upload = (id: string, content: string, quota = 5) => withAccountAssetBudget({ sharedRoot: root, accountId: owner, account: { storageQuotaBytes: quota }, imageRoot, writes: [{ id, bytes: content.length }] }, () => writeFile(path.join(imageRoot, id), content))
  const results = await Promise.allSettled([upload('a', '1234'), upload('b', '1234')])
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
  const id = results[0].status === 'fulfilled' ? 'a' : 'b'
  await upload(id, '12', 1)
  expect((await accountAssetUsage(root, owner)).usedBytes).toBe(2)
})
