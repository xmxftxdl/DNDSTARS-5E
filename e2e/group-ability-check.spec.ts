import { expect, test, type BrowserContext, type APIRequestContext } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'
const PLAYER = 'http://127.0.0.1:6174'
const PLAYER2 = 'http://127.0.0.1:6175'
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
  return { roomId: response.roomId, roomName: response.roomName, rulesetId: response.rulesetId, createdAt: response.createdAt, ...response.member }
}

async function setSession(context: BrowserContext, membership: Membership) {
  await context.addInitScript(([key, session]) => localStorage.setItem(key, JSON.stringify(session)), [SESSION_KEY, sessionFrom(membership)] as const)
}

async function heartbeat(request: APIRequestContext, roomId: string, membership: Membership, characterId: string, characterName: string) {
  const response = await request.post(`${DM}/api/rooms/${roomId}/heartbeat`, {
    headers: {
      'X-Stars-Member': membership.member.memberId,
      'X-Stars-Room-Token': membership.member.roomToken,
    },
    data: { memberId: membership.member.memberId, activePlugins: [], activeCharacterId: characterId, activeCharacterName: characterName },
  })
  expect(response.ok()).toBeTruthy()
}

test('DM group check collects independent player rolls and projects only each player own result', async ({ browser, request }) => {
  const createdResponse = await request.post(`${DM}/api/rooms`, {
    data: { roomName: '群体检定 E2E', displayName: '检定 DM', rulesetId: 'dnd5e-2014-srd-5.1', clientId: `group-check-dm-${Date.now()}` },
  })
  expect(createdResponse.ok()).toBeTruthy()
  const dm = await createdResponse.json() as Membership
  const join = async (displayName: string, suffix: string) => {
    const response = await request.post(`${DM}/api/rooms/${dm.roomId}/join`, {
      data: { displayName, clientId: `group-check-${suffix}-${Date.now()}`, activePlugins: [] },
    })
    expect(response.ok()).toBeTruthy()
    return response.json() as Promise<Membership>
  }
  const playerA = await join('玩家甲', 'a')
  const playerB = await join('玩家乙', 'b')

  const character = (id: string, name: string, owner: Membership, wisdom: number) => ({
    id, name, player: owner.member.displayName, roomId: dm.roomId, roomMemberId: owner.member.memberId,
    avatar: '🎲', accent: 'from-cyan-500 to-violet-500', rulesetId: 'dnd5e-2014-srd-5.1',
    race: '人类', charClass: '战士', level: 1, background: '士兵', experience: 0, reputation: 0,
    abilities: { str: 12, dex: 12, con: 12, int: 10, wis: wisdom, cha: 10 },
    savingThrows: ['str', 'con'], skills: ['perception'], maxHp: 11, currentHp: 11, tempHp: 0,
    hitDice: '1d10', ac: 15, speed: 30, initiativeBonus: 1, saveDC: 12, passivePerception: 12,
    inspiration: 0, conditions: [], notes: '', dmNotes: '', visibleToPlayers: true, equipment: {},
  })
  const stateResponse = await request.put(`${DM}/api/state/characters?room=${dm.roomId}`, {
    headers: { 'X-Stars-Member': dm.member.memberId, 'X-Stars-Room-Token': dm.member.roomToken },
    data: {
      characters: [character('hero-a', '斥候甲', playerA, 14), character('hero-b', '斥候乙', playerB, 12)],
      selectedId: 'hero-a', updatedAt: Date.now(),
    },
  })
  expect(stateResponse.ok()).toBeTruthy()
  await heartbeat(request, dm.roomId, playerA, 'hero-a', '斥候甲')
  await heartbeat(request, dm.roomId, playerB, 'hero-b', '斥候乙')

  const dmContext = await browser.newContext()
  const playerAContext = await browser.newContext()
  const playerBContext = await browser.newContext()
  await setSession(dmContext, dm)
  await setSession(playerAContext, playerA)
  await setSession(playerBContext, playerB)
  const dmPage = await dmContext.newPage()
  const playerAPage = await playerAContext.newPage()
  const playerBPage = await playerBContext.newPage()
  await Promise.all([
    dmPage.goto(`${DM}/communications`, { waitUntil: 'domcontentloaded' }),
    playerAPage.goto(`${PLAYER}/communications`, { waitUntil: 'domcontentloaded' }),
    playerBPage.goto(`${PLAYER2}/communications`, { waitUntil: 'domcontentloaded' }),
  ])

  await dmPage.getByRole('button', { name: '群体检定' }).click()
  const dmDialog = dmPage.getByRole('dialog', { name: '群体检定' })
  await expect(dmDialog.getByText('斥候甲')).toBeVisible()
  await expect(dmDialog.getByText('斥候乙')).toBeVisible()
  await dmDialog.getByRole('spinbutton').fill('0')
  await dmDialog.getByRole('button', { name: /向 2 名玩家发起/ }).click()

  const playerADialog = playerAPage.getByRole('dialog', { name: '群体检定请求' })
  const playerBDialog = playerBPage.getByRole('dialog', { name: '群体检定请求' })
  await expect(playerADialog).toBeVisible()
  await expect(playerBDialog).toBeVisible()
  await Promise.all([
    playerADialog.getByRole('button', { name: '掷 D20' }).click(),
    playerBDialog.getByRole('button', { name: '掷 D20' }).click(),
  ])
  await expect(playerADialog.getByText('服务端权威结果')).toBeVisible()
  await expect(playerBDialog.getByText('服务端权威结果')).toBeVisible()

  const playerAState = await (await request.get(`${DM}/api/state/group-ability-checks?room=${dm.roomId}`, {
    headers: { 'X-Stars-Member': playerA.member.memberId, 'X-Stars-Room-Token': playerA.member.roomToken },
  })).json() as { checks: Array<{ participants: unknown[]; results: unknown[] }> }
  expect(playerAState.checks[0].participants).toHaveLength(1)
  expect(playerAState.checks[0].results).toHaveLength(1)

  await expect(dmDialog.getByText('2/2', { exact: true })).toBeVisible()
  await dmDialog.getByRole('button', { name: /确认群体结果/ }).click()
  await expect(dmDialog.getByText('群体成功', { exact: true })).toBeVisible()

  await Promise.all([dmContext.close(), playerAContext.close(), playerBContext.close()])
})
