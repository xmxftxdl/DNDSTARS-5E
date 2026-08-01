import { getDnd5eSrdMonster, type Dnd5eMonsterStatBlock } from '../rulesets/dnd5e/monsters'
import { planDnd5eMonsterTurn, type Dnd5eMonsterTurnPlan } from '../rulesets/dnd5e/monsterTurnPlanner'
import { createDnd5eLearnedMonsterDecisionProvider } from '../rulesets/dnd5e/monsterStrategyLearning'
import type {
  Dnd5eMonsterTurnWorkerInput,
  Dnd5eMonsterTurnWorkerRequest,
  Dnd5eMonsterTurnWorkerResponse,
} from './dnd5eMonsterTurnWorkerProtocol'

export interface Dnd5eMonsterTurnPlanningControl {
  signal?: AbortSignal
  /** Preserve live play if Worker creation or execution fails. Defaults to true. */
  synchronousFallback?: boolean
  onSynchronousFallback?: (reason: string) => void
}

export interface Dnd5eMonsterTurnPlanningTask {
  requestId: number
  promise: Promise<Dnd5eMonsterTurnPlan>
  cancel: () => boolean
}

interface PendingPlanningTask {
  requestId: number
  input: Dnd5eMonsterTurnWorkerInput
  control: Dnd5eMonsterTurnPlanningControl
  resolve: (plan: Dnd5eMonsterTurnPlan) => void
  reject: (error: Error) => void
  abortListener?: () => void
}

let plannerWorker: Worker | undefined
let pendingTask: PendingPlanningTask | undefined
let nextRequestId = 1

export class Dnd5eMonsterTurnPlanningCancelledError extends Error {
  override readonly name = 'AbortError'

  constructor(message = 'Monster turn planning was cancelled.') {
    super(message)
  }
}

function terminatePlannerWorker(): void {
  plannerWorker?.terminate()
  plannerWorker = undefined
}

function detachAbortListener(task: PendingPlanningTask): void {
  if (task.abortListener) task.control.signal?.removeEventListener('abort', task.abortListener)
}

function encounterMonsterCatalog(input: Dnd5eMonsterTurnWorkerInput): readonly Dnd5eMonsterStatBlock[] {
  if (input.monsterCatalog) return input.monsterCatalog
  const byId = new Map<string, Dnd5eMonsterStatBlock>()
  for (const token of input.map.tokens) {
    if (!token.poolId || byId.has(token.poolId)) continue
    const monster = getDnd5eSrdMonster(token.poolId)
    if (monster) byId.set(monster.id, monster)
  }
  if (input.enemy.poolId && !byId.has(input.enemy.poolId)) {
    const enemy = getDnd5eSrdMonster(input.enemy.poolId)
    if (enemy) byId.set(enemy.id, enemy)
  }
  return [...byId.values()]
}

function prepareWorkerInput(input: Dnd5eMonsterTurnWorkerInput): Dnd5eMonsterTurnWorkerInput {
  return {
    ...input,
    // Snapshot runtime-only room/plugin registrations while still on the main
    // thread. Stat blocks are declarative and structured-clone safe.
    monsterCatalog: encounterMonsterCatalog(input),
  }
}

function resolveSynchronously(input: Dnd5eMonsterTurnWorkerInput): Dnd5eMonsterTurnPlan {
  // The application's map and monster stores already install their registries
  // on the main thread. Do not replace those global registries in a fallback.
  return planDnd5eMonsterTurn(input.map, input.enemy, input.characters, {
    ...input.options,
    decisionProvider: input.learnedStrategy
      ? createDnd5eLearnedMonsterDecisionProvider(input.learnedStrategy)
      : undefined,
  })
}

function runSynchronousFallback(task: PendingPlanningTask, reason: string): void {
  if (task.control.signal?.aborted) {
    task.reject(new Dnd5eMonsterTurnPlanningCancelledError())
    return
  }
  if (task.control.synchronousFallback === false) {
    task.reject(new Error(reason))
    return
  }
  task.control.onSynchronousFallback?.(reason)
  try {
    task.resolve(resolveSynchronously(task.input))
  } catch (error) {
    task.reject(error instanceof Error ? error : new Error(String(error)))
  }
}

function takePendingTask(requestId: number): PendingPlanningTask | undefined {
  if (!pendingTask || pendingTask.requestId !== requestId) return undefined
  const task = pendingTask
  pendingTask = undefined
  detachAbortListener(task)
  return task
}

