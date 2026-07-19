export const SHARED_SYNC_HEALTH_EVENT = 'dndstars5e-shared-sync-health'

export interface SharedSyncHealth {
  status: 'healthy' | 'recovering' | 'conflict'
  conflictsPrevented: number
  eventGapsRecovered: number
  duplicateEventsIgnored: number
  lastSuccessfulWriteAt: number | null
  lastEventAt: number | null
  lastRecoveryAt: number | null
  lastMessage: string | null
  resourceRevisions: Record<string, number>
}

let health: SharedSyncHealth = {
  status: 'healthy',
  conflictsPrevented: 0,
  eventGapsRecovered: 0,
  duplicateEventsIgnored: 0,
  lastSuccessfulWriteAt: null,
  lastEventAt: null,
  lastRecoveryAt: null,
  lastMessage: null,
  resourceRevisions: {},
}

const listeners = new Set<() => void>()

function update(patch: Partial<SharedSyncHealth>): void {
  health = { ...health, ...patch }
  for (const listener of [...listeners]) listener()
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SHARED_SYNC_HEALTH_EVENT, { detail: health }))
}

export function getSharedSyncHealth(): SharedSyncHealth {
  return health
}

export function subscribeSharedSyncHealth(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function recordSharedRevision(resource: string, revision: number): void {
  if (!Number.isInteger(revision) || revision < 0) return
  if (health.resourceRevisions[resource] === revision) return
  update({ resourceRevisions: { ...health.resourceRevisions, [resource]: revision } })
}

export function recordSharedWrite(resource: string, revision: number): void {
  update({
    status: 'healthy',
    lastSuccessfulWriteAt: Date.now(),
    lastMessage: `「${resource}」已同步到版本 ${revision}`,
    resourceRevisions: { ...health.resourceRevisions, [resource]: revision },
  })
}

export function recordSharedConflict(resource: string, expected: number, current: number): void {
  update({
    status: 'conflict',
    conflictsPrevented: health.conflictsPrevented + 1,
    lastRecoveryAt: Date.now(),
    lastMessage: `已阻止「${resource}」旧版本 ${expected} 覆盖服务器版本 ${current}`,
    resourceRevisions: { ...health.resourceRevisions, [resource]: current },
  })
}

export function recordSharedEvent(sequence: number): void {
  update({ lastEventAt: Date.now(), lastMessage: health.status === 'healthy' ? `已接收共享事件 #${sequence}` : health.lastMessage })
}

export function recordSharedEventGap(previous: number, current: number, streamChanged = false): void {
  update({
    status: 'recovering',
    eventGapsRecovered: health.eventGapsRecovered + 1,
    lastRecoveryAt: Date.now(),
    lastMessage: streamChanged
      ? '共享服务已重启，正在重新读取全部权威状态'
      : `检测到事件 #${previous} → #${current} 断档，正在重新读取全部权威状态`,
  })
}

export function recordDuplicateSharedEvent(): void {
  update({ duplicateEventsIgnored: health.duplicateEventsIgnored + 1 })
}

export function settleSharedRecovery(): void {
  if (health.status !== 'recovering') return
  update({ status: 'healthy', lastMessage: '共享状态重新读取完成' })
}

export function acknowledgeSharedConflict(): void {
  if (health.status !== 'conflict') return
  update({ status: 'healthy', lastMessage: '已采用服务器权威版本' })
}

export function resetSharedSyncHealthForTests(): void {
  health = {
    status: 'healthy',
    conflictsPrevented: 0,
    eventGapsRecovered: 0,
    duplicateEventsIgnored: 0,
    lastSuccessfulWriteAt: null,
    lastEventAt: null,
    lastRecoveryAt: null,
    lastMessage: null,
    resourceRevisions: {},
  }
}
