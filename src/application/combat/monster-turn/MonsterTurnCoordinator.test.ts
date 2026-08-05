import { describe, expect, it } from 'vitest'
import { MonsterTurnCoordinator } from './MonsterTurnCoordinator'

describe('MonsterTurnCoordinator', () => {
  it('prevents a stale completion from releasing a newer turn', () => {
    const coordinator = new MonsterTurnCoordinator(async (input: number) => input)
    coordinator.begin('turn-a')
    coordinator.begin('turn-b')
    expect(coordinator.complete('turn-a')).toBe(false)
    expect(coordinator.isCurrent('turn-b')).toBe(true)
  })

  it('delegates planning and releases the matching identity', async () => {
    const coordinator = new MonsterTurnCoordinator(async (input: number) => input + 1)
    coordinator.begin('turn-a')
    expect(await coordinator.plan(1)).toBe(2)
    expect(coordinator.complete('turn-a')).toBe(true)
    expect(coordinator.isCurrent('turn-a')).toBe(false)
  })
})
