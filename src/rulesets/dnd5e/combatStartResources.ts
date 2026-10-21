import { interruptDnd5eInventoryExchangeRitual } from './inventoryExchangeRitualState'
import type { Character } from '../../types/character'
import { restoreClassResources } from '../../lib/classResources'
import { applyDnd5eInitiativeResourceFeatures } from './classes'

/** Call only at the authoritative start of a new combat for participating characters.
 * Rebuilding a combat snapshot or advancing a turn must not grant these resources. */
export function recoverDnd5eCombatStartResources(character: Character): Character {
  if (character.rulesetId !== 'dnd5e-2014-srd-5.1') return character
  return applyDnd5eInitiativeResourceFeatures(restoreClassResources(interruptDnd5eInventoryExchangeRitual(character), 'combat'))
}
