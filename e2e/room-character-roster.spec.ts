import { expect, test } from '@playwright/test'
import { createCoreFighter } from './support/characterCreation'

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
    roomToken: string
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

  await createCoreFighter(player, { name: '爱丽丝的战士' })

  const currentHp = player.getByRole('spinbutton', { name: '当前生命值' })
  await currentHp.fill('1')
  await player.getByRole('spinbutton', { name: '生命值变化量' }).fill('3')
  await player.getByRole('button', { name: '恢复生命值' }).click()
  await expect(currentHp).toHaveValue('4')
  await expect.poll(async () => {
    const response = await request.get(`${DM}/api/state/characters?room=${created.roomId}`, {
      headers: { 'X-Stars-Member': joined.member.memberId, 'X-Stars-Room-Token': joined.member.roomToken },
    })
    if (!response.ok()) return null
    const state = await response.json() as { characters?: Array<{ name?: string; currentHp?: number }> }
    return state.characters?.find((character) => character.name === '爱丽丝的战士')?.currentHp ?? null
  }, { timeout: 20_000 }).toBe(4)

  const roster = dm.getByTestId('dm-room-player-roster')
  await expect(roster.getByText('爱丽丝', { exact: true })).toBeVisible()
  await expect(roster.getByText('爱丽丝的战士', { exact: true })).toBeVisible({ timeout: 20_000 })
  await roster.getByRole('button', { name: '查看角色卡：爱丽丝的战士' }).click()
  const detail = dm.getByRole('dialog', { name: '爱丽丝的战士的角色卡详情' })
  await expect(detail).toBeVisible()
  await expect(detail.getByText('DM 检视：普通角色字段保持只读；可修订任意一次升级记录，系统会重新推演后续等级。')).toBeVisible()
  await expect(detail.getByRole('textbox', { name: '角色名称' })).toBeDisabled()
  await detail.getByRole('button', { name: '物品栏' }).click()
  await expect(detail.getByTestId('dnd5e-inventory')).toBeVisible()
  await detail.getByRole('button', { name: '关闭角色卡详情' }).click()
  await expect(detail).toHaveCount(0)
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
