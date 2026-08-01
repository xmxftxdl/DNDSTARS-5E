/// <reference lib="webworker" />

import { resolveDnd5eMonsterTurnWorkerInput } from '../lib/dnd5eMonsterTurnWorkerRuntime'
import type {
  Dnd5eMonsterTurnWorkerRequest,
  Dnd5eMonsterTurnWorkerResponse,
} from '../lib/dnd5eMonsterTurnWorkerProtocol'

const worker = self as DedicatedWorkerGlobalScope

worker.onmessage = (event: MessageEvent<Dnd5eMonsterTurnWorkerRequest>) => {
  const request = event.data
  if (request.type !== 'plan') return
  try {
    worker.postMessage({
      type: 'planned',
      requestId: request.requestId,
      plan: resolveDnd5eMonsterTurnWorkerInput(request.input),
    } satisfies Dnd5eMonsterTurnWorkerResponse)
  } catch (error) {
    worker.postMessage({
      type: 'failed',
      requestId: request.requestId,
      error: error instanceof Error ? error.message : String(error),
    } satisfies Dnd5eMonsterTurnWorkerResponse)
  }
}

export {}
