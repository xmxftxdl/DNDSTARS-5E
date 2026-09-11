import { expect, test } from '@playwright/test'
test('player presents the corrected public value before the next broadcast', async ({ page }) => {
  await page.setViewportSize({width:1100,height:800})
  await page.goto('http://127.0.0.1:6373/e2e/fixtures/dm-dice-correction.html', {waitUntil:'networkidle'})
  await page.getByRole('button',{name:'模拟连续广播'}).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as {results: unknown[]}).results), {timeout:30000}).toEqual([
    {id:'preview:color',values:[3]}, {id:'preview:color:dm-confirmed',values:[6]}, {id:'preview:next',values:[4]},
  ])
  await expect(page.locator('.dice-tray-drawer__total strong')).toHaveText('4')
})
