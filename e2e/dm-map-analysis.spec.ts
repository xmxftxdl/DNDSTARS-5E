import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const DM = 'http://127.0.0.1:6173'

test('prep assistant detects reviewed wall candidates and exports an embedded-image UVTT', async ({ page }) => {
  await page.goto(`${DM}/campaign/local/dm-tools/prep`, { waitUntil: 'domcontentloaded' })
  const panel = page.getByRole('region', { name: '地图智能识别与 UVTT 转换' })
  await expect(panel).toBeVisible()

  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 400
    const context = canvas.getContext('2d')!
    context.fillStyle = '#f5f5f0'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.strokeStyle = '#111111'
    context.lineWidth = 12
    context.strokeRect(80, 60, 480, 280)
    context.beginPath()
    context.moveTo(320, 60)
    context.lineTo(320, 250)
    context.moveTo(110, 110)
    context.lineTo(285, 235)
    context.moveTo(355, 245)
    context.lineTo(520, 120)
    context.stroke()
    return canvas.toDataURL('image/png')
  })
  await panel.locator('input[type="file"]').setInputFiles({
    name: 'e2e-dungeon.png',
    mimeType: 'image/png',
    buffer: Buffer.from(dataUrl.split(',')[1], 'base64'),
  })

  await expect(panel.getByRole('img', { name: '待识别地图预览' })).toBeVisible()
  await expect(panel.getByRole('status')).toContainText('墙体候选', { timeout: 20_000 })
  await expect(panel.getByLabel('墙体识别候选覆盖层').locator('line').first()).toBeAttached()

  const downloadPromise = page.waitForEvent('download')
  await panel.getByRole('button', { name: '导出含原图的 UVTT' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('e2e-dungeon.uvtt')
  const path = await download.path()
  expect(path).toBeTruthy()
  const uvtt = JSON.parse(await readFile(path!, 'utf8')) as {
    resolution: { map_size: { x: number; y: number }; pixels_per_grid: number }
    line_of_sight: unknown[]
    image: string
  }
  expect(uvtt.resolution.pixels_per_grid).toBe(70)
  expect(uvtt.resolution.map_size.x).toBeCloseTo(640 / 70, 4)
  expect(uvtt.resolution.map_size.y).toBeCloseTo(400 / 70, 4)
  expect(uvtt.line_of_sight.length).toBeGreaterThan(0)
  expect(uvtt.image.length).toBeGreaterThan(100)
  await expect(panel.getByRole('status')).toContainText('已导出 e2e-dungeon.uvtt')
})
