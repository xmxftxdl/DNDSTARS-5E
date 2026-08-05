import { createHash } from 'node:crypto'
import { expect, test, type APIRequestContext, type BrowserContext } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'
const ACCOUNT_SESSION_KEY = 'stars-account-session:v1'
const ROOM_SESSION_KEY = 'stars-room-session:v1'

interface AccountSession {
  accountId: string
  displayName: string
  sessionToken: string
  createdAt: number
}

interface RoomMembership {
  roomId: string
  roomName: string
  rulesetId: 'dnd5e-2014-srd-5.1'
  createdAt: number
  member: {
    memberId: string
    roomToken: string
    accountId?: string
    clientId: string
    role: 'dm'
    displayName: string
  }
}

async function createAccount(
  request: APIRequestContext,
  displayName: string,
  clientId: string,
): Promise<AccountSession> {
  const response = await request.post(`${DM}/api/accounts`, {
    data: { displayName, clientId },
  })
  expect(response.status()).toBe(201)
  return (await response.json() as { session: AccountSession }).session
}

async function installBrowserIdentity(
  context: BrowserContext,
  account: AccountSession,
  room?: RoomMembership,
): Promise<void> {
  await context.addInitScript(([accountKey, accountSession, roomKey, roomSession]) => {
    localStorage.setItem(accountKey, JSON.stringify(accountSession))
    if (roomSession) localStorage.setItem(roomKey, JSON.stringify(roomSession))
  }, [
    ACCOUNT_SESSION_KEY,
    account,
    ROOM_SESSION_KEY,
    room ? {
      roomId: room.roomId,
      roomName: room.roomName,
      rulesetId: room.rulesetId,
      createdAt: room.createdAt,
      ...room.member,
    } : null,
  ] as const)
}

