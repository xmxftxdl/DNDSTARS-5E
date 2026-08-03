import { expect, test, type APIRequestContext } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'
const PLAYER = 'http://127.0.0.1:6174'

async function putState(request: APIRequestContext, name: string, payload: unknown) {
  const response = await request.put(`${DM}/api/state/${name}`, { data: payload })
  expect(response.ok(), `${name} should save`).toBeTruthy()
}

test('move and end-turn use one idempotent combat command over a 3D path', async ({ browser, request }) => {
  test.setTimeout(120_000)
  const now = Date.now()
  const mapId = `flight-path-${now}`
  const combatId = `${mapId}:combat`
  const character = {
    id: 'flight-hero', rulesetId: 'dnd5e-2014-srd-5.1', dnd5eClassId: 'wizard',
    name: '飞行测试角色', player: '玩家 1', avatar: '🧙', accent: 'from-sky-500 to-violet-500',
    race: '人类', charClass: '法师', level: 5, background: '智者', alignment: '中立善良',
    experience: 6500, reputation: 0,
    abilities: { str: 10, dex: 14, con: 14, int: 18, wis: 12, cha: 10 },
    savingThrows: ['int', 'wis'], skills: ['arcana'],
    maxHp: 32, currentHp: 32, tempHp: 0, hitDice: '5d6', ac: 13, speed: 60,
    dnd5eMovementSpeeds: { fly: 60 },
    initiativeBonus: 2, saveDC: 15, passivePerception: 11, inspiration: 0,
    conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
  }
  const allyCharacter = {
    ...character,
    id: 'flight-ally',
    name: '飞行测试盟友',
    player: '玩家 2',
  }
  const heroToken = {
    id: 'flight-hero-token', label: character.name, x: 105, y: 315, elevationFeet: 0,
    color: '#38bdf8', emoji: '🧙', size: 1, type: 'player', characterId: character.id,
  }
  const enemyToken = {
    id: 'flight-enemy-token', label: allyCharacter.name, x: 595, y: 595,
    color: '#ef4444', emoji: '👺', size: 1, type: 'player', characterId: allyCharacter.id,
  }
  const target = { x: 315, y: 315 }
  await request.delete(`${DM}/api/events/_all`)
  await putState(request, 'characters', { characters: [character, allyCharacter], selectedId: character.id, updatedAt: now })
  await putState(request, 'maps', {
    selectedId: mapId, updatedAt: now,
    maps: [{
      id: mapId, name: '三维飞行 E2E', width: 700, height: 700,
      gridSize: 70, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [heroToken, enemyToken],
    }],
  })
  await putState(request, 'map-geometry', {
    schemaVersion: 2, updatedAt: now,
    maps: [{
      mapId, doors: [], windows: [], obstacles: [], lights: [],
      walls: [{
        id: 'flight-wall', kind: 'wall', label: '10 尺高墙',
        points: [{ x: 210, y: 0 }, { x: 210, y: 700 }],
        blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
        baseHeightFeet: 0, heightFeet: 10, material: 'stone', createdAt: now,
      }],
      vision: { enabled: false, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' },
      updatedAt: now,
    }],
  })
  await putState(request, 'combat', {
    mapId, combatId, active: true, round: 1, initiativeIndex: 0, settlementMode: 'automatic',
    initiativeOrder: [
      {
        tokenId: heroToken.id, label: heroToken.label, emoji: heroToken.emoji,
        color: heroToken.color, roll: 20,
      },
      {
        tokenId: enemyToken.id, label: enemyToken.label, emoji: enemyToken.emoji,
        color: enemyToken.color, roll: 10,
      },
    ],
    updatedAt: now,
  })
  await putState(request, 'dm-authority-ready', {
    mapId,
    combatId,
    ready: true,
    updatedAt: now,
  })

  const context = await browser.newContext()
  const player = await context.newPage()
  const playerPageErrors: string[] = []
  player.on('pageerror', (error) => playerPageErrors.push(error.message))
  await player.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' })
  await expect(player.getByTestId('player-combat-hotbar')).toBeVisible({ timeout: 20_000 })
  await player.getByRole('button', { name: /移动$/ }).click()
  await player.getByRole('combobox', { name: '移动方式' }).selectOption('fly')
  for (let step = 0; step < 8; step += 1) {
    await player.getByRole('button', { name: '飞行高度升高 5 尺' }).click()
  }
  await expect(player.getByLabel('飞行目标高度')).toHaveText('海拔 40 尺')
  const movePutPromise = player.waitForRequest((candidate) =>
    candidate.method() === 'PUT' && candidate.url().includes('/api/combat/commands/'),
  )
  await player.getByTestId('map-canvas').click({ position: target })
  await expect.poll(() => player.evaluate(() =>
    window.sessionStorage.getItem('stars:pending-combat-commands:v2')),
  { timeout: 10_000 }).not.toBeNull()
  const movePut = await movePutPromise
  const moveEnvelope = movePut.postDataJSON() as {
    schemaVersion: 1
    command: { commandId: string; type: string }
  }
  expect(moveEnvelope.command.type).toBe('move-token')

  const resumedMovePutPromise = player.waitForRequest((candidate) =>
    candidate.method() === 'PUT' && candidate.url().includes('/api/combat/commands/'),
  )
  await player.reload({ waitUntil: 'domcontentloaded' })
  // The pending lock intentionally replaces the normal hotbar while authority
  // is unavailable. The map must still render rather than becoming a blank page.
  await expect(player.getByTestId('map-canvas')).toBeVisible({ timeout: 20_000 })
  const resumedMovePut = await resumedMovePutPromise
  expect((resumedMovePut.postDataJSON() as typeof moveEnvelope).command.commandId)
    .toBe(moveEnvelope.command.commandId)

  // No DM consumer was open while the player refreshed. Starting the authority
  // now must settle the one durable command, never a replacement command.
  const dm = await context.newPage()
  await dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' })

  await expect.poll(async () => {
    const response = await request.get(`${DM}/api/state/maps`)
    const state = await response.json() as {
      maps?: Array<{ id: string; tokens: Array<{ id: string; x: number; y: number; elevationFeet?: number }> }>
    }
    const token = state.maps?.find((map) => map.id === mapId)?.tokens.find((entry) => entry.id === heroToken.id)
    return token ? { x: token.x, y: token.y, elevationFeet: token.elevationFeet } : null
  }, { timeout: 20_000 }).toEqual({ ...target, elevationFeet: 40 })

  const replayedMove = await request.put(movePut.url(), { data: moveEnvelope })
  expect(replayedMove.ok()).toBeTruthy()
  expect(await replayedMove.json()).toMatchObject({
    replayed: true,
    receipt: {
      commandId: moveEnvelope.command.commandId,
      status: 'committed',
      authoritative: {
        acceptedPosition: target,
        acceptedElevationFeet: 40,
      },
    },
  })

  await expect(player.getByTestId('player-end-turn-top')).toBeEnabled({ timeout: 20_000 })
  const endTurnPutPromise = player.waitForRequest((candidate) =>
    candidate.method() === 'PUT' && candidate.url().includes('/api/combat/commands/'),
  )
  await player.getByTestId('player-end-turn-top').click()
  const endTurnPut = await endTurnPutPromise
  const endTurnEnvelope = endTurnPut.postDataJSON() as {
    schemaVersion: 1
    command: { commandId: string; type: string }
  }
  expect(endTurnEnvelope.command.type).toBe('end-turn')
  await expect.poll(async () => {
    const response = await request.get(`${DM}/api/state/combat`)
    return (await response.json() as { initiativeIndex?: number }).initiativeIndex
  }, { timeout: 20_000 }).toBe(1)

  const replayedEndTurn = await request.put(endTurnPut.url(), { data: endTurnEnvelope })
  expect(replayedEndTurn.ok()).toBeTruthy()
  expect(await replayedEndTurn.json()).toMatchObject({
    replayed: true,
    receipt: { commandId: endTurnEnvelope.command.commandId, status: 'committed' },
  })
  await player.waitForTimeout(500)
  expect((await (await request.get(`${DM}/api/state/combat`)).json() as { initiativeIndex: number }).initiativeIndex)
    .toBe(1)
  expect(playerPageErrors).toEqual([])
  await context.close()
})
