import { describe, expect, it } from 'vitest'
import { MonsterTurnPlanningCoordinator } from './MonsterTurnPlanningCoordinator'

describe('MonsterTurnPlanningCoordinator', () => {
  it('cancels an older plan before starting a newer battlefield snapshot', async () => {
    const pending: Array<{ value: number; signal: AbortSignal; resolve: (value: number) => void }> = []
    const coordinator = new MonsterTurnPlanningCoordinator<number, number>((value, control) =>
      new Promise((resolve, reject) => {
        pending.push({ value, signal: control.signal, resolve })
        control.signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true })
      }),
    )

    const first = coordinator.plan(1)
    const second = coordinator.plan(2)
    await expect(first).rejects.toMatchObject({ name: 'AbortError' })
    expect(pending[0].signal.aborted).toBe(true)
    expect(coordinator.active).toBe(true)
    pending[1].resolve(2)
    await expect(second).resolves.toBe(2)
    expect(coordinator.active).toBe(false)
  })
})
