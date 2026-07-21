import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'
const PLAYER = 'http://127.0.0.1:6174'

type ResourceCharacter = {
  id: string
  currentHp: number
  concentrating?: boolean
  classResources?: Record<string, { current: number; max: number }>
  dnd5eCombatState?: { concentrationSpellId?: string }
}

type ResourceMap = {
  id: string
  dnd5ePluginAreas?: Array<{
    id: string
    sourceKind?: string
    coreSpellId?: string
    anchorCell?: { col: number; row: number }
    concentrationId?: string
  }>
  tokens: Array<{ id: string; hp?: number }>
}

async function putState(request: APIRequestContext, name: string, payload: unknown) {
  const response = await request.put(`${DM}/api/state/${name}`, { data: payload })
  expect(response.ok(), `${name}: ${response.status()}`).toBeTruthy()
}

async function getState<T>(request: APIRequestContext, name: string): Promise<T> {
  const response = await request.get(`${DM}/api/state/${name}`)
  expect(response.ok(), `${name}: ${response.status()}`).toBeTruthy()
  return response.json() as Promise<T>
}

async function loadPlayerState<T>(page: Page, name: string): Promise<T> {
  return page.evaluate(async (resourceName) => {
    const response = await fetch(`/api/state/${resourceName}`)
    if (!response.ok) throw new Error(`GET ${resourceName} failed: ${response.status}`)
    return response.json()
  }, name) as Promise<T>
}

async function submitPlayerAction(page: Page, action: Record<string, unknown>) {
  await page.evaluate(async (payload) => {
    const protocolHeaders = {
      'X-Stars-Protocol': '5',
      'X-Stars-Writer': 'e2e-spell-client',
    }
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const queueResponse = await fetch('http://127.0.0.1:6173/api/state/player-action-requests')
      const queue = queueResponse.ok
        ? await queueResponse.json() as { requests?: Record<string, unknown>[]; _sync?: { revision?: number } }
        : { requests: [] }
      const revision = Number(queueResponse.headers.get('X-Stars-State-Revision') ?? queue._sync?.revision ?? 0)
      const putResponse = await fetch('http://127.0.0.1:6173/api/state/player-action-requests', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...protocolHeaders,
          'X-Stars-Expected-Revision': String(Number.isInteger(revision) ? revision : 0),
        },
        body: JSON.stringify({
          mapId: payload.mapId,
          combatId: payload.combatId,
          requests: [...(queue.requests ?? []), payload],
          updatedAt: Date.now(),
        }),
      })
      if (putResponse.ok) break
      if (putResponse.status !== 409 || attempt === 4) {
        throw new Error(`player-action queue PUT failed: ${putResponse.status}`)
      }
    }
    const eventResponse = await fetch('http://127.0.0.1:6173/api/events/player-action-player-to-dm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...protocolHeaders },
      body: JSON.stringify(payload),
    })
    if (!eventResponse.ok) throw new Error(`player-action event failed: ${eventResponse.status}`)
  }, action)
}

function spellcaster(id: string, spellIds: string[], classId: 'wizard' | 'druid') {
  const isWizard = classId === 'wizard'
  return {
    id,
    rulesetId: 'dnd5e-2014-srd-5.1',
    name: isWizard ? '跨端测试法师' : '跨端测试德鲁伊',
    player: '玩家 1',
    avatar: '🧙',
    accent: 'from-violet-500 to-sky-500',
    race: '人类',
    charClass: isWizard ? '法师' : '德鲁伊',
    dnd5eClassId: classId,
    level: 5,
    background: '学者',
    alignment: '中立善良',
    experience: 6500,
    reputation: 0,
    abilities: { str: 8, dex: 14, con: 14, int: 18, wis: 12, cha: 10 },
    savingThrows: ['int', 'wis'],
    skills: ['arcana', 'investigation'],
    maxHp: 32,
    currentHp: 32,
    tempHp: 0,
    hitDice: isWizard ? '5d6' : '5d8',
    ac: 13,
    speed: 30,
    initiativeBonus: 2,
    saveDC: 15,
    passivePerception: 11,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    equipment: {},
    dnd5eClassChoices: {
      classes: { [classId]: { selections: { 'spell-prepared': spellIds } } },
    },
    classResources: { 'dnd5e-spell-slot-2': { current: 2, max: 3 } },
  }
}

