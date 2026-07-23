import { expect, test, type APIRequestContext } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'
const PLAYER = 'http://127.0.0.1:6174'

async function putState(request: APIRequestContext, name: string, payload: unknown) {
  const response = await request.put(`${DM}/api/state/${name}`, { data: payload })
  expect(response.ok(), `${name} should save`).toBeTruthy()
}

test('DM publishes a Fire Bolt presentation through SSE and the player renders it', async ({ browser, request }) => {
  const now = Date.now()
  const mapId = `combat-presentation-${now}`
  const sourceToken = {
    id: 'presentation-wizard', label: '法师', x: 140, y: 280,
    color: '#8b5cf6', emoji: '🧙', size: 1, type: 'player',
  }
  const targetToken = {
    id: 'presentation-goblin', label: '哥布林', x: 420, y: 280,
    color: '#ef4444', emoji: '👺', size: 1, type: 'enemy', hp: 7, maxHp: 7,
  }
  await request.delete(`${DM}/api/events/_all`)
  await putState(request, 'maps', {
    selectedId: mapId,
    updatedAt: now,
    maps: [{
      id: mapId, name: '战斗表现 E2E', width: 700, height: 560,
      gridSize: 70, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [sourceToken, targetToken],
    }],
  })

  const context = await browser.newContext()
  const dm = await context.newPage()
  const player = await context.newPage()
  await Promise.all([
    dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' }),
    player.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' }),
  ])
  await Promise.all([
    expect(dm.getByTestId('map-canvas')).toBeVisible(),
    expect(player.getByTestId('map-canvas')).toBeVisible(),
  ])

  await dm.evaluate(async ({ activeMapId, sourceTokenId, targetTokenId }) => {
    const presentation = await import('/src/lib/combatPresentation.ts')
    await presentation.publishFireBoltPresentation({
      id: `e2e-fire-bolt-${Date.now()}`,
      mapId: activeMapId,
      transactionId: `e2e-transaction-${Date.now()}`,
      sourceTokenId,
      targetTokenId,
      outcome: 'hit',
    })
  }, {
    activeMapId: mapId,
    sourceTokenId: sourceToken.id,
    targetTokenId: targetToken.id,
  })

  await expect(player.getByTestId('map-canvas')).toHaveAttribute('data-combat-projectile-count', '1')
  await expect.poll(async () =>
    Number(await player.getByTestId('map-canvas').getAttribute('data-combat-projectile-count')),
  ).toBe(0)
  await context.close()
})
