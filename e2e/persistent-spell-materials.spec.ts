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

test('persistent spells use material atlases without duplicate effect tokens', async ({ browser, request }) => {
  const now = Date.now()
  const mapId = `persistent-spell-materials-${now}`
  const caster = {
    id: 'caster-token', label: '施法者', x: 90, y: 90,
    color: '#a78bfa', emoji: '🧙', size: 1, type: 'player', characterId: 'caster',
  }
  const spiritualWeapon = {
    id: 'spiritual-weapon-token', label: '灵体武器', x: 330, y: 150,
    color: '#c4b5fd', emoji: '⚔', size: 1, type: 'obstacle',
    showHpOnToken: false, showDetailOnToken: false,
    dnd5eSpellEffect: {
      schemaVersion: 1, spellId: 'spiritual-weapon', sourceCharacterId: 'caster',
      sourceTokenId: 'caster-token', createdRound: 1, expiresAfterRound: 10,
    },
  }

  await putState(request, 'maps', {
    selectedId: mapId,
    maps: [{
      id: mapId, name: '持续法术材质 E2E', width: 1_200, height: 720,
      gridSize: 60, gridOffsetX: 0, gridOffsetY: 0, gridColor: '#c4b5fd',
      gridOpacity: 0.32, showGrid: true, feetPerCell: 5,
      tokens: [caster], dnd5ePluginAreas: [],
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
  await dm.evaluate(async ({ activeMapId, spiritualWeaponToken }) => {
    const { useMapStore } = await import('/src/store/maps.ts')
    const { normalizeCharacter, useCharacterStore } = await import('/src/store/characters.ts')
    const {
      createDnd5eMechanicalEffect,
      DND5E_COMBAT_STATE_SCHEMA_VERSION,
    } = await import('/src/rulesets/dnd5e/activeEffects.ts')
    const {
      createDnd5eCoreSpellArea,
      getDnd5eCoreSpellAreaDeclaration,
    } = await import('/src/rulesets/dnd5e/coreSpellAreas.ts')
    const make = (
      spellId: string,
      cells: Array<{ col: number; row: number }>,
      anchorCell: { col: number; row: number },
      anchorTokenId?: string,
    ) => {
      const declaration = getDnd5eCoreSpellAreaDeclaration(spellId)
      if (!declaration) throw new Error(`${spellId} declaration is missing`)
      return createDnd5eCoreSpellArea({
        declaration, actionId: `${spellId}-e2e`, sourceCharacterId: 'caster',
        sourceTokenId: 'caster-token', slotLevel: declaration.minimumSlotLevel,
        sourceSaveDc: 15, round: 1, cells, anchorCell, anchorTokenId,
      })
    }
    const square = (minCol: number, minRow: number, size: number) =>
      Array.from({ length: size * size }, (_, index) => ({
        col: minCol + index % size,
        row: minRow + Math.floor(index / size),
      }))
    const areas = [
      make('mage-hand', [{ col: 2, row: 2 }], { col: 2, row: 2 }),
      make('spiritual-weapon', [{ col: 5, row: 2 }], { col: 5, row: 2 }, 'spiritual-weapon-token'),
      make('moonbeam', [{ col: 8, row: 2 }], { col: 8, row: 2 }),
      make('spirit-guardians', square(10, 1, 5), { col: 12, row: 3 }),
      make('insect-plague', square(15, 1, 4), { col: 16, row: 2 }),
      make('wall-of-fire', Array.from({ length: 10 }, (_, col) => ({ col: col + 2, row: 7 })), { col: 2, row: 7 }),
      make('blade-barrier', Array.from({ length: 15 }, (_, col) => ({ col: col + 2, row: 10 })), { col: 2, row: 10 }),
    ].map((area) => ({
      ...area,
      // This is a visual-composition fixture: keep mutually exclusive
      // concentration spells alive together so every atlas can be compared.
      concentrationId: undefined,
      expiresAfterRound: 999,
    }))
    const spiritualWeaponArea = areas.find((area) => area.coreSpellId === 'spiritual-weapon')
    if (!spiritualWeaponArea) throw new Error('Spiritual Weapon fixture is missing')
    const spiritualWeaponEffect = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:spiritual-weapon',
      label: 'Spiritual Weapon',
      targetId: 'caster-token',
      source: { kind: 'spell', actorId: 'caster-token', rulesId: 'spiritual-weapon' },
      duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
      potency: 2,
      stackingPolicy: 'stack',
      stackingKey: spiritualWeaponArea.id,
    })
    useCharacterStore.setState({
      characters: [normalizeCharacter({
        id: 'caster', name: 'Caster', player: 'E2E', avatar: '', accent: '#a78bfa',
        race: 'Human', charClass: 'Cleric', level: 5, background: '',
        dnd5eCombatState: {
          schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION,
          activeEffects: [spiritualWeaponEffect],
        },
      })],
      selectedId: 'caster',
    })
    const currentMap = useMapStore.getState().maps.find((map) => map.id === activeMapId)
    if (!currentMap) throw new Error('E2E map is missing')
    useMapStore.getState().updateMap(activeMapId, {
      tokens: [...currentMap.tokens, spiritualWeaponToken],
      dnd5ePluginAreas: areas,
    })
  }, { activeMapId: mapId, spiritualWeaponToken: spiritualWeapon })

  await expect.poll(() => dm.evaluate(async (activeMapId) => {
    const { useMapStore } = await import('/src/store/maps.ts')
    return useMapStore.getState().maps.find((map) => map.id === activeMapId)
      ?.dnd5ePluginAreas?.length
  }, mapId)).toBe(7)
  await expect.poll(() => dm.evaluate(async (activeMapId) => {
    const { useMapStore } = await import('/src/store/maps.ts')
    return useMapStore.getState().maps.find((map) => map.id === activeMapId)
      ?.dnd5ePluginAreas?.map((area) => area.visual?.preset).sort()
  }, mapId)).toEqual([
    'blade-barrier', 'insect-plague', 'mage-hand', 'moonbeam',
    'spirit-guardians', 'spiritual-weapon', 'wall-of-fire',
  ].sort())
  const materialAssets = [
    'blade-barrier', 'insect-plague', 'mage-hand', 'moonbeam',
    'spirit-guardians', 'spiritual-weapon', 'wall-of-fire',
  ].map((preset) => `/assets/vfx/${preset}-sprite-v2.png`)
  await expect(dm.evaluate(async (assets) => Promise.all(assets.map((asset) =>
    new Promise<{ asset: string; loaded: boolean }>((resolve) => {
      const image = new Image()
      image.onload = () => resolve({ asset, loaded: true })
      image.onerror = () => resolve({ asset, loaded: false })
      image.src = asset
    }),
  )), materialAssets)).resolves.toEqual(materialAssets.map((asset) => ({ asset, loaded: true })))
  await expect.poll(() => dm.evaluate(async () => {
    const Konva = (await import('/node_modules/.vite/deps/konva.js')).default
    return Konva.stages.flatMap((stage) =>
      stage.find('.persistent-area-sprite-atlas').map((node) => node.name()),
    ).sort()
  }), { timeout: 15_000 }).toEqual([
    'persistent-area-sprite-atlas persistent-area-blade-barrier',
    'persistent-area-sprite-atlas persistent-area-insect-plague',
    'persistent-area-sprite-atlas persistent-area-mage-hand',
    'persistent-area-sprite-atlas persistent-area-moonbeam',
    'persistent-area-sprite-atlas persistent-area-spirit-guardians',
    'persistent-area-sprite-atlas persistent-area-spiritual-weapon',
    'persistent-area-sprite-atlas persistent-area-wall-of-fire',
  ].sort())
  await dm.waitForTimeout(5_500)
  await canvas.screenshot({
    path: process.env.PERSISTENT_SPELL_MATERIALS_SCREENSHOT_PATH ??
      'test-results/persistent-spell-materials.png',
  })
  expect(pageErrors).toEqual([])
  await context.close()
})
