import { expect, it } from 'vitest'
import { difficultTerrainLabelCells } from './difficultTerrainLabels'

it('shows one label for a connected area', () => {
  const cells = Array.from({ length: 100 }, (_, i) => ({ col: i % 10, row: Math.floor(i / 10), multiplier: 2 }))
  expect([...difficultTerrainLabelCells(cells)]).toEqual(['5,0'])
})

it('keeps separate regions and different costs distinct', () => {
  expect(difficultTerrainLabelCells([
    { col: 0, row: 0, multiplier: 2 }, { col: 1, row: 0, multiplier: 3 },
    { col: 8, row: 8, multiplier: 2 },
  ]).size).toBe(3)
  expect(difficultTerrainLabelCells([]).size).toBe(0)
})
