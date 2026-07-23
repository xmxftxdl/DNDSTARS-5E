import { expect, test } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'
const SESSION_KEY = 'stars-room-session:v1'

test('free dice keeps its threejs iframe alive through React StrictMode and completes the roll', async ({ page, request }) => {
  const createdResponse = await request.post(`${DM}/api/rooms`, {
    data: {
      roomName: 'Dice animation regression', displayName: 'Dice DM',
      rulesetId: 'dnd5e-2014-srd-5.1', clientId: `dice-animation-${Date.now()}`, activePlugins: [],
    },
  })
  expect(createdResponse.status()).toBe(201)
  const created = await createdResponse.json() as {
    roomId: string; roomName: string; rulesetId: string; createdAt: number
    member: { memberId: string; roomToken: string; clientId: string; role: 'dm'; displayName: string }
  }
  const now = Date.now()
  const mapResponse = await request.put(`${DM}/api/state/maps?room=${created.roomId}`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Stars-Protocol': '5',
      'X-Stars-Expected-Revision': '0',
      'X-Stars-Member': created.member.memberId,
      'X-Stars-Room-Token': created.member.roomToken,
    },
    data: {
      selectedId: 'dice-map', updatedAt: now,
      maps: [{
        id: 'dice-map', name: '骰子地图', width: 800, height: 600,
        gridSize: 40, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
        tokens: [],
      }],
    },
  })
  expect(mapResponse.ok()).toBeTruthy()

  await page.addInitScript(([key, response]) => {
    localStorage.setItem(key, JSON.stringify({
      roomId: response.roomId,
      roomName: response.roomName,
      rulesetId: response.rulesetId,
      createdAt: response.createdAt,
      ...response.member,
    }))
  }, [SESSION_KEY, created] as const)
  await page.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('map-canvas').waitFor()
  await page.getByTestId('map-dice-roller-toggle').click()
  const rollButton = page.getByRole('button', { name: '投掷 1d20' })
  await rollButton.click()

  const rollFrame = page.locator('iframe[title="20-sided dice roller"]')
  await expect(rollFrame).toHaveAttribute('src', /sides=20&qty=1/)
  await expect.poll(async () => rollFrame.contentFrame().locator('canvas').count()).toBe(1)
  await expect(page.getByRole('button', { name: '骰子滚动中…' })).toBeVisible()
  await expect(rollButton).toBeEnabled({ timeout: 20_000 })
})
