/// <reference lib="webworker" />

import {
  simulateDnd5eCombatsAsync,
  type Dnd5eCombatSimulationProgress,
  type Dnd5eCombatSimulationRequest,
  type Dnd5eCombatSimulationResult,
} from '../rulesets/dnd5e/combatSimulation'

export interface Dnd5eCombatSimulationWorkerRequest {
  id: number
  request?: Dnd5eCombatSimulationRequest
  command?: 'pause' | 'resume'
}

export type Dnd5eCombatSimulationWorkerResponse =
  | { id: number; status: 'progress'; progress: Dnd5eCombatSimulationProgress }
  | { id: number; status: 'paused'; progress?: Dnd5eCombatSimulationProgress }
  | { id: number; status: 'resumed'; progress?: Dnd5eCombatSimulationProgress }
  | { id: number; status: 'completed'; result: Dnd5eCombatSimulationResult }
  | { id: number; status: 'failed'; error: string }

const worker = self as DedicatedWorkerGlobalScope
const CONTROL_YIELD_INTERVAL_MS = 50
let activeJob: {
  id: number
  paused: boolean
  progress?: Dnd5eCombatSimulationProgress
  resume?: () => void
  lastControlYieldAt: number
  lastProgressSentAt: number
  lastProgressPhase?: Dnd5eCombatSimulationProgress['phase']
} | undefined

function yieldToWorkerEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

async function waitForSimulationPermission(job: NonNullable<typeof activeJob>): Promise<void> {
  if (!job.paused && performance.now() - job.lastControlYieldAt < CONTROL_YIELD_INTERVAL_MS) return
  await yieldToWorkerEventLoop()
  job.lastControlYieldAt = performance.now()
  while (job.paused) {
    await new Promise<void>((resolve) => {
      job.resume = resolve
    })
    await yieldToWorkerEventLoop()
    job.lastControlYieldAt = performance.now()
  }
}

async function runSimulation(id: number, request: Dnd5eCombatSimulationRequest): Promise<void> {
  const job = {
    id,
    paused: false,
    lastControlYieldAt: performance.now(),
    lastProgressSentAt: -Infinity,
  } as NonNullable<typeof activeJob>
  activeJob = job
  try {
    worker.postMessage({
      id,
      status: 'completed',
      result: await simulateDnd5eCombatsAsync(request, {
        onProgress(progress) {
          job.progress = progress
          const now = performance.now()
          if (
            progress.completedTrials === 1 ||
            progress.completedTrials === progress.totalTrials ||
            job.lastProgressPhase !== progress.phase ||
            now - job.lastProgressSentAt >= 100
          ) {
            job.lastProgressSentAt = now
            job.lastProgressPhase = progress.phase
            worker.postMessage({
              id,
              status: 'progress',
              progress,
            } satisfies Dnd5eCombatSimulationWorkerResponse)
          }
        },
        waitForNextBatch: () => waitForSimulationPermission(job),
      }),
    } satisfies Dnd5eCombatSimulationWorkerResponse)
  } catch (error) {
    worker.postMessage({
      id,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    } satisfies Dnd5eCombatSimulationWorkerResponse)
  } finally {
    if (activeJob?.id === id) activeJob = undefined
  }
}

worker.onmessage = (event: MessageEvent<Dnd5eCombatSimulationWorkerRequest>) => {
  const { id, request, command } = event.data
  if (command) {
    if (!activeJob || activeJob.id !== id) return
    if (command === 'pause') {
      activeJob.paused = true
      worker.postMessage({
        id,
        status: 'paused',
        progress: activeJob.progress,
      } satisfies Dnd5eCombatSimulationWorkerResponse)
      return
    }
    activeJob.paused = false
    activeJob.resume?.()
    activeJob.resume = undefined
    worker.postMessage({
      id,
      status: 'resumed',
      progress: activeJob.progress,
    } satisfies Dnd5eCombatSimulationWorkerResponse)
    return
  }
  if (!request || activeJob) return
  void runSimulation(id, request)
}

export {}
