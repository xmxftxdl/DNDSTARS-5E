import { expect, test, type Page } from '@playwright/test'

type FrameResult = { type: string; requestId?: string; values?: number[]; fallback?: boolean }
type TestWindow = Window & { largeDiceMessages: FrameResult[] }
async function observe(page: Page) {
  await page.addInitScript(() => {
    const target = window as TestWindow
    target.largeDiceMessages = []
    window.addEventListener('message', event => {
      if (event.data?.type === 'dice-box-roll-result') target.largeDiceMessages.push(event.data)
    })
  })
}
async function physicalResult(page: Page, count: number) {
  await expect.poll(() => page.evaluate(() => (window as TestWindow).largeDiceMessages.at(-1)), { timeout: 30000 })
    .toMatchObject({ values: expect.any(Array) })
  const result = await page.evaluate(() => (window as TestWindow).largeDiceMessages.at(-1)!)
  expect(result.fallback).not.toBe(true)
  expect(result.values).toHaveLength(count)
  return result.values!
}

test('20d6 free roll renders every die and mirrors all 20 values to DM', async ({ context, page }) => {
  test.setTimeout(90000)
  const dm = await context.newPage()
  await observe(page); await observe(dm)
  const errors: string[] = []
  for (const client of [page, dm]) {
    client.on('pageerror', error => errors.push(error.message))
    client.on('console', message => { if (message.type() === 'error' || message.text().includes('visible faces differ')) errors.push(message.text()) })
  }
  await dm.goto('http://127.0.0.1:6373/e2e/fixtures/large-dice.html?dm')
  await page.goto('http://127.0.0.1:6373/e2e/fixtures/large-dice.html')
  for (let i = 0; i < 20; i++) await page.getByRole('button', { name: /^添加 d6，/ }).click()
  await expect(page.getByRole('button', { name: '投掷 20d6', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: '投掷 20d6', exact: true }).click()
  const expected = Array.from({ length: 20 }, (_, index) => index % 6 + 1)
  expect(await physicalResult(page, 20)).toEqual(expected)
  expect(await physicalResult(dm, 20)).toEqual(expected)
  await expect(page.getByTestId('large-pool-result')).toHaveText(JSON.stringify(expected))
  await expect(page.getByRole('button', { name: '添加 d6，当前 0 枚', exact: true })).toHaveAttribute('data-active', 'false')
  await expect(dm.getByTestId('large-pool-result')).toHaveText(JSON.stringify(expected))
  for (const client of [page, dm]) {
    await expect(client.locator('.dice-tray-drawer__total strong')).toHaveText('66')
    await expect(client.getByTestId('dice-tray-secret-confirm')).toHaveCount(0)
  }
  await page.getByTestId('dice-tray-drawer').screenshot({ path: 'docs/verification/2026-09-10/20d6-player.png' })
  await dm.getByTestId('dice-tray-drawer').screenshot({ path: 'docs/verification/2026-09-10/20d6-dm.png' })
  // Restoring the DM tray must retain all twenty faces, not just the old first twelve.
  await dm.reload()
  expect(await physicalResult(dm, 20)).toEqual(expected)
  await expect(dm.locator('.dice-tray-drawer__total strong')).toHaveText('66')
  expect(errors).toEqual([])
})

test('20d6 owned damage preserves every physical face on player and DM', async ({ context, page }) => {
  test.setTimeout(90000)
  const dm = await context.newPage()
  const physicalErrors: string[] = []
  for (const client of [dm, page]) client.on('console', message => {
    if (message.text().includes('visible faces differ') || message.text().includes('[dice-box-frame] roll failed')) physicalErrors.push(message.text())
  })
  await observe(page); await observe(dm)
  await dm.goto('http://127.0.0.1:6373/e2e/fixtures/player-damage.html?dm=1&count=20&sides=6')
  await page.goto('http://127.0.0.1:6373/e2e/fixtures/player-damage.html?count=20&sides=6')
  await page.getByRole('button', { name: '命中后请求伤害骰' }).click()
  await page.getByRole('button', { name: '确认并投掷' }).click()
  const values = Array<number>(20).fill(6)
  expect(await physicalResult(page, 20)).toEqual(values)
  expect(await physicalResult(dm, 20)).toEqual(values)
  await expect(page.getByText('DM 收到 20 枚伤害骰，总计 120', { exact: true })).toBeVisible()
  expect(physicalErrors).toEqual([])
})

for (const count of [26, 40]) test(`DM free ${count}d6 retains every face after settlement`, async ({ page }) => {
  await observe(page)
  await page.goto('http://127.0.0.1:6373/e2e/fixtures/large-dice.html?dm')
  for (let i = 0; i < count; i++) await page.getByRole('button', { name: /^添加 d6，/ }).click()
  await page.getByTestId('map-dice-roller-quick-roll').click()
  const expected = Array.from({ length: count }, (_, index) => index % 6 + 1)
  expect(await physicalResult(page, count)).toEqual(expected)
  await expect(page.locator('.dice-tray-drawer__total strong')).toHaveText(String(expected.reduce((a, b) => a + b, 0)))
})
