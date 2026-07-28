import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'
const PLAYER1 = 'http://127.0.0.1:6174'
const PLAYER2 = 'http://127.0.0.1:6175'

function center(col: number, row: number, gridSize = 70) {
  return {
    x: (col + 0.5) * gridSize,
    y: (row + 0.5) * gridSize,
  }
}

function arrowInventory(quantity = 20) {
  return {
    schemaVersion: 3,
    entries: [{
      instanceId: 'player2-red-dragon-arrows',
      templateId: 'srd-5.1:item:arrows',
      item: {
        id: 'srd-5.1:item:arrows',
        name: '箭',
        englishName: 'Arrows',
        category: 'adventuring-gear',
        icon: 'generic',
        description: 'SRD 5.1 冒险装备。',
        rulesText: '短弓和长弓使用的弹药。',
        weightLb: 0.05,
        cost: { amount: 5, currency: 'cp' },
        ammunitionKind: 'arrow',
        stackable: true,
        source: { book: 'SRD 5.1', license: 'CC BY 4.0' },
      },
      quantity,
      identified: true,
      acquiredAt: 0,
    }],
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
  }
}

function player2Character() {
  return {
    id: 'player2-red-dragon-hero',
    rulesetId: 'dnd5e-2014-srd-5.1',
    name: 'E2E 玩家2弓手',
    player: '玩家2',
    avatar: '🧝',
    accent: 'from-emerald-500 to-cyan-500',
    race: 'Human',
    charClass: '战士',
    dnd5eClassId: 'fighter',
    level: 5,
    background: '',
    experience: 0,
    reputation: 0,
    abilities: { str: 10, dex: 30, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: [],
    skills: [],
    maxHp: 80,
    currentHp: 80,
    tempHp: 0,
    hitDice: '1d8',
    ac: 18,
    speed: 30,
    initiativeBonus: 0,
    saveDC: 12,
    passivePerception: 10,
    inspiration: 0,
    equipment: {
      mainWeapon: {
        id: 'dnd5e-longbow',
        name: '长弓',
        slot: 'mainWeapon',
        dnd5e: {
          kind: 'weapon',
          category: 'martial',
          mode: 'ranged',
          damage: { count: 1, sides: 8, type: 'piercing' },
          attackAbility: 'dex',
          rangeFeet: { normal: 150, long: 600 },
          properties: ['弹药', '重型', '双手'],
        },
      },
      armor: {
        id: 'dnd5e-leather-armor',
        name: '皮甲',
        slot: 'armor',
        ac: 11,
        dnd5e: { kind: 'armor', category: 'light', baseArmorClass: 11, dexterityBonus: 'full' },
      },
    },
    dnd5eInventory: arrowInventory(),
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
  }
}

async function putState(request: APIRequestContext, name: string, payload: unknown) {
  const res = await request.put(`${DM}/api/state/${name}`, { data: payload })
  expect(res.ok()).toBeTruthy()
}

async function getState<T>(request: APIRequestContext, name: string): Promise<T> {
  const res = await request.get(`${DM}/api/state/${name}`)
  expect(res.ok()).toBeTruthy()
  return (await res.json()) as T
}

async function clearEvents(request: APIRequestContext) {
  const res = await request.delete(`${DM}/api/events/_all`)
  expect(res.ok()).toBeTruthy()
}

async function seedPlayer2VsRedDragon(request: APIRequestContext, mapId: string) {
  const now = Date.now()
  const combatId = `${mapId}:combat`
  await clearEvents(request)
  await putState(request, 'characters', {
    characters: [player2Character()],
    selectedId: 'player2-red-dragon-hero',
    updatedAt: now,
  })
  await putState(request, 'maps', {
    selectedId: mapId,
    updatedAt: now,
    maps: [
      {
        id: mapId,
        name: `E2E 玩家2 vs 红龙雏龙 ${mapId}`,
        width: 980,
        height: 700,
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
          {
            id: 'player2-token',
            label: 'E2E 玩家2弓手',
            ...center(2, 2),
            color: '#34d399',
            emoji: '🧝',
            size: 1,
            type: 'player',
            characterId: 'player2-red-dragon-hero',
          },
          {
            id: 'red-dragon-token',
            label: '红龙雏龙',
            ...center(6, 2),
            color: '#ef4444',
            emoji: '🐉',
            size: 2,
            type: 'enemy',
            hp: 52,
            maxHp: 52,
            poolId: 'wyrmling-red',
            showHpOnToken: true,
            showDetailOnToken: true,
          },
        ],
      },
    ],
  })
  await putState(request, 'combat-log', { mapId, entries: [], updatedAt: now })
  await putState(request, 'dodge', { id: `${mapId}:none`, mapId, status: 'done', updatedAt: now })
  await putState(request, 'stable-mind', { id: `${mapId}:none`, mapId, status: 'done', updatedAt: now })
  await putState(request, 'player-action', { id: `${mapId}:none`, mapId, combatId, status: 'done', updatedAt: now })
  await putState(request, 'player-action-requests', { mapId, combatId, requests: [], updatedAt: now })
  await putState(request, 'player-action-processed', { mapId, combatId, actionIds: [], updatedAt: now })
  await putState(request, 'player-action-ack', {
    id: `${mapId}:none`,
    mapId,
    combatId,
    actionId: 'none',
    status: 'accepted',
    round: 1,
    initiativeIndex: 0,
    updatedAt: now,
  })
  await putState(request, 'combat', {
    mapId,
    combatId,
    active: true,
    round: 1,
    initiativeIndex: 0,
    initiativeOrder: [
      { tokenId: 'player2-token', label: 'E2E 玩家2弓手', emoji: '🧝', color: '#34d399', roll: 20 },
      { tokenId: 'red-dragon-token', label: '红龙雏龙', emoji: '🐉', color: '#ef4444', roll: 10 },
    ],
    updatedAt: now,
  })
}

