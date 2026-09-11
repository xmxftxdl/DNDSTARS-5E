import {expect,test} from '@playwright/test'
test('slow iframe initialization still renders the dice and completes once', async ({ page }) => {
 await page.route('**/dice-box-frame.html?*', async route => {
  await new Promise(resolve => setTimeout(resolve, 1500))
  await route.continue()
 })
 await page.goto('http://127.0.0.1:6373/e2e/fixtures/dice-queue.html')
 await page.getByRole('button', { name: 'Pair advantage', exact: true }).click()
 await expect(page.frameLocator('iframe').locator('[data-dice-adopted-marker]')).toBeVisible({ timeout: 20000 })
 await expect(page.getByText('播放顺序：pair-advantage-attack-3-18', { exact: true })).toBeVisible()
 await expect(page.getByTestId('dice-check-inline')).toContainText('命中')
})
for (const [button, mode, result, , selected] of [
 ['Pair advantage','优势','命中',[3,18],18],
 ['Pair disadvantage','劣势','未命中',[18,3],3],
 ['Pair save success','优势','豁免成功',[3,18],18],
 ['Pair save failure','劣势','豁免失败',[18,3],3],
 ['Pair tie','优势','命中',[12,12],12],
] as const) test(`${button}: pair, adopted die, immediate outcome and refresh`,async({page})=>{
 test.setTimeout(90000)
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('http://127.0.0.1:6373/e2e/fixtures/dice-queue.html')
 await page.getByRole('button',{name:button,exact:true}).click()
 await expect(page.getByTestId('dice-check-mode')).toContainText(mode)
 await expect(page.getByTestId('dice-check-inline')).toContainText(result)
 await expect(page.getByTestId('dice-check-outcome')).toContainText(result)
 await expect(page.getByTestId('dice-tray-drawer').locator('[data-adopted="true"]')).toHaveCount(1,{timeout:20000})
 await expect(page.getByTestId('dice-tray-drawer').locator('[data-adopted="true"]')).toContainText(String(selected))
 await expect(page.getByTestId('dice-check-outcome')).toHaveCount(0,{timeout:6000})
 await expect(page.frameLocator('iframe').locator('[data-dice-adopted-marker]')).toBeVisible()
 await expect(page.locator('.dice-tray-drawer__total')).toHaveCount(0)
 await expect(page.getByTestId('dice-check-inline')).not.toContainText('采用第')
 await page.screenshot({path:`.codex-logs/dice-pair-screenshots/${button.replaceAll(' ','-')}.png`})
 for(let i=0;i<3;i++) {
  await page.reload()
  await expect(page.getByTestId('dice-check-outcome')).toHaveCount(0)
  await expect(page.getByTestId('dice-check-mode')).toContainText(mode)
  await expect(page.getByTestId('dice-check-inline')).toContainText(result)
 }
 // Replayed notification must not animate the cue again.
 await page.getByRole('button',{name:button,exact:true}).click()
 await page.waitForTimeout(4500)
 await expect(page.getByTestId('dice-check-outcome')).toHaveCount(0)
 expect(errors).toEqual([])
})

test('adopted aura respects reduced motion and clears on the next damage roll', async ({page})=>{
 await page.goto('http://127.0.0.1:6373/e2e/fixtures/dice-queue.html')
 await page.getByRole('button',{name:'Pair advantage',exact:true}).click()
 const aura=page.frameLocator('iframe').locator('[data-dice-adopted-marker]')
 await expect(aura).toBeVisible({timeout:15000})
 await page.emulateMedia({reducedMotion:'reduce'})
 expect(await aura.evaluate(node=>getComputedStyle(node,'::before').animationName)).toBe('none')
 await page.getByRole('button',{name:'Reduced damage',exact:true}).click()
 await expect(page.getByText('播放顺序：pair-advantage-attack-3-18、reduced-damage',{exact:true})).toBeVisible({timeout:15000})
 await expect(aura).toBeHidden()
})
