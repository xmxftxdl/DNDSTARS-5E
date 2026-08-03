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
})
