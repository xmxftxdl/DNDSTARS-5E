import {
  answerCombatInterrupt,
  COMBAT_INTERRUPT_RESOURCE,
  emptyCombatInterruptQueue,
  finishCombatInterrupt,
  markCombatInterruptRolling,
  rollbackCombatInterrupt,
  upsertCombatInterrupt,
  waitCombatInterruptForDm,
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
    await input.mutateSharedCombatInterrupt({
      operation: 'upsert',
      mapId: input.interrupt.mapId,
      interrupt: input.interrupt,
    })
    return
  }
  const current = await input.loadSharedResource<SharedCombatInterruptQueueState>(COMBAT_INTERRUPT_RESOURCE)
  await input.saveSharedResource<SharedCombatInterruptQueueState>(
    COMBAT_INTERRUPT_RESOURCE,
    upsertCombatInterrupt(current, input.interrupt),
  )
}

export async function answerSharedCombatInterrupt(
  input: SharedCombatInterruptStore & {
    mapId: string
    id: string
    response: Record<string, unknown>
  },
): Promise<void> {
  if (input.mutateSharedCombatInterrupt) {
    await input.mutateSharedCombatInterrupt({ operation: 'answer', mapId: input.mapId, id: input.id, response: input.response })
    return
  }
  const queue = await loadQueueForMap(input)
  const next = answerCombatInterrupt(queue, input.id, input.response)
  if (next) await input.saveSharedResource<SharedCombatInterruptQueueState>(COMBAT_INTERRUPT_RESOURCE, next)
}

export async function markSharedCombatInterruptRolling(
  input: SharedCombatInterruptStore & {
    mapId: string
    id: string
    response?: Record<string, unknown>
  },
): Promise<void> {
  if (input.mutateSharedCombatInterrupt) {
    await input.mutateSharedCombatInterrupt({ operation: 'rolling', mapId: input.mapId, id: input.id, response: input.response })
    return
  }
  const queue = await loadQueueForMap(input)
  const next = markCombatInterruptRolling(queue, input.id, input.response)
  if (next) await input.saveSharedResource<SharedCombatInterruptQueueState>(COMBAT_INTERRUPT_RESOURCE, next)
}

export async function finishSharedCombatInterrupt(
  input: SharedCombatInterruptStore & {
    mapId: string
    id: string
    response?: Record<string, unknown>
  },
): Promise<void> {
  if (input.mutateSharedCombatInterrupt) {
    await input.mutateSharedCombatInterrupt({ operation: 'finish', mapId: input.mapId, id: input.id, response: input.response })
    return
  }
  const queue = await loadQueueForMap(input)
  const next = finishCombatInterrupt(queue, input.id, input.response)
  if (next) await input.saveSharedResource<SharedCombatInterruptQueueState>(COMBAT_INTERRUPT_RESOURCE, next)
}

export async function waitSharedCombatInterruptForDm(
  input: SharedCombatInterruptStore & { mapId: string; id: string },
): Promise<void> {
  if (input.mutateSharedCombatInterrupt) {
    await input.mutateSharedCombatInterrupt({ operation: 'wait', mapId: input.mapId, id: input.id })
    return
  }
  const queue = await loadQueueForMap(input)
  const next = waitCombatInterruptForDm(queue, input.id)
  if (next) await input.saveSharedResource<SharedCombatInterruptQueueState>(COMBAT_INTERRUPT_RESOURCE, next)
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
    await input.mutateSharedCombatInterrupt({
      operation: 'rollback', mapId: input.mapId, id: input.id,
      response: input.response, rollbackReason: input.reason,
    })
    return
  }
  const queue = await loadQueueForMap(input)
  const next = rollbackCombatInterrupt(queue, input.id, input.response, input.reason)
  if (next) await input.saveSharedResource<SharedCombatInterruptQueueState>(COMBAT_INTERRUPT_RESOURCE, next)
}
