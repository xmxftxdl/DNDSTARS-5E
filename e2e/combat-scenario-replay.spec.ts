import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const E2E_PORT_BASE = Math.max(1_024, Number(process.env.STARS_E2E_PORT_BASE) || 6_173)
const DM = `http://127.0.0.1:${E2E_PORT_BASE}`
const PLAYER = `http://127.0.0.1:${E2E_PORT_BASE + 1}`

/**
 * A replay is intentionally data-first: stable coordinates, an eight-digit
 * seed, and the same player gestures used in a real two-client combat.
 */
const thunderwaveCliffReplay = {
  id: 'thunderwave-cliff',
  seed: 20240724,
  map: {
    width: 840,
    height: 560,
    gridSize: 70,
    feetPerCell: 5,
    plateauRightEdge: 420,
    plateauElevationFeet: 40,
  },
  caster: { x: 175, y: 175 },
  target: { x: 315, y: 175 },
  // Thunderwave permits choosing the caster's own cell; Headless resolves
  // that zero-vector selection with its documented default direction.
  areaTargetCell: { col: 2, row: 2 },
  expectedTarget: { x: 455, y: 175, elevationFeet: 0 },
} as const

async function putState(request: APIRequestContext, name: string, payload: unknown) {
  const response = await request.put(`${DM}/api/state/${name}`, { data: payload })
  expect(response.ok(), `${name}: ${response.status()}`).toBeTruthy()
}

async function getState<T>(request: APIRequestContext, name: string): Promise<T> {
  const response = await request.get(`${DM}/api/state/${name}`)
  expect(response.ok(), `${name}: ${response.status()}`).toBeTruthy()
  return response.json() as Promise<T>
}

async function getPageState<T>(page: Page, name: string): Promise<T> {
  return page.evaluate(async (resourceName) => {
    const response = await fetch(`/api/state/${resourceName}`)
    if (!response.ok) throw new Error(`GET ${resourceName} failed: ${response.status}`)
    return response.json()
  }, name) as Promise<T>
}

async function getClientMapToken(
  page: Page,
  mapId: string,
  tokenId: string,
): Promise<{ id: string; x: number; y: number; elevationFeet?: number; hp?: number } | null> {
  return page.evaluate(async ({ mapId: requestedMapId, tokenId: requestedTokenId }) => {
    const { useMapStore } = await import('/src/store/maps.ts')
    return useMapStore.getState().maps
      .find((map) => map.id === requestedMapId)
      ?.tokens.find((token) => token.id === requestedTokenId) ?? null
  }, { mapId, tokenId }) as Promise<{ id: string; x: number; y: number; elevationFeet?: number; hp?: number } | null>
}

async function installSeededRandom(page: Page, seed: number) {
  await page.evaluate((initialSeed) => {
    let state = initialSeed >>> 0
    Math.random = () => {
      state = (Math.imul(1_664_525, state) + 1_013_904_223) >>> 0
      return state / 4_294_967_296
    }
  }, seed)
}

async function submitReplayAction(page: Page, action: Record<string, unknown>) {
  await page.evaluate(async ({ payload, dmBase }) => {
    const headers = {
      'Content-Type': 'application/json',
      'X-Stars-Protocol': '5',
      'X-Stars-Writer': 'combat-scenario-replay',
    }
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const queueResponse = await fetch(`${dmBase}/api/state/player-action-requests`)
      const queue = queueResponse.ok
        ? await queueResponse.json() as { requests?: Record<string, unknown>[]; _sync?: { revision?: number } }
        : { requests: [] }
      const revision = Number(queueResponse.headers.get('X-Stars-State-Revision') ?? queue._sync?.revision ?? 0)
      const response = await fetch(`${dmBase}/api/state/player-action-requests`, {
        method: 'PUT',
        headers: { ...headers, 'X-Stars-Expected-Revision': String(Number.isInteger(revision) ? revision : 0) },
        body: JSON.stringify({
          mapId: payload.mapId,
          combatId: payload.combatId,
          requests: [...(queue.requests ?? []), payload],
          updatedAt: Date.now(),
        }),
      })
      if (response.ok) break
      if (response.status !== 409 || attempt === 4) throw new Error(`action queue failed: ${response.status}`)
    }
    const eventResponse = await fetch(`${dmBase}/api/events/player-action-player-to-dm`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
    if (!eventResponse.ok) throw new Error(`action event failed: ${eventResponse.status}`)
  }, { payload: action, dmBase: DM })
}

