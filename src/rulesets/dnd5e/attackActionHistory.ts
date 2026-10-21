/** Host-owned history of one Attack action, separate from the turn's attack counter. */
export interface Dnd5eAttackActionHistory {
  turnKey: string
  actionOrdinal: number
  attacksTaken: number
  creatureTargetIds: string[]
  restricted: boolean
  /** Conditional bonus attacks spent across all Attack actions in this turn. */
  bonusAttacksTakenThisTurn?: number
  usedDistinctTargetBonusFeatureIds?: string[]
}

export function advanceDnd5eAttackActionHistory(
  previous: Dnd5eAttackActionHistory | undefined,
  input: { turnKey: string; startsAction: boolean; targetId: string; creature: boolean; restricted: boolean },
): Dnd5eAttackActionHistory | undefined {
  const current = previous?.turnKey === input.turnKey ? previous : undefined
  if (!input.startsAction && !current) return undefined
  const history: Dnd5eAttackActionHistory = input.startsAction
    ? { turnKey: input.turnKey, actionOrdinal: (current?.actionOrdinal ?? 0) + 1,
        attacksTaken: 0, creatureTargetIds: [], restricted: input.restricted,
        bonusAttacksTakenThisTurn: current?.bonusAttacksTakenThisTurn ?? 0 }
    : { ...current!, creatureTargetIds: [...current!.creatureTargetIds],
        usedDistinctTargetBonusFeatureIds: current!.usedDistinctTargetBonusFeatureIds
          ? [...current!.usedDistinctTargetBonusFeatureIds] : undefined }
  history.attacksTaken++
  if (input.creature && !history.creatureTargetIds.includes(input.targetId))
    history.creatureTargetIds.push(input.targetId)
  return history
}

export function canUseDnd5eDistinctTargetBonusAttack(history: Dnd5eAttackActionHistory | undefined,
  input: { turnKey: string; featureId: string; targetId?: string; minimumDistinctTargets: number }): boolean {
  return !!history && history.turnKey === input.turnKey && !history.restricted &&
    Number.isSafeInteger(input.minimumDistinctTargets) && input.minimumDistinctTargets >= 2 &&
    history.creatureTargetIds.length >= input.minimumDistinctTargets &&
    (input.targetId == null || !history.creatureTargetIds.includes(input.targetId)) &&
    !history.usedDistinctTargetBonusFeatureIds?.includes(input.featureId)
}

export function dnd5eOrdinaryAttacksUsed(history: Dnd5eAttackActionHistory | undefined, turnKey: string | undefined, attacksUsed: number): number {
  const bonus = turnKey && history?.turnKey === turnKey ? history.bonusAttacksTakenThisTurn ?? 0 : 0
  if (!Number.isSafeInteger(bonus) || bonus < 0 || bonus > attacksUsed) return NaN
  return attacksUsed - bonus
}
