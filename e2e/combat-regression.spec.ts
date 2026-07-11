import { expect, test, type APIRequestContext } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'
const PLAYER = 'http://127.0.0.1:6174'

function center(col: number, row: number, gridSize = 70) {
  return {
    x: (col + 0.5) * gridSize,
    y: (row + 0.5) * gridSize,
  }
}

function heroCharacter(patch: Record<string, unknown> = {}) {
  return {
    id: 'hero-regression',
    name: 'E2E Adventurer',
    player: 'E2E',
    avatar: '🧝',
    accent: 'from-emerald-500 to-cyan-500',
    race: 'Human',
    charClass: '弓手',
    level: 5,
    background: '',
    experience: 0,
    reputation: 0,
    abilities: { str: 10, dex: 30, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: [],
    skills: [],
    maxHp: 100,
    currentHp: 100,
    tempHp: 0,
    hitDice: '1d8',
    ac: 99,
    speed: 30,
    initiativeBonus: 0,
    saveDC: 12,
    actionPoints: 2,
    currentAP: 2,
    passivePerception: 10,
    inspiration: 0,
    mana: 0,
    maxMana: 0,
    traits: [],
    combatSkills: [],
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    combatBuffs: {},
    ...patch,
  }
}

async function putState(request: APIRequestContext, name: string, payload: unknown) {
  const res = await request.put(`${DM}/api/state/${name}`, { data: payload })
  expect(res.ok()).toBeTruthy()
}

async function postEvent(request: APIRequestContext, channel: string, payload: unknown) {
  const res = await request.post(`${DM}/api/events/${channel}`, { data: payload })
  expect(res.ok()).toBeTruthy()
}

async function clearEvents(request: APIRequestContext) {
  const res = await request.delete(`${DM}/api/events/_all`)
  expect(res.ok()).toBeTruthy()
}

async function getState<T>(request: APIRequestContext, name: string): Promise<T> {
  const res = await request.get(`${DM}/api/state/${name}`)
  expect(res.ok()).toBeTruthy()
  return (await res.json()) as T
}

async function waitForCombatReady(page: Page, tokenId: string) {
  await expect(page.getByTestId(`initiative-token-${tokenId}`)).toBeVisible({ timeout: 20_000 })
}

async function seedEncounter(
  request: APIRequestContext,
  mapId: string,
  opts: {
    playerFirst?: boolean
    redDragonFirst?: boolean
    heroPatch?: Record<string, unknown>
    heroTraits?: Array<Record<string, unknown>>
    enemyApByToken?: Record<string, { current: number; max: number }>
    tokenOverrides?: Record<string, Record<string, unknown>>
    extraTokens?: Array<Record<string, unknown>>
  } = {},
) {
  const now = Date.now()
  const combatId = `${mapId}:combat`
  await clearEvents(request)
  await putState(request, 'characters', {
    characters: [
      heroCharacter(
        {
          ...(opts.heroPatch ?? {}),
          traits:
            opts.heroTraits ??
            (opts.playerFirst
              ? [
                  {
                    id: 'precise-regression',
                    name: '精准打击',
                    level: 1,
                    uses: 1,
                    maxUses: 1,
                    description: '使得下一次攻击必定造成重击。',
                    featureKey: 'preciseStrike',
                  },
                ]
              : []),
        },
      ),
    ],
    selectedId: 'hero-regression',
    updatedAt: now,
  })
  const tokens: Array<Record<string, unknown>> = [
    {
      id: 'goblin-regression',
      label: 'E2E Goblin',
      ...center(1, 1),
      color: '#f87171',
      emoji: '👺',
      size: 1,
      type: 'enemy',
      hp: 20,
      maxHp: 20,
      poolId: 'goblin',
      showHpOnToken: true,
      showDetailOnToken: true,
    },
    {
      id: 'red-dragon-regression',
      label: 'E2E Red Dragon Wyrmling',
      ...center(2, 2),
      color: '#ef4444',
      emoji: '🐉',
      size: 1,
      type: 'enemy',
      hp: 40,
      maxHp: 40,
      poolId: 'wyrmling-red',
      showHpOnToken: true,
      showDetailOnToken: true,
    },
    {
      id: 'player-regression',
      label: 'E2E Adventurer',
      ...center(10, 1),
      color: '#34d399',
      emoji: '🧝',
      size: 1,
      type: 'player',
      characterId: 'hero-regression',
    },
  ].map((token) => ({ ...token, ...(opts.tokenOverrides?.[token.id] ?? {}) }))
  if (opts.extraTokens) tokens.push(...opts.extraTokens)
  await putState(request, 'maps', {
    selectedId: mapId,
    updatedAt: now,
    maps: [
      {
        id: mapId,
        name: `E2E Combat Regression ${mapId}`,
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
        tokens,
      },
    ],
  })
  await putState(request, 'combat-log', { mapId, entries: [], updatedAt: now })
  await putState(request, 'dodge', { id: `${mapId}:none`, mapId, status: 'done', updatedAt: now })
  await putState(request, 'player-action', { id: `${mapId}:none`, mapId, combatId, status: 'done', updatedAt: now })
  await putState(request, 'player-action-ack', { id: `${mapId}:none`, mapId, combatId, actionId: 'none', status: 'accepted', round: 1, initiativeIndex: 0, updatedAt: now })
  await putState(request, 'combat', {
    mapId,
    combatId,
    active: true,
    round: 1,
    initiativeIndex: 0,
    initiativeOrder: opts.redDragonFirst
      ? [
          { tokenId: 'red-dragon-regression', label: 'E2E Red Dragon Wyrmling', emoji: '🐉', color: '#ef4444', roll: 20 },
          { tokenId: 'player-regression', label: 'E2E Adventurer', emoji: '🧝', color: '#34d399', roll: 10 },
          { tokenId: 'goblin-regression', label: 'E2E Goblin', emoji: '👺', color: '#f87171', roll: 5 },
        ]
      : opts.playerFirst
      ? [
          { tokenId: 'player-regression', label: 'E2E Adventurer', emoji: '🧝', color: '#34d399', roll: 20 },
          { tokenId: 'goblin-regression', label: 'E2E Goblin', emoji: '👺', color: '#f87171', roll: 10 },
          { tokenId: 'red-dragon-regression', label: 'E2E Red Dragon Wyrmling', emoji: '🐉', color: '#ef4444', roll: 5 },
        ]
      : [
          { tokenId: 'goblin-regression', label: 'E2E Goblin', emoji: '👺', color: '#f87171', roll: 20 },
          { tokenId: 'player-regression', label: 'E2E Adventurer', emoji: '🧝', color: '#34d399', roll: 10 },
          { tokenId: 'red-dragon-regression', label: 'E2E Red Dragon Wyrmling', emoji: '🐉', color: '#ef4444', roll: 5 },
        ],
    enemyApByToken: opts.enemyApByToken ?? {
      'goblin-regression': { current: 2, max: 2 },
      'red-dragon-regression': { current: 2, max: 2 },
    },
    updatedAt: now,
  })
}

test('goblin-first mixed enemy encounter does not silently skip the goblin turn', async ({ browser, request }) => {
  const mapId = `e2e-mixed-enemy-${Date.now()}`
  await seedEncounter(request, mapId)

  const context = await browser.newContext()
  const dm = await context.newPage()
  const player = await context.newPage()
  await Promise.all([
    dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' }),
    player.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' }),
  ])
  await waitForCombatReady(dm, 'goblin-regression')

  await expect
    .poll(
      async () => {
        const queue = await getState<{
          mapId?: string
          interrupts?: Array<{
            kind: string
            status: string
            payload?: { result?: { attackerTokenId?: string } }
          }>
        }>(request, 'combat-interrupts')
        const dodge = queue.interrupts?.find(
          (interrupt) => interrupt.kind === 'dodge' && interrupt.status === 'pending',
        )
        return queue.mapId === mapId ? dodge?.payload?.result?.attackerTokenId ?? '' : ''
      },
      { timeout: 45_000 },
    )
    .toBe('goblin-regression')

  const combat = await getState<{
    round: number
    initiativeIndex: number
    enemyApByToken: Record<string, { current: number; max: number }>
  }>(request, 'combat')
  expect(combat.round).toBe(1)
  expect(combat.initiativeIndex).toBe(0)
  expect(combat.enemyApByToken['goblin-regression']?.current).toBe(1)

  await context.close()
})

test('player precise strike activation is accepted by DM authority', async ({ browser, request }) => {
  const mapId = `e2e-precise-${Date.now()}`
  await seedEncounter(request, mapId, { playerFirst: true })

  const context = await browser.newContext()
  const dm = await context.newPage()
  const player = await context.newPage()
  await Promise.all([
    dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' }),
    player.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' }),
  ])
  await waitForCombatReady(dm, 'player-regression')

  await expect
    .poll(
      async () => {
        const combat = await getState<{ mapId?: string; active?: boolean; initiativeIndex?: number }>(request, 'combat')
        return combat.mapId === mapId && combat.active && combat.initiativeIndex === 0
      },
      { timeout: 20_000 },
    )
    .toBe(true)

  const now = Date.now()
  const action = {
    id: `${mapId}:player-action:${now}:1`,
    mapId,
    combatId: `${mapId}:combat`,
    sourceMode: 'player',
    status: 'pending',
    type: 'activate-feature',
    actorTokenId: 'player-regression',
    characterId: 'hero-regression',
    featureKey: 'preciseStrike',
    round: 1,
    initiativeIndex: 0,
    seq: 1,
    updatedAt: now,
  }
  await putState(request, 'player-action', action)
  await postEvent(request, 'player-action-player-to-dm', action)

  await expect
    .poll(
      async () => {
        const characters = await getState<{
          characters: Array<{ id: string; currentAP: number; combatBuffs?: { preciseStrikeReady?: boolean } }>
        }>(request, 'characters')
        const hero = characters.characters.find((item) => item.id === 'hero-regression')
        return { ap: hero?.currentAP, ready: !!hero?.combatBuffs?.preciseStrikeReady }
      },
      { timeout: 30_000 },
    )
    .toEqual({ ap: 1, ready: true })

  await expect
    .poll(
      async () => {
        const ack = await getState<{ actionId?: string; status?: string; reason?: string }>(request, 'player-action-ack')
        return ack.actionId === action.id ? ack.status : ''
      },
      { timeout: 20_000 },
    )
    .toBe('accepted')

  await context.close()
})

test('player movement is accepted by DM authority and updates authoritative map state', async ({ browser, request }) => {
  const mapId = `e2e-player-move-${Date.now()}`
  await seedEncounter(request, mapId, { playerFirst: true })

  const context = await browser.newContext()
  const dm = await context.newPage()
  const player = await context.newPage()
  await Promise.all([
    dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' }),
    player.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' }),
  ])
  await waitForCombatReady(dm, 'player-regression')

  await expect
    .poll(
      async () => {
        const combat = await getState<{ mapId?: string; active?: boolean; initiativeIndex?: number }>(request, 'combat')
        return combat.mapId === mapId && combat.active && combat.initiativeIndex === 0
      },
      { timeout: 20_000 },
    )
    .toBe(true)

  const now = Date.now()
  const targetPosition = center(11, 1)
  const action = {
    id: `${mapId}:player-action:${now}:move`,
    mapId,
    combatId: `${mapId}:combat`,
    sourceMode: 'player',
    status: 'pending',
    type: 'move-token',
    actorTokenId: 'player-regression',
    characterId: 'hero-regression',
    targetPosition,
    round: 1,
    initiativeIndex: 0,
    seq: 1,
    updatedAt: now,
  }
  await putState(request, 'player-action', action)
  await postEvent(request, 'player-action-player-to-dm', action)

  await expect
    .poll(
      async () => {
        const ack = await getState<{ actionId?: string; status?: string }>(request, 'player-action-ack')
        return ack.actionId === action.id ? ack.status : ''
      },
      { timeout: 30_000 },
    )
    .toBe('accepted')

  await expect
    .poll(
      async () => {
        const characters = await getState<{ characters: Array<{ id: string; currentAP: number }> }>(request, 'characters')
        return characters.characters.find((item) => item.id === 'hero-regression')?.currentAP
      },
      { timeout: 20_000 },
    )
    .toBe(1)

  await expect
    .poll(
      async () => {
        const maps = await getState<{ maps: Array<{ id: string; tokens: Array<{ id: string; x: number; y: number }> }> }>(request, 'maps')
        const token = maps.maps.find((item) => item.id === mapId)?.tokens.find((item) => item.id === 'player-regression')
        return token ? { x: token.x, y: token.y } : undefined
      },
      { timeout: 20_000 },
    )
    .toEqual(targetPosition)

  await context.close()
})

test('player multi-shot rolls once and applies damage through DM authority', async ({ browser, request }) => {
  const mapId = `e2e-multishot-${Date.now()}`
  const multiShot = {
    id: 'multi-shot-regression',
    name: '多重射击',
    emoji: '🏹',
    description: 'E2E 多重射击',
    apCost: 1,
    cooldown: 0,
    cdReduction: 0,
    remaining: 0,
    usedThisTurn: false,
    damageCount: 1,
    damageSides: 4,
    damageBonus: 0,
    arrowShots: 2,
    tags: ['ranged'],
    skillTreeId: 'multiShot',
  }
  await seedEncounter(request, mapId, {
    playerFirst: true,
    enemyApByToken: {
      'goblin-regression': { current: 0, max: 2 },
      'red-dragon-regression': { current: 0, max: 2 },
    },
    heroPatch: {
      combatSkills: [multiShot],
      currentAP: 2,
    },
  })

  const context = await browser.newContext()
  const dm = await context.newPage()
  const player = await context.newPage()
  await Promise.all([
    dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' }),
    player.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' }),
  ])
  await waitForCombatReady(dm, 'player-regression')

  const now = Date.now()
  const action = {
    id: `${mapId}:player-action:${now}:multi-shot`,
    mapId,
    combatId: `${mapId}:combat`,
    sourceMode: 'player',
    status: 'pending',
    type: 'attack-token',
    actorTokenId: 'player-regression',
    characterId: 'hero-regression',
    skillId: 'multi-shot-regression',
    targetTokenId: 'goblin-regression',
    targetTokenIds: ['goblin-regression', 'goblin-regression'],
    round: 1,
    initiativeIndex: 0,
    seq: 1,
    updatedAt: now,
  }
  await putState(request, 'player-action', action)
  await postEvent(request, 'player-action-player-to-dm', action)

  await expect
    .poll(
      async () => {
        const ack = await getState<{ actionId?: string; status?: string }>(request, 'player-action-ack')
        return ack.actionId === action.id ? ack.status : ''
      },
      { timeout: 45_000 },
    )
    .toBe('accepted')

  await expect
    .poll(
      async () => {
        const characters = await getState<{ characters: Array<{ id: string; currentAP: number }> }>(
          request,
          'characters',
        )
        return characters.characters.find((item) => item.id === 'hero-regression')?.currentAP
      },
      { timeout: 20_000 },
    )
    .toBe(1)

  await expect
    .poll(
      async () => {
        const maps = await getState<{ maps: Array<{ id: string; tokens: Array<{ id: string; hp?: number }> }> }>(
          request,
          'maps',
        )
        return maps.maps.find((item) => item.id === mapId)?.tokens.find((item) => item.id === 'goblin-regression')?.hp
      },
      { timeout: 20_000 },
    )
    .toBeLessThanOrEqual(12)

  await context.close()
})

test('illusion dance resolves selected targets in initiative order and pulls failed saves closer', async ({ browser, request }) => {
  const mapId = `e2e-illusion-dance-${Date.now()}`
  await seedEncounter(request, mapId, {
    playerFirst: true,
    heroPatch: {
      charClass: '影舞者',
      currentAP: 2,
      qi: 2,
      saveDC: 99,
    },
    heroTraits: [
      {
        id: 'illusion-dance-regression',
        name: '迷幻舞步',
        level: 2,
        uses: 1,
        maxUses: 1,
        description: 'E2E 迷幻舞步',
        featureKey: 'illusionDance',
      },
    ],
    tokenOverrides: {
      'red-dragon-regression': { ...center(10, 6) },
    },
  })

  const context = await browser.newContext()
  const dm = await context.newPage()
  const player = await context.newPage()
  await Promise.all([
    dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' }),
    player.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' }),
  ])
  await waitForCombatReady(dm, 'player-regression')

  const now = Date.now()
  const action = {
    id: `${mapId}:player-action:${now}:illusion-dance`,
    mapId,
    combatId: `${mapId}:combat`,
    sourceMode: 'player',
    status: 'pending',
    type: 'activate-feature',
    actorTokenId: 'player-regression',
    characterId: 'hero-regression',
    featureKey: 'illusionDance',
    targetTokenId: 'red-dragon-regression',
    targetTokenIds: ['red-dragon-regression', 'goblin-regression'],
    round: 1,
    initiativeIndex: 0,
    seq: 1,
    updatedAt: now,
  }
  await putState(request, 'player-action', action)
  await postEvent(request, 'player-action-player-to-dm', action)

  await expect
    .poll(
      async () => {
        const ack = await getState<{ actionId?: string; status?: string }>(request, 'player-action-ack')
        return ack.actionId === action.id ? ack.status : ''
      },
      { timeout: 45_000 },
    )
    .toBe('accepted')

  await expect
    .poll(
      async () => {
        const characters = await getState<{
          characters: Array<{
            id: string
            currentAP: number
            qi?: number
            traits: Array<{ featureKey?: string; uses: number }>
          }>
        }>(request, 'characters')
        const hero = characters.characters.find((item) => item.id === 'hero-regression')
        return {
          ap: hero?.currentAP,
          qi: hero?.qi,
          uses: hero?.traits.find((trait) => trait.featureKey === 'illusionDance')?.uses,
        }
      },
      { timeout: 20_000 },
    )
    .toEqual({ ap: 1, qi: 98, uses: 0 })

  await expect
    .poll(
      async () => {
        const maps = await getState<{ maps: Array<{ id: string; tokens: Array<{ id: string; x: number; y: number; noMoveTurns?: number }> }> }>(
          request,
          'maps',
        )
        const map = maps.maps.find((item) => item.id === mapId)
        const goblin = map?.tokens.find((item) => item.id === 'goblin-regression')
        const redDragon = map?.tokens.find((item) => item.id === 'red-dragon-regression')
        return {
          goblin: goblin ? { col: Math.round(goblin.x / 70 - 0.5), row: Math.round(goblin.y / 70 - 0.5), lock: goblin.noMoveTurns } : null,
          redDragon: redDragon ? { col: Math.round(redDragon.x / 70 - 0.5), row: Math.round(redDragon.y / 70 - 0.5), lock: redDragon.noMoveTurns } : null,
        }
      },
      { timeout: 20_000 },
    )
    .toEqual({
      goblin: { col: 8, row: 1, lock: 1 },
      redDragon: { col: 10, row: 3, lock: 1 },
    })

  await expect
    .poll(
      async () => {
        const log = await getState<{ entries: Array<{ text: string }> }>(request, 'combat-log')
        return log.entries.find((entry) => entry.text.includes('迷幻舞步'))?.text ?? ''
      },
      { timeout: 20_000 },
    )
    .toMatch(/E2E Goblin.*E2E Red Dragon Wyrmling/)

  await context.close()
})

test('precise strike forces crit and armor piercing hits aligned targets', async ({ browser, request }) => {
  const mapId = `e2e-precise-pierce-${Date.now()}`
  await seedEncounter(request, mapId, {
    playerFirst: true,
    enemyApByToken: {
      'goblin-regression': { current: 0, max: 2 },
      'red-dragon-regression': { current: 0, max: 2 },
    },
    heroPatch: {
      combatBuffs: { preciseStrikeReady: true },
    },
    heroTraits: [
      {
        id: 'precise-ready-regression',
        name: '精准打击',
        level: 1,
        uses: 1,
        maxUses: 1,
        description: '使得下一次攻击必定造成重击。',
        featureKey: 'preciseStrike',
      },
      {
        id: 'piercing-ready-regression',
        name: '穿甲箭',
        level: 1,
        uses: 1,
        maxUses: 1,
        description: '重击后对目标后方直线 15 尺目标造成本次伤害一半。',
        featureKey: 'armorPiercingArrow',
      },
    ],
    tokenOverrides: {
      'player-regression': center(1, 1),
      'goblin-regression': { ...center(3, 1), hp: 80, maxHp: 80 },
      'red-dragon-regression': center(8, 5),
    },
    extraTokens: [
      {
        id: 'rear-goblin-regression',
        label: 'E2E Rear Goblin',
        ...center(5, 1),
        color: '#f87171',
        emoji: '👺',
        size: 1,
        type: 'enemy',
        hp: 80,
        maxHp: 80,
        poolId: 'goblin',
        showHpOnToken: true,
        showDetailOnToken: true,
      },
    ],
  })

  const context = await browser.newContext()
  const dm = await context.newPage()
  const player = await context.newPage()
  await Promise.all([
    dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' }),
    player.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' }),
  ])
  await waitForCombatReady(dm, 'player-regression')

  await expect
    .poll(
      async () => {
        const combat = await getState<{ mapId?: string; active?: boolean; initiativeIndex?: number }>(request, 'combat')
        return combat.mapId === mapId && combat.active && combat.initiativeIndex === 0
      },
      { timeout: 20_000 },
    )
    .toBe(true)

  const now = Date.now()
  const action = {
    id: `${mapId}:player-action:${now}:attack`,
    mapId,
    combatId: `${mapId}:combat`,
    sourceMode: 'player',
    status: 'pending',
    type: 'attack-token',
    actorTokenId: 'player-regression',
    characterId: 'hero-regression',
    targetTokenId: 'goblin-regression',
    skillId: 'tree-basicShot',
    round: 1,
    initiativeIndex: 0,
    seq: 1,
    updatedAt: now,
  }
  await putState(request, 'player-action', action)
  await postEvent(request, 'player-action-player-to-dm', action)

  await expect
    .poll(
      async () => {
        const ack = await getState<{ actionId?: string; status?: string }>(request, 'player-action-ack')
        return ack.actionId === action.id ? ack.status : ''
      },
      { timeout: 30_000 },
    )
    .toBe('accepted')

  await expect
    .poll(
      async () => {
        const log = await getState<{ entries: Array<{ text: string }> }>(request, 'combat-log')
        return log.entries.map((entry) => entry.text).join('\n')
      },
      { timeout: 30_000 },
    )
    .toContain('穿甲箭溅射')

  const maps = await getState<{ maps: Array<{ id: string; tokens: Array<{ id: string; hp?: number }> }> }>(request, 'maps')
  const map = maps.maps.find((item) => item.id === mapId)
  const rear = map?.tokens.find((token) => token.id === 'rear-goblin-regression')
  expect(rear?.hp).toBeLessThan(80)

  const log = await getState<{ entries: Array<{ text: string }> }>(request, 'combat-log')
  const text = log.entries.map((entry) => entry.text).join('\n')
  expect(text).toContain('精准打击')
  expect(text).toContain('重击')

  await context.close()
})

test('stable mind is offered after a successful dex save and prevents damage', async ({ browser, request }) => {
  const mapId = `e2e-stable-mind-${Date.now()}`
  await seedEncounter(request, mapId, {
    redDragonFirst: true,
    enemyApByToken: {
      'goblin-regression': { current: 2, max: 2 },
      'red-dragon-regression': { current: 1, max: 1 },
    },
    heroPatch: {
      abilities: { str: 10, dex: 100, con: 50, int: 10, wis: 10, cha: 10 },
      maxHp: 31,
      currentHp: 31,
      currentAP: 2,
    },
    heroTraits: [
      {
        id: 'stable-mind-regression',
        name: '残影脱身',
        level: 1,
        uses: 1,
        maxUses: 1,
        description: '敏捷豁免成功后可消耗 1 AP 抵消伤害。',
        featureKey: 'stableMind',
      },
    ],
  })

  const context = await browser.newContext()
  const dm = await context.newPage()
  const player = await context.newPage()
  await Promise.all([
    dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' }),
    player.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' }),
  ])
  await waitForCombatReady(dm, 'red-dragon-regression')

  await expect(player.getByTestId('shared-stable-mind-use')).toBeVisible({ timeout: 45_000 })

  const before = await getState<{
    characters: Array<{ id: string; currentHp: number; currentAP: number }>
  }>(request, 'characters')
  const hpBefore = before.characters.find((item) => item.id === 'hero-regression')?.currentHp
  expect(hpBefore).toBeGreaterThan(0)

  await player.getByTestId('shared-stable-mind-use').click()

  await expect
    .poll(
      async () => {
        const characters = await getState<{
          characters: Array<{
            id: string
            currentHp: number
            currentAP: number
            traits?: Array<{ featureKey?: string; uses: number }>
          }>
        }>(request, 'characters')
        const hero = characters.characters.find((item) => item.id === 'hero-regression')
        const stableMind = hero?.traits?.find((trait) => trait.featureKey === 'stableMind')
        return { hp: hero?.currentHp, ap: hero?.currentAP, uses: stableMind?.uses }
      },
      { timeout: 30_000 },
    )
    .toEqual({ hp: hpBefore, ap: 1, uses: 0 })

  await expect
    .poll(
      async () => {
        const log = await getState<{ entries: Array<{ text: string }> }>(request, 'combat-log')
        return log.entries.map((entry) => entry.text).join('\n')
      },
      { timeout: 20_000 },
    )
    .toContain('残影脱身')

  const log = await getState<{ entries: Array<{ text: string }> }>(request, 'combat-log')
  const text = log.entries.map((entry) => entry.text).join('\n')
  expect(text).toMatch(/火焰吐息[\s\S]*伤害骰\s+\d+\s+\+\s+\d+\s+\+\s+\d+\s+\+\s+\d+/)
  expect(text).not.toContain('火焰吐息 4d6（敏捷豁免成功半伤） → E2E Adventurer：伤害骰 无')

  await context.close()
})

test('combat stops before extra monster AP after all players are defeated', async ({ browser, request }) => {
  const mapId = `e2e-defeat-stop-${Date.now()}`
  await seedEncounter(request, mapId, {
    heroPatch: {
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      currentHp: 1,
      currentAP: 2,
    },
  })

  const context = await browser.newContext()
  const dm = await context.newPage()
  const player = await context.newPage()
  await Promise.all([
    dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' }),
    player.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' }),
  ])
  await waitForCombatReady(dm, 'goblin-regression')

  await expect(player.getByRole('button', { name: '承受伤害' })).toBeVisible({ timeout: 45_000 })
  await player.getByRole('button', { name: '承受伤害' }).click()

  await expect
    .poll(
      async () => {
        const combat = await getState<{ active?: boolean; mapId?: string }>(request, 'combat')
        return combat.mapId === mapId ? combat.active : true
      },
      { timeout: 45_000 },
    )
    .toBe(false)

  const combat = await getState<{
    enemyApByToken?: Record<string, { current: number; max: number }>
  }>(request, 'combat')
  expect(combat.enemyApByToken?.['goblin-regression']?.current).toBeUndefined()

  const log = await getState<{ entries: Array<{ text: string }> }>(request, 'combat-log')
  const text = log.entries.map((entry) => entry.text).join('\n')
  expect(text).not.toContain('继续攻击')
  expect(text).not.toContain('继续移动')
  expect(text).not.toContain('进入第 2 回合')

  await context.close()
})
