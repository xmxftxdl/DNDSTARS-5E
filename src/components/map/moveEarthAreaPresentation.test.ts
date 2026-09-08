import { describe, expect, it } from 'vitest'
import { moveEarthAreaPixelBounds } from './moveEarthAreaPresentation'

describe('Move Earth persistent area presentation', () => {
  it('wraps the selected cells in one continuous square boundary', () => {
    const cells = Array.from({ length: 8 }, (_, row) =>
      Array.from({ length: 8 }, (__, col) => ({ col: col + 2, row: row + 3 })),
    ).flat()

    expect(moveEarthAreaPixelBounds(cells, {
      gridSize: 50,
      gridOffsetX: 10,
      gridOffsetY: 20,
      feetPerCell: 5,
    })).toEqual({
      x: 110,
      y: 170,
      width: 400,
      height: 400,
      widthFeet: 40,
      heightFeet: 40,
    })
  })
})
