import { expect, test } from '@playwright/test'

const dmUrl = 'http://127.0.0.1:6173'

test('DM can create and export a server-side campaign recovery point', async ({ page }) => {
  await page.goto(`${dmUrl}/settings`)
  await page.getByRole('button', { name: '房间与恢复' }).click()
  await expect(page.getByRole('heading', { name: '战役安全与恢复' })).toBeVisible()

  await page.getByRole('button', { name: '立即创建快照' }).click()
  await expect(page.getByText('已创建手动快照。')).toBeVisible()
  await expect(page.getByText('手动快照').first()).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出完整战役' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^DNDSTARS5E-.*\.dndstars5e-campaign\.json$/)
})

test('campaign import is preflighted before restore is enabled', async ({ page }) => {
  await page.goto(`${dmUrl}/settings`)
  await page.getByRole('button', { name: '房间与恢复' }).click()
  const input = page.locator('input[type="file"][accept*="application/json"]')
  await input.setInputFiles({
    name: 'not-a-campaign.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ hello: 'world' })),
  })
  await expect(page.getByText('不是 DNDSTARS 5E 战役包')).toBeVisible()
  await expect(page.getByRole('button', { name: '还原到当前房间' })).toBeDisabled()
})
