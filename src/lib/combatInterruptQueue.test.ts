import { describe, expect, it } from 'vitest'
import {
  answerCombatInterrupt,
  createCombatInterrupt,
  emptyCombatInterruptQueue,
  finishCombatInterrupt,
  findCombatInterrupt,
  findCombatTransactionLock,
  isCombatInterruptExpired,
  markCombatInterruptRolling,
  upsertCombatInterrupt,
  rollbackCombatInterrupt,
  waitCombatInterruptForDm,
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

  it('marks an interrupt as rolling without making it expire as pending', () => {
    const request = createCombatInterrupt({
      id: 'i4',
      mapId: 'm1',
      kind: 'dodge',
      targetCharId: 'hero',
      payload: {},
      expiresAt: 150,
      now: 100,
    })
    const queue = upsertCombatInterrupt(null, request, 100)
    const rolling = markCombatInterruptRolling(queue, 'i4', { wantsDodge: true }, 120)!

    expect(findCombatInterrupt(rolling, 'i4')?.status).toBe('rolling')
    expect(findCombatInterrupt(rolling, 'i4')?.response?.wantsDodge).toBe(true)
    expect(isCombatInterruptExpired(findCombatInterrupt(rolling, 'i4')!, 151)).toBe(false)
  })

  it('locks a transaction until it is committed or rolled back', () => {
    const first = createCombatInterrupt({
      id: 'first', transactionId: 'action-1', mapId: 'm1', kind: 'shield-spell', payload: {}, now: 100,
    })
    const duplicate = createCombatInterrupt({
      id: 'duplicate', transactionId: 'action-1', mapId: 'm1', kind: 'uncanny-dodge', payload: {}, now: 101,
    })
    const queue = upsertCombatInterrupt(null, first, 100)
    expect(upsertCombatInterrupt(queue, duplicate, 101).interrupts.map((entry) => entry.id)).toEqual(['first'])
    expect(findCombatTransactionLock(queue, 'action-1')?.id).toBe('first')
    const rolledBack = rollbackCombatInterrupt(queue, first.id, {}, 'timeout', 200)!
    expect(findCombatTransactionLock(rolledBack, 'action-1')).toBeUndefined()
    expect(upsertCombatInterrupt(rolledBack, duplicate, 201).interrupts.map((entry) => entry.id)).toContain('duplicate')
  })

  it('moves DM adjudication into an explicit non-expiring wait state', () => {
    const interrupt = createCombatInterrupt({
      id: 'dm', mapId: 'm1', kind: 'dm-adjudication', payload: {}, expiresAt: 150, now: 100,
    })
    const waiting = waitCombatInterruptForDm(upsertCombatInterrupt(null, interrupt), interrupt.id, 151)!
    expect(findCombatInterrupt(waiting, interrupt.id)).toMatchObject({ status: 'waiting-for-dm', expiresAt: undefined })
  })
})