async function seedCombat(
  request: APIRequestContext,
  mapId: string,
  spellIds: string[],
  classId: 'wizard' | 'druid' = 'wizard',
) {
  const now = Date.now()
  const character = spellcaster(`${mapId}:spellcaster`, spellIds, classId)
  const actorToken = {
    id: `${mapId}:wizard-token`, label: character.name, x: 175, y: 175,
    color: '#8b5cf6', emoji: '🧙', size: 1, type: 'player', characterId: character.id,
  }
  const enemyToken = {
    id: `${mapId}:enemy-token`, label: '跨端测试食人魔', x: 595, y: 175,
    color: '#ef4444', emoji: '👹', size: 2, type: 'enemy', hp: 40, maxHp: 40, poolId: 'ogre',
  }
  await request.delete(`${DM}/api/events/_all`)
  await putState(request, 'characters', { characters: [character], selectedId: character.id, updatedAt: now })
  await putState(request, 'maps', {
    selectedId: mapId,
    updatedAt: now,
    maps: [{
      id: mapId, name: `法术同步 ${mapId}`, width: 840, height: 560, gridSize: 70,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [actorToken, enemyToken], dnd5ePluginAreas: [],
    }],
  })
  await putState(request, 'combat-log', { mapId, entries: [], updatedAt: now })
  await putState(request, 'dice-events', { mapId, events: [], updatedAt: now })
  await putState(request, 'combat-interrupts', { mapId, interrupts: [], updatedAt: now, revision: 0 })
  await putState(request, 'player-action-requests', { mapId, combatId: `${mapId}:combat`, requests: [], updatedAt: now })
  await putState(request, 'player-action-processed', { mapId, combatId: `${mapId}:combat`, actionIds: [], updatedAt: now })
  await putState(request, 'player-action-ack', {
    id: `${mapId}:none`, mapId, combatId: `${mapId}:combat`, actionId: 'none',
    status: 'accepted', round: 1, initiativeIndex: 0, updatedAt: now,
  })
  await putState(request, 'combat', {
    mapId, combatId: `${mapId}:combat`, active: true, round: 1, initiativeIndex: 0,
    settlementMode: 'automatic',
    initiativeOrder: [
      { tokenId: actorToken.id, label: actorToken.label, emoji: actorToken.emoji, color: actorToken.color, roll: 20 },
      { tokenId: enemyToken.id, label: enemyToken.label, emoji: enemyToken.emoji, color: enemyToken.color, roll: 10 },
    ],
    updatedAt: now,
  })
  return { character, actorToken, enemyToken }
}

test('未机械化法术跨端进入 DM Interrupt，批准前不消费，批准后原子同步', async ({ browser, request }) => {
  test.setTimeout(90_000)
  const mapId = `spell-interrupt-${Date.now()}`
  const seeded = await seedCombat(request, mapId, ['suggestion'])
  const context = await browser.newContext()
  const dm = await context.newPage()
  const player = await context.newPage()
  await Promise.all([
    dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' }),
    player.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' }),
  ])
  await expect(dm.getByTestId(`initiative-token-${seeded.actorToken.id}`)).toBeVisible({ timeout: 20_000 })

  const now = Date.now()
  const action = {
    id: `${mapId}:suggestion:${now}`,
    mapId,
    combatId: `${mapId}:combat`,
    sourceMode: 'player',
    status: 'pending',
    type: 'dnd5e-adjudicated-spell',
    actorTokenId: seeded.actorToken.id,
    characterId: seeded.character.id,
    dnd5eAdjudicatedSpell: { spellId: 'suggestion', castingClassId: 'wizard', slotLevel: 2 },
    round: 1,
    initiativeIndex: 0,
    seq: 1,
    updatedAt: now,
  }
  await submitPlayerAction(player, action)

  const dialog = dm.getByTestId('dm-adjudication-dialog')
  await expect(dialog).toBeVisible({ timeout: 20_000 })
  await expect(dialog).toContainText('DM 裁定 · 暗示术')
  await expect(player.getByTestId('dm-adjudication-dialog')).toHaveCount(0)
  const before = await getState<{ characters: ResourceCharacter[]; _sync?: unknown }>(request, 'characters')
  expect(before.characters[0].classResources?.['dnd5e-spell-slot-2']?.current).toBe(2)

  await dialog.getByRole('button', { name: '＋ 添加目标效果' }).click()
  await dialog.getByLabel('目标').selectOption(seeded.enemyToken.id)
  await dialog.getByLabel('HP 操作').selectOption('damage')
  await dialog.getByLabel('最终数值').fill('7')
  await dialog.getByLabel('添加状态（可选）').fill('魅惑')
  await dialog.getByLabel('DM 裁定备注（可选）').fill('跨端 Interrupt E2E')
  await dialog.getByTestId('dm-adjudication-approve').click()

  await expect.poll(async () => {
    const ack = await getState<{ actionId?: string; status?: string }>(request, 'player-action-ack')
    return ack.actionId === action.id ? ack.status : ''
  }, { timeout: 30_000 }).toBe('accepted')
  await expect.poll(async () => {
    const state = await getState<{ characters: ResourceCharacter[] }>(request, 'characters')
    return state.characters[0].classResources?.['dnd5e-spell-slot-2']?.current
  }).toBe(1)
  await expect.poll(async () => {
    const state = await getState<{ maps: ResourceMap[] }>(request, 'maps')
    return state.maps.find((map) => map.id === mapId)?.tokens.find((token) => token.id === seeded.enemyToken.id)?.hp
  }).toBe(33)
  const interrupts = await getState<{
    interrupts: Array<{ id: string; status: string; response?: { note?: string } }>
  }>(request, 'combat-interrupts')
  expect(interrupts.interrupts).toContainEqual(expect.objectContaining({
    id: `dm-adjudication:${action.id}`,
    status: 'done',
    response: expect.objectContaining({ note: '跨端 Interrupt E2E' }),
  }))
  const playerMaps = await loadPlayerState<{ maps: ResourceMap[] }>(player, 'maps')
  expect(playerMaps.maps.find((map) => map.id === mapId)?.tokens.find((token) => token.id === seeded.enemyToken.id)?.hp).toBe(33)
  await context.close()
})

