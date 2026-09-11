import { describe, expect, it } from 'vitest'
import {
  buildNotation,
  clampDie,
  percentileNotation,
  sanitizeForced,
} from './diceNotation'

// AC7 — unit coverage for the pure forcing logic. No engine, no round-trip
// parse (the system has no parser; building a parser just to test it would test
// the test, not the code).

describe('clampDie', () => {
  it('rounds and clamps into [1, sides]', () => {
    expect(clampDie(3, 6)).toBe(3)
    expect(clampDie(3.4, 6)).toBe(3)
    expect(clampDie(3.6, 6)).toBe(4)
  })
  it('clamps out-of-range to the bounds', () => {
    expect(clampDie(0, 6)).toBe(1)
    expect(clampDie(-5, 6)).toBe(1)
    expect(clampDie(99, 6)).toBe(6)
    expect(clampDie(20, 20)).toBe(20)
  })
  it('returns null for non-finite input (caller fills the gap, not this module)', () => {
    expect(clampDie(undefined, 6)).toBeNull()
    expect(clampDie(null, 6)).toBeNull()
    expect(clampDie(NaN, 6)).toBeNull()
    expect(clampDie('abc', 6)).toBeNull()
  })
})

describe('buildNotation — random path', () => {
  it('emits QdS when no forced values are given', () => {
    expect(buildNotation(1, 20)).toBe('1d20')
    expect(buildNotation(2, 6)).toBe('2d6')
    expect(buildNotation(3, 6, [])).toBe('3d6')
    expect(buildNotation(3, 6, [null, undefined, NaN])).toBe('3d6')
  })
  it('clamps qty and sides', () => {
    expect(buildNotation(101, 6)).toBe('100d6') // MAX_QTY
    expect(buildNotation(1, 999)).toBe('1d100') // MAX_SIDES
    expect(buildNotation(0, 1)).toBe('1d2') // floors
  })
})

describe('buildNotation — forced path', () => {
  it('preserves every forced die for dragon breath and larger damage pools', () => {
    for (const count of [20, 26, 40, 100]) {
      const values = Array.from({ length: count }, (_, index) => index % 6 + 1)
      expect(buildNotation(count, 6, values)).toBe(`${count}d6@${values.join(',')}`)
    }
  })
  it('emits NdS@values for a full forced set', () => {
    expect(buildNotation(1, 20, [20])).toBe('1d20@20')
    expect(buildNotation(3, 6, [4, 5, 6])).toBe('3d6@4,5,6')
    expect(buildNotation(6, 6, [4, 4, 4, 4, 4, 4])).toBe('6d6@4,4,4,4,4,4')
  })
  it('clamps each forced face into [1, sides]', () => {
    expect(buildNotation(2, 6, [0, 99])).toBe('2d6@1,6')
    expect(buildNotation(1, 20, [25])).toBe('1d20@20')
  })
})

describe('buildNotation — length mismatch (AC5/AC7)', () => {
  it('values longer than qty are truncated to qty', () => {
    expect(buildNotation(2, 6, [1, 2, 3, 4])).toBe('2d6@1,2')
  })
  it('values shorter than qty force only the provided dice (fewer dice)', () => {
    // Partial list rolls forced.length dice, not qty — matches legacy
    // force-only-provided behavior; never silently pads.
    expect(buildNotation(3, 6, [5])).toBe('1d6@5')
    expect(buildNotation(3, 6, [5, 2])).toBe('2d6@5,2')
  })
  it('drops non-finite entries before counting', () => {
    expect(buildNotation(3, 6, [5, null, 2])).toBe('2d6@5,2')
  })
})

describe('percentileNotation (d100 pair — spike AC4c)', () => {
  it('forces an arbitrary percentile as a d100+d10 pair', () => {
    expect(percentileNotation(57)).toBe('1d100+1d10@50,7')
    expect(percentileNotation(100)).toBe('1d100+1d10@90,10') // d10 face "0" == 10
    expect(percentileNotation(60)).toBe('1d100+1d10@50,10')
    expect(percentileNotation(10)).toBe('1d100+1d10@0,10') // known limit: tens 0
  })
  it('buildNotation routes a single forced d100 through the pair form', () => {
    expect(buildNotation(1, 100, [57])).toBe('1d100+1d10@50,7')
  })
  it('random d100 stays a lone die', () => {
    expect(buildNotation(1, 100)).toBe('1d100')
  })
})

describe('sanitizeForced', () => {
  it('clamps, drops non-finite, truncates to qty', () => {
    expect(sanitizeForced([1, 2, 3], 2, 6)).toEqual([1, 2])
    expect(sanitizeForced([0, 99, NaN], 5, 6)).toEqual([1, 6])
    expect(sanitizeForced('nope', 3, 6)).toEqual([])
  })
})
