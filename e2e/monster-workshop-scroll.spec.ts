import { expect, test } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'
const ACCOUNT_SESSION_KEY = 'stars-account-session:v1'

test('monster workshop keeps a viewport-sized scroll region and can reach the last form section', async ({
  page,
  request,
}) => {
  const now = Date.now()
  const accountResponse = await request.post(`${DM}/api/accounts`, {
    data: {
      displayName: `怪物扩展作者 ${now}`,
      clientId: `monster-workshop-scroll-${now}`,
    },
  })
  expect(accountResponse.status()).toBe(201)
  const account = (await accountResponse.json() as {
    session: { accountId: string; displayName: string; sessionToken: string; createdAt: number }
  }).session
  await page.context().addInitScript(([key, session]) => {
    localStorage.setItem(key, JSON.stringify(session))
  }, [ACCOUNT_SESSION_KEY, account] as const)

  await page.goto(`${DM}/campaign/local/dm-tools/workshop`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('local-room-json-paste')).toBeVisible()
  await expect(page.getByRole('heading', { name: '粘贴规则 → AI 转换 → DM 确认' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'AI 转换为待确认草稿' })).toBeVisible()
  const builder = page.getByTestId('custom-rules-plugin-builder')
  await builder.getByRole('tab', { name: /^怪物/ }).click()
  await builder.getByRole('button', { name: '打开怪物工坊' }).click()

  const dialog = page.getByTestId('monster-workshop-dialog')
  const scrollRegion = page.getByTestId('monster-workshop-scroll-region')
  await expect(dialog).toBeVisible()
  await expect(scrollRegion).toBeVisible()
  await dialog.getByRole('button', { name: '粘贴自动填写' }).click()
  await dialog.getByTestId('monster-stat-block-paste-input').fill(`Goblin
Small humanoid (goblinoid), neutral evil
Armor Class 15
Hit Points 7 (2d6)
Speed 30 ft.
STR DEX CON INT WIS CHA
8 (-1) 14 (+2) 10 (+0) 10 (+0) 8 (-1) 8 (-1)
Challenge 1/4 (50 XP)
Actions
Scimitar. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage.`)
  await dialog.getByRole('button', { name: '分析并预览' }).click()
  await expect(dialog.getByText(/预览：Goblin · AC 15 · HP 7/)).toBeVisible()
  await dialog.getByRole('button', { name: '覆盖当前表单' }).click()
  await expect(dialog.getByLabel('中文名称')).toHaveValue('Goblin')
  await dialog.getByLabel('启用施法').check()
  await dialog.getByRole('button', { name: '添加法术' }).click()
  await dialog.getByLabel('法术选择 1').selectOption('fireball')
  await expect(dialog.getByLabel('法术选择 1')).toHaveValue('fireball')
  await expect(dialog.getByText('火球术 · 3 环', { exact: true })).toBeVisible()
  const actionCard = dialog.locator('[id^="monster-workshop-action-"]').first()
  await actionCard.getByRole('button', { name: /Scimitar.*展开/ }).click()
  await actionCard.getByRole('combobox', { name: '类型', exact: true }).selectOption('summon')
  await actionCard.getByRole('button', { name: 'Scimitar召唤怪物' }).click()
  const summonSearch = actionCard.getByRole('combobox', { name: 'Scimitar搜索召唤怪物' })
  await summonSearch.fill('srd-5.1:wolf')
  const wolfOption = actionCard.getByRole('option').filter({ hasText: 'srd-5.1:wolf' })
  await expect(wolfOption).toHaveCount(1)
  await wolfOption.click()
  await expect(actionCard.getByRole('button', { name: 'Scimitar召唤怪物' })).toContainText('狼 / Wolf · SRD 5.1')
  await dialog.locator('textarea[placeholder^="不退斗志"]').fill(
    '不退斗志：当他的血量低于 10 时，他造成的所有伤害获得额外 1d6 的加值。',
  )
  await dialog.getByRole('button', { name: '解析为机制' }).click()
  await expect(dialog.getByLabel('当前 HP ＜')).toHaveValue('10')
  await expect(dialog.getByLabel('触发时机')).toHaveValue('after-dealt-damage')
  await expect(dialog.locator('select:has(option[value="inherit-trigger"])')).toHaveValue('inherit-trigger')

  const dimensions = await scrollRegion.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    viewportHeight: window.innerHeight,
  }))
  expect(dimensions.clientHeight).toBeGreaterThan(0)
  expect(dimensions.clientHeight).toBeLessThanOrEqual(dimensions.viewportHeight)
  expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight)

  await scrollRegion.hover()
  await page.mouse.wheel(0, 900)
  await expect.poll(() => scrollRegion.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)

  const reachedBottom = await scrollRegion.evaluate((element) => {
    element.scrollTop = element.scrollHeight
    return Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop) <= 2
  })
  expect(reachedBottom).toBe(true)

  await dialog.getByLabel('中文名称').fill('Goblin 未保存草稿')
  await expect(dialog.getByText(/草稿已自动保存/)).toBeVisible()
  await expect.poll(() => page.evaluate(() => Object.entries(localStorage).some(([key, value]) =>
    key.startsWith('dndstars5e:monster-workshop-draft:v1:') && value.includes('Goblin 未保存草稿')))).toBe(true)

  await dialog.locator('..').click({ position: { x: 3, y: 3 } })
  await expect(dialog).toBeHidden()

  await page.reload({ waitUntil: 'domcontentloaded' })
  const restoredBuilder = page.getByTestId('custom-rules-plugin-builder')
  await restoredBuilder.getByRole('tab', { name: /^怪物/ }).click()
  await restoredBuilder.getByRole('button', { name: '打开怪物工坊' }).click()
  const restoredDialog = page.getByTestId('monster-workshop-dialog')
  await expect(restoredDialog.getByText('已自动恢复当前房间尚未加入扩展的怪物草稿。')).toBeVisible()
  await expect(restoredDialog.getByLabel('中文名称')).toHaveValue('Goblin 未保存草稿')
  await restoredDialog.getByRole('button', { name: '删除草稿' }).click()
  await page.getByRole('dialog', { name: '删除未加入扩展的怪物草稿' }).getByRole('button', { name: '确认删除草稿' }).click()
  await expect(restoredDialog.getByLabel('中文名称')).toHaveValue('自定义怪物')
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).some((key) =>
    key.startsWith('dndstars5e:monster-workshop-draft:v1:')))).toBe(false)
  await restoredDialog.locator('..').click({ position: { x: 3, y: 3 } })

  await page.goto(`${DM}/campaign/local/extensions`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('active-rules-extensions-page')).toBeVisible()
  await expect(page.getByText('D&D 5e 2014 · SRD 5.1 核心规则')).toBeVisible()
  await expect(page.getByText('当前没有额外激活的扩展')).toBeVisible()
  await expect(page.getByRole('link', { name: '打开自定义工坊' })).toHaveAttribute(
    'href',
    '/campaign/local/dm-tools/workshop',
  )
})
