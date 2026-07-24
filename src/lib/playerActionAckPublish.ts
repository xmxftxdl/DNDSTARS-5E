import type { BattleMap } from '../store/maps'
import type { Character } from '../types/character'
import type { SharedPlayerActionAckState } from './sharedCombatTypes'
import type { SharedCombatState } from './sharedCombatTypes'
import type { SharedResourceSaveResult } from './sharedApi'

export interface PlayerActionAuthoritativeSnapshots {
  characters: Character[]
  characterSelectedId?: string | null
  maps: BattleMap[]
  mapSelectedId?: string | null
  updatedAt: number
  combat?: SharedCombatState
}

export type PlayerActionAckResourceWriter = <T>(name: string, data: T) => Promise<SharedResourceSaveResult>

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
  const requireSaved = (name: string, result: SharedResourceSaveResult): void => {
    if (result.status === 'saved') return
    throw new Error(`authoritative-resource-save-rejected:${name}:${result.status}`)
  }

  if (ack.status === 'accepted' && snapshots) {
    const resources = await Promise.all([
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
      ...(snapshots.combat
        ? [saveSharedResource('combat', snapshots.combat)]
        : []),
    ])
    const resourceNames = snapshots.combat
      ? ['characters', 'maps', 'combat']
      : ['characters', 'maps']
    resources.forEach((result, index) => requireSaved(resourceNames[index], result))
  }

  requireSaved('player-action-ack', await saveSharedResource('player-action-ack', ack))
  await publishAck(ack)
}
