import type { Dnd5ePluginArea, Token } from '../../store/maps'

/** Fixed, source-limited effects already use stable character ownership for their quota. */
export function dnd5eOwnsPersistentArea(area: Dnd5ePluginArea, actor: Token): boolean {
  if (area.sourceCharacterId !== (actor.characterId ?? actor.id)) return false
  if (area.sourceTokenId === actor.id) return true
  return !!actor.characterId && area.anchorMode === 'fixed' && !!area.sourceLimit
}
