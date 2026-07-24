import { expect, test, type APIRequestContext } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'
const PLAYER = 'http://127.0.0.1:6174'

async function putState(request: APIRequestContext, name: string, payload: unknown) {
  const response = await request.put(`${DM}/api/state/${name}`, { data: payload })
  expect(response.ok(), `${name} should save`).toBeTruthy()
}

test('Sanctuary manifests and leaves its close ward orbit visible', async ({
  browser,
  request,
}, testInfo) => {
  const now = Date.now()
  const mapId = `sanctuary-effect-${now}`
  const clericToken = {
    id: 'sanctuary-cleric-token',
    label: '银镜牧师',
    x: 175,
    y: 280,
    color: '#f8fafc',
    emoji: '🧙',
    size: 1,
    type: 'player',
  }
  const protectedCharacter = {
    id: 'sanctuary-guardian',
    rulesetId: 'dnd5e-2014-srd-5.1',
    dnd5eClassId: 'fighter',
    name: '受庇护的守卫',
    player: '玩家 1',
    avatar: '🛡️',
    accent: 'from-sky-400 to-indigo-500',
    race: '人类',
    charClass: '战士',
    level: 5,
    background: '士兵',
    experience: 6500,
    reputation: 0,
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 12, cha: 10 },
    savingThrows: ['str', 'con'],
    skills: ['athletics'],
    maxHp: 44,
    currentHp: 44,
    tempHp: 0,
    hitDice: '5d10',
    ac: 18,
    speed: 30,
    initiativeBonus: 1,
    saveDC: 12,
    passivePerception: 11,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    dnd5eCombatState: {
      schemaVersion: 2,
      activeEffects: [{
        schemaVersion: 1,
        id: 'sanctuary-e2e-effect',
        definitionId: 'srd-5.1:spell:sanctuary',
        label: '庇护术：成为攻击或有害法术目标前，攻击者须通过感知豁免',
        kind: 'buff',
        source: {
          kind: 'spell',
          actorId: clericToken.id,
          actorName: clericToken.label,
          rulesId: 'sanctuary',
        },
        appliedAt: now,
        appliedRound: 1,
        duration: {
          type: 'rounds',
          remainingRounds: 10,
          tickOn: 'target-turn-end',
        },
        stackingKey: 'srd-5.1:spell:sanctuary',
        stackingPolicy: 'refresh-duration',
        potency: 15,
        visibility: 'public',
      }],
    },
  }
  const protectedToken = {
    id: 'sanctuary-guardian-token',
    label: protectedCharacter.name,
    x: 420,
    y: 280,
    color: '#38bdf8',
    emoji: '🛡️',
    size: 1,
    type: 'player',
    characterId: protectedCharacter.id,
  }

  await request.delete(`${DM}/api/events/_all`)
  await putState(request, 'characters', {
    characters: [protectedCharacter],
    selectedId: protectedCharacter.id,
    updatedAt: now,
  })
  await putState(request, 'maps', {
    selectedId: mapId,
    updatedAt: now,
    maps: [{
      id: mapId,
      name: '庇护术动画 E2E',
      width: 700,
      height: 560,
      gridSize: 70,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [clericToken, protectedToken],
    }],
  })

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const dm = await context.newPage()
  const player = await context.newPage()
  await Promise.all([
    dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' }),
    player.goto(`${PLAYER}/maps`, { waitUntil: 'domcontentloaded' }),
  ])
  const canvas = player.getByTestId('map-canvas')
  await expect(canvas).toBeVisible()
  await expect(canvas).toHaveAttribute('data-sanctuary-token-count', '1')
  // Allow both pages' SSE subscriptions to settle before publishing the transient manifestation.
  await player.waitForTimeout(600)

  await dm.evaluate(async ({ activeMapId, sourceTokenId, targetTokenId }) => {
    const presentation = await import('/src/lib/combatPresentation.ts')
    await presentation.publishSanctuaryPresentation({
      id: `e2e-sanctuary-${Date.now()}`,
      mapId: activeMapId,
      transactionId: `e2e-sanctuary-transaction-${Date.now()}`,
      sourceTokenId,
      targetTokenId,
    })
  }, {
    activeMapId: mapId,
    sourceTokenId: clericToken.id,
    targetTokenId: protectedToken.id,
  })

  await expect(canvas).toHaveAttribute('data-combat-projectile-kinds', 'sanctuary')
  await expect.poll(async () =>
    Number(await canvas.getAttribute('data-combat-projectile-count')),
  ).toBe(0)
  await expect(canvas).toHaveAttribute('data-sanctuary-token-count', '1')

  const screenshotPath = process.env.SANCTUARY_SCREENSHOT_PATH ??
    testInfo.outputPath('sanctuary-effect.png')
  await canvas.screenshot({ path: screenshotPath })
  await context.close()
})