async function sendPlayer2Action(page: Page, action: Record<string, unknown>) {
  await page.evaluate(async (payload) => {
    const protocolHeaders = {
      'X-Stars-Protocol': '5',
      'X-Stars-Writer': 'e2e-player2-direct-client',
    }
    let queued = false
    let queueError = ''
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const queueRes = await fetch('http://127.0.0.1:6173/api/state/player-action-requests')
        const queue = queueRes.ok
          ? ((await queueRes.json()) as { requests?: Record<string, unknown>[]; _sync?: { revision?: number } })
          : { requests: [] }
        if (!queueRes.ok && queueRes.status !== 404) {
          queueError = `GET ${queueRes.status}`
        } else {
          const requests = queue.requests ?? []
          if (requests.some((request) => request.id === payload.id)) {
            queued = true
            break
          }
          const revision = Number(queueRes.headers.get('X-Stars-State-Revision') ?? queue._sync?.revision ?? 0)
          const put = await fetch('http://127.0.0.1:6173/api/state/player-action-requests', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              ...protocolHeaders,
              'X-Stars-Expected-Revision': String(Number.isInteger(revision) ? revision : 0),
            },
            body: JSON.stringify({
              mapId: payload.mapId,
              combatId: payload.combatId,
              requests: [...requests, payload],
              updatedAt: Date.now(),
            }),
          })
          if (put.ok) {
            queued = true
            break
          }
          queueError = `${put.status}: ${await put.text()}`
          if (put.status < 500 && put.status !== 409) break
        }
      } catch (error) {
        queueError = error instanceof Error ? error.message : String(error)
      }
      await new Promise((resolve) => setTimeout(resolve, 80 * 2 ** attempt))
    }
    if (!queued) throw new Error(`player-action request queue PUT failed: ${queueError}`)

    let posted = false
    let postError = ''
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const post = await fetch('http://127.0.0.1:6173/api/events/player-action-player-to-dm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...protocolHeaders },
          body: JSON.stringify(payload),
        })
        if (post.ok) {
          posted = true
          break
        }
        postError = `${post.status}: ${await post.text()}`
        if (post.status < 500) break
      } catch (error) {
        postError = error instanceof Error ? error.message : String(error)
      }
      await new Promise((resolve) => setTimeout(resolve, 80 * 2 ** attempt))
    }
    if (!posted) throw new Error(`player-action event failed: ${postError}`)
  }, action)
}

async function loadPlayer2State<T>(page: Page, name: string): Promise<T> {
  return page.evaluate(async (stateName) => {
    const res = await fetch(`/api/state/${stateName}`)
    if (!res.ok) throw new Error(`GET ${stateName} failed: ${res.status}`)
    return res.json()
  }, name) as Promise<T>
}

async function waitForCombatReady(page: Page, tokenId: string) {
  await expect(page.getByTestId(`initiative-token-${tokenId}`)).toBeVisible({ timeout: 20_000 })
}

