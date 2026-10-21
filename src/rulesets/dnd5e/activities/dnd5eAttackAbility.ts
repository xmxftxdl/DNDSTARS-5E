import type { AbilityKey } from '../../../lib/dnd'
import type { Dnd5eFormulaV1 } from './dnd5eFormula'

/** Only unambiguous additive attack formulas identify an ability. Flat bonuses,
 * unknown references, and competing ability formulas do not guess from stats. */
export function dnd5eActivityAttackAbility(formula: Dnd5eFormulaV1, spellcastingAbility?: AbilityKey): AbilityKey | undefined {
  const abilities = new Set<AbilityKey>()
  const visit = (node: Dnd5eFormulaV1): boolean => {
    if (node.kind === 'constant') return true
    if (node.kind === 'add') return node.values.every(visit)
    if (node.kind !== 'reference') return false
    if (node.reference.kind === 'actor-proficiency-bonus') return true
    if (node.reference.kind === 'actor-ability-modifier') {
      abilities.add(node.reference.ability); return true
    }
    if (node.reference.kind === 'actor-spell-attack-bonus' || node.reference.kind === 'actor-spellcasting-ability-modifier') {
      if (!spellcastingAbility) return false
      abilities.add(spellcastingAbility); return true
    }
    return false
  }
  return visit(formula) && abilities.size === 1 ? [...abilities][0] : undefined
}
