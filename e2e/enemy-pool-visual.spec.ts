import { expect, test } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'

test('the complete monster pool keeps goblin searchable and shows its bundled token art', async ({ page }) => {
  await page.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(async () => {
    const { useMapStore } = await import('/src/store/maps.ts')
    useMapStore.setState({
      maps: [{
        id: 'monster-pool-map',
        name: 'Monster pool',
        width: 800,
        height: 600,
        gridSize: 40,
        gridOffsetX: 0,
        gridOffsetY: 0,
        showGrid: true,
        feetPerCell: 5,
        tokens: [],
      }],
      selectedId: 'monster-pool-map',
    })
  })

  await page.getByRole('button', { name: '添加怪物' }).click()
  await expect(page.getByText('显示 334/334 项', { exact: false })).toBeVisible()

  const search = page.getByPlaceholder('搜索名称、标签或描述…')
  await search.fill('哥布林')
  await expect(page.getByText('地精', { exact: true })).toBeVisible()
  await expect(page.getByRole('img', { name: '地精 Token' })).toHaveAttribute(
    'src',
    '/assets/portraits/goblin-forest-scout-token.png',
  )
})