test('replays Thunderwave through the player action protocol and synchronizes a cliff fall', async ({
  browser,
  request,
}) => {
  test.setTimeout(90_000)
  const replay = thunderwaveCliffReplay
  const now = Date.now()
  const mapId = `${replay.id}-${now}`
  const combatId = `${mapId}:combat`
  const wizard = {
    id: `${mapId}:wizard`,
    rulesetId: 'dnd5e-2014-srd-5.1',
    dnd5eClassId: 'wizard',
    dnd5eClassLevels: { wizard: 5 },
    dnd5eClassChoices: {
      classes: { wizard: { selections: { 'spell-prepared': ['thunderwave'] } } },
    },
    classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 4 } },
    name: 'Replay Wizard',
    player: 'Replay Player',
    avatar: 'W',
    accent: 'from-violet-500 to-sky-500',
    race: 'Human',
    charClass: 'Wizard',
    level: 5,
    background: '',
    experience: 0,
    reputation: 0,
    // A DC 21 replay fixture makes the cliff-push branch deterministic; D&D
    // saving throws do not automatically succeed on a natural 20.
    abilities: { str: 8, dex: 14, con: 14, int: 30, wis: 12, cha: 10 },
    savingThrows: ['int', 'wis'],
    skills: [],
    maxHp: 32,
    currentHp: 32,
    tempHp: 0,
    hitDice: '5d6',
    ac: 13,
    speed: 30,
    initiativeBonus: 2,
    saveDC: 21,
    passivePerception: 11,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    equipment: {},
  }
  const wizardToken = {
    id: `${mapId}:wizard-token`,
    label: wizard.name,
    ...replay.caster,
    elevationFeet: replay.map.plateauElevationFeet,
    color: '#8b5cf6',
    emoji: 'W',
    size: 1,
    type: 'player',
    characterId: wizard.id,
  }
  const targetToken = {
    id: `${mapId}:target-token`,
    label: 'Cliff Target',
    ...replay.target,
    elevationFeet: replay.map.plateauElevationFeet,
    color: '#ef4444',
    emoji: 'T',
    size: 1,
    type: 'enemy',
    hp: 50,
    maxHp: 50,
  }

  await request.delete(`${DM}/api/events/_all`)
  await putState(request, 'characters', { characters: [wizard], selectedId: wizard.id, updatedAt: now })
  await putState(request, 'maps', {
    selectedId: mapId,
    updatedAt: now,
    maps: [{
      id: mapId,
      name: 'Thunderwave Cliff Replay',
      width: replay.map.width,
      height: replay.map.height,
      gridSize: replay.map.gridSize,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: replay.map.feetPerCell,
      tokens: [wizardToken, targetToken],
    }],
  })
  await putState(request, 'map-geometry', {
    schemaVersion: 2,
    updatedAt: now,
    maps: [{
      mapId,
      walls: [],
      doors: [],
      windows: [],
      lights: [],
      obstacles: [{
        id: `${mapId}:plateau`,
        kind: 'obstacle',
        label: '40 ft plateau',
        cover: 'none',
        points: [
          { x: 0, y: 0 },
          { x: replay.map.plateauRightEdge, y: 0 },
          { x: replay.map.plateauRightEdge, y: replay.map.height },
          { x: 0, y: replay.map.height },
        ],
        baseHeightFeet: 0,
        heightFeet: 0,
        terrainElevationFeet: replay.map.plateauElevationFeet,
        terrainRegion: true,
        blocksVision: false,
        blocksMovement: false,
        blocksLineOfEffect: false,
        createdAt: now,
      }],
      vision: { enabled: false, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' },
      updatedAt: now,
    }],
  })
  await putState(request, 'combat-log', { mapId, entries: [], updatedAt: now })
  await putState(request, 'dice-events', { mapId, events: [], updatedAt: now })
  await putState(request, 'combat-interrupts', { mapId, interrupts: [], updatedAt: now, revision: 0 })
  await putState(request, 'player-action-requests', { mapId, combatId, requests: [], updatedAt: now })
  await putState(request, 'player-action-processed', { mapId, combatId, actionIds: [], updatedAt: now })
  await putState(request, 'player-action-ack', {
    id: `${mapId}:none`, mapId, combatId, actionId: 'none', status: 'accepted', round: 1, initiativeIndex: 0, updatedAt: now,
  })
  await putState(request, 'combat', {
    mapId,
    combatId,
    active: true,
    round: 1,
    initiativeIndex: 0,
    settlementMode: 'automatic',
    initiativeOrder: [
      { tokenId: wizardToken.id, label: wizardToken.label, emoji: wizardToken.emoji, color: wizardToken.color, roll: 20 },
      { tokenId: targetToken.id, label: targetToken.label, emoji: targetToken.emoji, color: targetToken.color, roll: 10 },
    ],
    updatedAt: now,
  })

  const context = await browser.newContext()
  const dm = await context.newPage()
  const player = await context.newPage()
  try {
    await Promise.all([
      dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' }),
      player.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' }),
    ])
    await Promise.all([
      expect(dm.getByTestId(`initiative-token-${wizardToken.id}`)).toBeVisible({ timeout: 20_000 }),
      expect(player.getByTestId(`initiative-token-${wizardToken.id}`)).toBeVisible({ timeout: 20_000 }),
      expect(dm.getByTestId('map-canvas')).toBeVisible({ timeout: 20_000 }),
      expect(player.getByTestId('map-canvas')).toBeVisible({ timeout: 20_000 }),
      expect(player.getByTestId('player-combat-hotbar')).toBeVisible({ timeout: 20_000 }),
    ])
    await expect(dm.getByTestId('map-canvas')).toHaveAttribute('data-vision-enabled', 'false', { timeout: 20_000 })

    await installSeededRandom(dm, replay.seed)
    const transparentCanvasBaseline = await player.getByTestId('map-canvas').locator('canvas').evaluateAll(
      (canvases) => canvases.map((canvas) => {
        const context = (canvas as HTMLCanvasElement).getContext('2d')
        if (!context) return 0
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
        let visible = 0
        for (let index = 3; index < pixels.length; index += 16) {
          if (pixels[index] > 8) visible += 1
        }
        return visible
      }),
    )
    const actionId = `${mapId}:thunderwave:${replay.seed}`
    await submitReplayAction(player, {
      id: actionId,
      mapId,
      combatId,
      sourceMode: 'player',
      status: 'pending',
      type: 'dnd5e-spell-cast',
      actorTokenId: wizardToken.id,
      characterId: wizard.id,
      targetTokenId: targetToken.id,
      targetTokenIds: [targetToken.id],
      targetCell: replay.areaTargetCell,
      dnd5eSpellCast: {
        spellId: 'thunderwave',
        castingClassId: 'wizard',
        slotLevel: 1,
        targetTokenId: targetToken.id,
        targetTokenIds: [targetToken.id],
        areaTargetCell: replay.areaTargetCell,
      },
      round: 1,
      initiativeIndex: 0,
      seq: 1,
      updatedAt: Date.now(),
    })

    await Promise.all([
      expect.poll(async () => {
        const current = await player.getByTestId('map-canvas').locator('canvas').evaluateAll(
          (canvases) => canvases.map((canvas) => {
            const context = (canvas as HTMLCanvasElement).getContext('2d')
            if (!context) return 0
            const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
            let visible = 0
            for (let index = 3; index < pixels.length; index += 16) {
              if (pixels[index] > 8) visible += 1
            }
            return visible
          }),
        )
        return current.some((visible, index) =>
          transparentCanvasBaseline[index] === 0 && visible > 100)
      }).toBe(true),
      expect(dm.locator('[data-combat-banner="spell"]')).toBeVisible({ timeout: 20_000 }),
      expect(player.locator('[data-combat-banner="spell"]')).toBeVisible({ timeout: 20_000 }),
      expect.poll(async () =>
        (await dm.getByTestId('map-canvas').getAttribute('data-combat-projectile-kinds') ?? '')
          .split(',')
          .includes('thunderwave'),
      ).toBe(true),
      expect.poll(async () =>
        (await player.getByTestId('map-canvas').getAttribute('data-combat-projectile-kinds') ?? '')
          .split(',')
          .includes('thunderwave'),
      ).toBe(true),
    ])
    if (process.env.THUNDERWAVE_VFX_SCREENSHOT_PATH) {
      await player.getByTestId('map-canvas').screenshot({
        path: process.env.THUNDERWAVE_VFX_SCREENSHOT_PATH,
      })
    }
    await expect.poll(async () => {
      const ack = await getState<{ actionId?: string; status?: string; reason?: string }>(request, 'player-action-ack')
      return ack.actionId === actionId ? `${ack.status}:${ack.reason ?? ''}` : ''
    }, { timeout: 30_000 }).toBe('accepted:')

    await expect.poll(async () => {
      const state = await getState<{ maps: Array<{ id: string; tokens: Array<{ id: string; x: number; y: number; elevationFeet?: number; hp?: number }> }> }>(request, 'maps')
      return state.maps.find((map) => map.id === mapId)?.tokens.find((token) => token.id === targetToken.id)
    }, { timeout: 30_000 }).toMatchObject({
      ...replay.expectedTarget,
      hp: expect.any(Number),
    })

    const dmMaps = await getState<{ maps: Array<{ id: string; tokens: Array<{ id: string; x: number; y: number; elevationFeet?: number; hp?: number }> }> }>(request, 'maps')
    const playerMaps = await getPageState<typeof dmMaps>(player, 'maps')
    const dmTarget = dmMaps.maps.find((map) => map.id === mapId)?.tokens.find((token) => token.id === targetToken.id)
    const playerTarget = playerMaps.maps.find((map) => map.id === mapId)?.tokens.find((token) => token.id === targetToken.id)
    await expect.poll(
      () => getClientMapToken(player, mapId, targetToken.id),
      { timeout: 20_000 },
    ).toMatchObject(replay.expectedTarget)
    const playerClientTarget = await getClientMapToken(player, mapId, targetToken.id)
    expect(dmTarget).toMatchObject(replay.expectedTarget)
    expect(playerTarget).toEqual(dmTarget)
    expect(playerClientTarget).toMatchObject(dmTarget!)
    expect(dmTarget?.hp).toBeLessThan(targetToken.hp)

    const log = await getState<{ entries: Array<{ details?: string[] }> }>(request, 'combat-log')
    expect(log.entries.at(-1)?.details?.some((detail) => detail.includes('坠落'))).toBe(true)
  } finally {
    await context.close()
  }
})
