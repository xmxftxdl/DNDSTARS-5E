export const COMBAT_INTERRUPT_RESOURCE = 'combat-interrupts'
export const COMBAT_INTERRUPT_QUEUE_LIMIT = 32

export type CombatInterruptKind = 'dodge' | 'stable-mind' | 'gale-combo' | 'agile-leap' | 'opportunity-attack'
export type CombatInterruptStatus = 'pending' | 'rolling' | 'answered' | 'done'

export interface SharedCombatInterrupt<
  Payload extends Record<string, unknown> = Record<string, unknown>,
  Response extends Record<string, unknown> = Record<string, unknown>,
> {
  id: string
  mapId: string
  kind: CombatInterruptKind
  status: CombatInterruptStatus
  actorCharId?: string
  targetCharId?: string
  payload: Payload
  response?: Response
  expiresAt?: number
  createdAt: number
  updatedAt: number
}

export interface SharedCombatInterruptQueueState {
  mapId: string
  interrupts: SharedCombatInterrupt[]
  updatedAt: number
  revision?: number
}

export function emptyCombatInterruptQueue(mapId: string, now = Date.now()): SharedCombatInterruptQueueState {
  return { mapId, interrupts: [], updatedAt: now, revision: 0 }
}

export function createCombatInterrupt<
  Payload extends Record<string, unknown>,
  Response extends Record<string, unknown> = Record<string, unknown>,
>(input: {
  id?: string
  mapId: string
  kind: CombatInterruptKind
  actorCharId?: string
  targetCharId?: string
  payload: Payload
  expiresAt?: number
  now?: number
}): SharedCombatInterrupt<Payload, Response> {
  const now = input.now ?? Date.now()
  return {
    id: input.id ?? `${input.kind}:${now}:${Math.random().toString(36).slice(2)}`,
    mapId: input.mapId,
    kind: input.kind,
    status: 'pending',
    actorCharId: input.actorCharId,
    targetCharId: input.targetCharId,
    payload: input.payload,
    expiresAt: input.expiresAt,
    createdAt: now,
    updatedAt: now,
  }
}

export function upsertCombatInterrupt(
  queue: SharedCombatInterruptQueueState | null | undefined,
  interrupt: SharedCombatInterrupt,
  now = Date.now(),
): SharedCombatInterruptQueueState {
  const base =
    queue && queue.mapId === interrupt.mapId
      ? queue
      : emptyCombatInterruptQueue(interrupt.mapId, now)
  const next = [
    ...base.interrupts.filter((item) => item.id !== interrupt.id),
    interrupt,
  ]
    .sort((a, b) => a.updatedAt - b.updatedAt)
    .slice(-COMBAT_INTERRUPT_QUEUE_LIMIT)
  return { mapId: interrupt.mapId, interrupts: next, updatedAt: now, revision: (base.revision ?? 0) + 1 }
}

export function updateCombatInterrupt(
  queue: SharedCombatInterruptQueueState | null | undefined,
  id: string,
  updater: (interrupt: SharedCombatInterrupt) => SharedCombatInterrupt,
  now = Date.now(),
): SharedCombatInterruptQueueState | null {
  if (!queue) return null
  let changed = false
  const interrupts = queue.interrupts.map((interrupt) => {
    if (interrupt.id !== id) return interrupt
    changed = true
    return updater(interrupt)
  })
  if (!changed) return queue
  return { ...queue, interrupts, updatedAt: now, revision: (queue.revision ?? 0) + 1 }
}

export function answerCombatInterrupt(
  queue: SharedCombatInterruptQueueState | null | undefined,
  id: string,
  response: Record<string, unknown>,
  now = Date.now(),
): SharedCombatInterruptQueueState | null {
  return updateCombatInterrupt(
    queue,
    id,
    (interrupt) => ({ ...interrupt, status: 'answered', response, updatedAt: now }),
    now,
  )
}

export function markCombatInterruptRolling(
  queue: SharedCombatInterruptQueueState | null | undefined,
  id: string,
  response: Record<string, unknown> | undefined,
  now = Date.now(),
): SharedCombatInterruptQueueState | null {
  return updateCombatInterrupt(
    queue,
    id,
    (interrupt) => ({
      ...interrupt,
      status: 'rolling',
      response: response ?? interrupt.response,
      updatedAt: now,
    }),
    now,
  )
}

export function finishCombatInterrupt(
  queue: SharedCombatInterruptQueueState | null | undefined,
  id: string,
  response: Record<string, unknown> | undefined,
  now = Date.now(),
): SharedCombatInterruptQueueState | null {
  return updateCombatInterrupt(
    queue,
    id,
    (interrupt) => ({
      ...interrupt,
      status: 'done',
      response: response ?? interrupt.response,
      updatedAt: now,
    }),
    now,
  )
}

export function isCombatInterruptExpired(interrupt: SharedCombatInterrupt, now = Date.now()): boolean {
  return interrupt.status === 'pending' && interrupt.expiresAt != null && now >= interrupt.expiresAt
}

export function findCombatInterrupt(
  queue: SharedCombatInterruptQueueState | null | undefined,
  id: string,
): SharedCombatInterrupt | undefined {
  return queue?.interrupts.find((interrupt) => interrupt.id === id)
}
