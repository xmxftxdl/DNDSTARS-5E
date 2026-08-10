import { expect, test, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test'

const E2E_PORT_BASE = Math.max(1_024, Number(process.env.STARS_E2E_PORT_BASE) || 6_173)
const DM = `http://127.0.0.1:${E2E_PORT_BASE}`
const PLAYER = `http://127.0.0.1:${E2E_PORT_BASE + 1}`
const SESSION_KEY = 'stars-room-session:v1'

interface RoomMembership {
  roomId: string
  roomName: string
  rulesetId: string
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

function memberHeaders(room: RoomMembership) {
  return {
    'Content-Type': 'application/json',
    'X-Stars-Protocol': '5',
    'X-Stars-Member': room.member.memberId,
    'X-Stars-Room-Token': room.member.roomToken,
  }
}

async function addRoomSession(context: BrowserContext, room: RoomMembership) {
  await context.addInitScript(([key, session]) => {
    localStorage.setItem(key, JSON.stringify({
      roomId: session.roomId,
      roomName: session.roomName,
      rulesetId: session.rulesetId,
      createdAt: session.createdAt,
      ...session.member,
    }))
  }, [SESSION_KEY, room] as const)
}

async function putUndoState(
  request: APIRequestContext,
  room: RoomMembership,
  resource: string,
  data: unknown,
  expectedRevision: number,
  transactionId: string,
  label: string,
) {
  const response = await request.put(`${DM}/api/state/${resource}?room=${room.roomId}`, {
    headers: {
      ...memberHeaders(room),
      'X-Stars-Expected-Revision': String(expectedRevision),
      'X-Stars-Undo-Group': transactionId,
      'X-Stars-Undo-Label': encodeURIComponent(label),
    },
    data,
  })
  expect(response.status(), `${resource} should save in ${transactionId}`).toBe(200)
}

async function readState<T>(request: APIRequestContext, room: RoomMembership, resource: string) {
  const response = await request.get(`${DM}/api/state/${resource}?room=${room.roomId}`, {
    headers: memberHeaders(room),
  })
  expect(response.ok(), `${resource} should load`).toBeTruthy()
  return response.json() as Promise<T>
}

async function readClientSnapshot(page: Page, mapId: string, characterId: string, tokenId: string) {
  return page.evaluate(async ({ mapId: selectedMapId, characterId: selectedCharacterId, tokenId: selectedTokenId }) => {
    const [{ useMapStore }, { useCharacterStore }] = await Promise.all([
      import('/src/store/maps.ts'),
      import('/src/store/characters.ts'),
    ])
    const token = useMapStore.getState().maps
      .find((map) => map.id === selectedMapId)
      ?.tokens.find((candidate) => candidate.id === selectedTokenId)
    const character = useCharacterStore.getState().characters
      .find((candidate) => candidate.id === selectedCharacterId)
    return {
      token: token ? { x: token.x, y: token.y, hp: token.hp } : null,
      character: character ? {
        currentHp: character.currentHp,
        slots: character.classResources?.['dnd5e-spell-slot-2']?.current,
        conditions: character.conditions,
        concentrationSpellId: character.dnd5eCombatState?.concentrationSpellId,
      } : null,
    }
  }, { mapId, characterId, tokenId })
}

test('DM 战斗恢复原子归还法术位、位置、HP、状态和行动经济，并同步玩家重连', async ({
  browser,
  request,
}) => {
  test.setTimeout(120_000)
  const nonce = Date.now()
  const createdResponse = await request.post(`${DM}/api/rooms`, {
    data: {
      roomName: `Combat recovery ${nonce}`,
      displayName: 'Recovery DM',
      rulesetId: 'dnd5e-2014-srd-5.1',
      clientId: `recovery-dm-${nonce}`,
      activePlugins: [],
    },
  })
  expect(createdResponse.status()).toBe(201)
  const dmRoom = await createdResponse.json() as RoomMembership

  const joinedResponse = await request.post(`${PLAYER}/api/rooms/${dmRoom.roomId}/join`, {
    data: {
      displayName: 'Recovery Player',
      clientId: `recovery-player-${nonce}`,
      activePlugins: [],
    },
  })
  expect(joinedResponse.ok()).toBeTruthy()
  const playerRoom = await joinedResponse.json() as RoomMembership

  const mapId = `recovery-map-${nonce}`
  const combatId = `${mapId}:combat`
  const characterId = `recovery-wizard-${nonce}`
  const tokenId = `recovery-token-${nonce}`
  const enemyTokenId = `recovery-enemy-${nonce}`
  const turnKey = `${combatId}:1:${tokenId}:normal`

  const character = (spent: boolean, updatedAt: number) => ({
    id: characterId,
    roomId: dmRoom.roomId,
    roomMemberId: playerRoom.member.memberId,
    rulesetId: 'dnd5e-2014-srd-5.1',
    dnd5eClassId: 'wizard',
    dnd5eClassLevels: { wizard: 5 },
    name: '恢复测试法师',
    player: 'Recovery Player',
    avatar: 'W',
    accent: 'from-blue-500 to-indigo-700',
    race: '人类',
    charClass: '法师',
    level: 5,
    background: '学者',
    alignment: '中立',
    experience: 6_500,
    reputation: 0,
    abilities: { str: 8, dex: 14, con: 14, int: 18, wis: 12, cha: 10 },
    savingThrows: ['int', 'wis'],
    skills: ['arcana'],
    maxHp: 30,
    currentHp: spent ? 22 : 30,
    tempHp: 0,
    hitDice: '5d6',
    ac: 13,
    speed: 30,
    initiativeBonus: 2,
    saveDC: 15,
    passivePerception: 11,
    inspiration: 0,
    conditions: spent ? ['poisoned'] : [],
    classResources: { 'dnd5e-spell-slot-2': { current: spent ? 1 : 2, max: 2 } },
    ...(spent ? {
      dnd5eCombatState: {
        concentrationSpellId: 'flaming-sphere',
        concentrationSpellLevel: 2,
      },
    } : {}),
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    updatedAt,
  })
  const mapState = (spent: boolean, updatedAt: number) => ({
    selectedId: mapId,
    updatedAt,
    maps: [{
      id: mapId,
      name: '完整恢复测试地图',
      image: '',
      width: 800,
      height: 600,
      gridSize: 50,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [{
        id: tokenId,
        label: '恢复测试法师',
        x: spent ? 350 : 250,
        y: 250,
        color: '#3b82f6',
        emoji: 'W',
        size: 1,
        type: 'player',
        characterId,
        hp: spent ? 22 : 30,
        maxHp: 30,
      }, {
        id: enemyTokenId,
        label: '恢复目标',
        x: 500,
        y: 250,
        color: '#ef4444',
        emoji: 'M',
        size: 1,
        type: 'enemy',
        hp: 20,
        maxHp: 20,
      }],
    }],
  })
  const combatState = (spent: boolean, updatedAt: number) => ({
    mapId,
    combatId,
    active: true,
    round: 1,
    initiativeIndex: 0,
    settlementMode: 'automatic',
    initiativeOrder: [{
      slotId: `${tokenId}:normal`, tokenId, label: '恢复测试法师', emoji: 'W', color: '#3b82f6', roll: 18,
    }, {
      slotId: `${enemyTokenId}:normal`, tokenId: enemyTokenId, label: '恢复目标', emoji: 'M', color: '#ef4444', roll: 10,
    }],
    dnd5eTurnEconomyByToken: {
      [tokenId]: {
        turnKey,
        attacksUsed: spent ? 1 : 0,
        action: { current: spent ? 0 : 1, max: 1 },
        bonusAction: { current: spent ? 0 : 1, max: 1 },
        reaction: { current: 1, max: 1 },
        objectInteraction: { current: 1, max: 1 },
        movement: { current: spent ? 10 : 30, max: 30 },
      },
    },
    updatedAt,
  })

  const setupId = `setup:${nonce}`
  await putUndoState(request, dmRoom, 'characters', {
    characters: [character(false, nonce)], selectedId: characterId, updatedAt: nonce,
  }, 0, setupId, '建立战斗检查点')
  await putUndoState(request, dmRoom, 'maps', mapState(false, nonce), 0, setupId, '建立战斗检查点')
  await putUndoState(request, dmRoom, 'combat', combatState(false, nonce), 0, setupId, '建立战斗检查点')
  await putUndoState(request, dmRoom, 'combat-interrupts', {
    mapId, combatId, interrupts: [], updatedAt: nonce,
  }, 0, setupId, '建立战斗检查点')
  await putUndoState(request, dmRoom, 'combat-log', {
    mapId, combatId, entries: [], updatedAt: nonce,
  }, 0, setupId, '建立战斗检查点')

  const actionId = `player-action:${nonce}`
  await putUndoState(request, dmRoom, 'characters', {
    characters: [character(true, nonce + 1)], selectedId: characterId, updatedAt: nonce + 1,
  }, 1, actionId, '结算玩家行动')
  await putUndoState(request, dmRoom, 'maps', mapState(true, nonce + 1), 1, actionId, '结算玩家行动')
  await putUndoState(request, dmRoom, 'combat', combatState(true, nonce + 1), 1, actionId, '结算玩家行动')
  await putUndoState(request, dmRoom, 'combat-log', {
    mapId,
    combatId,
    entries: [{ id: nonce + 1, round: 1, text: '恢复测试法师施法并移动。', kind: 'attack', time: '10:00' }],
    updatedAt: nonce + 1,
  }, 1, `combat-log:${nonce}`, '记录玩家行动')

  const dmContext = await browser.newContext()
  const playerContext = await browser.newContext()
  await addRoomSession(dmContext, dmRoom)
  await addRoomSession(playerContext, playerRoom)
  const dm = await dmContext.newPage()
  const player = await playerContext.newPage()

  try {
    // Let the DM cold compile finish before opening the player client. Two
    // parallel transforms of the very large map workspace can starve one
    // browser long enough to make readiness checks flaky on slower machines.
    await dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' })
    await expect(dm.getByTestId('map-canvas')).toBeVisible({ timeout: 40_000 })
    await player.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' })
    const playerHotbar = player.getByTestId('player-combat-hotbar')
    await expect(playerHotbar).toBeVisible({ timeout: 20_000 })
    await expect(playerHotbar).toHaveAttribute('data-action-remaining', '0')
    await expect(playerHotbar).toHaveAttribute('data-bonus-action-remaining', '0')
    await expect(playerHotbar).toHaveAttribute('data-movement-remaining', '10')
    await expect(playerHotbar.locator('[data-spell-slot-summary-level="2"]')).toHaveAttribute(
      'data-spell-slot-summary-current',
      '1',
    )
    await expect.poll(async () => readClientSnapshot(player, mapId, characterId, tokenId)).toMatchObject({
      token: { x: 350, y: 250, hp: 22 },
      character: {
        currentHp: 22,
        slots: 1,
        conditions: ['poisoned'],
        concentrationSpellId: 'flaming-sphere',
      },
    })

    await dm.getByTestId('dm-authoritative-undo').click()
    const recoveryDialog = dm.getByTestId('dm-combat-recovery-dialog')
    await expect(recoveryDialog).toBeVisible({ timeout: 20_000 })
    await expect(recoveryDialog.getByTestId(`dm-combat-recovery-transaction-${actionId}`)).toBeVisible()
    await recoveryDialog.getByTestId(`dm-combat-recovery-transaction-${actionId}`).click()
    await recoveryDialog.getByTestId('dm-combat-recovery-confirm').click()
    await expect(dm.getByTestId('app-dialog-confirm')).toBeVisible()
    await dm.getByTestId('app-dialog-confirm').click()
    await expect(recoveryDialog).toBeHidden({ timeout: 20_000 })

    await expect.poll(async () => {
      const characters = await readState<{
        characters: Array<{
          id: string
          currentHp: number
          conditions: string[]
          classResources?: Record<string, { current: number }>
          dnd5eCombatState?: { concentrationSpellId?: string }
        }>
      }>(request, dmRoom, 'characters')
      const maps = await readState<{
        maps: Array<{ id: string; tokens: Array<{ id: string; x: number; hp?: number }> }>
      }>(request, dmRoom, 'maps')
      const combat = await readState<{
        dnd5eTurnEconomyByToken?: Record<string, {
          action: { current: number }
          bonusAction: { current: number }
          movement: { current: number }
        }>
      }>(request, dmRoom, 'combat')
      const restoredCharacter = characters.characters.find((entry) => entry.id === characterId)
      const restoredToken = maps.maps.find((entry) => entry.id === mapId)?.tokens
        .find((entry) => entry.id === tokenId)
      const economy = combat.dnd5eTurnEconomyByToken?.[tokenId]
      return {
        hp: restoredCharacter?.currentHp,
        slots: restoredCharacter?.classResources?.['dnd5e-spell-slot-2']?.current,
        conditions: restoredCharacter?.conditions,
        concentration: restoredCharacter?.dnd5eCombatState?.concentrationSpellId ?? null,
        tokenX: restoredToken?.x,
        tokenHp: restoredToken?.hp,
        action: economy?.action.current,
        bonusAction: economy?.bonusAction.current,
        movement: economy?.movement.current,
      }
    }, { timeout: 20_000 }).toEqual({
      hp: 30,
      slots: 2,
      conditions: [],
      concentration: null,
      tokenX: 250,
      tokenHp: 30,
      action: 1,
      bonusAction: 1,
      movement: 30,
    })

    await expect(playerHotbar).toHaveAttribute('data-action-remaining', '1', { timeout: 20_000 })
    await expect(playerHotbar).toHaveAttribute('data-bonus-action-remaining', '1')
    await expect(playerHotbar).toHaveAttribute('data-movement-remaining', '30')
    await expect(playerHotbar.locator('[data-spell-slot-summary-level="2"]')).toHaveAttribute(
      'data-spell-slot-summary-current',
      '2',
    )
    await expect.poll(async () => readClientSnapshot(player, mapId, characterId, tokenId)).toMatchObject({
      token: { x: 250, y: 250, hp: 30 },
      character: { currentHp: 30, slots: 2, conditions: [], concentrationSpellId: undefined },
    })

    await player.reload({ waitUntil: 'domcontentloaded' })
    const reconnectedHotbar = player.getByTestId('player-combat-hotbar')
    await expect(reconnectedHotbar).toBeVisible({ timeout: 20_000 })
    await expect(reconnectedHotbar).toHaveAttribute('data-action-remaining', '1')
    await expect(reconnectedHotbar).toHaveAttribute('data-movement-remaining', '30')
    await expect(reconnectedHotbar.locator('[data-spell-slot-summary-level="2"]')).toHaveAttribute(
      'data-spell-slot-summary-current',
      '2',
    )
    await expect.poll(async () => readClientSnapshot(player, mapId, characterId, tokenId)).toMatchObject({
      token: { x: 250, y: 250, hp: 30 },
      character: { currentHp: 30, slots: 2, conditions: [], concentrationSpellId: undefined },
    })
  } finally {
    await dmContext.close()
    await playerContext.close()
  }
})
