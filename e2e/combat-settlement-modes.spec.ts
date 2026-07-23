import { expect, test, type APIRequestContext } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'
const PLAYER = 'http://127.0.0.1:6174'

async function putState(request: APIRequestContext, name: string, payload: unknown) {
  const response = await request.put(`${DM}/api/state/${name}`, { data: payload })
  expect(response.ok()).toBeTruthy()
}

async function getState<T>(request: APIRequestContext, name: string): Promise<T> {
  const response = await request.get(`${DM}/api/state/${name}`)
  expect(response.ok()).toBeTruthy()
  return (await response.json()) as T
}

async function seedManualCombat(request: APIRequestContext, mapId: string) {
  const now = Date.now()
  await request.delete(`${DM}/api/events/_all`)
  await putState(request, 'characters', {
    characters: [{
      id: 'manual-hero',
      name: '手动结算战士',
      player: '测试玩家',
      avatar: '⚔️',
      accent: 'from-amber-500 to-rose-500',
      race: '人类',
      charClass: '战士',
      classId: 'fighter',
      level: 3,
      background: '士兵',
      alignment: '守序善良',
      experience: 900,
      abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 10 },
      savingThrows: ['str', 'con'],
      skills: ['athletics', 'perception'],
      maxHp: 40,
      currentHp: 40,
      tempHp: 0,
      hitDice: '3d10',
      ac: 18,
      speed: 30,
      initiativeBonus: 2,
      saveDC: 13,
      passivePerception: 13,
      inspiration: 0,
      conditions: [],
      notes: '',
      dmNotes: '',
      visibleToPlayers: true,
      equipment: {},
    }],
    selectedId: 'manual-hero',
    updatedAt: now,
  })
  await putState(request, 'maps', {
    selectedId: mapId,
    updatedAt: now,
    maps: [{
      id: mapId,
      name: '手动结算 E2E',
      width: 700,
      height: 700,
      gridSize: 70,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [
        {
          id: 'manual-goblin',
          label: '手动哥布林',
          x: 315,
          y: 245,
          color: '#f87171',
          emoji: '👺',
          size: 1,
          type: 'enemy',
          hp: 20,
          maxHp: 20,
          poolId: 'goblin',
        },
        {
          id: 'manual-player',
          label: '手动结算战士',
          x: 245,
          y: 245,
          color: '#34d399',
          emoji: '⚔️',
          size: 1,
          type: 'player',
          characterId: 'manual-hero',
        },
      ],
    }],
  })
  await putState(request, 'combat-log', { mapId, entries: [], updatedAt: now })
  await putState(request, 'dice-events', { mapId, events: [], updatedAt: now })
  await putState(request, 'combat', {
    mapId,
    combatId: `${mapId}:combat`,
    active: true,
    round: 1,
    initiativeIndex: 0,
    initiativeOrder: [
      { tokenId: 'manual-goblin', label: '手动哥布林', emoji: '👺', color: '#f87171', roll: 20 },
      { tokenId: 'manual-player', label: '手动结算战士', emoji: '⚔️', color: '#34d399', roll: 10 },
    ],
    settlementMode: 'manual',
    updatedAt: now,
  })
}

