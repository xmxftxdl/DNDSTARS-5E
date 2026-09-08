import { describe, expect, it } from 'vitest'
import type { BattleMap } from '../../store/maps'
import { selectMapWorkspaceMenuItems } from './mapWorkspaceMenuProjection'

const map = (id: string, name: string, tokenCount = 0): BattleMap => ({
  id,
  name,
  width: 1_000,
  height: 1_000,
  gridSize: 50,
  gridOffsetX: 0,
  gridOffsetY: 0,
  showGrid: true,
  tokens: Array.from({ length: tokenCount }, (_, index) => ({
    id: `${id}-token-${index}`,
    label: 'token',
    x: 0,
    y: 0,
    color: '#ffffff',
    emoji: '',
    size: 1,
    type: 'enemy' as const,
  })),
})

describe('map workspace menu projection', () => {
  it('keeps metadata identity when only token data changes', () => {
    const first = selectMapWorkspaceMenuItems({ maps: [map('a', 'Alpha')] })
    const afterTokenChange = selectMapWorkspaceMenuItems({ maps: [map('a', 'Alpha', 1)] })
    expect(afterTokenChange).toBe(first)
  })

  it('updates when map identity metadata changes', () => {
    const first = selectMapWorkspaceMenuItems({ maps: [map('a', 'Alpha')] })
    const renamed = selectMapWorkspaceMenuItems({ maps: [map('a', 'Renamed')] })
    expect(renamed).not.toBe(first)
    expect(renamed).toEqual([{ id: 'a', name: 'Renamed' }])
  })
})
