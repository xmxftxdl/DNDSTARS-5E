import type { BattleMap } from '../../store/maps'

/** Reads Host-owned creation provenance, never the current controller or side. */
export function dnd5eIsSourceSpellSummon(map: BattleMap | undefined, sourceId: string, targetId: string): boolean {
  const source = map?.tokens.find(token => token.id === sourceId)
  const summon = map?.tokens.find(token => token.id === targetId)?.dnd5eSummon
  if (!source || !summon?.sourceSpellId?.trim()) return false
  return summon.sourceTokenId === sourceId ||
    (!!source.characterId && summon.sourceCharacterId === source.characterId)
}
