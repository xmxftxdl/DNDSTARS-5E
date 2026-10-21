/** Data held by one persistent Effect instance, not a character-wide resource. */
export interface Dnd5eEffectGrantCharges {
  current: number
  maximum: number
  endWhenEmpty: true
  lightTiers?: readonly {
    minimumRemaining: number
    brightRadiusFeet: number
    dimRadiusFeet: number
    color: string
  }[]
}

export interface Dnd5eEffectGrantChargeDeclaration {
  initial: number
  baseCastLevel?: number
  additionalPerSlotLevel?: number
  endWhenEmpty: true
  lightTiers?: Dnd5eEffectGrantCharges['lightTiers']
}

const integer = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max

/** Reject corrupt saved budgets rather than replenish or guess their counts. */
export function normalizeDnd5eEffectGrantCharges(value: unknown): Dnd5eEffectGrantCharges | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const input = value as Dnd5eEffectGrantCharges
  if (!integer(input.maximum, 1, 1000) || !integer(input.current, 0, input.maximum) || input.endWhenEmpty !== true) return undefined
  if (input.lightTiers != null && (!Array.isArray(input.lightTiers) || !input.lightTiers.length || input.lightTiers.length > 16 ||
    input.lightTiers.some(tier => !tier || !integer(tier.minimumRemaining, 1, input.maximum) ||
      !integer(tier.brightRadiusFeet, 0, 10000) || !integer(tier.dimRadiusFeet, 0, 10000) ||
      tier.brightRadiusFeet + tier.dimRadiusFeet === 0 || !/^#[0-9a-f]{6}$/i.test(tier.color)) ||
    new Set(input.lightTiers.map(tier => tier.minimumRemaining)).size !== input.lightTiers.length)) return undefined
  return { current: input.current, maximum: input.maximum, endWhenEmpty: true,
    ...(input.lightTiers ? { lightTiers: input.lightTiers.map(tier => ({ ...tier })).sort((a,b) => b.minimumRemaining-a.minimumRemaining) } : {}) }
}

export function createDnd5eEffectGrantCharges(declaration: Dnd5eEffectGrantChargeDeclaration,
  castLevel?: number): Dnd5eEffectGrantCharges | undefined {
  if (!integer(declaration.initial, 1, 1000) || declaration.endWhenEmpty !== true) return undefined
  const scaled = declaration.baseCastLevel != null || declaration.additionalPerSlotLevel != null
  if (scaled && (!integer(declaration.baseCastLevel, 1, 9) || !integer(declaration.additionalPerSlotLevel, 1, 1000) ||
    !integer(castLevel, declaration.baseCastLevel, 9))) return undefined
  const maximum = declaration.initial + (scaled ? (castLevel! - declaration.baseCastLevel!) * declaration.additionalPerSlotLevel! : 0)
  return normalizeDnd5eEffectGrantCharges({ current: maximum, maximum, endWhenEmpty: true, lightTiers: declaration.lightTiers })
}

/** The caller commits this result with the attack, on hit or miss alike.
 * This helper never changes the owning Effect's source or expiry. */
export function spendDnd5eEffectGrantCharge(value: Dnd5eEffectGrantCharges, cost = 1):
  { ok: false } | { ok: true; charges: Dnd5eEffectGrantCharges; endEffect: boolean } {
  const charges = normalizeDnd5eEffectGrantCharges(value)
  if (!charges || !integer(cost, 1, 1000) || charges.current < cost) return { ok: false }
  charges.current -= cost
  return { ok: true, charges, endEffect: charges.current === 0 }
}

export function dnd5eEffectGrantChargeLight(value: Dnd5eEffectGrantCharges) {
  const charges = normalizeDnd5eEffectGrantCharges(value)
  const tier = charges?.current ? charges.lightTiers?.find(tier => charges.current >= tier.minimumRemaining) : undefined
  return tier ? { brightRadiusFeet: tier.brightRadiusFeet, dimRadiusFeet: tier.dimRadiusFeet, color: tier.color } : undefined
}
