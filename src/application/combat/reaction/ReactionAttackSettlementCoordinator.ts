import type { Dnd5eCombatant, Dnd5eHeadlessCombatState } from '../../../rulesets/dnd5e/headlessCombatEngine'
import { planDnd5eOnHitInventoryEffectDice } from '../../../rulesets/dnd5e/inventoryHeadlessPresentation'

export interface Dnd5eReactionAttackInventorySettlement {
  inventoryEffectRolls?: Readonly<Record<string, readonly number[]>>
  inventoryDamageTotal: number
}

/**
 * Collects presentation dice for Host-eligible on-hit item effects used by a
 * reaction attack. Headless rebuilds the plan, validates every die and
 * consumes item resources atomically during the authoritative transaction.
 */
export async function coordinateDnd5eReactionAttackInventorySettlement(input: {
  state: Dnd5eHeadlessCombatState
  actor: Dnd5eCombatant
  weaponId?: string
  hit: boolean
  critical: boolean
  targetLabel: string
  rollDice(count: number, sides: number, label: string, targetLabel: string): Promise<number[]>
}): Promise<Dnd5eReactionAttackInventorySettlement> {
  if (!input.hit) return { inventoryDamageTotal: 0 }
  const plan = await planDnd5eOnHitInventoryEffectDice({
    state: input.state,
    combatant: input.actor,
    weaponId: input.weaponId,
    critical: input.critical,
    targetLabel: input.targetLabel,
    rollDice: input.rollDice,
  })
  return {
    inventoryEffectRolls: plan.rolls,
    inventoryDamageTotal: plan.previewDamageTotal,
  }
}
