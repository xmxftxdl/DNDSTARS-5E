import { expect, test } from '@playwright/test'

test('character level auto-saves while editing and survives an immediate refresh', async ({ page, request }) => {
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

  await page.getByRole('button', { name: '新建角色' }).click()
  await page.getByRole('button', { name: /经验丰富的冒险者/ }).click()
  await page.getByRole('button', { name: '选择属性方式' }).click()
  await page.getByRole('button', { name: /标准数组/ }).click()
  await page.getByRole('button', { name: '开始分配' }).click()
  await page.getByRole('button', { name: '加入种族调整并选择装备' }).click()
  await page.getByRole('button', { name: '确认起始装备' }).click()
  await page.getByRole('textbox', { name: '角色名称' }).fill(name)
  await page.getByRole('button', { name: '创建角色' }).click()

  const level = page.getByRole('spinbutton', { name: '等级', exact: true })
  await expect(level).toHaveValue('1')
  await level.fill('')
  await page.waitForTimeout(750)
  await expect(level).toHaveValue('')

  await level.fill('12')
  await expect(level).toHaveValue('12')

  // Refresh without Enter or blur. A valid numeric edit must already be in the
  // local durable queue, even if the async shared-state PUT has not completed.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('spinbutton', { name: '等级', exact: true })).toHaveValue('12')

  await expect.poll(async () => {
    const response = await request.get(`http://127.0.0.1:6173/api/state/characters?room=${created.roomId}`)
    if (!response.ok()) return null
    const state = await response.json() as { characters?: Array<{ name?: string; level?: number }> }
    return state.characters?.find((character) => character.name === name)?.level ?? null
  }).toBe(12)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('spinbutton', { name: '等级', exact: true })).toHaveValue('12')
})
