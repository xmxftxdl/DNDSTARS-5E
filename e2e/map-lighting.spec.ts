import { expect, test } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'
const PLAYER = 'http://127.0.0.1:6174'
const SESSION_KEY = 'stars-room-session:v1'

test('DM ambient lighting and a clicked scene-light center synchronize to the player map', async ({ browser, request }) => {
  const createdResponse = await request.post(`${DM}/api/rooms`, {
    data: {
      roomName: 'Map lighting presentation',
      displayName: 'Lighting DM',
      rulesetId: 'dnd5e-2014-srd-5.1',
      clientId: `lighting-dm-${Date.now()}`,
      activePlugins: [],
    },
  })
  expect(createdResponse.status()).toBe(201)
  const created = await createdResponse.json() as {
    roomId: string; roomName: string; rulesetId: string; createdAt: number
    member: { memberId: string; roomToken: string; clientId: string; role: 'dm'; displayName: string }
  }
  const joinedResponse = await request.post(`${PLAYER}/api/rooms/${created.roomId}/join`, {
    data: {
      displayName: 'Lighting Player',
      clientId: `lighting-player-${Date.now()}`,
      activePlugins: [],
    },
  })
  expect(joinedResponse.ok()).toBeTruthy()
  const joined = await joinedResponse.json() as {
    roomId: string; roomName: string; rulesetId: string; createdAt: number
    member: { memberId: string; roomToken: string; clientId: string; role: 'player'; slot: 'player1'; displayName: string }
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
    const response = await request.put(`${DM}/api/state/${resource}?room=${created.roomId}`, { headers, data })
    expect(response.ok(), `${resource} should save`).toBeTruthy()
  }
  await save('maps', {
    selectedId: 'lighting-map',
    updatedAt: now,
    maps: [{
      id: 'lighting-map',
      name: '光照测试地图',
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
    schemaVersion: 2,
    updatedAt: now,
    maps: [{
      mapId: 'lighting-map',
      walls: [],
      doors: [],
      windows: [],
      obstacles: [{
        id: 'raised-ground',
        kind: 'obstacle',
        label: 'Raised ground',
        points: [{ x: 0, y: 0 }, { x: 800, y: 0 }, { x: 800, y: 600 }, { x: 0, y: 600 }],
        blocksVision: false,
        blocksMovement: false,
        blocksLineOfEffect: false,
        cover: 'none',
        baseHeightFeet: 0,
        heightFeet: 0,
        terrainRegion: true,
        terrainElevationFeet: 20,
        createdAt: now,
      }],
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

  const addSession = async (context: Awaited<ReturnType<typeof browser.newContext>>, response: typeof created | typeof joined) => {
    await context.addInitScript(([key, session]) => {
      localStorage.setItem(key, JSON.stringify({
        roomId: session.roomId,
        roomName: session.roomName,
        rulesetId: session.rulesetId,
        createdAt: session.createdAt,
        ...session.member,
      }))
    }, [SESSION_KEY, response] as const)
  }
  const dmContext = await browser.newContext()
  const playerContext = await browser.newContext()
  await addSession(dmContext, created)
  await addSession(playerContext, joined)
  const dmPage = await dmContext.newPage()
  const playerPage = await playerContext.newPage()
  await Promise.all([
    dmPage.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' }),
    playerPage.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' }),
  ])

  const dmCanvas = dmPage.getByTestId('map-canvas')
  const playerCanvas = playerPage.getByTestId('map-canvas')
  await expect(dmCanvas).toHaveAttribute('data-ambient-light', 'bright')
  await expect(playerCanvas).toHaveAttribute('data-ambient-light', 'bright')

  await dmPage.getByRole('button', { name: '几何' }).click()
  await dmPage.getByLabel('场景环境光照').selectOption('darkness')
  await expect(dmCanvas).toHaveAttribute('data-ambient-light', 'darkness')
  await expect(playerCanvas).toHaveAttribute('data-ambient-light', 'darkness')

  const geometryTool = dmPage.getByTitle('按住并拖动绘制；门窗工具下从空白地图拖动仍可平移视角')
  await expect(geometryTool.locator('option[value="select"]')).toHaveCount(0)
  await geometryTool.selectOption('door')
  await expect(dmCanvas).toHaveAttribute('data-geometry-tool', 'door')
  await expect(dmCanvas).toHaveAttribute('data-stage-can-pan', 'true')
  const box = await dmCanvas.boundingBox()
  expect(box).not.toBeNull()
  const viewportBefore = await dmCanvas.evaluate((element) => ({
    x: Number(element.getAttribute('data-viewport-x')),
    y: Number(element.getAttribute('data-viewport-y')),
  }))
  // 顶部工具栏覆盖画布容器上缘，使用可见地图中央的空白区域开始拖动。
  await dmPage.mouse.move(box!.x + box!.width * 0.35, box!.y + box!.height * 0.6)
  await dmPage.mouse.down()
  await dmPage.mouse.move(box!.x + box!.width * 0.35 + 70, box!.y + box!.height * 0.6 + 35, { steps: 5 })
  await dmPage.mouse.up()
  await expect.poll(() => dmCanvas.evaluate((element) => ({
    x: Number(element.getAttribute('data-viewport-x')),
    y: Number(element.getAttribute('data-viewport-y')),
  }))).not.toEqual(viewportBefore)

  await geometryTool.selectOption('light')
  await dmCanvas.click({ position: { x: box!.width * 0.55, y: box!.height * 0.5 } })
  await expect(dmCanvas).toHaveAttribute('data-scene-light-count', '1')
  await expect(playerCanvas).toHaveAttribute('data-scene-light-count', '1')
  await expect(dmPage.getByText('海拔 +25 尺', { exact: true })).toBeVisible()
  await expect.poll(() => playerPage.evaluate(async () => {
    const { useMapGeometryStore } = await import('/src/store/mapGeometry.ts')
    const light = useMapGeometryStore.getState().maps
      .find((map) => map.mapId === 'lighting-map')?.lights?.[0]
    return light && {
      enabled: light.enabled,
      brightRadiusFeet: light.brightRadiusFeet,
      dimRadiusFeet: light.dimRadiusFeet,
      elevationFeet: light.elevationFeet,
    }
  })).toEqual({ enabled: true, brightRadiusFeet: 20, dimRadiusFeet: 20, elevationFeet: 25 })

  await geometryTool.selectOption('elevation')
  await dmPage.mouse.move(box!.x + box!.width * 0.35, box!.y + box!.height * 0.72)
  await dmPage.mouse.down()
  await dmPage.mouse.move(box!.x + box!.width * 0.35 + 95, box!.y + box!.height * 0.72 - 45, { steps: 8 })
  await dmPage.mouse.up()
  await expect.poll(() => dmPage.evaluate(async () => {
    const { useMapGeometryStore } = await import('/src/store/mapGeometry.ts')
    const regions = useMapGeometryStore.getState().maps
      .find((entry) => entry.mapId === 'lighting-map')?.obstacles
      .filter((obstacle) => obstacle.terrainRegion) ?? []
    const createdRegion = regions.find((region) => region.id !== 'raised-ground')
    return createdRegion && {
      terrainElevationFeet: createdRegion.terrainElevationFeet,
      points: createdRegion.points,
    }
  })).toMatchObject({
    terrainElevationFeet: 10,
    points: expect.arrayContaining([
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
    ]),
  })
  const createdHeightPoints = await dmPage.evaluate(async () => {
    const { useMapGeometryStore } = await import('/src/store/mapGeometry.ts')
    return useMapGeometryStore.getState().maps
      .find((entry) => entry.mapId === 'lighting-map')?.obstacles
      .find((obstacle) => obstacle.terrainRegion && obstacle.id !== 'raised-ground')?.points ?? []
  })
  expect(createdHeightPoints.length).toBeGreaterThanOrEqual(4)
  expect(createdHeightPoints.every((point) => point.x % 40 === 0 && point.y % 40 === 0)).toBe(true)

  await dmContext.close()
  await playerContext.close()
})
