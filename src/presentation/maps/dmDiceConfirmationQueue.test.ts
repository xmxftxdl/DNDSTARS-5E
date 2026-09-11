import { describe, expect, it, vi } from 'vitest'
import { createDmDiceConfirmationQueue, type DmDiceConfirmation } from './dmDiceConfirmationQueue'

const request = (id: string, sides: number, visibility: 'public' | 'dm-only'): DmDiceConfirmation => ({
  id, sides, visibility, values: [1], label: id, targetName: '目标',
})

describe('DM dice settlement confirmation', () => {
  it('cancels active and queued confirmations without accepting any faces, and can be reused', async () => {
    const present = vi.fn(() => new Promise<number[]>(() => {}))
    const confirm = createDmDiceConfirmationQueue(present)
    const first = confirm(request('attack', 20, 'public'))
    const second = confirm(request('damage', 6, 'public'))
    const results = Promise.allSettled([first, second])
    await Promise.resolve()
    confirm.cancelAll()
    expect((await results).map(result => result.status)).toEqual(['rejected', 'rejected'])
    expect(present).toHaveBeenCalledTimes(1)
    present.mockImplementation(async () => [5])
    await expect(confirm(request('next-combat', 20, 'public'))).resolves.toEqual([5])
  })

  it('waits for DM approval and returns edited faces before presenting the next group', async () => {
    const pending: ((values: number[]) => void)[] = []
    const present = vi.fn(() => new Promise<number[]>(resolve => pending.push(resolve)))
    const confirm = createDmDiceConfirmationQueue(present)
    const save = confirm(request('敏捷豁免', 20, 'public'))
    const color = confirm(request('颜色', 8, 'dm-only'))
    let finished = false
    void save.then(() => { finished = true })
    await Promise.resolve()
    expect(present).toHaveBeenCalledTimes(1)
    expect(finished).toBe(false)
    pending[0]!([17])
    expect(await save).toEqual([17])
    await Promise.resolve()
    expect(present).toHaveBeenCalledTimes(2)
    expect(present.mock.calls[1]).toEqual([request('颜色', 8, 'dm-only')])
    pending[1]!([8])
    expect(await color).toEqual([8])
  })

  it('rejects out-of-range faces and preserves all dice in a large damage pool', async () => {
    const bad = createDmDiceConfirmationQueue(async () => [9])
    await expect(bad(request('颜色', 8, 'public'))).rejects.toThrow()
    const values = Array.from({ length: 26 }, () => 6)
    const confirm = createDmDiceConfirmationQueue(async () => values)
    await expect(confirm({ ...request('伤害', 6, 'public'), values })).resolves.toEqual(values)
  })
})
