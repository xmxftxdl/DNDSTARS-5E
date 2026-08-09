import { expect, test } from '@playwright/test'
import { createCoreFighter } from './support/characterCreation'

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

  await createCoreFighter(player, { name: '背包测试战士' })

  const distributor = dm.getByTestId('dm-inventory-distributor')
  const targetOption = distributor.getByRole('option', { name: /背包测试战士/ })
  await expect(targetOption).toBeAttached({ timeout: 20_000 })
  await distributor.locator('select').nth(0).selectOption((await targetOption.getAttribute('value'))!)
  await distributor.locator('select').nth(1).selectOption('srd-5.1:item:potion-of-healing')
  await distributor.getByRole('button', { name: '分发' }).click()
  await expect(distributor.getByText(/获得 治疗药水/)).toBeVisible()

  await player.getByRole('button', { name: '物品栏' }).click()
  const inventory = player.getByTestId('dnd5e-inventory')
  await expect(inventory.getByTestId('inventory-equipment-rail')).toBeVisible()
  await expect(inventory.locator('[data-testid^="inventory-equipment-slot-"]')).toHaveCount(9)
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

test('a player can transfer part of an item stack to another character in the same room', async ({ browser, request }) => {
  const created = await (await request.post(`${DM}/api/rooms`, {
    data: {
      roomName: '物品转交 E2E',
      displayName: '转交 DM',
      rulesetId: 'dnd5e-2014-srd-5.1',
      clientId: `transfer-dm-${Date.now()}`,
    },
  })).json() as Membership
  const giverMembership = await (await request.post(`${DM}/api/rooms/${created.roomId}/join`, {
    data: { displayName: '转交玩家', clientId: `transfer-giver-${Date.now()}` },
  })).json() as Membership
  const receiverMembership = await (await request.post(`${DM}/api/rooms/${created.roomId}/join`, {
    data: { displayName: '接收玩家', clientId: `transfer-receiver-${Date.now()}` },
  })).json() as Membership

  const dmContext = await browser.newContext()
  const giverContext = await browser.newContext()
  const receiverContext = await browser.newContext()
  const dm = await dmContext.newPage()
  const giver = await giverContext.newPage()
  const receiver = await receiverContext.newPage()
  await Promise.all([
    dm.goto(`${DM}/characters`, { waitUntil: 'domcontentloaded' }),
    giver.goto(`${PLAYER}/characters`, { waitUntil: 'domcontentloaded' }),
    receiver.goto(`${PLAYER}/characters`, { waitUntil: 'domcontentloaded' }),
  ])
  await dm.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [SESSION_KEY, session(created)] as const)
  await giver.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [SESSION_KEY, session(giverMembership)] as const)
  await receiver.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [SESSION_KEY, session(receiverMembership)] as const)
  await Promise.all([
    dm.reload({ waitUntil: 'domcontentloaded' }),
    giver.reload({ waitUntil: 'domcontentloaded' }),
    receiver.reload({ waitUntil: 'domcontentloaded' }),
  ])

  await createCoreFighter(giver, { name: '转交者' })
  await createCoreFighter(receiver, { name: '接收者' })

  const distributor = dm.getByTestId('dm-inventory-distributor')
  const giverOption = distributor.getByRole('option', { name: /转交者/ })
  await expect(giverOption).toBeAttached({ timeout: 20_000 })
  await distributor.locator('select').nth(0).selectOption((await giverOption.getAttribute('value'))!)
  await distributor.locator('select').nth(1).selectOption('srd-5.1:item:hammer')
  await distributor.locator('input[type="number"]').fill('2')
  await distributor.getByRole('button', { name: '分发' }).click()
  await expect(distributor.getByText(/获得 锤子 ×2/)).toBeVisible()

  await giver.getByRole('button', { name: '物品栏' }).click()
  const giverInventory = giver.getByTestId('dnd5e-inventory')
  await giverInventory.getByRole('button', { name: /锤子/ }).click()
  const itemActions = giverInventory.getByTestId('inventory-item-actions')
  const targetSelect = itemActions.getByRole('combobox', { name: '转交目标角色' })
  const receiverOption = targetSelect.getByRole('option', { name: /接收者/ })
  await expect(receiverOption).toBeAttached({ timeout: 20_000 })
  await targetSelect.selectOption((await receiverOption.getAttribute('value'))!)
  await itemActions.getByRole('spinbutton', { name: '数量' }).fill('1')
  await itemActions.getByRole('button', { name: '转交', exact: true }).click()
  await expect(giverInventory.getByText('已提交给 DM 权威端，完成后库存会自动同步。')).toBeVisible()

  await receiver.getByRole('button', { name: '物品栏' }).click()
  await expect(receiver.getByTestId('dnd5e-inventory').getByRole('button', { name: /锤子/ })).toBeVisible({ timeout: 20_000 })

  await Promise.all([dmContext.close(), giverContext.close(), receiverContext.close()])
})
