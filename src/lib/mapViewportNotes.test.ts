import { describe, expect, it, vi } from 'vitest'
import {
  createMapViewportImageNote,
  createMapViewportTextNote,
  normalizeMapViewportNotes,
} from './mapViewportNotes'

describe('map viewport notes', () => {
  it('normalizes bounded viewport coordinates without converting them to map coordinates', () => {
    expect(normalizeMapViewportNotes([{
      id: 'viewport-note:test',
      kind: 'text',
      x: 4,
      y: -2,
      width: 8_000,
      height: 10,
      zIndex: 2,
      text: '线索',
      createdAt: 10,
      updatedAt: 20,
    }])).toEqual([expect.objectContaining({
      id: 'viewport-note:test',
      x: 1,
      y: 0,
      width: 720,
      height: 90,
      text: '线索',
    })])
  })

  it('rejects malformed image references and duplicate ids', () => {
    const notes = normalizeMapViewportNotes([
      {
        id: 'viewport-note:image', kind: 'image', imageId: '../secret',
        x: 0.5, y: 0.5, width: 300, height: 200, zIndex: 1, createdAt: 1, updatedAt: 1,
      },
      {
        id: 'viewport-note:duplicate', kind: 'text', text: 'A',
        x: 0.5, y: 0.5, width: 300, height: 200, zIndex: 1, createdAt: 1, updatedAt: 1,
      },
      {
        id: 'viewport-note:duplicate', kind: 'text', text: 'B',
        x: 0.5, y: 0.5, width: 300, height: 200, zIndex: 2, createdAt: 1, updatedAt: 1,
      },
    ])
    expect(notes).toHaveLength(1)
    expect(notes[0].text).toBe('A')
  })

  it('creates new text and image notes above existing notes', () => {
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
      .mockReturnValueOnce('22222222-2222-4222-8222-222222222222')
    const text = createMapViewportTextNote([], 100)
    const image = createMapViewportImageNote([text], {
      imageId: 'map-note-image-safe',
      imageName: 'clue.png',
      width: 800,
      height: 400,
    }, 200)
    expect(text).toMatchObject({ kind: 'text', x: 0.5, y: 0.36, zIndex: 1 })
    expect(image).toMatchObject({
      kind: 'image', imageId: 'map-note-image-safe', width: 420, height: 210, zIndex: 2,
    })
  })
})
