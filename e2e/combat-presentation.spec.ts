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

test('DM publishes Fireball flight and area explosion through SSE', async ({ browser, request }) => {
  const now = Date.now()
  const mapId = `fireball-presentation-${now}`
  const sourceToken = {
    id: 'fireball-wizard', label: '法师', x: 105, y: 245,
    color: '#8b5cf6', emoji: '🧙', size: 1, type: 'player',
  }
  await request.delete(`${DM}/api/events/_all`)
  await putState(request, 'maps', {
    selectedId: mapId,
    updatedAt: now,
    maps: [{
      id: mapId, name: '火球术表现 E2E', width: 700, height: 560,
      gridSize: 70, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [sourceToken],
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

  await dm.evaluate(async ({ activeMapId, sourceTokenId }) => {
    const presentation = await import('/src/lib/combatPresentation.ts')
    await presentation.publishFireballPresentation({
      id: `e2e-fireball-${Date.now()}`,
      mapId: activeMapId,
      transactionId: `e2e-fireball-transaction-${Date.now()}`,
      sourceTokenId,
      casterName: '法师',
      spellName: '火球术',
      castingClassId: 'wizard',
      targetCell: { col: 6, row: 3 },
      radiusFeet: 20,
    })
  }, {
    activeMapId: mapId,
    sourceTokenId: sourceToken.id,
  })

  await expect(player.getByTestId('map-canvas')).toHaveAttribute('data-combat-projectile-count', '1')
  await expect(player.getByTestId('map-canvas')).toHaveAttribute('data-combat-projectile-kinds', 'fireball')
  await expect.poll(async () =>
    Number(await player.getByTestId('map-canvas').getAttribute('data-combat-projectile-count')),
  ).toBe(0)
  await context.close()
})

test('four class-colored cantrip animations render before settlement', async ({
  browser,
  request,
}, testInfo) => {
  const now = Date.now()
  const mapId = `cantrip-presentations-${now}`
  const sourceToken = {
    id: 'cantrip-bard',
    label: '诗人',
    x: 105,
    y: 280,
    color: '#d946ef',
    emoji: '🎭',
    size: 1,
    type: 'player',
  }
  const targets = [
    { id: 'dying-target', label: '濒死目标', x: 315, y: 105, color: '#64748b', emoji: '🛡️', size: 1, type: 'player' },
    { id: 'acid-target', label: '酸液目标', x: 490, y: 210, color: '#ef4444', emoji: '👹', size: 1, type: 'enemy' },
    { id: 'poison-target', label: '毒雾目标', x: 490, y: 350, color: '#ef4444', emoji: '👹', size: 1, type: 'enemy' },
    { id: 'mockery-target', label: '恶言目标', x: 315, y: 455, color: '#ef4444', emoji: '👹', size: 1, type: 'enemy' },
  ]
  await request.delete(`${DM}/api/events/_all`)
  await putState(request, 'maps', {
    selectedId: mapId,
    updatedAt: now,
    maps: [{
      id: mapId,
      name: '四戏法动画 E2E',
      width: 700,
      height: 560,
      gridSize: 70,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [sourceToken, ...targets],
    }],
  })

  const context = await browser.newContext({ viewport: { width: 1100, height: 820 } })
  const dm = await context.newPage()
  const player = await context.newPage()
  await Promise.all([
    dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' }),
    player.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' }),
  ])
  const canvas = player.getByTestId('map-canvas')
  await Promise.all([
    expect(dm.getByTestId('map-canvas')).toBeVisible(),
    expect(canvas).toBeVisible(),
  ])
  // Let both SSE subscriptions settle before broadcasting short-lived animations.
  await player.waitForTimeout(600)

  await player.evaluate(async ({ activeMapId, sourceTokenId, targetIds }) => {
    const presentation = await import('/src/lib/combatPresentation.ts')
    await presentation.refreshCombatPresentationClock(true)
    const common = {
      mapId: activeMapId,
      sourceTokenId,
      accentColor: '#d946ef',
      glowColor: '#e879f9',
    }
    const stamp = Date.now()
    void Promise.all([
      presentation.publishSpareTheDyingPresentation({
        ...common,
        id: `e2e-spare-${stamp}`,
        transactionId: `e2e-spare-tx-${stamp}`,
        targetTokenId: targetIds[0],
      }),
      presentation.publishAcidSplashPresentation({
        ...common,
        id: `e2e-acid-${stamp}`,
        transactionId: `e2e-acid-tx-${stamp}`,
        targetTokenId: targetIds[1],
      }),
      presentation.publishPoisonSprayPresentation({
        ...common,
        id: `e2e-poison-${stamp}`,
        transactionId: `e2e-poison-tx-${stamp}`,
        targetTokenId: targetIds[2],
      }),
      presentation.publishViciousMockeryPresentation({
        ...common,
        id: `e2e-mockery-${stamp}`,
        transactionId: `e2e-mockery-tx-${stamp}`,
        targetTokenId: targetIds[3],
      }),
    ])
  }, {
    activeMapId: mapId,
    sourceTokenId: sourceToken.id,
    targetIds: targets.map((target) => target.id),
  })

  await expect.poll(async () => {
    const kinds = (await canvas.getAttribute('data-combat-projectile-kinds') ?? '')
      .split(',')
      .filter(Boolean)
      .sort()
    return kinds
  }).toEqual(['acid-splash', 'poison-spray', 'spare-the-dying', 'vicious-mockery'])
  // Once all four local presentations are mounted, let their expanding bodies
  // reach an early-mid frame and capture before the short effects fade.
  await player.waitForTimeout(180)
  await canvas.screenshot({
    path: process.env.CANTRIP_ANIMATIONS_SCREENSHOT_PATH ??
      testInfo.outputPath('four-cantrip-animations.png'),
  })
  await expect.poll(async () =>
    Number(await canvas.getAttribute('data-combat-projectile-count')),
  ).toBe(0)
  await context.close()
})
