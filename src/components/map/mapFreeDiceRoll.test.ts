import { describe, expect, it } from 'vitest'
import {
  addMapFreeDie,
  buildMapFreeDiceRollPresentation,
  mapFreeDiceKeepSuffix,
  mapFreeDiceSelectionFormula,
  removeMapFreeDie,
  resolveMapFreeDiceRoll,
} from './mapFreeDiceRoll'

describe('map free dice roll resolution', () => {
  it('adds repeated die clicks to the tray and allows right-click removal', () => {
    const first = addMapFreeDie({ count: 0, sides: 20 }, 10)
    const second = addMapFreeDie(first, 10)

    expect(first).toEqual({ count: 1, sides: 10 })
    expect(second).toEqual({ count: 2, sides: 10 })
    expect(mapFreeDiceSelectionFormula(second)).toBe('2d10')
    expect(removeMapFreeDie(second, 10)).toEqual({ count: 1, sides: 10 })
  })

  it('starts a fresh pool when a different die type is clicked', () => {
    expect(addMapFreeDie({ count: 3, sides: 6 }, 20)).toEqual({ count: 1, sides: 20 })
    expect(mapFreeDiceSelectionFormula({ count: 0, sides: 20 })).toBe('尚未添加骰子')
  })

  it('keeps the higher d20 for an out-of-combat advantage check', () => {
    expect(resolveMapFreeDiceRoll([4, 17], 3, { keep: 'highest', dc: 15 })).toEqual({
      subtotal: 17,
      total: 20,
      keptValue: 17,
      outcome: 'success',
    })
    expect(mapFreeDiceKeepSuffix('highest')).toBe('kh1')
  })

  it('keeps the lower d20 and reports a failed check', () => {
    expect(resolveMapFreeDiceRoll([18, 6], 2, { keep: 'lowest', dc: 10 })).toEqual({
      subtotal: 6,
      total: 8,
      keptValue: 6,
      outcome: 'failure',
    })
    expect(mapFreeDiceKeepSuffix('lowest')).toBe('kl1')
  })

  it('still sums ordinary multi-die free rolls', () => {
    expect(resolveMapFreeDiceRoll([2, 5, 6], 1)).toEqual({
      subtotal: 13,
      total: 14,
      keptValue: undefined,
      outcome: undefined,
    })
  })

  it('builds a synchronized check result with DC outcome', () => {
    const result = buildMapFreeDiceRollPresentation({
      rollerName: '冒险者',
      values: [7, 15],
      count: 2,
      sides: 20,
      bonus: 3,
      privateRoll: false,
      resolution: { keep: 'highest', dc: 16 },
    })
    expect(result).toMatchObject({ total: 18, formula: '2d20kh1 + 3', targetName: 'DC 16 · 通过' })
    expect(result.logMessage).toContain('取高 15')
  })
})
