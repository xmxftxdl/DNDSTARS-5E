import { afterEach, describe, expect, it } from 'vitest'
import type { BattleMap } from '../../store/maps'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
import {
  createDnd5eCoreSpellArea,
  dnd5eWallOfFireDamagingSideCells,
  getDnd5eCoreSpellAreaDeclaration,
  mergeDnd5eSpellEffectTokenDelta,
  moveDnd5eCoreSpellArea,
  reconcileDnd5ePersistentAreaAnchors,
  removeDnd5eSpellEffectFromMap,
  resolveDnd5eCoreSpellLightingConflicts,
  type Dnd5eCoreSpellAreaDeclaration,
} from './coreSpellAreas'

const declaration: Dnd5eCoreSpellAreaDeclaration = {
  spellId: 'test-zone',
  label: '测试区域',
  minimumSlotLevel: 2,
  template: { shape: 'circle', origin: 'point', radiusFeet: 5, placeRangeFeet: 60 },
  durationRounds: 10,
  concentration: true,
  anchorMode: 'fixed',
  movement: { economy: 'action', maximumFeet: 60 },
  color: '#8b5cf6',
  visual: { preset: 'arcane', intensity: 'normal' },
  triggers: [{
    id: 'tick',
    label: '区域伤害',
    timing: 'turn-start',
    savingThrow: { ability: 'con', onSuccess: 'half' },
    damage: { count: 2, sides: 6, perHigherSlot: 1, type: 'radiant' },
    dmAdjustable: true,
  }],
}

function map(): BattleMap {
  return {
    id: 'map', name: 'map', width: 500, height: 500, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
    tokens: [
      { id: 'caster-token', label: 'caster', x: 75, y: 75, color: '#fff', emoji: 'C', size: 1, type: 'player', characterId: 'caster' },
    ],
  }
}

