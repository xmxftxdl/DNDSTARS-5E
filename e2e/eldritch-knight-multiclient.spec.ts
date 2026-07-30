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
const SUBCLASS_ID = `${PLUGIN_ID}:eldritch-knight-2014`
const WEAPON_ID = 'e2e-eldritch-knight-longsword'
const ACTION_SURGE_RESOURCE = 'fighterActionSurge'

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

interface RoomPluginRequirement {
  id: string
  version: string
  integrity?: string
  stateSchemaVersion?: number
}

interface RoomRulesResponse {
  revision: number
  requiredPlugins: RoomPluginRequirement[]
}

interface SavedCharacter {
  id: string
  classResources?: Record<string, { current: number; max: number }>
  dnd5eCombatState?: {
    battleMasterDroppedWeaponIds?: string[]
    eldritchKnightBondedWeaponIds?: string[]
    eldritchKnightWarMagicCantripTurnKey?: string
    eldritchKnightWarMagicTurnKey?: string
    eldritchKnightArcaneChargeTurnKey?: string
    eldritchKnightArcaneChargeUsedTurnKey?: string
  }
}

interface SavedToken {
  id: string
  x: number
  y: number
  hp?: number
  dnd5eCombatState?: {
    eldritchStrikeBySource?: Record<string, {
      appliedTurnKey: string
      sourceTurnsRemaining: number
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

function longsword() {
  return {
    id: WEAPON_ID,
    name: '验收长剑',
    slot: 'mainWeapon',
    dnd5e: {
      kind: 'weapon',
      category: 'martial',
      mode: 'melee',
      damage: { count: 1, sides: 8, type: 'slashing' },
      attackAbility: 'str',
      properties: [],
    },
  }
}

function eldritchKnight(input: {
  id: string
  roomId: string
  memberId: string
  level?: number
  droppedWeapon?: boolean
}) {
  const level = input.level ?? 18
  const cantripSelectionKey = `${SUBCLASS_ID}/spell-cantrips`
  const spellSelectionKey = `${SUBCLASS_ID}/spell-known`
  const selections = {
    [cantripSelectionKey]: ['acid-splash', 'fire-bolt'],
    [spellSelectionKey]: ['shield', 'magic-missile', 'burning-hands'],
  }
  return {
    rulesetId: 'dnd5e-2014-srd-5.1',
    id: input.id,
    name: '奥法骑士验收角色',
    player: '奥法骑士玩家',
    roomId: input.roomId,
    roomMemberId: input.memberId,
    avatar: 'EK',
    accent: 'from-cyan-500 to-violet-600',
    race: '人类',
    charClass: '战士',
    dnd5eClassId: 'fighter',
    dnd5eClassLevels: { fighter: level },
    level,
    background: '士兵',
    experience: 0,
    reputation: 0,
    abilities: { str: 20, dex: 14, con: 16, int: 18, wis: 10, cha: 8 },
    savingThrows: ['str', 'con'],
    skills: ['athletics', 'arcana'],
    maxHp: 140,
    currentHp: 140,
    tempHp: 0,
    hitDice: `${level}d10`,
    ac: 18,
    speed: 30,
    initiativeBonus: 2,
    saveDC: 18,
    passivePerception: 10,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    equipment: { mainWeapon: longsword() },
    dnd5eClassChoices: {
      fighter: {
        subclass: SUBCLASS_ID,
        fightingStyles: [],
        extensionChoices: selections,
      },
      classes: {
        fighter: {
          subclass: SUBCLASS_ID,
          selections,
        },
      },
    },
    classResources: {
      [ACTION_SURGE_RESOURCE]: { current: 1, max: level >= 17 ? 2 : 1 },
    },
    dnd5eCombatState: {
      eldritchKnightBondedWeaponIds: [WEAPON_ID],
      ...(input.droppedWeapon ? { battleMasterDroppedWeaponIds: [WEAPON_ID] } : {}),
    },
  }
}

function token(input: {
  id: string
  label: string
  x: number
  y: number
  type: 'player' | 'enemy'
  characterId?: string
  hp?: number
}) {
  return {
    id: input.id,
    label: input.label,
    x: input.x,
    y: input.y,
    color: input.type === 'player' ? '#06b6d4' : '#ef4444',
    emoji: input.type === 'player' ? 'EK' : 'E',
    size: 1,
    type: input.type,
    ...(input.type === 'enemy'
      ? { poolId: 'goblin', portraitImageId: 'eldritch-knight-e2e-placeholder' }
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
  let lastStatus = 0
  let lastBody = ''
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
    lastStatus = response.status()
    lastBody = await response.text()
    if (![409, 412, 428].includes(lastStatus)) break
  }
  throw new Error(`${name} CAS write failed (${lastStatus}): ${lastBody}`)
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
          reply({ type: 'dice-box-d20-result', requestId: data.requestId, value: 15 });
        }
        if (data.type === 'roll-dice') {
          const values = Array.from({ length: data.qty || 1 }, () => 4);
          reply({ type: 'dice-box-roll-result', requestId: data.requestId, values });
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
  characters: unknown[]
  tokens: unknown[]
  actorTokenId: string
}) {
  const now = Date.now()
  const mapId = `eldritch-knight-e2e-${input.scenarioId}-${now}`
  const combatId = `${mapId}:combat`
  await putRoomState(input.request, input.room.roomId, 'characters', {
    characters: input.characters,
    selectedId: (input.characters[0] as { id: string }).id,
    updatedAt: now,
  }, input.room.member)
  await putRoomState(input.request, input.room.roomId, 'maps', {
    selectedId: mapId,
    updatedAt: now,
    maps: [{
      id: mapId,
      name: `奥法骑士 E2E · ${input.scenarioId}`,
      width: 700,
      height: 420,
      gridSize: 70,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      builtinGridDetected: false,
      feetPerCell: 5,
      gridColor: '#67e8f9',
      gridOpacity: 0.28,
      showCoordinates: true,
      snapMonstersToGrid: true,
      tokens: input.tokens,
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
  await putRoomState(input.request, input.room.roomId, 'combat-log', {
    mapId,
    entries: [],
    updatedAt: now,
  }, input.room.member)
  await putRoomState(input.request, input.room.roomId, 'dice-events', {
    mapId,
    events: [],
    updatedAt: now,
  }, input.room.member)
  await putRoomState(input.request, input.room.roomId, 'combat-interrupts', {
    mapId,
    interrupts: [],
    updatedAt: now,
  }, input.room.member)
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
  const initiativeOrder = (input.tokens as Array<{
    id: string
    label: string
    emoji: string
    color: string
  }>).map((candidate, index) => ({
    slotId: `${candidate.id}:normal`,
    tokenId: candidate.id,
    label: candidate.label,
    emoji: candidate.emoji,
    color: candidate.color,
    roll: 30 - index,
  }))
  const actorIndex = initiativeOrder.findIndex((candidate) => candidate.tokenId === input.actorTokenId)
  if (actorIndex > 0) {
    const [actor] = initiativeOrder.splice(actorIndex, 1)
    initiativeOrder.unshift(actor)
  }
  await putRoomState(input.request, input.room.roomId, 'combat', {
    mapId,
    combatId,
    active: true,
    round: 1,
    initiativeIndex: 0,
    initiativeOrder,
    settlementMode: 'automatic',
    dnd5eTurnEconomyByToken: {},
    effectiveRules: createDnd5eEffectiveRulesContextV1({
      revision: input.rules.revision,
      requiredPlugins: input.rules.requiredPlugins,
    }),
    updatedAt: now,
  }, input.room.member)
  return { mapId, combatId }
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
  type: 'dnd5e-spell-cast' | 'dnd5e-fighter-feature' | 'dnd5e-class-feature' | 'dnd5e-weapon-attack'
  targetTokenId?: string
  payload: Record<string, unknown>
}) {
  const now = Date.now()
  return {
    id: `${input.mapId}:eldritch-knight-action:${input.seq}:${now}`,
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

test('本地奥法骑士合集在真实 Host/玩家房间完成施法、战争魔法、奥法打击、奥术冲锋与武器召回', async ({
  browser,
  request,
}) => {
  test.setTimeout(300_000)

  const createdResponse = await request.post(`${DM}/api/rooms`, {
    data: {
      roomName: 'Eldritch Knight Multi-client E2E',
      displayName: '奥法骑士 E2E DM',
      rulesetId: 'dnd5e-2014-srd-5.1',
      clientId: `eldritch-knight-e2e-dm-${Date.now()}`,
      activePlugins: [],
    },
  })
  expect(createdResponse.ok()).toBeTruthy()
  const created = await createdResponse.json() as RoomMembershipResponse
  const playerResponse = await request.post(`${DM}/api/rooms/${created.roomId}/join`, {
    data: {
      displayName: '奥法骑士玩家',
      clientId: `eldritch-knight-e2e-player-${Date.now()}`,
      activePlugins: [],
    },
  })
  expect(playerResponse.ok()).toBeTruthy()
  const joined = await playerResponse.json() as RoomMembershipResponse

  const dmContext = await browser.newContext()
  const playerContext = await browser.newContext()
  await Promise.all([
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
    await expect(dm.getByText(
      `已临时导入 ${PLUGIN_ID}；原始 JSON/CSV、提示词和规则正文未传输，关闭房间后需重新导入。`,
    )).toBeVisible({ timeout: 30_000 })
    await Promise.all([
      expect(player.getByTestId('room-rules-status').getByText('本机已就绪')).toBeVisible({ timeout: 30_000 }),
      expect(player.getByRole('heading', { name: '本地 PHB 2014 房间合集' })).toBeVisible({ timeout: 30_000 }),
    ])

    const rulesResponse = await request.get(`${DM}/api/rooms/${created.roomId}/rules`, {
      headers: {
        'X-Stars-Member': created.member.memberId,
        'X-Stars-Room-Token': created.member.roomToken,
      },
    })
    expect(rulesResponse.ok()).toBeTruthy()
    const rules = await rulesResponse.json() as RoomRulesResponse
    expect(rules.requiredPlugins.map((requirement) => requirement.id)).toEqual([PLUGIN_ID])

    const hero = eldritchKnight({
      id: 'eldritch-knight',
      roomId: created.roomId,
      memberId: joined.member.memberId,
    })
    const heroToken = token({
      id: 'eldritch-knight-token',
      label: hero.name,
      x: 105,
      y: 105,
      type: 'player',
      characterId: hero.id,
    })
    const enemyToken = token({
      id: 'eldritch-knight-target',
      label: '奥法骑士验收目标',
      x: 525,
      y: 105,
      type: 'enemy',
      hp: 100,
    })
    const battlefield = await seedScenario({
      request,
      room: created,
      player: joined,
      rules,
      scenarioId: 'full-flow',
      characters: [hero],
      tokens: [heroToken, enemyToken],
      actorTokenId: heroToken.id,
    })
    await openScenario(dm, player, heroToken.id)

    const firstCantrip = playerAction({
      ...battlefield,
      memberId: joined.member.memberId,
      actorTokenId: heroToken.id,
      characterId: hero.id,
      targetTokenId: enemyToken.id,
      type: 'dnd5e-spell-cast',
      seq: 1,
      payload: {
        dnd5eSpellCast: {
          spellId: 'acid-splash',
          castingClassId: 'fighter',
          slotLevel: 0,
          targetTokenId: enemyToken.id,
        },
      },
    })
    await submitPlayerAction(player, firstCantrip)
    await waitForAcceptedAck(request, created, firstCantrip.id)
    const afterFirstSpell = await getRoomState<{
      characters: SavedCharacter[]
    }>(request, created.roomId, 'characters', created.member)
    expect(afterFirstSpell.characters[0].dnd5eCombatState?.eldritchKnightWarMagicTurnKey)
      .toBeTruthy()
    const afterFirstSpellMaps = await getRoomState<{
      maps: Array<{ id: string; tokens: SavedToken[] }>
    }>(request, created.roomId, 'maps', created.member)
    const hpAfterFirstSpell = afterFirstSpellMaps.maps
      .find((map) => map.id === battlefield.mapId)?.tokens
      .find((candidate) => candidate.id === enemyToken.id)?.hp
    expect(hpAfterFirstSpell).toBeLessThan(100)
    await expect(player.getByRole('button', {
      name: /战争魔法：附赠动作武器攻击/,
    })).toBeVisible({ timeout: 20_000 })

    const actionSurge = playerAction({
      ...battlefield,
      memberId: joined.member.memberId,
      actorTokenId: heroToken.id,
      characterId: hero.id,
      type: 'dnd5e-fighter-feature',
      seq: 2,
      payload: { dnd5eFighterFeature: 'action-surge' },
    })
    await submitPlayerAction(player, actionSurge)
    await waitForAcceptedAck(request, created, actionSurge.id)
    await expect.poll(async () => {
      const state = await getRoomState<{ characters: SavedCharacter[] }>(
        request,
        created.roomId,
        'characters',
        created.member,
      )
      const saved = state.characters.find((candidate) => candidate.id === hero.id)
      return {
        actionSurge: saved?.classResources?.[ACTION_SURGE_RESOURCE]?.current,
        arcaneCharge: !!saved?.dnd5eCombatState?.eldritchKnightArcaneChargeTurnKey,
      }
    }).toEqual({ actionSurge: 0, arcaneCharge: true })
    await player.getByRole('button', { name: '下一页职业特性' }).click()
    await expect(player.getByRole('button', { name: /奥术冲锋/ }))
      .toBeVisible({ timeout: 20_000 })

    const arcaneCharge = playerAction({
      ...battlefield,
      memberId: joined.member.memberId,
      actorTokenId: heroToken.id,
      characterId: hero.id,
      type: 'dnd5e-class-feature',
      seq: 3,
      payload: {
        dnd5eClassFeature: {
          feature: 'eldritch-knight-arcane-charge',
          targetCell: { col: 6, row: 1 },
        },
      },
    })
    await submitPlayerAction(player, arcaneCharge)
    await waitForAcceptedAck(request, created, arcaneCharge.id)
    await expect.poll(async () => {
      const maps = await getRoomState<{
        maps: Array<{ id: string; tokens: SavedToken[] }>
      }>(request, created.roomId, 'maps', created.member)
      const moved = maps.maps.find((map) => map.id === battlefield.mapId)?.tokens
        .find((candidate) => candidate.id === heroToken.id)
      return moved ? { x: moved.x, y: moved.y } : null
    }).toEqual({ x: 455, y: 105 })
    await expect.poll(async () => {
      const moved = await clientToken(player, battlefield.mapId, heroToken.id)
      return moved ? { x: moved.x, y: moved.y } : null
    }).toEqual({ x: 455, y: 105 })
    await expect(player.getByRole('button', { name: /奥术冲锋/ })).toHaveCount(0)

    const warMagicAttack = playerAction({
      ...battlefield,
      memberId: joined.member.memberId,
      actorTokenId: heroToken.id,
      characterId: hero.id,
      targetTokenId: enemyToken.id,
      type: 'dnd5e-weapon-attack',
      seq: 4,
      payload: {
        dnd5eWeaponAttackOptions: {
          eldritchKnightWarMagicAttack: true,
        },
      },
    })
    await submitPlayerAction(player, warMagicAttack)
    await continueAfterCoverPreview(dm)
    await waitForAcceptedAck(request, created, warMagicAttack.id)
    await expect.poll(async () => {
      const maps = await getRoomState<{
        maps: Array<{ id: string; tokens: SavedToken[] }>
      }>(request, created.roomId, 'maps', created.member)
      return maps.maps.find((map) => map.id === battlefield.mapId)?.tokens
        .find((candidate) => candidate.id === enemyToken.id)
    }).toMatchObject({
      hp: expect.any(Number),
      dnd5eCombatState: {
        eldritchStrikeBySource: {
          [heroToken.id]: expect.objectContaining({
            appliedTurnKey: expect.any(String),
          }),
        },
      },
    })
    const afterAttackMaps = await getRoomState<{
      maps: Array<{ id: string; tokens: SavedToken[] }>
    }>(request, created.roomId, 'maps', created.member)
    const hpAfterWarMagic = afterAttackMaps.maps
      .find((map) => map.id === battlefield.mapId)?.tokens
      .find((candidate) => candidate.id === enemyToken.id)?.hp
    expect(hpAfterWarMagic).toBeLessThan(hpAfterFirstSpell ?? 100)
    await expect(player.getByRole('button', {
      name: /战争魔法：附赠动作武器攻击/,
    })).toHaveCount(0)

    const strikeSave = playerAction({
      ...battlefield,
      memberId: joined.member.memberId,
      actorTokenId: heroToken.id,
      characterId: hero.id,
      targetTokenId: enemyToken.id,
      type: 'dnd5e-spell-cast',
      seq: 5,
      payload: {
        dnd5eSpellCast: {
          spellId: 'acid-splash',
          castingClassId: 'fighter',
          slotLevel: 0,
          targetTokenId: enemyToken.id,
        },
      },
    })
    await submitPlayerAction(player, strikeSave)
    await waitForAcceptedAck(request, created, strikeSave.id)
    await expect.poll(async () => {
      const maps = await getRoomState<{
        maps: Array<{ id: string; tokens: SavedToken[] }>
      }>(request, created.roomId, 'maps', created.member)
      const target = maps.maps.find((map) => map.id === battlefield.mapId)?.tokens
        .find((candidate) => candidate.id === enemyToken.id)
      return {
        hp: target?.hp,
        strike: target?.dnd5eCombatState?.eldritchStrikeBySource?.[heroToken.id],
      }
    }).toEqual({
      hp: expect.any(Number),
      strike: undefined,
    })

    const summoner = eldritchKnight({
      id: 'eldritch-knight-summoner',
      roomId: created.roomId,
      memberId: joined.member.memberId,
      level: 3,
      droppedWeapon: true,
    })
    const summonerToken = token({
      id: 'eldritch-knight-summoner-token',
      label: summoner.name,
      x: 105,
      y: 105,
      type: 'player',
      characterId: summoner.id,
    })
    const summonTarget = token({
      id: 'eldritch-knight-summon-target',
      label: '武器召回旁观目标',
      x: 175,
      y: 105,
      type: 'enemy',
      hp: 30,
    })
    const summonBattlefield = await seedScenario({
      request,
      room: created,
      player: joined,
      rules,
      scenarioId: 'weapon-bond',
      characters: [summoner],
      tokens: [summonerToken, summonTarget],
      actorTokenId: summonerToken.id,
    })
    await openScenario(dm, player, summonerToken.id)
    await expect(player.getByRole('button', { name: /召回联结武器/ }))
      .toBeVisible({ timeout: 20_000 })

    const summon = playerAction({
      ...summonBattlefield,
      memberId: joined.member.memberId,
      actorTokenId: summonerToken.id,
      characterId: summoner.id,
      type: 'dnd5e-class-feature',
      seq: 6,
      payload: {
        dnd5eClassFeature: {
          feature: 'eldritch-knight-summon-bonded-weapon',
          weaponId: WEAPON_ID,
        },
      },
    })
    await submitPlayerAction(player, summon)
    await waitForAcceptedAck(request, created, summon.id)
    await expect.poll(async () => {
      const state = await getRoomState<{ characters: SavedCharacter[] }>(
        request,
        created.roomId,
        'characters',
        created.member,
      )
      return state.characters.find((candidate) => candidate.id === summoner.id)
        ?.dnd5eCombatState?.battleMasterDroppedWeaponIds
    }).toBeUndefined()
    const log = await getRoomState<{
      entries: Array<{ text?: string; message?: string }>
    }>(request, created.roomId, 'combat-log', created.member)
    expect(log.entries.some((entry) =>
      `${entry.text ?? ''}${entry.message ?? ''}`.includes('召回联结武器'),
    )).toBe(true)
  } finally {
    await Promise.all([dmContext.close(), playerContext.close()])
  }
})
