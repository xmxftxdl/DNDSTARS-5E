import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SHARED_STATE_CHANGED_CHANNEL,
  subscribeSharedResourceInvalidation,
} from './sharedApi'

class FakeEventSource {
  static readonly CLOSED = 2
  static instances: FakeEventSource[] = []

  readonly url: string
  readyState = 1
  onerror: (() => void) | null = null
  closed = false
  private message?: (event: MessageEvent<string>) => void

  constructor(url: string) {
    this.url = url
    FakeEventSource.instances.push(this)
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (type !== 'message') return
    this.message = listener as (event: MessageEvent<string>) => void
  }

  emit(payload: unknown): void {
    this.message?.({ data: JSON.stringify(payload) } as MessageEvent<string>)
  }

  close(): void {
    this.closed = true
    this.readyState = FakeEventSource.CLOSED
  }
}

async function flushAsync(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe('shared resource invalidation', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    FakeEventSource.instances = []
  })

  it('refreshes immediately, on matching SSE events, and on the recovery interval', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('EventSource', FakeEventSource)
    const refresh = vi.fn(async () => undefined)

    const stop = subscribeSharedResourceInvalidation('maps', refresh, { recoveryMs: 5_000 })
    await flushAsync()
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(FakeEventSource.instances[0].url).toContain('/events/_all')

    FakeEventSource.instances[0].emit({
      channel: SHARED_STATE_CHANGED_CHANNEL,
      payload: { id: 'other:1', name: 'characters', updatedAt: 1 },
    })
    await flushAsync()
    expect(refresh).toHaveBeenCalledTimes(1)

    FakeEventSource.instances[0].emit({
      channel: SHARED_STATE_CHANGED_CHANNEL,
      payload: { id: 'maps:2', name: 'maps', updatedAt: 2 },
    })
    await flushAsync()
    expect(refresh).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(5_000)
    expect(refresh).toHaveBeenCalledTimes(3)

    stop()
    expect(FakeEventSource.instances[0].closed).toBe(true)
  })

  it('shares one state-change SSE connection across resource subscribers', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('EventSource', FakeEventSource)
    const refreshMaps = vi.fn(async () => undefined)
    const refreshCharacters = vi.fn(async () => undefined)

    const stopMaps = subscribeSharedResourceInvalidation('maps', refreshMaps)
    const stopCharacters = subscribeSharedResourceInvalidation('characters', refreshCharacters)
    await flushAsync()

    expect(FakeEventSource.instances).toHaveLength(1)
    FakeEventSource.instances[0].emit({
      channel: SHARED_STATE_CHANGED_CHANNEL,
      payload: { id: 'characters:1', name: 'characters', updatedAt: 1 },
    })
    await flushAsync()
    expect(refreshMaps).toHaveBeenCalledTimes(1)
    expect(refreshCharacters).toHaveBeenCalledTimes(2)

    stopMaps()
    expect(FakeEventSource.instances[0].closed).toBe(false)
    stopCharacters()
    expect(FakeEventSource.instances[0].closed).toBe(true)
  })

})
