import type {
  Dnd5eCombatSimulationProgress,
  Dnd5eCombatSimulationRequest,
  Dnd5eCombatSimulationResult,
} from '../rulesets/dnd5e/combatSimulation'
import type {
  Dnd5eCombatSimulationWorkerRequest,
  Dnd5eCombatSimulationWorkerResponse,
} from '../workers/dnd5eCombatSimulation.worker'

export interface Dnd5eCombatSimulationJobSnapshot {
  status: 'idle' | 'running' | 'pausing' | 'paused' | 'completed' | 'failed'
  requestId: number
  encounter?: {
    mapId: string
    mapName: string
  }
  progress?: Dnd5eCombatSimulationProgress
  result?: Dnd5eCombatSimulationResult
  error?: string
}

interface Dnd5eCombatSimulationJobRuntime {
  worker?: Worker
  nextRequestId: number
  snapshot: Dnd5eCombatSimulationJobSnapshot
  listeners: Set<() => void>
}

/*
 * Keep the Worker and its snapshot outside Vite's module instance. Route changes
 * already preserve this module, and the global runtime additionally preserves a
 * running job when development HMR replaces the module itself.
 */
const runtimeKey = '__dnd5eCombatSimulationJobRuntime__'
const globalRuntime = globalThis as typeof globalThis & {
  [runtimeKey]?: Dnd5eCombatSimulationJobRuntime
}
const runtime = globalRuntime[runtimeKey] ??= {
  nextRequestId: 1,
  snapshot: {
    status: 'idle',
    requestId: 0,
  },
  listeners: new Set(),
}

function publish(next: Dnd5eCombatSimulationJobSnapshot): void {
  runtime.snapshot = next
  for (const listener of runtime.listeners) listener()
}

function failWorker(error: string): void {
  publish({
    ...runtime.snapshot,
    status: 'failed',
    error,
  })
  runtime.worker?.terminate()
  runtime.worker = undefined
}

function ensureWorker(): Worker {
  if (runtime.worker) return runtime.worker
  runtime.worker = new Worker(
    new URL('../workers/dnd5eCombatSimulation.worker.ts', import.meta.url),
    { type: 'module' },
  )
  runtime.worker.onmessage = (event: MessageEvent<Dnd5eCombatSimulationWorkerResponse>) => {
    if (event.data.id !== runtime.snapshot.requestId) return
    if (event.data.status === 'progress') {
      publish({ ...runtime.snapshot, progress: event.data.progress })
      return
    }
    if (event.data.status === 'paused') {
      publish({
        ...runtime.snapshot,
        status: 'paused',
        progress: event.data.progress ?? runtime.snapshot.progress,
      })
      return
    }
    if (event.data.status === 'resumed') {
      publish({
        ...runtime.snapshot,
        status: 'running',
        progress: event.data.progress ?? runtime.snapshot.progress,
      })
      return
    }
    if (event.data.status === 'completed') {
      publish({
        ...runtime.snapshot,
        status: 'completed',
        progress: {
          completedTrials: event.data.result.trials,
          totalTrials: event.data.result.trials,
          phase: runtime.snapshot.progress?.phase ?? 'training',
        },
        result: event.data.result,
        error: undefined,
      })
      return
    }
    failWorker(event.data.error)
  }
  runtime.worker.onerror = (event) => {
    failWorker(event.message || '战斗模拟 Worker 运行失败。')
  }
  runtime.worker.onmessageerror = () => {
    failWorker('战斗模拟 Worker 返回了无法读取的数据。')
  }
  return runtime.worker
}

export function startDnd5eCombatSimulationJob(
  request: Dnd5eCombatSimulationRequest,
  encounter: { mapId: string; mapName: string },
): boolean {
  if (runtime.snapshot.status === 'running' || runtime.snapshot.status === 'pausing' || runtime.snapshot.status === 'paused') return false
  const requestId = runtime.nextRequestId
  runtime.nextRequestId += 1
  publish({
    status: 'running',
    requestId,
    encounter,
  })
  ensureWorker().postMessage({
    id: requestId,
    request,
  } satisfies Dnd5eCombatSimulationWorkerRequest)
  return true
}

export function pauseDnd5eCombatSimulationJob(): boolean {
  if (runtime.snapshot.status !== 'running') return false
  const requestId = runtime.snapshot.requestId
  publish({ ...runtime.snapshot, status: 'pausing' })
  ensureWorker().postMessage({
    id: requestId,
    command: 'pause',
  } satisfies Dnd5eCombatSimulationWorkerRequest)
  return true
}

export function resumeDnd5eCombatSimulationJob(): boolean {
  if (runtime.snapshot.status !== 'paused') return false
  const requestId = runtime.snapshot.requestId
  ensureWorker().postMessage({
    id: requestId,
    command: 'resume',
  } satisfies Dnd5eCombatSimulationWorkerRequest)
  return true
}

export function subscribeDnd5eCombatSimulationJob(listener: () => void): () => void {
  runtime.listeners.add(listener)
  return () => runtime.listeners.delete(listener)
}

export function dnd5eCombatSimulationJobSnapshot(): Dnd5eCombatSimulationJobSnapshot {
  return runtime.snapshot
}
