import { expect, test } from '@playwright/test'

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
    slot?: 'player1'
    displayName: string
  }
}

function session(response: Membership) {
  return { roomId: response.roomId, roomName: response.roomName, rulesetId: response.rulesetId, createdAt: response.createdAt, ...response.member }
}

test('DM distributes an SRD item and the player uses it through authority sync', async ({ browser, request }) => {
  const created = await (await request.post(`${DM}/api/rooms`, {
    data: {
      roomName: '物品栏 E2E',
      displayName: '物品 DM',
      rulesetId: 'dnd5e-2014-srd-5.1',
      clientId: `inventory-dm-${Date.now()}`,
    },
  })).json() as Membership
  const joined = await (await request.post(`${DM}/api/rooms/${created.roomId}/join`, {
    data: { displayName: '物品玩家', clientId: `inventory-player-${Date.now()}` },
  })).json() as Membership

  const dmContext = await browser.newContext()
  const playerContext = await browser.newContext()
  const dm = await dmContext.newPage()
  const player = await playerContext.newPage()
  await Promise.all([
    dm.goto(`${DM}/characters`, { waitUntil: 'domcontentloaded' }),
    player.goto(`${PLAYER}/characters`, { waitUntil: 'domcontentloaded' }),
  ])
  await dm.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [SESSION_KEY, session(created)] as const)
  await player.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [SESSION_KEY, session(joined)] as const)
  await Promise.all([dm.reload({ waitUntil: 'domcontentloaded' }), player.reload({ waitUntil: 'domcontentloaded' })])

  await player.getByRole('button', { name: '新建角色' }).click()
  await player.getByRole('button', { name: /经验丰富的冒险者/ }).click()
  await player.getByRole('button', { name: '选择属性方式' }).click()
  await player.getByRole('button', { name: /标准数组/ }).click()
  await player.getByRole('button', { name: '开始分配' }).click()
  await player.getByRole('button', { name: '加入种族调整并选择装备' }).click()
  await player.getByRole('button', { name: '确认起始装备' }).click()
  await player.getByRole('textbox', { name: '角色名称' }).fill('背包测试战士')
  await player.getByRole('button', { name: '创建角色' }).click()

  const distributor = dm.getByTestId('dm-inventory-distributor')
  const targetOption = distributor.getByRole('option', { name: /背包测试战士/ })
  await expect(targetOption).toBeAttached({ timeout: 20_000 })
  await distributor.locator('select').nth(0).selectOption((await targetOption.getAttribute('value'))!)
  await distributor.locator('select').nth(1).selectOption('srd-5.1:item:potion-of-healing')
  await distributor.getByRole('button', { name: '分发' }).click()
  await expect(distributor.getByText(/获得 治疗药水/)).toBeVisible()

  await player.getByRole('button', { name: '物品栏' }).click()
  const inventory = player.getByTestId('dnd5e-inventory')
  await inventory.getByRole('button', { name: '道具' }).click()
  const potion = inventory.getByRole('button', { name: /治疗药水/ })
  await expect(potion).toBeVisible({ timeout: 20_000 })
  await potion.hover()
  await expect(inventory.getByText('饮用者恢复 2d4 + 2 点生命值。', { exact: false })).toBeVisible()
  await potion.click()
  await inventory.getByRole('button', { name: '使用', exact: true }).click()
  await expect(inventory.getByRole('button', { name: /治疗药水/ })).toHaveCount(0, { timeout: 20_000 })
  await expect(inventory.getByText('已提交给 DM 权威端，完成后库存会自动同步。')).toBeVisible()

  await dmContext.close()
  await playerContext.close()
})
