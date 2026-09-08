import { dnd5eActiveTelepathicBondNetworkKeys } from '../rulesets/dnd5e/activeEffects'
import type { BattleMap } from '../store/maps'
import type { Character } from '../types/character'

export interface Dnd5eTelepathicBondNetwork {
  key: string
  participants: Array<Pick<Character, 'id' | 'name' | 'avatar' | 'roomMemberId'>>
}

/**
 * Builds the communication networks that exist on one map. A map is the
 * tabletop's same-plane boundary; grid distance is deliberately irrelevant.
 */
export function dnd5eTelepathicBondNetworksForMap(
  characters: readonly Character[],
  map: BattleMap | undefined,
): Dnd5eTelepathicBondNetwork[] {
  if (!map) return []
  const characterIds = new Set(map.tokens.flatMap((token) => token.characterId ? [token.characterId] : []))
  const groups = new Map<string, Dnd5eTelepathicBondNetwork['participants']>()
  for (const character of characters) {
    if (!characterIds.has(character.id)) continue
    for (const key of dnd5eActiveTelepathicBondNetworkKeys(character.dnd5eCombatState?.activeEffects)) {
      groups.set(key, [...(groups.get(key) ?? []), {
        id: character.id,
        name: character.name,
        avatar: character.avatar,
        roomMemberId: character.roomMemberId,
      }])
    }
  }
  return [...groups.entries()].flatMap(([key, participants]) =>
    participants.length >= 2 ? [{ key, participants }] : [])
}