function failActiveWorker(reason: string): void {
  const task = pendingTask
  pendingTask = undefined
  if (task) detachAbortListener(task)
  terminatePlannerWorker()
  if (task) runSynchronousFallback(task, reason)
}

function ensurePlannerWorker(): Worker {
  if (plannerWorker) return plannerWorker
  const worker = new Worker(
    new URL('../workers/dnd5eMonsterTurnPlanner.worker.ts', import.meta.url),
    { type: 'module' },
  )
  plannerWorker = worker
  worker.onmessage = (event: MessageEvent<Dnd5eMonsterTurnWorkerResponse>) => {
    const response = event.data
    const task = takePendingTask(response.requestId)
    // A terminated/superseded Worker is allowed to deliver one queued message.
    if (!task) return
    if (response.type === 'planned') {
      task.resolve(response.plan)
      return
    }
    terminatePlannerWorker()
    runSynchronousFallback(task, `Monster planner Worker failed: ${response.error}`)
  }
  worker.onerror = (event) => {
    // A terminated Worker can still dispatch one already-queued event. It must
    // never fail the newer Worker that replaced it.
    if (plannerWorker !== worker) return
    failActiveWorker(event.message || 'Monster planner Worker crashed.')
  }
  worker.onmessageerror = () => {
    if (plannerWorker !== worker) return
    failActiveWorker('Monster planner Worker returned an unreadable response.')
  }
  return worker
}

/**
 * Starts a latest-wins planning task. Starting another task cancels the old
 * one and terminates its Worker because a synchronous planner cannot process a
 * cooperative cancel message until after it has already finished.
 */
export function startDnd5eMonsterTurnPlanning(
  input: Dnd5eMonsterTurnWorkerInput,
  control: Dnd5eMonsterTurnPlanningControl = {},
): Dnd5eMonsterTurnPlanningTask {
  if (pendingTask) {
    cancelDnd5eMonsterTurnPlanning(
      pendingTask.requestId,
      'Monster turn planning was superseded by a newer battlefield snapshot.',
    )
  }

  const requestId = nextRequestId++
  let task!: PendingPlanningTask
  const promise = new Promise<Dnd5eMonsterTurnPlan>((resolve, reject) => {
    task = {
      requestId,
      input: prepareWorkerInput(input),
      control,
      resolve,
      reject,
    }
  })
  const handle: Dnd5eMonsterTurnPlanningTask = {
    requestId,
    promise,
    cancel: () => cancelDnd5eMonsterTurnPlanning(requestId),
  }

  if (control.signal?.aborted) {
    task.reject(new Dnd5eMonsterTurnPlanningCancelledError())
    return handle
  }

  if (typeof Worker !== 'function') {
    runSynchronousFallback(task, 'Web Worker is unavailable in this runtime.')
    return handle
  }

  pendingTask = task
  task.abortListener = () => {
    cancelDnd5eMonsterTurnPlanning(requestId)
  }
  control.signal?.addEventListener('abort', task.abortListener, { once: true })

  try {
    ensurePlannerWorker().postMessage({
      type: 'plan',
      requestId,
      input: task.input,
    } satisfies Dnd5eMonsterTurnWorkerRequest)
  } catch (error) {
    const failed = takePendingTask(requestId)
    terminatePlannerWorker()
    if (failed) {
      runSynchronousFallback(
        failed,
        `Monster planner Worker could not accept the request: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
  return handle
}

export function planDnd5eMonsterTurnOffThread(
  input: Dnd5eMonsterTurnWorkerInput,
  control: Dnd5eMonsterTurnPlanningControl = {},
): Promise<Dnd5eMonsterTurnPlan> {
  return startDnd5eMonsterTurnPlanning(input, control).promise
}

export function cancelDnd5eMonsterTurnPlanning(
  requestId?: number,
  message?: string,
): boolean {
  if (!pendingTask || (requestId != null && pendingTask.requestId !== requestId)) return false
  const task = pendingTask
  pendingTask = undefined
  detachAbortListener(task)
  // The planner is synchronous inside its Worker. Termination is the only true
  // cancellation mechanism; posting a cancel command would wait behind it.
  terminatePlannerWorker()
  task.reject(new Dnd5eMonsterTurnPlanningCancelledError(message))
  return true
}

/** Release the idle Worker, for logout/HMR/tests. */
export function disposeDnd5eMonsterTurnPlannerWorker(): void {
  cancelDnd5eMonsterTurnPlanning(undefined, 'Monster planner Worker was disposed.')
  terminatePlannerWorker()
}
