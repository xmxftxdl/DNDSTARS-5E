import { expect, test } from '@playwright/test'
for (const pdf of [false, true]) test(`status badge opens independently of unit drawer; PDF=${pdf}`, async ({ page }) => {
 await page.goto(`http://127.0.0.1:6385/e2e/fixtures/status-token.html${pdf ? '?pdf=1' : ''}`, { waitUntil: 'commit' })
 await expect(page.locator('canvas')).toBeVisible()
 const point = await page.evaluate(() => (window as unknown as { statusCenter: () => { x: number; y: number } }).statusCenter())
 await page.mouse.click(point.x, point.y)
 await expect(page.getByRole('dialog', { name: '状态测试角色的状态详情' })).toBeVisible()
 await expect(page.getByTestId('dnd5e-token-status-instance-details')).toContainText('中毒')
 await page.getByTitle('关闭', { exact: true }).click()
 await expect(page.getByRole('dialog')).toHaveCount(0)
})
