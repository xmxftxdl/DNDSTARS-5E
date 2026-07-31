import path from 'node:path'
import { existsSync } from 'node:fs'
import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from '@playwright/test'
import { createDnd5eEffectiveRulesContextV1 } from '../src/rulesets/dnd5e/effectiveRulesContext'

const E2E_PORT_BASE = Math.max(1_024, Number(process.env.STARS_E2E_PORT_BASE) || 6_173)
const DM = `http://127.0.0.1:${E2E_PORT_BASE}`
const PLAYER = `http://127.0.0.1:${E2E_PORT_BASE + 1}`
const SESSION_KEY = 'stars-room-session:v1'
const COLLECTION_DIRECTORY = path.resolve('local-content/phb-2014')
const PLUGIN_ID = 'local.doco.phb-2014-room'
const SUBCLASS_ID = `${PLUGIN_ID}:totem-warrior-2014`
const WEAPON_ID = 'e2e-totem-warrior-greataxe'
const DETERMINISTIC_DICE_SCRIPT = `
  (() => {
    const nativeRandom = Math.random.bind(Math)
    Math.random = () => {
      const stack = new Error().stack || ''
      return stack.includes('randomDieValue') ? 0.75 : nativeRandom()
    }
  })()
`

test.skip(!existsSync(COLLECTION_DIRECTORY), 'private local PHB collection is not present')

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

interface RoomRulesResponse {
  revision: number
  requiredPlugins: Array<{
    id: string
    version: string
    integrity?: string
    stateSchemaVersion?: number
  }>
}

interface SavedCharacter {
  id: string
  dnd5eCombatState?: {
    raging?: boolean
    totemWarriorWolfAttunementTargetIds?: string[]
    totemWarriorWolfAttunementTurnKey?: string
  }
}

interface SavedToken {
  id: string
  hp?: number
  conditions?: string[]
  dnd5eCombatState?: {
    activeEffects?: Array<{
      standardCondition?: string
      legacyCondition?: string
    }>
  }
}

function sessionFrom(response: RoomMembershipResponse) {
  return {
    roomId: response.roomId,
    roomName: response.roomName,
    rulesetId: response.rulesetId,
    createdAt: response.createdAt,
    ...response.member,
  }
}

function barbarian(input: {
  id: string
  roomId: string
  memberId: string
}) {
  const selections = {
    [`${SUBCLASS_ID}/totem-spirit`]: ['eagle'],
    [`${SUBCLASS_ID}/aspect-of-the-beast`]: ['bear'],
    [`${SUBCLASS_ID}/totemic-attunement`]: ['wolf'],
  }
  return {
    rulesetId: 'dnd5e-2014-srd-5.1',
    id: input.id,
    name: '图腾武者验收角色',
    player: '图腾武者玩家',
    roomId: input.roomId,
    roomMemberId: input.memberId,
    avatar: 'TW',
    accent: 'from-amber-500 to-rose-600',
    race: 'human',
    charClass: '野蛮人',
    dnd5eClassId: 'barbarian',
    dnd5eClassLevels: { barbarian: 14 },
    level: 14,
    background: '',
    experience: 0,
    reputation: 0,
    abilities: { str: 20, dex: 14, con: 18, int: 8, wis: 12, cha: 10 },
    savingThrows: ['str', 'con'],
    skills: ['athletics'],
    maxHp: 140,
    currentHp: 140,
    tempHp: 0,
    hitDice: '14d12',
    ac: 16,
    speed: 30,
    initiativeBonus: 2,
    saveDC: 17,
    passivePerception: 11,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    equipment: {
      mainWeapon: {
        id: WEAPON_ID,
        name: '验收巨斧',
        slot: 'mainWeapon',
        dnd5e: {
          kind: 'weapon',
          category: 'martial',
          mode: 'melee',
          damage: { count: 1, sides: 12, type: 'slashing' },
          attackAbility: 'str',
          properties: ['heavy', 'two-handed'],
        },
      },
    },
    dnd5eClassChoices: {
      classes: {
        barbarian: {
          subclass: SUBCLASS_ID,
          selections,
        },
      },
    },
    dnd5ePluginFeatureIds: [],
    classResources: {
      'dnd5e-rage': { current: 5, max: 5 },
    },
    dnd5eCombatState: {
      schemaVersion: 2,
      raging: true,
      rageTurnsRemaining: 10,
      rageSustainedThisTurn: true,
    },
  }
}

