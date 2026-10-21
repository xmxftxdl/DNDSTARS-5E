import { expect, it } from 'vitest'
import { planDnd5eDruidGroveGround, type Dnd5eDruidGroveGroundFacts, type Dnd5eDruidGrovePlacement } from './druidGrovePlacement'

function fixture(sideFeet = 30) {
  const facts: Dnd5eDruidGroveGroundFacts = { environment: 'outdoors',
    cells: Array.from({ length: 20 * 20 }, (_, i) => ({ col: i % 20, row: Math.floor(i / 20) })),
    structureCells: [{ col: 1, row: 1 }], trees: Array.from({ length: 5 }, (_, i) => ({ tokenId: `tree-${i}`, cell: { col: i, row: 2 } })) }
  const placement: Dnd5eDruidGrovePlacement = { origin: { col: 0, row: 0 }, sideFeet,
    fogCells: [{ col: 0, row: 0 }], undergrowthCells: [{ col: 2, row: 0 }], guardianTreeIds: ['tree-0', 'tree-1', 'tree-2', 'tree-3'] }
  return { facts, placement }
}

it.each([30, 60, 90])('selects a %s-foot ground footprint, excluding structures and preserving separate effects', side => {
  const { facts, placement } = fixture(side), before = JSON.stringify({ facts, placement })
  const result = planDnd5eDruidGroveGround(placement, facts)
  expect(result.ok).toBe(true)
  if (!result.ok) throw Error(result.reason)
  expect(result.protectedCells).toHaveLength((side / 5) ** 2 - 1)
  expect(result.protectedCells).not.toContainEqual({ col: 1, row: 1 })
  expect(result.fogCells).toEqual(placement.fogCells)
  expect(result.guardianTreeIds).toHaveLength(4)
  result.fogCells[0].col = 99
  expect(JSON.stringify({ facts, placement })).toBe(before)
})

it.each([0, 25, 95, 31, NaN, Infinity])('rejects invalid grid-aligned side %s', side => {
  const { facts, placement } = fixture(side)
  expect(planDnd5eDruidGroveGround(placement, facts)).toEqual({ ok: false, reason: 'invalid-volume' })
})

it('accepts underground, excludes indoor placement, and allows choosing no fog or guardians', () => {
  const { facts, placement } = fixture()
  expect(planDnd5eDruidGroveGround({ ...placement, fogCells: [], guardianTreeIds: [] }, { ...facts, environment: 'underground' }).ok).toBe(true)
  expect(planDnd5eDruidGroveGround(placement, { ...facts, environment: 'indoors' })).toEqual({ ok: false, reason: 'invalid-environment' })
})

it.each(['outside', 'structure', 'duplicate', 'overlap', 'missing-ground'] as const)('rejects invalid subarea: %s', scenario => {
  const { facts, placement } = fixture()
  if (scenario === 'outside') placement.fogCells = [{ col: 6, row: 0 }]
  if (scenario === 'structure') placement.fogCells = [{ col: 1, row: 1 }]
  if (scenario === 'duplicate') placement.fogCells = [{ col: 0, row: 0 }, { col: 0, row: 0 }]
  if (scenario === 'overlap') placement.undergrowthCells = placement.fogCells
  if (scenario === 'missing-ground') facts.cells = facts.cells.filter(cell => cell.col !== 0)
  expect(planDnd5eDruidGroveGround(placement, facts)).toEqual({ ok: false, reason: scenario === 'overlap' ? 'overlapping-subareas' : 'invalid-subarea' })
})

it.each(['too-many', 'duplicate', 'missing', 'outside', 'ambiguous'] as const)('rejects invalid tree binding: %s', scenario => {
  const { facts, placement } = fixture()
  if (scenario === 'too-many') placement.guardianTreeIds = facts.trees.map(tree => tree.tokenId)
  if (scenario === 'duplicate') placement.guardianTreeIds = ['tree-0', 'tree-0']
  if (scenario === 'missing') placement.guardianTreeIds = ['invented-tree']
  if (scenario === 'outside') facts.trees[0].cell = { col: 10, row: 0 }
  if (scenario === 'ambiguous') facts.trees = [...facts.trees, facts.trees[0]]
  expect(planDnd5eDruidGroveGround(placement, facts)).toEqual({ ok: false, reason: 'invalid-guardians' })
})
