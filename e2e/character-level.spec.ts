import { expect, test } from '@playwright/test'

test('character level accepts replacement input and survives shared synchronization', async ({ page, request }) => {
  const name = `等级回归-${Date.now()}`
  await page.goto('http://127.0.0.1:6173/characters', { waitUntil: 'domcontentloaded' })

  await page.getByRole('button', { name: '新建角色' }).click()
  await page.getByPlaceholder('输入冒险者名称').fill(name)
  await page.getByRole('button', { name: '创建', exact: true }).click()

  const level = page.getByLabel('等级')
  await expect(level).toHaveValue('1')
  await level.fill('')
  await page.waitForTimeout(750)
  await expect(level).toHaveValue('')

  await level.fill('12')
  await level.press('Enter')
  await expect(level).toHaveValue('12')

  await expect.poll(async () => {
    const response = await request.get('http://127.0.0.1:6173/api/state/characters')
    if (!response.ok()) return null
    const state = await response.json() as { characters?: Array<{ name?: string; level?: number }> }
    return state.characters?.find((character) => character.name === name)?.level ?? null
  }).toBe(12)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByLabel('等级')).toHaveValue('12')

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('row').filter({ hasText: name }).getByTitle('删除').click()
  await expect(page.getByRole('row').filter({ hasText: name })).toHaveCount(0)
})
