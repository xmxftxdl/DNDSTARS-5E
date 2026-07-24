import { expect, test, type BrowserContext } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'
const PLAYER = 'http://127.0.0.1:6174'
const PLAYER2 = 'http://127.0.0.1:6175'
const SESSION_KEY = 'stars-room-session:v1'

interface Membership {
  roomId: string
  roomName: string
  rulesetId: 'dnd5e-2014-srd-5.1'
  createdAt: number
  member: {
    memberId: string
    roomToken: string
    clientId: string
    role: 'dm' | 'player'
    slot?: `player${number}`
    displayName: string
  }
}

function sessionFrom(response: Membership) {
  return { roomId: response.roomId, roomName: response.roomName, rulesetId: response.rulesetId, createdAt: response.createdAt, ...response.member }
}

async function setSession(context: BrowserContext, membership: Membership) {
  await context.addInitScript(([key, session]) => localStorage.setItem(key, JSON.stringify(session)), [SESSION_KEY, sessionFrom(membership)] as const)
}

async function installNonVoidScrollIntoView(context: BrowserContext) {
  await context.addInitScript(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value() {
        return { animated: true }
      },
    })
  })
}

test('chat, private DM notes, server rolls and targeted handouts synchronize across ports', async ({ browser, request }) => {
  const createdResponse = await request.post(`${DM}/api/rooms`, {
    data: { roomName: '通讯 E2E', displayName: '测试 DM', rulesetId: 'dnd5e-2014-srd-5.1', clientId: `communications-dm-${Date.now()}` },
  })
  expect(createdResponse.ok()).toBeTruthy()
  const dm = await createdResponse.json() as Membership
  const join = async (displayName: string, suffix: string) => {
    const response = await request.post(`${DM}/api/rooms/${dm.roomId}/join`, {
      data: { displayName, clientId: `communications-${suffix}-${Date.now()}`, activePlugins: [] },
    })
    expect(response.ok()).toBeTruthy()
    return response.json() as Promise<Membership>
  }
  const playerA = await join('玩家甲', 'a')
  const playerB = await join('玩家乙', 'b')

  const dmContext = await browser.newContext()
  const playerAContext = await browser.newContext()
  const playerBContext = await browser.newContext()
  await Promise.all([
    installNonVoidScrollIntoView(dmContext),
    installNonVoidScrollIntoView(playerAContext),
    installNonVoidScrollIntoView(playerBContext),
  ])
  await setSession(dmContext, dm)
  await setSession(playerAContext, playerA)
  await setSession(playerBContext, playerB)
  const dmPage = await dmContext.newPage()
  const playerAPage = await playerAContext.newPage()
  const playerBPage = await playerBContext.newPage()

  await Promise.all([
    dmPage.goto(`${DM}/communications`, { waitUntil: 'domcontentloaded' }),
    playerAPage.goto(`${PLAYER}/communications`, { waitUntil: 'domcontentloaded' }),
    playerBPage.goto(`${PLAYER2}/communications`, { waitUntil: 'domcontentloaded' }),
  ])

  await playerAPage.getByRole('button', { name: 'OOC · 角色外' }).click()
  await playerAPage.getByPlaceholder(/输入消息/).fill('/roll 2d6+3 搜索暗门')
  await playerAPage.getByPlaceholder(/输入消息/).press('Enter')
  await expect(playerAPage.getByText('2d6+3', { exact: true })).toBeVisible()
  await dmPage.getByRole('button', { name: 'OOC · 角色外' }).click()
  await expect(dmPage.getByText('搜索暗门')).toBeVisible()

  await expect.poll(async () => {
    const response = await request.get(`${DM}/api/state/combat-log?room=${dm.roomId}`, {
      headers: { 'X-Stars-Member': dm.member.memberId, 'X-Stars-Room-Token': dm.member.roomToken },
    })
    const body = await response.json() as { entries?: Array<{ text: string }> }
    return body.entries?.some((entry) => entry.text.includes('2d6+3')) ?? false
  }).toBe(true)

  await playerAPage.getByRole('button', { name: '私聊 DM' }).click()
  await playerAPage.getByPlaceholder(/纸条/).fill('我悄悄检查守卫的口袋。')
  await playerAPage.getByPlaceholder(/纸条/).press('Enter')
  await dmPage.getByRole('button', { name: '私聊 DM' }).click()
  await expect(dmPage.getByText('我悄悄检查守卫的口袋。')).toBeVisible()
  await playerBPage.getByRole('button', { name: '私聊 DM' }).click()
  await expect(playerBPage.getByText('我悄悄检查守卫的口袋。')).toHaveCount(0)

  await dmPage.getByRole('button', { name: '讲义' }).click()
  await dmPage.getByPlaceholder('讲义标题').fill('只给甲的密信')
  await dmPage.getByPlaceholder(/信件正文/).fill('午夜到旧钟楼来。')
  await dmPage.locator('select').filter({ has: dmPage.locator('option[value="selected"]') }).selectOption('selected')
  await dmPage.getByLabel('玩家甲', { exact: true }).check()
  await dmPage.getByRole('button', { name: '分发讲义' }).click()
  await expect(dmPage.getByText('只给甲的密信')).toBeVisible()

  await playerAPage.getByRole('button', { name: /讲义/ }).click()
  await expect(playerAPage.getByText('只给甲的密信')).toBeVisible()
  await playerBPage.getByRole('button', { name: /讲义/ }).click()
  await expect(playerBPage.getByText('只给甲的密信')).toHaveCount(0)

  await Promise.all([dmContext.close(), playerAContext.close(), playerBContext.close()])
})
