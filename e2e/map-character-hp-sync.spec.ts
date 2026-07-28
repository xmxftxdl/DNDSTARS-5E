import { expect, test, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test'

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
    slot?: 'player1' | 'player2' | 'player3'
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

async function dragMapToken(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const canvas = page.getByTestId('map-canvas')
  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  const viewport = await canvas.evaluate((element) => ({
    x: Number(element.getAttribute('data-viewport-x')),
    y: Number(element.getAttribute('data-viewport-y')),
    scale: Number(element.getAttribute('data-viewport-scale')),
  }))
  await page.mouse.move(
    box!.x + viewport.x + from.x * viewport.scale,
    box!.y + viewport.y + from.y * viewport.scale,
  )
  await page.mouse.down()
  await page.mouse.move(
    box!.x + viewport.x + to.x * viewport.scale,
    box!.y + viewport.y + to.y * viewport.scale,
    { steps: 8 },
  )
  await page.mouse.up()
}

test('DM 可随时调整双方生命值、状态与位置，并通过 SSE 同步玩家端', async ({ browser, request }) => {
  const nonce = Date.now()
  const createdResponse = await request.post(`${DM}/api/rooms`, {
    data: {
      roomName: `HP sync ${nonce}`,
      displayName: 'HP DM',
      rulesetId: 'dnd5e-2014-srd-5.1',
      clientId: `hp-dm-${nonce}`,
      activePlugins: [],
    },
  })
  expect(createdResponse.status()).toBe(201)
  const created = await createdResponse.json() as RoomMembership

  const joinedResponse = await request.post(`${PLAYER}/api/rooms/${created.roomId}/join`, {
    data: {
      displayName: 'HP Player',
      clientId: `hp-player-${nonce}`,
      activePlugins: [],
    },
  })
  expect(joinedResponse.ok()).toBeTruthy()
  const joined = await joinedResponse.json() as RoomMembership

  const mapId = `hp-map-${nonce}`
  const characterId = `hp-character-${nonce}`
  const tokenId = `hp-token-${nonce}`
  const enemyTokenId = `hp-enemy-${nonce}`
  const now = Date.now()
  const character = {
    id: characterId,
    roomId: created.roomId,
    roomMemberId: joined.member.memberId,
    rulesetId: 'dnd5e-2014-srd-5.1',
    dnd5eClassId: 'bard',
    name: '生命值同步角色',
    player: 'HP Player',
    avatar: '🎵',
    accent: 'from-fuchsia-500 to-violet-700',
    race: '人类',
    charClass: '吟游诗人',
    level: 13,
    background: '艺人',
    alignment: '中立善良',
    experience: 120000,
    reputation: 0,
    abilities: { str: 10, dex: 14, con: 14, int: 12, wis: 10, cha: 18 },
    savingThrows: ['dex', 'cha'],
    skills: ['performance'],
    maxHp: 94,
    currentHp: 94,
    tempHp: 0,
    hitDice: '13d8',
    ac: 13,
    speed: 30,
    initiativeBonus: 2,
    saveDC: 16,
    passivePerception: 10,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
  }
  const token = {
    id: tokenId,
    label: character.name,
    x: 350,
    y: 300,
    color: '#d946ef',
    emoji: '🎵',
    size: 1,
    type: 'player',
    characterId,
    hp: 94,
    maxHp: 94,
  }
  const enemyToken = {
    id: enemyTokenId,
    label: '生命值同步怪物',
    x: 500,
    y: 300,
    color: '#ef4444',
    emoji: '👹',
    size: 1,
    type: 'enemy',
    hp: 12,
    maxHp: 12,
  }

  await saveRoomState(request, created, 'characters', {
    characters: [character],
    selectedId: characterId,
    updatedAt: now,
  })
  await saveRoomState(request, created, 'maps', {
    selectedId: mapId,
    updatedAt: now,
    maps: [{
      id: mapId,
      name: '生命值同步地图',
      width: 800,
      height: 600,
      gridSize: 50,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [token, enemyToken],
    }],
  })
  await saveRoomState(request, created, 'combat', {
    mapId,
    combatId: `${mapId}:combat`,
    active: true,
    round: 1,
    initiativeIndex: 0,
    settlementMode: 'automatic',
    initiativeOrder: [{
      tokenId,
      label: character.name,
      emoji: token.emoji,
      color: token.color,
      roll: 18,
    }, {
      tokenId: enemyTokenId,
      label: enemyToken.label,
      emoji: enemyToken.emoji,
      color: enemyToken.color,
      roll: 12,
    }],
    updatedAt: now,
  })

  const dmContext = await browser.newContext()
  const playerContext = await browser.newContext()
  await addRoomSession(dmContext, created)
  await addRoomSession(playerContext, joined)
  const dm = await dmContext.newPage()
  const player = await playerContext.newPage()

  await Promise.all([
    dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' }),
    player.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' }),
  ])

  const dmInitiative = dm.getByTestId(`initiative-token-${tokenId}`)
  const playerHealth = player.getByTestId(`initiative-health-${tokenId}`)
  await expect(dmInitiative).toBeVisible({ timeout: 20_000 })
  await expect(playerHealth).toHaveAttribute('title', 'HP 94/94', { timeout: 20_000 })

  await dmInitiative.click()
  const panel = dm.getByTestId('character-detail-panel')
  const hpInput = panel.getByRole('spinbutton', { name: '当前生命值' })
  await expect(hpInput).toHaveValue('94')
  await hpInput.fill('79')
  await expect(hpInput).toBeFocused()

  await expect(dm.getByTestId(`initiative-health-${tokenId}`)).toHaveAttribute('title', 'HP 79/94')
  await expect(playerHealth).toHaveAttribute('title', 'HP 79/94', { timeout: 20_000 })

  await expect.poll(async () => {
    const response = await request.get(`${DM}/api/state/characters?room=${created.roomId}`, {
      headers: {
        'X-Stars-Member': created.member.memberId,
        'X-Stars-Room-Token': created.member.roomToken,
      },
    })
    if (!response.ok()) return null
    const state = await response.json() as {
      characters?: Array<{ id: string; currentHp: number; maxHp: number }>
    }
    const saved = state.characters?.find((entry) => entry.id === characterId)
    return saved ? { currentHp: saved.currentHp, maxHp: saved.maxHp } : null
  }, { timeout: 20_000 }).toEqual({ currentHp: 79, maxHp: 94 })

  await expect.poll(async () => {
    const response = await request.get(`${DM}/api/state/maps?room=${created.roomId}`, {
      headers: {
        'X-Stars-Member': created.member.memberId,
        'X-Stars-Room-Token': created.member.roomToken,
      },
    })
    if (!response.ok()) return null
    const state = await response.json() as {
      maps?: Array<{ id: string; tokens: Array<{ id: string; hp?: number; maxHp?: number }> }>
    }
    const saved = state.maps
      ?.find((entry) => entry.id === mapId)
      ?.tokens.find((entry) => entry.id === tokenId)
    return saved ? { hp: saved.hp, maxHp: saved.maxHp } : null
  }, { timeout: 20_000 }).toEqual({ hp: 79, maxHp: 94 })

  const playerConditionToggle = panel.getByTestId('dnd5e-condition-toggle-prone')
  await playerConditionToggle.click()
  await expect(playerConditionToggle).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(async () => {
    const response = await request.get(`${DM}/api/state/characters?room=${created.roomId}`, {
      headers: {
        'X-Stars-Member': created.member.memberId,
        'X-Stars-Room-Token': created.member.roomToken,
      },
    })
    if (!response.ok()) return false
    const state = await response.json() as {
      characters?: Array<{ id: string; conditions?: string[] }>
    }
    return state.characters?.find((entry) => entry.id === characterId)?.conditions?.includes('prone') === true
  }, { timeout: 20_000 }).toBe(true)
  await panel.locator('button').first().click()

  await dm.getByTestId(`initiative-token-${enemyTokenId}`).click()
  const enemyPanel = dm.getByTestId('enemy-detail-panel')
  const enemyHpInput = enemyPanel.getByRole('spinbutton', { name: '怪物当前生命值' })
  await enemyHpInput.fill('5')
  await expect(enemyHpInput).toBeFocused()
  await expect(dm.getByTestId(`initiative-health-${enemyTokenId}`)).toHaveAttribute('title', 'HP 5/12')
  await expect(player.getByTestId(`initiative-health-${enemyTokenId}`)).toHaveAttribute('title', 'HP 5/12', {
    timeout: 20_000,
  })

  const monsterConditionToggle = enemyPanel.getByTestId('dnd5e-condition-toggle-poisoned')
  await monsterConditionToggle.click()
  await expect(monsterConditionToggle).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(async () => {
    const response = await request.get(`${DM}/api/state/maps?room=${created.roomId}`, {
      headers: {
        'X-Stars-Member': created.member.memberId,
        'X-Stars-Room-Token': created.member.roomToken,
      },
    })
    if (!response.ok()) return false
    const state = await response.json() as {
      maps?: Array<{
        id: string
        tokens: Array<{ id: string; dnd5eCombatState?: { conditions?: string[] } }>
      }>
    }
    return state.maps
      ?.find((entry) => entry.id === mapId)
      ?.tokens.find((entry) => entry.id === enemyTokenId)
      ?.dnd5eCombatState?.conditions?.includes('poisoned') === true
  }, { timeout: 20_000 }).toBe(true)

  await monsterConditionToggle.click()
  await expect(monsterConditionToggle).toHaveAttribute('aria-pressed', 'false')
  await expect.poll(async () => {
    const response = await request.get(`${DM}/api/state/maps?room=${created.roomId}`, {
      headers: {
        'X-Stars-Member': created.member.memberId,
        'X-Stars-Room-Token': created.member.roomToken,
      },
    })
    if (!response.ok()) return true
    const state = await response.json() as {
      maps?: Array<{
        id: string
        tokens: Array<{ id: string; dnd5eCombatState?: { conditions?: string[] } }>
      }>
    }
    return state.maps
      ?.find((entry) => entry.id === mapId)
      ?.tokens.find((entry) => entry.id === enemyTokenId)
      ?.dnd5eCombatState?.conditions?.includes('poisoned') !== true
  }, { timeout: 20_000 }).toBe(true)
  await enemyPanel.locator('button').first().click()

  await dragMapToken(dm, { x: 350, y: 300 }, { x: 400, y: 300 })
  await dragMapToken(dm, { x: 500, y: 300 }, { x: 550, y: 300 })
  await expect.poll(async () => {
    const response = await request.get(`${DM}/api/state/maps?room=${created.roomId}`, {
      headers: {
        'X-Stars-Member': created.member.memberId,
        'X-Stars-Room-Token': created.member.roomToken,
      },
    })
    if (!response.ok()) return null
    const state = await response.json() as {
      maps?: Array<{ id: string; tokens: Array<{ id: string; x: number; y: number }> }>
    }
    const tokens = state.maps?.find((entry) => entry.id === mapId)?.tokens
    const playerToken = tokens?.find((entry) => entry.id === tokenId)
    const monsterToken = tokens?.find((entry) => entry.id === enemyTokenId)
    return playerToken && monsterToken
      ? {
          player: { x: playerToken.x, y: playerToken.y },
          monster: { x: monsterToken.x, y: monsterToken.y },
        }
      : null
  }, { timeout: 20_000 }).toEqual({
    player: { x: 425, y: 325 },
    monster: { x: 575, y: 325 },
  })

  await dmContext.close()
  await playerContext.close()
})
