import { expect, test, type APIRequestContext, type BrowserContext } from '@playwright/test'

const APP = 'http://127.0.0.1:6176'
const ACCOUNT_SESSION_KEY = 'stars-account-session:v1'
const ROOM_SESSION_KEY = 'stars-room-session:v1'

interface AccountSession {
  accountId: string
  displayName: string
  sessionToken: string
  createdAt: number
}

interface CreatedRoom {
  roomId: string
  campaignId: string
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

interface CreatedCampaign {
  campaignId: string
  name: string
}

async function createAccount(request: APIRequestContext, suffix: number): Promise<AccountSession> {
  const response = await request.post(`${APP}/api/accounts`, {
    data: { displayName: `工作台 DM ${suffix}`, clientId: `workspace-account-${suffix}` },
  })
  expect(response.status()).toBe(201)
  return (await response.json() as { session: AccountSession }).session
}

async function createRoom(
  request: APIRequestContext,
  account: AccountSession,
  campaign: CreatedCampaign,
  suffix: number,
): Promise<CreatedRoom> {
  const response = await request.post(`${APP}/api/accounts/me/campaigns/${campaign.campaignId}/rooms`, {
    headers: { 'X-Stars-Account-Token': account.sessionToken },
    data: {
      roomName: `独立战役工作台 ${suffix}`,
      displayName: account.displayName,
      clientId: `workspace-room-${suffix}`,
      accountId: account.accountId,
      activePlugins: [],
    },
  })
  expect(response.status()).toBe(201)
  return await response.json() as CreatedRoom
}

async function createCampaign(
  request: APIRequestContext,
  account: AccountSession,
  suffix: number,
): Promise<CreatedCampaign> {
  const response = await request.post(`${APP}/api/accounts/me/campaigns`, {
    headers: { 'X-Stars-Account-Token': account.sessionToken },
    data: {
      name: `长期测试战役 ${suffix}`,
      description: '跨临时房间继续使用同一个战役工作台。',
      rulesetId: 'dnd5e-2014-srd-5.1',
    },
  })
  expect(response.status()).toBe(201)
  return await response.json() as CreatedCampaign
}

async function installSessions(
  context: BrowserContext,
  account: AccountSession,
  room: CreatedRoom,
): Promise<void> {
  await context.addInitScript(([accountKey, accountValue, roomKey, roomValue]) => {
    localStorage.setItem(accountKey, JSON.stringify(accountValue))
    localStorage.setItem(roomKey, JSON.stringify(roomValue))
  }, [
    ACCOUNT_SESSION_KEY,
    account,
    ROOM_SESSION_KEY,
    {
      roomId: room.roomId,
      campaignId: room.campaignId,
      roomName: room.roomName,
      rulesetId: room.rulesetId,
      createdAt: room.createdAt,
      ...room.member,
    },
  ] as const)
}

async function installAccount(context: BrowserContext, account: AccountSession): Promise<void> {
  await context.addInitScript(([accountKey, accountValue]) => {
    localStorage.setItem(accountKey, JSON.stringify(accountValue))
  }, [ACCOUNT_SESSION_KEY, account] as const)
}

test('公开产品网站与登录后的 APP 使用独立入口', async ({ page }) => {
  await page.goto(`${APP}/`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: /记录每一场冒险/ })).toBeVisible()
  await expect(page.getByRole('link', { name: '进入 APP', exact: true }).first()).toHaveAttribute('href', '/app')

  await page.getByRole('link', { name: '战斗', exact: true }).click()
  await expect(page).toHaveURL(`${APP}/combat`)
  await expect(page.getByRole('heading', { name: '规则在后台运行，故事留在桌面上' })).toBeVisible()

  await page.goto(`${APP}/app`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: /登录星痕/ })).toBeVisible()
  await expect(page.getByTestId('account-nav-campaigns')).toHaveAttribute('aria-current', 'page')
})

