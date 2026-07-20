import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDnd5ePluginSandbox } from './pluginSandbox'

class FakeWorker {
  static last: FakeWorker | undefined
  readonly sent: unknown[] = []
  private readonly messageListeners: Array<(event: MessageEvent) => void> = []
  private readonly errorListeners: Array<(event: ErrorEvent) => void> = []
  terminated = false

  constructor() {
    FakeWorker.last = this
  }

  addEventListener(type: string, listener: (event: never) => void) {
    if (type === 'message') this.messageListeners.push(listener as (event: MessageEvent) => void)
    if (type === 'error') this.errorListeners.push(listener as (event: ErrorEvent) => void)
  }

  postMessage(value: unknown) {
    this.sent.push(value)
    const message = value as { type?: string; requestId?: string; fromVersion?: number; state?: unknown }
    queueMicrotask(() => {
      if (message.type === 'init') {
        this.emit({
          type: 'initialized',
          contributions: {
            manifest: {
              id: 'com.example.migration-test',
              name: 'Migration Test',
              version: '2.0.0',
              apiVersion: 2,
              rulesetId: 'dnd5e-2014-srd-5.1',
              publisher: 'Tests',
              license: 'CC0-1.0',
              stateSchemaVersion: 2,
            },
            features: [],
            actions: [],
            races: [],
            abilityGenerationMethods: [],
            items: [{
              id: 'test-item', name: '测试物品', category: 'adventuring-gear', icon: 'generic',
              description: '测试。', rulesText: '由 DM 裁定。', stackable: true,
            }],
            migrations: [{ fromVersion: 1, toVersion: 2 }],
          },
        })
      } else if (message.type === 'migrate') {
        this.emit({
          type: 'migrated',
          requestId: message.requestId,
          fromVersion: message.fromVersion,
          toVersion: 2,
          state: { ...(message.state as Record<string, unknown>), migrated: true },
        })
      }
    })
  }

  terminate() {
    this.terminated = true
  }

  private emit(data: unknown) {
    for (const listener of this.messageListeners) listener({ data } as MessageEvent)
  }
}

describe('D&D 5e plugin state migration sandbox protocol', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    FakeWorker.last = undefined
  })

  it('keeps migration data in the Worker request/response boundary', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    vi.stubGlobal('window', {
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    })
    const session = await createDnd5ePluginSandbox(new TextEncoder().encode('plugin').buffer)
    expect(session.migrations).toEqual([{ fromVersion: 1, toVersion: 2 }])
    expect(session.items).toEqual([expect.objectContaining({ id: 'test-item' })])

    const result = await session.migrateState(1, { counter: 3 })
    expect(result).toEqual({
      fromVersion: 1,
      toVersion: 2,
      state: { counter: 3, migrated: true },
    })
    expect(FakeWorker.last?.sent).toContainEqual({
      type: 'migrate',
      requestId: expect.any(String),
      fromVersion: 1,
      state: { counter: 3 },
    })
    session.terminate()
    expect(FakeWorker.last?.terminated).toBe(true)
  })
})
