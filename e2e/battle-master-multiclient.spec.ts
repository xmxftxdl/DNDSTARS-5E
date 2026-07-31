import path from 'node:path'
import { existsSync } from 'node:fs'
import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test'
import { createDnd5eEffectiveRulesContextV1 } from '../src/rulesets/dnd5e/effectiveRulesContext'

const DM = 'http://127.0.0.1:6173'
const PLAYER = 'http://127.0.0.1:6174'
const PLAYER2 = 'http://127.0.0.1:6175'
const SESSION_KEY = 'stars-room-session:v1'
const COLLECTION_DIRECTORY = path.resolve('local-content/phb-2014')
const PLUGIN_ID = 'local.doco.phb-2014-room'
const SUBCLASS_ID = `${PLUGIN_ID}:battle-master-2014`
const RESOURCE_ID = `${PLUGIN_ID}:superiority-dice`
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
    id: 'e2e-battle-master-longsword',
    name: 'E2E 长剑',
    slot: 'mainWeapon',
    dnd5e: {
      kind: 'weapon',
      category: 'martial',
      mode: 'melee',
      damage: { count: 1, sides: 8, type: 'slashing' },
      attackAbility: 'str',
      properties: ['多才多艺（1d10）'],
    },
  }
}

function character(input: {
  id: string
  name: string
  roomId: string
  memberId: string
  battleMasterManeuvers?: string[]
  abilities?: { str: number; dex: number; con: number; int: number; wis: number; cha: number }
  armorClass?: number
}) {
  const maneuvers = input.battleMasterManeuvers ?? []
  const selectionKey = `${SUBCLASS_ID}/maneuvers`
  return {
    rulesetId: 'dnd5e-2014-srd-5.1',
    id: input.id,
    name: input.name,
    player: input.name,
    roomId: input.roomId,
    roomMemberId: input.memberId,
    avatar: '🛡️',
    accent: 'from-violet-500 to-indigo-600',
    race: '人类',
    charClass: '战士',
    dnd5eClassId: 'fighter',
    level: maneuvers.length > 0 ? 15 : 5,
    background: '士兵',
    experience: 0,
    reputation: 0,
    abilities: input.abilities ?? { str: 20, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
    savingThrows: ['str', 'con'],
    skills: ['athletics'],
    maxHp: 50,
    currentHp: 50,
    tempHp: 0,
    hitDice: '15d10',
    ac: input.armorClass ?? 12,
    speed: 30,
    initiativeBonus: 0,
    saveDC: 12,
    passivePerception: 10,
    inspiration: 0,
    equipment: {
      mainWeapon: longsword(),
      ...(input.armorClass != null
        ? {
            armor: {
              id: `${input.id}-e2e-armor`,
              name: 'E2E 固定护甲',
              slot: 'armor',
              ac: input.armorClass,
              dnd5e: {
                kind: 'armor',
                category: 'heavy',
                baseArmorClass: input.armorClass,
                dexterityBonus: 'none',
                material: 'metal',
              },
            },
          }
        : {}),
    },
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    dnd5ePluginFeatureIds: [],
    ...(maneuvers.length > 0
      ? {
          dnd5eClassChoices: {
            fighter: {
              subclass: SUBCLASS_ID,
              extensionChoices: { [selectionKey]: maneuvers },
            },
            classes: {
              fighter: {
                subclass: SUBCLASS_ID,
                selections: { [selectionKey]: maneuvers },
              },
            },
          },
          classResources: {
            [RESOURCE_ID]: { current: 6, max: 6 },
          },
        }
      : {}),
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
    color: input.type === 'player' ? '#8b5cf6' : '#ef4444',
    emoji: input.type === 'player' ? '🛡️' : '👺',
    size: 1,
    type: input.type,
    ...(input.type === 'enemy'
      ? { poolId: 'goblin', portraitImageId: 'battle-master-e2e-placeholder' }
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
  await page.goto(`${origin}/settings`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(
    ([key, session]) => localStorage.setItem(key, JSON.stringify(session)),
    [SESSION_KEY, sessionFrom(membership)] as const,
  )
  await page.reload({ waitUntil: 'domcontentloaded' })
}

async function installFastDiceFrame(context: BrowserContext) {
  await context.route('**/dice-box-frame.html*', (route) => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><script>
      const reply = (payload) => parent.postMessage(payload, location.origin);
      addEventListener('message', (event) => {
        const data = event.data || {};
        if (data.type === 'roll-d20') {
          reply({ type: 'dice-box-d20-result', requestId: data.requestId, value: data.value || 1 });
        }
        if (data.type === 'roll-dice') {
          const values = Array.isArray(data.values) && data.values.length
            ? data.values
            : Array.from({ length: data.qty || 1 }, () => 1);
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

async function waitForChoiceOrReportAuthority(input: {
  choice: Locator
  request: APIRequestContext
  room: RoomMembershipResponse
  actionId: string
  timeout?: number
}) {
  await expect.poll(async () => {
    if (await input.choice.count() > 0) return 'prompt-visible'
    const ack = await getRoomState<{ actionId?: string; status?: string; reason?: string } | null>(
      input.request,
      input.room.roomId,
      'player-action-ack',
      input.room.member,
    )
    if (ack?.actionId === input.actionId) {
      return `ack:${ack.status ?? 'unknown'}:${ack.reason ?? 'none'}`
    }
    const queue = await getRoomState<{
      interrupts?: Array<{
        id?: string
        kind?: string
        status?: string
        payload?: { audience?: string; targetCharId?: string }
      }>
    } | null>(
      input.request,
      input.room.roomId,
      'combat-interrupts',
      input.room.member,
    )
    const pending = queue?.interrupts?.map((interrupt) =>
      `${interrupt.kind ?? 'unknown'}/${interrupt.status ?? 'unknown'}/${interrupt.payload?.audience ?? 'unknown'}/${interrupt.payload?.targetCharId ?? 'none'}`,
    ).join(',') ?? 'none'
    return `waiting:${pending}`
  }, { timeout: input.timeout ?? 30_000 }).toBe('prompt-visible')
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
  const mapId = `battle-master-e2e-${input.scenarioId}-${now}`
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
      name: `Battle Master E2E · ${input.scenarioId}`,
      width: 560,
      height: 420,
      gridSize: 70,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      builtinGridDetected: false,
      feetPerCell: 5,
      gridColor: '#c4b5fd',
      gridOpacity: 0.28,
      showCoordinates: true,
      snapMonstersToGrid: true,
      tokens: input.tokens,
    }],
  }, input.room.member)
  await putRoomState(input.request, input.room.roomId, 'combat-log', {
    mapId,
    entries: [],
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
    effectiveRules: createDnd5eEffectiveRulesContextV1({
      revision: input.rules.revision,
      requiredPlugins: input.rules.requiredPlugins,
    }),
    updatedAt: now,
  }, input.room.member)
  return { mapId, combatId }
}

function action(input: {
  mapId: string
  combatId: string
  memberId: string
  actorTokenId: string
  characterId: string
  type: 'dnd5e-plugin-action' | 'dnd5e-weapon-attack'
  targetTokenId: string
  featureId?: string
  enemyTargetId?: string
  intentFeatureId?: string
  seq: number
}) {
  const now = Date.now()
  return {
    id: `${input.mapId}:battle-master-action:${input.seq}:${now}`,
    mapId: input.mapId,
    combatId: input.combatId,
    roomMemberId: input.memberId,
    sourceMode: 'player',
    status: 'pending',
    type: input.type,
    actorTokenId: input.actorTokenId,
    characterId: input.characterId,
    targetTokenId: input.targetTokenId,
    ...(input.featureId
      ? {
          dnd5ePluginAction: {
            featureId: input.featureId,
            ...(input.enemyTargetId ? { payload: { enemyTargetId: input.enemyTargetId } } : {}),
          },
        }
      : {}),
    ...(input.intentFeatureId
      ? {
          dnd5eWeaponAttackOptions: {
            declarativeIntentFeatureIds: [input.intentFeatureId],
          },
        }
      : {}),
    round: 1,
    initiativeIndex: 0,
    seq: input.seq,
    updatedAt: now,
  }
}

async function openScenario(
  dm: Page,
  player: Page,
  player2: Page,
  actorTokenId: string,
) {
  await Promise.all([
    [dm, DM],
    [player, PLAYER],
    [player2, PLAYER2],
  ].map(async ([page, origin]) => {
    const currentPage = page as Page
    if (new URL(currentPage.url()).pathname === '/maps') return
    await currentPage.goto(`${origin}/maps`, { waitUntil: 'domcontentloaded' })
  }))
  await Promise.all([
    expect(dm.getByTestId(`initiative-token-${actorTokenId}`)).toBeVisible({ timeout: 20_000 }),
    expect(player.getByTestId(`initiative-token-${actorTokenId}`)).toBeVisible({ timeout: 20_000 }),
    expect(player2.getByTestId(`initiative-token-${actorTokenId}`)).toBeVisible({ timeout: 20_000 }),
  ])
}

async function continueAfterCoverPreview(dm: Page) {
  await expect(dm.getByText('掩护预览', { exact: true })).toBeVisible({ timeout: 20_000 })
  await dm.getByRole('button', { name: '应用并继续结算' }).click()
}

test('本地战斗大师合集在真实双玩家房间完成四类玩家确认与 Headless 结算', async ({
  browser,
  request,
}) => {
  test.setTimeout(360_000)

  const createdResponse = await request.post(`${DM}/api/rooms`, {
    data: {
      roomName: 'Battle Master Multi-client E2E',
      displayName: '战斗大师 E2E DM',
      rulesetId: 'dnd5e-2014-srd-5.1',
      clientId: `battle-master-e2e-dm-${Date.now()}`,
      activePlugins: [],
    },
  })
  expect(createdResponse.ok()).toBeTruthy()
  const created = await createdResponse.json() as RoomMembershipResponse
  const playerResponse = await request.post(`${DM}/api/rooms/${created.roomId}/join`, {
    data: {
      displayName: '战斗大师玩家',
      clientId: `battle-master-e2e-player-${Date.now()}`,
      activePlugins: [],
    },
  })
  const player2Response = await request.post(`${DM}/api/rooms/${created.roomId}/join`, {
    data: {
      displayName: '确认玩家',
      clientId: `battle-master-e2e-player2-${Date.now()}`,
      activePlugins: [],
    },
  })
  expect(playerResponse.ok()).toBeTruthy()
  expect(player2Response.ok()).toBeTruthy()
  const joined = await playerResponse.json() as RoomMembershipResponse
  const joined2 = await player2Response.json() as RoomMembershipResponse

  const dmContext = await browser.newContext()
  const playerContext = await browser.newContext()
  const player2Context = await browser.newContext()
  await Promise.all([
    dmContext.addInitScript({ content: DETERMINISTIC_DICE_SCRIPT }),
    playerContext.addInitScript({ content: DETERMINISTIC_DICE_SCRIPT }),
    player2Context.addInitScript({ content: DETERMINISTIC_DICE_SCRIPT }),
    installFastDiceFrame(dmContext),
    installFastDiceFrame(playerContext),
    installFastDiceFrame(player2Context),
  ])
  const dm = await dmContext.newPage()
  const player = await playerContext.newPage()
  const player2 = await player2Context.newPage()
  dm.on('dialog', (dialog) => void dialog.accept())

  try {
    await Promise.all([
      enterRoom(dm, DM, created),
      enterRoom(player, PLAYER, joined),
      enterRoom(player2, PLAYER2, joined2),
    ])
    await dm.locator('input[type="file"][webkitdirectory]').setInputFiles(COLLECTION_DIRECTORY)
    await expect(dm.getByText(
      `已临时导入 ${PLUGIN_ID}；原始 JSON/CSV、提示词和规则正文未传输，关闭房间后需重新导入。`,
    )).toBeVisible({ timeout: 30_000 })
    await Promise.all([
      expect(player.getByTestId('room-rules-status').getByText('本机已就绪')).toBeVisible({ timeout: 30_000 }),
      expect(player2.getByTestId('room-rules-status').getByText('本机已就绪')).toBeVisible({ timeout: 30_000 }),
      expect(player.getByRole('heading', { name: '本地 PHB 2014 房间合集' })).toBeVisible({ timeout: 30_000 }),
      expect(player2.getByRole('heading', { name: '本地 PHB 2014 房间合集' })).toBeVisible({ timeout: 30_000 }),
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

    // 指挥官打击：玩家 1 发动，玩家 2 的盟友确认并消耗反应。
    {
      const commander = character({
        id: 'commander',
        name: '指挥官',
        roomId: created.roomId,
        memberId: joined.member.memberId,
        battleMasterManeuvers: ['commanders-strike'],
      })
      const ally = character({
        id: 'commanded-ally',
        name: '受令盟友',
        roomId: created.roomId,
        memberId: joined2.member.memberId,
      })
      const battlefield = await seedScenario({
        request,
        room: created,
        player: joined,
        rules,
        scenarioId: 'commanders-strike',
        characters: [commander, ally],
        tokens: [
          token({ id: 'commander-token', label: commander.name, x: 105, y: 105, type: 'player', characterId: commander.id }),
          token({ id: 'commanded-ally-token', label: ally.name, x: 175, y: 105, type: 'player', characterId: ally.id }),
          token({ id: 'commander-enemy-token', label: '受击敌人', x: 245, y: 105, type: 'enemy', hp: 60 }),
        ],
        actorTokenId: 'commander-token',
      })
      await openScenario(dm, player, player2, 'commander-token')
      const requestAction = action({
        ...battlefield,
        memberId: joined.member.memberId,
        actorTokenId: 'commander-token',
        characterId: commander.id,
        type: 'dnd5e-plugin-action',
        targetTokenId: 'commanded-ally-token',
        featureId: `${SUBCLASS_ID}.maneuver-commanders-strike`,
        enemyTargetId: 'commander-enemy-token',
        seq: 1,
      })
      await submitPlayerAction(player, requestAction)
      await waitForChoiceOrReportAuthority({
        choice: player2.getByTestId('shared-plugin-choice-attack'),
        request,
        room: created,
        actionId: requestAction.id,
      })
      await expect(player.getByTestId('shared-plugin-choice-attack')).toHaveCount(0, { timeout: 2_000 })
      await player2.getByTestId('shared-plugin-choice-attack').click({ timeout: 5_000 })
      await waitForAcceptedAck(request, created, requestAction.id)
      const maps = await getRoomState<{
        maps: Array<{ id: string; tokens: Array<{ id: string; hp?: number }> }>
      }>(request, created.roomId, 'maps', created.member)
      expect(maps.maps.find((map) => map.id === battlefield.mapId)?.tokens
        .find((candidate) => candidate.id === 'commander-enemy-token')?.hp).toBeLessThan(60)
      const saved = await getRoomState<{
        characters: Array<{ id: string; classResources?: Record<string, { current: number }> }>
      }>(request, created.roomId, 'characters', created.member)
      expect(saved.characters.find((candidate) => candidate.id === commander.id)
        ?.classResources?.[RESOURCE_ID]?.current).toBe(5)
    }

    // 调遣攻击：玩家 1 只提前声明战技；命中后由玩家 2 选择实际落点。
    {
      const maneuvering = character({
        id: 'maneuvering-fighter',
        name: '调遣战士',
        roomId: created.roomId,
        memberId: joined.member.memberId,
        battleMasterManeuvers: ['maneuvering-attack'],
      })
      const ally = character({
        id: 'moving-ally',
        name: '移动盟友',
        roomId: created.roomId,
        memberId: joined2.member.memberId,
      })
      const battlefield = await seedScenario({
        request,
        room: created,
        player: joined,
        rules,
        scenarioId: 'maneuvering-attack',
        characters: [maneuvering, ally],
        tokens: [
          token({ id: 'maneuvering-token', label: maneuvering.name, x: 105, y: 105, type: 'player', characterId: maneuvering.id }),
          token({ id: 'moving-ally-token', label: ally.name, x: 105, y: 175, type: 'player', characterId: ally.id }),
          token({ id: 'maneuvering-enemy-token', label: '原始目标', x: 175, y: 105, type: 'enemy', hp: 60 }),
        ],
        actorTokenId: 'maneuvering-token',
      })
      await openScenario(dm, player, player2, 'maneuvering-token')
      const requestAction = action({
        ...battlefield,
        memberId: joined.member.memberId,
        actorTokenId: 'maneuvering-token',
        characterId: maneuvering.id,
        type: 'dnd5e-weapon-attack',
        targetTokenId: 'maneuvering-enemy-token',
        intentFeatureId: `${SUBCLASS_ID}.maneuver-maneuvering-attack`,
        seq: 2,
      })
      await submitPlayerAction(player, requestAction)
      await continueAfterCoverPreview(dm)
      const destination = player2.locator('[data-testid^="shared-plugin-choice-cell:"]').first()
      await waitForChoiceOrReportAuthority({
        choice: destination,
        request,
        room: created,
        actionId: requestAction.id,
      })
      await expect(player.locator('[data-testid^="shared-plugin-choice-cell:"]'))
        .toHaveCount(0, { timeout: 2_000 })
      await destination.click({ timeout: 5_000 })
      await waitForAcceptedAck(request, created, requestAction.id)
      const maps = await getRoomState<{
        maps: Array<{ id: string; tokens: Array<{ id: string; x: number; y: number; hp?: number }> }>
      }>(request, created.roomId, 'maps', created.member)
      const map = maps.maps.find((candidate) => candidate.id === battlefield.mapId)
      const moved = map?.tokens.find((candidate) => candidate.id === 'moving-ally-token')
      expect({ x: moved?.x, y: moved?.y }).not.toEqual({ x: 105, y: 175 })
      expect(map?.tokens.find((candidate) => candidate.id === 'maneuvering-enemy-token')?.hp)
        .toBeLessThan(60)
      const saved = await getRoomState<{
        characters: Array<{ id: string; classResources?: Record<string, { current: number }> }>
      }>(request, created.roomId, 'characters', created.member)
      expect(saved.characters.find((candidate) => candidate.id === maneuvering.id)
        ?.classResources?.[RESOURCE_ID]?.current).toBe(5)
    }

    // 招架：命中成立后只向目标玩家询问，Headless 扣除反应和卓越骰并减少伤害。
    {
      const attacker = character({
        id: 'parry-attacker',
        name: '招架测试攻击者',
        roomId: created.roomId,
        memberId: joined.member.memberId,
      })
      const defender = character({
        id: 'parry-defender',
        name: '招架战士',
        roomId: created.roomId,
        memberId: joined2.member.memberId,
        battleMasterManeuvers: ['parry'],
        armorClass: 12,
      })
      const battlefield = await seedScenario({
        request,
        room: created,
        player: joined,
        rules,
        scenarioId: 'parry',
        characters: [attacker, defender],
        tokens: [
          token({ id: 'parry-attacker-token', label: attacker.name, x: 105, y: 105, type: 'player', characterId: attacker.id }),
          token({ id: 'parry-defender-token', label: defender.name, x: 175, y: 105, type: 'enemy', characterId: defender.id }),
        ],
        actorTokenId: 'parry-attacker-token',
      })
      await openScenario(dm, player, player2, 'parry-attacker-token')
      const requestAction = action({
        ...battlefield,
        memberId: joined.member.memberId,
        actorTokenId: 'parry-attacker-token',
        characterId: attacker.id,
        type: 'dnd5e-weapon-attack',
        targetTokenId: 'parry-defender-token',
        seq: 3,
      })
      await submitPlayerAction(player, requestAction)
      await continueAfterCoverPreview(dm)
      await expect(player2.getByTestId('shared-plugin-choice-use')).toBeVisible({ timeout: 30_000 })
      await expect(player.getByTestId('shared-plugin-choice-use')).toHaveCount(0, { timeout: 2_000 })
      await player2.getByTestId('shared-plugin-choice-use').click({ timeout: 5_000 })
      await waitForAcceptedAck(request, created, requestAction.id)
      const saved = await getRoomState<{
        characters: Array<{
          id: string
          maxHp: number
          currentHp: number
          classResources?: Record<string, { current: number }>
        }>
      }>(request, created.roomId, 'characters', created.member)
      const savedDefender = saved.characters.find((candidate) => candidate.id === defender.id)
      expect(savedDefender?.currentHp).toBeLessThan(savedDefender?.maxHp ?? 0)
      expect(savedDefender?.currentHp).toBeGreaterThan((savedDefender?.maxHp ?? 0) - 13)
      expect(savedDefender?.classResources?.[RESOURCE_ID]?.current).toBe(5)
    }

    // 反击：原攻击未命中后由目标玩家确认，Host 重建目标武器攻击并结算反击。
    {
      const attacker = character({
        id: 'riposte-attacker',
        name: '反击测试攻击者',
        roomId: created.roomId,
        memberId: joined.member.memberId,
        abilities: { str: 8, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
      })
      const defender = character({
        id: 'riposte-defender',
        name: '反击战士',
        roomId: created.roomId,
        memberId: joined2.member.memberId,
        battleMasterManeuvers: ['riposte'],
        armorClass: 30,
      })
      const battlefield = await seedScenario({
        request,
        room: created,
        player: joined,
        rules,
        scenarioId: 'riposte',
        characters: [attacker, defender],
        tokens: [
          token({ id: 'riposte-attacker-token', label: attacker.name, x: 105, y: 105, type: 'player', characterId: attacker.id }),
          token({ id: 'riposte-defender-token', label: defender.name, x: 175, y: 105, type: 'enemy', characterId: defender.id }),
        ],
        actorTokenId: 'riposte-attacker-token',
      })
      await openScenario(dm, player, player2, 'riposte-attacker-token')
      const requestAction = action({
        ...battlefield,
        memberId: joined.member.memberId,
        actorTokenId: 'riposte-attacker-token',
        characterId: attacker.id,
        type: 'dnd5e-weapon-attack',
        targetTokenId: 'riposte-defender-token',
        seq: 4,
      })
      await submitPlayerAction(player, requestAction)
      await continueAfterCoverPreview(dm)
      await expect(player2.getByTestId('shared-plugin-choice-use')).toBeVisible({ timeout: 30_000 })
      await expect(player.getByTestId('shared-plugin-choice-use')).toHaveCount(0, { timeout: 2_000 })
      await player2.getByTestId('shared-plugin-choice-use').click({ timeout: 5_000 })
      await waitForAcceptedAck(request, created, requestAction.id)
      const saved = await getRoomState<{
        characters: Array<{
          id: string
          currentHp: number
          classResources?: Record<string, { current: number }>
        }>
      }>(request, created.roomId, 'characters', created.member)
      expect(saved.characters.find((candidate) => candidate.id === attacker.id)?.currentHp)
        .toBeLessThan(attacker.currentHp)
      expect(saved.characters.find((candidate) => candidate.id === defender.id)
        ?.classResources?.[RESOURCE_ID]?.current).toBe(5)
    }
  } finally {
    await Promise.all([dmContext.close(), playerContext.close(), player2Context.close()])
  }
})
