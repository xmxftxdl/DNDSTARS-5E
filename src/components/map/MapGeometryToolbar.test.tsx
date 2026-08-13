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
  })
})
