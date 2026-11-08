import type { AbilityKey } from '../../lib/dnd'
import type { Dnd5eActiveEffectEscapeSavingThrow } from './activeEffects'
/** Match the existing best-ability escape UX while retaining both authorized abilities. */
export function escapeSaveAbility(creature:{abilities:Record<AbilityKey,number>;savingThrowBonuses?:Partial<Record<AbilityKey,number>>},save:Dnd5eActiveEffectEscapeSavingThrow):AbilityKey {
  const bonus=(key:AbilityKey)=>creature.savingThrowBonuses?.[key]??Math.floor((creature.abilities[key]-10)/2)
  return save.alternativeAbility && bonus(save.alternativeAbility)>bonus(save.ability)?save.alternativeAbility:save.ability
}
