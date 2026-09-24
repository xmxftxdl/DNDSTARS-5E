import { describe, expect, it } from 'vitest'
import { gridAreaBoundaryEdges } from './GridAreaOutline'

describe('rules area outline', () => {
  it('removes shared interior edges and repeated cells', () => {
    const edges = gridAreaBoundaryEdges([{col: 0, row: 0}, {col: 1, row: 0}, {col: 0, row: 0}])
    expect(edges).toHaveLength(6)
    expect(edges).not.toContainEqual([1, 0, 1, 1])
    expect(edges).not.toContainEqual([1, 1, 1, 0])
  })
  it('preserves the safe inner hole of a ring rather than drawing its bounding rectangle', () => {
    const cells = Array.from({length: 9}, (_, i) => ({col: i % 3, row: Math.floor(i / 3)}))
      .filter(cell => cell.col !== 1 || cell.row !== 1)
    const edges = gridAreaBoundaryEdges(cells)
    expect(edges).toHaveLength(16)
    expect(edges).toContainEqual([2, 1, 1, 1])
    expect(edges).toContainEqual([1, 2, 2, 2])
    expect(gridAreaBoundaryEdges([])).toEqual([])
  })
})
