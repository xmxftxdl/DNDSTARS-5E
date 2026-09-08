import { describe, expect, it } from 'vitest'
import { mapTokenLabelFontSize } from './mapTokenLabelTypography'

describe('mapTokenLabelFontSize', () => {
  it('keeps short labels at the preferred size', () => {
    expect(mapTokenLabelFontSize('狼', 82, 15)).toBe(15)
  })

  it('shrinks a long CJK monster name to the available token-label width', () => {
    const size = mapTokenLabelFontSize('雄性斯芬克斯', 82, 15)

    expect(size).toBeLessThan(15)
    expect(size).toBeGreaterThanOrEqual(7)
    expect(size * 6).toBeLessThanOrEqual(82 - 8)
  })

  it('does not over-shrink compact latin labels', () => {
    expect(mapTokenLabelFontSize('Mage', 82, 15)).toBe(15)
  })
})
