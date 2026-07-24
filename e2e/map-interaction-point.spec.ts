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
    roomToken: string
    clientId: string
    role: 'dm' | 'player'
    slot?: `player${number}`
    displayName: string
  }
}

function sessionFrom(response: Membership) {
  return {
    roomId: response.roomId,
    roomName: response.roomName,
    rulesetId: response.rulesetId,
    createdAt: response.createdAt,
    ...response.member,
  }
}

function roomHeaders(membership: Membership) {
  return {
    'X-Stars-Member': membership.member.memberId,
    'X-Stars-Room-Token': membership.member.roomToken,
    'X-Stars-Protocol': '5',
  }
}

async function putRoomState(
  request: APIRequestContext,
  membership: Membership,
  name: string,
  payload: unknown,
) {
  const response = await request.put(`${DM}/api/state/${name}?room=${membership.roomId}`, {
    headers: {
      ...roomHeaders(membership),
      'X-Stars-Expected-Revision': '0',
    },
    data: payload,
  })
  expect(response.ok(), `${name}: ${response.status()} ${await response.text()}`).toBeTruthy()
}

async function getRoomState<T>(
  request: APIRequestContext,
  membership: Membership,
  name: string,
): Promise<T> {
  const response = await request.get(`${DM}/api/state/${name}?room=${membership.roomId}`, {
    headers: roomHeaders(membership),
  })
  expect(response.ok()).toBeTruthy()
  return response.json() as Promise<T>
}

async function clickMapPoint(page: Page, x: number, y: number) {
  const canvas = page.getByTestId('map-canvas')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('map canvas has no bounding box')
  const scale = Number(await canvas.getAttribute('data-viewport-scale')) || 1
  const viewX = Number(await canvas.getAttribute('data-viewport-x')) || 0
  const viewY = Number(await canvas.getAttribute('data-viewport-y')) || 0
  await page.mouse.click(box.x + viewX + x * scale, box.y + viewY + y * scale)
}

