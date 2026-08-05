import { expect, test, type APIRequestContext, type BrowserContext } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'
const SESSION_KEY = 'stars-room-session:v1'

interface DmRoomMembership {
  roomId: string
  roomName: string
  rulesetId: string
  createdAt: number
  member: {
    memberId: string
    roomToken: string
    clientId: string
    role: 'dm'
    displayName: string
  }
}

async function saveRoomState(
  request: APIRequestContext,
  room: DmRoomMembership,
  resource: string,
  data: unknown,
) {
  const response = await request.put(`${DM}/api/state/${resource}?room=${room.roomId}`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Stars-Protocol': '5',
      'X-Stars-Expected-Revision': '0',
      'X-Stars-Member': room.member.memberId,
      'X-Stars-Room-Token': room.member.roomToken,
    },
    data,
  })
  expect(response.ok(), `${resource} should save`).toBeTruthy()
}

async function addRoomSession(context: BrowserContext, room: DmRoomMembership) {
  await context.addInitScript(([key, membership]) => {
    localStorage.setItem(key, JSON.stringify({
      roomId: membership.roomId,
      roomName: membership.roomName,
      rulesetId: membership.rulesetId,
      createdAt: membership.createdAt,
      ...membership.member,
    }))
  }, [SESSION_KEY, room] as const)
}

test('双击 Ping 在普通模式和几何编辑模式都可用，且不会误画高度格', async ({ browser, request }) => {
  const nonce = Date.now()
  const createdResponse = await request.post(`${DM}/api/rooms`, {
    data: {
      roomName: `Map ping regression ${nonce}`,
      displayName: 'Ping DM',
      rulesetId: 'dnd5e-2014-srd-5.1',
      clientId: `ping-dm-${nonce}`,
      activePlugins: [],
    },
  })
  expect(createdResponse.status()).toBe(201)
  const room = await createdResponse.json() as DmRoomMembership
  const mapId = `map-ping-${nonce}`
  const now = Date.now()

  await saveRoomState(request, room, 'maps', {
    selectedId: mapId,
    updatedAt: now,
    maps: [{
      id: mapId,
      name: 'Ping regression map',
      width: 800,
      height: 600,
      gridSize: 40,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [],
    }],
  })
  await saveRoomState(request, room, 'map-geometry', {
    schemaVersion: 3,
    updatedAt: now,
    maps: [{
      mapId,
      walls: [],
      doors: [],
      windows: [],
      obstacles: [],
      lights: [],
      vision: {
        enabled: false,
        defaultRangeFeet: 30,
        sharePartyVision: true,
        ambientLight: 'bright',
      },
      environment: 'normal',
      updatedAt: now,
    }],
  })

  const context = await browser.newContext()
  await addRoomSession(context, room)
  const page = await context.newPage()
  await page.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' })
  const canvas = page.getByTestId('map-canvas')
  await expect(canvas).toHaveAttribute('data-ping-enabled', 'true', { timeout: 15_000 })

  const ordinaryPing = page.waitForRequest((outgoing) =>
    outgoing.method() === 'POST' && outgoing.url().includes('/api/events/map-tabletop'),
  )
  await canvas.dblclick({ position: { x: 260, y: 220 } })
  expect((await ordinaryPing).postDataJSON()).toMatchObject({ type: 'ping', mapId })

  await page.getByRole('button', { name: '几何', exact: true }).click()
  await page.getByLabel('地图几何工具').selectOption('elevation')
  await expect(canvas).toHaveAttribute('data-ping-enabled', 'true')
  const geometryPing = page.waitForRequest((outgoing) =>
    outgoing.method() === 'POST' && outgoing.url().includes('/api/events/map-tabletop'),
  )
  await canvas.dblclick({ position: { x: 340, y: 260 } })
  expect((await geometryPing).postDataJSON()).toMatchObject({ type: 'ping', mapId })

  await page.waitForTimeout(450)
  expect(await page.evaluate(async (activeMapId) => {
    const { useMapGeometryStore } = await import('/src/store/mapGeometry.ts')
    return useMapGeometryStore.getState().maps
      .find((entry) => entry.mapId === activeMapId)?.obstacles.length ?? -1
  }, mapId)).toBe(0)

  await context.close()
})
