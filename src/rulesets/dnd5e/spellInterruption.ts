import type { Dnd5eCombatEvent } from './headlessCombatEngine'

/** Post-commit adapters must not create map effects for an interrupted cast. */
export function dnd5eSpellInterrupted(
  events: readonly Dnd5eCombatEvent[],
  casterId: string,
  spellId?: string,
): boolean {
  return events.some((event) =>
    (event.type === 'counterspell-resolved' && event.casterId === casterId &&
      (spellId == null || event.spellId === spellId) && event.success) ||
    (event.type === 'source-action-interrupted' && event.sourceId === casterId &&
      event.actionKind === 'spell-cast' && event.interrupted),
  )
}