function token(input: {
  id: string
  label: string
  x: number
  type: 'player' | 'enemy'
  characterId?: string
  hp?: number
}) {
  return {
    id: input.id,
    label: input.label,
    x: input.x,
    y: 105,
    color: input.type === 'player' ? '#f59e0b' : '#ef4444',
    emoji: input.type === 'player' ? 'TW' : 'E',
    size: 1,
    type: input.type,
    ...(input.type === 'enemy'
      ? { poolId: 'goblin', portraitImageId: 'totem-warrior-e2e-placeholder' }
      : {}),
    ...(input.characterId ? { characterId: input.characterId } : {}),
    ...(input.hp != null ? { hp: input.hp, maxHp: input.hp } : {}),
  }
}

async function putRoomState(
  request: APIRequestContext,
  roomId: string,
  name: string,
  value: unknown,
  member: RoomMembershipResponse['member'],
) {
  const resourceUrl = `${DM}/api/state/${name}?room=${roomId}`
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const current = await request.get(resourceUrl, {
      headers: {
        'X-Stars-Member': member.memberId,
        'X-Stars-Room-Token': member.roomToken,
      },
    })
    const revision = Number(current.headers()['x-stars-state-revision'] ?? 0)
    const response = await request.put(resourceUrl, {
      headers: {
        'X-Stars-Protocol': '5',
        'X-Stars-Expected-Revision': String(Number.isInteger(revision) ? revision : 0),
        'X-Stars-Member': member.memberId,
        'X-Stars-Room-Token': member.roomToken,
      },
      data: value,
    })
    if (response.ok()) return
    if (![409, 412, 428].includes(response.status())) {
      throw new Error(`${name} state write failed (${response.status()}): ${await response.text()}`)
    }
  }
  throw new Error(`${name} state write exhausted CAS retries`)
}

async function getRoomState<T>(
  request: APIRequestContext,
  roomId: string,
  name: string,
  member: RoomMembershipResponse['member'],
): Promise<T> {
  const response = await request.get(`${DM}/api/state/${name}?room=${roomId}`, {
    headers: {
      'X-Stars-Member': member.memberId,
      'X-Stars-Room-Token': member.roomToken,
    },
  })
  expect(response.ok(), `${name} state should be readable`).toBeTruthy()
  return response.json() as Promise<T>
}

async function enterRoom(page: Page, origin: string, membership: RoomMembershipResponse) {
  await page.addInitScript(
    ([key, session]) => localStorage.setItem(key, JSON.stringify(session)),
    [SESSION_KEY, sessionFrom(membership)] as const,
  )
  await page.goto(`${origin}/settings`, { waitUntil: 'domcontentloaded' })
}