test('DM 私有互动配置投影为玩家标记，成功后原子发放且重复点击不重复奖励', async ({ browser, request }) => {
  test.setTimeout(90_000)
  const createdResponse = await request.post(`${DM}/api/rooms`, {
    data: {
      roomName: '地图互动点 E2E',
      displayName: '互动点 DM',
      rulesetId: 'dnd5e-2014-srd-5.1',
      clientId: `interaction-dm-${Date.now()}`,
    },
  })
  expect(createdResponse.ok()).toBeTruthy()
  const dmMembership = await createdResponse.json() as Membership
  const joinedResponse = await request.post(`${DM}/api/rooms/${dmMembership.roomId}/join`, {
    data: {
      displayName: '调查员',
      clientId: `interaction-player-${Date.now()}`,
      activePlugins: [],
    },
  })
  expect(joinedResponse.ok()).toBeTruthy()
  const playerMembership = await joinedResponse.json() as Membership
  const now = Date.now()
  const mapId = `interaction-map-${now}`
  const characterId = `interaction-character-${now}`

  await putRoomState(request, dmMembership, 'characters', {
    characters: [{
      id: characterId,
      name: '调查员',
      player: '调查员',
      roomId: dmMembership.roomId,
      roomMemberId: playerMembership.member.memberId,
      rulesetId: 'dnd5e-2014-srd-5.1',
      avatar: '🔎',
      accent: 'from-amber-500 to-orange-500',
      race: '人类',
      charClass: '法师',
      classId: 'wizard',
      level: 1,
      background: '贤者',
      alignment: '中立善良',
      experience: 0,
      abilities: { str: 8, dex: 14, con: 12, int: 16, wis: 13, cha: 10 },
      savingThrows: ['int', 'wis'],
      skills: ['investigation', 'arcana'],
      maxHp: 7,
      currentHp: 7,
      tempHp: 0,
      hitDice: '1d6',
      ac: 12,
      speed: 30,
      initiativeBonus: 2,
      saveDC: 13,
      passivePerception: 11,
      inspiration: 0,
      conditions: [],
      notes: '',
      dmNotes: '',
      visibleToPlayers: true,
      equipment: {},
      dnd5eInventory: { schemaVersion: 3, entries: [], currency: {}, authorityGrantReceipts: [] },
    }],
    selectedId: characterId,
    updatedAt: now,
  })
  await putRoomState(request, dmMembership, 'maps', {
    selectedId: mapId,
    updatedAt: now,
    maps: [{
      id: mapId,
      name: '废弃图书馆',
      width: 700,
      height: 700,
      gridSize: 70,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [{
        id: 'interaction-player-token',
        label: '调查员',
        x: 350,
        y: 420,
        color: '#fbbf24',
        emoji: '🔎',
        size: 1,
        type: 'player',
        characterId,
      }],
    }],
  })
  await putRoomState(request, dmMembership, 'combat', {
    mapId,
    active: false,
    round: 1,
    initiativeIndex: 0,
    initiativeOrder: [],
    settlementMode: 'manual',
    updatedAt: now,
  })
  await putRoomState(request, dmMembership, 'combat-log', {
    mapId,
    entries: [],
    updatedAt: now,
  })
  await putRoomState(request, dmMembership, 'room-journal', {
    schemaVersion: 1,
    handouts: [{
      id: 'bookshelf-letter-draft',
      title: '夹层里的密信',
      body: '纸上写着通往地下室的暗号。',
      audience: 'dm',
      authorMemberId: dmMembership.member.memberId,
      authorName: dmMembership.member.displayName,
      createdAt: now,
      updatedAt: now,
    }],
    campaignEntries: [],
    sharedNotes: [],
    authorityMutationReceipts: [],
    updatedAt: now,
  })
  await putRoomState(request, dmMembership, 'scene-orchestration', {
    schemaVersion: 1,
    scenes: [{
      id: 'library-scene',
      mapId,
      name: '废弃图书馆',
      description: 'DM 私有描述',
      environmentLabel: '',
      backgroundCue: 'none',
      backgroundAudioLoop: false,
      backgroundAudioVolume: 0,
      boundHandoutIds: [],
      boundJournalEntryIds: [],
      interactionPoints: [{
        id: 'old-bookshelf',
        name: '旧书柜',
        enabled: true,
        visibleToPlayers: true,
        icon: 'bookshelf',
        x: 350,
        y: 350,
        interactionRadiusFeet: 5,
        prompt: '仔细搜索书柜。',
        repeat: 'per-character',
        check: {
          label: '智力（调查）检定',
          selection: 'skill:investigation',
          dc: 15,
          mode: 'normal',
        },
        successText: '你在夹层中发现了一瓶药水。',
        failureText: '你没有发现异常。',
        rewards: [{
          templateId: 'srd-5.1:item:potion-of-healing',
          quantity: 1,
          identified: true,
        }],
        successEffects: [
          { id: 'hidden-coins', kind: 'currency', currency: 'gp', amount: 5 },
          {
            id: 'hidden-letter',
            kind: 'handout',
            handoutId: 'bookshelf-letter-draft',
            audience: 'triggering-player',
          },
          {
            id: 'follow-clue',
            kind: 'task',
            operation: 'add',
            title: '调查地下室',
            body: '根据密信中的暗号寻找入口。',
          },
          {
            id: 'poison-needle',
            kind: 'damage',
            count: 1,
            sides: 4,
            bonus: 0,
            damageType: 'piercing',
          },
          {
            id: 'poisoned',
            kind: 'condition',
            condition: 'poisoned',
            duration: { type: 'rounds', rounds: 2 },
          },
        ],
        failureEffects: [],
      }],
      triggers: [],
      createdAt: now,
      updatedAt: now,
    }],
    runtime: { paused: false, pendingRuns: [], receipts: [], history: [] },
    updatedAt: now,
  })

  const projected = await getRoomState<{
    scenes: Array<{ interactionPoints: Array<Record<string, unknown>> }>
  }>(request, playerMembership, 'scene-orchestration')
  expect(projected.scenes[0].interactionPoints[0]).not.toHaveProperty('check')
  expect(projected.scenes[0].interactionPoints[0]).toMatchObject({
    rewards: [],
    successEffects: [],
    failureEffects: [],
  })
  const projectedJournalBefore = await getRoomState<{ handouts: unknown[] }>(
    request,
    playerMembership,
    'room-journal',
  )
  expect(projectedJournalBefore.handouts).toEqual([])

  const dmContext = await browser.newContext()
  const playerContext = await browser.newContext()
  await dmContext.addInitScript(([key, session]) => {
    localStorage.setItem(key, JSON.stringify(session))
  }, [SESSION_KEY, sessionFrom(dmMembership)] as const)
  await playerContext.addInitScript(([key, session]) => {
    localStorage.setItem(key, JSON.stringify(session))
  }, [SESSION_KEY, sessionFrom(playerMembership)] as const)
  const dm = await dmContext.newPage()
  const player = await playerContext.newPage()
  await Promise.all([
    dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' }),
    player.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' }),
  ])
  await expect(player.getByTestId('map-canvas')).toHaveAttribute('data-scene-interaction-count', '1', {
    timeout: 20_000,
  })

  await clickMapPoint(player, 350, 350)
  const adjudication = dm.getByTestId('dm-adjudication-dialog')
  await expect(adjudication).toBeVisible({ timeout: 20_000 })
  await expect(adjudication.getByText('仔细搜索书柜。')).toBeVisible()
  await adjudication.getByLabel('结果处理').selectOption('success')
  await adjudication.getByTestId('dm-adjudication-approve').click()

  await expect.poll(async () => {
    const state = await getRoomState<{
      characters: Array<{
        id: string
        dnd5eInventory?: {
          entries?: Array<{ templateId: string; quantity: number }>
          currency?: { gp?: number }
          authorityGrantReceipts?: string[]
        }
        currentHp?: number
        dnd5eCombatState?: {
          activeEffects?: Array<{ standardCondition?: string }>
        }
      }>
    }>(request, dmMembership, 'characters')
    const character = state.characters.find((candidate) => candidate.id === characterId)
    const inventory = character?.dnd5eInventory
    return {
      potion: inventory?.entries?.find((entry) =>
        entry.templateId === 'srd-5.1:item:potion-of-healing')?.quantity ?? 0,
      gp: inventory?.currency?.gp ?? 0,
      receipts: inventory?.authorityGrantReceipts?.length ?? 0,
      damaged: (character?.currentHp ?? 7) < 7,
      poisoned: character?.dnd5eCombatState?.activeEffects?.some(
        (effect) => effect.standardCondition === 'poisoned',
      ) ?? false,
    }
  }, { timeout: 20_000 }).toEqual({
    potion: 1,
    gp: 5,
    receipts: 1,
    damaged: true,
    poisoned: true,
  })
  await expect.poll(async () => {
    const journal = await getRoomState<{
      handouts: Array<{ audience: string | string[]; title: string }>
      sharedNotes: Array<{ kind: string; title: string }>
      authorityMutationReceipts?: string[]
    }>(request, dmMembership, 'room-journal')
    return {
      published: journal.handouts.filter((handout) =>
        Array.isArray(handout.audience) && handout.audience.includes(playerMembership.member.memberId),
      ).length,
      task: journal.sharedNotes.some((note) => note.kind === 'task' && note.title === '调查地下室'),
      receipts: journal.authorityMutationReceipts?.length ?? 0,
    }
  }, { timeout: 20_000 }).toEqual({ published: 1, task: true, receipts: 2 })

  await player.reload({ waitUntil: 'domcontentloaded' })
  await expect(player.getByTestId('map-canvas')).toHaveAttribute('data-scene-interaction-count', '1', {
    timeout: 20_000,
  })
  await clickMapPoint(player, 350, 350)
  await expect(player.getByText('已经调查过')).toBeVisible({ timeout: 20_000 })
  await expect.poll(async () => {
    const state = await getRoomState<{
      characters: Array<{
        id: string
        dnd5eInventory?: {
          entries?: Array<{ templateId: string; quantity: number }>
          currency?: { gp?: number }
          authorityGrantReceipts?: string[]
        }
      }>
    }>(request, dmMembership, 'characters')
    const inventory = state.characters.find((character) => character.id === characterId)?.dnd5eInventory
    return {
      potion: inventory?.entries?.find(
        (entry) => entry.templateId === 'srd-5.1:item:potion-of-healing',
      )?.quantity ?? 0,
      gp: inventory?.currency?.gp ?? 0,
      receipts: inventory?.authorityGrantReceipts?.length ?? 0,
    }
  }).toEqual({ potion: 1, gp: 5, receipts: 1 })
  const journalAfterReplay = await getRoomState<{
    handouts: Array<{ audience: string | string[] }>
    sharedNotes: Array<{ kind: string }>
    authorityMutationReceipts?: string[]
  }>(request, dmMembership, 'room-journal')
  expect(journalAfterReplay.handouts.filter((handout) =>
    Array.isArray(handout.audience) && handout.audience.includes(playerMembership.member.memberId),
  )).toHaveLength(1)
  expect(journalAfterReplay.sharedNotes.filter((note) => note.kind === 'task')).toHaveLength(1)
  expect(journalAfterReplay.authorityMutationReceipts).toHaveLength(2)

  await dmContext.close()
  await playerContext.close()
})
