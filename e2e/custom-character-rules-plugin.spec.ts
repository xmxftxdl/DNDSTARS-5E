import { expect, test, type Page } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'
const PLAYER = 'http://127.0.0.1:6174'
const SESSION_KEY = 'stars-room-session:v1'
const PLUGIN_ID = 'local.dm.character-creation-rules'

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
    slot?: 'player1' | 'player2' | 'player3'
    displayName: string
  }
}

async function enterRoom(page: Page, origin: string, membership: Membership, path = '/settings') {
  await page.goto(`${origin}${path}`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [
    SESSION_KEY,
    {
      roomId: membership.roomId,
      roomName: membership.roomName,
      rulesetId: membership.rulesetId,
      createdAt: membership.createdAt,
      ...membership.member,
    },
  ] as const)
  await page.reload({ waitUntil: 'domcontentloaded' })
}

test('DM 可编辑、保存并分发种族和加点规则插件', async ({ browser, request }) => {
  test.setTimeout(120_000)
  const createdResponse = await request.post(`${DM}/api/rooms`, {
    data: {
      roomName: '自定义角色规则 E2E',
      displayName: '规则编辑 DM',
      rulesetId: 'dnd5e-2014-srd-5.1',
      clientId: `custom-rules-dm-${Date.now()}`,
      activePlugins: [],
    },
  })
  expect(createdResponse.ok()).toBeTruthy()
  const created = await createdResponse.json() as Membership
  const joinedResponse = await request.post(`${DM}/api/rooms/${created.roomId}/join`, {
    data: { displayName: '自定义规则玩家', clientId: `custom-rules-player-${Date.now()}`, activePlugins: [] },
  })
  expect(joinedResponse.ok()).toBeTruthy()
  const joined = await joinedResponse.json() as Membership

  const dmContext = await browser.newContext()
  const playerContext = await browser.newContext()
  const dm = await dmContext.newPage()
  const player = await playerContext.newPage()
  await Promise.all([enterRoom(dm, DM, created), enterRoom(player, PLAYER, joined)])

  const builder = dm.getByTestId('custom-rules-plugin-builder')
  await builder.getByRole('button', { name: '打开扩展工作室' }).click()
  await builder.getByLabel('插件 ID', { exact: true }).fill(PLUGIN_ID)
  await builder.getByLabel('插件名称').fill('房间角色创建规则')
  await builder.getByRole('button', { name: '添加种族' }).click()
  await builder.getByLabel('显示名称').first().fill('星裔旅者')
  await builder.getByLabel('力量固定调整').fill('2')
  await builder.getByLabel('速度（尺）').fill('35')
  await builder.getByRole('button', { name: /加点规则/ }).click()
  await builder.getByRole('button', { name: '添加加点规则' }).click()
  await builder.getByLabel('显示名称').first().fill('英雄标准数组')

  const downloadPromise = dm.waitForEvent('download')
  await builder.getByRole('button', { name: '下载插件文件' }).click()
  expect((await downloadPromise).suggestedFilename()).toBe(`${PLUGIN_ID}.dndstars5e`)

  await builder.getByRole('button', { name: '保存、启用并发布' }).click()
  await expect(dm.getByText(`已原子激活 ${PLUGIN_ID}；房间玩家将自动下载并激活。`)).toBeVisible({ timeout: 20_000 })
  await expect(player.getByRole('heading', { name: '房间角色创建规则' })).toBeVisible({ timeout: 25_000 })

  await player.goto(`${PLAYER}/characters`, { waitUntil: 'domcontentloaded' })
  await player.getByRole('button', { name: '新建角色' }).click()
  await player.getByRole('button', { name: /经验丰富的冒险者/ }).click()
  await player.getByLabel('种族').selectOption({ label: '星裔旅者 · 房间角色创建规则' })
  await player.getByRole('button', { name: '选择属性方式' }).click()
  await player.getByRole('button', { name: '英雄标准数组' }).click()
  await player.getByRole('button', { name: '开始分配' }).click()
  await player.getByRole('button', { name: '加入种族调整并选择装备' }).click()
  await player.getByRole('button', { name: '确认起始装备' }).click()
  await expect(player.getByText('15', { exact: true }).first()).toBeVisible()
  await expect(player.getByText('17', { exact: true }).first()).toBeVisible()
  await player.getByRole('textbox', { name: '角色名称' }).fill('插件星裔战士')
  await player.getByRole('button', { name: '创建角色' }).click()
  await expect(player.getByRole('combobox', { name: '种族' })).toHaveValue('星裔旅者')

  await Promise.all([dmContext.close(), playerContext.close()])
})
