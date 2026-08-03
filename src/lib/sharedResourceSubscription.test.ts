import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SHARED_STATE_CHANGED_CHANNEL,
  subscribeSharedResourceInvalidation,
} from './sharedApi'
import { getSharedSyncHealth, resetSharedSyncHealthForTests } from './sharedSyncHealth'

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

class FakeVisibilityDocument {
  visibilityState: DocumentVisibilityState = 'hidden'
  private readonly listeners = new Set<EventListenerOrEventListenerObject>()

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (type === 'visibilitychange') this.listeners.add(listener)
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (type === 'visibilitychange') this.listeners.delete(listener)
  }

  setVisibility(visibilityState: DocumentVisibilityState): void {
    this.visibilityState = visibilityState
    const event = { type: 'visibilitychange' } as Event
    for (const listener of this.listeners) {
      if (typeof listener === 'function') listener(event)
      else listener.handleEvent(event)
    }
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
    resetSharedSyncHealthForTests()
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

  it('can recover while hidden and refresh immediately when visibility is restored', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('EventSource', FakeEventSource)
    const visibilityDocument = new FakeVisibilityDocument()
    vi.stubGlobal('document', visibilityDocument)
    const refresh = vi.fn(async () => undefined)

    const stop = subscribeSharedResourceInvalidation('player-action-requests', refresh, {
      recoveryMs: 2_000,
      recoverWhenHidden: true,
      refreshOnVisibilityRestore: true,
    })
    await flushAsync()
    expect(refresh).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(2_000)
    expect(refresh).toHaveBeenCalledTimes(2)

    visibilityDocument.setVisibility('visible')
    await flushAsync()
    expect(refresh).toHaveBeenCalledTimes(3)

    stop()
    visibilityDocument.setVisibility('hidden')
    visibilityDocument.setVisibility('visible')
    await flushAsync()
    expect(refresh).toHaveBeenCalledTimes(3)
  })

  it('keeps hidden recovery disabled by default', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('EventSource', FakeEventSource)
    vi.stubGlobal('document', new FakeVisibilityDocument())
    const refresh = vi.fn(async () => undefined)

    const stop = subscribeSharedResourceInvalidation('maps', refresh, { recoveryMs: 2_000 })
    await flushAsync()
    expect(refresh).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(2_000)
    expect(refresh).toHaveBeenCalledTimes(1)
    stop()
  })

  it('removes a closed event source and reconnects while listeners remain', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('EventSource', FakeEventSource)
    const refresh = vi.fn(async () => undefined)

    const stop = subscribeSharedResourceInvalidation('maps', refresh)
    await flushAsync()
    const firstSource = FakeEventSource.instances[0]
    expect(firstSource).toBeDefined()

    firstSource.readyState = FakeEventSource.CLOSED
    firstSource.onerror?.()
    expect(firstSource.closed).toBe(true)
    expect(FakeEventSource.instances).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(250)
    expect(FakeEventSource.instances).toHaveLength(2)
    expect(FakeEventSource.instances[1].closed).toBe(false)

    stop()
    expect(FakeEventSource.instances[1].closed).toBe(true)
  })

  it('ignores replay duplicates and reloads authority state when an event sequence has a gap', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('EventSource', FakeEventSource)
    const refresh = vi.fn(async () => undefined)
    const stop = subscribeSharedResourceInvalidation('maps', refresh)
    await flushAsync()

    FakeEventSource.instances[0].emit({
      channel: SHARED_STATE_CHANGED_CHANNEL,
      payload: { id: 'maps:1', name: 'maps', updatedAt: 1 },
      streamId: 'stream-a',
      sequence: 1,
    })
    await flushAsync()
    expect(refresh).toHaveBeenCalledTimes(2)

    FakeEventSource.instances[0].emit({
      channel: SHARED_STATE_CHANGED_CHANNEL,
      payload: { id: 'maps:1', name: 'maps', updatedAt: 1 },
      streamId: 'stream-a',
      sequence: 1,
    })
    await flushAsync()
    expect(refresh).toHaveBeenCalledTimes(2)

    FakeEventSource.instances[0].emit({
      channel: SHARED_STATE_CHANGED_CHANNEL,
      payload: { id: 'characters:3', name: 'characters', updatedAt: 3 },
      streamId: 'stream-a',
      sequence: 3,
    })
    await flushAsync()
    expect(refresh).toHaveBeenCalledTimes(3)
    expect(getSharedSyncHealth()).toMatchObject({ duplicateEventsIgnored: 1, eventGapsRecovered: 1 })
    stop()
  })

})
