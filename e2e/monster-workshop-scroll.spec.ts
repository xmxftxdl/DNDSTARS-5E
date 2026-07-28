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

  await page.goto(`${DM}/app/extensions`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: '创建插件' }).click()
  const builder = page.getByTestId('custom-rules-plugin-builder')
  await builder.getByRole('button', { name: '打开扩展工作室' }).click()
  await builder.getByRole('button', { name: /^怪物/ }).click()
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
})
