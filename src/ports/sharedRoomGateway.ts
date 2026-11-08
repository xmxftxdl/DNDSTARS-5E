import type{BountifulDeathAreaOriginalIdentity,BountifulDeathAreaOriginalBook}from'./dnd5eDeathAreaOriginalTransport'
import type{BountifulPluginSpellSavingOriginalIdentity,BountifulPluginSpellSavingOriginalBook}from'./dnd5ePluginSpellSavingOriginalTransport'
import type{BountifulDeathFirstRepeatIdentity,BountifulDeathFirstPreparationBook,BountifulDeathFirstPreparationPresence,BountifulDeathFirstRepeatSavingBook}from'./dnd5eDeathFirstRepeatTransport'
import type{BountifulDeathRepeatSavingIdentity,BountifulDeathRepeatSavingBook}from'./dnd5eDeathRepeatSavingTransport'
import type{BountifulPluginSpellAbilityOriginalIdentity,BountifulPluginSpellAbilityOriginalBook}from'./dnd5ePluginSpellAbilityOriginalTransport'
import type{BountifulActivityOriginalIdentity,BountifulActivityOriginalBook}from'./dnd5eActivityOriginalTransport'
export type SharedResourceSaveResult =
  | { status: 'saved'; revision?: number }
  | { status: 'skipped'; reason: 'spectator' | 'forbidden' }
  | { status: 'invalid'; reason: 'schema' | 'serialization' }
  | { status: 'too-large' }
  | { status: 'conflict'; expectedRevision: number; currentRevision: number }
  | { status: 'failed' }

export interface SharedResourceWriteOptions {
  /** Atomic transactions only: validate read dependencies without modifying them. */
  readRevisions?: Readonly<Record<string, number>>
  undoGroupId?: string
  undoLabel?: string
  roomJournalMutations?: readonly unknown[]
}

export interface SharedResourceTransactionWrite<T = unknown> {
  name: string
  data: T
  /** Revision of the snapshot used to plan this write; never replace it with a newer watermark. */
  expectedRevision?: number
}

export interface SharedResourceTransactionResult {
  status: 'committed'
  transactionId: string
  revisions: Record<string, number>
}

export type SharedCombatInterruptMutation =
  | { operation: 'upsert'; mapId: string; interrupt: object }
  | { operation: 'contribute'; mapId: string; id: string; contribution: object }
  | { operation: 'roll-options'; mapId: string; id: string; rollOptions: { contributionId: string; values: number[] } }
  | { operation: 'answer' | 'rolling' | 'finish' | 'wait'; mapId: string; id: string; response?: Record<string, unknown> }
  | { operation: 'rollback'; mapId: string; id: string; response?: Record<string, unknown>; rollbackReason: 'timeout' | 'dm-disconnected' | 'cancelled' | 'stale-transaction' }

export interface DmUndoTransactionSummary {
  details?: string[]
  transactionId: string
  label: string
  status: 'applied' | 'undone'
  resources: string[]
  createdAt: number
  updatedAt: number
  undoneAt?: number
  combatRecoverable?: boolean
  combat?: {
    beforeActorId?: string
    beforeActorLabel?: string
    beforeSlotId?: string
    afterActorId?: string
    afterActorLabel?: string
    afterSlotId?: string
    beforeActive?: boolean
    afterActive?: boolean
    mapId?: string
    combatId?: string
    beforeRound?: number
    afterRound?: number
    beforeInitiativeIndex?: number
    afterInitiativeIndex?: number
  }
}

export interface DmCombatRecoveryResult {
  transaction: DmUndoTransactionSummary
  transactions: DmUndoTransactionSummary[]
  restored: Array<{ resource: string; revision: number }>
}

export interface SharedServerClockSample {
  offsetMs: number
  roundTripMs: number
  sampledAt: number
}

