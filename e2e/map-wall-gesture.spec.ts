import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { build } from 'vite'
import { expect, test } from '@playwright/test'

let bundle: Buffer
test.beforeAll(async ({ browserName }, testInfo) => {
  const output = path.resolve(testInfo.project.outputDir, 'wall-gesture-fixture', browserName)
  await build({ configFile: false, logLevel: 'error', define: { 'process.env.NODE_ENV': '"production"' },
    build: { lib: { entry: 'e2e/fixtures/map-wall-gesture.tsx', formats: ['iife'], name: 'WallGesture', fileName: () => 'bundle.js' },
      outDir: output, emptyOutDir: false, minify: false } })
  bundle = await readFile(path.join(output, 'bundle.js'))
})

test('wall starts and release positions stay independent across rapid gestures, zoom and pan', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 })
  // Run the actual canvas without a room, external assets, or network access.
  await page.route('**/*', (route) => {
    const url = route.request().url()
    if (url.endsWith('/bundle.js')) return route.fulfill({ contentType: 'text/javascript; charset=utf-8', body: bundle })
    if (url === 'http://wall-gesture.test/') return route.fulfill({ contentType: 'text/html; charset=utf-8',
      body: '<html><meta charset="utf-8"><style>body{margin:0}.h-full{height:100%}.w-full{width:100%}.relative{position:relative}</style><div id="root"></div><script src="/bundle.js"></script></html>' })
    return route.fulfill({ status: 404, body: '' })
  })
  await page.goto('http://wall-gesture.test/')
  await page.locator('.konvajs-content').waitFor()
  const draw = async (from: number[], to: number[]) => {
    await page.mouse.move(from[0], from[1])
    await page.mouse.down()
    await page.mouse.move(to[0], to[1], { steps: 8 })
    await page.mouse.up()
  }
  await draw([180, 180], [350, 180])
  await draw([600, 400], [750, 400])
  await draw([350, 180], [350, 330])
  await page.evaluate(() => {
    const target = document.querySelector('.konvajs-content')!
    // No React render between move and up: the release differs from the last preview.
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 450, clientY: 600, button: 0, buttons: 1 }))
    target.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 650, clientY: 600, button: 0, buttons: 1 }))
    target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 700, clientY: 650, button: 0, buttons: 0 }))
  })
  await expect.poll(() => page.evaluate(() => window.wallGestureCommits.map((wall) => wall.points))).toEqual([
    [{ x: 180, y: 180 }, { x: 350, y: 180 }],
    [{ x: 600, y: 400 }, { x: 750, y: 400 }],
    [{ x: 350, y: 180 }, { x: 350, y: 330 }],
    [{ x: 450, y: 600 }, { x: 700, y: 650 }],
  ])
  await page.mouse.move(500, 400)
  await page.mouse.wheel(0, -250)
  const canvas = page.locator('[data-testid="map-canvas"]')
  await expect.poll(() => canvas.getAttribute('data-viewport-scale')).not.toBe('1')
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(575, 450, { steps: 5 })
  await page.mouse.up({ button: 'right' })
  const view = await canvas.evaluate((el) => ({ x: Number(el.dataset.viewportX), y: Number(el.dataset.viewportY), scale: Number(el.dataset.viewportScale) }))
  await draw([200, 400], [400, 550])
  const points = await page.evaluate(() => window.wallGestureCommits.at(-1)!.points)
  for (const [index, point] of [[200, 400], [400, 550]].entries()) {
    expect(points[index].x).toBeCloseTo((point[0] - view.x) / view.scale, 2)
    expect(points[index].y).toBeCloseTo((point[1] - view.y) / view.scale, 2)
  }
  expect(await page.evaluate(() => window.wallGestureEdits)).toEqual([])
  const count = await page.evaluate(() => window.wallGestureCommits.length)
  await page.mouse.move(300, 300)
  await page.mouse.down()
  await page.mouse.move(1050, 850, { steps: 8 })
  await page.mouse.up()
  await page.mouse.move(450, 400)
  expect(await page.evaluate(() => window.wallGestureCommits.length)).toBe(count)
  await draw([450, 400], [600, 500])
  const restarted = await page.evaluate(() => window.wallGestureCommits.at(-1)!.points)
  for (const [index, point] of [[450, 400], [600, 500]].entries()) {
    expect(restarted[index].x).toBeCloseTo((point[0] - view.x) / view.scale, 2)
    expect(restarted[index].y).toBeCloseTo((point[1] - view.y) / view.scale, 2)
  }
  // Endpoint snapping uses screen distance even after zoom and pan, with grid snapping off.
  const freeEnd = [Math.round(view.x + 250 * view.scale), Math.round(view.y + 290 * view.scale)]
  await draw([view.x + 180 * view.scale + 4, view.y + 180 * view.scale + 3], freeEnd)
  const snapped = await page.evaluate(() => window.wallGestureCommits.at(-1)!.points)
  expect(snapped[0]).toEqual({ x: 180, y: 180 })
  expect(snapped[1].x).toBeCloseTo((freeEnd[0] - view.x) / view.scale, 2)
  expect(snapped[1].y).toBeCloseTo((freeEnd[1] - view.y) / view.scale, 2)

})
