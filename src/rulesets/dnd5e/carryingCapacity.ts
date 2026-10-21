import { dnd5eActiveCarryingCapacityMultiplier, dnd5eActiveSizeRankDelta, type Dnd5eActiveEffectInstance } from './activeEffects'

export function dnd5eCarryingCapacityPounds(strength: number, permanentMultiplier = 1, effects?: readonly Dnd5eActiveEffectInstance[]): number {
  return Math.max(1, Math.floor(strength)) * 15 * permanentMultiplier * dnd5eActiveCarryingCapacityMultiplier(effects)
}

export interface Dnd5eCarriedLoadOwner {
  sizeRank?: number
  carriedWeightLb?: number
  carryingCapacityMultiplier?: number
  abilities?: { str: number }
  classState?: { activeEffects?: readonly Dnd5eActiveEffectInstance[] }
}

/** Host-captured inventory weight; current strength and temporary capacity remain dynamic. */
export function dnd5eCarriedLoadPreventsMovement(owner: Dnd5eCarriedLoadOwner): boolean {
  return owner.carriedWeightLb != null && owner.carriedWeightLb > dnd5eCarriedLoadCapacityPounds(owner)
}

export function dnd5eCarriedLoadCapacityPounds(owner:Dnd5eCarriedLoadOwner):number {
  const rank=Math.max(0,Math.min(5,(owner.sizeRank??2)+dnd5eActiveSizeRankDelta(owner.classState?.activeEffects)))
  const sizeMultiplier=rank===0?0.5:rank<=2?1:2**(rank-2)
  return dnd5eCarryingCapacityPounds(owner.abilities?.str??10,(owner.carryingCapacityMultiplier??1)*sizeMultiplier,owner.classState?.activeEffects)
}
