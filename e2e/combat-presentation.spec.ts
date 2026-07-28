import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'
const PLAYER = 'http://127.0.0.1:6174'

async function putState(request: APIRequestContext, name: string, payload: unknown) {
  const current = await request.get(`${DM}/api/state/${name}`)
  const currentBody = current.ok()
    ? await current.json() as { updatedAt?: number }
    : null
  const nextPayload = payload && typeof payload === 'object'
    ? {
        ...payload,
        updatedAt: Math.max(
          Date.now(),
          Number((payload as { updatedAt?: number }).updatedAt ?? 0),
          Number(currentBody?.updatedAt ?? 0) + 1,
        ),
      }
    : payload
  const response = await request.put(`${DM}/api/state/${name}`, { data: nextPayload })
  expect(response.ok(), `${name} should save`).toBeTruthy()
  const result = await response.json() as { applied?: boolean }
  expect(result.applied, `${name} should be applied`).not.toBe(false)
}

async function hydrateMaps(page: Page) {
  await page.evaluate(async () => {
    const { useMapStore } = await import('/src/store/maps.ts')
    await useMapStore.getState().loadShared()
  })
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
    dm.waitForURL(/\/campaign\/local\/maps$/),
    player.waitForURL(/\/campaign\/local\/maps$/),
  ])
  await Promise.all([hydrateMaps(dm), hydrateMaps(player)])
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
    dm.waitForURL(/\/campaign\/local\/maps$/),
    player.waitForURL(/\/campaign\/local\/maps$/),
  ])
  await Promise.all([hydrateMaps(dm), hydrateMaps(player)])
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

test('material spell VFX render from texture assets', async ({ browser, request }, testInfo) => {
  const now = Date.now()
  const mapId = `material-spell-vfx-${now}`
  const spellKinds = [
    'fire-bolt',
    'produce-flame',
    'ray-of-frost',
    'eldritch-blast',
    'sacred-flame',
    'chill-touch',
  ] as const
  const tokens = spellKinds.flatMap((kind, index) => {
    const y = 90 + index * 95
    return [
      {
        id: `${kind}-caster`,
        label: kind,
        x: 105,
        y,
        color: '#8b5cf6',
        emoji: '🧙',
        size: 1,
        type: 'player',
      },
      {
        id: `${kind}-target`,
        label: `${kind} target`,
        x: 490,
        y,
        color: '#ef4444',
        emoji: '👹',
        size: 1,
        type: 'enemy',
      },
    ]
  })
  await request.delete(`${DM}/api/events/_all`)
  await putState(request, 'maps', {
    selectedId: mapId,
    updatedAt: now,
    maps: [{
      id: mapId,
      name: 'Material Spell VFX E2E',
      width: 700,
      height: 660,
      gridSize: 70,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens,
    }],
  })

  const context = await browser.newContext({ viewport: { width: 1_050, height: 920 } })
  const player = await context.newPage()
  await player.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' })
  await player.waitForURL(/\/campaign\/local\/maps$/)
  const canvas = player.getByTestId('map-canvas')
  await expect(canvas).toBeVisible()
  await player.waitForTimeout(1_500)

  await player.evaluate(async ({ activeMapId, kinds }) => {
    const presentation = await import('/src/lib/combatPresentation.ts')
    await presentation.refreshCombatPresentationClock(true)
    const stamp = Date.now()
    const publish = {
      'fire-bolt': presentation.publishFireBoltPresentation,
      'produce-flame': presentation.publishProduceFlamePresentation,
      'ray-of-frost': presentation.publishRayOfFrostPresentation,
      'eldritch-blast': presentation.publishEldritchBlastPresentation,
      'sacred-flame': presentation.publishSacredFlamePresentation,
      'chill-touch': presentation.publishChillTouchPresentation,
    }
    void Promise.all(kinds.map((kind) =>
      publish[kind]({
        id: `e2e-${kind}-${stamp}`,
        mapId: activeMapId,
        transactionId: `e2e-${kind}-tx-${stamp}`,
        sourceTokenId: `${kind}-caster`,
        targetTokenId: `${kind}-target`,
      }),
    ))
  }, { activeMapId: mapId, kinds: spellKinds })

  await expect.poll(async () => {
    const kinds = (await canvas.getAttribute('data-combat-projectile-kinds') ?? '')
      .split(',')
      .filter(Boolean)
    return spellKinds.every((kind) => kinds.includes(kind))
  }).toBe(true)
  await player.waitForTimeout(80)
  await player.getByTestId('map-canvas').screenshot({
    path: process.env.MATERIAL_SPELL_VFX_SCREENSHOT_PATH ??
      testInfo.outputPath('material-spell-vfx.png'),
  })
  await expect.poll(async () =>
    Number(await canvas.getAttribute('data-combat-projectile-count')),
  ).toBe(0)
  await context.close()
})

