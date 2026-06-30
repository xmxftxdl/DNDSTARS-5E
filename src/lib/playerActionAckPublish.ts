import type { BattleMap } from '../store/maps'
import type { Character } from '../types/character'
import type { SharedPlayerActionAckState } from './sharedCombatTypes'

export interface PlayerActionAuthoritativeSnapshots {
  characters: Character[]
  characterSelectedId?: string | null
  maps: BattleMap[]
  mapSelectedId?: string | null
  updatedAt: number
}

export type PlayerActionAckResourceWriter = <T>(name: string, data: T) => Promise<void>

export interface PublishPlayerActionAckInput {
  ack: SharedPlayerActionAckState
  snapshots?: PlayerActionAuthoritativeSnapshots
  saveSharedResource: PlayerActionAckResourceWriter
  publishAck: (ack: SharedPlayerActionAckState) => Promise<void>
}

export async function publishPlayerActionAckWithSnapshots({
  ack,
  snapshots,
  saveSharedResource,
  publishAck,
}: PublishPlayerActionAckInput): Promise<void> {
  if (ack.status === 'accepted' && snapshots) {
    await Promise.all([
      saveSharedResource('characters', {
        characters: snapshots.characters,
        selectedId: snapshots.characterSelectedId ?? null,
        updatedAt: snapshots.updatedAt,
      }),
      saveSharedResource('maps', {
        maps: snapshots.maps,
        selectedId: snapshots.mapSelectedId ?? null,
        updatedAt: snapshots.updatedAt,
      }),
    ])
  }

  await saveSharedResource('player-action-ack', ack)
  await publishAck(ack)
}
