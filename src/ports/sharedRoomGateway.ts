export type SharedResourceSaveResult =
  | { status: 'saved'; revision?: number }
  | { status: 'skipped'; reason: 'spectator' | 'forbidden' }
  | { status: 'invalid'; reason: 'schema' | 'serialization' }
  | { status: 'too-large' }
  | { status: 'conflict'; expectedRevision: number; currentRevision: number }
  | { status: 'failed' }

export interface SharedResourceWriteOptions {
  undoGroupId?: string
  undoLabel?: string
  roomJournalMutations?: readonly unknown[]
}

export interface SharedResourceTransactionWrite<T = unknown> {
  name: string
  data: T
}

export interface SharedResourceTransactionResult {
  status: 'committed'
  transactionId: string
  revisions: Record<string, number>
}

export type SharedCombatInterruptMutation =
  | { operation: 'upsert'; mapId: string; interrupt: object }
  | { operation: 'contribute'; mapId: string; id: string; contribution: object }
  | { operation: 'answer' | 'rolling' | 'finish' | 'wait'; mapId: string; id: string; response?: Record<string, unknown> }
  | { operation: 'rollback'; mapId: string; id: string; response?: Record<string, unknown>; rollbackReason: 'timeout' | 'dm-disconnected' | 'cancelled' | 'stale-transaction' }

export interface DmUndoTransactionSummary {
  transactionId: string
  label: string
  status: 'applied' | 'undone'
  resources: string[]
  createdAt: number
  updatedAt: number
  undoneAt?: number
}

export interface SharedServerClockSample {
  offsetMs: number
  roundTripMs: number
  sampledAt: number
}

export interface SharedRoomGatewayPort {
  getRevisionWatermark(name: string): number
  loadResource<T>(name: string): Promise<T | null>
  saveResource<T>(name: string, data: T, options?: SharedResourceWriteOptions): Promise<void>
  saveResourceWithResult<T>(name: string, data: T, options?: SharedResourceWriteOptions): Promise<SharedResourceSaveResult>
  saveResourcesAtomically(
    writes: readonly SharedResourceTransactionWrite[],
    options?: SharedResourceWriteOptions & { transactionId?: string },
  ): Promise<SharedResourceTransactionResult>
  appendPlayerActionRequest<T>(action: T): Promise<void>
  loadDmUndoHistory(): Promise<DmUndoTransactionSummary[]>
  undoDmTransaction(transactionId?: string): Promise<{
    transaction: DmUndoTransactionSummary
    restored: Array<{ resource: string; revision: number }>
  }>
  publishEvent<T>(channel: string, data: T): Promise<void>
  clearEventBacklog(channels?: string[]): Promise<void>
  clearResource(name: string): Promise<void>
  mutateResource<T>(resourceName: string, endpoint: string, mutation: unknown): Promise<T>
  putImage(id: string, blob: Blob, purpose?: 'general' | 'handout' | 'scene-audio'): Promise<boolean>
  getImage(id: string): Promise<Blob | undefined>
  deleteImage(id: string): Promise<void>
  sampleServerClock(attempts?: number): Promise<SharedServerClockSample | null>
  mutateCombatInterrupt<T>(mutation: SharedCombatInterruptMutation): Promise<T | null>
  subscribeEvent<T>(channel: string, onMessage: (data: T) => void): () => void
  subscribeResourceInvalidation(
    name: string,
    refresh: () => void | Promise<void>,
    options?: {
      recoveryMs?: number
      immediate?: boolean
      recoverWhenHidden?: boolean
      refreshOnVisibilityRestore?: boolean
    },
  ): () => void
}