test('player2 port 6175 sends a 5e weapon attack to DM and receives the red-dragon result', async ({
  browser,
  request,
}) => {
  const mapId = `e2e-player2-red-dragon-${Date.now()}`
  await seedPlayer2VsRedDragon(request, mapId)

  const context = await browser.newContext()
  const dm = await context.newPage()
  const player2 = await context.newPage()
  await Promise.all([
    dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' }),
    player2.goto(`${PLAYER2}/maps`, { waitUntil: 'domcontentloaded' }),
  ])
  await waitForCombatReady(dm, 'player2-token')
  // 固定本用例的骰面，避免天然 1 让“命中后伤害同步”断言出现 5% 随机失败。
  await dm.evaluate(() => { Math.random = () => 0.75 })

  await expect
    .poll(
      async () => {
        const combat = await getState<{ mapId?: string; active?: boolean; initiativeIndex?: number }>(request, 'combat')
        return combat.mapId === mapId && combat.active === true && combat.initiativeIndex === 0
      },
      { timeout: 20_000 },
    )
    .toBe(true)

  const now = Date.now()
  const action = {
    id: `${mapId}:player2-action:${now}:basic-shot`,
    mapId,
    combatId: `${mapId}:combat`,
    sourceMode: 'player',
    status: 'pending',
    type: 'dnd5e-weapon-attack',
    actorTokenId: 'player2-token',
    characterId: 'player2-red-dragon-hero',
    targetTokenId: 'red-dragon-token',
    round: 1,
    initiativeIndex: 0,
    seq: 1,
    updatedAt: now,
  }
  await sendPlayer2Action(player2, action)

  // DM 先确认本次攻击的权威掩护预览。
  await expect(dm.getByText('掩护预览', { exact: true })).toBeVisible({ timeout: 20_000 })
  await dm.getByRole('button', { name: '应用并继续结算' }).click()
  // 没有任何玩家拥有“改变敌方 d20”特性时，攻击骰直接结算。
  await expect(dm.getByTestId('d20-roll-confirmation')).toHaveCount(0)

  await expect
    .poll(
      async () => {
        const ack = await getState<{ actionId?: string; status?: string; reason?: string }>(
          request,
          'player-action-ack',
        )
        return ack.actionId === action.id ? ack.status : ''
      },
      { timeout: 45_000 },
    )
    .toBe('accepted')

  await expect
    .poll(
      async () => {
        const maps = await getState<{ maps: Array<{ id: string; tokens: Array<{ id: string; hp?: number }> }> }>(
          request,
          'maps',
        )
        return maps.maps.find((map) => map.id === mapId)?.tokens.find((token) => token.id === 'red-dragon-token')?.hp
      },
      { timeout: 30_000 },
    )
    .toBeLessThan(52)

  const player2Ack = await loadPlayer2State<{ actionId?: string; status?: string }>(player2, 'player-action-ack')
  expect(player2Ack.actionId).toBe(action.id)
  expect(player2Ack.status).toBe('accepted')

  const player2Maps = await loadPlayer2State<{
    maps: Array<{ id: string; tokens: Array<{ id: string; hp?: number; x: number; y: number }> }>
  }>(player2, 'maps')
  const player2Map = player2Maps.maps.find((map) => map.id === mapId)
  const player2Hero = player2Map?.tokens.find((token) => token.id === 'player2-token')
  const player2Dragon = player2Map?.tokens.find((token) => token.id === 'red-dragon-token')
  expect(player2Hero).toMatchObject(center(2, 2))
  expect(player2Dragon).toMatchObject(center(6, 2))
  expect(player2Dragon?.hp).toBeLessThan(52)

  const log = await getState<{ entries: Array<{ text: string }> }>(request, 'combat-log')
  const text = log.entries.map((entry) => entry.text).join('\n')
  expect(text).toContain('长弓')
  expect(text).toContain('红龙雏龙')

  await context.close()
})

test('player2 queued movement is DM-authorized, spends 5e movement, and syncs token position', async ({ browser, request }) => {
  const mapId = `e2e-player2-red-dragon-move-${Date.now()}`
  await seedPlayer2VsRedDragon(request, mapId)

  const context = await browser.newContext()
  const dm = await context.newPage()
  const player2 = await context.newPage()
  await Promise.all([
    dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' }),
    player2.goto(`${PLAYER2}/maps`, { waitUntil: 'domcontentloaded' }),
  ])
  await waitForCombatReady(dm, 'player2-token')

  const now = Date.now()
  const targetPosition = center(3, 2)
  const action = {
    id: `${mapId}:player2-action:${now}:move`,
    mapId,
    combatId: `${mapId}:combat`,
    sourceMode: 'player',
    status: 'pending',
    type: 'move-token',
    actorTokenId: 'player2-token',
    characterId: 'player2-red-dragon-hero',
    targetPosition,
    round: 1,
    initiativeIndex: 0,
    seq: 1,
    updatedAt: now,
  }
  await sendPlayer2Action(player2, action)

  await expect
    .poll(
      async () => {
        const ack = await getState<{ actionId?: string; status?: string; acceptedPosition?: { x: number; y: number } }>(
          request,
          'player-action-ack',
        )
        return ack.actionId === action.id && ack.status === 'accepted' ? ack.acceptedPosition : null
      },
      { timeout: 30_000 },
    )
    .toMatchObject(targetPosition)

  await expect.poll(async () => {
    const combat = await getState<{
      dnd5eTurnEconomyByToken?: Record<string, { movement?: { current: number } }>
    }>(request, 'combat')
    return combat.dnd5eTurnEconomyByToken?.['player2-token']?.movement?.current
  }, { timeout: 30_000 }).toBe(25)

  const player2Maps = await loadPlayer2State<{
    maps: Array<{ id: string; tokens: Array<{ id: string; x: number; y: number }> }>
  }>(player2, 'maps')
  const player2Hero = player2Maps.maps.find((map) => map.id === mapId)?.tokens.find((token) => token.id === 'player2-token')
  expect(player2Hero).toMatchObject(targetPosition)

  await context.close()
})

