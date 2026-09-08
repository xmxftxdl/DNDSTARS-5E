import { describe, expect, it } from 'vitest'
import { mobileTokenScreenRadius } from './mobileMapTokenMath'

describe('mobile map token scaling', () => {
  it('shrinks a token together with the map grid', () => {
    expect(mobileTokenScreenRadius(35, 1)).toBe(35)
    expect(mobileTokenScreenRadius(35, 0.2)).toBe(7)
    expect(mobileTokenScreenRadius(35, 0.1)).toBe(3.5)
  })

  it('keeps only a tiny render floor at extreme zoom levels', () => {
    expect(mobileTokenScreenRadius(35, 0.01)).toBe(2)
  })
})
