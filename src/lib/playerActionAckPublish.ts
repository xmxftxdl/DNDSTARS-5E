import type { BattleMap } from '../store/maps'
import type { Character } from '../types/character'
import type {
  SharedCombatState,
  SharedPlayerActionAckState,
  SharedPlayerActionProcessedState,
} from './sharedCombatTypes'
import type {
  SharedResourceSaveResult,
  SharedResourceTransactionWrite,
  SharedResourceWriteOptions,
} from './sharedApi'
import type { RoomJournalMutation } from './roomCommunications'
import type { SharedMapGeometryState } from './mapGeometry'
import type { SharedCampaignTimeState } from './campaignTime'

export interface PlayerActionAuthoritativeSnapshots {
  characters: Character[]
  characterSelectedId?: string | null
  maps: BattleMap[]
  mapSelectedId?: string | null
  updatedAt: number
  combat?: SharedCombatState
  mapGeometry?: SharedMapGeometryState
  campaignTime?: SharedCampaignTimeState
}

export type PlayerActionAckResourceWriter = <T>(
  name: string,
  data: T,
  options?: SharedResourceWriteOptions,
) => Promise<SharedResourceSaveResult>

export interface PublishPlayerActionAckInput {
  ack: SharedPlayerActionAckState
  snapshots?: PlayerActionAuthoritativeSnapshots
  processed?: SharedPlayerActionProcessedState
  roomJournalMutations?: readonly RoomJournalMutation[]
  saveSharedResource: PlayerActionAckResourceWriter
  commitSharedResources?: (
    writes: readonly SharedResourceTransactionWrite[],
    options: SharedResourceWriteOptions & { transactionId?: string },
  ) => Promise<{ revisions?: Record<string, number> }>
  /**
   * Fresh authoritative read used only to disambiguate a lost transaction
   * response. A transport failure can happen after the server has committed;
   * observing the durable ACK prevents a retry from being reported as a
   * failed cast or from spending the same resource twice.
   */
  loadSharedResource?: <T>(name: string) => Promise<T | null>
  publishAck: (ack: SharedPlayerActionAckState) => Promise<void>
}

function isTransientAuthorityTransportFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /failed to fetch|fetch failed|networkerror|network request failed|load failed|shared-state-transaction-(?:unavailable|502|503|504)/i
    .test(message)
}

function sameDurablePlayerActionAck(
  expected: SharedPlayerActionAckState,
  candidate: SharedPlayerActionAckState | null,
): candidate is SharedPlayerActionAckState {
  return candidate != null &&
    candidate.id === expected.id &&
    candidate.actionId === expected.actionId &&
    candidate.mapId === expected.mapId &&
    candidate.status === expected.status
}

function isSingleCombatRevisionConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /^(?:shared-)?state-transaction-conflict(?::[a-z0-9._-]+)*:combat$/i.test(message)
}

function sameCombatSettlementBoundary(
  expected: SharedCombatState,
  candidate: SharedCombatState | null,
): candidate is SharedCombatState {
  return candidate != null &&
    candidate.mapId === expected.mapId &&
    candidate.combatId === expected.combatId &&
    candidate.active === expected.active &&
    candidate.round === expected.round &&
    candidate.initiativeIndex === expected.initiativeIndex &&
    JSON.stringify(candidate.initiativeOrder) === JSON.stringify(expected.initiativeOrder)
}

