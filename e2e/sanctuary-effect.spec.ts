import { expect, test, type APIRequestContext } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'
const PLAYER = 'http://127.0.0.1:6174'

async function putState(request: APIRequestContext, name: string, payload: unknown) {
  const response = await request.put(`${DM}/api/state/${name}`, { data: payload })
  expect(response.ok(), `${name} should save: ${await response.text()}`).toBeTruthy()
}

test('persistent spell buffs use action-art status tokens instead of orbiting marks', async ({
  browser,
  request,
}, testInfo) => {
  const now = Date.now()
  const mapId = `sanctuary-effect-${now}`
  const clericToken = {
    id: 'sanctuary-cleric-token',
    characterId: 'sanctuary-cleric',
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
    conditions: ['prone'],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    dnd5eCombatState: {
      schemaVersion: 2,
      activeEffects: [{
        schemaVersion: 1,
        id: 'prone-e2e-effect',
        definitionId: 'condition:prone',
        label: '倒地',
        kind: 'condition',
        standardCondition: 'prone',
        source: {
          kind: 'system',
          actorId: 'prone-caster-token',
          actorName: '倒地效果诗人',
          rulesId: 'prone',
        },
        appliedAt: now,
        appliedRound: 1,
        duration: {
          type: 'permanent',
        },
        stackingKey: 'condition:prone',
        stackingPolicy: 'refresh-duration',
        visibility: 'public',
      }, {
        schemaVersion: 1,
        id: 'guidance-e2e-effect',
        definitionId: 'srd-5.1:spell:guidance',
        label: '神导术',
        kind: 'buff',
        source: {
          kind: 'spell',
          actorId: 'guidance-caster-token',
          actorName: '神导术施法者',
          rulesId: 'guidance',
        },
        appliedAt: now,
        appliedRound: 1,
        duration: {
          type: 'rounds',
          remainingRounds: 10,
          tickOn: 'target-turn-end',
        },
        stackingKey: 'srd-5.1:spell:guidance',
        stackingPolicy: 'refresh-duration',
        visibility: 'public',
      }, {
        schemaVersion: 1,
        id: 'resistance-e2e-effect',
        definitionId: 'srd-5.1:spell:resistance',
        label: '提升抗性',
        kind: 'buff',
        source: {
          kind: 'spell',
          actorId: 'resistance-caster-token',
          actorName: '提升抗性施法者',
          rulesId: 'resistance',
        },
        appliedAt: now,
        appliedRound: 1,
        duration: {
          type: 'rounds',
          remainingRounds: 10,
          tickOn: 'target-turn-end',
        },
        stackingKey: 'srd-5.1:spell:resistance',
        stackingPolicy: 'refresh-duration',
        visibility: 'public',
      }, {
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
  const sourceCharacters = [{
    ...protectedCharacter,
    id: 'sanctuary-cleric',
    name: '庇护术牧师',
    dnd5eClassId: 'cleric',
    charClass: '牧师',
    dnd5eClassLevels: { cleric: 5 },
    conditions: [],
    dnd5eCombatState: { schemaVersion: 2, activeEffects: [] },
  }, {
    ...protectedCharacter,
    id: 'guidance-druid',
    name: '神导术德鲁伊',
    dnd5eClassId: 'druid',
    charClass: '德鲁伊',
    dnd5eClassLevels: { druid: 5 },
    conditions: [],
    dnd5eCombatState: { schemaVersion: 2, activeEffects: [] },
  }, {
    ...protectedCharacter,
    id: 'resistance-warlock',
    name: '提升抗性邪术师',
    dnd5eClassId: 'warlock',
    charClass: '邪术师',
    dnd5eClassLevels: { warlock: 5 },
    conditions: [],
    dnd5eCombatState: { schemaVersion: 2, activeEffects: [] },
  }, {
    ...protectedCharacter,
    id: 'prone-bard',
    name: '倒地效果诗人',
    dnd5eClassId: 'bard',
    charClass: '吟游诗人',
    dnd5eClassLevels: { bard: 5 },
    conditions: [],
    dnd5eCombatState: { schemaVersion: 2, activeEffects: [] },
  }]
  const sourceTokens = [{
    id: 'guidance-caster-token',
    characterId: 'guidance-druid',
    label: '神导术德鲁伊',
    x: -200,
    y: -200,
    color: '#22c55e',
    emoji: '🧙',
    size: 1,
    type: 'player',
  }, {
    id: 'resistance-caster-token',
    characterId: 'resistance-warlock',
    label: '提升抗性邪术师',
    x: -200,
    y: -200,
    color: '#8b5cf6',
    emoji: '🧙',
    size: 1,
    type: 'player',
  }, {
    id: 'prone-caster-token',
    characterId: 'prone-bard',
    label: '倒地效果诗人',
    x: -200,
    y: -200,
    color: '#d946ef',
    emoji: '🧙',
    size: 1,
    type: 'player',
  }]

  await request.delete(`${DM}/api/events/_all`)
  await putState(request, 'characters', {
    characters: [protectedCharacter, ...sourceCharacters],
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
      tokens: [clericToken, protectedToken, ...sourceTokens],
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
  await expect(canvas).toHaveAttribute('data-spell-status-token-count', '3')
  await expect(canvas).toHaveAttribute(
    'data-spell-status-token-colors',
    'guidance:#05230F:#D7FFE3,resistance:#170A31:#EDE9FE,sanctuary:#2B1903:#FFF3BF',
  )
  await expect(canvas).toHaveAttribute(
    'data-standard-condition-token-colors',
    'prone:#26072C:#F9D5FF',
  )
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
  await expect(canvas).toHaveAttribute('data-spell-status-token-count', '3')

  const screenshotPath = process.env.SANCTUARY_SCREENSHOT_PATH ??
    testInfo.outputPath('sanctuary-effect.png')
  await canvas.screenshot({ path: screenshotPath })
  await context.close()
})
