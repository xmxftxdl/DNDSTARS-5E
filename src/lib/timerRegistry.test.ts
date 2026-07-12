import { describe, expect, it, vi } from 'vitest'
import { TimerRegistry } from './timerRegistry'

describe('TimerRegistry', () => {
  it('clears every registered timer exactly once', () => {
    const registry = new TimerRegistry()
    registry.add(1)
    registry.add(2)
    registry.add(2)
    const clear = vi.fn()
    registry.clear(clear)
    expect(clear.mock.calls).toEqual([[1], [2]])
    expect(registry.size).toBe(0)
  })
})
