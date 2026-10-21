import { expect, it } from 'vitest'
import { readActivityMovementCell, readActivityMovementChoice } from './activityMovementChoice'

it('accepts only finite integer map cells and copies untrusted response fields', () => {
  expect(readActivityMovementCell({ col: 0, row: -2, distanceFeet: 999 })).toEqual({ col: 0, row: -2 })
  for (const value of [null, [], {}, { col: '2', row: 3 }, { col: 1.5, row: 3 },
    { col: NaN, row: 0 }, { col: 0, row: Infinity }, { col: 1e20, row: 0 }]) {
    expect(readActivityMovementCell(value)).toBeUndefined()
  }
})

it('validates the Host movement prompt and preserves an explicitly empty legal-cell set', () => {
  const request = { actorTokenId: 'recipient', originTokenId: 'recipient', label: 'Move', rangeFeet: 30 }
  expect(readActivityMovementChoice(request)).toEqual(request)
  expect(readActivityMovementChoice({ ...request, allowedCells: [] })).toEqual({ ...request, allowedCells: [] })
  for (const change of [{ rangeFeet: -1 }, { rangeFeet: Infinity }, { rangeFeet: '30' },
    { actorTokenId: '' }, { originTokenId: 12 }, { allowedCells: [{ col: 2 }] }, { allowedCells: {} }]) {
    expect(readActivityMovementChoice({ ...request, ...change })).toBeUndefined()
  }
})
