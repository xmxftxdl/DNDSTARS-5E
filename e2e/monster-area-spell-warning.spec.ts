import { expect, test, type APIRequestContext } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'

async function putState(request: APIRequestContext, name: string, payload: unknown) {
  const response = await request.put(`${DM}/api/state/${name}`, { data: payload })
  expect(response.ok(), `${name}: ${response.status()}`).toBeTruthy()
}

function hero(id: string, name: string) {
  return {
    id,
    rulesetId: 'dnd5e-2014-srd-5.1',
    name,
    player: name,
    avatar: 'H',
    accent: 'from-sky-500 to-violet-500',
    race: 'Human',
    charClass: 'Fighter',
    level: 5,
    background: '',
    experience: 6500,
    reputation: 0,
    abilities: { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
    savingThrows: ['str', 'con'],
    skills: [],
    maxHp: 50,
    currentHp: 50,
    tempHp: 0,
    hitDice: '5d10',
    ac: 16,
    speed: 30,
    initiativeBonus: 0,
    saveDC: 10,
    passivePerception: 10,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    equipment: {},
  }
}

test('monster previews its chosen fireball area for two seconds before resolving it', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000)
  const now = Date.now()
  const mapId = `monster-area-warning-${now}`
  const first = hero(`${mapId}:hero-one`, 'Hero One')
  const second = hero(`${mapId}:hero-two`, 'Hero Two')
  const mage = {
    id: `${mapId}:mage`,
    label: 'Enemy Mage',
    x: 70,
    y: 280,
    color: '#7c3aed',
    emoji: 'M',
    size: 1,
    type: 'enemy',
    hp: 40,
    maxHp: 40,
    poolId: 'srd-5.1:mage',
    dnd5eCombatState: {
      monsterSpellSlots: { '3': { current: 1, max: 1 } },
    },
  }
  const firstToken = {
    id: `${mapId}:hero-one-token`,
    label: first.name,
    x: 490,
    y: 280,
    color: '#38bdf8',
    emoji: '1',
    size: 1,
    type: 'player',
    characterId: first.id,
  }
  const secondToken = {
    id: `${mapId}:hero-two-token`,
    label: second.name,
    x: 560,
    y: 280,
    color: '#22d3ee',
    emoji: '2',
    size: 1,
    type: 'player',
    characterId: second.id,
  }

  await request.delete(`${DM}/api/events/_all`)
  await putState(request, 'characters', {
    characters: [first, second],
    selectedId: first.id,
    updatedAt: now,
  })
  await putState(request, 'maps', {
    selectedId: mapId,
    updatedAt: now,
    maps: [{
      id: mapId,
      name: 'Monster area spell warning E2E',
      width: 840,
      height: 560,
      gridSize: 70,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [mage, firstToken, secondToken],
    }],
  })
  await putState(request, 'combat-log', { mapId, entries: [], updatedAt: now })
  await putState(request, 'dice-events', { mapId, events: [], updatedAt: now })
  await putState(request, 'combat-interrupts', {
    mapId,
    interrupts: [],
    updatedAt: now,
    revision: 0,
  })
  await putState(request, 'combat', {
    mapId,
    combatId: `${mapId}:combat`,
    active: true,
    round: 1,
    initiativeIndex: 0,
    settlementMode: 'automatic',
    initiativeOrder: [
      { tokenId: mage.id, label: mage.label, emoji: mage.emoji, color: mage.color, roll: 20 },
      { tokenId: firstToken.id, label: firstToken.label, emoji: firstToken.emoji, color: firstToken.color, roll: 10 },
      { tokenId: secondToken.id, label: secondToken.label, emoji: secondToken.emoji, color: secondToken.color, roll: 9 },
    ],
    updatedAt: now,
  })

  await page.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' })
  const warning = page.getByTestId('enemy-spell-area-warning')
  await expect(warning).toBeVisible({ timeout: 30_000 })
  await expect(warning).toContainText('火球术')
  await expect(warning).toContainText('2 秒后生效')

  const currentHitPoints = async () => {
    const response = await request.get(`${DM}/api/state/characters`)
    const state = await response.json() as { characters: Array<{ currentHp: number }> }
    return state.characters.map((character) => character.currentHp)
  }
  const hitPointsBeforeResolution = await currentHitPoints()
  await page.waitForTimeout(1_000)
  await expect(warning).toBeVisible()
  expect(await currentHitPoints()).toEqual(hitPointsBeforeResolution)

  await expect(warning).toBeHidden({ timeout: 3_000 })
  await expect.poll(async () => (await currentHitPoints()).every(
    (hitPoints, index) => hitPoints < hitPointsBeforeResolution[index],
  ), { timeout: 30_000 }).toBe(true)
})

