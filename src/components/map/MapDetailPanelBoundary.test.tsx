import { lazy } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import MapDetailPanelBoundary from './MapDetailPanelBoundary'

const PendingDetailPanel = lazy(() => new Promise<never>(() => {}))

describe('MapDetailPanelBoundary', () => {
  it('keeps the map surface mounted while a lazy detail panel is loading', () => {
    const markup = renderToString(
      <div data-testid="map-surface">
        <MapDetailPanelBoundary>
          <PendingDetailPanel />
        </MapDetailPanelBoundary>
      </div>,
    )

    expect(markup).toContain('data-testid="map-surface"')
    expect(markup).toContain('data-testid="map-detail-panel-loading"')
    expect(markup).toContain('正在打开详情面板')
    expect(markup).not.toContain('正在加载地图工具')
  })
})
