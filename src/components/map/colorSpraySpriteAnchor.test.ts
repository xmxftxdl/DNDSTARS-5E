import { describe, expect, it } from 'vitest'
import { colorSpraySpriteAnchor } from './colorSpraySpriteAnchor'

describe('rainbow cone atlas emission origin', () => {
  it('tracks the opening flash and sustained cone independently', () => {
    expect(colorSpraySpriteAnchor(0)).toEqual({ x: 116.1 / 313.5, y: 158.4 / 313.5 })
    expect(colorSpraySpriteAnchor(8)).toEqual({ x: 36.1 / 313.5, y: 766.4 / 313.5 - 2 })
  })

})
