import { expect, test } from '@playwright/test'
import { createCoreFighter } from './support/characterCreation'

test('single-level advancement persists and survives an immediate refresh', async ({ page, request }) => {
  const name = `等级回归-${Date.now()}`
  const created = await (await request.post('http://127.0.0.1:6173/api/rooms', {
    data: {
      roomName: '等级保存回归',
      displayName: '等级测试 DM',
      rulesetId: 'dnd5e-2014-srd-5.1',
      clientId: `level-dm-${Date.now()}`,
    },
  })).json() as {
    roomId: string
    roomName: string
    rulesetId: 'dnd5e-2014-srd-5.1'
    createdAt: number
  }
  const joined = await (await request.post(`http://127.0.0.1:6173/api/rooms/${created.roomId}/join`, {
    data: { displayName: '等级测试玩家', clientId: `level-player-${Date.now()}` },
  })).json() as {
    member: {
      memberId: string
      roomToken: string
      clientId: string
      role: 'player'
      slot: 'player1'
      displayName: string
    }
  }
  // 角色由玩家端创建和编辑；DM 的角色页现在是只读房间成员名册。
  await page.goto('http://127.0.0.1:6174/characters', { waitUntil: 'domcontentloaded' })
  await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [
    'stars-room-session:v1',
    { ...created, ...joined.member },
  ] as const)
  await page.reload({ waitUntil: 'domcontentloaded' })

  await createCoreFighter(page, { name })
  await expect(page.getByText('1', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '提升至 2 级' }).click()
  await page.getByRole('dialog', { name: /战士 1 → 2 级/ }).getByRole('button', { name: '确认升级' }).click()
  await expect(page.getByRole('button', { name: '提升至 3 级' })).toBeVisible()

  // The advancement is an atomic durable transaction. An immediate refresh
  // must not restore the pre-upgrade snapshot.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: '提升至 3 级' })).toBeVisible()

  await expect.poll(async () => {
    const response = await request.get(`http://127.0.0.1:6173/api/state/characters?room=${created.roomId}`, {
      headers: { 'X-Stars-Member': joined.member.memberId, 'X-Stars-Room-Token': joined.member.roomToken },
    })
    if (!response.ok()) return null
    const state = await response.json() as { characters?: Array<{ name?: string; level?: number }> }
    return state.characters?.find((character) => character.name === name)?.level ?? null
  }).toBe(2)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: '提升至 3 级' })).toBeVisible()
})
