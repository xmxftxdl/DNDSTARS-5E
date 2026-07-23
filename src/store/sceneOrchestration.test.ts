import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SceneHistoryEntry } from '../lib/sceneOrchestration'
import { useSceneOrchestrationStore } from './sceneOrchestration'

describe('scene orchestration runtime queue', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    useSceneOrchestrationStore.getState().reset()
  })
  afterEach(() => vi.restoreAllMocks())

  function configuredTrigger() {
    const store = useSceneOrchestrationStore.getState()
    const sceneId = store.ensureScene('map-1', 'Map')
    const triggerId = useSceneOrchestrationStore.getState().shared.scenes[0].triggers[0].id
    store.addAction(sceneId, triggerId, { id: 'action-1', kind: 'light', enabled: true, ambientLight: 'dim' })
    return { sceneId, triggerId }
  }

  it('deduplicates a pending transition and records its receipt only after completion', () => {
    const { sceneId, triggerId } = configuredTrigger()
    const store = useSceneOrchestrationStore.getState()
    const token = { tokenId: 'hero', characterId: 'character', label: 'Hero', type: 'player' as const, x: 0, y: 0 }
    const runId = store.enqueueRun({ sceneId, triggerId, mapId: 'map-1', event: 'enter', token })
    expect(runId).toBeTruthy()
    expect(store.enqueueRun({ sceneId, triggerId, mapId: 'map-1', event: 'enter', token })).toBeNull()
    expect(useSceneOrchestrationStore.getState().shared.runtime.receipts).toEqual([])

    const history: SceneHistoryEntry = {
      id: 'history-1', runId: runId!, sceneId, triggerId, actionId: 'action-1',
      summary: 'light changed', executedAt: 1, reversible: false,
    }
    store.advanceRun(runId!, history)
    expect(useSceneOrchestrationStore.getState().shared.runtime.pendingRuns).toEqual([])
    expect(useSceneOrchestrationStore.getState().shared.runtime.receipts).toEqual([
      `${sceneId}:${triggerId}:token:hero`,
    ])
    expect(store.enqueueRun({ sceneId, triggerId, mapId: 'map-1', event: 'enter', token })).toBeNull()
  })

  it('keeps a failed action retryable after the DM discards its run', () => {
    const { sceneId, triggerId } = configuredTrigger()
    const store = useSceneOrchestrationStore.getState()
    const token = { tokenId: 'hero', label: 'Hero', type: 'player' as const, x: 0, y: 0 }
    const runId = store.enqueueRun({ sceneId, triggerId, mapId: 'map-1', event: 'enter', token })
    expect(runId).toBeTruthy()
    store.failRun(runId!, 'missing binding')
    expect(useSceneOrchestrationStore.getState().shared.runtime).toMatchObject({ paused: true, lastError: 'missing binding' })
    store.discardRun(runId!)
    expect(store.enqueueRun({ sceneId, triggerId, mapId: 'map-1', event: 'enter', token })).toBeTruthy()
  })
})
