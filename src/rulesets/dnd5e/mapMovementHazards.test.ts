import { describe, expect, it } from 'vitest'
import { settleDnd5eMovementTracesSequentially } from './mapMovementHazards'

const movements = [
  {
    tokenId: 'source',
    to: { x: 25, y: 5 },
    path: [{ x: 5, y: 5 }, { x: 15, y: 5 }, { x: 25, y: 5 }],
  },
  {
    tokenId: 'dragged',
    to: { x: 25, y: 15 },
    path: [{ x: 5, y: 15 }, { x: 15, y: 15 }, { x: 25, y: 15 }],
  },
] as const

describe('D&D 5e sequential movement hazard settlement', () => {
  it('settles every translated token path in order and carries forward prior state', async () => {
    const calls: Array<{ tokenId: string; seen: string[]; path: readonly { x: number; y: number }[] }> = []
    const settled = await settleDnd5eMovementTracesSequentially({
      initialContext: { seen: [] as string[] },
      movements,
      settle: async ({ context, movement }) => {
        calls.push({ tokenId: movement.tokenId, seen: [...context.seen], path: movement.path })
        return {
          context: { seen: [...context.seen, movement.tokenId] },
          finalPosition: movement.to,
        }
      },
    })

    expect(calls).toEqual([
      { tokenId: 'source', seen: [], path: movements[0].path },
      { tokenId: 'dragged', seen: ['source'], path: movements[1].path },
    ])
    expect(settled.context.seen).toEqual(['source', 'dragged'])
    expect(settled.finalPositionByCombatantId).toEqual({
      source: { x: 25, y: 5 },
      dragged: { x: 25, y: 15 },
    })
  })

  it('caps every dragged path to the source translation when a hazard stops it early', async () => {
    const calls: Array<{ tokenId: string; to: { x: number; y: number }; path: readonly { x: number; y: number }[] }> = []
    const settled = await settleDnd5eMovementTracesSequentially({
      initialContext: undefined,
      movements,
      settle: async ({ context, movement, index }) => {
        calls.push({ tokenId: movement.tokenId, to: movement.to, path: movement.path })
        return {
          context,
          finalPosition: index === 0 ? { x: 15, y: 5 } : movement.to,
        }
      },
    })

    expect(calls[1]).toEqual({
      tokenId: 'dragged',
      to: { x: 15, y: 15 },
      path: [{ x: 5, y: 15 }, { x: 15, y: 15 }],
    })
    expect(settled.finalPositionByCombatantId).toEqual({
      source: { x: 15, y: 5 },
      dragged: { x: 15, y: 15 },
    })
  })
})