test('next ranged spell VFX render from texture assets', async ({ browser, request }, testInfo) => {
  const now = Date.now()
  const mapId = `next-ranged-spell-vfx-${now}`
  const spellKinds = [
    'magic-missile',
    'scorching-ray',
    'guiding-bolt',
    'acid-arrow',
  ] as const
  const tokens = spellKinds.flatMap((kind, index) => {
    const y = 110 + index * 135
    return [
      {
        id: `${kind}-caster`,
        label: kind,
        x: 110,
        y,
        color: '#8b5cf6',
        emoji: '🧙',
        size: 1,
        type: 'player',
      },
      {
        id: `${kind}-target`,
        label: `${kind} target`,
        x: 560,
        y,
        color: '#ef4444',
        emoji: '👹',
        size: 1,
        type: 'enemy',
      },
    ]
  })
  await request.delete(`${DM}/api/events/_all`)
  await putState(request, 'maps', {
    selectedId: mapId,
    updatedAt: now,
    maps: [{
      id: mapId,
      name: 'Next Ranged Spell VFX E2E',
      width: 760,
      height: 650,
      gridSize: 70,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens,
    }],
  })

  const context = await browser.newContext({ viewport: { width: 1_100, height: 900 } })
  const player = await context.newPage()
  await player.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' })
  await player.waitForURL(/\/campaign\/local\/maps$/)
  const canvas = player.getByTestId('map-canvas')
  await expect(canvas).toBeVisible()
  await player.waitForTimeout(1_500)

  await player.evaluate(async ({ activeMapId, kinds }) => {
    const presentation = await import('/src/lib/combatPresentation.ts')
    await presentation.refreshCombatPresentationClock(true)
    const stamp = Date.now()
    const publish = {
      'magic-missile': presentation.publishMagicMissilePresentation,
      'scorching-ray': presentation.publishScorchingRayPresentation,
      'guiding-bolt': presentation.publishGuidingBoltPresentation,
      'acid-arrow': presentation.publishAcidArrowPresentation,
    }
    void Promise.all(kinds.map((kind) =>
      publish[kind]({
        id: `e2e-${kind}-${stamp}`,
        mapId: activeMapId,
        transactionId: `e2e-${kind}-tx-${stamp}`,
        sourceTokenId: `${kind}-caster`,
        targetTokenId: `${kind}-target`,
      }),
    ))
  }, { activeMapId: mapId, kinds: spellKinds })

  await expect.poll(async () => {
    const kinds = (await canvas.getAttribute('data-combat-projectile-kinds') ?? '')
      .split(',')
      .filter(Boolean)
    return spellKinds.every((kind) => kinds.includes(kind))
  }).toBe(true)
  await player.waitForTimeout(100)
  await canvas.screenshot({
    path: process.env.NEXT_SPELL_VFX_SCREENSHOT_PATH ??
      testInfo.outputPath('next-ranged-spell-vfx.png'),
  })
  await expect.poll(async () =>
    Number(await canvas.getAttribute('data-combat-projectile-count')),
  ).toBe(0)
  await context.close()
})

