import { expect, test, type APIRequestContext } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'
const PLAYER = 'http://127.0.0.1:6174'

async function putState(request: APIRequestContext, name: string, payload: unknown) {
  const response = await request.put(`${DM}/api/state/${name}`, { data: payload })
  expect(response.ok(), `${name} should save`).toBeTruthy()
}

test('player selects flight altitude and the DM commits one 3D path over a wall', async ({ browser, request }) => {
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
  const heroToken = {
    id: 'flight-hero-token', label: character.name, x: 105, y: 315, elevationFeet: 0,
    color: '#38bdf8', emoji: '🧙', size: 1, type: 'player', characterId: character.id,
  }
  const enemyToken = {
    id: 'flight-enemy-token', label: '远处敌人', x: 595, y: 595,
    color: '#ef4444', emoji: '👺', size: 1, type: 'enemy', hp: 7, maxHp: 7,
  }
  const target = { x: 315, y: 315 }
  await request.delete(`${DM}/api/events/_all`)
  await putState(request, 'characters', { characters: [character], selectedId: character.id, updatedAt: now })
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

  const context = await browser.newContext()
  const dm = await context.newPage()
  const player = await context.newPage()
  await Promise.all([
    dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' }),
    player.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' }),
  ])
  await expect(player.getByTestId('player-combat-hotbar')).toBeVisible({ timeout: 20_000 })
  await player.getByRole('button', { name: /移动$/ }).click()
  await player.getByRole('combobox', { name: '移动方式' }).selectOption('fly')
  for (let step = 0; step < 8; step += 1) {
    await player.getByRole('button', { name: '飞行高度升高 5 尺' }).click()
  }
  await expect(player.getByLabel('飞行目标高度')).toHaveText('海拔 40 尺')
  await player.getByTestId('map-canvas').click({ position: target })

  await expect.poll(async () => {
    const response = await request.get(`${DM}/api/state/maps`)
    const state = await response.json() as {
      maps?: Array<{ id: string; tokens: Array<{ id: string; x: number; y: number; elevationFeet?: number }> }>
    }
    const token = state.maps?.find((map) => map.id === mapId)?.tokens.find((entry) => entry.id === heroToken.id)
    return token ? { x: token.x, y: token.y, elevationFeet: token.elevationFeet } : null
  }, { timeout: 20_000 }).toEqual({ ...target, elevationFeet: 40 })
  await context.close()
})
