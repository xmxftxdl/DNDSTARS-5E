import { describe, expect, it } from 'vitest'
import {
  answerCombatInterrupt,
  createCombatInterrupt,
  emptyCombatInterruptQueue,
  finishCombatInterrupt,
  findCombatInterrupt,
  isCombatInterruptExpired,
  upsertCombatInterrupt,
} from './combatInterruptQueue'

describe('combatInterruptQueue', () => {
  it('upserts requests and keeps the newest copy by id', () => {
    const first = createCombatInterrupt({
      id: 'i1',
      mapId: 'm1',
      kind: 'gale-combo',
      actorCharId: 'c1',
      payload: { triggerLabel: 'triggered after save' },
      now: 100,
    })
    const changed = { ...first, payload: { triggerLabel: 'triggered after damage applied' }, updatedAt: 150 }

    const queue = upsertCombatInterrupt(upsertCombatInterrupt(emptyCombatInterruptQueue('m1', 90), first, 100), changed, 150)

    expect(queue.interrupts).toHaveLength(1)
    expect(findCombatInterrupt(queue, 'i1')?.payload.triggerLabel).toBe('triggered after damage applied')
  })

  it('answers and finishes an interrupt without dropping the response', () => {
    const request = createCombatInterrupt({
      id: 'i2',
      mapId: 'm1',
      kind: 'agile-leap',
      targetCharId: 'hero',
      payload: { feet: 10 },
      now: 100,
    })
    const queue = upsertCombatInterrupt(null, request, 100)
    const answered = answerCombatInterrupt(queue, 'i2', { useAgileLeap: true }, 120)!
    const done = finishCombatInterrupt(answered, 'i2', undefined, 130)!

    expect(findCombatInterrupt(answered, 'i2')?.status).toBe('answered')
    expect(findCombatInterrupt(done, 'i2')?.status).toBe('done')
    expect(findCombatInterrupt(done, 'i2')?.response?.useAgileLeap).toBe(true)
  })

  it('treats only pending expired interrupts as expired', () => {
    const request = createCombatInterrupt({
      id: 'i3',
      mapId: 'm1',
      kind: 'stable-mind',
      targetCharId: 'hero',
      payload: {},
      expiresAt: 150,
      now: 100,
    })

    expect(isCombatInterruptExpired(request, 151)).toBe(true)
    expect(isCombatInterruptExpired({ ...request, status: 'answered' }, 151)).toBe(false)
  })
})
