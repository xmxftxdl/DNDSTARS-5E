import type { SharedRoomGatewayPort } from '../../../ports/sharedRoomGateway'
import type { BattleMap } from '../../../store/maps'
import type { Character } from '../../../types/character'
import { applyDnd5eActivityMapHandoffsV1 } from './dnd5eActivityMapInteraction'
import { settleDnd5eDelayedSummonsAtWorldSecond } from './dnd5eDelayedSummonQueue'

type Versioned = { _sync?: { revision?: number } }

/** Read and commit one authoritative clock snapshot; never publish an optimistic spawn. */
export async function commitDnd5eExplorationSummons(
  gateway: Pick<SharedRoomGatewayPort, 'loadResource' | 'saveResourcesAtomically'>,
  isCurrent: () => boolean = () => true,
): Promise<boolean> {
  const [mapsState, charactersState, clock, combat] = await Promise.all([
    gateway.loadResource<Versioned & { maps: BattleMap[]; selectedId?: string }>('maps'),
    gateway.loadResource<Versioned & { characters: Character[]; selectedId?: string }>('characters'),
    gateway.loadResource<Versioned & { worldMinute: number; worldSecondRemainder?: number }>('campaign-time'),
    gateway.loadResource<Versioned & { active?: boolean; mapId?: string }>('combat'),
  ])
  if (!mapsState || !charactersState || !clock || !isCurrent()) return false
  const second = clock.worldMinute * 60 + (clock.worldSecondRemainder ?? 0)
  if (!Number.isSafeInteger(second) || second < 0) throw Error('invalid-exploration-summon-clock')
  const maps = [...mapsState.maps]
  let characters: readonly Character[] = charactersState.characters
  let changed = false
  for (let index = 0; index < maps.length; index++) {
    const map = maps[index]
    if (combat?.active && combat.mapId === map.id) continue
    const settled = settleDnd5eDelayedSummonsAtWorldSecond({map, characters, worldSecond:second,
      sourceLimitMaps:maps, apply:applyDnd5eActivityMapHandoffsV1})
    if (settled.map === map) continue
    changed = true
    maps[index] = settled.map
    for (const result of settled.results) if (result.ok && result.boundCharacters) characters = result.boundCharacters
  }
  if (!changed || !isCurrent()) return false
  const revision = (state:Versioned|null) => state?._sync?.revision ?? 0
  const charactersChanged = JSON.stringify(characters) !== JSON.stringify(charactersState.characters)
  await gateway.saveResourcesAtomically([
    {name:'maps',data:{...mapsState,maps,updatedAt:Date.now()},expectedRevision:revision(mapsState)},
    ...(charactersChanged ? [{name:'characters',data:{...charactersState,characters,updatedAt:Date.now()},expectedRevision:revision(charactersState)}] : []),
  ], {readRevisions:{combat:revision(combat),'campaign-time':revision(clock),
    ...(!charactersChanged?{characters:revision(charactersState)}:{})},undoLabel:'结算探索延迟召唤'})
  return true
}
