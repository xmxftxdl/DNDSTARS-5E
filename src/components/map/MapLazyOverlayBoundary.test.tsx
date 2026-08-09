import { lazy } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import MapLazyOverlayBoundary from './MapLazyOverlayBoundary'

const PendingOverlay = lazy(() => new Promise<never>(() => {}))

describe('MapLazyOverlayBoundary', () => {
  it('keeps the map mounted while a lazy map overlay is loading', () => {
    const markup = renderToString(
      <div data-testid="map-surface">
        <MapLazyOverlayBoundary label="正在打开怪物目录…">
          <PendingOverlay />
        </MapLazyOverlayBoundary>
      </div>,
    )

    expect(markup).toContain('data-testid="map-surface"')
    expect(markup).toContain('data-testid="map-lazy-overlay-loading"')
    expect(markup).toContain('正在打开怪物目录')
    expect(markup).not.toContain('正在加载地图工具')
  })
})
