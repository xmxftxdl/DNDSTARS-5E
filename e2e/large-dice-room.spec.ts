import { expect, test } from '@playwright/test'

interface Membership { roomId: string; roomName: string; rulesetId: string; createdAt: number; member: { memberId: string; roomToken: string; clientId: string; role: string; displayName: string } }
type ObservedWindow = Window & { poolResults: Array<{ values: number[]; fallback?: boolean }> }
test('real room DM rolls 20d6 and player receives the identical full pool', async ({ browser, request }) => {
  test.setTimeout(180000)
  // Isolated browser sessions share the real backend, as on a deployed room.
  // Role comes from authenticated membership, not the development port.
  const dmUrl = `http://127.0.0.1:${Number(process.env.STARS_E2E_PORT_BASE) || 6473}`, playerUrl = dmUrl
  const response = await request.post(`${dmUrl}/api/rooms`, { data: {
    roomName: '20d6 E2E', displayName: 'Dice DM', rulesetId: 'dnd5e-2014-srd-5.1', clientId: `large-dm-${Date.now()}`, activePlugins: [],
  } })
  expect(response.status()).toBe(201)
  const dmRoom = await response.json() as Membership
  const join = await request.post(`${playerUrl}/api/rooms/${dmRoom.roomId}/join`, { data: { displayName: 'Dice Player', clientId: `large-player-${Date.now()}`, activePlugins: [] } })
  expect(join.ok()).toBeTruthy()
  const playerRoom = await join.json() as Membership
  const map = await request.put(`${dmUrl}/api/state/maps?room=${dmRoom.roomId}`, {
    headers: { 'X-Stars-Protocol': '5', 'X-Stars-Expected-Revision': '0', 'X-Stars-Member': dmRoom.member.memberId, 'X-Stars-Room-Token': dmRoom.member.roomToken },
    data: { selectedId: 'large-dice-map', updatedAt: Date.now(), maps: [{ id: 'large-dice-map', name: '20d6 验证地图', width: 800, height: 600, gridSize: 40, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [] }] },
  })
  expect(map.ok()).toBeTruthy()
  for (const [name, data] of [
    ['spellbook', { schemaVersion: 1, spells: [], updatedAt: Date.now() }],
    ['characters', { characters: [], selectedId: null, updatedAt: Date.now() }],
  ] as const) {
    const seeded = await request.put(`${dmUrl}/api/state/${name}?room=${dmRoom.roomId}`, {
      headers: { 'X-Stars-Protocol': '5', 'X-Stars-Expected-Revision': '0', 'X-Stars-Member': dmRoom.member.memberId, 'X-Stars-Room-Token': dmRoom.member.roomToken }, data,
    })
    expect(seeded.ok()).toBeTruthy()
  }
  const contexts = await Promise.all([browser.newContext(), browser.newContext()])
  try {
    for (const [index, membership] of [dmRoom, playerRoom].entries()) await contexts[index].addInitScript(membership => {
      localStorage.setItem('stars-room-session:v1', JSON.stringify({ roomId: membership.roomId, roomName: membership.roomName, rulesetId: membership.rulesetId, createdAt: membership.createdAt, ...membership.member }))
      const target = window as ObservedWindow
      target.poolResults = []
      window.addEventListener('message', event => { if (event.data?.type === 'dice-box-roll-result') target.poolResults.push(event.data) })
    }, membership)
    const dm = await contexts[0].newPage(), player = await contexts[1].newPage()
    const physicalErrors: string[] = []
    for (const [name, page] of [['DM', dm], ['player', player]] as const) page.on('console', message => {
      if (message.text().includes('dice-box-frame') || message.type() === 'error') console.log(name, message.text())
      if (message.text().includes('visible faces differ') || message.text().includes('[dice-box-frame] roll failed')) physicalErrors.push(`${name}: ${message.text()}`)
    })
    await dm.goto(`${dmUrl}/campaign/${dmRoom.roomId}/maps`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await expect(dm.getByTestId('map-canvas')).toBeVisible({ timeout: 60000 })
    await player.goto(`${playerUrl}/campaign/${dmRoom.roomId}/maps`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await expect(player.getByTestId('map-canvas')).toBeVisible({ timeout: 60000 })
    await dm.getByTestId('dice-tray-recall').click({ timeout: 10000 })
    for (let i = 0; i < 20; i++) await dm.getByRole('button', { name: /^添加 d6，/ }).click()
    await expect(dm.getByRole('button', { name: '投掷 20d6', exact: true })).toBeEnabled()
    await dm.getByRole('button', { name: '投掷 20d6', exact: true }).click()
    for (const page of [dm, player]) await expect.poll(() => page.evaluate(() => (window as ObservedWindow).poolResults.at(-1)?.values.length), { timeout: 45000 }).toBe(20)
    const values = await dm.evaluate(() => (window as ObservedWindow).poolResults.at(-1)!)
    const mirrored = await player.evaluate(() => (window as ObservedWindow).poolResults.at(-1)!)
    expect(values.fallback).not.toBe(true); expect(mirrored.fallback).not.toBe(true)
    expect(mirrored.values).toEqual(values.values)
    expect(physicalErrors).toEqual([])
    await expect(dm.getByRole('button', { name: '添加 d6，当前 0 枚', exact: true })).toHaveAttribute('data-active', 'false')
    const sum = values.values.reduce((a, b) => a + b, 0)
    for (const page of [dm, player]) {
      await expect(page.locator('.dice-tray-drawer__total strong')).toHaveText(String(sum))
      await expect(page.getByTestId('dice-tray-secret-confirm')).toHaveCount(0)
    }
    await dm.getByTestId('dice-tray-drawer').screenshot({ path: 'docs/verification/2026-09-10/20d6-real-dm.png' })
    await player.getByTestId('dice-tray-drawer').screenshot({ path: 'docs/verification/2026-09-10/20d6-real-player.png' })
  } finally { await Promise.all(contexts.map(context => context.close())) }
})
