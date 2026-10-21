import type { SharedRoomGatewayPort } from '../ports/sharedRoomGateway'
import type { BattleMap } from '../store/maps'
import type { Character } from '../types/character'
import type { SharedCampaignTimeState } from './campaignTime'

type Versioned = { _sync?: { revision?: number } }
type Projection = (input: { maps: BattleMap[]; characters: Character[]; clock: SharedCampaignTimeState }) => { maps: BattleMap[]; changed: boolean }

/** Derive timed creature effects from the same snapshots whose revisions we commit. */
export async function commitCampaignTimeCreatureProjection(
  gateway: Pick<SharedRoomGatewayPort, 'loadResource' | 'saveResourcesAtomically'>,
  project: Projection,
  isCurrent: () => boolean,
): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const [maps, characters, clock] = await Promise.all([
      gateway.loadResource<Versioned & { maps: BattleMap[] }>('maps'),
      gateway.loadResource<Versioned & { characters: Character[] }>('characters'),
      gateway.loadResource<Versioned & SharedCampaignTimeState>('campaign-time'),
    ])
    if (!maps || !characters || !clock || !isCurrent()) return false
    const result = project({ maps: maps.maps, characters: characters.characters, clock })
    if (!result.changed || !isCurrent()) return false
    try {
      await gateway.saveResourcesAtomically([
        { name: 'maps', data: { ...maps, maps: result.maps, updatedAt: Date.now() }, expectedRevision: maps._sync?.revision ?? 0 },
      ], { readRevisions: { characters: characters._sync?.revision ?? 0, 'campaign-time': clock._sync?.revision ?? 0 } })
      return true
    } catch (error) {
      // Recompute after CAS rejection; never rebase the old effect payload.
      if (attempt === 2 || !(error instanceof Error) || !error.message.includes('conflict')) throw error
    }
  }
  return false
}
