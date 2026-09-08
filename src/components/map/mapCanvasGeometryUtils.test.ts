import Konva from 'konva'
import { describe, expect, it } from 'vitest'
import { isMapTokenNode, mapTokenIdFromNode } from './mapCanvasGeometryUtils'

describe('mapCanvasGeometryUtils token identity', () => {
  it('recovers the clicked token id from a nested Konva shape', () => {
    const token = new Konva.Group({ name: 'map-token', id: 'cleric-token' })
    const portrait = new Konva.Circle({ radius: 20 })
    token.add(portrait)

    expect(isMapTokenNode(portrait)).toBe(true)
    expect(mapTokenIdFromNode(portrait)).toBe('cleric-token')
  })

  it('does not invent an id for non-token canvas content', () => {
    const background = new Konva.Rect({ width: 100, height: 100 })

    expect(isMapTokenNode(background)).toBe(false)
    expect(mapTokenIdFromNode(background)).toBeUndefined()
  })
})
