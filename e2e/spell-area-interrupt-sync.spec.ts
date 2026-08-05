import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const E2E_PORT_BASE = Math.max(1_024, Number(process.env.STARS_E2E_PORT_BASE) || 6_173)
const DM = `http://127.0.0.1:${E2E_PORT_BASE}`
const PLAYER = `http://127.0.0.1:${E2E_PORT_BASE + 1}`

type ResourceCharacter = {
  id: string
  currentHp: number
  concentrating?: boolean
  classResources?: Record<string, { current: number; max: number }>
  dnd5eCombatState?: {
    concentrationSpellId?: string
    activeEffects?: Array<{ definitionId?: string; source?: { rulesId?: string } }>
  }
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
  tokens: Array<{
    id: string
    hp?: number
    dnd5eCombatState?: {
      activeEffects?: Array<{ definitionId?: string; source?: { spellId?: string } }>
    }
  }>
}

async function putState(request: APIRequestContext, name: string, payload: unknown) {
  const current = await request.get(`${DM}/api/state/${name}`)
  const currentBody = current.ok()
    ? await current.json() as { updatedAt?: number }
    : null
  const nextPayload = payload && typeof payload === 'object'
    ? {
        ...payload,
        updatedAt: Math.max(
          Date.now(),
          Number((payload as { updatedAt?: number }).updatedAt ?? 0),
          Number(currentBody?.updatedAt ?? 0) + 1,
        ),
      }
    : payload
  const response = await request.put(`${DM}/api/state/${name}`, { data: nextPayload })
  expect(response.ok(), `${name}: ${response.status()}`).toBeTruthy()
  const result = await response.json() as { applied?: boolean }
  expect(result.applied, `${name} should be applied`).not.toBe(false)
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

async function useDeterministicBrowserRandom(page: Page, unitValue: number) {
  await page.evaluate((fixedUnitValue) => {
    const normalized = Math.min(0.9999999997671694, Math.max(0, fixedUnitValue))
    Math.random = () => normalized
    const uint32 = Math.floor(normalized * 0x1_0000_0000)
    Object.defineProperty(globalThis.crypto, 'getRandomValues', {
      configurable: true,
      value: (array: Uint32Array) => {
        array.fill(uint32)
        return array
      },
    })
  }, unitValue)
}

async function submitPlayerAction(page: Page, action: Record<string, unknown>) {
  await page.evaluate(async ({ payload, dmBase }) => {
    const protocolHeaders = {
      'X-Stars-Protocol': '5',
      'X-Stars-Writer': 'e2e-spell-client',
    }
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const queueResponse = await fetch(`${dmBase}/api/state/player-action-requests`)
      const queue = queueResponse.ok
        ? await queueResponse.json() as { requests?: Record<string, unknown>[]; _sync?: { revision?: number } }
        : { requests: [] }
      const revision = Number(queueResponse.headers.get('X-Stars-State-Revision') ?? queue._sync?.revision ?? 0)
      const putResponse = await fetch(`${dmBase}/api/state/player-action-requests`, {
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
    const eventResponse = await fetch(`${dmBase}/api/events/player-action-player-to-dm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...protocolHeaders },
      body: JSON.stringify(payload),
    })
    if (!eventResponse.ok) throw new Error(`player-action event failed: ${eventResponse.status}`)
  }, { payload: action, dmBase: DM })
}

function spellcaster(
  id: string,
  spellIds: string[],
  classId: 'wizard' | 'druid',
  cantripIds: string[] = [],
) {
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
    dnd5eInventory: {
      schemaVersion: 3,
      entries: [{
        instanceId: `${id}:component-pouch`,
        templateId: 'srd-5.1:item:component-pouch',
        item: {
          id: 'srd-5.1:item:component-pouch',
          name: '材料包',
          category: 'container',
          icon: 'generic',
          description: '跨端法术测试用材料包。',
          rulesText: '',
          stackable: false,
          source: { book: 'SRD 5.1', license: 'CC BY 4.0' },
        },
        quantity: 1,
        acquiredAt: Date.now(),
      }],
      currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    },
    dnd5eClassChoices: {
      classes: {
        [classId]: {
          selections: {
            'spell-prepared': spellIds,
            'spell-cantrips': cantripIds,
          },
        },
      },
    },
    classResources: { 'dnd5e-spell-slot-2': { current: 2, max: 3 } },
  }
}

async function seedCombat(
  request: APIRequestContext,
  mapId: string,
  spellIds: string[],
  classId: 'wizard' | 'druid' = 'wizard',
  cantripIds: string[] = [],
) {
  const now = Date.now()
  const character = spellcaster(`${mapId}:spellcaster`, spellIds, classId, cantripIds)
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

async function linkDmWizardToEnemy(
  request: APIRequestContext,
  mapId: string,
  seeded: Awaited<ReturnType<typeof seedCombat>>,
  options: {
    name: string
    spellIds: string[]
    classResources: Record<string, { current: number; max: number }>
    caster?: ReturnType<typeof spellcaster>
  },
) {
  const reactor = {
    ...spellcaster(`${mapId}:reactor`, options.spellIds, 'wizard'),
    name: options.name,
    player: 'DM',
    classResources: options.classResources,
  }
  const mapsState = await getState<{
    maps: Array<Record<string, unknown> & {
      id: string
      tokens: Array<Record<string, unknown> & { id: string }>
    }>
  }>(request, 'maps')
  const seededMap = mapsState.maps.find((map) => map.id === mapId)!
  await putState(request, 'characters', {
    characters: [options.caster ?? seeded.character, reactor],
    selectedId: seeded.character.id,
    updatedAt: Date.now(),
  })
  await putState(request, 'maps', {
    selectedId: mapId,
    updatedAt: Date.now(),
    maps: [{
      ...seededMap,
      tokens: seededMap.tokens.map((token) => token.id === seeded.enemyToken.id
        ? {
            ...token,
            label: reactor.name,
            x: 455,
            size: 1,
            characterId: reactor.id,
            poolId: undefined,
            hp: undefined,
            maxHp: undefined,
          }
        : token),
    }],
  })
  return reactor
}

test('未机械化法术跨端进入 DM Interrupt，裁定后仍等待 DM 手动继续', async ({ browser, request }) => {
  test.setTimeout(90_000)
  const mapId = `spell-interrupt-${Date.now()}`
  const seeded = await seedCombat(request, mapId, ['suggestion'])
  const context = await browser.newContext()
  let dm = await context.newPage()
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

  let dialog = dm.getByTestId('dm-adjudication-dialog')
  await expect(dialog).toBeVisible({ timeout: 20_000 })
  await expect(dialog).toContainText('DM 裁定 · 暗示术')
  await expect(player.getByTestId('dm-adjudication-dialog')).toHaveCount(0)
  await expect(dm.getByTestId('combat-flow-pause-control')).toContainText('DM 裁定中')
  await expect(dm.getByTestId('combat-flow-pause-control')).toBeDisabled()
  await expect(player.getByTestId('combat-flow-pause-label')).toContainText('DM 裁定中')
  await expect.poll(async () => {
    const combat = await getState<{ flowPause?: { phase?: string } }>(request, 'combat')
    return combat.flowPause?.phase
  }).toBe('adjudicating')
  const before = await getState<{ characters: ResourceCharacter[]; _sync?: unknown }>(request, 'characters')
  expect(before.characters[0].classResources?.['dnd5e-spell-slot-2']?.current).toBe(2)

  // 未完成的权威事务不能只存在于 DM 页面的内存里。关闭并重新打开 DM 端后，
  // 同一个裁定窗口应从共享资源恢复，并继续原来的 actionId。
  await dm.close()
  dm = await context.newPage()
  await dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' })
  dialog = dm.getByTestId('dm-adjudication-dialog')
  await expect(dialog).toBeVisible({ timeout: 20_000 })
  await expect(dialog).toContainText('DM 裁定 · 暗示术')

  await dialog.getByRole('button', { name: '＋ 添加目标效果' }).click()
  await dialog.getByLabel('目标').selectOption(seeded.enemyToken.id)
  await dialog.getByLabel('HP 操作').selectOption('damage')
  await dialog.getByLabel('最终数值').fill('7')
  await dialog.getByLabel('添加状态（可选）').fill('魅惑')
  await dialog.getByLabel('DM 裁定备注（可选）').fill('跨端 Interrupt E2E')
  await dialog.getByTestId('dm-adjudication-approve').click()

  await expect(dm.getByTestId('dm-adjudication-dialog')).toHaveCount(0)
  await expect(dm.getByTestId('combat-flow-pause-control')).toContainText('继续战斗', { timeout: 20_000 })
  await expect(dm.getByTestId('combat-flow-pause-control')).toBeEnabled()
  await expect(player.getByTestId('combat-flow-pause-label')).toContainText('等待 DM 继续', { timeout: 20_000 })
  await expect.poll(async () => {
    const combat = await getState<{ flowPause?: { phase?: string } }>(request, 'combat')
    return combat.flowPause?.phase
  }).toBe('awaiting-resume')

  // 裁定已经回答，但门闩尚未打开：资源、伤害和 action ACK 都不能提前提交。
  const pausedCharacters = await getState<{ characters: ResourceCharacter[] }>(request, 'characters')
  expect(pausedCharacters.characters[0].classResources?.['dnd5e-spell-slot-2']?.current).toBe(2)
  const pausedMaps = await getState<{ maps: ResourceMap[] }>(request, 'maps')
  expect(pausedMaps.maps.find((map) => map.id === mapId)?.tokens
    .find((token) => token.id === seeded.enemyToken.id)?.hp).toBe(40)
  const pausedAck = await getState<{ actionId?: string }>(request, 'player-action-ack')
  expect(pausedAck.actionId).not.toBe(action.id)

  await dm.getByTestId('combat-flow-pause-control').click()

  await expect.poll(async () => {
    const ack = await getState<{ actionId?: string; status?: string }>(request, 'player-action-ack')
    return ack.actionId === action.id ? ack.status : ''
  }, { timeout: 30_000 }).toBe('accepted')
  await expect(dm.getByTestId('d20-roll-confirmation')).toHaveCount(0)
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

test('本地扩展随机表暂停状态跨端同步，并由 DM 顶部按钮显式恢复', async ({ browser, request }, testInfo) => {
  test.setTimeout(60_000)
  const mapId = `local-rule-table-pause-${Date.now()}`
  const seeded = await seedCombat(request, mapId, ['magic-missile'])
  const current = await getState<Record<string, unknown> & { _sync?: unknown }>(request, 'combat')
  const combat = { ...current }
  delete combat._sync
  const interruptId = `dm-adjudication:post-spell-random-table:${mapId}:50`
  const pausedAt = Date.now()
  await putState(request, 'combat', {
    ...combat,
    flowPause: {
      schemaVersion: 1,
      reason: 'dm-adjudication',
      phase: 'adjudicating',
      interruptId,
      label: '本地扩展 · 施法后随机表结果 50',
      pausedAt,
    },
  })

  const context = await browser.newContext()
  const dm = await context.newPage()
  const player = await context.newPage()
  await Promise.all([
    dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' }),
    player.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' }),
  ])
  await expect(dm.getByTestId(`initiative-token-${seeded.actorToken.id}`)).toBeVisible({ timeout: 20_000 })
  await expect(dm.getByTestId('combat-flow-pause-control')).toContainText('DM 裁定中')
  await expect(dm.getByTestId('combat-flow-pause-control')).toBeDisabled()
  await expect(dm.getByTestId('combat-flow-pause-overlay')).toContainText('本地扩展 · 施法后随机表结果 50')
  await expect(player.getByTestId('combat-flow-pause-label')).toContainText('DM 裁定中')
  await dm.screenshot({
    path: process.env.LOCAL_RULE_TABLE_ADJUDICATING_SCREENSHOT_PATH ??
      testInfo.outputPath('local-rule-table-adjudicating.png'),
    fullPage: true,
  })

  const latest = await getState<Record<string, unknown> & { _sync?: unknown }>(request, 'combat')
  const latestCombat = { ...latest }
  delete latestCombat._sync
  await putState(request, 'combat', {
    ...latestCombat,
    flowPause: {
      schemaVersion: 1,
      reason: 'dm-adjudication',
      phase: 'awaiting-resume',
      interruptId,
      label: '本地扩展 · 施法后随机表结果 50',
      pausedAt,
      resolvedAt: Date.now(),
    },
  })
  // Reload both clients to prove that the room-level gate survives navigation and
  // to refresh the optimistic sync revision before the DM publishes "continue".
  await Promise.all([
    dm.reload({ waitUntil: 'domcontentloaded' }),
    player.reload({ waitUntil: 'domcontentloaded' }),
  ])
  await expect(dm.getByTestId(`initiative-token-${seeded.actorToken.id}`)).toBeVisible({ timeout: 20_000 })
  await expect(dm.getByTestId('combat-flow-pause-control')).toContainText('继续战斗', { timeout: 20_000 })
  await expect(dm.getByTestId('combat-flow-pause-control')).toBeEnabled()
  await expect(player.getByTestId('combat-flow-pause-label')).toContainText('等待 DM 继续', { timeout: 20_000 })
  await dm.screenshot({
    path: process.env.LOCAL_RULE_TABLE_RESUME_SCREENSHOT_PATH ??
      testInfo.outputPath('local-rule-table-awaiting-resume.png'),
    fullPage: true,
  })

  await dm.getByTestId('combat-flow-pause-control').click()
  await expect(dm.getByTestId('combat-flow-pause-overlay')).toHaveCount(0)
  await expect(player.getByTestId('combat-flow-pause-label')).toHaveCount(0)
  await expect.poll(async () => {
    const state = await getState<{ flowPause?: unknown }>(request, 'combat')
    return state.flowPause == null
  }).toBe(true)
  await context.close()
})

test('普通法术攻击只结算一次：并发重复请求不会重复扣法术位或造成双倍伤害', async ({ browser, request }) => {
  test.setTimeout(90_000)
  const mapId = `spell-attack-${Date.now()}`
  const seeded = await seedCombat(request, mapId, ['acid-arrow'])
  const context = await browser.newContext()
  const dm = await context.newPage()
  const player = await context.newPage()
  await Promise.all([
    dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' }),
    player.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' }),
  ])
  await expect(dm.getByTestId(`initiative-token-${seeded.actorToken.id}`)).toBeVisible({ timeout: 20_000 })
  await useDeterministicBrowserRandom(dm, 0.5)

  const now = Date.now()
  const action = {
    id: `${mapId}:acid-arrow:${now}`,
    mapId,
    combatId: `${mapId}:combat`,
    sourceMode: 'player',
    status: 'pending',
    type: 'dnd5e-spell-cast',
    actorTokenId: seeded.actorToken.id,
    characterId: seeded.character.id,
    targetTokenId: seeded.enemyToken.id,
    dnd5eSpellCast: {
      spellId: 'acid-arrow', castingClassId: 'wizard', slotLevel: 2,
      targetTokenId: seeded.enemyToken.id,
    },
    round: 1,
    initiativeIndex: 0,
    seq: 1,
    updatedAt: now,
  }

  await Promise.all([submitPlayerAction(player, action), submitPlayerAction(player, action)])

  await expect.poll(async () => {
    const ack = await getState<{ actionId?: string; status?: string; reason?: string }>(request, 'player-action-ack')
    return ack.actionId === action.id ? `${ack.status}:${ack.reason ?? ''}` : ''
  }, { timeout: 30_000 }).toBe('accepted:')
  await expect(dm.getByTestId('d20-roll-confirmation')).toHaveCount(0)
  await expect.poll(async () => {
    const state = await getState<{ characters: ResourceCharacter[] }>(request, 'characters')
    return state.characters[0].classResources?.['dnd5e-spell-slot-2']?.current
  }).toBe(1)
  await expect.poll(async () => {
    const state = await getState<{ maps: ResourceMap[] }>(request, 'maps')
    return state.maps.find((map) => map.id === mapId)?.tokens.find((token) => token.id === seeded.enemyToken.id)?.hp
  }).toBe(28)
  const processed = await getState<{ actionIds: string[] }>(request, 'player-action-processed')
  expect(processed.actionIds.filter((id) => id === action.id)).toHaveLength(1)
  await context.close()
})

test('无可用改骰特性时，普通豁免法术直接在 Headless 中结算并同步伤害', async ({ browser, request }) => {
  test.setTimeout(90_000)
  const mapId = `spell-save-${Date.now()}`
  const seeded = await seedCombat(request, mapId, [], 'wizard', ['acid-splash'])
  const context = await browser.newContext()
  const dm = await context.newPage()
  const player = await context.newPage()
  await Promise.all([
    dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' }),
    player.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' }),
  ])
  await expect(dm.getByTestId(`initiative-token-${seeded.actorToken.id}`)).toBeVisible({ timeout: 20_000 })
  await useDeterministicBrowserRandom(dm, 0)

  const now = Date.now()
  const action = {
    id: `${mapId}:acid-splash:${now}`,
    mapId,
    combatId: `${mapId}:combat`,
    sourceMode: 'player',
    status: 'pending',
    type: 'dnd5e-spell-cast',
    actorTokenId: seeded.actorToken.id,
    characterId: seeded.character.id,
    targetTokenId: seeded.enemyToken.id,
    dnd5eSpellCast: {
      spellId: 'acid-splash', castingClassId: 'wizard', slotLevel: 0,
      targetTokenId: seeded.enemyToken.id, targetTokenIds: [seeded.enemyToken.id],
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
    return state.maps.find((map) => map.id === mapId)?.tokens.find((token) => token.id === seeded.enemyToken.id)?.hp
  }).toBe(38)
  await context.close()
})

test('法术反制通过共享 Interrupt 消耗双方资源并阻止原法术效果', async ({ browser, request }) => {
  test.setTimeout(90_000)
  const mapId = `spell-counterspell-${Date.now()}`
  const seeded = await seedCombat(request, mapId, ['acid-arrow'])
  const reactor = await linkDmWizardToEnemy(request, mapId, seeded, {
    name: '反制法师',
    spellIds: ['counterspell'],
    classResources: {
      'dnd5e-spell-slot-2': { current: 0, max: 3 },
      'dnd5e-spell-slot-3': { current: 1, max: 2 },
    },
  })

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
    id: `${mapId}:countered-acid-arrow:${now}`,
    mapId,
    combatId: `${mapId}:combat`,
    sourceMode: 'player',
    status: 'pending',
    type: 'dnd5e-spell-cast',
    actorTokenId: seeded.actorToken.id,
    characterId: seeded.character.id,
    targetTokenId: seeded.enemyToken.id,
    dnd5eSpellCast: {
      spellId: 'acid-arrow', castingClassId: 'wizard', slotLevel: 2,
      targetTokenId: seeded.enemyToken.id,
    },
    round: 1,
    initiativeIndex: 0,
    seq: 1,
    updatedAt: now,
  }
  await submitPlayerAction(player, action)
  await expect(dm.getByTestId('shared-counterspell-use')).toBeVisible({ timeout: 20_000 })
  await expect(player.getByTestId('shared-counterspell-use')).toHaveCount(0)
  await dm.getByTestId('shared-counterspell-use').click()

  await expect.poll(async () => {
    const ack = await getState<{ actionId?: string; status?: string }>(request, 'player-action-ack')
    return ack.actionId === action.id ? ack.status : ''
  }, { timeout: 30_000 }).toBe('accepted')
  await expect(dm.getByTestId('d20-roll-confirmation')).toHaveCount(0)
  await expect.poll(async () => {
    const state = await getState<{ characters: ResourceCharacter[] }>(request, 'characters')
    return state.characters.map((character) => ({
      id: character.id,
      slot2: character.classResources?.['dnd5e-spell-slot-2']?.current,
      slot3: character.classResources?.['dnd5e-spell-slot-3']?.current,
    }))
  }).toEqual([
    { id: seeded.character.id, slot2: 1, slot3: 2 },
    { id: reactor.id, slot2: 0, slot3: 0 },
  ])
  const finalMaps = await getState<{ maps: ResourceMap[] }>(request, 'maps')
  expect(finalMaps.maps.find((map) => map.id === mapId)?.tokens.find((token) => token.id === seeded.enemyToken.id)?.hp).toBe(32)
  await context.close()
})

test('低环法术反制检定失败后继续原法术，并仍消耗双方已承诺的法术位', async ({ browser, request }) => {
  test.setTimeout(90_000)
  const mapId = `spell-counterspell-failed-${Date.now()}`
  const seeded = await seedCombat(request, mapId, ['acid-arrow'])
  const caster = {
    ...seeded.character,
    level: 7,
    dnd5eClassLevels: { wizard: 7 },
    classResources: {
      ...seeded.character.classResources,
      'dnd5e-spell-slot-4': { current: 1, max: 1 },
    },
  }
  const reactor = await linkDmWizardToEnemy(request, mapId, seeded, {
    name: '低环反制法师',
    spellIds: ['counterspell'],
    caster,
    classResources: {
      'dnd5e-spell-slot-2': { current: 0, max: 3 },
      'dnd5e-spell-slot-3': { current: 1, max: 2 },
    },
  })

  const context = await browser.newContext()
  const dm = await context.newPage()
  const player = await context.newPage()
  await Promise.all([
    dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' }),
    player.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' }),
  ])
  await expect(dm.getByTestId(`initiative-token-${seeded.actorToken.id}`)).toBeVisible({ timeout: 20_000 })
  await useDeterministicBrowserRandom(dm, 0)

  const now = Date.now()
  const action = {
    id: `${mapId}:failed-counterspell:${now}`,
    mapId,
    combatId: `${mapId}:combat`,
    sourceMode: 'player',
    status: 'pending',
    type: 'dnd5e-spell-cast',
    actorTokenId: seeded.actorToken.id,
    characterId: seeded.character.id,
    targetTokenId: seeded.enemyToken.id,
    dnd5eSpellCast: {
      spellId: 'acid-arrow', castingClassId: 'wizard', slotLevel: 4,
      targetTokenId: seeded.enemyToken.id,
    },
    round: 1,
    initiativeIndex: 0,
    seq: 1,
    updatedAt: now,
  }
  await submitPlayerAction(player, action)
  await expect(dm.getByTestId('shared-counterspell-use')).toBeVisible({ timeout: 20_000 })
  await dm.getByTestId('shared-counterspell-use').click()

  await expect.poll(async () => {
    const ack = await getState<{ actionId?: string; status?: string }>(request, 'player-action-ack')
    return ack.actionId === action.id ? ack.status : ''
  }, { timeout: 30_000 }).toBe('accepted')
  await expect.poll(async () => {
    const state = await getState<{ characters: ResourceCharacter[] }>(request, 'characters')
    return state.characters.map((character) => ({
      id: character.id,
      slot3: character.classResources?.['dnd5e-spell-slot-3']?.current,
      slot4: character.classResources?.['dnd5e-spell-slot-4']?.current,
    }))
  }).toEqual([
    { id: seeded.character.id, slot3: 3, slot4: 0 },
    { id: reactor.id, slot3: 0, slot4: undefined },
  ])
  const finalMaps = await getState<{ maps: ResourceMap[] }>(request, 'maps')
  expect(finalMaps.maps.find((map) => map.id === mapId)?.tokens.find((token) => token.id === seeded.enemyToken.id)?.hp).toBe(29)
  const interrupts = await getState<{
    interrupts: Array<{ kind: string; status: string; payload?: { label?: string } }>
  }>(request, 'combat-interrupts')
  expect(interrupts.interrupts.filter((interrupt) => interrupt.kind === 'roll-confirmation')).toEqual([])
  await context.close()
})

test('DM 控制角色施放护盾术后重新判定命中，消耗反应与最低可用法术位', async ({ browser, request }) => {
  test.setTimeout(90_000)
  const mapId = `spell-shield-${Date.now()}`
  const seeded = await seedCombat(request, mapId, ['acid-arrow'])
  const reactor = await linkDmWizardToEnemy(request, mapId, seeded, {
    name: '护盾法师',
    spellIds: ['shield'],
    classResources: {
      'dnd5e-spell-slot-1': { current: 1, max: 4 },
      'dnd5e-spell-slot-2': { current: 0, max: 3 },
    },
  })

  const context = await browser.newContext()
  const dm = await context.newPage()
  const player = await context.newPage()
  await Promise.all([
    dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' }),
    player.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' }),
  ])
  await expect(dm.getByTestId(`initiative-token-${seeded.actorToken.id}`)).toBeVisible({ timeout: 20_000 })
  // d20=9, spell attack total=16. The target's derived AC is 12, so Shield
  // changes the triggering hit into a miss at AC 17.
  await useDeterministicBrowserRandom(dm, 0.4)

  const now = Date.now()
  const action = {
    id: `${mapId}:shielded-acid-arrow:${now}`,
    mapId,
    combatId: `${mapId}:combat`,
    sourceMode: 'player',
    status: 'pending',
    type: 'dnd5e-spell-cast',
    actorTokenId: seeded.actorToken.id,
    characterId: seeded.character.id,
    targetTokenId: seeded.enemyToken.id,
    dnd5eSpellCast: {
      spellId: 'acid-arrow', castingClassId: 'wizard', slotLevel: 2,
      targetTokenId: seeded.enemyToken.id,
    },
    round: 1,
    initiativeIndex: 0,
    seq: 1,
    updatedAt: now,
  }
  await submitPlayerAction(player, action)
  await expect(dm.getByTestId('shared-shield-spell-use')).toBeVisible({ timeout: 20_000 })
  await expect(player.getByTestId('shared-shield-spell-use')).toHaveCount(0)
  await dm.getByTestId('shared-shield-spell-use').click()

  await expect.poll(async () => {
    const ack = await getState<{ actionId?: string; status?: string }>(request, 'player-action-ack')
    return ack.actionId === action.id ? ack.status : ''
  }, { timeout: 30_000 }).toBe('accepted')
  await expect.poll(async () => {
    const state = await getState<{ characters: ResourceCharacter[] }>(request, 'characters')
    return state.characters.map((character) => ({
      id: character.id,
      hp: character.currentHp,
      slot1: character.classResources?.['dnd5e-spell-slot-1']?.current,
      slot2: character.classResources?.['dnd5e-spell-slot-2']?.current,
      acidArrowDelayedEffects: character.dnd5eCombatState?.activeEffects?.filter(
        (effect) => effect.definitionId === 'srd-5.1:spell:acid-arrow:delayed-damage',
      ).length ?? 0,
    }))
  }).toEqual([
    { id: seeded.character.id, hp: 32, slot1: 4, slot2: 1, acidArrowDelayedEffects: 0 },
    // Shield turns Acid Arrow into a miss, but Acid Arrow still deals half of
    // its 4d4 initial damage on a miss. With the deterministic dice this is 4
    // damage from the target's initial 32 HP; delayed damage is not created.
    { id: reactor.id, hp: 28, slot1: 0, slot2: 0, acidArrowDelayedEffects: 0 },
  ])
  await context.close()
})

test('火球术在骰子动画结束或超时后仍完成 8d6 权威伤害并跨端同步', async ({ browser, request }) => {
  test.setTimeout(90_000)
  const mapId = `spell-fireball-${Date.now()}`
  const seeded = await seedCombat(request, mapId, ['fireball'])
  const context = await browser.newContext()
  const dm = await context.newPage()
  const player = await context.newPage()
  await Promise.all([
    dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' }),
    player.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' }),
  ])
  await expect(dm.getByTestId(`initiative-token-${seeded.actorToken.id}`)).toBeVisible({ timeout: 20_000 })
  // d20=11; the Ogre's Dexterity modifier makes the save fail. Every d6=4.
  await useDeterministicBrowserRandom(dm, 0.5)

  const now = Date.now()
  const action = {
    id: `${mapId}:fireball:${now}`,
    mapId,
    combatId: `${mapId}:combat`,
    sourceMode: 'player',
    status: 'pending',
    type: 'dnd5e-spell-cast',
    actorTokenId: seeded.actorToken.id,
    characterId: seeded.character.id,
    targetTokenId: seeded.actorToken.id,
    targetTokenIds: [],
    dnd5eSpellCast: {
      spellId: 'fireball',
      castingClassId: 'wizard',
      slotLevel: 3,
      targetTokenId: seeded.actorToken.id,
      targetTokenIds: [],
      areaTargetCell: { col: 8, row: 2 },
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
  }, { timeout: 45_000 }).toBe('accepted:')
  await expect.poll(async () => {
    const state = await getState<{ maps: ResourceMap[] }>(request, 'maps')
    return state.maps.find((map) => map.id === mapId)?.tokens
      .find((token) => token.id === seeded.enemyToken.id)?.hp
  }).toBe(8)
  await expect.poll(async () => {
    const state = await getState<{ characters: ResourceCharacter[] }>(request, 'characters')
    return state.characters[0].classResources?.['dnd5e-spell-slot-3']?.current
  }).toBe(1)
  const playerMaps = await loadPlayerState<{ maps: ResourceMap[] }>(player, 'maps')
  expect(playerMaps.maps.find((map) => map.id === mapId)?.tokens
    .find((token) => token.id === seeded.enemyToken.id)?.hp).toBe(8)
  await context.close()
})

test('魔法飞弹逐枚接受目标分配并只执行一次权威事务', async ({ browser, request }) => {
  test.setTimeout(90_000)
  const mapId = `spell-magic-missile-${Date.now()}`
  const seeded = await seedCombat(request, mapId, ['magic-missile'])
  const context = await browser.newContext()
  const dm = await context.newPage()
  const player = await context.newPage()
  await Promise.all([
    dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' }),
    player.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' }),
  ])
  await expect(dm.getByTestId(`initiative-token-${seeded.actorToken.id}`)).toBeVisible({ timeout: 20_000 })
  // Every d4=3, then each dart adds +1: three darts deal 12 total damage.
  await useDeterministicBrowserRandom(dm, 0.5)

  const now = Date.now()
  const action = {
    id: `${mapId}:magic-missile:${now}`,
    mapId,
    combatId: `${mapId}:combat`,
    sourceMode: 'player',
    status: 'pending',
    type: 'dnd5e-spell-cast',
    actorTokenId: seeded.actorToken.id,
    characterId: seeded.character.id,
    targetTokenId: seeded.enemyToken.id,
    targetTokenIds: [seeded.enemyToken.id],
    dnd5eSpellCast: {
      spellId: 'magic-missile',
      castingClassId: 'wizard',
      slotLevel: 1,
      targetTokenId: seeded.enemyToken.id,
      targetTokenIds: [seeded.enemyToken.id],
      projectileTargetIds: [
        seeded.enemyToken.id,
        seeded.enemyToken.id,
        seeded.enemyToken.id,
      ],
    },
    round: 1,
    initiativeIndex: 0,
    seq: 1,
    updatedAt: now,
  }
  await Promise.all([submitPlayerAction(player, action), submitPlayerAction(player, action)])

  await expect.poll(async () => {
    const ack = await getState<{ actionId?: string; status?: string; reason?: string }>(request, 'player-action-ack')
    return ack.actionId === action.id ? `${ack.status}:${ack.reason ?? ''}` : ''
  }, { timeout: 45_000 }).toBe('accepted:')
  await expect.poll(async () => {
    const state = await getState<{ maps: ResourceMap[] }>(request, 'maps')
    return state.maps.find((map) => map.id === mapId)?.tokens
      .find((token) => token.id === seeded.enemyToken.id)?.hp
  }).toBe(28)
  await expect.poll(async () => {
    const state = await getState<{ characters: ResourceCharacter[] }>(request, 'characters')
    return state.characters[0].classResources?.['dnd5e-spell-slot-1']?.current
  }).toBe(3)
  const processed = await getState<{ actionIds: string[] }>(request, 'player-action-processed')
  expect(processed.actionIds.filter((id) => id === action.id)).toHaveLength(1)
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
  }, { timeout: 30_000 }).toEqual([{
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
