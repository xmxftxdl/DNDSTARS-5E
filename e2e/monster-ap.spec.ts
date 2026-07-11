import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'
const PLAYER = 'http://127.0.0.1:6174'

function center(col: number, row: number, gridSize = 70) {
  return {
    x: (col + 0.5) * gridSize,
    y: (row + 0.5) * gridSize,
  }
}

function heroCharacter() {
  return {
    id: 'hero-e2e',
    name: 'E2E 冒险者',
    player: 'E2E',
    avatar: '🧑',
    accent: 'from-emerald-500 to-cyan-500',
    race: '人类',
    charClass: '弓手',
    level: 1,
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
    equipment: {
      armor: {
        id: 'e2e-perfect-armor',
        name: 'E2E 高 AC 护甲',
        slot: 'armor',
        ac: 99,
      },
      helmet: {
        id: 'e2e-hp-helmet',
        name: 'E2E 生命头盔',
        slot: 'helmet',
        hpBonus: 93,
      },
    },
  }
}

async function putState(request: APIRequestContext, name: string, payload: unknown) {
  const res = await request.put(`${DM}/api/state/${name}`, { data: payload })
  expect(res.ok()).toBeTruthy()
}

async function clearEvents(request: APIRequestContext) {
  const res = await request.delete(`${DM}/api/events/_all`)
  expect(res.ok()).toBeTruthy()
}

async function waitForCombatReady(page: Page, tokenId: string) {
  await expect(page.getByTestId(`initiative-token-${tokenId}`)).toBeVisible({ timeout: 20_000 })
}

async function getState<T>(request: APIRequestContext, name: string): Promise<T> {
  const res = await request.get(`${DM}/api/state/${name}`)
  expect(res.ok()).toBeTruthy()
  return (await res.json()) as T
}

async function seedEnemyFirstCombat(request: APIRequestContext, mapId: string) {
  const playerPos = center(3, 3)
  const enemyPos = center(4, 3)
  const now = Date.now()
  const combatId = `${mapId}:combat`
  await clearEvents(request)

  await putState(request, 'characters', {
    characters: [heroCharacter()],
    selectedId: 'hero-e2e',
    updatedAt: now,
  })
  await putState(request, 'maps', {
    selectedId: mapId,
    updatedAt: now,
    maps: [
      {
        id: mapId,
        name: `E2E Monster AP ${mapId}`,
        width: 700,
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
            id: 'enemy-e2e',
            label: 'E2E Goblin',
            ...enemyPos,
            color: '#f87171',
            emoji: '👺',
            size: 1,
            type: 'enemy',
            hp: 99,
            maxHp: 99,
            poolId: 'goblin',
            showHpOnToken: true,
            showDetailOnToken: true,
          },
          {
            id: 'player-e2e',
            label: 'E2E 冒险者',
            ...playerPos,
            color: '#34d399',
            emoji: '🧑',
            size: 1,
            type: 'player',
            characterId: 'hero-e2e',
          },
        ],
      },
    ],
  })
  await putState(request, 'combat-log', { mapId, entries: [], updatedAt: now })
  await putState(request, 'dodge', { id: `${mapId}:none`, mapId, status: 'done', updatedAt: now })
  await putState(request, 'combat', {
    mapId,
    combatId,
    active: true,
    round: 1,
    initiativeIndex: 0,
    initiativeOrder: [
      { tokenId: 'enemy-e2e', label: 'E2E Goblin', emoji: '👺', color: '#f87171', roll: 20 },
      { tokenId: 'player-e2e', label: 'E2E 冒险者', emoji: '🧑', color: '#34d399', roll: 10 },
    ],
    enemyApByToken: { 'enemy-e2e': { current: 2, max: 2 } },
    updatedAt: now,
  })
}

