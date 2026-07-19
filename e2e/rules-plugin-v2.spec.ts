import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'
const PLAYER = 'http://127.0.0.1:6174'
const PLAYER2 = 'http://127.0.0.1:6175'
const SESSION_KEY = 'stars-room-session:v1'
const TEMPLATE_PATH = path.resolve('public/plugin-templates/phb-2014-compat-template.dndstars5e')
const PLUGIN_ID = 'local.example.phb-2014-template'
const FEATURE_ID = `${PLUGIN_ID}:guardian-spark`

interface RoomMembershipResponse {
  roomId: string
  roomName: string
  rulesetId: 'dnd5e-2014-srd-5.1'
  createdAt: number
  member: {
    memberId: string
    clientId: string
    role: 'dm' | 'player'
    slot?: 'player1' | 'player2' | 'player3'
    displayName: string
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

function character(id: string, name: string, roomId: string, memberId: string) {
  return {
    rulesetId: 'dnd5e-2014-srd-5.1',
    id,
    name,
    player: name,
    roomId,
    roomMemberId: memberId,
    avatar: '🛡️',
    accent: 'from-violet-500 to-indigo-600',
    race: '人类',
    charClass: '战士',
    dnd5eClassId: 'fighter',
    level: 3,
    background: '士兵',
    experience: 900,
    reputation: 0,
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    savingThrows: ['str', 'con'],
    skills: ['athletics'],
    maxHp: 28,
    currentHp: 28,
    tempHp: 0,
    hitDice: '3d10',
    ac: 16,
    speed: 30,
    initiativeBonus: 1,
    saveDC: 12,
    passivePerception: 10,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    dnd5ePluginFeatureIds: [],
  }
}

async function putRoomState(request: APIRequestContext, roomId: string, name: string, value: unknown) {
  const response = await request.put(`${DM}/api/state/${name}?room=${roomId}`, { data: value })
  expect(response.ok()).toBeTruthy()
}

async function getRoomState<T>(request: APIRequestContext, roomId: string, name: string): Promise<T> {
  const response = await request.get(`${DM}/api/state/${name}?room=${roomId}`)
  expect(response.ok()).toBeTruthy()
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

async function uploadTemplateFromDm(page: Page) {
  await page.locator('input[type="file"]').setInputFiles(TEMPLATE_PATH)
  await expect(page.getByText(`已原子激活 ${PLUGIN_ID}；房间玩家将自动下载并激活。`)).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('room-rules-status').getByText('本机已就绪')).toBeVisible({ timeout: 20_000 })
}

test('插件状态迁移只在受限 Worker 内按连续 schema 执行', async ({ page }) => {
  await page.goto(DM, { waitUntil: 'domcontentloaded' })
  const result = await page.evaluate(async () => {
    const host = window.DNDSTARS_5E_RULES_PLUGINS
    if (!host) throw new Error('plugin host missing')
    const source = `const migrationPlugin = {
      manifest: {
        id: 'com.example.worker-migrations',
        name: 'Worker Migrations',
        version: '3.0.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'E2E',
        license: 'CC0-1.0',
        stateSchemaVersion: 3,
      },
      migrations: [
        { fromVersion: 1, toVersion: 2, migrate(state) {
          if (typeof fetch !== 'undefined' || typeof indexedDB !== 'undefined') throw new Error('sandbox escape')
          return { ...state, step2: true }
        } },
        { fromVersion: 2, toVersion: 3, migrate(state) { return { ...state, step3: true } } },
      ],
      setup() {},
    };
    export default migrationPlugin;`
    const bytes = new TextEncoder().encode(source).buffer
    return host.migrateState({ bytes, fromVersion: 1, state: { counter: 4 } })
  })
  expect(result).toEqual({
    fromVersion: 1,
    toVersion: 3,
    state: { counter: 4, step2: true, step3: true },
  })
})

test('房间规则包握手贯通角色选择、DM Headless 结算和三端同步', async ({ browser, request }) => {
  test.setTimeout(120_000)
  const template = await readFile(TEMPLATE_PATH)
  const requirement = {
    id: PLUGIN_ID,
    version: '0.1.0',
    integrity: `sha256-${createHash('sha256').update(template).digest('base64')}`,
    stateSchemaVersion: 1,
  }

  const createdResponse = await request.post(`${DM}/api/rooms`, {
    data: {
      roomName: 'Plugin API V2 E2E',
      displayName: 'E2E DM',
      rulesetId: 'dnd5e-2014-srd-5.1',
      clientId: `plugin-v2-dm-${Date.now()}`,
      activePlugins: [],
    },
  })
  expect(createdResponse.ok()).toBeTruthy()
  const created = await createdResponse.json() as RoomMembershipResponse
  const joinedResponse = await request.post(`${DM}/api/rooms/${created.roomId}/join`, {
    data: { displayName: '插件玩家', clientId: `plugin-v2-player-${Date.now()}`, activePlugins: [] },
  })
  const joined2Response = await request.post(`${DM}/api/rooms/${created.roomId}/join`, {
    data: { displayName: '同步观察者', clientId: `plugin-v2-observer-${Date.now()}`, activePlugins: [] },
  })
  expect(joinedResponse.ok()).toBeTruthy()
  expect(joined2Response.ok()).toBeTruthy()
  const joined = await joinedResponse.json() as RoomMembershipResponse
  const joined2 = await joined2Response.json() as RoomMembershipResponse

  const dmContext = await browser.newContext()
  const playerContext = await browser.newContext()
  const player2Context = await browser.newContext()
  const dm = await dmContext.newPage()
  const player = await playerContext.newPage()
  const player2 = await player2Context.newPage()
  await Promise.all([
    enterRoom(dm, DM, created),
    enterRoom(player, PLAYER, joined),
    enterRoom(player2, PLAYER2, joined2),
  ])

  await expect(player.getByTestId('room-rules-status').getByText('本机已就绪')).toBeVisible()
  await expect(player.locator('input[type="file"]')).toHaveCount(0)
  await uploadTemplateFromDm(dm)
  await expect.poll(async () => {
    const response = await request.get(`${DM}/api/rooms/${created.roomId}/rules`, {
      headers: { 'X-Stars-Member': created.member.memberId },
    })
    const rules = await response.json() as { requiredPlugins: unknown[] }
    return rules.requiredPlugins
  }, { timeout: 20_000 }).toEqual([requirement])
  await Promise.all([
    expect(player.getByRole('heading', { name: 'PHB 2014 兼容模板（演示）' })).toBeVisible({ timeout: 25_000 }),
    expect(player2.getByRole('heading', { name: 'PHB 2014 兼容模板（演示）' })).toBeVisible({ timeout: 25_000 }),
  ])
  await Promise.all([
    expect(player.getByTestId('room-rules-status').getByText('本机已就绪')).toBeVisible({ timeout: 20_000 }),
    expect(player2.getByTestId('room-rules-status').getByText('本机已就绪')).toBeVisible({ timeout: 20_000 }),
  ])

  const now = Date.now()
  const hero = character('plugin-hero', '插件主角', created.roomId, joined.member.memberId)
  const ally = character('plugin-ally', '插件盟友', created.roomId, joined2.member.memberId)
  await putRoomState(request, created.roomId, 'characters', {
    characters: [hero, ally],
    selectedId: hero.id,
    updatedAt: now,
  })
  await putRoomState(request, created.roomId, 'maps', {
    selectedId: 'plugin-map',
    updatedAt: now,
    maps: [{
      id: 'plugin-map',
      name: 'Plugin API V2 战场',
      width: 700,
      height: 560,
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
      tokens: [
        { id: 'hero-token', label: '插件主角', x: 105, y: 105, color: '#8b5cf6', emoji: '🛡️', size: 1, type: 'player', characterId: hero.id },
        { id: 'ally-token', label: '插件盟友', x: 175, y: 105, color: '#22c55e', emoji: '🛡️', size: 1, type: 'player', characterId: ally.id },
        { id: 'goblin-token', label: '地精', x: 525, y: 105, color: '#ef4444', emoji: '👺', size: 1, type: 'enemy', poolId: 'goblin', hp: 7, maxHp: 7 },
      ],
    }],
  })

  await player.goto(`${PLAYER}/characters`, { waitUntil: 'domcontentloaded' })
  await expect(player.getByRole('textbox', { name: '角色名称' })).toHaveValue('插件主角', { timeout: 20_000 })
  await player.getByRole('button', { name: '扩展规则', exact: true }).click()
  const featureCard = player.locator('article').filter({ hasText: '演示特性：守护火花' })
  await featureCard.getByRole('button', { name: '选择', exact: true }).click()
  await expect(featureCard.getByRole('button', { name: '已选择', exact: true })).toBeVisible()
  await expect.poll(async () => {
    const state = await getRoomState<{ characters: Array<{ id: string; dnd5ePluginFeatureIds?: string[] }> }>(
      request,
      created.roomId,
      'characters',
    )
    return state.characters.find((candidate) => candidate.id === hero.id)?.dnd5ePluginFeatureIds ?? []
  }, { timeout: 20_000 }).toContain(FEATURE_ID)
  await player.reload({ waitUntil: 'domcontentloaded' })
  await player.getByRole('button', { name: '扩展规则', exact: true }).click()
  await expect(player.locator('article').filter({ hasText: '演示特性：守护火花' }).getByRole('button', { name: '已选择' }))
    .toBeVisible()

  const combatId = 'plugin-map:combat'
  await putRoomState(request, created.roomId, 'combat-log', { mapId: 'plugin-map', entries: [], updatedAt: Date.now() })
  await putRoomState(request, created.roomId, 'player-action-requests', { mapId: 'plugin-map', combatId, requests: [], updatedAt: Date.now() })
  await putRoomState(request, created.roomId, 'player-action-processed', { mapId: 'plugin-map', combatId, actionIds: [], updatedAt: Date.now() })
  await putRoomState(request, created.roomId, 'player-action-ack', {
    id: 'plugin-none', mapId: 'plugin-map', combatId, actionId: 'none', status: 'accepted',
    round: 1, initiativeIndex: 0, updatedAt: Date.now(),
  })
  await putRoomState(request, created.roomId, 'combat', {
    mapId: 'plugin-map',
    combatId,
    active: true,
    round: 1,
    initiativeIndex: 0,
    initiativeOrder: [
      { slotId: 'hero-token:normal', tokenId: 'hero-token', label: '插件主角', emoji: '🛡️', color: '#8b5cf6', roll: 20 },
      { slotId: 'ally-token:normal', tokenId: 'ally-token', label: '插件盟友', emoji: '🛡️', color: '#22c55e', roll: 10 },
      { slotId: 'goblin-token:normal', tokenId: 'goblin-token', label: '地精', emoji: '👺', color: '#ef4444', roll: 5 },
    ],
    updatedAt: Date.now(),
  })

  await Promise.all([
    dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' }),
    player.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' }),
    player2.goto(`${PLAYER2}/characters`, { waitUntil: 'domcontentloaded' }),
  ])
  await expect(dm.getByTestId('initiative-token-hero-token')).toBeVisible({ timeout: 20_000 })
  await expect(player.getByTestId('initiative-token-hero-token')).toBeVisible({ timeout: 20_000 })
  await player.getByTitle('技能').click()
  const pluginPanel = player.getByTestId('dnd5e-plugin-combat-panel')
  await expect(pluginPanel).toBeVisible()
  await pluginPanel.locator('[data-testid^="dnd5e-plugin-target-"]').selectOption({ label: '插件盟友 · 5尺' })
  const actionButton = pluginPanel.getByRole('button', { name: '使用守护火花' })
  await expect(actionButton).toBeEnabled({ timeout: 20_000 })
  await actionButton.click()

  await expect.poll(async () => {
    const state = await getRoomState<{ characters: Array<{ id: string; tempHp: number }> }>(request, created.roomId, 'characters')
    return state.characters.find((candidate) => candidate.id === ally.id)?.tempHp ?? 0
  }, { timeout: 30_000 }).toBe(3)
  await expect.poll(async () => {
    const state = await getRoomState<{ status: string; actionId: string }>(request, created.roomId, 'player-action-ack')
    return state.actionId === 'none' ? '' : state.status
  }, { timeout: 20_000 }).toBe('accepted')
  await expect(player2.getByText('+3 临时', { exact: true })).toBeVisible({ timeout: 20_000 })
  await expect(actionButton).toBeDisabled()

  await Promise.all([dmContext.close(), playerContext.close(), player2Context.close()])
})
