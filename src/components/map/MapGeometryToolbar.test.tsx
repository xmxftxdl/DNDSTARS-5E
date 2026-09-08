import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createEmptyMapGeometry } from '../../lib/mapGeometry'
import MapGeometryToolbar from './MapGeometryToolbar'

describe('MapGeometryToolbar', () => {
  it('offers selection as the default editing path for imported geometry', () => {
    const html = renderToStaticMarkup(createElement(MapGeometryToolbar, {
      mapId: 'map-1',
      geometry: createEmptyMapGeometry('map-1', 1),
      editMode: true,
      tool: 'select',
      wallMaterial: 'stone',
      previewAsPlayer: false,
      snapToGrid: true,
      diagnosticsEnabled: false,
      diagnosticIssueCount: 0,
      diagnosticsTruncated: false,
      detectionCandidates: [],
      onEditModeChange: () => undefined,
      onToolChange: () => undefined,
      onWallMaterialChange: () => undefined,
      onPreviewChange: () => undefined,
      onSnapToGridChange: () => undefined,
      onDiagnosticsEnabledChange: () => undefined,
      onDetectionCandidatesChange: () => undefined,
      onCreateMapFromUvtt: async () => undefined,
    }))

    expect(html).toContain('<option value="select" selected="">选择／编辑</option>')
    expect(html).toContain('<option value="wall">墙</option>')
    expect(html).toContain('aria-label="全图天气规则"')
    expect(html).toContain('<option value="storm">暴风雨</option>')
    expect(html).toContain('aria-label="高空空间规则"')
    expect(html).toContain('<option value="confined">受限／无法容纳</option>')
  })

  it('keeps delete available for a selected terrain region while combat terrain editing is locked', () => {
    const geometry = createEmptyMapGeometry('map-1', 1)
    const terrain = {
      id: 'terrain-1',
      kind: 'obstacle' as const,
      label: '高地',
      points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
      createdAt: 1,
      terrainRegion: true,
      terrainElevationFeet: 10,
      cover: 'none' as const,
      blocksMovement: false,
      blocksVision: false,
      blocksLineOfEffect: false,
      baseHeightFeet: 0,
      heightFeet: 0,
    }
    geometry.obstacles.push(terrain)

    const html = renderToStaticMarkup(createElement(MapGeometryToolbar, {
      mapId: 'map-1',
      geometry,
      selectedEntity: terrain,
      editMode: true,
      tool: 'select',
      wallMaterial: 'stone',
      previewAsPlayer: false,
      snapToGrid: true,
      terrainEditingLocked: true,
      diagnosticsEnabled: false,
      diagnosticIssueCount: 0,
      diagnosticsTruncated: false,
      detectionCandidates: [],
      onEditModeChange: () => undefined,
      onToolChange: () => undefined,
      onWallMaterialChange: () => undefined,
      onPreviewChange: () => undefined,
      onSnapToGridChange: () => undefined,
      onDiagnosticsEnabledChange: () => undefined,
      onDetectionCandidatesChange: () => undefined,
      onCreateMapFromUvtt: async () => undefined,
    }))

    const deleteButton = html.match(/<button(?=[^>]*title="删除选中几何")[^>]*>/)?.[0]
    expect(deleteButton).toBeDefined()
    expect(deleteButton).not.toContain('disabled')
  })
})
