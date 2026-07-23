import { expect, test, type APIRequestContext } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'
const PLAYER = 'http://127.0.0.1:6174'

async function putState(request: APIRequestContext, name: string, payload: unknown) {
  const response = await request.put(`${DM}/api/state/${name}`, { data: payload })
  expect(response.ok()).toBeTruthy()
}

function arrowInventory(quantity = 20) {
  return {
    schemaVersion: 3,
    entries: [{
      instanceId: 'cover-preview-arrows',
      templateId: 'srd-5.1:item:arrows',
      item: {
        id: 'srd-5.1:item:arrows',
        name: '箭',
        englishName: 'Arrows',
        category: 'adventuring-gear',
        icon: 'generic',
        description: 'SRD 5.1 冒险装备。',
        rulesText: '短弓和长弓使用的弹药。',
        weightLb: 0.05,
        cost: { amount: 5, currency: 'cp' },
        ammunitionKind: 'arrow',
        stackable: true,
        source: { book: 'SRD 5.1', license: 'CC BY 4.0' },
      },
      quantity,
      identified: true,
      acquiredAt: 0,
    }],
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
  }
}

test('weapon targeting previews creature cover and lets DM override this attack only', async ({ browser, request }) => {
  const now = Date.now()
  const mapId = `cover-preview-${now}`
  const combatId = `${mapId}:combat`
  const character = {
    id: 'cover-archer', rulesetId: 'dnd5e-2014-srd-5.1', dnd5eClassId: 'fighter',
    name: '掩护测试弓手', player: '玩家 1', avatar: '🏹', accent: 'from-emerald-500 to-cyan-500',
    race: '人类', charClass: '战士', level: 5, background: '士兵', alignment: '中立善良',
    experience: 6500, reputation: 0,
    abilities: { str: 10, dex: 18, con: 14, int: 10, wis: 12, cha: 10 },
    savingThrows: ['str', 'con'], skills: ['perception'],
    maxHp: 44, currentHp: 44, tempHp: 0, hitDice: '5d10', ac: 14, speed: 30,
    initiativeBonus: 4, saveDC: 12, passivePerception: 13, inspiration: 0,
    conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
    equipment: {
      mainWeapon: {
        id: 'dnd5e-longbow', name: '长弓', slot: 'mainWeapon',
        dnd5e: {
          kind: 'weapon', category: 'martial', mode: 'ranged',
          damage: { count: 1, sides: 8, type: 'piercing' }, attackAbility: 'dex',
          rangeFeet: { normal: 150, long: 600 }, properties: ['弹药', '重型', '双手'],
        },
      },
    },
    dnd5eInventory: arrowInventory(),
  }
  const playerToken = {
    id: 'cover-archer-token', label: character.name, x: 105, y: 350,
    color: '#34d399', emoji: '🏹', size: 1, type: 'player', characterId: character.id,
  }
  const interveningToken = {
    id: 'cover-ally-token', label: '中间盟友', x: 245, y: 350,
    color: '#60a5fa', emoji: '🛡️', size: 1, type: 'npc', hp: 10, maxHp: 10,
  }
  const targetToken = {
    id: 'cover-target-token', label: '掩护后的哥布林', x: 385, y: 350,
    color: '#f87171', emoji: '👺', size: 1, type: 'enemy', hp: 20, maxHp: 20, poolId: 'goblin',
  }
  await request.delete(`${DM}/api/events/_all`)
  const characterWithoutAmmunition = {
    ...character,
    dnd5eInventory: { ...arrowInventory(), entries: [] },
  }
  await putState(request, 'characters', { characters: [characterWithoutAmmunition], selectedId: character.id, updatedAt: now })
  await putState(request, 'maps', {
    selectedId: mapId, updatedAt: now,
    maps: [{
      id: mapId, name: '掩护预览 E2E', width: 700, height: 700, gridSize: 70,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [playerToken, interveningToken, targetToken],
    }],
  })
  await putState(request, 'combat', {
    mapId, combatId, active: true, round: 1, initiativeIndex: 0, settlementMode: 'automatic',
    initiativeOrder: [
      { tokenId: playerToken.id, label: playerToken.label, emoji: playerToken.emoji, color: playerToken.color, roll: 20 },
      { tokenId: targetToken.id, label: targetToken.label, emoji: targetToken.emoji, color: targetToken.color, roll: 10 },
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
  await expect(player.getByTestId('player-combat-hotbar')).toBeVisible()
  await player.getByRole('button', { name: /攻击：长弓/ }).click()
  await player.getByTestId('map-canvas').click({ position: { x: targetToken.x, y: targetToken.y } })
  await player.getByTestId('dnd5e-cover-preview').getByTestId('dnd5e-cover-confirm').click()

  await expect(player.getByText('弹药不足', { exact: true })).toBeVisible({ timeout: 20_000 })
  await expect(player.getByText('当前武器没有可用弹药，本次攻击未结算。')).toBeVisible()
  await player.getByRole('button', { name: '知道了' }).click()

  await putState(request, 'characters', { characters: [character], selectedId: character.id, updatedAt: Date.now() + 1 })
  await Promise.all([
    dm.reload({ waitUntil: 'domcontentloaded' }),
    player.reload({ waitUntil: 'domcontentloaded' }),
  ])
  await player.getByRole('button', { name: /攻击：长弓/ }).click()
  await player.getByTestId('map-canvas').click({ position: { x: targetToken.x, y: targetToken.y } })

  const playerPreview = player.getByTestId('dnd5e-cover-preview')
  await expect(playerPreview).toBeVisible()
  await expect(playerPreview).toContainText('半身掩护（+2 AC）')
  await expect(playerPreview).toContainText('来源：中间盟友')
  await expect(playerPreview.getByTestId('dnd5e-cover-override')).toHaveCount(0)
  await playerPreview.getByTestId('dnd5e-cover-confirm').click()

  const dmPreview = dm.getByTestId('dnd5e-cover-preview')
  await expect(dmPreview).toBeVisible({ timeout: 20_000 })
  await expect(dmPreview).toContainText('来源：中间盟友')
  await dmPreview.getByTestId('dnd5e-cover-override').selectOption('three-quarters')
  await expect(dmPreview).toContainText('本次采用 DM 裁定：四分之三掩护（+5 AC）')
  await expect(dmPreview.getByText('20', { exact: true })).toBeVisible()
  await dmPreview.getByRole('button', { name: '应用并继续结算' }).click()
  await expect(dmPreview).toHaveCount(0)
  await context.close()
})
