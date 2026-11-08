import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs/promises'
import path from 'node:path'
import { build } from 'vite'
import { expect, test } from '@playwright/test'

let bundle: Buffer
let css: Buffer
test.beforeAll(async ({ browserName }, testInfo) => {
  const output = path.resolve(testInfo.project.outputDir, 'inventory-equip-fixture', browserName)
  await build({ configFile: false, logLevel: 'error', define: {
    'process.env.NODE_ENV': '"production"', 'import.meta.env': '{"VITE_APP_MODE":"player"}',
  }, plugins: [tailwindcss(), { name: 'inventory-command-test-boundary', enforce: 'pre',
    resolveId(source, importer) {
      if (source === '../../store/roomCommands' && importer?.replaceAll('\\', '/').endsWith('/EquipmentTab.tsx')) return '\0inventory-commands'
    },
    load(id) {
      if (id === '\0inventory-commands') return 'export const mutateRoomCharacterInventory = (mutation) => window.inventoryTestMutate(mutation)'
    },
  }], build: { lib: { entry: 'e2e/fixtures/inventory-equip.tsx', formats: ['iife'], name: 'InventoryEquip', fileName: () => 'bundle.js' },
    outDir: output, emptyOutDir: false, minify: false } })
  bundle = await fs.readFile(path.join(output, 'bundle.js'))
  css = await fs.readFile(path.join(output, (await fs.readdir(output)).find(name => name.endsWith('.css'))!))
})
test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).pathname === '/bundle.js'
    ? route.fulfill({ contentType: 'text/javascript', body: bundle })
    : new URL(route.request().url()).pathname === '/style.css' ? route.fulfill({ contentType: 'text/css', body: css })
    : route.fulfill({ contentType: 'text/html', body: '<html><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/bundle.js"></script></html>' }))
  await page.goto('https://inventory-equip.test/')
  await expect(page.getByTestId('dnd5e-inventory')).toBeVisible()
})
test('player can explicitly replace main hand and retains old weapon and shield', async ({ page }) => {
  await page.getByTestId(/^inventory-tile-/).filter({ has: page.getByText('匕首', { exact: true }) }).click()
  await expect(page.getByRole('button', { name: '装备到主手', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: '装备到主手', exact: true }).click()
  await expect(page.getByTestId('inventory-equipment-slot-mainWeapon')).toContainText('匕首')
  await expect(page.getByTestId('inventory-equipment-slot-offHand')).toContainText('盾牌')
  await expect(page.getByTestId(/^inventory-tile-/).filter({ has: page.getByText('长剑', { exact: true }) })).toHaveCount(1)
  expect(await page.evaluate(() => window.equipRequests)).toMatchObject([{ type: 'equip', slot: 'mainWeapon' }])
})
test('player can drag a backpack weapon onto an occupied main hand', async ({ page }) => {
  const dagger = page.getByTestId(/^inventory-tile-/).filter({ has: page.getByText('匕首', { exact: true }) })
  const source = (await dagger.boundingBox())!
  const target = (await page.getByTestId('inventory-equipment-slot-mainWeapon').boundingBox())!
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await page.mouse.down()
  await page.mouse.move(source.x + source.width / 2 + 12, source.y + source.height / 2, { steps: 5 })
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 20 })
  await page.mouse.move(target.x + target.width / 2 + 1, target.y + target.height / 2)
  await page.mouse.up()
  await expect(page.getByTestId('inventory-equipment-slot-mainWeapon')).toContainText('匕首')
  expect(await page.evaluate(() => window.equipRequests)).toMatchObject([{ type: 'equip', slot: 'mainWeapon' }])
})
test('clicking the main hand equips the selected compatible weapon', async ({ page }) => {
  await page.getByTestId(/^inventory-tile-/).filter({ has: page.getByText('匕首', { exact: true }) }).click()
  await page.getByTestId('inventory-equipment-slot-mainWeapon').getByRole('button', { name: /^主手/ }).click()
  await expect(page.getByTestId('inventory-equipment-slot-mainWeapon')).toContainText('匕首')
})
test('read only inventory does not submit equipment changes', async ({ page }) => {
  await page.getByRole('button', { name: '切换只读' }).click()
  await page.getByTestId(/^inventory-tile-/).filter({ has: page.getByText('匕首', { exact: true }) }).click()
  await expect(page.getByRole('button', { name: '装备到主手', exact: true })).toHaveCount(0)
  await page.getByTestId('inventory-equipment-slot-mainWeapon').getByRole('button', { name: /^主手/ }).click()
  expect(await page.evaluate(() => window.equipRequests)).toEqual([])
})

test('equipped handheld items can move to main hand using a button', async ({ page }) => {
  await page.getByTestId(/^inventory-tile-/).filter({ has: page.getByText('奥术法器', { exact: true }) }).click()
  await page.getByRole('button', { name: '装备到副手', exact: true }).click()
  await expect(page.getByTestId('inventory-equipment-slot-offHand')).toContainText('奥术法器')
  await page.getByRole('button', { name: '装备到主手', exact: true }).click()
  await expect(page.getByTestId('inventory-equipment-slot-mainWeapon')).toContainText('奥术法器')
  await expect(page.getByTestId('inventory-equipment-slot-offHand')).not.toContainText('奥术法器')
})
test('equipped handheld items can be dragged directly to main hand', async ({ page }) => {
  await page.getByTestId(/^inventory-tile-/).filter({ has: page.getByText('奥术法器', { exact: true }) }).click()
  await page.getByRole('button', { name: '装备到副手', exact: true }).click()
  const source = (await page.getByTestId('inventory-equipment-slot-offHand').getByRole('button', { name: /^副手/ }).boundingBox())!
  const target = (await page.getByTestId('inventory-equipment-slot-mainWeapon').boundingBox())!
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await page.mouse.down()
  await page.mouse.move(source.x + source.width / 2 - 12, source.y + source.height / 2, { steps: 5 })
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 20 })
  await page.mouse.move(target.x + target.width / 2 + 1, target.y + target.height / 2)
  await page.mouse.up()
  await expect(page.getByTestId('inventory-equipment-slot-mainWeapon')).toContainText('奥术法器')
  await expect(page.getByTestId('inventory-equipment-slot-offHand')).not.toContainText('奥术法器')
})
