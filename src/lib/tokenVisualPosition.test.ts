import { describe, expect, it, vi } from 'vitest'
import {
  releaseTokenVisualNodesAtPosition,
  setTokenVisualNodesPositionLocked,
  syncTokenVisualNodes,
  syncTokenVisualPositionFrame,
  tokenVisualNodesDisplayPosition,
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

  it('writes the final coordinate before unlocking every detached layer', () => {
    const calls: string[] = []
    const layer = { batchDraw: vi.fn(() => calls.push('draw')) }
    const nodes: TokenVisualNodeLike[] = Array.from({ length: 2 }, (_, index) => ({
      cancelPositionAnimation: () => calls.push(`cancel:${index}`),
      position: ({ x, y }) => calls.push(`position:${index}:${x},${y}`),
      setPositionLocked: (locked) => calls.push(`lock:${index}:${locked}`),
      getLayer: () => layer,
    }))

    expect(releaseTokenVisualNodesAtPosition(nodes, { x: 300, y: 180 })).toBe(2)
    expect(calls).toEqual([
      'cancel:0',
      'position:0:300,180',
      'cancel:1',
      'position:1:300,180',
      'draw',
      'lock:0:false',
      'lock:1:false',
    ])
  })

  it('updates body, perimeter and status layers from one movement frame', () => {
    const firstLayer = { batchDraw: vi.fn() }
    const secondLayer = { batchDraw: vi.fn() }
    const cancelPositionAnimation = vi.fn()
    const writes: string[] = []
    const nodes: TokenVisualNodeLike[] = [
      {
        cancelPositionAnimation,
        position: ({ x, y }) => writes.push(`body:${x},${y}`),
        getLayer: () => firstLayer,
      },
      {
        cancelPositionAnimation,
        position: ({ x, y }) => writes.push(`ring:${x},${y}`),
        getLayer: () => secondLayer,
      },
      {
        cancelPositionAnimation,
        position: ({ x, y }) => writes.push(`status:${x},${y}`),
        getLayer: () => secondLayer,
      },
    ]

    expect(syncTokenVisualPositionFrame([{
      nodes,
      point: { x: 210, y: 145 },
    }])).toBe(3)
    expect(writes).toEqual([
      'body:210,145',
      'ring:210,145',
      'status:210,145',
    ])
    expect(cancelPositionAnimation).not.toHaveBeenCalled()
    expect(firstLayer.batchDraw).toHaveBeenCalledOnce()
    expect(secondLayer.batchDraw).toHaveBeenCalledOnce()
  })

  it('exposes the current rendered coordinate for attached DOM overlays', () => {
    const nodes: TokenVisualNodeLike[] = [
      {
        position: vi.fn(),
        getPosition: () => ({ x: 48, y: 92 }),
        getLayer: () => null,
      },
    ]

    expect(tokenVisualNodesDisplayPosition(nodes)).toEqual({ x: 48, y: 92 })
    expect(tokenVisualNodesDisplayPosition(undefined)).toBeUndefined()
  })
})
