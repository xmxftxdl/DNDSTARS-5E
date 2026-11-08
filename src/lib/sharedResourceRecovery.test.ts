import { afterEach, expect, it, vi } from 'vitest'
import { subscribeSharedResourceInvalidation } from './sharedApi'
import { getSharedSyncHealth, resetSharedSyncHealthForTests } from './sharedSyncHealth'
let cleanup: (() => void) | undefined

afterEach(() => { cleanup?.(); cleanup = undefined; vi.useRealTimers(); vi.restoreAllMocks(); resetSharedSyncHealthForTests() })
it('backs off failed reads and reports recovery only after a successful refresh', async () => {
  vi.useFakeTimers()
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  const refresh = vi.fn().mockRejectedValueOnce(new Error('offline')).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined)
  cleanup = subscribeSharedResourceInvalidation('maps', refresh, { recoveryMs:1000 })
  await vi.advanceTimersByTimeAsync(0)
  expect(getSharedSyncHealth().status).toBe('recovering')
  await vi.advanceTimersByTimeAsync(1000)
  expect(refresh).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(1000)
  expect(refresh).toHaveBeenCalledTimes(2)
  expect(log).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(4000)
  expect(refresh).toHaveBeenCalledTimes(3)
  expect(getSharedSyncHealth().status).toBe('healthy')
})
it('clears a disposed failed subscription without waiting for its next timer', async () => {
  vi.useFakeTimers()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  cleanup = subscribeSharedResourceInvalidation('maps', async () => { throw Error('offline') })
  await vi.advanceTimersByTimeAsync(0)
  expect(getSharedSyncHealth().status).toBe('recovering')
  cleanup()
  expect(getSharedSyncHealth().status).toBe('healthy')
  cleanup = undefined
})