export interface SharedRoomGatewayPort {
  loadSpellcastingOriginalPreparation?(input:{parentId:string;mapId:string;combatId:string;effectId:string}):Promise<unknown>
  requestSharedSpellcastingOriginalSaving?(operation:'prepare'|'inspect'|'dice'|'read'|'target-source'|'target-prepare'|'target-inspect'|'target-dice'|'target-read',payload:unknown):Promise<Record<string,unknown>>
  requestSharedBountifulMonsterSavingLate?<T>(input:{parentId:string;mapId:string;combatId:string}):Promise<T>
  requestSharedMastermindNativeWardOutcome?<T>(operation:'register'|'answer'|'project'|'list',input:unknown):Promise<T>
  requestSharedBountifulInitiativeOriginal?<T>(operation:'begin'|'issue'|'qualify'|'answer'|'raw'|'confirm'|'replacement-raw'|'replacement-confirm'|'complete'|'project'|'list',input:unknown):Promise<T>
  requestSharedMastermindSpellWindow?<T>(operation:'ward-choice-list'|'begin'|'register'|'ward-register'|'ward-complete'|'ward-bountiful-register'|'ward-bountiful-choice'|'ward-bountiful-raw'|'ward-bountiful-confirm'|'ward-bountiful-complete'|'ward-bountiful-project'|'ward-outcome-register'|'ward-outcome'|'ward-retarget-propose'|'ward-retarget-accept'|'ward-retarget-reject'|'issue'|'raw'|'confirm'|'complete'|'abort-extra'|'source'|'request',input:unknown):Promise<T>
  requestSharedMastermindNativeWardOriginal?<T>(operation:'register'|'request'|'raw'|'confirm'|'complete',input:unknown):Promise<T>
  requestSharedMastermindNativeWardBountiful?<T>(operation:'register'|'project'|'list'|'answer'|'raw'|'confirm',input:unknown):Promise<T>
  loadBountifulDeathFirstOriginalSource?(input:BountifulDeathFirstRepeatIdentity):Promise<BountifulDeathFirstPreparationBook>
  inspectBountifulDeathFirstOriginal?(input:BountifulDeathFirstRepeatIdentity):Promise<BountifulDeathFirstPreparationPresence>
  loadBountifulDeathFirstRepeatSavingSource?(input:BountifulDeathFirstRepeatIdentity):Promise<BountifulDeathFirstRepeatSavingBook>
  loadBountifulDeathAreaOriginalSource?(input:BountifulDeathAreaOriginalIdentity):Promise<BountifulDeathAreaOriginalBook>
  loadBountifulDeathRepeatSavingSource?(input:BountifulDeathRepeatSavingIdentity):Promise<BountifulDeathRepeatSavingBook>
  loadBountifulActivityOriginalSource?(input:BountifulActivityOriginalIdentity):Promise<BountifulActivityOriginalBook>
  loadBountifulPluginSpellAbilityOriginalSource?(input:BountifulPluginSpellAbilityOriginalIdentity):Promise<BountifulPluginSpellAbilityOriginalBook>
  loadBountifulPluginSpellSavingOriginalSource?(input:BountifulPluginSpellSavingOriginalIdentity):Promise<BountifulPluginSpellSavingOriginalBook>
  loadBountifulPluginSpellCompoundPrimarySource?(input:BountifulPluginSpellSavingOriginalIdentity):Promise<import('./dnd5ePluginSpellCompoundPrimaryTransport').BountifulPluginSpellCompoundPrimaryBook>
  requestSharedStormFurySaving?(operation:'prepare'|'inspect'|'dice'|'read',payload:unknown):Promise<Record<string,unknown>>
  requestSharedTempestuousLandingOriginal?(operation:'prepare'|'inspect'|'dice'|'read',payload:unknown):Promise<Record<string,unknown>>
  requestSharedPluginTempestuousSavingOwned?(operation:'read'|'claim',payload:unknown):Promise<Record<string,unknown>>
  requestSharedPluginTempestuousOriginal?(operation:'prepare'|'read'|'probe'|'publication'|'inputs-read'|'inputs-start'|'inputs-record'|'inputs-save-start'|'saving-read'|'saving-begin'|'saving-append'|'saving-answer'|'saving-complete'|'saving-material-read'|'saving-material',payload:unknown):Promise<Record<string,unknown>>
  requestSharedPluginTempestuousLandingOriginal?(operation:'prepare'|'inspect'|'read'|'dice',payload:unknown):Promise<Record<string,unknown>>
  requestSharedTempestuousHostOriginal?(operation:'begin'|'read'|'cancel'|'spell-window-prefix',payload:unknown):Promise<Record<string,unknown>>
  requestSharedMastermindWardAttack?<T>(operation:'issue'|'answer'|'project'|'list',input:unknown):Promise<T>
  requestSharedMastermindWardOriginal?<T>(operation:'register'|'request'|'raw'|'confirm'|'complete'|'abort-extra',input:unknown):Promise<T>
  requestSharedMastermindWardSavingChoice?<T>(operation:'register'|'request'|'list'|'answer'|'raw'|'confirm'|'complete',input:unknown):Promise<T>
  /** Optional transport capability for authoritative long-casting ownership leases. */
  sendLongCastingOwnerCommand?(
    roomId: string, memberId: string, command: unknown, signal: AbortSignal,
  ): Promise<{ status: number; body: Record<string, unknown> }>
  getRevisionWatermark(name: string): number
  loadResource<T>(name: string): Promise<T | null>
  saveResource<T>(name: string, data: T, options?: SharedResourceWriteOptions): Promise<void>
  saveResourceWithResult<T>(name: string, data: T, options?: SharedResourceWriteOptions): Promise<SharedResourceSaveResult>
  saveResourcesAtomically(
    writes: readonly SharedResourceTransactionWrite[],
    options?: SharedResourceWriteOptions & { transactionId?: string },
  ): Promise<SharedResourceTransactionResult>
  appendPlayerActionRequest<T>(action: T): Promise<void>
  submitPlayerCharacterCommand(
    command: Record<string, unknown> & { commandId: string },
  ): Promise<{ revision: number; result: Record<string, unknown> }>
  loadDmUndoHistory(): Promise<DmUndoTransactionSummary[]>
  undoDmTransaction(transactionId?: string): Promise<{
    transaction: DmUndoTransactionSummary
    restored: Array<{ resource: string; revision: number }>
  }>
  recoverDmCombatToTransaction(transactionId: string): Promise<DmCombatRecoveryResult>
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
