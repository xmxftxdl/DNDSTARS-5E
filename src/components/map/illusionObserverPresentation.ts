import type { BattleMap } from '../../store/maps'

/** Knowledge belongs to an observer, never to the shared token artwork. */
export function illusionRecognizedByViewer(
  map: BattleMap,
  tokenId: string,
  viewerCharacterId: string | undefined,
  isDM: boolean,
): boolean {
  if (isDM || !viewerCharacterId) return false
  const observers = map.tokens.filter(token => token.characterId === viewerCharacterId)
  return (map.dnd5ePluginAreas ?? []).some(area =>
    area.anchorMode === 'effect-token' && area.anchorTokenId === tokenId &&
    observers.some(observer => area.illusionRecognition?.knownTokenIds.includes(observer.id)))
}
