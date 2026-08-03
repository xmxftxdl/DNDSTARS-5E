import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const E2E_PORT_BASE = Math.max(1_024, Number(process.env.STARS_E2E_PORT_BASE) || 6_173)
const DM = `http://127.0.0.1:${E2E_PORT_BASE}`

async function putState(request: APIRequestContext, name: string, payload: unknown) {
  const current = await request.get(`${DM}/api/state/${name}`)
  const currentBody = current.ok() ? await current.json() as { updatedAt?: number } : null
  const response = await request.put(`${DM}/api/state/${name}`, {
    data: {
      ...(payload as Record<string, unknown>),
      updatedAt: Math.max(Date.now(), Number(currentBody?.updatedAt ?? 0) + 1),
    },
  })
  expect(response.ok(), `${name} should save`).toBeTruthy()
}

async function hydrateMaps(page: Page) {
  await page.evaluate(async () => {
    const { useMapStore } = await import('/src/store/maps.ts')
    await useMapStore.getState().loadShared()
  })
}

test('Grease leaves a persistent animated oil pool over its full area', async ({ browser, request }) => {
  const now = Date.now()
  const mapId = `grease-pool-visual-${now}`
  const caster = {
    id: 'grease-caster', label: '法师', x: 140, y: 245,
    color: '#8b5cf6', emoji: '🧙', size: 1, type: 'player',
  }
  const target = {
    id: 'grease-target', label: '食人魔', x: 560, y: 245,
    color: '#ef4444', emoji: '👹', size: 2, type: 'enemy', hp: 40, maxHp: 40,
  }

  await putState(request, 'maps', {
    selectedId: mapId,
    maps: [{
      id: mapId,
      name: '油腻术持续油池 E2E',
      width: 840,
      height: 560,
      gridSize: 70,
      gridOffsetX: 0,
      gridOffsetY: 0,
      gridColor: '#c4b5fd',
      gridOpacity: 0.42,
      showGrid: true,
      feetPerCell: 5,
      tokens: [caster, target],
      dnd5ePluginAreas: [],
    }],
  })

  const context = await browser.newContext({ viewport: { width: 1_180, height: 820 } })
  const dm = await context.newPage()
  const pageErrors: string[] = []
  dm.on('pageerror', (error) => pageErrors.push(error.message))
  await dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' })
  await dm.waitForURL(/\/campaign\/local\/maps$/)
  await hydrateMaps(dm)

  const canvas = dm.getByTestId('map-canvas')
  await expect(canvas).toBeVisible()
  await dm.evaluate(async ({ activeMapId }) => {
    const { useMapStore } = await import('/src/store/maps.ts')
    const {
      createDnd5eCoreSpellArea,
      getDnd5eCoreSpellAreaDeclaration,
    } = await import('/src/rulesets/dnd5e/coreSpellAreas.ts')
    const declaration = getDnd5eCoreSpellAreaDeclaration('grease')
    if (!declaration) throw new Error('Grease declaration is missing')
    const cells = [
      { col: 4, row: 3 }, { col: 5, row: 3 },
      { col: 4, row: 4 }, { col: 5, row: 4 },
    ]
    const area = createDnd5eCoreSpellArea({
      declaration,
      actionId: 'grease-pool-e2e-cast',
      sourceCharacterId: 'grease-caster-character',
      sourceTokenId: 'grease-caster',
      slotLevel: 1,
      sourceSaveDc: 15,
      round: 1,
      cells,
      anchorCell: { col: 4, row: 3 },
    })
    useMapStore.getState().updateMap(activeMapId, { dnd5ePluginAreas: [area] })
  }, { activeMapId: mapId })

  await expect.poll(() => dm.evaluate(async (activeMapId) => {
    const { useMapStore } = await import('/src/store/maps.ts')
    return useMapStore.getState().maps.find((map) => map.id === activeMapId)
      ?.dnd5ePluginAreas?.[0]?.visual?.preset
  }, mapId)).toBe('grease')
  await dm.waitForTimeout(1_200)

  await canvas.screenshot({
    path: process.env.GREASE_POOL_SCREENSHOT_PATH ?? 'test-results/grease-pool-visual.png',
  })
  expect(pageErrors).toEqual([])
  await context.close()
})