test('DM 同步三种结算模式，明骰公开、暗骰保密，并可手动应用 HP', async ({ browser, request }) => {
  test.setTimeout(90_000)
  const mapId = `settlement-${Date.now()}`
  await seedManualCombat(request, mapId)

  const context = await browser.newContext()
  const dm = await context.newPage()
  const player = await context.newPage()
  await Promise.all([
    dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' }),
    player.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' }),
  ])

  await expect(dm.getByTestId('combat-settlement-mode')).toHaveValue('manual', { timeout: 20_000 })
  await expect(player.getByTestId('combat-settlement-mode-label')).toHaveText('手动结算', { timeout: 20_000 })
  await expect(dm.getByTestId('combat-settlement-panel')).toBeVisible()
  await expect(player.getByTestId('combat-settlement-panel')).toBeVisible()

  // 怪物先攻时，全手动模式不会启动 Headless 怪物 AI。
  await expect.poll(async () => (await getState<{ initiativeIndex: number }>(request, 'combat')).initiativeIndex).toBe(0)
  await player.waitForTimeout(1_200)
  expect((await getState<{ initiativeIndex: number }>(request, 'combat')).initiativeIndex).toBe(0)

  const beforeDamage = await getState<{ characters: Array<{ id: string; currentHp: number }> }>(request, 'characters')
  const beforeDamageHp = beforeDamage.characters.find((character) => character.id === 'manual-hero')?.currentHp
  expect(beforeDamageHp).toBeGreaterThanOrEqual(7)
  await dm.getByLabel('手动结算目标').selectOption('manual-player')
  await dm.getByLabel('手动结算数值').fill('7')
  await dm.getByTestId('manual-settle-damage').click()
  await expect.poll(async () => {
    const state = await getState<{ characters: Array<{ id: string; currentHp: number }> }>(request, 'characters')
    return state.characters.find((character) => character.id === 'manual-hero')?.currentHp
  }).toBe((beforeDamageHp ?? 7) - 7)
  await dm.getByRole('button', { name: /^Log/ }).click()
  await expect(dm.getByText(new RegExp(`HP ${beforeDamageHp} → ${(beforeDamageHp ?? 7) - 7}（上限 \\d+）`))).toBeVisible()
  await expect(dm.getByText('结算来源：DM 手动调整')).toBeVisible()
  await expect.poll(async () => {
    const state = await getState<{ entries: Array<{ details?: string[] }> }>(request, 'combat-log')
    return state.entries.some((entry) => entry.details?.includes('结算来源：DM 手动调整'))
  }).toBe(true)

  await player.getByLabel('骰子类型').selectOption('6')
  await player.getByLabel('投骰名称').fill('玩家公开检定')
  await player.getByTestId('manual-roll-submit').click()
  await expect(player.getByTestId('manual-roll-submit')).toBeEnabled({ timeout: 15_000 })
  await expect.poll(async () => {
    const state = await getState<{ events: Array<{ sourceMode: string; visibility?: string; roll?: { label: string } }> }>(request, 'dice-events')
    return state.events.some((event) => event.sourceMode === 'player' && event.visibility === 'public' && event.roll?.label.includes('玩家公开检定'))
  }).toBe(true)

  const publicDiceCount = (await getState<{ events: unknown[] }>(request, 'dice-events')).events.length
  await dm.getByTestId('manual-roll-visibility').click()
  await expect(dm.getByTestId('manual-roll-visibility')).toHaveText('暗骰')
  await dm.getByLabel('投骰名称').fill('DM 秘密检定')
  await dm.getByTestId('manual-roll-submit').click()
  await expect(dm.getByRole('dialog', { name: 'd20 投掷确认' })).toBeVisible({ timeout: 15_000 })
  await dm.getByRole('button', { name: /并继续结算$/ }).click()
  await expect(dm.getByTestId('manual-roll-submit')).toBeEnabled({ timeout: 15_000 })
  await dm.waitForTimeout(500)
  expect((await getState<{ events: unknown[] }>(request, 'dice-events')).events).toHaveLength(publicDiceCount)
  await expect(player.getByText('DM 秘密检定')).toHaveCount(0)

  await dm.getByTestId('combat-settlement-mode').selectOption('semi-automatic')
  await expect(player.getByTestId('combat-settlement-mode-label')).toHaveText('半自动')
  await expect(dm.getByTestId('combat-settlement-panel')).toContainText('怪物手动操作台')
  await expect(player.getByTestId('combat-settlement-panel')).toHaveCount(0)
  await dm.waitForTimeout(1_200)
  expect((await getState<{ initiativeIndex: number }>(request, 'combat')).initiativeIndex).toBe(0)

  await dm.getByTestId('dm-next-turn').click()
  await expect.poll(async () => (await getState<{ initiativeIndex: number }>(request, 'combat')).initiativeIndex).toBe(1)
  await expect(player.getByTestId('player-end-turn-top')).toBeEnabled({ timeout: 15_000 })
  await expect(dm.getByTestId('player-combat-hotbar')).toHaveCount(0)
  await dm.getByTestId('initiative-token-manual-player').evaluate((element: HTMLElement) => element.click())
  await expect(dm.getByTestId('character-detail-panel')).toBeVisible()
  await expect(dm.getByTestId('character-action-panel')).toHaveCount(0)
  await expect(dm.getByTestId('player-combat-hotbar')).toHaveCount(0)
  await expect(player.getByTestId('player-combat-hotbar')).toBeVisible()
  await expect(player.getByTestId('combat-hotbar-spells')).toBeVisible()
  await expect(player.getByTestId('combat-hotbar-features')).toBeVisible()
  await expect(player.getByTestId('combat-hotbar-items')).toBeVisible()
  await expect(player.getByTestId('combat-hotbar-basics')).toBeVisible()
  const moveAction = player.getByTestId('combat-hotbar-basics').getByRole('button', { name: /移动$/ })
  await expect(moveAction.locator('svg')).toHaveAttribute('data-icon-motif', 'move')
  await moveAction.hover()
  const actionTooltip = player.getByRole('tooltip')
  await expect(actionTooltip).toContainText('移动 · 选择地图位置')
  const [hotbarBox, tooltipBox] = await Promise.all([
    player.getByTestId('player-combat-hotbar').boundingBox(),
    actionTooltip.boundingBox(),
  ])
  expect(hotbarBox).not.toBeNull()
  expect(tooltipBox).not.toBeNull()
  expect(tooltipBox!.y + tooltipBox!.height).toBeLessThanOrEqual(hotbarBox!.y)
  await expect(player.getByTestId('map-dice-roller-toggle')).toBeVisible()
  await player.getByTestId('map-dice-roller-toggle').click()
  await expect(player.getByTestId('map-dice-roller-panel')).toBeVisible()
  await expect(player.getByText('作为属性／技能鉴定')).toBeVisible()
  await player.getByRole('button', { name: '关闭自由掷骰' }).click()

  await dm.getByTestId('combat-settlement-mode').selectOption('automatic')
  await expect(player.getByTestId('combat-settlement-mode-label')).toHaveText('自动结算')
  await expect(dm.getByTestId('combat-settlement-panel')).toHaveCount(0)
  await expect(player.getByTestId('combat-settlement-panel')).toHaveCount(0)

  // 结算模式与回合推进会在共享 combat 资源中排队写入。一次结束点击必须
  // 等待这些旧快照并以 inactive 终态收尾，不能被迟到的 active 快照重新激活。
  await expect(dm.getByTestId('dm-end-combat')).toBeVisible()
  await dm.getByTestId('dm-end-combat').click()
  await expect(dm.getByTestId('dm-start-combat')).toBeVisible({ timeout: 20_000 })
  await expect.poll(async () => {
    const state = await getState<{ active: boolean; initiativeOrder: unknown[] }>(request, 'combat')
    return { active: state.active, initiativeCount: state.initiativeOrder.length }
  }).toEqual({ active: false, initiativeCount: 0 })
  await expect(player.getByTestId('combat-status')).toHaveText('未开始', { timeout: 20_000 })
  await expect(player.getByTestId('player-end-turn-top')).toBeDisabled()
  await context.close()
})
