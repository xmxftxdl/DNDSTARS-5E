import { afterEach, describe, expect, it, vi } from 'vitest'
import { settleAuthoritativeDicePresentation } from './dicePresentationGate'

describe('settleAuthoritativeDicePresentation', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('始终保留 Host 生成的权威骰值', async () => {
    await expect(settleAuthoritativeDicePresentation({
      authoritativeValues: [6, 5, 4, 3],
      presentation: Promise.resolve([1, 1, 1, 1]),
      maximumWaitMs: 100,
    })).resolves.toEqual([6, 5, 4, 3])
  })

  it('iframe 不回传结果时在展示期限后继续结算', async () => {
    vi.useFakeTimers()
    const result = settleAuthoritativeDicePresentation({
      authoritativeValues: [6, 6, 5, 5, 4, 4, 3, 3],
      presentation: new Promise(() => undefined),
      maximumWaitMs: 3_500,
    })

    let settled = false
    void result.then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)

    await vi.advanceTimersByTimeAsync(3_500)
    await expect(result).resolves.toEqual([6, 6, 5, 5, 4, 4, 3, 3])
  })

  it('动画自身报错也不会中止规则事务', async () => {
    await expect(settleAuthoritativeDicePresentation({
      authoritativeValues: [4, 2],
      presentation: Promise.reject(new Error('WebGL unavailable')),
      maximumWaitMs: 100,
    })).resolves.toEqual([4, 2])
  })
})
