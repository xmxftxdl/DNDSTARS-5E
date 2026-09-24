import { expect, test } from '@playwright/test'

test('keeps the 3D world and rethrows one grabbed die', async ({ page }) => {
  page.on('console', message => { if (message.type() === 'error') console.log(message.text()) }); page.on('pageerror', error => console.log(error.message))
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
  const locateDie = async () => { const screenshot = await page.screenshot()
  const point = await page.evaluate(async base64 => {
    const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode()
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height
    const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0)
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    let best = { x: 0, y: 0, length: 0 }
    for (let y = 0; y < canvas.height; y++) {
      let start = -1
      for (let x = 0; x <= canvas.width; x++) {
        const i = (y * canvas.width + x) * 4
        const purple = x < canvas.width && pixels[i] > 45 && pixels[i + 2] > pixels[i] * 1.15 && pixels[i + 2] > pixels[i + 1] * 1.25
        if (purple && start < 0) start = x
        if (!purple && start >= 0) {
          if (x - start > best.length) best = { x: (x + start) / 2, y, length: x - start }
          start = -1
        }
      }
    }
    return best
  }, screenshot.toString('base64'))
  return point }
  await expect.poll(async () => (await locateDie()).length, { timeout: 15000 }).toBeGreaterThan(10)
  const point = await locateDie()
  // Clicking without dragging must leave the original pool intact.
  await page.mouse.move(point.x, point.y)
  await page.mouse.down()
  await page.mouse.up()
  expect(await completed()).toEqual([[2, 4, 6]])
  await page.mouse.move(point.x, point.y)
  await page.mouse.down()
  await page.mouse.move(point.x - 58, point.y - 90, { steps: 12 })
  await page.mouse.up()
  await expect.poll(async () => (await completed()).length, { timeout: 15000 }).toBe(2)
  const physicalPool = JSON.parse((await page.locator('body').getAttribute('data-pool'))!) as number[]
  const grabs = await page.evaluate(() => (window as unknown as { grabs: number[] }).grabs)
  expect(grabs).toHaveLength(1)
  const selected = grabs[0]
  expect(selected).toBeGreaterThanOrEqual(0)
  expect(selected).toBeLessThan(3)
  expect(physicalPool).toHaveLength(3)
  expect(physicalPool.filter((_, index) => index !== selected)).toEqual([2, 4, 6].filter((_, index) => index !== selected))
  expect(physicalPool[selected]).toBeGreaterThanOrEqual(1)
  expect(physicalPool[selected]).toBeLessThanOrEqual(6)
  expect(await completed()).toEqual([[2, 4, 6], [physicalPool[selected]]])
  await expect(iframe).toHaveCount(1)
  expect(await frame!.evaluate(() => document.body.dataset.persistence)).toBe('original-world')
  await page.evaluate(() => (window as unknown as { toggle: () => void }).toggle())
  await expect(iframe).toBeHidden()
  await page.evaluate(() => (window as unknown as { toggle: () => void }).toggle())
  await expect(iframe).toBeVisible()
  expect(await frame!.evaluate(() => document.body.dataset.persistence)).toBe('original-world')
  expect(faceMismatches).toEqual([])
})


