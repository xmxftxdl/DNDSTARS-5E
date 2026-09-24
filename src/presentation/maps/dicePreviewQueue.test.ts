import { describe, expect, it } from 'vitest'
import { enqueueDicePreview, finishDicePreview } from './dicePreviewQueue'
import type { SharedRollRequestPreview } from './useDicePresentation'
const preview = (id: string, value: number): SharedRollRequestPreview => ({ id, kind: 'dice', count: 1, sides: 8, values: [value], label: '虹光颜色', targetName: '卓尔', settled: id.endsWith(':dm-confirmed') })

describe('public DM dice corrections', () => {
  it('preserves a correction followed immediately by another roll', () => {
    const original = preview('color', 3)
    const correction = preview('color:dm-confirmed', 6)
    const next = preview('damage', 4)
    let queue = enqueueDicePreview([], original)
    queue = enqueueDicePreview(queue, correction)
    queue = enqueueDicePreview(queue, next)
    queue = finishDicePreview(queue, original.id)
    expect(queue[0]).toEqual(correction)
    expect(queue[0].settled).toBe(true)
    expect(finishDicePreview(queue, original.id)).toEqual(queue)
    queue = finishDicePreview(queue, correction.id)
    expect(queue[0]).toEqual(next)
  })
  it('deduplicates messages and clears all pending previews on reset', () => {
    const original = preview('color', 3)
    const queue = enqueueDicePreview([original], original)
    expect(queue).toHaveLength(1)
    expect(enqueueDicePreview(queue, null)).toEqual([])
  })
})
