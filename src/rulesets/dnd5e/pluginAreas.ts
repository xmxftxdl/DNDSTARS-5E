import type { BattleMap, Dnd5ePluginArea } from '../../store/maps'
import type { Character } from '../../types/character'

export function reconcileDnd5ePluginAreas(
  areas: readonly Dnd5ePluginArea[] | undefined,
  characters: readonly Character[],
  round: number,
): Dnd5ePluginArea[] {
  const charactersById = new Map(characters.map((character) => [character.id, character]))
  return (areas ?? []).filter((area) => {
    if (round > area.expiresAfterRound) return false
    if (!area.concentrationId) return true
    const source = charactersById.get(area.sourceCharacterId)
    return !!source?.concentrating && source.dnd5eCombatState?.concentrationSpellId === area.concentrationId
  })
}

export function reconcileDnd5ePluginAreasOnMap(
  map: BattleMap,
  characters: readonly Character[],
  round: number,
): BattleMap {
  const next = reconcileDnd5ePluginAreas(map.dnd5ePluginAreas, characters, round)
  if (next.length === (map.dnd5ePluginAreas ?? []).length) return map
  return { ...map, dnd5ePluginAreas: next }
}
