import type { Character } from '../../types/character'
import { registeredDnd5ePluginFeatures } from './pluginApi'
import { dnd5eCharacterHasPluginFeature } from './plugins/pluginContentCatalog'
import { dnd5eActiveMaximizeHealingDice } from './activeEffects'
import { dnd5eCompanionContextForCharacter, dnd5eNearbyOwnedCompanions, type Dnd5eOwnedCompanionMapContext } from './ownedCompanionProximity'

/** Out-of-combat healing reads ownership and scene facts at settlement time. */
export function dnd5eCharacterMaximizeHealingDice(character: Character | undefined, context?: Dnd5eOwnedCompanionMapContext): boolean {
  if (!character) return false
  const recipientContext = dnd5eCompanionContextForCharacter(character.id, context)
  return dnd5eActiveMaximizeHealingDice(character.dnd5eCombatState?.activeEffects, recipientContext) ||
    (!!recipientContext && registeredDnd5ePluginFeatures().some(feature =>
      dnd5eCharacterHasPluginFeature(character, feature.id) &&
      feature.staticModifiers?.maximizeHealingDiceNearCompanion?.some(query =>
        dnd5eNearbyOwnedCompanions({ ...recipientContext, query }).length > 0)))
}
