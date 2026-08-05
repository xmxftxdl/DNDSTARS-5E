import { expect, test, type APIRequestContext } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'
const PLAYER = 'http://127.0.0.1:6174'
const SESSION_KEY = 'stars-room-session:v1'

interface RoomMembershipResponse {
  roomId: string
  roomName: string
  rulesetId: 'dnd5e-2014-srd-5.1'
  createdAt: number
  member: {
    memberId: string
    roomToken: string
    clientId: string
    role: 'dm' | 'player'
    slot?: 'player1' | 'player2' | 'player3'
    displayName: string
  }
}

async function putState(request: APIRequestContext, name: string, payload: unknown) {
  const response = await request.put(`${DM}/api/state/${name}`, { data: payload })
  expect(response.ok(), `${name} should save`).toBeTruthy()
}

async function putRoomState(
  request: APIRequestContext,
  room: RoomMembershipResponse,
  name: string,
  payload: unknown,
) {
  const url = `${DM}/api/state/${name}?room=${room.roomId}`
  const headers = {
    'X-Stars-Member': room.member.memberId,
    'X-Stars-Room-Token': room.member.roomToken,
  }
  const current = await request.get(url, { headers })
  const revision = Number(current.headers()['x-stars-state-revision'] ?? 0)
  const response = await request.put(url, {
    headers: {
      ...headers,
      'X-Stars-Protocol': '5',
      'X-Stars-Expected-Revision': String(Number.isInteger(revision) ? revision : 0),
    },
    data: payload,
  })
  expect(response.ok(), `${name} should save in room`).toBeTruthy()
}

async function enterRoom(page: import('@playwright/test').Page, origin: string, room: RoomMembershipResponse) {
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key, JSON.stringify(value)),
    [SESSION_KEY, {
      roomId: room.roomId,
      roomName: room.roomName,
      rulesetId: room.rulesetId,
      createdAt: room.createdAt,
      ...room.member,
    }] as const,
  )
  await page.goto(`${origin}/maps`, { waitUntil: 'domcontentloaded' })
}

