import { describe, expect, it } from 'vitest'
import { cellsInCircleRadius } from '../../lib/skillTargeting'
import {
  persistentAreaCircularRangeGeometry,
  persistentAreaPresetUsesCircularRange,
} from './persistentAreaRangePresentation'

describe('persistent area range presentation', () => {
  it('recovers the exact circle radius from touched cells, including upcast Fog Cloud', () => {
    const anchorCell = { col: 8, row: 6 }
    expect(persistentAreaCircularRangeGeometry({
      cells: cellsInCircleRadius(anchorCell, 20),
      anchorCell,
      gridSize: 50,
      gridOffsetX: 10,
      gridOffsetY: 20,
    })).toEqual({ x: 435, y: 345, radius: 200 })
    expect(persistentAreaCircularRangeGeometry({
      cells: cellsInCircleRadius(anchorCell, 40),
      anchorCell,
      gridSize: 50,
    })?.radius).toBe(400)
  })

  it('shares the circular boundary primitive across atmospheric persistent spells', () => {
    for (const preset of [
      'fog-cloud', 'toxic-cloud', 'stinking-cloud', 'cloudkill',
      'sleet-storm', 'insect-plague',
    ]) expect(persistentAreaPresetUsesCircularRange(preset)).toBe(true)
    expect(persistentAreaPresetUsesCircularRange('wall-of-fire')).toBe(false)
  })
})
