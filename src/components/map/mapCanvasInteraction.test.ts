import { describe, expect, it } from 'vitest'
import {
  mapCanvasAoeGridCell,
  mapCanvasEffectTokenAreaRenderOffset,
  mapCanvasGeometryDrawShouldStart,
  mapCanvasStageCanPan,
  mapCanvasTokenClickAction,
} from './mapCanvasInteraction'

const base = {
  tabletopTool: 'none' as const,
  measureMode: false,
  moveSelectMode: false,
  aoeSelectMode: false,
  gridAdjustMode: false,
  deleteSelectMode: false,
  fogEditMode: false,
  fogTool: 'reveal-rect' as const,
  geometryEditMode: false,
  geometryTool: 'select' as const,
  geometrySearchMode: false,
  sceneEditMode: false,
}

describe('map canvas viewport panning', () => {
  it('keeps panning available in fog pan mode and while placing doors or windows', () => {
    expect(mapCanvasStageCanPan({ ...base, fogEditMode: true, fogTool: 'pan' })).toBe(true)
    expect(mapCanvasStageCanPan({ ...base, geometryEditMode: true, geometryTool: 'select' })).toBe(true)
    expect(mapCanvasStageCanPan({ ...base, geometryEditMode: true, geometryTool: 'door' })).toBe(true)
    expect(mapCanvasStageCanPan({ ...base, geometryEditMode: true, geometryTool: 'window' })).toBe(true)
  })

  it('reserves left-drag for active drawing and targeting tools', () => {
    expect(mapCanvasStageCanPan({ ...base, fogEditMode: true, fogTool: 'reveal-brush' })).toBe(false)
    expect(mapCanvasStageCanPan({ ...base, geometryEditMode: true, geometryTool: 'wall' })).toBe(false)
    expect(mapCanvasStageCanPan({ ...base, geometryEditMode: true, geometryTool: 'difficult-terrain' })).toBe(false)
    expect(mapCanvasStageCanPan({ ...base, aoeSelectMode: true })).toBe(false)
    expect(mapCanvasStageCanPan({ ...base, tabletopTool: 'arrow' })).toBe(false)
  })

  it('only captures a door or window drag when it starts beside a wall', () => {
    expect(mapCanvasGeometryDrawShouldStart('door', false)).toBe(false)
    expect(mapCanvasGeometryDrawShouldStart('window', false)).toBe(false)
    expect(mapCanvasGeometryDrawShouldStart('door', true)).toBe(true)
    expect(mapCanvasGeometryDrawShouldStart('window', true)).toBe(true)
    expect(mapCanvasGeometryDrawShouldStart('wall', false)).toBe(true)
    expect(mapCanvasGeometryDrawShouldStart('difficult-terrain', false)).toBe(true)
  })
})

describe('map canvas area targeting', () => {
  it('consumes token clicks as area confirmation instead of opening token details', () => {
    expect(mapCanvasTokenClickAction(true)).toBe('consume-area-click')
    expect(mapCanvasTokenClickAction(false)).toBe('select-token')
  })

  it('converts a continuous pointer position into an integer authoritative grid cell', () => {
    const grid = { gridSize: 40, gridOffsetX: 12, gridOffsetY: 8 }
    const point = {
      x: grid.gridOffsetX + (23.638149933122435 + 0.5) * grid.gridSize,
      y: grid.gridOffsetY + (8.617934781721111 + 0.5) * grid.gridSize,
    }

    expect(mapCanvasAoeGridCell(point, grid)).toEqual({ col: 24, row: 9 })
  })

  it('preserves the exact cell under its center', () => {
    expect(mapCanvasAoeGridCell(
      { x: 225, y: 145 },
      { gridSize: 40, gridOffsetX: 5, gridOffsetY: 5 },
    )).toEqual({ col: 5, row: 3 })
  })
})

describe('effect-token persistent area drag preview', () => {
  it('moves the rendered area with the live drag preview without changing its authority anchor', () => {
    expect(mapCanvasEffectTokenAreaRenderOffset({
      anchorMode: 'effect-token',
      areaAnchorPosition: { x: 100, y: 140 },
      anchorTokenPosition: { x: 100, y: 140 },
      dragPreviewPosition: { x: 220, y: 180 },
    })).toEqual({ x: 120, y: 40 })
  })

  it('bridges the saved Token position while the area snapshot is still catching up', () => {
    expect(mapCanvasEffectTokenAreaRenderOffset({
      anchorMode: 'effect-token',
      areaAnchorPosition: { x: 100, y: 140 },
      anchorTokenPosition: { x: 220, y: 180 },
    })).toEqual({ x: 120, y: 40 })

    expect(mapCanvasEffectTokenAreaRenderOffset({
      anchorMode: 'effect-token',
      areaAnchorPosition: { x: 220, y: 180 },
      anchorTokenPosition: { x: 220, y: 180 },
    })).toEqual({ x: 0, y: 0 })
  })

  it('never shifts fixed or source-token areas', () => {
    for (const anchorMode of ['fixed', 'source-token', undefined]) {
      expect(mapCanvasEffectTokenAreaRenderOffset({
        anchorMode,
        areaAnchorPosition: { x: 100, y: 140 },
        anchorTokenPosition: { x: 100, y: 140 },
        dragPreviewPosition: { x: 220, y: 180 },
      })).toEqual({ x: 0, y: 0 })
    }
  })
})
