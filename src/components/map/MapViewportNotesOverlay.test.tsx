import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import MapViewportNotesOverlay from './MapViewportNotesOverlay'

const textNote = {
  id: 'viewport-note:test',
  kind: 'text' as const,
  x: 0.5,
  y: 0.4,
  width: 280,
  height: 190,
  zIndex: 1,
  text: '门后的线索',
  createdAt: 1,
  updatedAt: 1,
}

const imageNote = {
  id: 'viewport-note:image',
  kind: 'image' as const,
  x: 0.6,
  y: 0.45,
  width: 320,
  height: 240,
  zIndex: 2,
  imageId: 'map-note-image-test',
  imageName: '线索.png',
  createdAt: 1,
  updatedAt: 1,
}

describe('MapViewportNotesOverlay', () => {
  it('renders as an absolute viewport layer and leaves player notes read-only', () => {
    const markup = renderToStaticMarkup(
      <MapViewportNotesOverlay mapId="map" notes={[textNote]} editable={false} onChange={vi.fn()} />,
    )
    expect(markup).toContain('data-testid="map-viewport-notes-overlay"')
    expect(markup).toContain('absolute inset-0')
    expect(markup).toContain('left:calc(50% - 140px)')
    expect(markup).toContain('门后的线索')
    expect(markup).not.toContain('<textarea')
  })

  it('renders DM text notes with an editable body and drag/delete controls', () => {
    const markup = renderToStaticMarkup(
      <MapViewportNotesOverlay mapId="map" notes={[textNote]} editable onChange={vi.fn()} />,
    )
    expect(markup).toContain('<textarea')
    expect(markup).toContain('title="拖动便签"')
    expect(markup).toContain('title="删除"')
  })

  it('renders pasted images without the note frame and reveals an overlay close control', () => {
    const markup = renderToStaticMarkup(
      <MapViewportNotesOverlay mapId="map" notes={[imageNote]} editable onChange={vi.fn()} />,
    )
    expect(markup).toContain('aria-label="地图贴图：线索.png"')
    expect(markup).toContain('title="删除贴图"')
    expect(markup).toContain('group-hover:opacity-100')
    expect(markup).toContain('bg-transparent')
    expect(markup).not.toContain('border-cyan-200/35')
    expect(markup).not.toContain('title="拖动便签"')
  })
})
