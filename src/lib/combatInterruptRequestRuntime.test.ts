import { describe, expect, it, vi } from 'vitest'
import { createCombatInterrupt, type SharedCombatInterrupt } from './combatInterruptQueue'
import {
  requestAndWaitForCombatInterrupt,
  type PendingCombatInterruptRequestChannel,
} from './combatInterruptRequestRuntime'

function interrupt(id = 'interrupt'): SharedCombatInterrupt {
  return createCombatInterrupt({
    id,
    mapId: 'map',
    kind: 'opportunity-attack',
    payload: {},
    now: 1,
  })
}

describe('Interrupt 请求创建与等待 runtime', () => {
  it('已有终态时直接恢复结果，不登记等待者或重复发布', async () => {
    const channel: PendingCombatInterruptRequestChannel<boolean> = { current: null }
    const publish = vi.fn(async () => {})

    const result = await requestAndWaitForCombatInterrupt({
      id: 'interrupt', channel, metadata: {},
      loadExisting: async () => ({ ...interrupt(), status: 'done', response: { accepted: true } }),
      decideExisting: (existing) => existing?.status === 'done'
        ? { type: 'resolve', value: existing.response?.accepted === true }
        : { type: 'publish' },
      create: interrupt,
      publish,
    })

    expect(result).toBe(true)
    expect(channel.current).toBeNull()
    expect(publish).not.toHaveBeenCalled()
  })

  it('重连遇到已有 pending 时只恢复等待，不重复发布', async () => {
    const channel: PendingCombatInterruptRequestChannel<boolean, { actorId: string }> = { current: null }
    const publish = vi.fn(async () => {})
    const promise = requestAndWaitForCombatInterrupt({
      id: 'interrupt', channel, metadata: { actorId: 'hero' },
      loadExisting: async () => interrupt(),
      decideExisting: (existing) => existing?.status === 'pending' ? { type: 'wait' } : { type: 'publish' },
      create: interrupt,
      publish,
    })
    await Promise.resolve()

    expect(channel.current).toMatchObject({ id: 'interrupt', actorId: 'hero' })
    expect(publish).not.toHaveBeenCalled()
    channel.current?.resolve(true)
    await expect(promise).resolves.toBe(true)
  })

  it('新请求先登记 resolver 再发布，发布失败时清理自己的等待者', async () => {
    const channel: PendingCombatInterruptRequestChannel<boolean> = { current: null }
    const published = vi.fn(async () => {
      expect(channel.current?.id).toBe('interrupt')
      throw new Error('offline')
    })

    await expect(requestAndWaitForCombatInterrupt({
      id: 'interrupt', channel, metadata: {}, create: interrupt, publish: published,
    })).rejects.toThrow('offline')
    expect(channel.current).toBeNull()
  })
})
