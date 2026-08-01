import { describe, expect, it, vi } from 'vitest'
import {
  setTokenVisualNodesPositionLocked,
  syncTokenVisualNodes,
  type TokenVisualNodeLike,
} from './tokenVisualPosition'

describe('Token visual position coordinator', () => {
  it('moves detached overlays atomically and draws each layer only once', () => {
    const layer = { batchDraw: vi.fn() }
    const cancelPositionAnimation = vi.fn()
    const setPositionLocked = vi.fn()
    const positions: Array<{ x: number; y: number }> = []
    const nodes: TokenVisualNodeLike[] = Array.from({ length: 3 }, () => ({
      cancelPositionAnimation,
      setPositionLocked,
      position: (point) => positions.push({ ...point }),
      getLayer: () => layer,
    }))

    expect(syncTokenVisualNodes(nodes, { x: 125, y: 275 })).toBe(3)
    expect(positions).toEqual([
      { x: 125, y: 275 },
      { x: 125, y: 275 },
      { x: 125, y: 275 },
    ])
    expect(cancelPositionAnimation).toHaveBeenCalledTimes(3)
    expect(layer.batchDraw).toHaveBeenCalledOnce()
    expect(setTokenVisualNodesPositionLocked(nodes, true)).toBe(3)
    expect(setPositionLocked).toHaveBeenCalledTimes(3)
    expect(setPositionLocked).toHaveBeenLastCalledWith(true)
  })
})
