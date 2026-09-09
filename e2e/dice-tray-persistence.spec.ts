import { expect, test } from '@playwright/test'

test('keeps the 3D world and rethrows one grabbed die', async ({ page }) => {
  const faceMismatches: string[] = []
  page.on('console', (message) => {
    if (message.text().includes('visible faces differ')) faceMismatches.push(message.text())
  })
  const port = Number(process.env.STARS_E2E_PORT_BASE) || 6173
  await page.setViewportSize({ width: 1100, height: 800 })
  await page.goto(`http://127.0.0.1:${port}/e2e/fixtures/physical-dice-tray.html`, { waitUntil: 'commit' })
  const completed = () => page.evaluate(() => (window as unknown as { completed: number[][] }).completed)
  await expect.poll(completed, { timeout: 15000 }).toEqual([[2, 4, 6]])
  await page.evaluate(() => window.addEventListener('message', (event) => {
    if (event.data?.type === 'dice-box-roll-result') document.body.dataset.pool = JSON.stringify(event.data.values)
  }))
  const iframe = page.locator('iframe')
  const frame = await (await iframe.elementHandle())!.contentFrame()
  expect(frame).not.toBeNull()
  await frame!.evaluate(() => { document.body.dataset.persistence = 'original-world' })
  // Clicking without dragging must leave the original pool intact.
  await page.mouse.move(878, 445)
  await page.mouse.down()
  await page.mouse.up()
  expect(await completed()).toEqual([[2, 4, 6]])
  await page.mouse.move(878, 445)
  await page.mouse.down()
  await page.mouse.move(820, 355, { steps: 12 })
  await page.mouse.up()
  await expect.poll(async () => (await completed()).length, { timeout: 15000 }).toBe(2)
  const physicalPool = JSON.parse((await page.locator('body').getAttribute('data-pool'))!) as number[]
  expect(physicalPool).toHaveLength(3)
  expect(physicalPool.slice(1)).toEqual([4, 6])
  expect(physicalPool[0]).toBeGreaterThanOrEqual(1)
  expect(physicalPool[0]).toBeLessThanOrEqual(6)
  expect(await completed()).toEqual([[2, 4, 6], [physicalPool[0]]])
  expect(await page.evaluate(() => (window as unknown as { grabs: number[] }).grabs)).toEqual([0])
  await expect(iframe).toHaveCount(1)
  expect(await frame!.evaluate(() => document.body.dataset.persistence)).toBe('original-world')
  await page.evaluate(() => (window as unknown as { toggle: () => void }).toggle())
  await expect(iframe).toBeHidden()
  await page.evaluate(() => (window as unknown as { toggle: () => void }).toggle())
  await expect(iframe).toBeVisible()
  expect(await frame!.evaluate(() => document.body.dataset.persistence)).toBe('original-world')
  expect(faceMismatches).toEqual([])
})


