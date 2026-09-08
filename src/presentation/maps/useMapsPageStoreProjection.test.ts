import { describe, expect, it } from 'vitest'
import type { BattleMap } from '../../store/maps'
import { selectMapsPageActiveMap } from './useMapsPageStoreProjection'

const map = (id: string): BattleMap => ({
  id,
  name: id,
  width: 1_000,
  height: 1_000,
  gridSize: 50,
  gridOffsetX: 0,
  gridOffsetY: 0,
  showGrid: true,
  tokens: [],
})

describe('maps page active map projection', () => {
  it('keeps the selected map reference when an inactive map changes', () => {
    const active = map('active')
    const first = selectMapsPageActiveMap({ maps: [active, map('background')], selectedId: active.id })
    const afterBackgroundUpdate = selectMapsPageActiveMap({
      maps: [active, { ...map('background'), name: 'changed' }],
      selectedId: active.id,
    })
    expect(afterBackgroundUpdate).toBe(first)
  })

  it('falls back to the first map when the stored selection is absent', () => {
    const first = map('first')
    expect(selectMapsPageActiveMap({ maps: [first], selectedId: 'missing' })).toBe(first)
    expect(selectMapsPageActiveMap({ maps: [], selectedId: null })).toBeNull()
  })
})
