import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'
const SESSION_KEY = 'stars-room-session:v1'

interface Membership {
  roomId: string
  roomName: string
  rulesetId: 'dnd5e-2014-srd-5.1'
  createdAt: number
  member: {
    memberId: string
    roomToken: string
    clientId: string
    role: 'dm'
    displayName: string
  }
}

function roomHeaders(membership: Membership) {
  return {
    'X-Stars-Member': membership.member.memberId,
    'X-Stars-Room-Token': membership.member.roomToken,
    'X-Stars-Protocol': '5',
  }
}

async function putRoomState(
  request: APIRequestContext,
  membership: Membership,
  name: string,
  payload: unknown,
) {
  const response = await request.put(`${DM}/api/state/${name}?room=${membership.roomId}`, {
    headers: { ...roomHeaders(membership), 'X-Stars-Expected-Revision': '0' },
    data: payload,
  })
  expect(response.ok(), `${name}: ${response.status()} ${await response.text()}`).toBeTruthy()
}

async function sceneState(request: APIRequestContext, membership: Membership) {
  const response = await request.get(`${DM}/api/state/scene-orchestration?room=${membership.roomId}`, {
    headers: roomHeaders(membership),
  })
  expect(response.ok()).toBeTruthy()
  return response.json() as Promise<{
    scenes: Array<{
      triggers: Array<{
        region: { kind: string; x: number; y: number; radius?: number }
        actions: Array<{ id: string; kind: string; x?: number; y?: number }>
      }>
      interactionPoints: Array<{ id: string; x: number; y: number }>
    }>
  }>
}

async function dragMapPoint(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const canvas = page.getByTestId('map-canvas')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('map canvas has no bounding box')
  const scale = Number(await canvas.getAttribute('data-viewport-scale')) || 1
  const viewX = Number(await canvas.getAttribute('data-viewport-x')) || 0
  const viewY = Number(await canvas.getAttribute('data-viewport-y')) || 0
  const screen = (point: { x: number; y: number }) => ({
    x: box.x + viewX + point.x * scale,
    y: box.y + viewY + point.y * scale,
  })
  await page.mouse.move(screen(from).x, screen(from).y)
  await page.mouse.down()
  await page.mouse.move(screen(to).x, screen(to).y, { steps: 8 })
  await page.mouse.up()
}

async function clickMapPoint(page: Page, point: { x: number; y: number }) {
  const canvas = page.getByTestId('map-canvas')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('map canvas has no bounding box')
  const scale = Number(await canvas.getAttribute('data-viewport-scale')) || 1
  const viewX = Number(await canvas.getAttribute('data-viewport-x')) || 0
  const viewY = Number(await canvas.getAttribute('data-viewport-y')) || 0
  await page.mouse.click(
    box.x + viewX + point.x * scale,
    box.y + viewY + point.y * scale,
  )
}

