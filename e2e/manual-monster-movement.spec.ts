import { expect, test, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'
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
    role: 'dm'
    displayName: string
  }
}

function authHeaders(room: RoomMembership) {
  return {
    'Content-Type': 'application/json',
    'X-Stars-Protocol': '5',
    'X-Stars-Expected-Revision': '0',
    'X-Stars-Member': room.member.memberId,
    'X-Stars-Room-Token': room.member.roomToken,
  }
}

async function saveRoomState(
  request: APIRequestContext,
  room: RoomMembership,
  resource: string,
  data: unknown,
) {
  const response = await request.put(`${DM}/api/state/${resource}?room=${room.roomId}`, {
    headers: authHeaders(room),
    data,
  })
  expect(response.ok(), `${resource} should save`).toBeTruthy()
}

async function addRoomSession(context: BrowserContext, room: RoomMembership) {
  await context.addInitScript(([key, session]) => {
    localStorage.setItem(key, JSON.stringify({
      roomId: session.roomId,
      roomName: session.roomName,
      rulesetId: session.rulesetId,
      createdAt: session.createdAt,
      ...session.member,
    }))
  }, [SESSION_KEY, room] as const)
}

async function clickMapPoint(page: Page, point: { x: number; y: number }) {
  const canvas = page.getByTestId('map-canvas')
  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  const viewport = await canvas.evaluate((element) => ({
    x: Number(element.getAttribute('data-viewport-x')),
    y: Number(element.getAttribute('data-viewport-y')),
    scale: Number(element.getAttribute('data-viewport-scale')),
  }))
  await page.mouse.click(
    box!.x + viewport.x + point.x * viewport.scale,
    box!.y + viewport.y + point.y * viewport.scale,
  )
}

test('DM can click the current manually controlled monster and move it through Headless', async ({ browser, request }) => {
  const nonce = Date.now()
  const createdResponse = await request.post(`${DM}/api/rooms`, {
    data: {
      roomName: `Manual monster movement ${nonce}`,
      displayName: 'Movement DM',
      rulesetId: 'dnd5e-2014-srd-5.1',
      clientId: `movement-dm-${nonce}`,
      activePlugins: [],
    },
  })
  expect(createdResponse.status()).toBe(201)
  const room = await createdResponse.json() as RoomMembership

  const mapId = `manual-monster-map-${nonce}`
  const monsterTokenId = `manual-monster-${nonce}`
  const playerTokenId = `manual-player-${nonce}`
  const combatId = `${mapId}:combat-${nonce}`
  const turnKey = `${combatId}:1:${monsterTokenId}:normal`
  const now = Date.now()

  await saveRoomState(request, room, 'characters', {
    characters: [],
    selectedId: null,
    updatedAt: now,
  })
  await saveRoomState(request, room, 'maps', {
    selectedId: mapId,
    updatedAt: now,
    maps: [{
      id: mapId,
      name: 'Manual monster movement map',
      width: 800,
      height: 600,
      gridSize: 50,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [{
        id: monsterTokenId,
        label: 'Flesh Golem',
        x: 325,
        y: 325,
        color: '#ef4444',
        emoji: 'M',
        size: 1,
        type: 'enemy',
        hp: 93,
        maxHp: 93,
        poolId: 'srd-5.1:flesh-golem',
      }, {
        id: playerTokenId,
        label: 'Target',
        x: 575,
        y: 325,
        color: '#3b82f6',
        emoji: 'P',
        size: 1,
        type: 'player',
        hp: 30,
        maxHp: 30,
      }],
    }],
  })
  await saveRoomState(request, room, 'combat', {
    mapId,
    combatId,
    active: true,
    round: 1,
    initiativeIndex: 0,
    settlementMode: 'manual',
    monsterControl: {
      schemaVersion: 1,
      mode: 'manual',
      pauseRequested: false,
      controlledTokenId: 'stale-previous-monster',
      updatedAt: now,
    },
    initiativeOrder: [{
      slotId: `${monsterTokenId}:normal`,
      tokenId: monsterTokenId,
      label: 'Flesh Golem',
      emoji: 'M',
      color: '#ef4444',
      roll: 18,
    }, {
      slotId: `${playerTokenId}:normal`,
      tokenId: playerTokenId,
      label: 'Target',
      emoji: 'P',
      color: '#3b82f6',
      roll: 10,
    }],
    dnd5eTurnEconomyByToken: {
      [monsterTokenId]: {
        turnKey,
        attacksUsed: 0,
        action: { current: 1, max: 1 },
        bonusAction: { current: 1, max: 1 },
        reaction: { current: 1, max: 1 },
        objectInteraction: { current: 1, max: 1 },
        movement: { current: 30, max: 30 },
      },
    },
    updatedAt: now,
  })

  const context = await browser.newContext()
  await addRoomSession(context, room)
  const dm = await context.newPage()
  await dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' })

  const controlDock = dm.getByTestId('dm-monster-control-dock')
  await expect(controlDock).toBeVisible({ timeout: 20_000 })
  await controlDock.locator('button').first().click()
  await expect(dm.getByTestId('manual-monster-movement-status')).toBeVisible({ timeout: 20_000 })
  await controlDock.locator('button').first().click()
  await clickMapPoint(dm, { x: 325, y: 325 })
  await expect(dm.getByTestId('manual-monster-move-targeting')).toBeVisible({ timeout: 10_000 })

  await clickMapPoint(dm, { x: 375, y: 325 })
  await expect(dm.getByTestId('manual-monster-move-targeting')).toBeHidden({ timeout: 10_000 })

  await expect.poll(async () => {
    const response = await request.get(`${DM}/api/state/maps?room=${room.roomId}`, {
      headers: {
        'X-Stars-Member': room.member.memberId,
        'X-Stars-Room-Token': room.member.roomToken,
      },
    })
    if (!response.ok()) return null
    const state = await response.json() as {
      maps?: Array<{ id: string; tokens: Array<{ id: string; x: number; y: number }> }>
    }
    const moved = state.maps
      ?.find((map) => map.id === mapId)
      ?.tokens.find((token) => token.id === monsterTokenId)
    return moved ? { x: moved.x, y: moved.y } : null
  }, { timeout: 20_000 }).toEqual({ x: 375, y: 325 })

  await expect.poll(async () => {
    const response = await request.get(`${DM}/api/state/combat?room=${room.roomId}`, {
      headers: {
        'X-Stars-Member': room.member.memberId,
        'X-Stars-Room-Token': room.member.roomToken,
      },
    })
    if (!response.ok()) return null
    const state = await response.json() as {
      dnd5eTurnEconomyByToken?: Record<string, { movement?: { current?: number } }>
    }
    return state.dnd5eTurnEconomyByToken?.[monsterTokenId]?.movement?.current ?? null
  }, { timeout: 20_000 }).toBe(25)

  await context.close()
})
