import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Dnd5eCombatSimulationRequest } from '../rulesets/dnd5e/combatSimulation'
import type { Dnd5eCombatSimulationWorkerResponse } from '../workers/dnd5eCombatSimulation.worker'
import {
  dnd5eCombatSimulationJobSnapshot,
  pauseDnd5eCombatSimulationJob,
  resumeDnd5eCombatSimulationJob,
  startDnd5eCombatSimulationJob,
  subscribeDnd5eCombatSimulationJob,
} from './dnd5eCombatSimulationJob'

class FakeWorker {
  static latest: FakeWorker | undefined

  onmessage: ((event: MessageEvent<Dnd5eCombatSimulationWorkerResponse>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  terminated = false
  messages: unknown[] = []

  constructor() {
    FakeWorker.latest = this
  }

  postMessage(message: unknown): void {
    this.messages.push(message)
  }

  terminate(): void {
    this.terminated = true
  }

  emit(data: Dnd5eCombatSimulationWorkerResponse): void {
    this.onmessage?.({ data } as MessageEvent<Dnd5eCombatSimulationWorkerResponse>)
  }
}

describe('persistent D&D 5e combat simulation job', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps the Worker alive and restores progress after the page unsubscribes', () => {
    vi.stubGlobal('Worker', FakeWorker)
    let notifications = 0
    const unsubscribe = subscribeDnd5eCombatSimulationJob(() => {
      notifications += 1
    })
    expect(startDnd5eCombatSimulationJob(
      { characters: [], monsters: [], trials: 1_000, seed: 20_240_724 } as Dnd5eCombatSimulationRequest,
      { mapId: 'map', mapName: '当前遭遇' },
    )).toBe(true)
    const requestId = dnd5eCombatSimulationJobSnapshot().requestId
    unsubscribe()

    FakeWorker.latest!.emit({
      id: requestId,
      status: 'progress',
      progress: {
        completedTrials: 17,
        totalTrials: 1_000,
        phase: 'training',
      },
    })

    expect(FakeWorker.latest!.terminated).toBe(false)
    expect(dnd5eCombatSimulationJobSnapshot()).toMatchObject({
      status: 'running',
      encounter: { mapId: 'map', mapName: '当前遭遇' },
      progress: { completedTrials: 17, totalTrials: 1_000 },
    })
    expect(notifications).toBe(1)

    expect(pauseDnd5eCombatSimulationJob()).toBe(true)
    expect(dnd5eCombatSimulationJobSnapshot().status).toBe('pausing')
    expect(FakeWorker.latest!.messages.at(-1)).toMatchObject({
      id: requestId,
      command: 'pause',
    })
    FakeWorker.latest!.emit({
      id: requestId,
      status: 'paused',
      progress: {
        completedTrials: 17,
        totalTrials: 1_000,
        phase: 'training',
      },
    })
    expect(dnd5eCombatSimulationJobSnapshot().status).toBe('paused')

    expect(resumeDnd5eCombatSimulationJob()).toBe(true)
    expect(FakeWorker.latest!.messages.at(-1)).toMatchObject({
      id: requestId,
      command: 'resume',
    })
    FakeWorker.latest!.emit({
      id: requestId,
      status: 'resumed',
      progress: {
        completedTrials: 17,
        totalTrials: 1_000,
        phase: 'training',
      },
    })
    expect(dnd5eCombatSimulationJobSnapshot()).toMatchObject({
      status: 'running',
      progress: { completedTrials: 17, totalTrials: 1_000 },
    })
  })
})