test('healing and necrotic spell VFX render from texture assets', async ({ browser, request }, testInfo) => {
  const now = Date.now()
  const mapId = `healing-necrotic-spell-vfx-${now}`
  const spellKinds = [
    'cure-wounds',
    'healing-word',
    'inflict-wounds',
    'hellish-rebuke',
  ] as const
  const tokens = spellKinds.flatMap((kind, index) => {
    const y = 110 + index * 135
    return [
      {
        id: `${kind}-caster`,
        label: kind,
        x: 110,
        y,
        color: '#8b5cf6',
        emoji: '🧙',
        size: 1,
        type: 'player',
      },
      {
        id: `${kind}-target`,
        label: `${kind} target`,
        x: 560,
        y,
        color: kind === 'cure-wounds' || kind === 'healing-word' ? '#22c55e' : '#ef4444',
        emoji: kind === 'cure-wounds' || kind === 'healing-word' ? '🧝' : '👹',
        size: 1,
        type: kind === 'cure-wounds' || kind === 'healing-word' ? 'player' : 'enemy',
      },
    ]
  })
  await request.delete(`${DM}/api/events/_all`)
  await putState(request, 'maps', {
    selectedId: mapId,
    updatedAt: now,
    maps: [{
      id: mapId,
      name: 'Healing and Necrotic Spell VFX E2E',
      width: 760,
      height: 650,
      gridSize: 70,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens,
    }],
  })

  const context = await browser.newContext({ viewport: { width: 1_100, height: 900 } })
  const player = await context.newPage()
  await player.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' })
  await player.waitForURL(/\/campaign\/local\/maps$/)
  const canvas = player.getByTestId('map-canvas')
  await expect(canvas).toBeVisible()
  await player.waitForTimeout(1_500)

  await player.evaluate(async ({ activeMapId, kinds }) => {
    const presentation = await import('/src/lib/combatPresentation.ts')
    await presentation.refreshCombatPresentationClock(true)
    const stamp = Date.now()
    const publish = {
      'cure-wounds': presentation.publishCureWoundsPresentation,
      'healing-word': presentation.publishHealingWordPresentation,
      'inflict-wounds': presentation.publishInflictWoundsPresentation,
      'hellish-rebuke': presentation.publishHellishRebukePresentation,
    }
    void Promise.all(kinds.map((kind) =>
      publish[kind]({
        id: `e2e-${kind}-${stamp}`,
        mapId: activeMapId,
        transactionId: `e2e-${kind}-tx-${stamp}`,
        sourceTokenId: `${kind}-caster`,
        targetTokenId: `${kind}-target`,
      }),
    ))
  }, { activeMapId: mapId, kinds: spellKinds })

  await expect.poll(async () => {
    const kinds = (await canvas.getAttribute('data-combat-projectile-kinds') ?? '')
      .split(',')
      .filter(Boolean)
    return spellKinds.every((kind) => kinds.includes(kind))
  }).toBe(true)
  await player.waitForTimeout(100)
  await canvas.screenshot({
    path: process.env.HEALING_NECROTIC_VFX_SCREENSHOT_PATH ??
      testInfo.outputPath('healing-necrotic-spell-vfx.png'),
  })
  await expect.poll(async () =>
    Number(await canvas.getAttribute('data-combat-projectile-count')),
  ).toBe(0)
  await context.close()
})

test('area spell VFX follow selected map geometry', async ({ browser, request }, testInfo) => {
  const now = Date.now()
  const mapId = `area-spell-vfx-${now}`
  const spellKinds = [
    'burning-hands',
    'thunderwave',
    'shatter',
    'lightning-bolt',
  ] as const
  const tokens = spellKinds.map((kind, index) => ({
    id: `${kind}-caster`,
    label: kind,
    x: 140,
    y: 100 + index * 160,
    color: '#8b5cf6',
    emoji: '🧙',
    size: 1,
    type: 'player',
  }))
  await request.delete(`${DM}/api/events/_all`)
  await putState(request, 'maps', {
    selectedId: mapId,
    updatedAt: now,
    maps: [{
      id: mapId,
      name: 'Area Spell VFX E2E',
      width: 1_100,
      height: 720,
      gridSize: 70,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens,
    }],
  })

  const context = await browser.newContext({ viewport: { width: 1_350, height: 950 } })
  const player = await context.newPage()
  await player.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' })
  await player.waitForURL(/\/campaign\/local\/maps$/)
  const canvas = player.getByTestId('map-canvas')
  await expect(canvas).toBeVisible()
  await player.waitForTimeout(1_500)

  await player.evaluate(async ({ activeMapId, kinds }) => {
    const presentation = await import('/src/lib/combatPresentation.ts')
    await presentation.refreshCombatPresentationClock(true)
    const stamp = Date.now()
    const geometry = {
      'burning-hands': {
        targetCell: { col: 5, row: 1 },
        shape: 'cone' as const,
        lengthFeet: 15,
        widthFeet: 15,
      },
      thunderwave: {
        targetCell: { col: 5, row: 3 },
        shape: 'line' as const,
        lengthFeet: 15,
        widthFeet: 15,
      },
      shatter: {
        targetCell: { col: 7, row: 6 },
        shape: 'circle' as const,
        radiusFeet: 10,
      },
      'lightning-bolt': {
        targetCell: { col: 5, row: 8 },
        shape: 'line' as const,
        lengthFeet: 100,
        widthFeet: 5,
      },
    }
    await Promise.all(kinds.map((kind) =>
      presentation.publishAreaSpellPresentation({
        id: `e2e-${kind}-${stamp}`,
        mapId: activeMapId,
        transactionId: `e2e-${kind}-tx-${stamp}`,
        sourceTokenId: `${kind}-caster`,
        spellId: kind,
        ...geometry[kind],
      }),
    ))
  }, { activeMapId: mapId, kinds: spellKinds })

  await expect.poll(async () => {
    const kinds = (await canvas.getAttribute('data-combat-projectile-kinds') ?? '')
      .split(',')
      .filter(Boolean)
    return spellKinds.every((kind) => kinds.includes(kind))
  }).toBe(true)
  await player.waitForTimeout(110)
  await canvas.screenshot({
    path: process.env.AREA_SPELL_VFX_SCREENSHOT_PATH ??
      testInfo.outputPath('area-spell-vfx.png'),
  })
  await expect.poll(async () =>
    Number(await canvas.getAttribute('data-combat-projectile-count')),
  ).toBe(0)
  await context.close()
})