test('核心持续区域由 DM 原子创建，并在玩家刷新和重复投递后保持单实例', async ({ browser, request }) => {
  test.setTimeout(90_000)
  const mapId = `spell-area-${Date.now()}`
  const seeded = await seedCombat(request, mapId, ['moonbeam'], 'druid')
  const context = await browser.newContext()
  const dm = await context.newPage()
  const player = await context.newPage()
  await Promise.all([
    dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' }),
    player.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' }),
  ])
  await expect(dm.getByTestId(`initiative-token-${seeded.actorToken.id}`)).toBeVisible({ timeout: 20_000 })

  const now = Date.now()
  const action = {
    id: `${mapId}:moonbeam:${now}`,
    mapId,
    combatId: `${mapId}:combat`,
    sourceMode: 'player',
    status: 'pending',
    type: 'dnd5e-spell-cast',
    actorTokenId: seeded.actorToken.id,
    characterId: seeded.character.id,
    targetTokenId: seeded.actorToken.id,
    targetCell: { col: 5, row: 2 },
    dnd5eSpellCast: {
      spellId: 'moonbeam', castingClassId: 'druid', slotLevel: 2,
      targetTokenId: seeded.actorToken.id, targetTokenIds: [], areaTargetCell: { col: 5, row: 2 },
    },
    round: 1,
    initiativeIndex: 0,
    seq: 1,
    updatedAt: now,
  }
  await submitPlayerAction(player, action)

  await expect.poll(async () => {
    const ack = await getState<{ actionId?: string; status?: string; reason?: string }>(request, 'player-action-ack')
    return ack.actionId === action.id ? `${ack.status}:${ack.reason ?? ''}` : ''
  }, { timeout: 30_000 }).toBe('accepted:')
  await expect.poll(async () => {
    const state = await getState<{ maps: ResourceMap[] }>(request, 'maps')
    return state.maps.find((map) => map.id === mapId)?.dnd5ePluginAreas?.map((area) => ({
      sourceKind: area.sourceKind,
      spell: area.coreSpellId,
      anchor: area.anchorCell,
      concentration: area.concentrationId,
    }))
  }).toEqual([{
    sourceKind: 'core-spell', spell: 'moonbeam', anchor: { col: 5, row: 2 }, concentration: 'moonbeam',
  }])
  await expect.poll(async () => {
    const state = await getState<{ characters: ResourceCharacter[] }>(request, 'characters')
    return {
      slot: state.characters[0].classResources?.['dnd5e-spell-slot-2']?.current,
      concentrating: state.characters[0].concentrating,
      spell: state.characters[0].dnd5eCombatState?.concentrationSpellId,
    }
  }).toEqual({ slot: 1, concentrating: true, spell: 'moonbeam' })

  await submitPlayerAction(player, action)
  await player.waitForTimeout(1_000)
  const afterDuplicate = await getState<{ maps: ResourceMap[] }>(request, 'maps')
  expect(afterDuplicate.maps.find((map) => map.id === mapId)?.dnd5ePluginAreas).toHaveLength(1)
  const processed = await getState<{ actionIds: string[] }>(request, 'player-action-processed')
  expect(processed.actionIds.filter((id) => id === action.id)).toHaveLength(1)

  await player.reload({ waitUntil: 'domcontentloaded' })
  const rejoined = await loadPlayerState<{ maps: ResourceMap[] }>(player, 'maps')
  expect(rejoined.maps.find((map) => map.id === mapId)?.dnd5ePluginAreas).toContainEqual(expect.objectContaining({
    sourceKind: 'core-spell', coreSpellId: 'moonbeam', anchorCell: { col: 5, row: 2 },
  }))
  await context.close()
})
