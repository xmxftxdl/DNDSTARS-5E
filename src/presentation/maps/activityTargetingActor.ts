import type { BattleMap } from '../../store/maps'

/** Preview identity only; final authorization stays in the Host transaction. */
export interface MapActivityTargetingActor {
  characterId: string
  dmActor?: { tokenId: string; mapId: string }
}

export function resolveMapActivityTargetingActor(map: BattleMap, session: MapActivityTargetingActor) {
  if (session.dmActor && session.dmActor.mapId !== map.id) return undefined
  return map.tokens.find(token => token.type !== 'obstacle' && (session.dmActor
    ? token.id === session.dmActor.tokenId && !token.characterId
    : token.characterId === session.characterId))
}