test('场景编排图层可拖动入口、出口和互动点并写回权威状态', async ({ browser, request }, testInfo) => {
  test.setTimeout(90_000)
  const created = await request.post(`${DM}/api/rooms`, {
    data: {
      roomName: '场景编排拖动 E2E',
      displayName: '编排 DM',
      rulesetId: 'dnd5e-2014-srd-5.1',
      clientId: `scene-drag-${Date.now()}`,
    },
  })
  expect(created.ok()).toBeTruthy()
  const membership = await created.json() as Membership
  const now = Date.now()
  const mapId = `scene-drag-map-${now}`
  const lowerMapId = `scene-drag-lower-map-${now}`

  await putRoomState(request, membership, 'maps', {
    selectedId: mapId,
    updatedAt: now,
    maps: [
      {
        id: mapId,
        name: '双层遗迹',
        width: 700,
        height: 700,
        gridSize: 70,
        gridOffsetX: 0,
        gridOffsetY: 0,
        showGrid: true,
        feetPerCell: 5,
        tokens: [{
          id: 'interaction-overlap-token',
          label: '压在机关上的敌人',
          x: 330,
          y: 180,
          color: '#ef4444',
          emoji: '👹',
          size: 1,
          type: 'enemy',
        }],
      },
      {
        id: lowerMapId,
        name: '地下二层',
        width: 700,
        height: 700,
        gridSize: 70,
        gridOffsetX: 0,
        gridOffsetY: 0,
        showGrid: true,
        feetPerCell: 5,
        tokens: [],
      },
    ],
  })
  await putRoomState(request, membership, 'combat', {
    mapId,
    active: false,
    round: 1,
    initiativeIndex: 0,
    initiativeOrder: [],
    settlementMode: 'manual',
    updatedAt: now,
  })
  await putRoomState(request, membership, 'combat-log', { mapId, entries: [], updatedAt: now })
  await putRoomState(request, membership, 'scene-orchestration', {
    schemaVersion: 1,
    scenes: [{
      id: 'ruins-scene',
      mapId,
      name: '双层遗迹',
      description: '',
      environmentLabel: '',
      backgroundCue: 'none',
      backgroundAudioLoop: true,
      backgroundAudioVolume: 0.7,
      boundHandoutIds: [],
      boundJournalEntryIds: [],
      interactionPoints: [{
        id: 'lever',
        name: '机关拉杆',
        enabled: true,
        visibleToPlayers: true,
        icon: 'switch',
        x: 330,
        y: 180,
        interactionRadiusFeet: 5,
        prompt: '拉动机关。',
        repeat: 'always',
        check: {
          label: '调查机关',
          selection: 'ability:int',
          dc: 10,
          mode: 'normal',
        },
        successText: '机关启动。',
        failureText: '机关没有反应。',
        rewards: [],
        successEffects: [],
        failureEffects: [],
      }],
      triggers: [{
        id: 'stairs-entry',
        name: '楼梯入口',
        enabled: true,
        region: { kind: 'circle', x: 150, y: 170, radius: 55 },
        events: ['enter'],
        tokenFilter: 'player',
        repeat: 'always',
        actions: [{
          id: 'stairs-exit',
          kind: 'teleport',
          enabled: true,
          targetMapId: mapId,
          x: 450,
          y: 190,
          moveTriggeringToken: true,
        }],
      }],
      createdAt: now,
      updatedAt: now,
    }],
    runtime: { paused: false, pendingRuns: [], receipts: [], history: [] },
    updatedAt: now,
  })

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addInitScript(([key, session]) => {
    localStorage.setItem(key, JSON.stringify(session))
  }, [SESSION_KEY, {
    roomId: membership.roomId,
    roomName: membership.roomName,
    rulesetId: membership.rulesetId,
    createdAt: membership.createdAt,
    ...membership.member,
  }] as const)
  const page = await context.newPage()
  await page.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' })
  const canvas = page.getByTestId('map-canvas')
  await expect(canvas).toHaveAttribute('data-scene-interaction-count', '1', { timeout: 20_000 })

  // The DM can drag an interaction point even with the orchestration panel
  // closed and a Token occupying the exact same position.
  await dragMapPoint(page, { x: 330, y: 180 }, { x: 350, y: 200 })
  await expect.poll(async () => (await sceneState(request, membership)).scenes[0].interactionPoints[0])
    .toMatchObject({ id: 'lever', x: 350, y: 200 })

  const sceneToolbarButton = page.getByTestId('scene-orchestration-toolbar-button')
  await expect(sceneToolbarButton).toHaveAttribute('aria-pressed', 'false')
  await page.waitForTimeout(750)
  await sceneToolbarButton.click()
  await expect(sceneToolbarButton).toHaveAttribute('aria-pressed', 'true')
  await expect(canvas).toHaveAttribute('data-scene-overlay-editing', 'true', { timeout: 20_000 })
  await expect(canvas).toHaveAttribute('data-scene-trigger-count', '1')
  await expect(canvas).toHaveAttribute('data-scene-teleport-destination-count', '1')

  await page.getByTestId('scene-trigger-editor-shortcut').click()
  await page.getByTestId('scene-configure-teleport').click()
  const teleportFields = page.getByTestId('scene-teleport-action-fields')
  await expect(teleportFields).toBeVisible()
  await teleportFields.getByLabel('目标地图/楼层').selectOption(lowerMapId)
  await expect(teleportFields.getByLabel('目标地图/楼层')).toHaveValue(lowerMapId)
  await page.getByTestId('scene-orchestration-panel').screenshot({
    path: testInfo.outputPath('scene-teleport-selector.png'),
  })

  await dragMapPoint(page, { x: 150, y: 170 }, { x: 230, y: 250 })
  await expect.poll(async () => (await sceneState(request, membership)).scenes[0].triggers[0].region)
    .toMatchObject({ x: 230, y: 250, radius: 55 })

  await dragMapPoint(page, { x: 450, y: 190 }, { x: 520, y: 280 })
  await expect.poll(async () => (await sceneState(request, membership)).scenes[0].triggers[0].actions[0])
    .toMatchObject({ id: 'stairs-exit', x: 520, y: 280 })

  await page.getByTestId('scene-orchestration-panel')
    .getByRole('button', { name: '互动点', exact: true })
    .click()
  await page.getByTestId('scene-interaction-points-editor')
    .getByRole('button', { name: '地图放置', exact: true })
    .click()
  await expect(canvas).toHaveAttribute('data-scene-overlay-editing', 'true')

  const canvasBox = await canvas.boundingBox()
  if (!canvasBox) throw new Error('map canvas has no bounding box')
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.45, canvasBox.y + canvasBox.height * 0.45)
  await page.mouse.wheel(0, -500)
  await expect.poll(async () => Number(await canvas.getAttribute('data-viewport-scale'))).toBeGreaterThan(1)

  await dragMapPoint(page, { x: 350, y: 200 }, { x: 370, y: 350 })
  await expect.poll(async () => (await sceneState(request, membership)).scenes[0].interactionPoints[0].x)
    .toBeCloseTo(370, -1)
  await expect.poll(async () => (await sceneState(request, membership)).scenes[0].interactionPoints[0].y)
    .toBeCloseTo(350, -1)

  await sceneToolbarButton.click()
  await expect(sceneToolbarButton).toHaveAttribute('aria-pressed', 'false')
  await clickMapPoint(page, { x: 370, y: 350 })
  await expect(sceneToolbarButton).toHaveAttribute('aria-pressed', 'true')
  const interactionDetails = page.getByTestId('scene-interaction-point-details')
  await expect(interactionDetails).toBeVisible()
  await expect(interactionDetails.getByLabel('互动点名称')).toHaveValue('机关拉杆')
  await interactionDetails.getByRole('button', { name: '删除互动点', exact: true }).click()
  await expect(page.getByText('删除地图互动点', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '删除', exact: true }).click()
  await expect.poll(async () => (await sceneState(request, membership)).scenes[0].interactionPoints.length)
    .toBe(0)
  await expect(canvas).toHaveAttribute('data-scene-interaction-count', '0')

  await context.close()
})