async function answerDodge(player: Page, request: APIRequestContext, previousId?: string) {
  let dodgeId = ''
  await expect
    .poll(
      async () => {
        const state = await getState<{
          interrupts?: Array<{ id: string; kind: string; status: string }>
        }>(request, 'combat-interrupts')
        const pending = state.interrupts?.find(
          (interrupt) =>
            interrupt.kind === 'dodge' &&
            interrupt.status === 'pending' &&
            interrupt.id !== previousId,
        )
        dodgeId = pending?.id ?? ''
        return dodgeId
      },
      { timeout: 45_000 },
    )
    .not.toBe('')
  const tryDodge = player.locator(`[data-testid="shared-dodge-try"][data-dodge-id="${dodgeId}"]`)
  await expect(tryDodge).toBeVisible({ timeout: 45_000 })
  await tryDodge.click()
  await expect
    .poll(
      async () => {
        const state = await getState<{
          interrupts?: Array<{ id: string; status: string }>
        }>(request, 'combat-interrupts')
        const interrupt = state.interrupts?.find((candidate) => candidate.id === dodgeId)
        return interrupt?.status === 'answered' || interrupt?.status === 'done'
      },
      { timeout: 30_000 },
    )
    .toBe(true)
  return dodgeId
}

test('monster spends AP for two attacks while player dodges across 3 rounds', async ({ browser, request }) => {
  test.setTimeout(180_000)
  const mapId = `e2e-monster-ap-${Date.now()}`
  await seedEnemyFirstCombat(request, mapId)

  const context = await browser.newContext()
  const dm = await context.newPage()
  const player = await context.newPage()
  dm.on('pageerror', (error) => console.log(`[dm pageerror] ${error.message}`))
  player.on('pageerror', (error) => console.log(`[player pageerror] ${error.message}`))

  await Promise.all([
    dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' }),
    player.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' }),
  ])
  await Promise.all([
    waitForCombatReady(dm, 'enemy-e2e'),
    waitForCombatReady(player, 'enemy-e2e'),
  ])

  let lastDodgeId = ''
  for (let round = 1; round <= 3; round += 1) {
    lastDodgeId = await answerDodge(player, request, lastDodgeId)
    lastDodgeId = await answerDodge(player, request, lastDodgeId)

    await expect
      .poll(
        async () => {
          const combat = await getState<{
            round: number
            initiativeIndex: number
            enemyApByToken: Record<string, { current: number; max: number }>
          }>(request, 'combat')
          return {
            round: combat.round,
            initiativeIndex: combat.initiativeIndex,
            enemyAp: combat.enemyApByToken['enemy-e2e']?.current,
          }
        },
        { timeout: 45_000 },
      )
      .toEqual({ round, initiativeIndex: 1, enemyAp: 0 })

    await expect
      .poll(
        async () => {
          const characters = await getState<{ characters: Array<{ id: string; currentAP: number }> }>(
            request,
            'characters',
          )
          return characters.characters.find((c) => c.id === 'hero-e2e')?.currentAP
        },
        { timeout: 20_000 },
      )
      .toBe(0)

    if (round < 3) {
      const endTurn = player.getByTestId('player-end-turn-top')
      await expect(endTurn).toBeVisible({ timeout: 30_000 })
      await endTurn.click()
      await expect
        .poll(
          async () => {
            const combat = await getState<{ round: number; initiativeIndex: number }>(request, 'combat')
            return `${combat.round}:${combat.initiativeIndex}`
          },
          { timeout: 30_000 },
        )
        .toBe(`${round + 1}:0`)
    }
  }

  const log = await getState<{ entries: Array<{ round: number; text: string }> }>(request, 'combat-log')
  const attackLogs = log.entries.filter((entry) => entry.text.includes('AP') && entry.text.includes('E2E Goblin'))
  expect(attackLogs.length).toBeGreaterThanOrEqual(6)
  expect(attackLogs.filter((entry) => entry.text.includes('0/2')).length).toBeGreaterThanOrEqual(3)

  await context.close()
})
