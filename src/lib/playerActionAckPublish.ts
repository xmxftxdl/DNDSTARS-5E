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

export interface PlayerActionAuthoritativeSnapshots {
  characters: Character[]
  characterSelectedId?: string | null
  maps: BattleMap[]
  mapSelectedId?: string | null
  updatedAt: number
  combat?: SharedCombatState
  mapGeometry?: SharedMapGeometryState
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
  publishAck: (ack: SharedPlayerActionAckState) => Promise<void>
}

export async function publishPlayerActionAckWithSnapshots({
  ack,
  snapshots,
  processed,
  roomJournalMutations,
  saveSharedResource,
  commitSharedResources,
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
        ]
      : []
  const writes: SharedResourceTransactionWrite[] = [
    ...authoritativeWrites,
    ...(processed ? [{ name: 'player-action-processed', data: processed }] : []),
    { name: 'player-action-ack', data: ack },
  ]

  if (commitSharedResources) {
    const committed = await commitSharedResources(writes, {
      ...undoOptions,
      transactionId: `player-action:${ack.actionId}`,
      roomJournalMutations,
    })
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