async function installFastDiceFrame(context: BrowserContext) {
  await context.route('**/dice-box-frame.html*', (route) => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><script>
      const reply = (payload) => parent.postMessage(payload, location.origin);
      addEventListener('message', (event) => {
        const data = event.data || {};
        if (data.type === 'roll-d20') {
          reply({ type: 'dice-box-d20-result', requestId: data.requestId, value: 12 });
        }
        if (data.type === 'roll-dice') {
          reply({
            type: 'dice-box-roll-result',
            requestId: data.requestId,
            values: Array.from({ length: data.qty || 1 }, () => 4),
          });
        }
      });
      reply({ type: 'dice-box-ready' });
    </script>`,
  }))
}

async function submitPlayerAction(page: Page, action: Record<string, unknown>) {
  await page.evaluate(async (payload) => {
    const [{ publishPlayerActionRequest }, sharedApi] = await Promise.all([
      import('/src/lib/playerActionSync.ts'),
      import('/src/lib/sharedApi.ts'),
    ])
    await publishPlayerActionRequest({
      action: payload as never,
      loadQueue: () => sharedApi.loadSharedResource('player-action-requests'),
      saveQueue: (queue) => sharedApi.saveSharedResource('player-action-requests', queue),
      publishAction: (eventAction) =>
        sharedApi.publishSharedEvent('player-action-player-to-dm', eventAction),
    })
  }, action)
}

async function waitForAcceptedAck(
  request: APIRequestContext,
  room: RoomMembershipResponse,
  actionId: string,
) {
  await expect.poll(async () => {
    const ack = await getRoomState<{ actionId?: string; status?: string; reason?: string } | null>(
      request,
      room.roomId,
      'player-action-ack',
      room.member,
    )
    if (!ack || ack.actionId !== actionId) return null
    return { status: ack.status, reason: ack.reason }
  }, { timeout: 45_000 }).toEqual({ status: 'accepted', reason: undefined })
}

async function seedScenario(input: {
  request: APIRequestContext
  room: RoomMembershipResponse
  player: RoomMembershipResponse
  rules: RoomRulesResponse
  scenarioId: string
  character: ReturnType<typeof barbarian>
}) {
  const now = Date.now()
  const mapId = `totem-warrior-e2e-${input.scenarioId}-${now}`
  const combatId = `${mapId}:combat`
  const heroToken = token({
    id: `${input.scenarioId}-hero-token`,
    label: input.character.name,
    x: 105,
    type: 'player',
    characterId: input.character.id,
  })
  const enemyToken = token({
    id: `${input.scenarioId}-enemy-token`,
    label: '图腾武者验收目标',
    x: 175,
    type: 'enemy',
    hp: 60,
  })
  const tokens = [heroToken, enemyToken]
  await putRoomState(input.request, input.room.roomId, 'characters', {
    characters: [input.character],
    selectedId: input.character.id,
    updatedAt: now,
  }, input.room.member)
  await putRoomState(input.request, input.room.roomId, 'maps', {
    selectedId: mapId,
    updatedAt: now,
    maps: [{
      id: mapId,
      name: `图腾武者 E2E · ${input.scenarioId}`,
      width: 700,
      height: 420,
      gridSize: 70,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      builtinGridDetected: false,
      feetPerCell: 5,
      gridColor: '#f59e0b',
      gridOpacity: 0.28,
      showCoordinates: true,
      snapMonstersToGrid: true,
      tokens,
    }],
  }, input.room.member)
  await putRoomState(input.request, input.room.roomId, 'map-geometry', {
    schemaVersion: 2,
    updatedAt: now,
    maps: [{
      mapId,
      walls: [],
      doors: [],
      windows: [],
      lights: [],
      obstacles: [],
      vision: {
        enabled: false,
        defaultRangeFeet: 60,
        sharePartyVision: true,
        ambientLight: 'bright',
      },
      updatedAt: now,
    }],
  }, input.room.member)
  for (const [name, value] of [
    ['combat-log', { mapId, entries: [], updatedAt: now }],
    ['dice-events', { mapId, events: [], updatedAt: now }],
    ['combat-interrupts', { mapId, interrupts: [], updatedAt: now }],
  ] as const) {
    await putRoomState(input.request, input.room.roomId, name, value, input.room.member)
  }
  await putRoomState(input.request, input.room.roomId, 'player-action-requests', {
    mapId,
    combatId,
    requests: [],
    updatedAt: now,
  }, input.player.member)
  await putRoomState(input.request, input.room.roomId, 'player-action-processed', {
    mapId,
    combatId,
    actionIds: [],
    updatedAt: now,
  }, input.room.member)
  await putRoomState(input.request, input.room.roomId, 'player-action-ack', {
    id: `${mapId}:no-ack`,
    mapId,
    combatId,
    actionId: 'none',
    status: 'accepted',
    round: 1,
    initiativeIndex: 0,
    updatedAt: now,
  }, input.room.member)
  await putRoomState(input.request, input.room.roomId, 'combat', {
    mapId,
    combatId,
    active: true,
    round: 1,
    initiativeIndex: 0,
    initiativeOrder: tokens.map((candidate, index) => ({
      slotId: `${candidate.id}:normal`,
      tokenId: candidate.id,
      label: candidate.label,
      emoji: candidate.emoji,
      color: candidate.color,
      roll: 20 - index,
    })),
    settlementMode: 'automatic',
    dnd5eTurnEconomyByToken: {},
    effectiveRules: createDnd5eEffectiveRulesContextV1({
      revision: input.rules.revision,
      requiredPlugins: input.rules.requiredPlugins,
    }),
    updatedAt: now,
  }, input.room.member)
  return { mapId, combatId, heroToken, enemyToken }
}

async function openScenario(dm: Page, player: Page, actorTokenId: string) {
  await Promise.all([
    dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' }),
    player.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' }),
  ])
  await Promise.all([
    expect(dm.getByTestId(`initiative-token-${actorTokenId}`)).toBeVisible({ timeout: 25_000 }),
    expect(player.getByTestId(`initiative-token-${actorTokenId}`)).toBeVisible({ timeout: 25_000 }),
    expect(dm.getByTestId('map-canvas')).toBeVisible({ timeout: 25_000 }),
    expect(player.getByTestId('map-canvas')).toBeVisible({ timeout: 25_000 }),
  ])
}

function playerAction(input: {
  mapId: string
  combatId: string
  memberId: string
  actorTokenId: string
  characterId: string
  seq: number
  type: 'dnd5e-class-feature' | 'dnd5e-weapon-attack'
  targetTokenId?: string
  payload: Record<string, unknown>
}) {
  const now = Date.now()
  return {
    id: `${input.mapId}:totem-warrior-action:${input.seq}:${now}`,
    mapId: input.mapId,
    combatId: input.combatId,
    roomMemberId: input.memberId,
    sourceMode: 'player',
    status: 'pending',
    type: input.type,
    actorTokenId: input.actorTokenId,
    characterId: input.characterId,
    ...(input.targetTokenId ? { targetTokenId: input.targetTokenId } : {}),
    ...input.payload,
    round: 1,
    initiativeIndex: 0,
    seq: input.seq,
    updatedAt: now,
  }
}

async function continueAfterCoverPreview(dm: Page) {
  await expect(dm.getByText('掩护预览', { exact: true })).toBeVisible({ timeout: 20_000 })
  await dm.getByRole('button', { name: '应用并继续结算' }).click()
}

async function clientToken(page: Page, mapId: string, tokenId: string): Promise<SavedToken | null> {
  return page.evaluate(async ({ mapId: requestedMapId, tokenId: requestedTokenId }) => {
    const { useMapStore } = await import('/src/store/maps.ts')
    return useMapStore.getState().maps
      .find((map) => map.id === requestedMapId)
      ?.tokens.find((candidate) => candidate.id === requestedTokenId) ?? null
  }, { mapId, tokenId }) as Promise<SavedToken | null>
}

test('本地图腾武者合集在真实 Host/玩家房间完成鹰疾走与狼命中后击倒', async ({
  browser,
  request,
}) => {
  test.setTimeout(240_000)

  const createdResponse = await request.post(`${DM}/api/rooms`, {
    data: {
      roomName: 'Totem Warrior Multi-client E2E',
      displayName: '图腾武者 E2E DM',
      rulesetId: 'dnd5e-2014-srd-5.1',
      clientId: `totem-warrior-e2e-dm-${Date.now()}`,
      activePlugins: [],
    },
  })
  expect(createdResponse.ok()).toBeTruthy()
  const created = await createdResponse.json() as RoomMembershipResponse
  const playerResponse = await request.post(`${DM}/api/rooms/${created.roomId}/join`, {
    data: {
      displayName: '图腾武者玩家',
      clientId: `totem-warrior-e2e-player-${Date.now()}`,
      activePlugins: [],
    },
  })
  expect(playerResponse.ok()).toBeTruthy()
  const joined = await playerResponse.json() as RoomMembershipResponse

  const dmContext = await browser.newContext()
  const playerContext = await browser.newContext()
  await Promise.all([
    dmContext.addInitScript({ content: DETERMINISTIC_DICE_SCRIPT }),
    playerContext.addInitScript({ content: DETERMINISTIC_DICE_SCRIPT }),
    installFastDiceFrame(dmContext),
    installFastDiceFrame(playerContext),
  ])
  const dm = await dmContext.newPage()
  const player = await playerContext.newPage()
  dm.on('dialog', (dialog) => void dialog.accept())

  try {
    await Promise.all([
      enterRoom(dm, DM, created),
      enterRoom(player, PLAYER, joined),
    ])
    await dm.locator('input[type="file"][webkitdirectory]').setInputFiles(COLLECTION_DIRECTORY)
    await expect.poll(async () => {
      const response = await request.get(`${DM}/api/rooms/${created.roomId}/rules`, {
        headers: {
          'X-Stars-Member': created.member.memberId,
          'X-Stars-Room-Token': created.member.roomToken,
        },
      })
      if (!response.ok()) return []
      const rules = await response.json() as RoomRulesResponse
      return rules.requiredPlugins.map((requirement) => requirement.id)
    }, { timeout: 30_000 }).toEqual([PLUGIN_ID])
    await expect(player.getByTestId('room-rules-status')).toContainText('本机已就绪', {
      timeout: 30_000,
    })

    const rulesResponse = await request.get(`${DM}/api/rooms/${created.roomId}/rules`, {
      headers: {
        'X-Stars-Member': created.member.memberId,
        'X-Stars-Room-Token': created.member.roomToken,
      },
    })
    expect(rulesResponse.ok()).toBeTruthy()
    const rules = await rulesResponse.json() as RoomRulesResponse

    const dashHero = barbarian({
      id: 'totem-warrior-dash',
      roomId: created.roomId,
      memberId: joined.member.memberId,
    })
    const dashScenario = await seedScenario({
      request,
      room: created,
      player: joined,
      rules,
      scenarioId: 'eagle-dash',
      character: dashHero,
    })
    await openScenario(dm, player, dashScenario.heroToken.id)
    await expect(player.getByRole('button', { name: '鹰图腾疾走' }))
      .toBeVisible({ timeout: 20_000 })

    const dash = playerAction({
      ...dashScenario,
      memberId: joined.member.memberId,
      actorTokenId: dashScenario.heroToken.id,
      characterId: dashHero.id,
      type: 'dnd5e-class-feature',
      seq: 1,
      payload: {
        dnd5eClassFeature: {
          feature: 'barbarian-totem-eagle-dash',
        },
      },
    })
    await submitPlayerAction(player, dash)
    await waitForAcceptedAck(request, created, dash.id)
    await expect.poll(async () => {
      const combat = await getRoomState<{
        dnd5eTurnEconomyByToken?: Record<string, {
          bonusAction?: { current: number }
          movement?: { current: number }
        }>
      }>(request, created.roomId, 'combat', created.member)
      return combat.dnd5eTurnEconomyByToken?.[dashScenario.heroToken.id]
    }).toMatchObject({
      bonusAction: { current: 0 },
      movement: { current: 80 },
    })

    const wolfHero = barbarian({
      id: 'totem-warrior-wolf',
      roomId: created.roomId,
      memberId: joined.member.memberId,
    })
    const wolfScenario = await seedScenario({
      request,
      room: created,
      player: joined,
      rules,
      scenarioId: 'wolf-knockdown',
      character: wolfHero,
    })
    await openScenario(dm, player, wolfScenario.heroToken.id)
    await expect(player.getByRole('button', { name: '狼图腾击倒' })).toHaveCount(0)

    const attack = playerAction({
      ...wolfScenario,
      memberId: joined.member.memberId,
      actorTokenId: wolfScenario.heroToken.id,
      characterId: wolfHero.id,
      targetTokenId: wolfScenario.enemyToken.id,
      type: 'dnd5e-weapon-attack',
      seq: 2,
      payload: {},
    })
    await submitPlayerAction(player, attack)
    await continueAfterCoverPreview(dm)
    await waitForAcceptedAck(request, created, attack.id)
    await expect.poll(async () => {
      const characters = await getRoomState<{ characters: SavedCharacter[] }>(
        request,
        created.roomId,
        'characters',
        created.member,
      )
      return characters.characters.find((candidate) => candidate.id === wolfHero.id)
        ?.dnd5eCombatState?.totemWarriorWolfAttunementTargetIds
    }).toEqual([wolfScenario.enemyToken.id])
    await expect(player.getByRole('button', { name: '狼图腾击倒' }))
      .toBeVisible({ timeout: 20_000 })

    const knockdown = playerAction({
      ...wolfScenario,
      memberId: joined.member.memberId,
      actorTokenId: wolfScenario.heroToken.id,
      characterId: wolfHero.id,
      targetTokenId: wolfScenario.enemyToken.id,
      type: 'dnd5e-class-feature',
      seq: 3,
      payload: {
        dnd5eClassFeature: {
          feature: 'barbarian-totem-wolf-knockdown',
          targetTokenId: wolfScenario.enemyToken.id,
        },
      },
    })
    await submitPlayerAction(player, knockdown)
    await waitForAcceptedAck(request, created, knockdown.id)
    await expect.poll(async () => {
      const maps = await getRoomState<{
        maps: Array<{ id: string; tokens: SavedToken[] }>
      }>(request, created.roomId, 'maps', created.member)
      const target = maps.maps.find((map) => map.id === wolfScenario.mapId)?.tokens
        .find((candidate) => candidate.id === wolfScenario.enemyToken.id)
      return {
        condition: target?.conditions?.includes('prone') ||
          target?.dnd5eCombatState?.activeEffects?.some((effect) =>
            effect.standardCondition === 'prone' || effect.legacyCondition === 'prone',
          ),
      }
    }).toEqual({ condition: true })
    await expect.poll(async () => {
      const target = await clientToken(player, wolfScenario.mapId, wolfScenario.enemyToken.id)
      return target?.conditions?.includes('prone') ||
        target?.dnd5eCombatState?.activeEffects?.some((effect) =>
          effect.standardCondition === 'prone' || effect.legacyCondition === 'prone',
        )
    }).toBe(true)
    await expect(player.getByRole('button', { name: '狼图腾击倒' })).toHaveCount(0)
  } finally {
    await Promise.all([dmContext.close(), playerContext.close()])
  }
})
