import { expect, test } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'
const PLAYER = 'http://127.0.0.1:6174'
const SESSION_KEY = 'stars-room-session:v1'

test('DM 收起几何工具后石墙仍显示，并实时同步到玩家端', async ({ browser, request }) => {
  const createdResponse = await request.post(`${DM}/api/rooms`, {
    data: {
      roomName: 'Geometry toolbar persistence',
      displayName: 'Geometry DM',
      rulesetId: 'dnd5e-2014-srd-5.1',
      clientId: `geometry-toolbar-dm-${Date.now()}`,
      activePlugins: [],
    },
  })
  expect(createdResponse.status()).toBe(201)
  const created = await createdResponse.json() as {
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
  const joinedResponse = await request.post(`${PLAYER}/api/rooms/${created.roomId}/join`, {
    data: {
      displayName: 'Geometry Player',
      clientId: `geometry-toolbar-player-${Date.now()}`,
      activePlugins: [],
    },
  })
  expect(joinedResponse.ok()).toBeTruthy()
  const joined = await joinedResponse.json() as {
    roomId: string
    roomName: string
    rulesetId: string
    createdAt: number
    member: {
      memberId: string
      roomToken: string
      clientId: string
      role: 'player'
      slot: 'player1'
      displayName: string
    }
  }
  const now = Date.now()
  const headers = {
    'Content-Type': 'application/json',
    'X-Stars-Protocol': '5',
    'X-Stars-Expected-Revision': '0',
    'X-Stars-Member': created.member.memberId,
    'X-Stars-Room-Token': created.member.roomToken,
  }
  const save = async (resource: string, data: unknown) => {
    const response = await request.put(
      `${DM}/api/state/${resource}?room=${created.roomId}`,
      { headers, data },
    )
    expect(response.ok(), `${resource} should save`).toBeTruthy()
  }
  await save('maps', {
    selectedId: 'geometry-toolbar-map',
    updatedAt: now,
    maps: [{
      id: 'geometry-toolbar-map',
      name: '石墙显示回归地图',
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
  await save('map-geometry', {
    schemaVersion: 3,
    updatedAt: now,
    maps: [{
      mapId: 'geometry-toolbar-map',
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
      updatedAt: now,
    }],
  })

  const addSession = async (
    context: Awaited<ReturnType<typeof browser.newContext>>,
    room: typeof created | typeof joined,
  ) => context.addInitScript(([key, membership]) => {
    localStorage.setItem(key, JSON.stringify({
      roomId: membership.roomId,
      roomName: membership.roomName,
      rulesetId: membership.rulesetId,
      createdAt: membership.createdAt,
      ...membership.member,
    }))
  }, [SESSION_KEY, room] as const)
  const dmContext = await browser.newContext()
  const playerContext = await browser.newContext()
  await addSession(dmContext, created)
  await addSession(playerContext, joined)
  const page = await dmContext.newPage()
  const playerPage = await playerContext.newPage()
  await Promise.all([
    page.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' }),
    playerPage.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' }),
  ])

  const canvas = page.getByTestId('map-canvas')
  const playerCanvas = playerPage.getByTestId('map-canvas')
  await expect(canvas).toHaveAttribute('data-geometry-tool', 'off')
  await expect(canvas).toHaveAttribute('data-geometry-overlay-visible', 'true')
  await expect(canvas).toHaveAttribute('data-dm-geometry-wall-count', '0')
  await expect(playerCanvas).toHaveAttribute('data-geometry-overlay-visible', 'true')
  await expect(playerCanvas).toHaveAttribute('data-geometry-structure-count', '0')

  const geometryButton = page.getByRole('button', { name: '几何', exact: true })
  await geometryButton.click()
  await page.getByLabel('地图几何工具').selectOption('wall')
  await page.getByLabel('墙体材质').selectOption('stone')
  await expect(canvas).toHaveAttribute('data-geometry-tool', 'wall')

  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.move(box!.x + box!.width * 0.35, box!.y + box!.height * 0.55)
  await page.mouse.down()
  await page.mouse.move(
    box!.x + box!.width * 0.62,
    box!.y + box!.height * 0.55,
    { steps: 8 },
  )
  await page.mouse.up()
  await expect(canvas).toHaveAttribute('data-dm-geometry-wall-count', '1')
  await expect(playerCanvas).toHaveAttribute('data-geometry-structure-count', '1')
  await expect.poll(() => playerPage.evaluate(async () => {
    const { useMapGeometryStore } = await import('/src/store/mapGeometry.ts')
    const wall = useMapGeometryStore.getState().maps
      .find((map) => map.mapId === 'geometry-toolbar-map')?.walls[0]
    return wall ? { kind: wall.kind, material: wall.material } : null
  })).toEqual({ kind: 'wall', material: 'stone' })

  await geometryButton.click()
  await expect(canvas).toHaveAttribute('data-geometry-tool', 'off')
  await expect(canvas).toHaveAttribute('data-geometry-overlay-visible', 'true')
  await expect(canvas).toHaveAttribute('data-dm-geometry-wall-count', '1')
  await expect(playerCanvas).toHaveAttribute('data-geometry-structure-count', '1')

  await expect.poll(async () => {
    const response = await request.get(
      `${DM}/api/state/map-geometry?room=${created.roomId}`,
      {
        headers: {
          'X-Stars-Protocol': '5',
          'X-Stars-Member': created.member.memberId,
          'X-Stars-Room-Token': created.member.roomToken,
        },
      },
    )
    if (!response.ok()) return -1
    const state = await response.json() as {
      maps?: Array<{ mapId?: string; walls?: unknown[] }>
    }
    return state.maps?.find((map) => map.mapId === 'geometry-toolbar-map')?.walls?.length ?? -1
  }).toBe(1)

  await dmContext.close()
  await playerContext.close()
})