export async function publishPlayerActionAckWithSnapshots({
  ack,
  snapshots,
  processed,
  roomJournalMutations,
  saveSharedResource,
  commitSharedResources,
  loadSharedResource,
  publishAck,
}: PublishPlayerActionAckInput): Promise<void> {
  const requireSaved = (name: string, result: SharedResourceSaveResult): void => {
    if (result.status === 'saved') return
    throw new Error(`authoritative-resource-save-rejected:${name}:${result.status}`)
  }

  const undoOptions = {
    undoGroupId: `player-action:${ack.actionId}`,
    undoLabel: '结算玩家行动',
  }
  const publishAckBestEffort = async (eventAck: SharedPlayerActionAckState): Promise<void> => {
    try {
      await publishAck(eventAck)
    } catch {
      // The persisted ACK and combat-command receipt are authoritative. Live
      // delivery may wake polling sooner, but can never invalidate a commit.
    }
  }
  const authoritativeWrites: SharedResourceTransactionWrite[] =
    ack.status === 'accepted' && snapshots
      ? [
          { name: 'characters', data: {
            characters: snapshots.characters,
            selectedId: snapshots.characterSelectedId ?? null,
            updatedAt: snapshots.updatedAt,
          } },
          { name: 'maps', data: {
            maps: snapshots.maps,
            selectedId: snapshots.mapSelectedId ?? null,
            updatedAt: snapshots.updatedAt,
          } },
          ...(snapshots.combat
            ? [{ name: 'combat', data: snapshots.combat }]
            : []),
          ...(snapshots.mapGeometry
            ? [{ name: 'map-geometry', data: snapshots.mapGeometry }]
            : []),
          ...(snapshots.campaignTime
            ? [{ name: 'campaign-time', data: snapshots.campaignTime }]
            : []),
        ]
      : []
  const writes: SharedResourceTransactionWrite[] = [
    ...authoritativeWrites,
    ...(processed ? [{ name: 'player-action-processed', data: processed }] : []),
    { name: 'player-action-ack', data: ack },
  ]

  if (commitSharedResources) {
    const transactionOptions = {
      ...undoOptions,
      transactionId: `player-action:${ack.actionId}`,
      roomJournalMutations,
    }
    const observeCommittedAck = async (): Promise<SharedPlayerActionAckState | null> => {
      if (!loadSharedResource) return null
      try {
        const persisted = await loadSharedResource<SharedPlayerActionAckState>('player-action-ack')
        return sameDurablePlayerActionAck(ack, persisted) ? persisted : null
      } catch {
        return null
      }
    }
    let committed: { revisions?: Record<string, number> }
    try {
      committed = await commitSharedResources(writes, transactionOptions)
    } catch (firstError) {
      // A second DM delivery of the same durable request can race the first
      // authority tab/process. In that case this client receives a normal CAS
      // conflict even though the exact action has already committed. Always
      // inspect the durable ACK before classifying the failure; treating this
      // as a failed cast would make the queue replay an already-settled action.
      const alreadyCommitted = await observeCommittedAck()
      if (alreadyCommitted) {
        await publishAckBestEffort(alreadyCommitted)
        return
      }

      // A turn-boundary write can finish immediately before the next player's
      // action reaches the DM. The DM already has that exact round/index in its
      // resolved snapshot, but its shared-resource CAS watermark may still be
      // one revision behind. Refresh and retry only when combat is the sole
      // conflicting resource and the durable initiative boundary is identical;
      // a real turn/order change remains fail-closed.
      let retryAfterCombatRevisionRefresh = false
      if (isSingleCombatRevisionConflict(firstError) && snapshots?.combat && loadSharedResource) {
        const durableCombat = await loadSharedResource<SharedCombatState>('combat').catch(() => null)
        retryAfterCombatRevisionRefresh = sameCombatSettlementBoundary(snapshots.combat, durableCombat)
      }
      if (!retryAfterCombatRevisionRefresh && !isTransientAuthorityTransportFailure(firstError)) {
        throw firstError
      }

      // Retry only transport failures and reuse the exact transaction id and
      // payload. If the first response was merely lost, the second request may
      // conflict; a final durable-ACK read below then proves the first commit.
      if (!retryAfterCombatRevisionRefresh) {
        await new Promise((resolve) => globalThis.setTimeout(resolve, 120))
      }
      try {
        committed = await commitSharedResources(writes, transactionOptions)
      } catch (retryError) {
        const committedDuringRetry = await observeCommittedAck()
        if (committedDuringRetry) {
          await publishAckBestEffort(committedDuringRetry)
          return
        }
        throw retryError
      }
    }
    await publishAckBestEffort(committed.revisions
      ? { ...ack, authorityRevisions: committed.revisions }
      : ack)
    return
  }

  const resources = await Promise.all(writes.slice(0, -1).map((write) =>
    saveSharedResource(write.name, write.data, undoOptions)))
  resources.forEach((result, index) => requireSaved(writes[index].name, result))
  requireSaved('player-action-ack', await saveSharedResource('player-action-ack', ack))
  await publishAckBestEffort(ack)
}