test('persistent buff and debuff spell badges stack without overlap', async ({ browser, request }, testInfo) => {
  const now = Date.now()
  const mapId = `persistent-spell-badges-${now}`
  const statusKinds = [
    'bless',
    'bane',
    'shield-of-faith',
    'mage-armor',
    'jump',
    'darkvision',
    'see-invisibility',
    'warding-bond',
    'fly',
    'heroism',
    'enlarge-reduce',
    'enhance-ability',
    'divine-favor',
    'hunters-mark',
    'magic-weapon',
    'flame-blade',
    'invisibility',
    'blur',
    'barkskin',
    'protection-from-poison',
    'longstrider',
    'protection-from-energy',
    'death-ward',
    'greater-invisibility',
    'charm-person',
    'hideous-laughter',
    'hold-person',
    'blindness-deafness',
  ] as const
  const manifestationKinds = [
    'charm-person',
    'hideous-laughter',
    'hold-person',
    'blindness-deafness',
  ] as const
  const sourceTokens = statusKinds.map((kind, index) => ({
    id: `${kind}-source`,
    label: `${kind} source`,
    x: 80 + Math.floor(index / 7) * 105,
    y: 45 + (index % 7) * 78,
    color: '#8b5cf6',
    emoji: '🧙',
    size: 1,
    type: 'player',
  }))
  const targetToken = {
    id: 'persistent-status-target',
    label: 'Persistent Status Target',
    x: 610,
    y: 320,
    color: '#38bdf8',
    emoji: '🛡️',
    size: 1,
    type: 'player',
    dnd5eCombatState: {
      schemaVersion: 2,
      concentrationEffectsBySource: {
        'bless-source': 'bless',
        'bane-source': 'bane',
        'shield-of-faith-source': 'shield-of-faith',
        'hunters-mark-source': 'hunters-mark',
      },
      activeEffects: [{
        schemaVersion: 1,
        id: 'mage-armor-e2e-effect',
        definitionId: 'srd-5.1:spell:mage-armor',
        label: 'Mage Armor',
        kind: 'buff',
        source: {
          kind: 'spell',
          actorId: 'mage-armor-source',
          actorName: 'Mage Armor Source',
          rulesId: 'mage-armor',
        },
        appliedAt: now,
        appliedRound: 1,
        duration: {
          type: 'rounds',
          remainingRounds: 4_800,
          tickOn: 'target-turn-end',
        },
        stackingKey: 'srd-5.1:spell:mage-armor',
        stackingPolicy: 'refresh-duration',
        visibility: 'public',
      }, ...([
        'jump',
        'darkvision',
        'see-invisibility',
        'warding-bond',
        'fly',
        'heroism',
        'enlarge-reduce',
        'enhance-ability',
        'divine-favor',
        'magic-weapon',
        'flame-blade',
        'invisibility',
        'blur',
        'barkskin',
        'protection-from-poison',
        'longstrider',
        'protection-from-energy',
        'death-ward',
        'greater-invisibility',
        'charm-person',
        'hideous-laughter',
        'hold-person',
        'blindness-deafness',
      ] as const)
        .map((spellId) => ({
          schemaVersion: 1 as const,
          id: `${spellId}-e2e-effect`,
          definitionId: `srd-5.1:spell:${spellId}`,
          label: spellId,
          kind: 'buff' as const,
          source: {
            kind: 'spell' as const,
            actorId: `${spellId}-source`,
            actorName: `${spellId} Source`,
            rulesId: spellId,
          },
          appliedAt: now,
          appliedRound: 1,
          duration: {
            type: 'rounds' as const,
            remainingRounds: 100,
            tickOn: 'target-turn-end' as const,
          },
          stackingKey: `srd-5.1:spell:${spellId}`,
          stackingPolicy: 'refresh-duration' as const,
          visibility: 'public' as const,
        }))],
    },
  }
  await request.delete(`${DM}/api/events/_all`)
  await putState(request, 'maps', {
    selectedId: mapId,
    updatedAt: now,
    maps: [{
      id: mapId,
      name: 'Persistent Spell Badges E2E',
      width: 760,
      height: 620,
      gridSize: 100,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [...sourceTokens, targetToken],
    }],
  })

  const context = await browser.newContext({ viewport: { width: 1_100, height: 900 } })
  const player = await context.newPage()
  await player.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' })
  await player.waitForURL(/\/campaign\/local\/maps$/)
  const canvas = player.getByTestId('map-canvas')
  await expect(canvas).toBeVisible()
  await expect(canvas).toHaveAttribute('data-spell-status-token-count', '28')

  await player.evaluate(async ({ activeMapId, kinds, targetTokenId }) => {
    const presentation = await import('/src/lib/combatPresentation.ts')
    await presentation.refreshCombatPresentationClock(true)
    const publish = {
      bless: presentation.publishBlessPresentation,
      bane: presentation.publishBanePresentation,
      'shield-of-faith': presentation.publishShieldOfFaithPresentation,
      'mage-armor': presentation.publishMageArmorPresentation,
      jump: presentation.publishJumpPresentation,
      darkvision: presentation.publishDarkvisionPresentation,
      'see-invisibility': presentation.publishSeeInvisibilityPresentation,
      'warding-bond': presentation.publishWardingBondPresentation,
      fly: presentation.publishFlyPresentation,
      heroism: presentation.publishHeroismPresentation,
      'enlarge-reduce': presentation.publishEnlargeReducePresentation,
      'enhance-ability': presentation.publishEnhanceAbilityPresentation,
      'divine-favor': presentation.publishDivineFavorPresentation,
      'hunters-mark': presentation.publishHuntersMarkPresentation,
      'magic-weapon': presentation.publishMagicWeaponPresentation,
      'flame-blade': presentation.publishFlameBladePresentation,
      invisibility: presentation.publishInvisibilityPresentation,
      blur: presentation.publishBlurPresentation,
      barkskin: presentation.publishBarkskinPresentation,
      'protection-from-poison': presentation.publishProtectionFromPoisonPresentation,
      longstrider: presentation.publishLongstriderPresentation,
      'protection-from-energy': presentation.publishProtectionFromEnergyPresentation,
      'death-ward': presentation.publishDeathWardPresentation,
      'greater-invisibility': presentation.publishGreaterInvisibilityPresentation,
      'charm-person': presentation.publishCharmPersonPresentation,
      'hideous-laughter': presentation.publishHideousLaughterPresentation,
      'hold-person': presentation.publishHoldPersonPresentation,
      'blindness-deafness': presentation.publishBlindnessDeafnessPresentation,
    }
    const stamp = Date.now()
    void Promise.all(kinds.map((kind, index) =>
      publish[kind]({
        id: `e2e-${kind}-${stamp}`,
        mapId: activeMapId,
        transactionId: `e2e-${kind}-tx-${stamp}`,
        sourceTokenId: `${kind}-source`,
        targetTokenId,
        accentColor: ['#22c55e', '#7c3aed', '#f59e0b', '#3b82f6', '#16a34a', '#1d4ed8', '#9333ea', '#dc2626', '#0891b2', '#ea580c', '#65a30d', '#c026d3', '#eab308', '#15803d', '#2563eb', '#f97316'][index],
        glowColor: ['#dcfce7', '#ede9fe', '#fef3c7', '#dbeafe', '#bbf7d0', '#bfdbfe', '#e9d5ff', '#fecaca', '#cffafe', '#ffedd5', '#ecfccb', '#fae8ff', '#fef9c3', '#dcfce7', '#dbeafe', '#ffedd5'][index],
      }),
    ))
  }, {
    activeMapId: mapId,
    kinds: manifestationKinds,
    targetTokenId: targetToken.id,
  })

  await expect.poll(async () => {
    const kinds = (await canvas.getAttribute('data-combat-projectile-kinds') ?? '')
      .split(',')
      .filter(Boolean)
    return manifestationKinds.every((kind) => kinds.includes(kind))
  }).toBe(true)
  await expect.poll(async () =>
    Number(await canvas.getAttribute('data-combat-projectile-count')),
  ).toBe(0)
  await expect(canvas).toHaveAttribute('data-spell-status-token-count', '28')
  await canvas.screenshot({
    path: process.env.PERSISTENT_SPELL_BADGES_SCREENSHOT_PATH ??
      testInfo.outputPath('persistent-spell-badges.png'),
  })
  await context.close()
})
