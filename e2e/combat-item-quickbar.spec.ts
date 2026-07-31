import { expect, test, type APIRequestContext } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'
const PLAYER = 'http://127.0.0.1:6174'

async function putState(request: APIRequestContext, name: string, payload: unknown) {
  const response = await request.put(`${DM}/api/state/${name}`, { data: payload })
  expect(response.ok(), `${name} should save`).toBeTruthy()
}

function inventoryEntry(index: number) {
  const potion = index === 1
  return {
    instanceId: `quick-item-${index}`,
    templateId: potion ? 'srd-5.1:item:potion-of-healing' : `quick-template-${index}`,
    item: {
      id: potion ? 'srd-5.1:item:potion-of-healing' : `quick-template-${index}`,
      name: potion ? '快捷治疗药水' : `背包道具-${index}`,
      category: potion ? 'consumable' : 'adventuring-gear',
      icon: potion ? 'healing-potion' : 'generic',
      description: potion ? '恢复生命值。' : `第 ${index} 件背包道具。`,
      rulesText: potion ? '饮用者恢复 2d4 + 2 点生命值。' : '用于验证完整背包与快捷栏交换。',
      stackable: false,
      ...(potion ? {
        use: {
          economy: 'action',
          consumeQuantity: 1,
          effect: { kind: 'healing', dice: { count: 2, sides: 4, bonus: 2 } },
        },
      } : {}),
      source: { book: 'SRD 5.1', license: 'CC BY 4.0' },
    },
    quantity: 1,
    identified: true,
    acquiredAt: index,
  }
}

test('player backpack exposes every item, edits seven quick slots, and uses an item through Headless', async ({ browser, request }) => {
  const now = Date.now()
  const mapId = `combat-item-quickbar-${now}`
  const character = {
    id: 'quickbar-hero',
    rulesetId: 'dnd5e-2014-srd-5.1',
    dnd5eClassId: 'fighter',
    name: '快捷栏测试角色',
    player: '玩家 1',
    avatar: '🧪',
    accent: 'from-amber-500 to-orange-600',
    race: '人类',
    charClass: '战士',
    level: 3,
    background: '士兵',
    alignment: '中立善良',
    experience: 900,
    reputation: 0,
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    savingThrows: ['str', 'con'],
    skills: [],
    maxHp: 30,
    currentHp: 10,
    tempHp: 0,
    hitDice: '3d10',
    ac: 16,
    speed: 30,
    initiativeBonus: 1,
    saveDC: 11,
    passivePerception: 10,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    dnd5eInventory: {
      schemaVersion: 3,
      entries: Array.from({ length: 9 }, (_, index) => inventoryEntry(index + 1)),
      currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    },
  }
  const playerToken = {
    id: 'quickbar-hero-token',
    label: character.name,
    x: 140,
    y: 280,
    color: '#f59e0b',
    emoji: '🧪',
    size: 1,
    type: 'player',
    characterId: character.id,
  }
  const enemyToken = {
    id: 'quickbar-enemy-token',
    label: '训练假人',
    x: 490,
    y: 280,
    color: '#ef4444',
    emoji: '🎯',
    size: 1,
    type: 'enemy',
    hp: 20,
    maxHp: 20,
  }

  await request.delete(`${DM}/api/events/_all`)
  await putState(request, 'characters', {
    characters: [character],
    selectedId: character.id,
    updatedAt: now,
  })
  await putState(request, 'maps', {
    selectedId: mapId,
    updatedAt: now,
    maps: [{
      id: mapId,
      name: '物品快捷栏 E2E',
      width: 700,
      height: 700,
      gridSize: 70,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [playerToken, enemyToken],
    }],
  })
  await putState(request, 'combat', {
    mapId,
    combatId: `${mapId}:combat`,
    active: true,
    round: 1,
    initiativeIndex: 0,
    settlementMode: 'automatic',
    initiativeOrder: [
      { tokenId: playerToken.id, label: playerToken.label, emoji: playerToken.emoji, color: playerToken.color, roll: 20 },
      { tokenId: enemyToken.id, label: enemyToken.label, emoji: enemyToken.emoji, color: enemyToken.color, roll: 10 },
    ],
    updatedAt: now,
  })

  const context = await browser.newContext()
  const dm = await context.newPage()
  const player = await context.newPage()
  await Promise.all([
    dm.goto(`${DM}/campaign/local/maps`, { waitUntil: 'domcontentloaded' }),
    player.goto(`${PLAYER}/campaign/local/maps`, { waitUntil: 'domcontentloaded' }),
  ])

  const hotbar = player.getByTestId('player-combat-hotbar')
  await expect(hotbar).toBeVisible({ timeout: 20_000 })
  await expect(hotbar.locator('[data-testid^="combat-item-quick-slot-"]')).toHaveCount(7)
  await expect(hotbar.getByTestId('combat-item-backpack')).toBeVisible()
  await hotbar.getByTestId('combat-item-backpack').click()

  const backpack = player.getByTestId('combat-backpack-dialog')
  await expect(backpack).toBeVisible()
  await expect(backpack.getByRole('button', { name: /背包道具-9/ })).toBeVisible()
  await backpack.getByRole('button', { name: /背包道具-8/ }).click()
  await backpack.getByTestId('inventory-quickbar-slot-1').click()
  await backpack.getByRole('button', { name: /治疗药水/ }).click()
  await backpack.getByTestId('inventory-quickbar-slot-7').click()
  await backpack.getByTestId('inventory-item-actions').getByRole('button', { name: '使用', exact: true }).click()

  await expect(backpack).toHaveCount(0)
  await expect.poll(async () => {
    const response = await request.get(`${DM}/api/state/characters`)
    const payload = await response.json() as {
      characters?: Array<{
        id: string
        currentHp: number
        dnd5eInventory?: { entries: Array<{ instanceId: string }> }
      }>
    }
    const saved = payload.characters?.find((entry) => entry.id === character.id)
    return {
      hpIncreased: (saved?.currentHp ?? 0) > 10,
      potionExists: saved?.dnd5eInventory?.entries.some((entry) => entry.instanceId === 'quick-item-1') ?? true,
    }
  }, { timeout: 20_000 }).toEqual({ hpIncreased: true, potionExists: false })

  await expect(hotbar.getByTestId('combat-item-quick-slot-7')).toHaveAttribute(
    'aria-label',
    /道具快捷槽 7：空/,
  )
  await context.close()
})
