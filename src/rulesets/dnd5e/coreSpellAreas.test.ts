import { describe, expect, it } from 'vitest'
import type { BattleMap } from '../../store/maps'
import { createEmptyMapGeometry } from '../../lib/mapGeometry'
import {
  createDnd5eCoreSpellArea,
  mergeDnd5eSpellEffectTokenDelta,
  moveDnd5eCoreSpellArea,
  reconcileDnd5ePersistentAreaAnchors,
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
      declaration: { ...declaration, spellId: 'flaming-sphere', anchorMode: 'effect-token' },
      actionId: 'cast-sphere', sourceCharacterId: 'caster', sourceTokenId: 'caster-token',
      slotLevel: 2, sourceSaveDc: 13, round: 1, cells: [{ col: 2, row: 2 }],
      anchorCell: { col: 2, row: 2 }, anchorTokenId: effectToken.id,
    })
    const before = { ...base, tokens: [...base.tokens, effectToken], dnd5ePluginAreas: [attached] }
    const moved = moveDnd5eCoreSpellArea({
      map: before, areaId: attached.id, sourceTokenId: 'caster-token', targetCell: { col: 5, row: 4 },
    })
    expect(moved.ok).toBe(true)
    if (!moved.ok) return
    expect(moved.map.tokens.find((token) => token.id === effectToken.id)).toMatchObject({ x: 275, y: 225 })

    const concurrent = { id: 'other', label: 'other', x: 400, y: 400, color: '#fff', emoji: 'O', size: 1, type: 'enemy' as const }
    const merged = mergeDnd5eSpellEffectTokenDelta({
      currentMap: { ...before, tokens: [...before.tokens, concurrent] },
      beforeMap: before,
      afterMap: moved.map,
    })
    expect(merged.find((token) => token.id === effectToken.id)).toMatchObject({ x: 275, y: 225 })
    expect(merged).toContainEqual(concurrent)
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
})
