import fs from 'node:fs/promises'
import path from 'node:path'
import { build } from 'vite'
import { expect, test } from '@playwright/test'

let bundle: Buffer
test.beforeAll(async ({ browserName }, testInfo) => {
  const output = path.resolve(testInfo.project.outputDir, 'npc-create-fixture', browserName)
  await build({ configFile: false, logLevel: 'error', define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'npc-image-storage-test-endpoint', enforce: 'pre',
      resolveId(source, importer) {
        if (source === '../../lib/imageStore' && importer?.replaceAll('\\', '/').endsWith('/NpcCreateDialog.tsx')) return '\0npc-image-store'
      },
      load(id) {
        if (id === '\0npc-image-store') return `
          export async function putImage(id, blob) {
            const response = await fetch('/test-images/' + id, {method:'PUT', headers:{'Content-Type':blob.type}, body:blob});
            return response.ok;
          }
          export async function deleteImage(id) { await fetch('/test-images/' + id, {method:'DELETE'}); }
        `
      },
    }],
    build: { lib: { entry: 'e2e/fixtures/npc-create.tsx', formats: ['iife'], name: 'NpcCreate', fileName: () => 'bundle.js' },
      outDir: output, emptyOutDir: false, minify: false },
  })
  bundle = await fs.readFile(path.join(output, 'bundle.js'))
})

test('NPC creation works with production CSP and preserves the form after upload failure', async ({ page }) => {
  let failUpload = true
  const uploaded: { bytes: number; type: string }[] = []
  await page.route('**/*', (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname === '/bundle.js') return route.fulfill({ contentType: 'text/javascript', body: bundle })
    if (url.pathname.startsWith('/test-images/')) {
      if (request.method() === 'PUT') {
        if (failUpload) return route.fulfill({ status: 503, body: '' })
        uploaded.push({ bytes: request.postDataBuffer()?.length ?? 0, type: request.headers()['content-type'] })
      }
      return route.fulfill({ status: 200, body: '' })
    }
    return route.fulfill({ contentType: 'text/html', headers: {
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'",
    }, body: '<html><meta charset="utf-8"><div id="root"></div><script src="/bundle.js"></script></html>' })
  })
  await page.goto('https://npc-create.test/')
  // Confirm the original failure is reproducible with the actual site's policy.
  expect(await page.evaluate(() => fetch('data:image/png;base64,AA==').then(() => false, () => true))).toBe(true)
  await page.getByRole('textbox', { name: '名字' }).fill('法尔米尔·冬驻')
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 20; canvas.height = 20
    canvas.getContext('2d')!.fillRect(0, 0, 20, 20)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  await page.getByLabel('上传 NPC 画像').setInputFiles({ name: 'npc.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') })
  await expect(page.getByAltText('NPC 画像预览')).toBeVisible()
  await page.getByRole('button', { name: '添加到地图' }).click()
  await expect(page.getByRole('alert')).toContainText('画像未能上传到房间')
  expect(await page.evaluate(() => window.createdNpcs.length)).toBe(0)
  await expect(page.getByRole('textbox', { name: '名字' })).toHaveValue('法尔米尔·冬驻')
  failUpload = false
  await page.getByRole('button', { name: '添加到地图' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const created = await page.evaluate(() => window.createdNpcs)
  expect(created).toHaveLength(1)
  expect(created[0].label).toBe('法尔米尔·冬驻')
  expect(created[0].portraitImageId).toBeTruthy()
  expect(created[0].tokenPortraitImageId).toBe(created[0].portraitImageId)
  expect(uploaded).toHaveLength(1)
  expect(uploaded[0].bytes).toBeGreaterThan(0)
  expect(uploaded[0].type).toMatch(/^image\/(webp|jpeg)$/)
  await page.getByRole('button', { name: '添加 NPC', exact: true }).click()
  await page.getByRole('textbox', { name: '名字' }).fill('路过的旅人')
  await page.getByRole('button', { name: '添加到地图' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await page.evaluate(() => window.createdNpcs)).toHaveLength(2)
  expect(uploaded).toHaveLength(1)
})
