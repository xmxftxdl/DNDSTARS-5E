import type { SharedRoomGatewayPort } from '../ports/sharedRoomGateway'
import type { BattleMap } from '../store/maps'
import type { Character } from '../types/character'
import { createEmptyMapGeometry, type MapGeometryState } from './mapGeometry'
import type { SharedCampaignTimeState } from './campaignTime'
import type { SharedCombatState } from './sharedCombatTypes'
import { dnd5eActivePlanarPhase } from '../rulesets/dnd5e/activeEffects'
import { reconcileDnd5eCharacterCampaignTime } from '../rulesets/dnd5e/campaignTimeRules'

type Versioned = { _sync?: { revision?: number } }
export type EtherealExpirySettlement = (input: {
  map: BattleMap; geometry: MapGeometryState; beforeCharacters: readonly Character[];
  characters: readonly Character[]; combat?: SharedCombatState; worldMinute: number;
}) => Promise<{ map: BattleMap; characters: readonly Character[]; combat?: SharedCombatState }>

/** Publish no expired phase until its map return and any fall have also settled. */
export async function commitCampaignEtherealReturns(
  gateway: Pick<SharedRoomGatewayPort, 'loadResource' | 'saveResourcesAtomically'>,
  settle: EtherealExpirySettlement,
  isCurrent: () => boolean,
): Promise<boolean> {
  const [maps, roster, clock, geometry, combat] = await Promise.all([
    gateway.loadResource<Versioned & { maps: BattleMap[] }>('maps'),
    gateway.loadResource<Versioned & { characters: Character[] }>('characters'),
    gateway.loadResource<Versioned & SharedCampaignTimeState>('campaign-time'),
    gateway.loadResource<Versioned & { maps: MapGeometryState[] }>('map-geometry'),
    gateway.loadResource<Versioned & SharedCombatState>('combat'),
  ])
  if (!isCurrent()) return false
  // A partial read must not fall through to the character-only expiry path.
  if (!maps || !roster || !clock) throw Error('ethereal-expiry-snapshot-unavailable')
  const returning = new Set<string>()
  let characters: readonly Character[] = roster.characters.map(character => {
    if (dnd5eActivePlanarPhase(character.dnd5eCombatState?.activeEffects).plane !== 'ethereal') return character
    const advanced = reconcileDnd5eCharacterCampaignTime(character, clock).character
    if (dnd5eActivePlanarPhase(advanced.dnd5eCombatState?.activeEffects).plane === 'ethereal') return character
    returning.add(character.id)
    return advanced
  })
  if (!returning.size) return false
  const nextMaps = [...maps.maps]
  let nextCombat: SharedCombatState | undefined
  for (const id of returning) {
    if (maps.maps.filter(map => map.tokens.some(token => token.characterId === id)).length !== 1)
      throw Error('ethereal-expiry-map-ambiguous')
  }
  for (let index = 0; index < nextMaps.length; index++) {
    const map = nextMaps[index]
    if (!map.tokens.some(token => token.characterId && returning.has(token.characterId))) continue
    const result = await settle({ map, geometry: geometry?.maps.find(scene => scene.mapId === map.id) ?? createEmptyMapGeometry(map.id),
      beforeCharacters: roster.characters, characters, combat: nextCombat ?? combat ?? undefined, worldMinute: clock.worldMinute })
    if (!isCurrent()) return false
    nextMaps[index] = result.map
    characters = result.characters
    nextCombat = result.combat ?? nextCombat
  }
  const revision = (value: Versioned | null) => value?._sync?.revision ?? 0
  const readRevisions: Record<string, number> = {
    'campaign-time': revision(clock), 'map-geometry': revision(geometry),
  }
  if (!nextCombat) readRevisions.combat = revision(combat)
  await gateway.saveResourcesAtomically([
    { name: 'maps', data: { ...maps, maps: nextMaps }, expectedRevision: revision(maps) },
    { name: 'characters', data: { ...roster, characters }, expectedRevision: revision(roster) },
    ...(nextCombat ? [{ name: 'combat', data: nextCombat, expectedRevision: revision(combat) }] : []),
  ], { readRevisions })
  return true
}
