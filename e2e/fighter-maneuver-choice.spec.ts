import { expect, test } from '@playwright/test'

test('Battle Master maneuver choices survive an immediate refresh', async ({ page, request }) => {
  const name = `战技回归-${Date.now()}`
  await page.goto('http://127.0.0.1:6173/characters', { waitUntil: 'domcontentloaded' })

  await page.getByRole('button', { name: '新建角色' }).click()
  await page.getByPlaceholder('输入冒险者名称').fill(name)
  await page.getByRole('button', { name: '创建', exact: true }).click()

  await page.getByLabel('等级').fill('3')
  await expect.poll(async () => {
    const response = await request.get('http://127.0.0.1:6173/api/state/characters')
    const state = await response.json() as { characters?: Array<{ name?: string; level?: number }> }
    return state.characters?.find((character) => character.name === name)?.level ?? null
  }).toBe(3)

  await page.getByRole('button', { name: '战士', exact: true }).click()
  await page.getByLabel('武术范型（3级）').selectOption('battle-master')
  await expect.poll(async () => {
    const response = await request.get('http://127.0.0.1:6173/api/state/characters')
    const state = await response.json() as {
      characters?: Array<{ name?: string; dnd5eClassChoices?: { fighter?: { subclass?: string } } }>
    }
    return state.characters?.find((character) => character.name === name)?.dnd5eClassChoices?.fighter?.subclass ?? null
  }).toBe('battle-master')

  const baselineResponse = await request.get('http://127.0.0.1:6173/api/state/characters')
  const staleSnapshot = await baselineResponse.json() as { updatedAt?: number }
  await page.route('**/api/state/characters*', async (route) => {
    if (route.request().method() === 'PUT') {
      await new Promise((resolve) => setTimeout(resolve, 1_000))
    }
    await route.continue()
  })

  const maneuverNames = ['缴械攻击', '精准攻击', '摔绊攻击']
  for (const maneuverName of maneuverNames) {
    await page.getByRole('button', { name: new RegExp(`^${maneuverName}`) }).click()
  }

  // Simulate another endpoint publishing a newer full-array snapshot that was
  // captured before the local maneuver clicks. Pending local choices must win
  // until the delayed save is acknowledged.
  staleSnapshot.updatedAt = Date.now()
  await request.put('http://127.0.0.1:6173/api/state/characters', { data: staleSnapshot })
  await page.waitForTimeout(300)
  for (const maneuverName of maneuverNames) {
    await expect(page.getByRole('button', { name: new RegExp(`^${maneuverName}`) })).toHaveAttribute('aria-pressed', 'true')
  }

  await page.waitForTimeout(1_600)
  await page.unroute('**/api/state/characters*')

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: '战士', exact: true }).click()
  for (const maneuverName of maneuverNames) {
    await expect(page.getByRole('button', { name: new RegExp(`^${maneuverName}`) })).toHaveAttribute('aria-pressed', 'true')
  }

  await expect.poll(async () => {
    const response = await request.get('http://127.0.0.1:6173/api/state/characters')
    const state = await response.json() as {
      characters?: Array<{ name?: string; dnd5eClassChoices?: { fighter?: { maneuvers?: string[] } } }>
    }
    return state.characters?.find((character) => character.name === name)?.dnd5eClassChoices?.fighter?.maneuvers ?? []
  }).toEqual(['disarming-attack', 'precision-attack', 'trip-attack'])

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('row').filter({ hasText: name }).getByTitle('删除').click()
  await expect(page.getByRole('row').filter({ hasText: name })).toHaveCount(0)
})
