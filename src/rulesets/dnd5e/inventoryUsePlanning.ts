import type { Character } from '../../types/character'
import type { Dnd5eInventoryEntry } from '../../types/inventory'
import { dnd5eExpendedSpellSlotLevels } from './items'

export type Dnd5eInventoryUsePlan =
  | { ok: true; spellSlotLevel?: number }
  | { ok: false; reason: 'no-expended-spell-slot' }

/** UI surfaces consume this plan without branching on individual item identities. */
export function planDnd5eInventoryUse(
  character: Character,
  entry: Dnd5eInventoryEntry,
): Dnd5eInventoryUsePlan {
  if (entry.item.use?.effect.kind !== 'spell-slot-recovery') return { ok: true }
  const spellSlotLevel = dnd5eExpendedSpellSlotLevels(
    character,
    entry.item.use.effect.maximumSlotLevel,
  ).at(-1)
  return spellSlotLevel == null
    ? { ok: false, reason: 'no-expended-spell-slot' }
    : { ok: true, spellSlotLevel }
}