test('three clients keep one authoritative transaction across duplicate, stale, and reconnect delivery', async ({
  browser,
  request,
}) => {
  const mapId = `e2e-three-client-authority-${Date.now()}`
  const combatId = `${mapId}:combat`
  await seedPlayer2VsRedDragon(request, mapId)

  const context = await browser.newContext()
  const dm = await context.newPage()
  const player1 = await context.newPage()
  const player2 = await context.newPage()
  await Promise.all([
    dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' }),
    player1.goto(`${PLAYER1}/maps`, { waitUntil: 'domcontentloaded' }),
    player2.goto(`${PLAYER2}/maps`, { waitUntil: 'domcontentloaded' }),
  ])
  await waitForCombatReady(dm, 'player2-token')

  const now = Date.now()
  const targetPosition = center(3, 2)
  const moveAction = {
    id: `${mapId}:move:${now}`,
    mapId,
    combatId,
    sourceMode: 'player',
    status: 'pending',
    type: 'move-token',
    actorTokenId: 'player2-token',
    characterId: 'player2-red-dragon-hero',
    targetPosition,
    round: 1,
    initiativeIndex: 0,
    seq: 1,
    updatedAt: now,
  }
  await sendPlayer2Action(player2, moveAction)

  await expect
    .poll(async () => {
      const ack = await getState<{ actionId?: string; status?: string }>(request, 'player-action-ack')
      return ack.actionId === moveAction.id ? ack.status : ''
    })
    .toBe('accepted')
  await expect.poll(async () => {
    const combat = await getState<{
      dnd5eTurnEconomyByToken?: Record<string, { movement?: { current: number } }>
    }>(request, 'combat')
    return combat.dnd5eTurnEconomyByToken?.['player2-token']?.movement?.current
  }).toBe(25)

  await sendPlayer2Action(player2, moveAction)
  await player2.waitForTimeout(1200)
  const afterDuplicate = await getState<{
    dnd5eTurnEconomyByToken?: Record<string, { movement?: { current: number } }>
  }>(request, 'combat')
  expect(afterDuplicate.dnd5eTurnEconomyByToken?.['player2-token']?.movement?.current).toBe(25)
  const processed = await getState<{ actionIds: string[] }>(request, 'player-action-processed')
  expect(processed.actionIds.filter((id) => id === moveAction.id)).toHaveLength(1)

  const staleAction = {
    ...moveAction,
    id: `${mapId}:stale:${now + 1}`,
    combatId: `${mapId}:old-combat`,
    seq: 2,
    updatedAt: now + 1,
  }
  await sendPlayer2Action(player2, staleAction)
  await expect
    .poll(async () => {
      const ack = await getState<{ actionId?: string; status?: string; reason?: string }>(
        request,
        'player-action-ack',
      )
      return ack.actionId === staleAction.id ? `${ack.status}:${ack.reason}` : ''
    })
    .toBe('rejected:stale-combat')

  await player2.reload({ waitUntil: 'domcontentloaded' })
  await expect
    .poll(async () => {
      const maps = await loadPlayer2State<{
        maps: Array<{ id: string; tokens: Array<{ id: string; x: number; y: number }> }>
      }>(player2, 'maps')
      return maps.maps.find((map) => map.id === mapId)?.tokens.find((token) => token.id === 'player2-token')
    })
    .toMatchObject(targetPosition)

  const observerMaps = await loadPlayer2State<{
    maps: Array<{ id: string; tokens: Array<{ id: string; x: number; y: number }> }>
  }>(player1, 'maps')
  expect(observerMaps.maps.find((map) => map.id === mapId)?.tokens.find((token) => token.id === 'player2-token')).toMatchObject(
    targetPosition,
  )

  await context.close()
})