test('client-side entry from the public landing page initializes the campaign rules host', async ({ browser, request }) => {
  test.setTimeout(60_000)
  const createdResponse = await request.post(`${DM}/api/rooms`, {
    data: {
      roomName: 'Landing page rules bootstrap room',
      displayName: 'Bootstrap DM',
      rulesetId: 'dnd5e-2014-srd-5.1',
      clientId: `bootstrap-dm-${Date.now()}`,
      activePlugins: [],
    },
  })
  expect(createdResponse.ok()).toBeTruthy()
  const room = await createdResponse.json() as RoomMembershipResponse
  const context = await browser.newContext()
  const page = await context.newPage()
  try {
    await page.addInitScript(
      ([key, value]) => localStorage.setItem(key, JSON.stringify(value)),
      [SESSION_KEY, {
        roomId: room.roomId,
        roomName: room.roomName,
        rulesetId: room.rulesetId,
        createdAt: room.createdAt,
        ...room.member,
      }] as const,
    )
    await page.goto(`${DM}/`, { waitUntil: 'domcontentloaded' })
    expect(await page.evaluate(() => Boolean(window.DNDSTARS_5E_RULES_PLUGINS))).toBe(false)

    await page.evaluate((path) => {
      window.history.pushState({}, '', path)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, `/campaign/${room.roomId}/maps`)

    await expect.poll(
      () => page.evaluate(() => Boolean(window.DNDSTARS_5E_RULES_PLUGINS)),
      { timeout: 20_000 },
    ).toBe(true)
  } finally {
    await context.close()
  }
})

test('automated monster end turn hands the authoritative turn to the player UI', async ({ browser, request }) => {
  test.setTimeout(90_000)
  const now = Date.now()
  const mapId = `player-turn-handoff-${now}`
  const combatId = `${mapId}:combat`
  const hero = {
    id: `${mapId}:hero`,
    rulesetId: 'dnd5e-2014-srd-5.1',
    dnd5eClassId: 'fighter',
    dnd5eClassLevels: { fighter: 5 },
    name: '回合交接战士',
    player: '玩家 1',
    avatar: 'H',
    accent: 'from-slate-400 to-sky-600',
    race: '人类',
    charClass: '战士',
    level: 5,
    background: '',
    experience: 6500,
    reputation: 0,
    abilities: { str: 16, dex: 14, con: 16, int: 10, wis: 10, cha: 10 },
    savingThrows: ['str', 'con'],
    skills: [],
    maxHp: 100,
    currentHp: 100,
    tempHp: 0,
    hitDice: '5d10',
    ac: 18,
    speed: 30,
    initiativeBonus: 2,
    saveDC: 13,
    passivePerception: 10,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    equipment: {},
  }
  const enemy = {
    id: `${mapId}:goblin`,
    label: '回合交接哥布林',
    x: 280,
    y: 280,
    color: '#ef4444',
    emoji: 'G',
    size: 1,
    type: 'enemy',
    hp: 7,
    maxHp: 7,
    poolId: 'srd-5.1:goblin',
  }
  const heroToken = {
    id: `${mapId}:hero-token`,
    label: hero.name,
    x: 350,
    y: 280,
    color: '#94a3b8',
    emoji: 'H',
    size: 1,
    type: 'player',
    characterId: hero.id,
  }

  await request.delete(`${DM}/api/events/_all`)
  await putState(request, 'characters', { characters: [hero], selectedId: hero.id, updatedAt: now })
  await putState(request, 'maps', {
    selectedId: mapId,
    updatedAt: now,
    maps: [{
      id: mapId,
      name: '玩家回合交接 E2E',
      width: 700,
      height: 560,
      gridSize: 70,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [enemy, heroToken],
    }],
  })
  await putState(request, 'combat-log', { mapId, entries: [], updatedAt: now })
  await putState(request, 'dice-events', { mapId, events: [], updatedAt: now })
  await putState(request, 'combat-interrupts', { mapId, interrupts: [], revision: 0, updatedAt: now })
  await putState(request, 'combat', {
    mapId,
    combatId,
    active: true,
    round: 1,
    initiativeIndex: 0,
    settlementMode: 'automatic',
    initiativeOrder: [
      { tokenId: enemy.id, label: enemy.label, emoji: enemy.emoji, color: enemy.color, roll: 20 },
      { tokenId: heroToken.id, label: heroToken.label, emoji: heroToken.emoji, color: heroToken.color, roll: 10 },
    ],
    updatedAt: now,
  })
  await putState(request, 'dm-authority-ready', { mapId, combatId, ready: true, updatedAt: now })

  const context = await browser.newContext()
  const player = await context.newPage()
  const dm = await context.newPage()
  const playerErrors: string[] = []
  player.on('pageerror', (error) => playerErrors.push(error.message))

  await player.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' })
  await expect(player.getByTestId('player-end-turn-top')).toBeDisabled({ timeout: 20_000 })
  await dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' })

  await expect.poll(async () => {
    const response = await request.get(`${DM}/api/state/combat`)
    const combat = await response.json() as { initiativeIndex?: number }
    return combat.initiativeIndex
  }, { timeout: 45_000 }).toBe(1)

  await expect(player.getByTestId('player-end-turn-top')).toBeEnabled({ timeout: 10_000 })
  await expect(player.locator('[data-combat-banner="turn"]')).toBeVisible({ timeout: 10_000 })
  await expect(player.getByTestId('initiative-token-' + heroToken.id)).toHaveAttribute('data-active-turn', 'true')
  await player.getByTestId(`character-rail-${hero.id}`).click()
  await expect(player.getByTestId('map-canvas')).toBeVisible()
  await expect(player.getByText('正在加载地图工具…')).toBeHidden()
  expect(playerErrors).toEqual([])
  await context.close()
})

test('room-owned character regains control after its prior end-turn command and one automated monster turn', async ({ browser, request }) => {
  test.setTimeout(90_000)
  const createdResponse = await request.post(`${DM}/api/rooms`, {
    data: {
      roomName: 'Player turn handoff room',
      displayName: 'Handoff DM',
      rulesetId: 'dnd5e-2014-srd-5.1',
      clientId: `handoff-dm-${Date.now()}`,
      activePlugins: [],
    },
  })
  expect(createdResponse.ok()).toBeTruthy()
  const room = await createdResponse.json() as RoomMembershipResponse
  const joinedResponse = await request.post(`${DM}/api/rooms/${room.roomId}/join`, {
    data: {
      displayName: 'Handoff Player',
      clientId: `handoff-player-${Date.now()}`,
      activePlugins: [],
    },
  })
  expect(joinedResponse.ok()).toBeTruthy()
  const joined = await joinedResponse.json() as RoomMembershipResponse
  const now = Date.now()
  const mapId = `room-player-turn-handoff-${now}`
  const combatId = `${mapId}:combat`
  const characterId = `${mapId}:hero`
  const heroTokenId = `${mapId}:hero-token`
  const enemyTokenId = `${mapId}:goblin`
  const character = {
    id: characterId,
    roomId: room.roomId,
    roomMemberId: joined.member.memberId,
    rulesetId: 'dnd5e-2014-srd-5.1',
    dnd5eClassId: 'fighter',
    dnd5eClassLevels: { fighter: 5 },
    name: '房间交接战士',
    player: joined.member.displayName,
    avatar: 'H',
    accent: 'from-slate-400 to-sky-600',
    race: '人类',
    charClass: '战士',
    level: 5,
    background: '',
    experience: 6500,
    reputation: 0,
    abilities: { str: 16, dex: 14, con: 16, int: 10, wis: 10, cha: 10 },
    savingThrows: ['str', 'con'],
    skills: [],
    maxHp: 100,
    currentHp: 100,
    tempHp: 0,
    hitDice: '5d10',
    ac: 18,
    speed: 30,
    initiativeBonus: 2,
    saveDC: 13,
    passivePerception: 10,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    equipment: {},
  }
  const reserveCharacter = {
    ...character,
    id: `${mapId}:reserve-hero`,
    name: '同玩家的备用角色',
  }
  const enemy = {
    id: enemyTokenId,
    label: '房间交接哥布林',
    x: 280,
    y: 280,
    color: '#ef4444',
    emoji: 'G',
    size: 1,
    type: 'enemy',
    hp: 7,
    maxHp: 7,
    poolId: 'srd-5.1:goblin',
  }
  const heroToken = {
    id: heroTokenId,
    label: character.name,
    x: 350,
    y: 280,
    color: '#94a3b8',
    emoji: 'H',
    size: 1,
    type: 'player',
    characterId,
  }
  await putRoomState(request, room, 'characters', {
    // The room member owns more than one character. The selected/default one
    // is deliberately not the actor whose initiative slot is active.
    characters: [reserveCharacter, character],
    selectedId: reserveCharacter.id,
    updatedAt: now,
  })
  await putRoomState(request, room, 'maps', {
    selectedId: mapId,
    updatedAt: now,
    maps: [{
      id: mapId,
      name: '房间玩家回合交接 E2E',
      width: 700,
      height: 560,
      gridSize: 70,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [enemy, heroToken],
    }],
  })
  await putRoomState(request, room, 'combat-log', { mapId, entries: [], updatedAt: now })
  await putRoomState(request, room, 'combat-interrupts', { mapId, interrupts: [], revision: 0, updatedAt: now })
  await putRoomState(request, room, 'combat', {
    mapId,
    combatId,
    active: true,
    round: 1,
    initiativeIndex: 0,
    settlementMode: 'automatic',
    initiativeOrder: [
      { tokenId: heroTokenId, label: heroToken.label, emoji: heroToken.emoji, color: heroToken.color, roll: 20 },
      { tokenId: enemyTokenId, label: enemy.label, emoji: enemy.emoji, color: enemy.color, roll: 10 },
    ],
    updatedAt: now,
  })
  await putRoomState(request, room, 'dm-authority-ready', { mapId, combatId, ready: true, updatedAt: now })

  const dmContext = await browser.newContext()
  const playerContext = await browser.newContext()
  const dm = await dmContext.newPage()
  const player = await playerContext.newPage()
  try {
    await enterRoom(player, PLAYER, joined)
    await enterRoom(dm, DM, room)
    await expect(player.getByTestId('player-end-turn-top')).toBeEnabled({ timeout: 20_000 })
    await player.getByTestId('player-end-turn-top').click()

    await expect.poll(async () => {
      const response = await request.get(`${DM}/api/state/combat?room=${room.roomId}`, {
        headers: {
          'X-Stars-Member': room.member.memberId,
          'X-Stars-Room-Token': room.member.roomToken,
        },
      })
      const combat = await response.json() as { round?: number; initiativeIndex?: number }
      return `${combat.round}:${combat.initiativeIndex}`
    }, { timeout: 45_000 }).toBe('2:0')

    await expect(player.getByTestId('player-end-turn-top')).toBeEnabled({ timeout: 10_000 })
    await expect(player.locator('[data-combat-banner="turn"]')).toBeVisible({ timeout: 10_000 })
    await expect(player.getByTestId(`initiative-token-${heroTokenId}`)).toHaveAttribute('data-active-turn', 'true')
  } finally {
    await Promise.all([dmContext.close(), playerContext.close()])
  }
})
