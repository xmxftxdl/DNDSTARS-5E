import { describe, expect, it } from 'vitest'
import type { BattleMap } from '../../store/maps'
import {
  createDnd5eCoreSpellArea,
  moveDnd5eCoreSpellArea,
  reconcileDnd5ePersistentAreaAnchors,
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
})
