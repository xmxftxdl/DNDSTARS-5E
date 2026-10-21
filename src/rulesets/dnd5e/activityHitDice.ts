export interface Dnd5eActivityHitDiePool { sides: number; current: number; max: number }

/** Canonical pool IDs cannot resolve to a plugin-created class resource. */
export function dnd5eActivityHitDiePool(pools: readonly Dnd5eActivityHitDiePool[] | undefined, resourceId: string) {
  const match = /^hit-die:d(6|8|10|12)$/.exec(resourceId)
  if (!match) return undefined
  const candidates = pools?.filter(pool => pool.sides === Number(match[1])) ?? []
  if (candidates.length !== 1) return undefined
  const pool = candidates[0]
  return Number.isSafeInteger(pool.current) && Number.isSafeInteger(pool.max) &&
    pool.current >= 0 && pool.max >= pool.current ? pool : undefined
}

export function canSpendDnd5eActivityHitDice(pools: readonly Dnd5eActivityHitDiePool[] | undefined, resourceId: string, amount: number) {
  const pool = dnd5eActivityHitDiePool(pools, resourceId)
  return Number.isSafeInteger(amount) && amount >= 0 && pool != null && pool.current >= amount
}

/** Costs must already be filtered by their Host-resolved consumeOn condition. */
export function canSpendDnd5eActivityHitDiceCosts(pools: readonly Dnd5eActivityHitDiePool[] | undefined,
  costs: readonly { kind: string; resourceId?: string; amount?: number; maximumTotalFraction?: number }[]) {
  const diceCosts = costs.filter(cost => cost.kind === 'hit-die')
  if (!diceCosts.length) return true
  if (!pools || new Set(pools.map(pool => pool.sides)).size !== pools.length ||
    pools.some(pool => !dnd5eActivityHitDiePool(pools, `hit-die:d${pool.sides}`))) return false
  const totals = new Map<string, number>()
  let spent = 0
  for (const cost of diceCosts) {
    if (!canSpendDnd5eActivityHitDice(pools, cost.resourceId ?? '', cost.amount ?? NaN)) return false
    spent += cost.amount!
    totals.set(cost.resourceId!, (totals.get(cost.resourceId!) ?? 0) + cost.amount!)
  }
  const maximum = pools.reduce((sum, pool) => sum + pool.max, 0)
  return [...totals].every(([id, amount]) => canSpendDnd5eActivityHitDice(pools, id, amount)) &&
    diceCosts.every(cost => cost.maximumTotalFraction == null ||
      (Number.isFinite(cost.maximumTotalFraction) && cost.maximumTotalFraction > 0 && cost.maximumTotalFraction <= 1 &&
        spent <= Math.floor(maximum * cost.maximumTotalFraction)))
}