test('账号控制台、房间入口和战役工作台使用独立路由外壳', async ({ browser, request }) => {
  const suffix = Date.now()
  const account = await createAccount(request, suffix)
  const campaign = await createCampaign(request, account, suffix)
  const room = await createRoom(request, account, campaign, suffix)
  const context = await browser.newContext()
  await installSessions(context, account, room)
  const page = await context.newPage()

  await page.goto(`${APP}/app`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: '我的战役' })).toBeVisible()
  await expect(page.getByText(campaign.name, { exact: true })).toBeVisible()
  await expect(page.getByText(room.roomId)).toBeVisible()
  await page.getByTestId('open-active-campaign').click()

  await expect(page).toHaveURL(`${APP}/campaign/${campaign.campaignId}/overview`)
  await expect(page.getByRole('link', { name: '战斗地图' })).toHaveAttribute(
    'href',
    `/campaign/${campaign.campaignId}/maps`,
  )
  await expect(page.getByRole('link', { name: '打开模拟器' })).toHaveAttribute(
    'href',
    `/campaign/${campaign.campaignId}/simulation`,
  )
  await expect(page.getByRole('link', { name: '查看角色页' })).toHaveAttribute(
    'href',
    `/campaign/${campaign.campaignId}/characters`,
  )
  await expect(page.getByRole('link', { name: '设置' })).toHaveAttribute(
    'href',
    `/campaign/${campaign.campaignId}/settings`,
  )

  await page.getByRole('link', { name: '战役列表' }).click()
  await expect(page).toHaveURL(`${APP}/app`)
  await page.getByTestId('account-nav-rooms').click()
  await expect(page).toHaveURL(`${APP}/app/rooms`)
  await expect(page.getByTestId('account-nav-rooms')).toHaveAttribute('aria-current', 'page')

  await page.goto(`${APP}/maps`)
  await expect(page).toHaveURL(`${APP}/campaign/${campaign.campaignId}/maps`)
  await page.goto(`${APP}/campaign/ZZZZZZ/maps`)
  await expect(page).toHaveURL(`${APP}/campaign/${campaign.campaignId}/overview`)

  await context.close()
})

test('可从账号战役页创建长期战役并为它开启第一场临时房间', async ({ browser, request }) => {
  const suffix = Date.now()
  const account = await createAccount(request, suffix)
  const context = await browser.newContext()
  await installAccount(context, account)
  const page = await context.newPage()

  await page.goto(`${APP}/app`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: '新建战役' }).click()
  await page.getByPlaceholder('例如：失落矿坑').fill(`浏览器战役 ${suffix}`)
  await page.getByPlaceholder('记录冒险主题、队伍或当前章节').fill('长期资料不会随房间关闭而丢失。')
  await page.getByRole('button', { name: '保存战役' }).click()
  await expect(page.getByText(`浏览器战役 ${suffix}`, { exact: true })).toBeVisible()

  await page.getByRole('link', { name: '开始第一场游戏' }).click()
  await expect(page).toHaveURL(/\/app\/rooms\?mode=create&campaign=[A-HJ-NP-Z2-9]{12}$/)
  await expect(page.getByLabel('长期战役')).toContainText(`浏览器战役 ${suffix}`)
  await page.getByLabel('房间名称').fill(`第一场 ${suffix}`)
  await page.getByLabel('DM 称呼').fill('测试 DM')
  await page.getByRole('button', { name: '创建并以 DM 身份进入' }).click()

  await expect(page).toHaveURL(new RegExp(`${APP}/campaign/[A-HJ-NP-Z2-9]{12}/overview$`))
  await expect(page.getByText(`第一场 ${suffix}`, { exact: true })).toBeVisible()
  await context.close()
})

test('登录同一账号后可在新设备接管未关闭的 DM 房间', async ({ browser, request }) => {
  const suffix = Date.now()
  const account = await createAccount(request, suffix)
  const campaign = await createCampaign(request, account, suffix)
  const room = await createRoom(request, account, campaign, suffix)
  const context = await browser.newContext()
  await installAccount(context, account)
  const page = await context.newPage()

  await page.goto(`${APP}/app`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByText(campaign.name, { exact: true })).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: '接管当前 DM 房间' }).click()
  await expect(page).toHaveURL(`${APP}/campaign/${campaign.campaignId}/overview`)

  const restoredSession = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), ROOM_SESSION_KEY) as {
    roomId: string
    campaignId: string
    roomToken: string
  }
  expect(restoredSession).toMatchObject({
    roomId: room.roomId,
    campaignId: campaign.campaignId,
  })
  expect(restoredSession.roomToken).not.toBe(room.member.roomToken)

  const oldCredentialResponse = await request.get(`${APP}/api/state/maps?room=${room.roomId}`, {
    headers: {
      'X-Stars-Protocol': '5',
      'X-Stars-Member': room.member.memberId,
      'X-Stars-Room-Token': room.member.roomToken,
    },
  })
  expect(oldCredentialResponse.status()).toBe(403)
  await context.close()
})
