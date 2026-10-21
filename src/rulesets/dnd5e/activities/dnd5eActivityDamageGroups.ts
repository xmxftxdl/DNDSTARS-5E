import { DND5E_DAMAGE_TYPES } from '../damageTypes'
import type { Dnd5eDamageType } from '../damageTypes'
import type { Dnd5eFormulaDiceEvidenceV1 } from './dnd5eFormula'
import type { Dnd5eActivityCapabilityProposal } from './dnd5eActivityExecutor'

export interface Dnd5eActivityDamageComponent {
  operationId: string
  amount: number
  damageType: Dnd5eDamageType
  diceAudit?: readonly Dnd5eFormulaDiceEvidenceV1[]
  formulaAdjustment?: number
}

/** Keep one occurrence atomic; never merge across intervening effects or targets. */
export function groupDnd5eActivityDamageProposals(proposals: readonly Dnd5eActivityCapabilityProposal[]): Dnd5eActivityCapabilityProposal[] {
  const result: Dnd5eActivityCapabilityProposal[] = []
  for (let index = 0; index < proposals.length; index++) {
    const first = proposals[index]
    if (first.kind !== 'deal-damage' || !first.damageGroup) { result.push(first); continue }
    const components: Dnd5eActivityDamageComponent[] = []
    const signature = (p: typeof first) => JSON.stringify([p.targetId, p.damageGroup, p.magical, p.magicalOverride,
      p.damageSource, p.cannotBeReduced, p.destroysBodyOnDeath, p.destroysBodyPartOnDeath, p.attackDamage, p.attackCheckKeys])
    const add = (p: typeof first) => components.push({ operationId: p.operationId, amount: p.amount,
      damageType: p.damageType, diceAudit: p.diceAudit, formulaAdjustment: p.formulaAdjustment })
    add(first)
    while (index + 1 < proposals.length) {
      const next = proposals[index + 1]
      if (next.kind !== 'deal-damage' || next.damageGroup?.id !== first.damageGroup.id) break
      if (signature(next) !== signature(first)) throw Error('activity-damage-group-incompatible-components')
      add(next); index++
    }
    if (components.length < 2 || components.length > 16) throw Error('activity-damage-group-component-count')
    result.push({ ...first, damageComponents: components })
  }
  return result
}

/** Validate Host capability packets before any resource or HP mutation. */
export function validDnd5eActivityDamageGroup(components: readonly Dnd5eActivityDamageComponent[] | undefined, multiplier: unknown): boolean {
  if (!components) return multiplier == null
  return Array.isArray(components) && components.length >= 2 && components.length <= 16 &&
    (multiplier === 0.5 || multiplier === 1) &&
    components.every(part => part && typeof part.operationId === 'string' && /^[a-z0-9][a-z0-9._:-]{0,255}$/.test(part.operationId) &&
      Number.isInteger(part.amount) && part.amount >= 0 && part.amount <= 1_000_000 && DND5E_DAMAGE_TYPES.includes(part.damageType)) &&
    new Set(components.map(part => part.operationId)).size === components.length
}
