/// <reference lib="webworker" />

import {
  simulateDnd5eCombats,
  type Dnd5eCombatSimulationRequest,
  type Dnd5eCombatSimulationResult,
} from '../rulesets/dnd5e/combatSimulation'

export interface Dnd5eCombatSimulationWorkerRequest {
  id: number
  request: Dnd5eCombatSimulationRequest
}

export type Dnd5eCombatSimulationWorkerResponse =
  | { id: number; status: 'completed'; result: Dnd5eCombatSimulationResult }
  | { id: number; status: 'failed'; error: string }

const worker = self as DedicatedWorkerGlobalScope

worker.onmessage = (event: MessageEvent<Dnd5eCombatSimulationWorkerRequest>) => {
  const { id, request } = event.data
  try {
    worker.postMessage({
      id,
      status: 'completed',
      result: simulateDnd5eCombats(request),
    } satisfies Dnd5eCombatSimulationWorkerResponse)
  } catch (error) {
    worker.postMessage({
      id,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    } satisfies Dnd5eCombatSimulationWorkerResponse)
  }
}

export {}
