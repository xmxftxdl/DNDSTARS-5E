import { expect, test, type Page, type APIRequestContext } from '@playwright/test'

const PLAYER = 'http://127.0.0.1:6174'
const DM = 'http://127.0.0.1:6173'
const ABILITIES = ['力量', '敏捷', '体质', '智力', '感知', '魅力'] as const

async function enterFreshPlayerRoom(page: Page, request: APIRequestContext) {
  const suffix = Date.now()
  const created = await (await request.post(`${DM}/api/rooms`, {
    data: {
      roomName: '角色 Setup 回归',
      displayName: 'Setup DM',
      rulesetId: 'dnd5e-2014-srd-5.1',
      clientId: `setup-dm-${suffix}`,
    },
  })).json() as {
    roomId: string
    roomName: string
    rulesetId: 'dnd5e-2014-srd-5.1'
    createdAt: number
  }
  const joined = await (await request.post(`${DM}/api/rooms/${created.roomId}/join`, {
    data: { displayName: 'Setup 玩家', clientId: `setup-player-${suffix}` },
  })).json() as {
    member: { memberId: string; roomToken: string; clientId: string; role: 'player'; slot: 'player1'; displayName: string }
  }
  await page.goto(`${PLAYER}/characters`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [
    'stars-room-session:v1',
    { ...created, ...joined.member },
  ] as const)
  await page.reload({ waitUntil: 'domcontentloaded' })
}

test('角色 Setup 支持新手推荐和老手逐次 4d6 分配', async ({ page, request }) => {
  test.setTimeout(90_000)
  await enterFreshPlayerRoom(page, request)

  await page.getByRole('button', { name: '新建角色' }).click()
  await page.getByRole('button', { name: /初出茅庐的冒险者/ }).click()
  await expect(page.getByTestId('class-recommendation-0')).toContainText('战士')
  await page.getByRole('button', { name: '侦察与探索' }).click()
  await expect(page.getByTestId('class-recommendation-0')).toContainText('游侠')
  await page.getByRole('button', { name: '治疗并支援同伴' }).click()
  await page.getByRole('button', { name: '辅助与恢复' }).click()
  await page.getByRole('button', { name: '信仰与誓言' }).click()
  await page.getByRole('button', { name: '坚韧可靠' }).click()
  await page.getByRole('button', { name: '重视规则与承诺' }).click()
  await page.getByRole('button', { name: '愿意帮助与牺牲' }).click()
  await page.getByRole('button', { name: '生成推荐' }).click()

  await expect(page.getByRole('heading', { name: '牧师起始装备' })).toBeVisible()
  await page.getByRole('button', { name: '皮甲', exact: true }).click()
  await page.getByRole('button', { name: '探索者套组', exact: true }).click()
  await page.getByRole('button', { name: '确认起始装备' }).click()

  await expect(page.getByRole('combobox', { name: '职业' })).toHaveValue('牧师')
  await expect(page.getByRole('combobox', { name: '种族' })).toHaveValue('矮人')
  await expect(page.getByRole('combobox', { name: '阵营' })).toHaveValue('守序善良')
  await expect(page.getByRole('combobox', { name: '背景' })).toHaveValue('侍僧')
  await expect(page.getByTestId('build-recommendation-review')).toContainText('职业推荐理由')
  await expect(page.getByTestId('build-recommendation-review')).toContainText('主属性与种族建议')
  await expect(page.getByTestId('selected-race-advice')).toContainText('矮人')
  await page.getByRole('dialog', { name: '创建角色 Setup' }).getByRole('textbox', { name: '角色名称' }).fill('新手牧师')
  await page.getByRole('button', { name: '创建角色' }).click()

  await expect(page.locator('input[value="新手牧师"]')).toBeVisible()
  await expect(page.getByRole('spinbutton', { name: '体质属性值' })).toHaveValue('16')
  await expect(page.getByRole('textbox', { name: '角色笔记' })).toHaveValue(/角色创建向导推荐理由/)

  await page.getByRole('button', { name: '新建角色' }).click()
  await page.getByRole('button', { name: /经验丰富的冒险者/ }).click()
  await page.getByRole('button', { name: '选择属性方式' }).click()
  await page.getByRole('button', { name: /4d6 去最低值/ }).click()
  await page.getByRole('button', { name: '开始分配' }).click()

  for (const ability of ABILITIES) {
    await page.getByRole('button', { name: /投掷 4d6/ }).click()
    await page.getByRole('button', { name: new RegExp(`^${ability}填入`) }).click()
  }
  await page.getByRole('button', { name: '加入种族调整并选择装备' }).click()
  await page.getByRole('button', { name: '确认起始装备' }).click()
  await page.getByRole('dialog', { name: '创建角色 Setup' }).getByRole('textbox', { name: '角色名称' }).fill('投骰战士')
  await page.getByRole('button', { name: '创建角色' }).click()

  await expect(page.locator('input[value="投骰战士"]')).toBeVisible()
  for (const ability of ABILITIES) {
    const score = Number(await page.getByRole('spinbutton', { name: `${ability}属性值` }).inputValue())
    expect(score).toBeGreaterThanOrEqual(4)
    expect(score).toBeLessThanOrEqual(19)
  }
})
