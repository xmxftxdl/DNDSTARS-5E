import { expect, test } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'
const PLAYER = 'http://127.0.0.1:6174'
const SESSION_KEY = 'stars-room-session:v1'

test('dynamic vision cuts through filled static fog after combat setup', async ({ browser, request }) => {
  const createdResponse = await request.post(`${DM}/api/rooms`, {
    data: {
      roomName: 'Player vision regression', displayName: 'Vision DM',
      rulesetId: 'dnd5e-2014-srd-5.1', clientId: `vision-dm-${Date.now()}`, activePlugins: [],
    },
  })
  expect(createdResponse.status()).toBe(201)
  const created = await createdResponse.json() as {
    roomId: string; roomName: string; rulesetId: string; createdAt: number
    member: { memberId: string; clientId: string; role: 'dm'; displayName: string }
  }
  const joinedResponse = await request.post(`${PLAYER}/api/rooms/${created.roomId}/join`, {
    data: { displayName: 'Vision Player', clientId: `vision-player-${Date.now()}`, activePlugins: [] },
  })
  expect(joinedResponse.ok()).toBeTruthy()
  const joined = await joinedResponse.json() as {
    roomId: string; roomName: string; rulesetId: string; createdAt: number
    member: { memberId: string; clientId: string; role: 'player'; slot: 'player1'; displayName: string }
  }
  const now = Date.now()
  const dmHeaders = { 'Content-Type': 'application/json', 'X-Stars-Member': created.member.memberId }
  const stateUrl = (name: string) => `${DM}/api/state/${name}?room=${created.roomId}`
  const put = async (name: string, data: unknown) => {
    const response = await request.put(stateUrl(name), { headers: dmHeaders, data })
    expect(response.ok(), `${name} should save`).toBeTruthy()
  }
  await put('maps', {
    selectedId: 'vision-map', updatedAt: now,
    maps: [{
      id: 'vision-map', name: '视野测试地图', width: 400, height: 400,
      gridSize: 40, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [{
        id: 'vision-hero', label: '视野角色', type: 'player', characterId: 'vision-character',
        x: 200, y: 200, size: 1, color: '#34d399', emoji: '勇', hp: 10, maxHp: 10,
      }],
    }],
  })
  await put('map-geometry', {
    schemaVersion: 2, updatedAt: now,
    maps: [{
      mapId: 'vision-map', walls: [], doors: [], windows: [], obstacles: [], lights: [],
      vision: { enabled: true, defaultRangeFeet: 20, sharePartyVision: false, ambientLight: 'bright' },
      updatedAt: now,
    }],
  })
  await put('map-fog', {
    schemaVersion: 1, updatedAt: now,
    maps: [{ mapId: 'vision-map', filled: true, color: '#05070f', opacity: 0.98, shapes: [], updatedAt: now }],
  })

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
  await expect(canvas).toHaveAttribute('data-vision-enabled', 'true')
  await expect(canvas).toHaveAttribute('data-fog-filled', 'true')
  await expect(canvas).toHaveAttribute('data-vision-source-count', '1')

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
  })).toBeGreaterThan(100)
  await context.close()
})
