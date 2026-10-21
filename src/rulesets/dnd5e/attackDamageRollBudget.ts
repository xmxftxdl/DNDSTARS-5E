import type { Dnd5eCombatEvent } from './headlessCombatEngine'
import type { Dnd5eDamageType } from './damageTypes'
import type { Dnd5eActivityCapabilityProposal, Dnd5eActivityCheckResult } from './activities/dnd5eActivityExecutor'

export interface Dnd5eWeaponDamageRollBudget { claimed: boolean }
/** Host transaction-local only; never serialized or accepted from player requests. */
export const dnd5eAttackDamageRollBudgets = new WeakMap<Dnd5eCombatEvent, Dnd5eWeaponDamageRollBudget>()

/** Preserve explicit outcome/check ownership, including a joint outcome owning several checks. */
export function dnd5eActivityAttackDamageRollBudgets(
  checks: readonly Dnd5eActivityCheckResult[],
  proposals: readonly Dnd5eActivityCapabilityProposal[],
): Map<string, { budget: Dnd5eWeaponDamageRollBudget; damageType?: Dnd5eDamageType }> {
  const result = new Map(checks.filter(check => check.kind === 'attack-roll' && check.targetId != null)
    .map(check => [check.key, { budget: { claimed: false } } as { budget: Dnd5eWeaponDamageRollBudget; damageType?: Dnd5eDamageType }]))
  for (const proposal of proposals) {
    if (proposal.kind !== 'deal-damage' || !proposal.attackDamage) continue
    const candidates = checks.filter(check => check.kind === 'attack-roll' && check.success && check.targetId === proposal.targetId)
    if (!proposal.attackCheckKeys?.length) {
      // An older proposal cannot prove which attack owned a pool. Do not grant
      // another bonus from this missing provenance or infer a parent damage type.
      for (const check of candidates) result.get(check.key)!.budget.claimed = true
      continue
    }
    const owned = candidates.filter(check => proposal.attackCheckKeys!.includes(check.key)).map(check => result.get(check.key)!)
    if (!owned.length) continue
    const previous = new Set(owned.map(entry => entry.budget))
    const shared = owned[0].budget
    shared.claimed = [...previous].some(budget => budget.claimed) ||
      proposal.diceAudit?.some(die => die.count > 0 && die.values.length > 0) === true ||
      proposal.damageSource === 'grant-source'
    // Transitive joint outcomes must retain one identity across all their checks.
    for (const entry of result.values()) if (previous.has(entry.budget)) entry.budget = shared
    for (const entry of owned) entry.damageType ??= proposal.damageType
  }
  return result
}
