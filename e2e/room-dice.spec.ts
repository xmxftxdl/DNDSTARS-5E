import { expect, test } from '@playwright/test'

test('room results and DM confirmation do not replace personal dice, including refresh', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message) })
  await page.setViewportSize({ width: 1440, height: 900 })
  const port = Number(process.env.STARS_E2E_PORT_BASE) || 6173
  await page.goto(`http://127.0.0.1:${port}/e2e/fixtures/room-dice.html`, { waitUntil: 'commit' })
  await page.getByRole('button', { name: '开始本人投掷' }).click()
  await expect(page.locator('iframe')).toHaveCount(1)
  await page.getByRole('button', { name: '接收三位玩家结果' }).click()
  const room = page.getByRole('region', { name: '投掷记录' })
  await expect(room.locator('details')).toHaveCount(3)
  await expect(page.locator('iframe')).toHaveCount(1)
  await page.getByRole('textbox', { name: '第 1 枚 d20 骰面' }).fill('17')
  await page.getByTestId('dice-tray-secret-confirm').click()
  await expect(room.getByText('DM 已确认')).toBeVisible()
  const own = page.getByTestId('dice-tray-drawer')
  await expect(own.getByLabel('各骰点数：4、3')).toBeVisible({ timeout: 20_000 })
  await expect(own.locator('strong', { hasText: /^7$/ })).toBeVisible()
  await page.reload({ waitUntil: 'commit' })
  await expect(own.getByLabel('各骰点数：4、3')).toBeVisible()
  await expect(room.locator('details')).toHaveCount(3)
  await expect(room.getByText('DM 已确认')).toBeVisible()
  await expect(page.locator('iframe')).toHaveCount(1)
  await page.screenshot({ path: 'test-results/room-dice-preview.png' })
  expect(errors).toEqual([])
})