describe('core spell persistent area declarations', () => {
  afterEach(() => setMapGeometryRuntime([]))

  it('declares ground hazards separately from bounded three-dimensional spell volumes', () => {
    for (const spellId of ['grease', 'entangle', 'black-tentacles', 'spike-growth', 'ice-storm']) {
      expect(getDnd5eCoreSpellAreaDeclaration(spellId)?.vertical).toEqual({ mode: 'ground' })
    }
    expect(getDnd5eCoreSpellAreaDeclaration('spirit-guardians')?.vertical).toEqual({
      mode: 'volume', heightFeet: 30, anchorOffsetFeet: -15,
    })
    expect(getDnd5eCoreSpellAreaDeclaration('moonbeam')?.vertical).toEqual({
      mode: 'volume', heightFeet: 40,
    })
    expect(getDnd5eCoreSpellAreaDeclaration('flaming-sphere')?.vertical).toEqual({
      mode: 'volume', heightFeet: 10,
    })
    expect(getDnd5eCoreSpellAreaDeclaration('wall-of-fire')?.vertical).toEqual({
      mode: 'volume', heightFeet: 20,
    })
  })

  it('treats Wall of Fire as an opaque twenty-foot-high volume', () => {
    const wallOfFire = getDnd5eCoreSpellAreaDeclaration('wall-of-fire')
    expect(wallOfFire).toMatchObject({
      vertical: { mode: 'volume', heightFeet: 20 },
      blocking: { vision: true },
    })
    if (!wallOfFire) return
    const area = createDnd5eCoreSpellArea({
      declaration: wallOfFire,
      actionId: 'wall-of-fire-opacity',
      sourceCharacterId: 'caster',
      sourceTokenId: 'caster-token',
      slotLevel: 4,
      sourceSaveDc: 15,
      round: 1,
      cells: [{ col: 1, row: 1 }],
      anchorCell: { col: 1, row: 1 },
    })
    expect(area.blocking).toEqual({ vision: true })
  })

  it('keeps Wall of Thorns damage deterministic across create, enter, and turn-end triggers', () => {
    const wallOfThorns = getDnd5eCoreSpellAreaDeclaration('wall-of-thorns')
    expect(wallOfThorns).toMatchObject({
      movementCostMultiplier: 4,
      blocking: { vision: true },
      vertical: { mode: 'volume', heightFeet: 10 },
    })
    if (!wallOfThorns) return
    const area = createDnd5eCoreSpellArea({
      declaration: wallOfThorns,
      actionId: 'wall-of-thorns-upcast',
      sourceCharacterId: 'caster',
      sourceTokenId: 'caster-token',
      slotLevel: 9,
      sourceSaveDc: 19,
      round: 1,
      cells: [{ col: 2, row: 2 }],
      anchorCell: { col: 2, row: 2 },
    })
    expect(area.triggers).toEqual([
      expect.objectContaining({
        id: 'wall-of-thorns-create',
        damage: { count: 10, sides: 8, modifier: 0, type: 'piercing' },
        dmAdjustable: false,
      }),
      expect.objectContaining({
        id: 'wall-of-thorns-enter',
        damage: { count: 10, sides: 8, modifier: 0, type: 'slashing' },
        dmAdjustable: false,
      }),
      expect.objectContaining({
        id: 'wall-of-thorns-turn-end',
        damage: { count: 10, sides: 8, modifier: 0, type: 'slashing' },
        dmAdjustable: false,
      }),
    ])
  })

  it('keeps the Grease pool authoritative for ten rounds without concentration', () => {
    const grease = getDnd5eCoreSpellAreaDeclaration('grease')
    expect(grease).toMatchObject({
      durationRounds: 10,
      concentration: false,
      anchorMode: 'fixed',
      template: { shape: 'rect', widthFeet: 10, heightFeet: 10 },
      visual: { preset: 'grease' },
    })
  })

  it('declares dedicated material visuals for persistent spell entities and zones', () => {
    expect(getDnd5eCoreSpellAreaDeclaration('mage-hand')?.visual?.preset).toBe('mage-hand')
    expect(getDnd5eCoreSpellAreaDeclaration('spiritual-weapon')?.visual?.preset).toBe('spiritual-weapon')
    expect(getDnd5eCoreSpellAreaDeclaration('insect-plague')?.visual?.preset).toBe('insect-plague')
    expect(getDnd5eCoreSpellAreaDeclaration('blade-barrier')?.visual?.preset).toBe('blade-barrier')
  })

  it('ends Mage Hand when its caster moves beyond the 30-foot tether', () => {
    const base = { ...map(), width: 1_000 }
    const mageHand = getDnd5eCoreSpellAreaDeclaration('mage-hand')
    expect(mageHand).toMatchObject({
      durationRounds: 10,
      movement: {
        economy: 'action', maximumFeet: 30,
        maximumDistanceFromSourceFeet: 30,
        endWhenExceedingSourceDistance: true,
      },
    })
    if (!mageHand) return
    const hand = createDnd5eCoreSpellArea({
      declaration: mageHand,
      actionId: 'mage-hand-cast',
      sourceCharacterId: 'caster',
      sourceTokenId: 'caster-token',
      slotLevel: 0,
      sourceSaveDc: 13,
      round: 1,
      cells: [{ col: 1, row: 1 }],
      anchorCell: { col: 1, row: 1 },
    })
    expect(reconcileDnd5ePersistentAreaAnchors({
      ...base,
      tokens: base.tokens.map((token) => ({ ...token, x: 425, y: 75 })),
      dnd5ePluginAreas: [hand],
    }).dnd5ePluginAreas).toEqual([])
  })

  it('keeps an interposing Arcane Hand between its source and selected target', () => {
    const base = map()
    const hand = {
      id: 'arcane-hand-token', label: '奥术之手', x: 325, y: 75,
      color: '#60a5fa', emoji: '✋', size: 2, type: 'obstacle' as const,
      dnd5eSpellEffect: {
        schemaVersion: 1 as const, spellId: 'arcane-hand', sourceCharacterId: 'caster',
        sourceTokenId: 'caster-token', createdRound: 1, expiresAfterRound: 10,
      },
    }
    const target = {
      id: 'arcane-hand-target', label: 'target', x: 375, y: 75,
      color: '#f00', emoji: 'T', size: 1, type: 'enemy' as const,
    }
    const interposed = {
      id: 'arcane-hand-area', pluginId: 'srd-5.1', featureId: 'spell:arcane-hand',
      sourceKind: 'core-spell' as const, coreSpellId: 'arcane-hand', label: '奥术之手', color: '#60a5fa',
      sourceCharacterId: 'caster', sourceTokenId: 'caster-token',
      cells: [{ col: 6, row: 1 }], anchorCell: { col: 6, row: 1 },
      anchorMode: 'effect-token' as const, anchorTokenId: hand.id,
      createdRound: 1, expiresAfterRound: 10,
      interposition: { targetTokenId: target.id, mode: 'blocked' as const },
    }
    const reconciled = reconcileDnd5ePersistentAreaAnchors({
      ...base,
      tokens: [...base.tokens, hand, target],
      dnd5ePluginAreas: [interposed],
    })
    expect(reconciled.tokens.find((token) => token.id === hand.id)).toMatchObject({ x: 275, y: 75 })
    expect(reconciled.dnd5ePluginAreas?.[0]).toMatchObject({
      anchorCell: { col: 5, row: 1 },
      cells: [{ col: 5, row: 1 }],
      interposition: { targetTokenId: target.id, mode: 'blocked' },
    })
  })

  it('declares the deterministic fog, silence, hazard and wall primitives without claiming narrative automation', () => {
    expect(getDnd5eCoreSpellAreaDeclaration('fog-cloud')).toMatchObject({
      obscuration: { kind: 'heavy' },
      vertical: {
        mode: 'volume', heightFeet: 40, anchorOffsetFeet: -20,
        perHigherSlot: { heightFeet: 40, anchorOffsetFeet: -20 },
      },
    })
    expect(getDnd5eCoreSpellAreaDeclaration('web')).toMatchObject({
      template: { shape: 'rect', widthFeet: 20, heightFeet: 20, gridAligned: true },
      movementCostMultiplier: 2,
      obscuration: { kind: 'light' },
      triggers: expect.arrayContaining([
        expect.objectContaining({ timing: 'on-enter', condition: expect.objectContaining({ condition: 'restrained' }) }),
      ]),
    })
    expect(getDnd5eCoreSpellAreaDeclaration('silence')).toMatchObject({
      occupantModifiers: {
        containment: 'fully-contained',
        preventsVerbalComponents: true,
        damageImmunities: ['thunder'],
      },
    })
    expect(getDnd5eCoreSpellAreaDeclaration('stinking-cloud')).toMatchObject({
      triggers: [expect.objectContaining({ consumeActionOnFailedSave: true })],
    })
    expect(getDnd5eCoreSpellAreaDeclaration('sleet-storm')).toMatchObject({
      template: { shape: 'circle', radiusFeet: 40, placeRangeFeet: 150 },
      vertical: { mode: 'volume', heightFeet: 20 },
      movementCostMultiplier: 2,
      obscuration: { kind: 'heavy' },
      triggers: expect.arrayContaining([
        expect.objectContaining({
          id: 'sleet-storm-turn-start',
          savingThrow: { ability: 'dex', onSuccess: 'none' },
          condition: expect.objectContaining({ condition: 'prone' }),
        }),
        expect.objectContaining({
          id: 'sleet-storm-concentration-turn-start',
          savingThrow: { ability: 'con', onSuccess: 'none' },
          endTargetConcentrationOnFailedSave: true,
        }),
      ]),
    })
    const stinkingCloud = getDnd5eCoreSpellAreaDeclaration('stinking-cloud')
    expect(stinkingCloud).toBeDefined()
    if (stinkingCloud) {
      expect(createDnd5eCoreSpellArea({
        declaration: stinkingCloud,
        actionId: 'stinking-cloud-cast',
        sourceCharacterId: 'caster',
        sourceTokenId: 'caster-token',
        slotLevel: 3,
        sourceSaveDc: 15,
        round: 1,
        cells: [{ col: 2, row: 2 }],
        anchorCell: { col: 2, row: 2 },
      }).triggers?.[0]).toMatchObject({
        consumeActionOnFailedSave: true,
        savingThrow: { automaticSuccessForDamageImmunity: 'poison' },
      })
    }
    const windWall = getDnd5eCoreSpellAreaDeclaration('wind-wall')
    expect(windWall).toMatchObject({
      blocking: { movement: true, movementMode: 'boundary' },
    })
    expect(createDnd5eCoreSpellArea({
      declaration: windWall!,
      actionId: 'wind-wall-cast',
      sourceCharacterId: 'caster',
      sourceTokenId: 'caster-token',
      slotLevel: 3,
      sourceSaveDc: 15,
      round: 1,
      cells: [{ col: 2, row: 2 }],
      anchorCell: { col: 2, row: 2 },
    })).toMatchObject({
      createdRound: 1,
      expiresAfterRound: 11,
      expiresAtSourceTurnEndAfterRound: 11,
    })
    expect(getDnd5eCoreSpellAreaDeclaration('wall-of-force')).toMatchObject({
      hiddenFromPlayers: true,
      blocking: { movement: true, lineOfEffect: true },
    })
    for (const spellId of ['wall-of-stone', 'wall-of-ice']) {
      expect(getDnd5eCoreSpellAreaDeclaration(spellId)).toMatchObject({
        blocking: { movement: true, vision: true, lineOfEffect: true },
      })
    }
  })

  it('scales Fog Cloud as a sphere when cast with a higher-level slot', () => {
    const fogCloud = getDnd5eCoreSpellAreaDeclaration('fog-cloud')
    expect(fogCloud).toBeDefined()
    if (!fogCloud) return

    const createAtSlot = (slotLevel: number) => createDnd5eCoreSpellArea({
      declaration: fogCloud,
      actionId: `fog-cloud-${slotLevel}`,
      sourceCharacterId: 'caster',
      sourceTokenId: 'caster-token',
      slotLevel,
      sourceSaveDc: 13,
      round: 1,
      cells: [{ col: 2, row: 2 }],
      anchorCell: { col: 2, row: 2 },
      baseElevationFeet: 0,
    })

    expect(createAtSlot(1).vertical).toEqual({
      mode: 'volume', baseElevationFeet: -20, heightFeet: 40, anchorOffsetFeet: -20,
    })
    expect(createAtSlot(2).vertical).toEqual({
      mode: 'volume', baseElevationFeet: -40, heightFeet: 80, anchorOffsetFeet: -40,
    })
    expect(createAtSlot(4).vertical).toEqual({
      mode: 'volume', baseElevationFeet: -80, heightFeet: 160, anchorOffsetFeet: -80,
    })
  })

  it('captures fixed volume elevation and preserves anchored volume offsets in the runtime snapshot', () => {
    const moonbeam = getDnd5eCoreSpellAreaDeclaration('moonbeam')
    const guardians = getDnd5eCoreSpellAreaDeclaration('spirit-guardians')
    expect(moonbeam).toBeDefined()
    expect(guardians).toBeDefined()
    if (!moonbeam || !guardians) return

    expect(createDnd5eCoreSpellArea({
      declaration: moonbeam,
      actionId: 'moonbeam-cast',
      sourceCharacterId: 'caster',
      sourceTokenId: 'caster-token',
      slotLevel: 2,
      sourceSaveDc: 13,
      round: 1,
      cells: [{ col: 2, row: 2 }],
      anchorCell: { col: 2, row: 2 },
      baseElevationFeet: 20,
    }).vertical).toEqual({
      mode: 'volume', baseElevationFeet: 20, heightFeet: 40,
    })
    expect(createDnd5eCoreSpellArea({
      declaration: guardians,
      actionId: 'guardians-cast',
      sourceCharacterId: 'caster',
      sourceTokenId: 'caster-token',
      slotLevel: 3,
      sourceSaveDc: 13,
      round: 1,
      cells: [{ col: 1, row: 1 }],
      anchorCell: { col: 1, row: 1 },
      baseElevationFeet: 30,
    }).vertical).toEqual({
      mode: 'volume', baseElevationFeet: 15, heightFeet: 30, anchorOffsetFeet: -15,
    })
  })

  it('reanchors a source volume vertically when terrain changes without an XY cell change', () => {
    const guardians = getDnd5eCoreSpellAreaDeclaration('spirit-guardians')
    expect(guardians).toBeDefined()
    if (!guardians) return
    const base = map()
    const geometry = createEmptyMapGeometry(base.id, 1)
    geometry.obstacles.push({
      id: 'plateau', kind: 'obstacle', label: 'Plateau',
      points: [{ x: 50, y: 50 }, { x: 100, y: 50 }, { x: 100, y: 100 }, { x: 50, y: 100 }],
      blocksVision: false, blocksMovement: false, blocksLineOfEffect: false, cover: 'none',
      baseHeightFeet: 0, heightFeet: 0, terrainRegion: true, terrainElevationFeet: 40, createdAt: 1,
    })
    setMapGeometryRuntime([geometry])
    const attached = createDnd5eCoreSpellArea({
      declaration: guardians,
      actionId: 'guardians-cast',
      sourceCharacterId: 'caster',
      sourceTokenId: 'caster-token',
      slotLevel: 3,
      sourceSaveDc: 13,
      round: 1,
      cells: [{ col: 1, row: 1 }],
      anchorCell: { col: 1, row: 1 },
      baseElevationFeet: 0,
    })
    const reconciled = reconcileDnd5ePersistentAreaAnchors({
      ...base,
      dnd5ePluginAreas: [attached],
    })

    expect(reconciled.dnd5ePluginAreas?.[0]).toMatchObject({
      anchorCell: { col: 1, row: 1 },
      vertical: { mode: 'volume', baseElevationFeet: 25, heightFeet: 30, anchorOffsetFeet: -15 },
    })
  })

  it('keeps Wall of Fire damage on the selected side of the wall', () => {
    const base = map()
    const wallCells = [{ col: 4, row: 4 }, { col: 5, row: 4 }]
    const east = dnd5eWallOfFireDamagingSideCells({
      wallCells,
      orientation: 0,
      map: base,
    })
    expect(east).toEqual(expect.arrayContaining([
      { col: 4, row: 4 }, { col: 5, row: 4 }, { col: 6, row: 4 },
      { col: 5, row: 4 }, { col: 6, row: 4 }, { col: 7, row: 4 },
    ]))
    expect(east).not.toContainEqual({ col: 4, row: 3 })

    const declaration = getDnd5eCoreSpellAreaDeclaration('wall-of-fire')
    expect(declaration).toBeDefined()
    if (!declaration) return
    const area = createDnd5eCoreSpellArea({
      declaration,
      actionId: 'wall-cast',
      sourceCharacterId: 'caster',
      sourceTokenId: 'caster-token',
      slotLevel: 5,
      sourceSaveDc: 15,
      round: 1,
      cells: wallCells,
      anchorCell: wallCells[0],
      triggerCellsById: { 'wall-of-fire-turn-end': east },
    })
    expect(area.triggers).toContainEqual(expect.objectContaining({
      id: 'wall-of-fire-create',
      savingThrow: { ability: 'dex', dc: 15, onSuccess: 'half' },
      damage: { count: 6, sides: 8, modifier: 0, type: 'fire' },
    }))
    expect(area.triggers).toContainEqual(expect.objectContaining({
      id: 'wall-of-fire-turn-end',
      cells: east,
      damage: { count: 6, sides: 8, modifier: 0, type: 'fire' },
    }))
    expect(area.triggers?.map((trigger) => trigger.dmAdjustable)).toEqual([
      false,
      false,
      false,
    ])
  })

  it('resolves Darkness and Daylight overlap by spell level instead of render order', () => {
    const base = {
      ...createDnd5eCoreSpellArea({
        declaration,
        actionId: 'base',
        sourceCharacterId: 'caster',
        sourceTokenId: 'caster-token',
        slotLevel: 2,
        sourceSaveDc: 13,
        round: 1,
        cells: [{ col: 2, row: 2 }],
        anchorCell: { col: 2, row: 2 },
      }),
      lighting: {
        kind: 'magical-darkness' as const,
        radiusFeet: 15,
        spellLevel: 2,
        suppressesMagicalLightThroughLevel: 2,
      },
    }
    const lowLight = {
      ...base,
      id: 'low-light',
      lighting: { kind: 'light' as const, brightRadiusFeet: 20, dimRadiusFeet: 20, color: '#fff000', spellLevel: 2 },
    }
    expect(resolveDnd5eCoreSpellLightingConflicts([base], lowLight)).toMatchObject({
      applied: false,
      areas: [{ id: base.id }],
    })

    const daylight = {
      ...lowLight,
      id: 'daylight',
      lighting: {
        ...lowLight.lighting,
        spellLevel: 3,
        suppressesMagicalDarknessThroughLevel: 3,
      },
    }
    expect(resolveDnd5eCoreSpellLightingConflicts([base], daylight)).toMatchObject({
      applied: true,
      removedAreas: [{ id: base.id }],
      areas: [{ id: 'daylight' }],
    })
  })

  it('resolves save DC and higher-slot damage into a safe runtime snapshot', () => {
    const area = createDnd5eCoreSpellArea({
      declaration,
      actionId: 'cast-1',
      sourceCharacterId: 'caster',
      sourceTokenId: 'caster-token',
      slotLevel: 4,
      sourceSaveDc: 15,
      round: 2,
      cells: [{ col: 2, row: 2 }],
      anchorCell: { col: 2, row: 2 },
    })
    expect(area).toMatchObject({
      sourceKind: 'core-spell', coreSpellId: 'test-zone', slotLevel: 4,
      concentrationId: 'test-zone', expiresAfterRound: 12,
      triggers: [{ savingThrow: { dc: 15 }, damage: { count: 4, sides: 6 } }],
    })
  })

  it('moves an owned area within its declared range and rejects farther destinations', () => {
    const base = map()
    const area = createDnd5eCoreSpellArea({
      declaration,
      actionId: 'cast-1',
      sourceCharacterId: 'caster',
      sourceTokenId: 'caster-token',
      slotLevel: 2,
      sourceSaveDc: 13,
      round: 1,
      cells: [{ col: 1, row: 1 }, { col: 2, row: 1 }],
      anchorCell: { col: 1, row: 1 },
    })
    const placed = { ...base, dnd5ePluginAreas: [area] }
    const moved = moveDnd5eCoreSpellArea({
      map: placed, areaId: area.id, sourceTokenId: 'caster-token', targetCell: { col: 4, row: 3 },
    })
    expect(moved.ok).toBe(true)
    if (moved.ok) {
      expect(moved.distanceFeet).toBe(15)
      expect(moved.area.cells).toEqual([{ col: 4, row: 3 }, { col: 5, row: 3 }])
    }
    expect(moveDnd5eCoreSpellArea({
      map: placed, areaId: area.id, sourceTokenId: 'caster-token', targetCell: { col: 20, row: 20 },
    })).toMatchObject({ ok: false, reason: 'target-out-of-range' })
  })

  it('moves a generic feature projection and enforces its source tether', () => {
    const base = map()
    const projection = {
      id: 'activity-area:projection', pluginId: 'local.test', featureId: 'feature:projection',
      sourceKind: 'plugin-feature' as const, utilityProjectionId: 'mirror', label: 'Mirror', color: '#a78bfa',
      sourceCharacterId: 'caster', sourceTokenId: 'caster-token', cells: [{ col: 2, row: 1 }],
      createdRound: 1, expiresAfterRound: 10, anchorMode: 'fixed' as const, anchorCell: { col: 2, row: 1 },
      movement: { economy: 'bonus-action' as const, maximumFeet: 30, maximumDistanceFromSourceFeet: 10 },
    }
    const placed = { ...base, dnd5ePluginAreas: [projection] }
    expect(moveDnd5eCoreSpellArea({
      map: placed, areaId: projection.id, sourceTokenId: 'caster-token', targetCell: { col: 3, row: 1 },
    })).toMatchObject({ ok: true, area: { utilityProjectionId: 'mirror', anchorCell: { col: 3, row: 1 } } })
    expect(moveDnd5eCoreSpellArea({
      map: placed, areaId: projection.id, sourceTokenId: 'caster-token', targetCell: { col: 4, row: 1 },
    })).toMatchObject({ ok: false, reason: 'target-out-of-range' })
  })

  it('ends a generic spell entity when its movement command crosses an ending tether', () => {
    const base = { ...map(), width: 1_000 }
    const servant = {
      id: 'activity-area:unseen-servant', pluginId: 'srd-5.1',
      featureId: 'spell:unseen-servant', sourceKind: 'core-spell' as const,
      coreSpellId: 'unseen-servant', label: '隐形仆役', color: '#94a3b8',
      sourceCharacterId: 'caster', sourceTokenId: 'caster-token',
      cells: [{ col: 11, row: 1 }], createdRound: 1, expiresAfterRound: 600,
      anchorMode: 'fixed' as const, anchorCell: { col: 11, row: 1 },
      movement: {
        economy: 'bonus-action' as const,
        maximumFeet: 15,
        maximumDistanceFromSourceFeet: 60,
        endWhenExceedingSourceDistance: true,
      },
    }
    const moved = moveDnd5eCoreSpellArea({
      map: { ...base, dnd5ePluginAreas: [servant] },
      areaId: servant.id,
      sourceTokenId: 'caster-token',
      targetCell: { col: 14, row: 1 },
    })
    expect(moved).toMatchObject({ ok: true, distanceFeet: 15 })
    if (moved.ok) expect(moved.map.dnd5ePluginAreas).toEqual([])
  })

  it('moves Dancing Lights origins independently and preserves their formation rules', () => {
    const dancingLights = getDnd5eCoreSpellAreaDeclaration('dancing-lights')
    expect(dancingLights).toBeDefined()
    if (!dancingLights) return
    const base = { ...map(), width: 1_500 }
    const origins = [
      { col: 2, row: 1 },
      { col: 3, row: 1 },
      { col: 4, row: 1 },
      { col: 5, row: 1 },
    ]
    const area = createDnd5eCoreSpellArea({
      declaration: dancingLights,
      actionId: 'cast-dancing-lights',
      sourceCharacterId: 'caster',
      sourceTokenId: 'caster-token',
      slotLevel: 0,
      sourceSaveDc: 13,
      round: 1,
      cells: origins,
      anchorCell: origins[0],
      lightingAnchorCells: origins,
    })
    const placed = { ...base, dnd5ePluginAreas: [{ ...area, movement: undefined }] }
    const destinations = [
      { col: 2, row: 2 },
      { col: 3, row: 2 },
      { col: 4, row: 2 },
      { col: 5, row: 2 },
    ]
    const moved = moveDnd5eCoreSpellArea({
      map: placed,
      areaId: area.id,
      sourceTokenId: 'caster-token',
      targetCell: destinations[0],
      targetCells: destinations,
    })
    expect(moved).toMatchObject({
      ok: true,
      distanceFeet: 5,
      area: {
        anchorCell: destinations[0],
        cells: destinations,
        lightingAnchorCells: destinations,
        movement: { economy: 'bonus-action', maximumFeet: 60 },
      },
    })
    expect(moveDnd5eCoreSpellArea({
      map: { ...base, dnd5ePluginAreas: [area] },
      areaId: area.id,
      sourceTokenId: 'caster-token',
      targetCell: { col: 2, row: 2 },
      targetCells: [
        { col: 2, row: 2 },
        { col: 3, row: 2 },
        { col: 4, row: 2 },
        { col: 10, row: 2 },
      ],
    })).toMatchObject({ ok: false, reason: 'invalid-target' })
    expect(moveDnd5eCoreSpellArea({
      map: { ...base, dnd5ePluginAreas: [area] },
      areaId: area.id,
      sourceTokenId: 'caster-token',
      targetCell: { col: 15, row: 1 },
      targetCells: [
        { col: 15, row: 1 },
        { col: 16, row: 1 },
        { col: 17, row: 1 },
        { col: 18, row: 1 },
      ],
    })).toMatchObject({ ok: false, reason: 'target-out-of-range' })
  })

  it('winks out only the Dancing Lights that exceed the 120-foot caster tether', () => {
    const dancingLights = getDnd5eCoreSpellAreaDeclaration('dancing-lights')
    expect(dancingLights).toBeDefined()
    if (!dancingLights) return
    const base = { ...map(), width: 1_500 }
    const origins = [22, 23, 24, 25].map((col) => ({ col, row: 1 }))
    const area = createDnd5eCoreSpellArea({
      declaration: dancingLights,
      actionId: 'cast-dancing-lights-tether',
      sourceCharacterId: 'caster',
      sourceTokenId: 'caster-token',
      slotLevel: 0,
      sourceSaveDc: 13,
      round: 1,
      cells: origins,
      anchorCell: origins[0],
      lightingAnchorCells: origins,
    })
    const partiallyExtinguished = moveDnd5eCoreSpellArea({
      map: { ...base, dnd5ePluginAreas: [area] },
      areaId: area.id,
      sourceTokenId: 'caster-token',
      targetCell: { col: 24, row: 1 },
      targetCells: [24, 25, 26, 27].map((col) => ({ col, row: 1 })),
    })
    expect(partiallyExtinguished).toMatchObject({
      ok: true,
      area: {
        cells: [{ col: 24, row: 1 }, { col: 25, row: 1 }],
        lightingAnchorCells: [{ col: 24, row: 1 }, { col: 25, row: 1 }],
      },
    })

    const allExtinguished = moveDnd5eCoreSpellArea({
      map: { ...base, dnd5ePluginAreas: [area] },
      areaId: area.id,
      sourceTokenId: 'caster-token',
      targetCell: { col: 26, row: 1 },
      targetCells: [26, 27, 28, 29].map((col) => ({ col, row: 1 })),
    })
    expect(allExtinguished).toMatchObject({ ok: true })
    if (allExtinguished.ok) expect(allExtinguished.map.dnd5ePluginAreas).toEqual([])
  })

  it('reconciles Dancing Lights immediately when the caster is placed beyond their tether', () => {
    const dancingLights = getDnd5eCoreSpellAreaDeclaration('dancing-lights')
    expect(dancingLights).toBeDefined()
    if (!dancingLights) return
    const base = { ...map(), width: 3_000 }
    const origins = [3, 4, 25, 26].map((col) => ({ col, row: 1 }))
    const area = createDnd5eCoreSpellArea({
      declaration: dancingLights,
      actionId: 'cast-dancing-lights-source-move',
      sourceCharacterId: 'caster', sourceTokenId: 'caster-token',
      slotLevel: 0, sourceSaveDc: 13, round: 1,
      cells: origins, anchorCell: origins[0], lightingAnchorCells: origins,
    })
    const reconciled = reconcileDnd5ePersistentAreaAnchors({
      ...base,
      dnd5ePluginAreas: [area],
    })
    expect(reconciled.dnd5ePluginAreas?.[0]).toMatchObject({
      cells: [{ col: 3, row: 1 }, { col: 4, row: 1 }, { col: 25, row: 1 }],
      anchorCell: { col: 3, row: 1 },
    })

    const casterFarAway = {
      ...base,
      tokens: base.tokens.map((token) => token.id === 'caster-token' ? { ...token, x: 2_775 } : token),
      dnd5ePluginAreas: [area],
    }
    expect(reconcileDnd5ePersistentAreaAnchors(casterFarAway).dnd5ePluginAreas).toEqual([])
  })

  it('rebases a movable fixed volume on the destination terrain surface', () => {
    const base = map()
    const moonbeam = getDnd5eCoreSpellAreaDeclaration('moonbeam')
    expect(moonbeam).toBeDefined()
    if (!moonbeam) return
    const area = createDnd5eCoreSpellArea({
      declaration: moonbeam,
      actionId: 'moonbeam-cast',
      sourceCharacterId: 'caster',
      sourceTokenId: 'caster-token',
      slotLevel: 2,
      sourceSaveDc: 13,
      round: 1,
      cells: [{ col: 1, row: 1 }],
      anchorCell: { col: 1, row: 1 },
      baseElevationFeet: 0,
    })
    const geometry = createEmptyMapGeometry(base.id, 1)
    geometry.obstacles.push({
      id: 'moonbeam-ledge', kind: 'obstacle', label: 'Moonbeam ledge',
      points: [{ x: 200, y: 150 }, { x: 250, y: 150 }, { x: 250, y: 200 }, { x: 200, y: 200 }],
      blocksVision: false, blocksMovement: false, blocksLineOfEffect: false, cover: 'none',
      baseHeightFeet: 0, heightFeet: 0, terrainRegion: true, terrainElevationFeet: 25, createdAt: 1,
    })
    const moved = moveDnd5eCoreSpellArea({
      map: { ...base, dnd5ePluginAreas: [area] },
      geometry,
      areaId: area.id,
      sourceTokenId: 'caster-token',
      targetCell: { col: 4, row: 3 },
    })

    expect(moved).toMatchObject({
      ok: true,
      area: {
        anchorCell: { col: 4, row: 3 },
        vertical: { mode: 'volume', baseElevationFeet: 25, heightFeet: 40 },
      },
    })
  })

  it('reanchors source-attached areas when their source token moves', () => {
    const base = map()
    const attached = createDnd5eCoreSpellArea({
      declaration: { ...declaration, anchorMode: 'source-token', movement: undefined },
      actionId: 'cast-2',
      sourceCharacterId: 'caster',
      sourceTokenId: 'caster-token',
      slotLevel: 2,
      sourceSaveDc: 13,
      round: 1,
      cells: [{ col: 1, row: 1 }, { col: 2, row: 1 }],
      anchorCell: { col: 1, row: 1 },
    })
    const movedMap = {
      ...base,
      tokens: base.tokens.map((token) => ({ ...token, x: 175, y: 125 })),
      dnd5ePluginAreas: [attached],
    }
    const reconciled = reconcileDnd5ePersistentAreaAnchors(movedMap)
    expect(reconciled.dnd5ePluginAreas?.[0]).toMatchObject({
      anchorCell: { col: 3, row: 2 },
      cells: [{ col: 3, row: 2 }, { col: 4, row: 2 }],
    })
  })

  it('moves an effect-token anchor and merges only its authoritative delta into the latest map', () => {
    const base = map()
    const flamingSphere = getDnd5eCoreSpellAreaDeclaration('flaming-sphere')
    expect(flamingSphere).toBeDefined()
    if (!flamingSphere) return
    const effectToken = {
      id: 'sphere-token', label: '炽焰法球', x: 125, y: 125, color: '#f97316', emoji: '🔥',
      size: 1, type: 'obstacle' as const,
      dnd5eSpellEffect: {
        schemaVersion: 1 as const, spellId: 'flaming-sphere', sourceCharacterId: 'caster',
        sourceTokenId: 'caster-token', createdRound: 1, expiresAfterRound: 11,
        concentrationId: 'flaming-sphere',
      },
    }
    const attached = createDnd5eCoreSpellArea({
      declaration: flamingSphere,
      actionId: 'cast-sphere', sourceCharacterId: 'caster', sourceTokenId: 'caster-token',
      slotLevel: 2, sourceSaveDc: 13, round: 1, cells: [{ col: 2, row: 2 }],
      anchorCell: { col: 2, row: 2 }, anchorTokenId: effectToken.id,
    })
    const before = { ...base, tokens: [...base.tokens, effectToken], dnd5ePluginAreas: [attached] }
    const geometry = createEmptyMapGeometry(base.id, 1)
    geometry.obstacles.push({
      id: 'high-ground', kind: 'obstacle', label: 'High ground',
      points: [{ x: 250, y: 200 }, { x: 300, y: 200 }, { x: 300, y: 250 }, { x: 250, y: 250 }],
      blocksVision: false, blocksMovement: false, blocksLineOfEffect: false, cover: 'none',
      baseHeightFeet: 0, heightFeet: 0, terrainRegion: true, terrainElevationFeet: 30, createdAt: 1,
    })
    const moved = moveDnd5eCoreSpellArea({
      map: before, geometry, areaId: attached.id,
      sourceTokenId: 'caster-token', targetCell: { col: 5, row: 4 },
    })
    expect(moved.ok).toBe(true)
    if (!moved.ok) return
    expect(moved.map.tokens.find((token) => token.id === effectToken.id)).toMatchObject({ x: 275, y: 225 })
    expect(moved.area.vertical).toEqual({ mode: 'volume', baseElevationFeet: 30, heightFeet: 10 })

    const concurrent = { id: 'other', label: 'other', x: 400, y: 400, color: '#fff', emoji: 'O', size: 1, type: 'enemy' as const }
    const merged = mergeDnd5eSpellEffectTokenDelta({
      currentMap: { ...before, tokens: [...before.tokens, concurrent] },
      beforeMap: before,
      afterMap: moved.map,
    })
    expect(merged.find((token) => token.id === effectToken.id)).toMatchObject({ x: 275, y: 225 })
    expect(merged).toContainEqual(concurrent)
  })

  it('keeps a source-following effect token within its tether and removes it past maximum separation', () => {
    const base = { ...map(), width: 2_000 }
    const source = { ...base.tokens[0]!, x: 425, y: 75 }
    const disk = {
      id: 'disk-token', label: '浮碟', x: 75, y: 75, color: '#fff', emoji: '◯',
      size: 0.6, type: 'obstacle' as const,
      dnd5eSpellEffect: {
        schemaVersion: 1 as const, spellId: 'floating-disk', sourceCharacterId: 'caster',
        sourceTokenId: source.id, createdRound: 1, expiresAfterRound: 600,
      },
    }
    const followerArea = {
      id: 'floating-disk-area', pluginId: 'srd-5.1', featureId: 'spell:floating-disk',
      sourceKind: 'core-spell' as const, coreSpellId: 'floating-disk', label: '浮碟术', color: '#fff',
      sourceCharacterId: 'caster', sourceTokenId: source.id,
      cells: [{ col: 1, row: 1 }], anchorCell: { col: 1, row: 1 },
      createdRound: 1, expiresAfterRound: 600,
      anchorMode: 'effect-token' as const, anchorTokenId: disk.id,
      sourceFollower: {
        stationaryWithinFeet: 20, maximumSeparationFeet: 100,
        maximumStepHeightFeet: 10, carryingCapacityPounds: 500,
      },
    }
    const followed = reconcileDnd5ePersistentAreaAnchors({
      ...base, tokens: [source, disk], dnd5ePluginAreas: [followerArea],
    })
    expect(followed.tokens.find((token) => token.id === disk.id)).toMatchObject({ x: 225, y: 75 })
    expect(followed.dnd5ePluginAreas?.[0]).toMatchObject({
      anchorCell: { col: 4, row: 1 }, sourceFollower: { carryingCapacityPounds: 500 },
    })

    const tooFar = reconcileDnd5ePersistentAreaAnchors({
      ...base,
      tokens: [{ ...source, x: 1_425 }, disk],
      dnd5ePluginAreas: [followerArea],
    })
    expect(tooFar.tokens.some((token) => token.id === disk.id)).toBe(false)
    expect(tooFar.dnd5ePluginAreas).toEqual([])
  })

  it('removes an effect Token and its anchored area without touching unrelated map relations', () => {
    const base = map()
    const flamingSphere = getDnd5eCoreSpellAreaDeclaration('flaming-sphere')
    expect(flamingSphere).toBeDefined()
    if (!flamingSphere) return
    const effectToken = {
      id: 'sphere-token', label: '炽焰法球', x: 125, y: 125, color: '#f97316', emoji: '🔥',
      size: 1, type: 'obstacle' as const,
      dnd5eSpellEffect: {
        schemaVersion: 1 as const, spellId: 'flaming-sphere', sourceCharacterId: 'caster',
        sourceTokenId: 'caster-token', createdRound: 1, expiresAfterRound: 11,
        concentrationId: 'flaming-sphere',
      },
    }
    const attached = createDnd5eCoreSpellArea({
      declaration: flamingSphere,
      actionId: 'cast-sphere', sourceCharacterId: 'caster', sourceTokenId: 'caster-token',
      slotLevel: 2, sourceSaveDc: 13, round: 1, cells: [{ col: 2, row: 2 }],
      anchorCell: { col: 2, row: 2 }, anchorTokenId: effectToken.id,
    })
    const unrelated = createDnd5eCoreSpellArea({
      declaration,
      actionId: 'other-area', sourceCharacterId: 'caster', sourceTokenId: 'caster-token',
      slotLevel: 2, sourceSaveDc: 13, round: 1, cells: [{ col: 5, row: 5 }],
      anchorCell: { col: 5, row: 5 },
    })
    const placed = {
      ...base,
      tokens: [...base.tokens, effectToken],
      dnd5ePluginAreas: [attached, unrelated],
    }

    const removed = removeDnd5eSpellEffectFromMap(placed, effectToken.id)

    expect(removed?.token).toBe(effectToken)
    expect(removed?.removedAreas).toEqual([attached])
    expect(removed?.map.tokens.map((token) => token.id)).toEqual(['caster-token'])
    expect(removed?.map.dnd5ePluginAreas).toEqual([unrelated])
    expect(removeDnd5eSpellEffectFromMap(removed!.map, effectToken.id)).toBeUndefined()
  })

  it('stops Flaming Sphere at the first creature and never moves it through a wall', () => {
    const base = map()
    const effectToken = {
      id: 'sphere-token', label: '炽焰法球', x: 125, y: 125, color: '#f97316', emoji: '🔥',
      size: 1, type: 'obstacle' as const,
      dnd5eSpellEffect: {
        schemaVersion: 1 as const, spellId: 'flaming-sphere', sourceCharacterId: 'caster',
        sourceTokenId: 'caster-token', createdRound: 1, expiresAfterRound: 11,
        concentrationId: 'flaming-sphere',
      },
    }
    const area = createDnd5eCoreSpellArea({
      declaration: { ...declaration, spellId: 'flaming-sphere', anchorMode: 'effect-token' },
      actionId: 'cast-sphere', sourceCharacterId: 'caster', sourceTokenId: 'caster-token',
      slotLevel: 2, sourceSaveDc: 13, round: 1, cells: [{ col: 2, row: 2 }],
      anchorCell: { col: 2, row: 2 }, anchorTokenId: effectToken.id,
    })
    const enemy = { id: 'enemy', label: 'enemy', x: 225, y: 125, color: '#fff', emoji: 'E', size: 1, type: 'enemy' as const }
    const placed = { ...base, tokens: [...base.tokens, effectToken, enemy], dnd5ePluginAreas: [area] }
    const collided = moveDnd5eCoreSpellArea({
      map: placed, areaId: area.id, sourceTokenId: 'caster-token', targetCell: { col: 6, row: 2 },
    })
    expect(collided).toMatchObject({
      ok: true, impactTargetId: 'enemy', distanceFeet: 10, area: { anchorCell: { col: 4, row: 2 } },
    })

    const geometry = createEmptyMapGeometry(base.id, 1)
    geometry.walls.push({
      id: 'wall', kind: 'wall', label: '石墙', points: [{ x: 150, y: 100 }, { x: 150, y: 150 }],
      blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
    })
    expect(moveDnd5eCoreSpellArea({
      map: placed, geometry, areaId: area.id, sourceTokenId: 'caster-token', targetCell: { col: 6, row: 2 },
    })).toMatchObject({ ok: false, reason: 'movement-blocked' })
  })

  it('lets Flaming Sphere leap a five-foot barrier but not a taller one', () => {
    const base = map()
    const flamingSphere = getDnd5eCoreSpellAreaDeclaration('flaming-sphere')
    expect(flamingSphere?.movement).toEqual({
      economy: 'bonus-action',
      maximumFeet: 30,
      maximumBarrierHeightFeet: 5,
      maximumGapWidthFeet: 10,
    })
    if (!flamingSphere) return
    const effectToken = {
      id: 'sphere-token', label: '炽焰法球', x: 125, y: 125, color: '#f97316', emoji: '🔥',
      size: 1, type: 'obstacle' as const,
      dnd5eSpellEffect: {
        schemaVersion: 1 as const, spellId: 'flaming-sphere', sourceCharacterId: 'caster',
        sourceTokenId: 'caster-token', createdRound: 1, expiresAfterRound: 11,
        concentrationId: 'flaming-sphere',
      },
    }
    const area = createDnd5eCoreSpellArea({
      declaration: flamingSphere,
      actionId: 'cast-sphere', sourceCharacterId: 'caster', sourceTokenId: 'caster-token',
      slotLevel: 2, sourceSaveDc: 13, round: 1, cells: [{ col: 2, row: 2 }],
      anchorCell: { col: 2, row: 2 }, anchorTokenId: effectToken.id,
    })
    // Simulate a pre-upgrade saved area: missing declaration fields must inherit safely.
    area.movement = { economy: 'bonus-action', maximumFeet: 30 }
    const placed = { ...base, tokens: [...base.tokens, effectToken], dnd5ePluginAreas: [area] }
    const geometry = createEmptyMapGeometry(base.id, 1)
    geometry.walls.push({
      id: 'low-wall', kind: 'wall', label: '矮墙',
      points: [{ x: 150, y: 100 }, { x: 150, y: 150 }],
      blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 5, createdAt: 1,
    })
    expect(moveDnd5eCoreSpellArea({
      map: placed, geometry, areaId: area.id, sourceTokenId: 'caster-token',
      targetCell: { col: 4, row: 2 },
    })).toMatchObject({ ok: true, distanceFeet: 10, area: { anchorCell: { col: 4, row: 2 } } })

    geometry.walls[0] = { ...geometry.walls[0], id: 'high-wall', heightFeet: 10 }
    expect(moveDnd5eCoreSpellArea({
      map: placed, geometry, areaId: area.id, sourceTokenId: 'caster-token',
      targetCell: { col: 4, row: 2 },
    })).toMatchObject({ ok: false, reason: 'movement-blocked' })
  })

  it('lets Flaming Sphere jump a ten-foot pit but rejects a wider pit or ending inside one', () => {
    const base = map()
    const flamingSphere = getDnd5eCoreSpellAreaDeclaration('flaming-sphere')
    expect(flamingSphere).toBeDefined()
    if (!flamingSphere) return
    const effectToken = {
      id: 'sphere-token', label: '炽焰法球', x: 125, y: 125, color: '#f97316', emoji: '🔥',
      size: 1, type: 'obstacle' as const,
      dnd5eSpellEffect: {
        schemaVersion: 1 as const, spellId: 'flaming-sphere', sourceCharacterId: 'caster',
        sourceTokenId: 'caster-token', createdRound: 1, expiresAfterRound: 11,
        concentrationId: 'flaming-sphere',
      },
    }
    const area = createDnd5eCoreSpellArea({
      declaration: flamingSphere,
      actionId: 'cast-sphere', sourceCharacterId: 'caster', sourceTokenId: 'caster-token',
      slotLevel: 2, sourceSaveDc: 13, round: 1, cells: [{ col: 2, row: 2 }],
      anchorCell: { col: 2, row: 2 }, anchorTokenId: effectToken.id,
    })
    const placed = { ...base, tokens: [...base.tokens, effectToken], dnd5ePluginAreas: [area] }
    const geometry = createEmptyMapGeometry(base.id, 1)
    geometry.obstacles.push({
      id: 'ten-foot-pit', kind: 'obstacle', label: '十尺坑',
      points: [{ x: 150, y: 100 }, { x: 250, y: 100 }, { x: 250, y: 150 }, { x: 150, y: 150 }],
      blocksVision: false, blocksMovement: false, blocksLineOfEffect: false, cover: 'none',
      baseHeightFeet: 0, heightFeet: 0, terrainRegion: true, terrainElevationFeet: -10, createdAt: 1,
    })
    expect(moveDnd5eCoreSpellArea({
      map: placed, geometry, areaId: area.id, sourceTokenId: 'caster-token',
      targetCell: { col: 5, row: 2 },
    })).toMatchObject({ ok: true, distanceFeet: 15, area: { anchorCell: { col: 5, row: 2 } } })
    expect(moveDnd5eCoreSpellArea({
      map: placed, geometry, areaId: area.id, sourceTokenId: 'caster-token',
      targetCell: { col: 4, row: 2 },
    })).toMatchObject({ ok: false, reason: 'movement-blocked' })

    geometry.obstacles[0] = {
      ...geometry.obstacles[0], id: 'fifteen-foot-pit',
      points: [{ x: 150, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 150 }, { x: 150, y: 150 }],
    }
    expect(moveDnd5eCoreSpellArea({
      map: placed, geometry, areaId: area.id, sourceTokenId: 'caster-token',
      targetCell: { col: 6, row: 2 },
    })).toMatchObject({ ok: false, reason: 'movement-blocked' })
  })

  it('moves Spiritual Weapon through creatures but not through walls or beyond 20 feet', () => {
    const base = map()
    const spiritualWeapon = getDnd5eCoreSpellAreaDeclaration('spiritual-weapon')
    expect(spiritualWeapon).toBeDefined()
    if (!spiritualWeapon) return
    const effectToken = {
      id: 'spiritual-weapon-token', label: '灵体武器', x: 125, y: 75,
      color: '#8b5cf6', emoji: '⚔', size: 1, type: 'obstacle' as const,
      dnd5eSpellEffect: {
        schemaVersion: 1 as const, spellId: 'spiritual-weapon', sourceCharacterId: 'caster',
        sourceTokenId: 'caster-token', createdRound: 1, expiresAfterRound: 11,
      },
    }
    const area = createDnd5eCoreSpellArea({
      declaration: spiritualWeapon,
      actionId: 'cast-spiritual-weapon',
      sourceCharacterId: 'caster',
      sourceTokenId: 'caster-token',
      slotLevel: 2,
      sourceSaveDc: 13,
      round: 1,
      cells: [{ col: 2, row: 1 }],
      anchorCell: { col: 2, row: 1 },
      anchorTokenId: effectToken.id,
    })
    const creature = {
      id: 'enemy', label: 'enemy', x: 225, y: 75, color: '#fff',
      emoji: 'E', size: 1, type: 'enemy' as const,
    }
    const placed = {
      ...base,
      tokens: [...base.tokens, effectToken, creature],
      dnd5ePluginAreas: [area],
    }
    const moved = moveDnd5eCoreSpellArea({
      map: placed,
      areaId: area.id,
      sourceTokenId: 'caster-token',
      targetCell: { col: 6, row: 1 },
    })
    expect(moved).toMatchObject({
      ok: true,
      distanceFeet: 20,
      area: { anchorCell: { col: 6, row: 1 } },
    })
    expect(moveDnd5eCoreSpellArea({
      map: placed,
      areaId: area.id,
      sourceTokenId: 'caster-token',
      targetCell: { col: 7, row: 1 },
    })).toMatchObject({ ok: false, reason: 'target-out-of-range' })

    const geometry = createEmptyMapGeometry(base.id, 1)
    geometry.walls.push({
      id: 'wall', kind: 'wall', label: '石墙',
      points: [{ x: 200, y: 50 }, { x: 200, y: 100 }],
      blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
    })
    expect(moveDnd5eCoreSpellArea({
      map: placed,
      geometry,
      areaId: area.id,
      sourceTokenId: 'caster-token',
      targetCell: { col: 6, row: 1 },
    })).toMatchObject({ ok: false, reason: 'movement-blocked' })
  })

  it('blocks Arcane Eye at solid walls but allows a one-inch mapped opening', () => {
    const base = map()
    const effectToken = {
      id: 'arcane-eye-token', label: '秘法眼', x: 125, y: 75,
      color: '#38bdf8', emoji: '◉', size: 0.5, type: 'obstacle' as const,
      visibilityMode: 'dm-only' as const,
      darkvisionRangeFeet: 30,
      dnd5eSpellEffect: {
        schemaVersion: 1 as const, spellId: 'arcane-eye', sourceCharacterId: 'caster',
        sourceTokenId: 'caster-token', createdRound: 1, expiresAfterRound: 601,
        concentrationId: 'arcane-eye', shareVisionWithSource: true as const,
        hiddenBody: true as const,
      },
    }
    const area = createDnd5eCoreSpellArea({
      declaration: {
        ...declaration,
        spellId: 'arcane-eye',
        label: '秘法眼',
        minimumSlotLevel: 4,
        durationRounds: 600,
        anchorMode: 'effect-token',
        movement: { economy: 'action', maximumFeet: 30 },
      },
      actionId: 'cast-arcane-eye',
      sourceCharacterId: 'caster',
      sourceTokenId: 'caster-token',
      slotLevel: 4,
      sourceSaveDc: 13,
      round: 1,
      cells: [{ col: 2, row: 1 }],
      anchorCell: { col: 2, row: 1 },
      anchorTokenId: effectToken.id,
    })
    const placed = {
      ...base,
      tokens: [...base.tokens, effectToken],
      dnd5ePluginAreas: [area],
    }
    const solidGeometry = createEmptyMapGeometry(base.id, 1)
    solidGeometry.walls.push({
      id: 'solid-wall', kind: 'wall', label: '石墙',
      points: [{ x: 200, y: 50 }, { x: 200, y: 100 }],
      blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
    })
    expect(moveDnd5eCoreSpellArea({
      map: placed,
      geometry: solidGeometry,
      areaId: area.id,
      sourceTokenId: 'caster-token',
      targetCell: { col: 5, row: 1 },
    })).toMatchObject({ ok: false, reason: 'movement-blocked' })

    const oneInchOpening = createEmptyMapGeometry(base.id, 1)
    oneInchOpening.doors.push({
      id: 'one-inch-gap', kind: 'door', label: '一寸开口',
      points: [{ x: 200, y: 50 }, { x: 200, y: 100 }],
      state: 'closed', openState: 'closed', lockState: 'unlocked', physicalState: 'intact',
      secret: false, passageGapInches: 1,
      blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
    })
    expect(moveDnd5eCoreSpellArea({
      map: placed,
      geometry: oneInchOpening,
      areaId: area.id,
      sourceTokenId: 'caster-token',
      targetCell: { col: 5, row: 1 },
    })).toMatchObject({
      ok: true,
      distanceFeet: 15,
      area: { anchorCell: { col: 5, row: 1 } },
    })
  })
})