test('账号插件可发布到公开目录、由另一账号保存并原子启用到房间', async ({ browser, request }) => {
  test.setTimeout(120_000)
  const suffix = Date.now()
  const pluginId = `e2e.catalog.lifecycle-${suffix}`
  const pluginName = `目录生命周期 ${suffix}`
  const version = '1.0.0'
  const publisher = await createAccount(request, '目录发布者', `catalog-publisher-${suffix}`)
  const dmAccount = await createAccount(request, '目录安装 DM', `catalog-dm-${suffix}`)

  const packageValue = {
    format: 'dndstars5e-declarative',
    schemaVersion: 1,
    manifest: {
      id: pluginId,
      name: pluginName,
      version,
      apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1',
      stateSchemaVersion: 1,
      manifestSchemaVersion: 1,
      minimumGameProtocolVersion: 5,
      dependencies: [],
      conflicts: [],
      declaredCapabilities: [],
      distributionPolicy: 'room-distributable',
      contentCategory: 'rules',
      publisher: publisher.displayName,
      license: 'CC0-1.0',
      description: '浏览器端公开目录生命周期测试。',
    },
    subclasses: [],
    legacy: {
      manifest: { id: pluginId },
      races: [],
      backgrounds: [],
      features: [],
      spells: [],
      items: [],
      abilityGenerationMethods: [],
    },
  }
  const bytes = Buffer.from(JSON.stringify(packageValue), 'utf8')
  const integrity = `sha256-${createHash('sha256').update(bytes).digest('base64')}`
  const accountPath = `/api/accounts/me/plugins/${encodeURIComponent(pluginId)}/versions/${version}`
  const uploaded = await request.put(`${DM}${accountPath}`, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Stars-Account-Token': publisher.sessionToken,
      'X-Stars-Plugin-Version': version,
      'X-Stars-Plugin-Integrity': integrity,
      'X-Stars-Plugin-Filename': encodeURIComponent(`${pluginId}.dndstars5e`),
      'X-Stars-Plugin-Name': encodeURIComponent(pluginName),
      'X-Stars-Plugin-Publisher': encodeURIComponent(publisher.displayName),
      'X-Stars-Plugin-License': encodeURIComponent('CC0-1.0'),
      'X-Stars-Plugin-State-Schema': '1',
      'X-Stars-Plugin-Api-Version': '2',
      'X-Stars-Plugin-Ruleset': 'dnd5e-2014-srd-5.1',
      'X-Stars-Plugin-Description': encodeURIComponent('浏览器端公开目录生命周期测试。'),
      'X-Stars-Plugin-Metadata': encodeURIComponent(JSON.stringify({
        manifestSchemaVersion: 1,
        minimumGameProtocolVersion: 5,
        dependencies: [],
        conflicts: [],
        declaredCapabilities: [],
        distributionPolicy: 'room-distributable',
        contentCategory: 'rules',
      })),
    },
    data: bytes,
  })
  expect(uploaded.status()).toBe(201)

  const publisherContext = await browser.newContext()
  await installBrowserIdentity(publisherContext, publisher)
  const publisherPage = await publisherContext.newPage()
  await publisherPage.goto(`${DM}/plugins`, { waitUntil: 'domcontentloaded' })
  const privateVersion = publisherPage.locator('article').filter({ hasText: pluginId })
  await expect(privateVersion).toBeVisible()
  await privateVersion.getByRole('button', { name: '发布到目录' }).click()
  const publicationDialog = publisherPage.getByRole('dialog', { name: '提交扩展市场审核' })
  await publicationDialog.locator('textarea').first().fill('用于验证扩展市场公开发布、账号保存与房间原子启用的完整生命周期测试。')
  await publicationDialog.getByRole('checkbox').last().check()
  await publicationDialog.getByRole('button', { name: '提交人工审核' }).click()
  await expect(publisherPage.getByText(`${pluginName} v${version} 已发布到公开目录。`)).toBeVisible()
  await publisherContext.close()

  const roomResponse = await request.post(`${DM}/api/rooms`, {
    headers: { 'X-Stars-Account-Token': dmAccount.sessionToken },
    data: {
      roomName: `插件目录房间 ${suffix}`,
      displayName: dmAccount.displayName,
      rulesetId: 'dnd5e-2014-srd-5.1',
      clientId: `catalog-room-dm-${suffix}`,
      accountId: dmAccount.accountId,
      activePlugins: [],
    },
  })
  expect(roomResponse.status()).toBe(201)
  const room = await roomResponse.json() as RoomMembership

  const dmContext = await browser.newContext()
  await installBrowserIdentity(dmContext, dmAccount, room)
  const dmPage = await dmContext.newPage()
  await dmPage.goto(`${DM}/plugins`, { waitUntil: 'domcontentloaded' })
  await dmPage.getByRole('button', { name: '扩展市场' }).click()
  await dmPage.getByRole('textbox', { name: '搜索插件' }).fill(pluginId)
  await dmPage.getByRole('button', { name: '搜索', exact: true }).click()
  const catalogVersion = dmPage.locator('article').filter({ hasText: pluginId })
  await expect(catalogVersion).toContainText(pluginName)
  await catalogVersion.getByRole('button', { name: '安装并激活' }).click()
  await expect(dmPage.getByText(`已安装 ${pluginName} v${version}，并激活到当前房间；玩家端将自动下载。`)).toBeVisible({
    timeout: 20_000,
  })

  await dmPage.reload({ waitUntil: 'domcontentloaded' })
  await dmPage.getByRole('button', { name: '我的插件', exact: true }).click()
  await expect(dmPage.locator('article').filter({ hasText: pluginId })
    .getByRole('button', { name: '房间已启用' })).toBeDisabled({ timeout: 20_000 })

  const rules = await request.get(`${DM}/api/rooms/${room.roomId}/rules`, {
    headers: {
      'X-Stars-Account-Token': dmAccount.sessionToken,
      'X-Stars-Member': room.member.memberId,
      'X-Stars-Room-Token': room.member.roomToken,
    },
  })
  expect(rules.ok()).toBeTruthy()
  await expect(rules.json()).resolves.toMatchObject({
    requiredPlugins: [{ id: pluginId, version, integrity, stateSchemaVersion: 1 }],
  })
  await dmContext.close()
})
