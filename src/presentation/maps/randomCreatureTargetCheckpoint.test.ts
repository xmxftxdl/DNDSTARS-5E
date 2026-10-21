import { afterEach, expect, it, vi } from 'vitest'
import { selectRandomCreatureTarget } from './randomCreatureTargetCheckpoint'
afterEach(() => vi.unstubAllGlobals())
it('uses Host entropy once per occurrence, preserves identity across order changes and refresh', async () => {
  let stored = '{}'
  vi.stubGlobal('window', { sessionStorage: { getItem: () => stored, setItem: (_: string, value: string) => { stored = value } } })
  const random = vi.fn(() => 1)
  expect(selectRandomCreatureTarget('attack-1', ['enemy', 'ally'], random)).toBe('enemy')
  expect(selectRandomCreatureTarget('attack-1', ['ally', 'enemy', 'ally'], random)).toBe('enemy')
  vi.resetModules()
  const restored = await import('./randomCreatureTargetCheckpoint')
  expect(restored.selectRandomCreatureTarget('attack-1', ['enemy', 'ally'], random)).toBe('enemy')
  expect(random).toHaveBeenCalledTimes(1)
  expect(() => restored.selectRandomCreatureTarget('attack-1', ['enemy', 'new-ally'], random)).toThrow('random-target-pool-changed')
  expect(random).toHaveBeenCalledTimes(1)
  expect(restored.selectRandomCreatureTarget('attack-2', ['ally', 'enemy'], () => 0)).toBe('ally')
})
it('does not roll for a single target or accept an empty pool or invalid index', () => {
  const random = vi.fn(() => 99)
  expect(selectRandomCreatureTarget('single', ['only'], random)).toBe('only')
  expect(random).not.toHaveBeenCalled()
  expect(() => selectRandomCreatureTarget('empty', [], random)).toThrow('random-target-unavailable')
  expect(() => selectRandomCreatureTarget('bad-roll', ['a', 'b'], random)).toThrow('random-target-invalid-roll')
})
