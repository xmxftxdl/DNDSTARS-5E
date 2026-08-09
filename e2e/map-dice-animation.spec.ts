import { expect, test, type APIRequestContext } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'
const PLAYER = 'http://127.0.0.1:6174'
const SESSION_KEY = 'stars-room-session:v1'

interface RoomMembership {
  roomId: string
  roomName: string
  rulesetId: string
  createdAt: number
  member: {
    memberId: string
    roomToken: string
    clientId: string
    role: 'dm' | 'player'
    slot?: string
    displayName: string
  }
}

test('forced d4 faces stay bound to each die while the result gathers', async ({ page }) => {
  await page.goto(`${DM}/dice-box-frame.html?sides=4&qty=2`, {
    waitUntil: 'domcontentloaded',
  })
  const result = await page.evaluate(async () => {
    const container = document.createElement('div')
    container.id = 'd4-regression-dice'
    Object.assign(container.style, {
      position: 'fixed', inset: '0', width: '100%', height: '100%', zIndex: '10',
    })
    document.body.append(container)
    const dice = await import('/src/lib/diceEngine.ts')
    const box = await dice.createDiceBox('#d4-regression-dice', {
      scale: dice.DICE_D4_BASE_SCALE,
      dimensions: { x: 900, y: 600 },
      theme: dice.DICE_D4_THEME,
    })
    const outcome = await box.roll('2d4@1,4')
    box.correctVisibleFaces([1, 4])
    const beforeGather = box.visibleValues()
    await box.arrangeSettledDice([1, 4])
    box.correctVisibleFaces([1, 4])
    const afterGather = box.visibleValues()
    box.destroy()
    return { engineValues: outcome.values, beforeGather, afterGather }
  })

  // dice-box-threejs may misreport the forced multi-d4 values internally; the
  // host must keep the physical faces aligned with the authoritative values.
  expect(result.beforeGather).toEqual([1, 4])
  expect(result.afterGather).toEqual([1, 4])
})

async function putRoomState(
  request: APIRequestContext,
  room: RoomMembership,
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
  expect(response.ok()).toBeTruthy()
}

test('free dice keeps its threejs iframe alive through React StrictMode and completes the roll', async ({ page, request }) => {
  const createdResponse = await request.post(`${DM}/api/rooms`, {
    data: {
      roomName: 'Dice animation regression', displayName: 'Dice DM',
      rulesetId: 'dnd5e-2014-srd-5.1', clientId: `dice-animation-${Date.now()}`, activePlugins: [],
    },
  })
  expect(createdResponse.status()).toBe(201)
  const created = await createdResponse.json() as {
    roomId: string; roomName: string; rulesetId: string; createdAt: number
    member: { memberId: string; roomToken: string; clientId: string; role: 'dm'; displayName: string }
  }
  const now = Date.now()
  const mapResponse = await request.put(`${DM}/api/state/maps?room=${created.roomId}`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Stars-Protocol': '5',
      'X-Stars-Expected-Revision': '0',
      'X-Stars-Member': created.member.memberId,
      'X-Stars-Room-Token': created.member.roomToken,
    },
    data: {
      selectedId: 'dice-map', updatedAt: now,
      maps: [{
        id: 'dice-map', name: '骰子地图', width: 800, height: 600,
        gridSize: 40, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
        tokens: [],
      }],
    },
  })
  expect(mapResponse.ok()).toBeTruthy()

  await page.addInitScript(([key, response]) => {
    localStorage.setItem(key, JSON.stringify({
      roomId: response.roomId,
      roomName: response.roomName,
      rulesetId: response.rulesetId,
      createdAt: response.createdAt,
      ...response.member,
    }))
  }, [SESSION_KEY, created] as const)
  await page.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('map-canvas').waitFor()
  await page.getByTestId('map-dice-roller-toggle').click()
  const rollButton = page.getByRole('button', { name: '投掷 1d20' })
  await rollButton.click()

  const rollFrame = page.locator('iframe[title="20-sided dice roller"]')
  await expect(rollFrame).toHaveAttribute('src', /sides=20&qty=1/)
  await expect.poll(async () => rollFrame.contentFrame().locator('canvas').count()).toBe(1)
  await expect(page.getByRole('button', { name: '骰子滚动中…' })).toBeVisible()
  await expect(rollButton).toBeEnabled({ timeout: 20_000 })
})

test('off-map endpoint ACKs dice without replaying it after returning to the battle map', async ({ browser, request }) => {
  const createdResponse = await request.post(`${DM}/api/rooms`, {
    data: {
      roomName: 'Off-map dice ACK', displayName: 'Dice DM',
      rulesetId: 'dnd5e-2014-srd-5.1', clientId: `off-map-dice-dm-${Date.now()}`, activePlugins: [],
    },
  })
  expect(createdResponse.status()).toBe(201)
  const dm = await createdResponse.json() as RoomMembership
  const joinedResponse = await request.post(`${DM}/api/rooms/${dm.roomId}/join`, {
    data: { displayName: 'Dice Player', clientId: `off-map-dice-player-${Date.now()}`, activePlugins: [] },
  })
  expect(joinedResponse.ok()).toBeTruthy()
  const player = await joinedResponse.json() as RoomMembership
  const now = Date.now()
  const mapId = 'off-map-dice-map'

  await putRoomState(request, dm, 'maps', {
    selectedId: mapId,
    updatedAt: now,
    maps: [{
      id: mapId, name: 'Off-map dice map', width: 800, height: 600,
      gridSize: 40, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [],
    }],
  })

  const context = await browser.newContext()
  await context.addInitScript(([key, membership]) => {
    localStorage.setItem(key, JSON.stringify({
      roomId: membership.roomId,
      roomName: membership.roomName,
      rulesetId: membership.rulesetId,
      createdAt: membership.createdAt,
      ...membership.member,
    }))
  }, [SESSION_KEY, player] as const)
  const playerPage = await context.newPage()
  await playerPage.goto(`${PLAYER}/communications`, { waitUntil: 'domcontentloaded' })

  const eventId = `off-map-dice-${now}`
  const label = `OFFMAP_NO_REPLAY_${now}`
  await putRoomState(request, dm, 'combat-log', {
    mapId,
    entries: [{ id: now, round: 1, text: `${label} 已结算`, kind: 'system', time: '00:00' }],
    updatedAt: now + 1,
  })
  await putRoomState(request, dm, 'dice-events', {
    mapId,
    events: [{
      id: eventId,
      mapId,
      sourceMode: 'dm',
      visibility: 'public',
      status: 'result',
      roll: {
        values: [14], sides: 20, bonus: 3, total: 17,
        label, targetName: 'Off-map target',
      },
      updatedAt: now + 2,
    }],
    updatedAt: now + 2,
  })

  await expect.poll(() => playerPage.evaluate((id) => (
    Object.keys(sessionStorage).some((key) =>
      key.includes('astraltrace:combat-playback:v1') &&
      (sessionStorage.getItem(key) ?? '').includes(id),
    )
  ), eventId)).toBe(true)

  await playerPage.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' })
  await playerPage.getByTestId('map-canvas').waitFor()
  await expect(playerPage.getByText(label, { exact: false })).toHaveCount(0)
  await expect(playerPage.locator('iframe[title="20-sided dice roller"]')).toHaveCount(0)

  await playerPage.getByTestId('combat-log-toggle').click()
  await expect(playerPage.getByText(`${label} 已结算`, { exact: true })).toBeVisible()
  await context.close()
})
