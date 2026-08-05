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

test('persistent spell entrances remain formed while Headless waits', async ({ browser, request }) => {
  const now = Date.now()
  const mapId = `persistent-spell-handoff-${now}`
  await putState(request, 'maps', {
    selectedId: mapId,
    maps: [{
      id: mapId,
      name: 'Persistent spell handoff E2E',
      width: 1_200,
      height: 720,
      gridSize: 60,
      gridOffsetX: 0,
      gridOffsetY: 0,
      gridColor: '#c4b5fd',
      gridOpacity: 0.32,
      showGrid: true,
      feetPerCell: 5,
      tokens: [{
        id: 'caster-token',
        label: 'Caster',
        x: 90,
        y: 90,
        color: '#a78bfa',
        emoji: '🧙',
        size: 1,
        type: 'player',
        characterId: 'caster',
      }],
      dnd5ePluginAreas: [],
    }],
  })

  const context = await browser.newContext({ viewport: { width: 1_420, height: 900 } })
  const dm = await context.newPage()
  const pageErrors: string[] = []
  dm.on('pageerror', (error) => pageErrors.push(error.message))
  await dm.goto(`${DM}/maps`, { waitUntil: 'domcontentloaded' })
  await dm.waitForURL(/\/campaign\/local\/maps$/)
  await hydrateMaps(dm)

  const canvas = dm.getByTestId('map-canvas')
  await expect(canvas).toBeVisible()
  await dm.evaluate(async ({ activeMapId }) => {
    const { publishAreaSpellPresentation } = await import('/src/lib/combatPresentation.ts')
    await Promise.all([
      publishAreaSpellPresentation({
        id: 'wall-handoff-e2e',
        mapId: activeMapId,
        transactionId: 'wall-handoff-e2e',
        sourceTokenId: 'caster-token',
        spellId: 'wall-of-fire',
        targetCell: { col: 7, row: 4 },
        shape: 'rect',
        widthFeet: 60,
        heightFeet: 5,
        wallOfFireShape: 'line',
        wallOfFireAngleDegrees: 0,
      }),
      publishAreaSpellPresentation({
        id: 'sphere-handoff-e2e',
        mapId: activeMapId,
        transactionId: 'sphere-handoff-e2e',
        sourceTokenId: 'caster-token',
        spellId: 'flaming-sphere',
        targetCell: { col: 12, row: 6 },
        shape: 'circle',
        radiusFeet: 5,
      }),
      publishAreaSpellPresentation({
        id: 'cloudkill-handoff-e2e',
        mapId: activeMapId,
        transactionId: 'cloudkill-handoff-e2e',
        sourceTokenId: 'caster-token',
        spellId: 'cloudkill',
        targetCell: { col: 15, row: 4 },
        shape: 'circle',
        radiusFeet: 20,
      }),
    ])
  }, { activeMapId: mapId })

  await dm.waitForTimeout(3_000)
  await expect(canvas).toHaveAttribute('data-combat-projectile-kinds', /wall-of-fire/)
  await expect(canvas).toHaveAttribute('data-combat-projectile-kinds', /flaming-sphere/)
  await expect(canvas).toHaveAttribute('data-combat-projectile-kinds', /cloudkill/)
  await expect.poll(() => dm.evaluate(async () => {
    const Konva = (await import('/node_modules/.vite/deps/konva.js')).default
    return ['wall-of-fire', 'flaming-sphere', 'cloudkill'].map((kind) => {
      const group = Konva.stages.flatMap((stage) =>
        stage.find(`.target-sprite-atlas-${kind}`),
      )[0]
      const image = group?.findOne('.target-sprite-atlas-image')
      return {
        kind,
        groupOpacity: group?.opacity() ?? 0,
        imageOpacity: image?.opacity() ?? 0,
        cropRow: image ? Math.round(image.cropY() / Math.max(1, image.cropHeight())) : -1,
      }
    })
  })).toEqual([
    { kind: 'wall-of-fire', groupOpacity: 1, imageOpacity: 1, cropRow: 2 },
    { kind: 'flaming-sphere', groupOpacity: 1, imageOpacity: 1, cropRow: 2 },
    { kind: 'cloudkill', groupOpacity: 1, imageOpacity: 1, cropRow: 2 },
  ])
  await canvas.screenshot({
    path: process.env.PERSISTENT_SPELL_HANDOFF_SCREENSHOT_PATH ??
      'test-results/persistent-spell-handoff.png',
  })
  expect(pageErrors).toEqual([])
  await context.close()
})
