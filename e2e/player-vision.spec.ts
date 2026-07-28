import { expect, test } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'
const PLAYER = 'http://127.0.0.1:6174'
const SESSION_KEY = 'stars-room-session:v1'

test('a player token cuts a 30-foot view through filled fog without a separate vision toggle', async ({ browser, request }) => {
  const createdResponse = await request.post(`${DM}/api/rooms`, {
    data: {
      roomName: 'Player vision regression', displayName: 'Vision DM',
      rulesetId: 'dnd5e-2014-srd-5.1', clientId: `vision-dm-${Date.now()}`, activePlugins: [],
    },
  })
  expect(createdResponse.status()).toBe(201)
  const created = await createdResponse.json() as {
    roomId: string; roomName: string; rulesetId: string; createdAt: number
    member: { memberId: string; roomToken: string; clientId: string; role: 'dm'; displayName: string }
  }
  const joinedResponse = await request.post(`${PLAYER}/api/rooms/${created.roomId}/join`, {
    data: { displayName: 'Vision Player', clientId: `vision-player-${Date.now()}`, activePlugins: [] },
  })
  expect(joinedResponse.ok()).toBeTruthy()
  const joined = await joinedResponse.json() as {
    roomId: string; roomName: string; rulesetId: string; createdAt: number
    member: { memberId: string; roomToken: string; clientId: string; role: 'player'; slot: 'player1'; displayName: string }
  }
  const heartbeat = await request.post(`${DM}/api/rooms/${created.roomId}/heartbeat`, {
    headers: {
      'X-Stars-Member': joined.member.memberId,
      'X-Stars-Room-Token': joined.member.roomToken,
    },
    data: {
      memberId: joined.member.memberId,
      activePlugins: [],
      activeCharacterId: 'vision-character',
      activeCharacterName: '视野角色',
    },
  })
  expect(heartbeat.ok()).toBeTruthy()
  const now = Date.now()
  const dmHeaders = {
    'Content-Type': 'application/json',
    'X-Stars-Protocol': '5',
    'X-Stars-Expected-Revision': '0',
    'X-Stars-Member': created.member.memberId,
    'X-Stars-Room-Token': created.member.roomToken,
  }
  const stateUrl = (name: string) => `${DM}/api/state/${name}?room=${created.roomId}`
  const put = async (name: string, data: unknown) => {
    const response = await request.put(stateUrl(name), { headers: dmHeaders, data })
    expect(response.ok(), `${name} should save`).toBeTruthy()
  }
  await put('characters', {
    selectedId: 'vision-character',
    updatedAt: now,
    characters: [{
      id: 'vision-character',
      roomMemberId: joined.member.memberId,
      name: '视野角色',
      player: 'Vision Player',
      avatar: '👁️',
      accent: 'from-emerald-500 to-cyan-500',
      race: '人类',
      charClass: '战士',
      level: 1,
      experience: 0,
      reputation: 0,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      savingThrows: [],
      skills: [],
      maxHp: 10,
      currentHp: 10,
      tempHp: 0,
      hitDice: '1d10',
      ac: 10,
      speed: 30,
      initiativeBonus: 0,
      saveDC: 10,
      passivePerception: 10,
      inspiration: 0,
      conditions: [],
      notes: '',
      dmNotes: '',
      visibleToPlayers: true,
    }],
  })
  await put('maps', {
    selectedId: 'vision-map', updatedAt: now,
    maps: [{
      id: 'vision-map', name: '视野测试地图', width: 800, height: 800,
      gridSize: 40, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [{
        id: 'vision-hero', label: '视野角色', type: 'player', characterId: 'vision-character',
        x: 400, y: 400, size: 1, color: '#34d399', emoji: '勇', hp: 10, maxHp: 10,
      }, {
        id: 'vision-other-player', label: '另一名玩家', type: 'player', characterId: 'other-character',
        x: 80, y: 80, size: 1, color: '#34d399', emoji: '友', hp: 10, maxHp: 10,
      }, {
        id: 'vision-hidden-enemy', label: '远处敌人', type: 'enemy',
        x: 720, y: 400, size: 1, color: '#ef4444', emoji: '敌', hp: 10, maxHp: 10,
      }],
    }],
  })
  await put('map-geometry', {
    schemaVersion: 2, updatedAt: now,
    maps: [{
      mapId: 'vision-map', walls: [], doors: [], windows: [], obstacles: [], lights: [],
      vision: { enabled: false, defaultRangeFeet: 30, sharePartyVision: false, ambientLight: 'bright' },
      updatedAt: now,
    }],
  })
  await put('map-fog', {
    schemaVersion: 1, updatedAt: now,
    maps: [{
      mapId: 'vision-map', filled: true, color: '#05070f', opacity: 0.98,
      shapes: [{
        id: 'cover-current-view', operation: 'cover', kind: 'rect',
        x: 0, y: 0, width: 800, height: 800, createdAt: now,
      }],
      updatedAt: now,
    }],
  })

  const projectedMaps = await request.get(`${PLAYER}/api/state/maps?room=${created.roomId}`, {
    headers: { 'X-Stars-Member': joined.member.memberId, 'X-Stars-Room-Token': joined.member.roomToken },
  })
  expect(projectedMaps.ok()).toBeTruthy()
  const projectedBody = await projectedMaps.json() as {
    maps: Array<{ tokens: Array<{ id: string; viewerControlled?: boolean }> }>
  }
  expect(projectedBody.maps[0].tokens.map((token) => token.id)).toContain('vision-hero')
  expect(projectedBody.maps[0].tokens.find((token) => token.id === 'vision-hero')?.viewerControlled).toBe(true)
  expect(projectedBody.maps[0].tokens.find((token) => token.id === 'vision-other-player')?.viewerControlled).toBe(false)
  expect(projectedBody.maps[0].tokens.map((token) => token.id)).not.toContain('vision-hidden-enemy')

  const context = await browser.newContext()
  await context.addInitScript(([key, response]) => {
    localStorage.setItem(key, JSON.stringify({
      roomId: response.roomId,
      roomName: response.roomName,
      rulesetId: response.rulesetId,
      createdAt: response.createdAt,
      ...response.member,
    }))
  }, [SESSION_KEY, joined] as const)
  const page = await context.newPage()
  await page.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' })
  const canvas = page.getByTestId('map-canvas')
  await expect.poll(() => page.evaluate(async () => {
    const { useMapStore } = await import('/src/store/maps.ts')
    return useMapStore.getState().maps
      .flatMap((map) => map.tokens)
      .find((token) => token.id === 'vision-hero')
      ?.viewerControlled
  }), { timeout: 20_000 }).toBe(true)
  await expect(canvas).toHaveAttribute('data-vision-enabled', 'false')
  await expect(canvas).toHaveAttribute('data-fog-filled', 'true')
  await expect(canvas).toHaveAttribute('data-vision-source-count', '1')

  // The map snapshot can legitimately arrive before its binary image (for
  // example while the DM restores a cached map into a new room). The player
  // canvas must recover without a page reload when that image appears later.
  await expect(canvas).toHaveAttribute('data-map-image-state', 'missing')
  const mapImage = Buffer.from([
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">',
    '<rect width="800" height="800" fill="#7e22ce"/>',
    '</svg>',
  ].join(''))
  const imageResponse = await request.put(`${DM}/api/images/vision-map?room=${created.roomId}`, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'X-Stars-Protocol': '5',
      'X-Stars-Member': created.member.memberId,
      'X-Stars-Room-Token': created.member.roomToken,
    },
    data: mapImage,
  })
  expect(imageResponse.ok()).toBeTruthy()
  await expect(canvas).toHaveAttribute('data-map-image-state', 'loaded', { timeout: 10_000 })

  await expect.poll(async () => canvas.evaluate((element) => {
    const layers = [...element.querySelectorAll('canvas')]
    if (layers.length === 0 || layers[0].width === 0 || layers[0].height === 0) return 0
    const composed = document.createElement('canvas')
    composed.width = layers[0].width
    composed.height = layers[0].height
    const context2d = composed.getContext('2d')!
    for (const layer of layers) context2d.drawImage(layer, 0, 0)
    const pixels = context2d.getImageData(0, 0, composed.width, composed.height).data
    let visiblePixels = 0
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] + pixels[index + 1] + pixels[index + 2] > 180) visiblePixels += 1
    }
    return visiblePixels
  }), { timeout: 20_000 }).toBeGreaterThan(100)
  await expect.poll(async () => canvas.evaluate((element) => {
    return [...element.querySelectorAll('canvas')].some((layer) => {
      if (layer.width < 700 || layer.height < 500) return false
      const context2d = layer.getContext('2d')
      if (!context2d) return false
      let hasTransparentVision = false
      let hasOpaqueFog = false
      for (let y = 20; y < layer.height; y += 40) {
        for (let x = 20; x < layer.width; x += 40) {
          const alpha = context2d.getImageData(x, y, 1, 1).data[3]
          hasTransparentVision ||= alpha < 32
          hasOpaqueFog ||= alpha > 192
        }
      }
      return hasTransparentVision && hasOpaqueFog
    })
  }), { timeout: 20_000 }).toBe(true)
  await context.close()
})
