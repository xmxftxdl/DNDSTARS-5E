import { expect, test } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'
const PLAYER = 'http://127.0.0.1:6174'
const SESSION_KEY = 'stars-room-session:v1'

interface RoomMembershipResponse {
  roomId: string
  roomName: string
  rulesetId: 'dnd5e-2014-srd-5.1'
  createdAt: number
  member: {
    memberId: string
    clientId: string
    role: 'dm' | 'player'
    slot?: 'player1' | 'player2' | 'player3'
    displayName: string
  }
}

function sessionFrom(response: RoomMembershipResponse) {
  return {
    roomId: response.roomId,
    roomName: response.roomName,
    rulesetId: response.rulesetId,
    createdAt: response.createdAt,
    ...response.member,
  }
}

test('DM character page is a read-only room-player roster', async ({ browser, request }) => {
  const createdResponse = await request.post(`${DM}/api/rooms`, {
    data: {
      roomName: 'E2E 房间名册',
      displayName: 'E2E DM',
      rulesetId: 'dnd5e-2014-srd-5.1',
      clientId: 'e2e-roster-dm-client',
    },
  })
  expect(createdResponse.ok()).toBeTruthy()
  const created = await createdResponse.json() as RoomMembershipResponse
  const joinedResponse = await request.post(`${DM}/api/rooms/${created.roomId}/join`, {
    data: { displayName: '爱丽丝', clientId: 'e2e-roster-player-client' },
  })
  expect(joinedResponse.ok()).toBeTruthy()
  const joined = await joinedResponse.json() as RoomMembershipResponse

  const dmContext = await browser.newContext()
  const playerContext = await browser.newContext()
  const dm = await dmContext.newPage()
  const player = await playerContext.newPage()
  await dm.goto(`${DM}/characters`, { waitUntil: 'domcontentloaded' })
  await dm.evaluate(([key, session]) => localStorage.setItem(key, JSON.stringify(session)), [SESSION_KEY, sessionFrom(created)] as const)
  await dm.reload({ waitUntil: 'domcontentloaded' })
  await player.goto(`${PLAYER}/characters`, { waitUntil: 'domcontentloaded' })
  await player.evaluate(([key, session]) => localStorage.setItem(key, JSON.stringify(session)), [SESSION_KEY, sessionFrom(joined)] as const)
  await player.reload({ waitUntil: 'domcontentloaded' })

  await player.getByRole('button', { name: '新建角色' }).click()
  await player.getByRole('button', { name: /经验丰富的冒险者/ }).click()
  await player.getByRole('button', { name: '选择属性方式' }).click()
  await player.getByRole('button', { name: /标准数组/ }).click()
  await player.getByRole('button', { name: '开始分配' }).click()
  await player.getByRole('button', { name: '加入种族调整' }).click()
  await player.getByRole('textbox', { name: '角色名称' }).fill('爱丽丝的战士')
  await player.getByRole('button', { name: '创建角色' }).click()

  const roster = dm.getByTestId('dm-room-player-roster')
  await expect(roster.getByText('爱丽丝', { exact: true })).toBeVisible()
  await expect(roster.getByText('爱丽丝的战士', { exact: true })).toBeVisible({ timeout: 20_000 })
  await expect(dm.getByRole('button', { name: '新建角色' })).toHaveCount(0)
  await expect(dm.getByTitle('删除')).toHaveCount(0)
  await expect(dm.getByText('一键短休')).toHaveCount(0)

  await dmContext.close()
  await playerContext.close()
})

test('DM character page migrates a legacy roster response without plugin readiness fields', async ({ browser, request }) => {
  const createdResponse = await request.post(`${DM}/api/rooms`, {
    data: {
      roomName: '旧协议名册',
      displayName: '兼容 DM',
      rulesetId: 'dnd5e-2014-srd-5.1',
      clientId: `legacy-roster-dm-${Date.now()}`,
    },
  })
  expect(createdResponse.ok()).toBeTruthy()
  const created = await createdResponse.json() as RoomMembershipResponse

  const context = await browser.newContext()
  const dm = await context.newPage()
  const pageErrors: string[] = []
  dm.on('pageerror', (error) => pageErrors.push(error.message))
  await dm.route('**/api/rooms/*/roster', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        roomId: created.roomId,
        players: [{
          memberId: 'legacy-player',
          displayName: '旧版玩家',
          slot: 'player1',
          joinedAt: Date.now() - 1_000,
          lastSeenAt: Date.now(),
          online: true,
        }],
      }),
    })
  })
  await dm.goto(`${DM}/characters`, { waitUntil: 'domcontentloaded' })
  await dm.evaluate(([key, session]) => localStorage.setItem(key, JSON.stringify(session)), [SESSION_KEY, sessionFrom(created)] as const)
  await dm.reload({ waitUntil: 'domcontentloaded' })

  const roster = dm.getByTestId('dm-room-player-roster')
  await expect(roster.getByText('旧版玩家', { exact: true })).toBeVisible()
  await expect(roster.getByText('规则包已就绪', { exact: true })).toBeVisible()
  expect(pageErrors).toEqual([])
  await context.close()
})
