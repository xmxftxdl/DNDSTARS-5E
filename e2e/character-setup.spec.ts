import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { createCoreFighter } from './support/characterCreation'

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

test('角色创建支持标准数组以及先投完六组再统一分配的 4d6 流程', async ({ page, request }) => {
  test.setTimeout(90_000)
  await enterFreshPlayerRoom(page, request)

  await createCoreFighter(page, { name: '标准战士' })
  await expect(page.locator('input[value="标准战士"]')).toBeVisible()
  await expect(page.getByRole('spinbutton', { name: '力量属性值' })).toHaveValue('16')

  await createCoreFighter(page, { name: '投骰战士', abilityMethod: 'roll-4d6' })
  await expect(page.locator('input[value="投骰战士"]')).toBeVisible()
  for (const ability of ABILITIES) {
    const score = Number(await page.getByRole('spinbutton', { name: `${ability}属性值` }).inputValue())
    expect(score).toBeGreaterThanOrEqual(3)
    expect(score).toBeLessThanOrEqual(20)
  }
})

test('战士升级会预览、授予并记录固定职业特性', async ({ page, request }) => {
  test.setTimeout(90_000)
  await enterFreshPlayerRoom(page, request)

  await createCoreFighter(page, { name: '固定特性战士', targetLevel: 2 })
  const advancementFlow = page.getByRole('dialog', { name: '处理角色总等级 2' })
  await expect(advancementFlow).toBeVisible()
  await advancementFlow.getByRole('button', { name: '结算本级' }).click()

  const levelUpDialog = page.getByRole('dialog', { name: '战士 1 → 2 级' })
  await expect(levelUpDialog.getByRole('heading', { name: '本次固定获得的职业特性' })).toBeVisible()
  await expect(levelUpDialog.getByText('动作如潮（1次）', { exact: true })).toBeVisible()
  await levelUpDialog.getByRole('button', { name: '确认升级' }).click()

  await page.getByRole('button', { name: '职业', exact: true }).click()
  await expect(page.getByText('固定获得：动作如潮（1次）', { exact: true })).toBeVisible()
  await expect(page.getByText(/动作如潮.*1\/1/)).toBeVisible()
})
