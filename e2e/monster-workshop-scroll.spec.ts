import { expect, test } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'

test('monster workshop keeps a viewport-sized scroll region and can reach the last form section', async ({
  page,
  request,
}) => {
  const now = Date.now()
  const mapId = `monster-workshop-scroll-${now}`
  const stateResponse = await request.put(`${DM}/api/state/maps`, {
    data: {
      selectedId: mapId,
      updatedAt: now,
      maps: [{
        id: mapId,
        name: 'Monster workshop scroll E2E',
        width: 840,
        height: 560,
        gridSize: 70,
        gridOffsetX: 0,
        gridOffsetY: 0,
        showGrid: true,
        feetPerCell: 5,
        tokens: [],
      }],
    },
  })
  expect(stateResponse.ok()).toBeTruthy()

  await page.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: '添加怪物' }).click()
  await page.getByRole('button', { name: '怪物工坊' }).click()

  const dialog = page.getByTestId('monster-workshop-dialog')
  const scrollRegion = page.getByTestId('monster-workshop-scroll-region')
  await expect(dialog).toBeVisible()
  await expect(scrollRegion).toBeVisible()

  const dimensions = await scrollRegion.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    viewportHeight: window.innerHeight,
  }))
  expect(dimensions.clientHeight).toBeGreaterThan(0)
  expect(dimensions.clientHeight).toBeLessThanOrEqual(dimensions.viewportHeight)
  expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight)

  await scrollRegion.hover()
  await page.mouse.wheel(0, 900)
  await expect.poll(() => scrollRegion.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)

  const reachedBottom = await scrollRegion.evaluate((element) => {
    element.scrollTop = element.scrollHeight
    return Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop) <= 2
  })
  expect(reachedBottom).toBe(true)
})
