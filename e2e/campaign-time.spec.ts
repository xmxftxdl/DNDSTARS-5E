import { expect, test, type BrowserContext } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'
const PLAYER = 'http://127.0.0.1:6174'
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

test('DM campaign clock, timers and expiry synchronize to the player port', async ({ browser, request }) => {
  const createdResponse = await request.post(`${DM}/api/rooms`, {
    data: { roomName: '战役时间 E2E', displayName: '时间 DM', rulesetId: 'dnd5e-2014-srd-5.1', clientId: `campaign-time-dm-${Date.now()}` },
  })
  expect(createdResponse.ok()).toBeTruthy()
  const dm = await createdResponse.json() as Membership
  const joinedResponse = await request.post(`${DM}/api/rooms/${dm.roomId}/join`, {
    data: { displayName: '时间玩家', clientId: `campaign-time-player-${Date.now()}`, activePlugins: [] },
  })
  expect(joinedResponse.ok()).toBeTruthy()
  const player = await joinedResponse.json() as Membership

  const dmContext = await browser.newContext()
  const playerContext = await browser.newContext()
  await setSession(dmContext, dm)
  await setSession(playerContext, player)
  const dmPage = await dmContext.newPage()
  const playerPage = await playerContext.newPage()
  await Promise.all([
    dmPage.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' }),
    playerPage.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' }),
  ])

  await expect(dmPage.getByRole('button', { name: /战役时间.*第 1 日 08:00/ })).toBeVisible()
  await dmPage.getByRole('button', { name: /战役时间.*第 1 日 08:00/ }).click()
  await dmPage.getByRole('button', { name: '+10 分钟', exact: true }).click()
  await expect(dmPage.getByText('第 1 日 08:10', { exact: true }).first()).toBeVisible()
  await expect(playerPage.getByRole('button', { name: /战役时间.*第 1 日 08:10/ })).toBeVisible()

  const manualTimeSection = dmPage.locator('section').filter({ hasText: '手动设定当前时间' })
  await manualTimeSection.getByRole('button', { name: '公历日期', exact: true }).click()
  await manualTimeSection.locator('input[type="date"]').fill('1992-10-10')
  await manualTimeSection.locator('input[type="time"]').fill('14:30')
  await manualTimeSection.getByRole('button', { name: '应用时间', exact: true }).click()
  await expect(dmPage.getByText('1992年10月10日 14:30', { exact: true }).first()).toBeVisible()
  await expect(playerPage.getByRole('button', { name: /战役时间.*1992年10月10日 14:30/ })).toBeVisible()

  const timerSection = dmPage.locator('section').filter({ hasText: '新建分钟级提醒' })
  await timerSection.getByPlaceholder('例如：隐形术专注到期').fill('侦测魔法专注到期')
  await timerSection.getByRole('spinbutton').fill('1')
  await timerSection.getByRole('button', { name: '创建', exact: true }).click()
  await expect(dmPage.getByText('侦测魔法专注到期', { exact: true })).toBeVisible()
  await dmPage.getByRole('button', { name: '+10 分钟', exact: true }).click()
  await expect(playerPage.getByText('战役提醒到期', { exact: true })).toBeVisible()
  await expect(playerPage.getByText('侦测魔法专注到期', { exact: true })).toBeVisible()

  const forbidden = await request.patch(`${DM}/api/state/campaign-time/mutation?room=${dm.roomId}`, {
    headers: {
      'X-Stars-Protocol': '5',
      'X-Stars-Member': player.member.memberId,
      'X-Stars-Room-Token': player.member.roomToken,
    },
    data: { operation: 'advance', minutes: 1 },
  })
  expect(forbidden.status()).toBe(403)

  await Promise.all([dmContext.close(), playerContext.close()])
})
