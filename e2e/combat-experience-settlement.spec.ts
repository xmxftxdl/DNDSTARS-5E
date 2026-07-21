import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'
const PLAYER = 'http://127.0.0.1:6174'
const SESSION_KEY = 'stars-room-session:v1'

interface Membership {
  roomId: string
  roomName: string
  rulesetId: 'dnd5e-2014-srd-5.1'
  createdAt: number
  member: {
    memberId: string
    clientId: string
    role: 'dm' | 'player'
    slot?: 'player1'
    displayName: string
  }
}

function roomSession(response: Membership) {
  return {
    roomId: response.roomId,
    roomName: response.roomName,
    rulesetId: response.rulesetId,
    createdAt: response.createdAt,
    ...response.member,
  }
}

async function enterRoom(page: Page, origin: string, membership: Membership, path = '/maps') {
  await page.goto(`${origin}${path}`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(
    ([key, session]) => localStorage.setItem(key, JSON.stringify(session)),
    [SESSION_KEY, roomSession(membership)] as const,
  )
  await page.reload({ waitUntil: 'domcontentloaded' })
}

async function putRoomState(
  request: APIRequestContext,
  roomId: string,
  memberId: string,
  resource: string,
  value: unknown,
) {
  const response = await request.put(`${DM}/api/state/${resource}?room=${roomId}`, {
    headers: { 'X-Stars-Member': memberId },
    data: value,
  })
  expect(response.ok()).toBeTruthy()
}

async function readCharacters(
  request: APIRequestContext,
  origin: string,
  roomId: string,
  memberId: string,
) {
  const response = await request.get(`${origin}/api/state/characters?room=${roomId}`, {
    headers: { 'X-Stars-Member': memberId },
  })
  expect(response.ok()).toBeTruthy()
  return response.json() as Promise<{
    characters: Array<{
      id: string
      experience: number
      dnd5eExperienceAwards?: Array<{ combatId: string; xp: number }>
    }>
  }>
}

test('战斗 XP 在 DM／玩家端同步，刷新重连和重复确认均不会二次发放', async ({ browser, request }) => {
  test.setTimeout(90_000)
  const suffix = Date.now()
  const created = await (await request.post(`${DM}/api/rooms`, {
    data: {
      roomName: `经验结算 ${suffix}`,
      displayName: '经验结算 DM',
      rulesetId: 'dnd5e-2014-srd-5.1',
      clientId: `xp-dm-${suffix}`,
    },
  })).json() as Membership
  const joined = await (await request.post(`${DM}/api/rooms/${created.roomId}/join`, {
    data: { displayName: '经验结算玩家', clientId: `xp-player-${suffix}` },
  })).json() as Membership

  const now = Date.now()
  const mapId = `xp-map-${suffix}`
  const combatId = `${mapId}:combat`
  const characterId = `xp-character-${suffix}`
  const playerTokenId = `xp-player-token-${suffix}`
  const goblinTokenId = `xp-goblin-token-${suffix}`
  const character = {
    id: characterId,
    name: '经验结算战士',
    player: joined.member.displayName,
    roomId: created.roomId,
    roomMemberId: joined.member.memberId,
    avatar: '⚔️',
    accent: 'from-amber-500 to-rose-500',
    rulesetId: 'dnd5e-2014-srd-5.1',
    dnd5eClassId: 'fighter',
    race: '人类',
    charClass: '战士',
    level: 1,
    background: '士兵',
    alignment: '中立善良',
    experience: 100,
    reputation: 0,
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    savingThrows: ['str', 'con'],
    skills: ['athletics'],
    maxHp: 12,
    currentHp: 12,
    tempHp: 0,
    hitDice: '1d10',
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
    equipment: {},
  }
  const map = {
    id: mapId,
    name: '经验结算 E2E',
    width: 700,
    height: 700,
    gridSize: 70,
    gridOffsetX: 0,
    gridOffsetY: 0,
    showGrid: true,
    feetPerCell: 5,
    tokens: [
      {
        id: playerTokenId,
        label: character.name,
        x: 245,
        y: 245,
        color: '#34d399',
        emoji: '⚔️',
        size: 1,
        type: 'player',
        characterId,
      },
      {
        id: goblinTokenId,
        label: '已败哥布林',
        x: 315,
        y: 245,
        color: '#f87171',
        emoji: '👺',
        size: 1,
        type: 'enemy',
        hp: 0,
        maxHp: 7,
        poolId: 'goblin',
      },
      {
        id: `xp-living-enemy-${suffix}`,
        label: '未参战的存活敌人',
        x: 525,
        y: 525,
        color: '#f87171',
        emoji: '🐺',
        size: 1,
        type: 'enemy',
        hp: 11,
        maxHp: 11,
        poolId: 'wolf',
      },
    ],
  }

  await putRoomState(request, created.roomId, created.member.memberId, 'characters', {
    characters: [character], selectedId: characterId, updatedAt: now,
  })
  await putRoomState(request, created.roomId, created.member.memberId, 'maps', {
    maps: [map], selectedId: mapId, updatedAt: now,
  })
  await putRoomState(request, created.roomId, created.member.memberId, 'combat', {
    mapId,
    combatId,
    active: true,
    round: 1,
    initiativeIndex: 0,
    initiativeOrder: [
      { tokenId: playerTokenId, label: character.name, emoji: '⚔️', color: '#34d399', roll: 18 },
      { tokenId: goblinTokenId, label: '已败哥布林', emoji: '👺', color: '#f87171', roll: 10 },
    ],
    settlementMode: 'automatic',
    updatedAt: now,
  })
  await putRoomState(request, created.roomId, created.member.memberId, 'combat-statistics', {
    schemaVersion: 2,
    sessions: [{
      combatId,
      mapId,
      startedAt: now,
      updatedAt: now,
      lastRound: 1,
      combatants: {},
      receipts: [],
    }],
    updatedAt: now,
  })

  const dmContext = await browser.newContext()
  const playerContext = await browser.newContext()
  const dm = await dmContext.newPage()
  const player = await playerContext.newPage()
  await Promise.all([
    enterRoom(dm, DM, created),
    enterRoom(player, PLAYER, joined),
  ])

  await expect(dm.getByTestId('dm-end-combat')).toBeVisible({ timeout: 20_000 })
  await expect(player.getByTestId('combat-status')).not.toHaveText('未开始', { timeout: 20_000 })
  await dm.getByTestId('dm-end-combat').click()
  const dialog = dm.getByTestId('combat-experience-dialog')
  await expect(dialog).toBeVisible({ timeout: 20_000 })
  await expect(dialog).toContainText('50 XP')
  const awardButton = dialog.getByRole('button', { name: '确认发放 50 XP' })
  await awardButton.evaluate((button) => {
    button.click()
    button.click()
  })
  await expect(dialog).toHaveCount(0, { timeout: 20_000 })

  const assertAwardedOnce = async (origin: string, memberId: string) => {
    const state = await readCharacters(request, origin, created.roomId, memberId)
    const awarded = state.characters.find((entry) => entry.id === characterId)
    return {
      experience: awarded?.experience,
      receipts: awarded?.dnd5eExperienceAwards
        ?.filter((receipt) => receipt.combatId === combatId)
        .map((receipt) => ({ combatId: receipt.combatId, xp: receipt.xp })) ?? [],
    }
  }
  await expect.poll(() => assertAwardedOnce(DM, created.member.memberId), { timeout: 20_000 })
    .toEqual({ experience: 150, receipts: [{ combatId, xp: 50 }] })
  await expect.poll(() => assertAwardedOnce(PLAYER, joined.member.memberId), { timeout: 20_000 })
    .toEqual({ experience: 150, receipts: [{ combatId, xp: 50 }] })

  await Promise.all([
    dm.reload({ waitUntil: 'domcontentloaded' }),
    player.reload({ waitUntil: 'domcontentloaded' }),
  ])
  await expect(dm.getByTestId('combat-experience-dialog')).toHaveCount(0)
  await expect(player.getByTestId('combat-status')).toHaveText('未开始', { timeout: 20_000 })
  expect(await assertAwardedOnce(DM, created.member.memberId)).toEqual({
    experience: 150,
    receipts: [{ combatId, xp: 50 }],
  })

  await playerContext.close()
  const rejoinedContext = await browser.newContext()
  const rejoinedPlayer = await rejoinedContext.newPage()
  await enterRoom(rejoinedPlayer, PLAYER, joined, '/characters')
  await expect(rejoinedPlayer.getByRole('option', { name: character.name })).toBeAttached({ timeout: 20_000 })
  expect(await assertAwardedOnce(PLAYER, joined.member.memberId)).toEqual({
    experience: 150,
    receipts: [{ combatId, xp: 50 }],
  })

  await rejoinedContext.close()
  await dmContext.close()
})
