import {
  answerCombatInterrupt,
  COMBAT_INTERRUPT_RESOURCE,
  contributeCombatInterrupt,
  emptyCombatInterruptQueue,
  finishCombatInterrupt,
  markCombatInterruptRolling,
  rollbackCombatInterrupt,
  upsertCombatInterrupt,
  waitCombatInterruptForDm,
  type CombatInterruptContribution,
  type SharedCombatInterrupt,
  type SharedCombatInterruptQueueState,
} from './combatInterruptQueue'
import type { SharedCombatInterruptMutation } from './sharedApi'

export type SharedCombatInterruptLoad = <T>(name: string) => Promise<T | null>
export type SharedCombatInterruptSave = <T>(name: string, data: T) => Promise<void>

export interface SharedCombatInterruptStore {
  loadSharedResource: SharedCombatInterruptLoad
  saveSharedResource: SharedCombatInterruptSave
  mutateSharedCombatInterrupt?: <T>(mutation: SharedCombatInterruptMutation) => Promise<T | null>
}

function requireMutationResult<T>(operation: string, result: T | null): T {
  if (result == null) throw new Error(`combat-interrupt-mutation-rejected:${operation}`)
  return result
}

async function loadQueueForMap(
  input: SharedCombatInterruptStore & { mapId: string },
): Promise<SharedCombatInterruptQueueState> {
  const current = await input.loadSharedResource<SharedCombatInterruptQueueState>(COMBAT_INTERRUPT_RESOURCE)
  return current && current.mapId === input.mapId ? current : emptyCombatInterruptQueue(input.mapId)
}

export async function publishSharedCombatInterrupt(
  input: SharedCombatInterruptStore & { interrupt: SharedCombatInterrupt },
): Promise<void> {
  if (input.mutateSharedCombatInterrupt) {
    requireMutationResult('upsert', await input.mutateSharedCombatInterrupt({
      operation: 'upsert',
      mapId: input.interrupt.mapId,
      interrupt: input.interrupt,
    }))
    return
  }
  const current = await input.loadSharedResource<SharedCombatInterruptQueueState>(COMBAT_INTERRUPT_RESOURCE)
  await input.saveSharedResource(COMBAT_INTERRUPT_RESOURCE, upsertCombatInterrupt(current, input.interrupt))
}

export async function answerSharedCombatInterrupt(
  input: SharedCombatInterruptStore & { mapId: string; id: string; response: Record<string, unknown> },
): Promise<void> {
  if (input.mutateSharedCombatInterrupt) {
    requireMutationResult('answer', await input.mutateSharedCombatInterrupt({
      operation: 'answer', mapId: input.mapId, id: input.id, response: input.response,
    }))
    return
  }
  const next = answerCombatInterrupt(await loadQueueForMap(input), input.id, input.response)
  await input.saveSharedResource(COMBAT_INTERRUPT_RESOURCE, requireMutationResult('answer', next))
}

export async function markSharedCombatInterruptRolling(
  input: SharedCombatInterruptStore & { mapId: string; id: string; response?: Record<string, unknown> },
): Promise<void> {
  if (input.mutateSharedCombatInterrupt) {
    requireMutationResult('rolling', await input.mutateSharedCombatInterrupt({
      operation: 'rolling', mapId: input.mapId, id: input.id, response: input.response,
    }))
    return
  }
  const next = markCombatInterruptRolling(await loadQueueForMap(input), input.id, input.response)
  await input.saveSharedResource(COMBAT_INTERRUPT_RESOURCE, requireMutationResult('rolling', next))
}

export async function finishSharedCombatInterrupt(
  input: SharedCombatInterruptStore & { mapId: string; id: string; response?: Record<string, unknown> },
): Promise<void> {
  if (input.mutateSharedCombatInterrupt) {
    requireMutationResult('finish', await input.mutateSharedCombatInterrupt({
      operation: 'finish', mapId: input.mapId, id: input.id, response: input.response,
    }))
    return
  }
  const next = finishCombatInterrupt(await loadQueueForMap(input), input.id, input.response)
  await input.saveSharedResource(COMBAT_INTERRUPT_RESOURCE, requireMutationResult('finish', next))
}

export async function contributeSharedCombatInterrupt(
  input: SharedCombatInterruptStore & { mapId: string; id: string; contribution: CombatInterruptContribution },
): Promise<void> {
  if (input.mutateSharedCombatInterrupt) {
    requireMutationResult('contribute', await input.mutateSharedCombatInterrupt({
      operation: 'contribute', mapId: input.mapId, id: input.id, contribution: input.contribution,
    }))
    return
  }
  const next = contributeCombatInterrupt(await loadQueueForMap(input), input.id, input.contribution)
  await input.saveSharedResource(COMBAT_INTERRUPT_RESOURCE, requireMutationResult('contribute', next))
}

export async function waitSharedCombatInterruptForDm(
  input: SharedCombatInterruptStore & { mapId: string; id: string },
): Promise<void> {
  if (input.mutateSharedCombatInterrupt) {
    requireMutationResult('wait', await input.mutateSharedCombatInterrupt({
      operation: 'wait', mapId: input.mapId, id: input.id,
    }))
    return
  }
  const next = waitCombatInterruptForDm(await loadQueueForMap(input), input.id)
  await input.saveSharedResource(COMBAT_INTERRUPT_RESOURCE, requireMutationResult('wait', next))
}

export async function rollbackSharedCombatInterrupt(
  input: SharedCombatInterruptStore & {
    mapId: string
    id: string
    response?: Record<string, unknown>
    reason: 'timeout' | 'dm-disconnected' | 'cancelled' | 'stale-transaction'
  },
): Promise<void> {
  if (input.mutateSharedCombatInterrupt) {
    requireMutationResult('rollback', await input.mutateSharedCombatInterrupt({
      operation: 'rollback',
      mapId: input.mapId,
      id: input.id,
      response: input.response,
      rollbackReason: input.reason,
    }))
    return
  }
  const next = rollbackCombatInterrupt(await loadQueueForMap(input), input.id, input.response, input.reason)
  await input.saveSharedResource(COMBAT_INTERRUPT_RESOURCE, requireMutationResult('rollback', next))
}