test('shared-recharge breath variants preview the selected shape and spend one parent pool', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000)
  const now = Date.now()
  const mapId = `monster-shared-breath-${now}`
  const first = {
    ...hero(`${mapId}:hero-one`, 'Hero One'),
    dnd5eClassLevels: { fighter: 5 },
    hitPointMaximumMode: 'manual',
    maxHp: 44,
    currentHp: 44,
  }
  const second = {
    ...hero(`${mapId}:hero-two`, 'Hero Two'),
    dnd5eClassLevels: { fighter: 5 },
    hitPointMaximumMode: 'manual',
    maxHp: 44,
    currentHp: 44,
  }
  const dragon = {
    id: `${mapId}:dragon`,
    label: 'Adult Brass Dragon',
    x: 70,
    y: 280,
    color: '#d97706',
    emoji: 'D',
    size: 1,
    type: 'enemy',
    hp: 172,
    maxHp: 172,
    poolId: 'srd-5.1:adult-brass-dragon',
    dnd5eCombatState: {
      monsterRechargeReadyByActionId: { 'breath-weapons': true },
    },
  }
  const firstToken = {
    id: `${mapId}:hero-one-token`,
    label: first.name,
    x: 490,
    y: 280,
    color: '#38bdf8',
    emoji: '1',
    size: 1,
    type: 'player',
    characterId: first.id,
    hp: first.currentHp,
    maxHp: first.maxHp,
  }
  const secondToken = {
    id: `${mapId}:hero-two-token`,
    label: second.name,
    x: 560,
    y: 280,
    color: '#22d3ee',
    emoji: '2',
    size: 1,
    type: 'player',
    characterId: second.id,
    hp: second.currentHp,
    maxHp: second.maxHp,
  }

  await request.delete(`${DM}/api/events/_all`)
  await putState(request, 'characters', {
    characters: [first, second],
    selectedId: first.id,
    updatedAt: now,
  })
  await putState(request, 'maps', {
    selectedId: mapId,
    updatedAt: now,
    maps: [{
      id: mapId,
      name: 'Shared recharge breath variant E2E',
      width: 840,
      height: 560,
      gridSize: 70,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [dragon, firstToken, secondToken],
    }],
  })
  await putState(request, 'combat-log', { mapId, entries: [], updatedAt: now })
  await putState(request, 'dice-events', { mapId, events: [], updatedAt: now })
  await putState(request, 'combat-interrupts', {
    mapId,
    interrupts: [],
    updatedAt: now,
    revision: 0,
  })
  await putState(request, 'combat', {
    mapId,
    combatId: `${mapId}:combat`,
    active: true,
    round: 1,
    initiativeIndex: 0,
    settlementMode: 'automatic',
    initiativeOrder: [
      { tokenId: dragon.id, label: dragon.label, emoji: dragon.emoji, color: dragon.color, roll: 20 },
      { tokenId: firstToken.id, label: firstToken.label, emoji: firstToken.emoji, color: firstToken.color, roll: 10 },
      { tokenId: secondToken.id, label: secondToken.label, emoji: secondToken.emoji, color: secondToken.color, roll: 9 },
    ],
    updatedAt: now,
  })

  await page.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' })
  const warning = page.getByTestId('enemy-spell-area-warning')
  const warningAppeared = await warning.waitFor({ state: 'visible', timeout: 30_000 })
    .then(() => true, () => false)
  if (!warningAppeared) {
    const response = await request.get(`${DM}/api/state/combat-log`)
    throw new Error(`shared breath warning did not appear: ${await response.text()}`)
  }
  await expect(warning).toContainText('火焰吐息')
  await expect(warning).toContainText('2 秒后生效')

  const currentHitPoints = async () => {
    const response = await request.get(`${DM}/api/state/maps`)
    const state = await response.json() as {
      maps: Array<{ id: string; tokens: Array<{ id: string; hp?: number }> }>
    }
    const tokens = state.maps.find((candidate) => candidate.id === mapId)?.tokens ?? []
    return [firstToken.id, secondToken.id].map((tokenId) =>
      tokens.find((token) => token.id === tokenId)?.hp ?? Number.NaN)
  }
  const hitPointsBeforeResolution = await currentHitPoints()
  expect(hitPointsBeforeResolution).toHaveLength(2)
  await page.waitForTimeout(1_000)
  await expect(warning).toBeVisible()
  expect(await currentHitPoints()).toEqual(hitPointsBeforeResolution)

  await expect(warning).toBeHidden({ timeout: 4_000 })
  const damageSettled = await expect.poll(async () => (await currentHitPoints()).every(
    (hitPoints, index) => hitPoints < hitPointsBeforeResolution[index],
  ), {
    timeout: 30_000,
  }).toBe(true).then(() => true, () => false)
  if (!damageSettled) {
    const response = await request.get(`${DM}/api/state/combat-log`)
    throw new Error(`shared breath did not settle damage: ${await response.text()}`)
  }
  await expect.poll(async () => {
    const response = await request.get(`${DM}/api/state/maps`)
    const state = await response.json() as {
      maps: Array<{
        id: string
        tokens: Array<{
          id: string
          dnd5eCombatState?: {
            monsterRechargeReadyByActionId?: Record<string, boolean>
          }
        }>
      }>
    }
    return state.maps
      .find((candidate) => candidate.id === mapId)?.tokens
      .find((token) => token.id === dragon.id)?.dnd5eCombatState
      ?.monsterRechargeReadyByActionId?.['breath-weapons']
  }, { timeout: 30_000 }).toBe(false)
})
