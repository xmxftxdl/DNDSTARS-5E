import { expect, test } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'
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

test('DM can manage room capacity, membership and transfer authority from the dashboard', async ({ browser, request }) => {
  const createdResponse = await request.post(`${DM}/api/rooms`, {
    data: {
      roomName: 'P1 room management',
      displayName: 'Original DM',
      rulesetId: 'dnd5e-2014-srd-5.1',
      clientId: `p1-ui-dm-${Date.now()}`,
      maxPlayers: 4,
    },
  })
  expect(createdResponse.ok()).toBeTruthy()
  const created = await createdResponse.json() as Membership
  const join = async (name: string, suffix: string) => {
    const response = await request.post(`${DM}/api/rooms/${created.roomId}/join`, {
      data: { displayName: name, clientId: `p1-ui-${suffix}-${Date.now()}`, activePlugins: [] },
    })
    expect(response.ok()).toBeTruthy()
    return response.json() as Promise<Membership>
  }
  const playerA = await join('Successor', 'successor')
  const playerB = await join('Kick target', 'kick')

  const context = await browser.newContext()
  await context.addInitScript(([key, session]) => {
    localStorage.setItem(key, JSON.stringify(session))
  }, [SESSION_KEY, sessionFrom(created)] as const)
  const page = await context.newPage()
  await page.goto(DM, { waitUntil: 'domcontentloaded' })

  await expect(page.getByTestId('room-management-panel')).toBeVisible()
  await expect(page.getByTestId(`room-transfer-${playerA.member.memberId}`)).toBeVisible()

  await page.getByTestId('room-lock-toggle').click()
  await expect.poll(async () => {
    const response = await request.get(`${DM}/api/rooms/${created.roomId}/preview`)
    return (await response.json() as { locked: boolean }).locked
  }).toBe(true)

  await page.getByTestId('room-capacity-select').selectOption('6')
  await expect.poll(async () => {
    const response = await request.get(`${DM}/api/rooms/${created.roomId}/preview`)
    return (await response.json() as { maxPlayers: number }).maxPlayers
  }).toBe(6)

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByTestId(`room-kick-${playerB.member.memberId}`).click()
  await expect.poll(async () => {
    const response = await request.get(`${DM}/api/rooms/${created.roomId}/roster`, {
      headers: { 'X-Stars-Member': created.member.memberId },
    })
    const roster = await response.json() as { players: Array<{ memberId: string; status: string }> }
    return roster.players.find((member) => member.memberId === playerB.member.memberId)?.status
  }).toBe('removed')

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByTestId(`room-transfer-${playerA.member.memberId}`).click()
  await expect(page).toHaveURL(/\/maps$/)
  await expect.poll(() => page.evaluate((key) => {
    const value = JSON.parse(localStorage.getItem(key) ?? '{}') as { role?: string }
    return value.role
  }, SESSION_KEY)).toBe('player')

  const successorHeartbeat = await request.post(`${DM}/api/rooms/${created.roomId}/heartbeat`, {
    data: { memberId: playerA.member.memberId, activePlugins: [] },
  })
  expect(successorHeartbeat.ok()).toBeTruthy()
  expect(await successorHeartbeat.json()).toMatchObject({ member: { role: 'dm' } })
  await context.close()
})
