import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'

/** A zero-HP companion is not necessarily dead. Only a confirmed death releases
 * a unique living bond; dismissal and unknown HP retain it. */
export function dnd5eHasLivingSummonBond(input: {
  maps: readonly BattleMap[]; characters: readonly Character[]
  mapId: string; actor: Token; packageId: string; bondKey: string
}): boolean {
  return input.maps.some(map => map.tokens.some(token => {
    const summon = token.dnd5eSummon
    if (!summon || summon.pluginId !== input.packageId || summon.bondKey !== input.bondKey) return false
    const owned = input.actor.characterId
      ? summon.sourceCharacterId === input.actor.characterId
      : map.id === input.mapId && summon.sourceTokenId === input.actor.id
    if (!owned) return false
    if (token.characterId) {
      const character = input.characters.find(candidate => candidate.id === token.characterId)
      return !character || character.currentHp > 0 || (character.deathSaveFailures ?? 0) < 3
    }
    return (token.hp ?? token.maxHp ?? 1) > 0 || token.dnd5eCombatState?.deathRound == null
  }))
}
