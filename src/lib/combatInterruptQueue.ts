export const COMBAT_INTERRUPT_RESOURCE = 'combat-interrupts'
export const COMBAT_INTERRUPT_QUEUE_LIMIT = 32

export type CombatInterruptKind = 'dodge' | 'stable-mind' | 'gale-combo' | 'agile-leap' | 'opportunity-attack' | 'protection' | 'shield-spell' | 'counterspell' | 'uncanny-dodge' | 'deflect-missiles' | 'saving-throw-reroll' | 'legendary-resistance' | 'bardic-inspiration' | 'cutting-words' | 'dark-ones-own-luck' | 'stroke-of-luck' | 'empowered-spell' | 'stand-against-tide' | 'plugin-choice' | 'dm-adjudication'
export type CombatInterruptStatus = 'pending' | 'waiting-for-dm' | 'rolling' | 'answered' | 'done' | 'rolled-back'
export type CombatInterruptPhase = 'before-action' | 'before-hit' | 'before-damage' | 'after-save' | 'before-condition'
export type CombatInterruptTimeoutPolicy = 'rollback' | 'wait-for-dm'

const TERMINAL_INTERRUPT_STATUSES = new Set<CombatInterruptStatus>(['done', 'rolled-back'])

export function defaultCombatInterruptPhase(kind: CombatInterruptKind): CombatInterruptPhase {
  if (kind === 'counterspell' || kind === 'plugin-choice' || kind === 'dm-adjudication') return 'before-action'
  if (kind === 'uncanny-dodge' || kind === 'deflect-missiles' || kind === 'empowered-spell') return 'before-damage'
  if (kind === 'saving-throw-reroll' || kind === 'legendary-resistance' || kind === 'bardic-inspiration' || kind === 'dark-ones-own-luck' || kind === 'stable-mind') return 'after-save'
  if (kind === 'agile-leap') return 'before-condition'
  return 'before-hit'
}

export interface SharedCombatInterrupt<
  Payload extends Record<string, unknown> = Record<string, unknown>,
  Response extends Record<string, unknown> = Record<string, unknown>,
> {
  id: string
  mapId: string
  kind: CombatInterruptKind
  status: CombatInterruptStatus
  /** 同一 Headless 动作的稳定事务 ID；服务端据此阻止重复结算。 */
  transactionId: string
  phase: CombatInterruptPhase
  timeoutPolicy: CombatInterruptTimeoutPolicy
  actorCharId?: string
  targetCharId?: string
  payload: Payload
  response?: Response
  expiresAt?: number
  waitingSince?: number
  rollbackReason?: 'timeout' | 'dm-disconnected' | 'cancelled' | 'stale-transaction'
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
  transactionId?: string
  phase?: CombatInterruptPhase
  timeoutPolicy?: CombatInterruptTimeoutPolicy
  now?: number
}): SharedCombatInterrupt<Payload, Response> {
  const now = input.now ?? Date.now()
  const id = input.id ?? `${input.kind}:${now}:${Math.random().toString(36).slice(2)}`
  return {
    id,
    mapId: input.mapId,
    kind: input.kind,
    status: 'pending',
    transactionId: input.transactionId ?? id,
    phase: input.phase ?? defaultCombatInterruptPhase(input.kind),
    timeoutPolicy: input.timeoutPolicy ?? (input.kind === 'dm-adjudication' ? 'wait-for-dm' : 'rollback'),
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
  const lock = findCombatTransactionLock(base, interrupt.transactionId)
  if (lock && lock.id !== interrupt.id) return base
  const existing = base.interrupts.find((item) => item.id === interrupt.id)
  if (existing && isCombatInterruptTerminal(existing)) return base
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
    (interrupt) => interrupt.status === 'pending' || interrupt.status === 'rolling'
      ? { ...interrupt, status: 'answered', response, updatedAt: now }
      : interrupt,
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
    (interrupt) => interrupt.status === 'pending' ? ({
      ...interrupt,
      status: 'rolling',
      response: response ?? interrupt.response,
      updatedAt: now,
    }) : interrupt,
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
    (interrupt) => isCombatInterruptTerminal(interrupt) ? interrupt : ({
      ...interrupt,
      status: 'done',
      response: response ?? interrupt.response,
      updatedAt: now,
    }),
    now,
  )
}

export function waitCombatInterruptForDm(
  queue: SharedCombatInterruptQueueState | null | undefined,
  id: string,
  now = Date.now(),
): SharedCombatInterruptQueueState | null {
  return updateCombatInterrupt(queue, id, (interrupt) => interrupt.status === 'pending' && interrupt.timeoutPolicy === 'wait-for-dm' ? ({
    ...interrupt,
    status: 'waiting-for-dm',
    expiresAt: undefined,
    waitingSince: now,
    updatedAt: now,
  }) : interrupt, now)
}

export function rollbackCombatInterrupt(
  queue: SharedCombatInterruptQueueState | null | undefined,
  id: string,
  response: Record<string, unknown> | undefined,
  rollbackReason: NonNullable<SharedCombatInterrupt['rollbackReason']>,
  now = Date.now(),
): SharedCombatInterruptQueueState | null {
  return updateCombatInterrupt(queue, id, (interrupt) => isCombatInterruptTerminal(interrupt) ? interrupt : ({
    ...interrupt,
    status: 'rolled-back',
    response: response ?? interrupt.response,
    rollbackReason,
    updatedAt: now,
  }), now)
}

export function isCombatInterruptTerminal(interrupt: Pick<SharedCombatInterrupt, 'status'>): boolean {
  return TERMINAL_INTERRUPT_STATUSES.has(interrupt.status)
}

export function findCombatTransactionLock(
  queue: SharedCombatInterruptQueueState | null | undefined,
  transactionId: string,
): SharedCombatInterrupt | undefined {
  return queue?.interrupts.find((interrupt) =>
    interrupt.transactionId === transactionId && !isCombatInterruptTerminal(interrupt),
  )
}

export function isCombatInterruptExpired(interrupt: SharedCombatInterrupt, now = Date.now()): boolean {
  return interrupt.status === 'pending' && interrupt.timeoutPolicy === 'rollback' &&
    interrupt.expiresAt != null && now >= interrupt.expiresAt
}

export function shouldCombatInterruptWaitForDm(interrupt: SharedCombatInterrupt, now = Date.now()): boolean {
  return interrupt.status === 'pending' && interrupt.timeoutPolicy === 'wait-for-dm' &&
    interrupt.expiresAt != null && now >= interrupt.expiresAt
}

export function findCombatInterrupt(
  queue: SharedCombatInterruptQueueState | null | undefined,
  id: string,
): SharedCombatInterrupt | undefined {
  return queue?.interrupts.find((interrupt) => interrupt.id === id)
}
