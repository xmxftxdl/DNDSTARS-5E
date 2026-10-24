import type { TurnEconomy } from '../contracts'

// Preserve usage restrictions, not expiring effects, when resuming a suspended turn.
const interruptedUsageKeys = ['graspOfHadarTurnKey', 'sneakAttackTurnKey', 'colossusSlayerTurnKey', 'divineStrikeTurnKey',
  'foeSlayerTurnKey', 'rageAttackMarkUsedTurnKey', 'meleeWeaponDamageRerollTurnKey',
  'hordeBreakerUsedTurnKey', 'extraActionTeleportUsedTurnKey', 'bonusActionSpellTurnKey',
  'leveledSpellTurnKey'] as const
export type Dnd5eInterruptedTurnUsage = Partial<Record<typeof interruptedUsageKeys[number], string>>
export function captureDnd5eInterruptedTurnUsage(state: Dnd5eInterruptedTurnUsage, turnKey: string): Dnd5eInterruptedTurnUsage {
  const result: Dnd5eInterruptedTurnUsage = {}
  for (const key of interruptedUsageKeys) if (state[key] === turnKey) result[key] = turnKey
  return result
}
export function restoreDnd5eInterruptedTurnUsage(state: Dnd5eInterruptedTurnUsage, saved: Dnd5eInterruptedTurnUsage | undefined, resumedTurnKey: string): void {
  for (const key of interruptedUsageKeys) if (saved?.[key] != null) state[key] = resumedTurnKey
}

/** Values must come from the final Host damage packet, after defenses and THP. */
export interface Dnd5eZeroHitPointTurnTrigger {
  hitPointsBefore: number
  hitPointsAfter: number
  maximumHitPoints: number
  hitPointDamage: number
  remainingDamageAfterZero: number
  dead: boolean
  reactionAvailable: boolean
  reactionsPrevented: boolean
  incapacitatedBeforeDamage: boolean
  featureEligible: boolean
  remainingUses: number
}

export function canTriggerDnd5eZeroHitPointTurn(input: Dnd5eZeroHitPointTurnTrigger): boolean {
  const amounts = [input.hitPointsBefore, input.hitPointsAfter, input.maximumHitPoints,
    input.hitPointDamage, input.remainingDamageAfterZero, input.remainingUses]
  if (amounts.some(value => !Number.isFinite(value) || value < 0)) return false
  return input.featureEligible && !input.dead && !input.incapacitatedBeforeDamage &&
    input.reactionAvailable && !input.reactionsPrevented && input.remainingUses >= 1 &&
    input.hitPointsBefore > 0 && input.hitPointsAfter === 0 && input.maximumHitPoints > 0 &&
    input.hitPointDamage >= input.hitPointsBefore &&
    input.remainingDamageAfterZero < input.maximumHitPoints
}

/** Initiative-only plans; callers own turn lifecycle events and resource checks. */
export interface Dnd5eInterruptibleInitiative {
  combatId: string
  round: number
  initiativeOrder: readonly string[]
  initiativeIndex: number
  initiativeSlotIds?: readonly string[]
  oneShotInitiativeSlotIds?: readonly string[]
}

export interface Dnd5eInterruptedTurnReceipt {
  schemaVersion: 1
  combatId: string
  round: number
  actorId: string
  interruptedActorId: string
  interruptedSlotId: string
  extraSlotId: string
}

/** Kept independently of consciousness so death does not lose the paused turn. */
export interface Dnd5eInterruptedTurnResume {
  receipt: Dnd5eInterruptedTurnReceipt
  economy: TurnEconomy
  turnStartResolvedTurnKey?: string
  nativeUsage?: Dnd5eInterruptedTurnUsage
  attackProgress?: {
    weaponAttackActionTurnKey?: string
    attacksMadeTurnKey?: string
    attacksMadeThisTurn?: number
    meleeAttackTargetIdsThisTurn?: string[]
    usedFeatureTurnKeys: Record<string, string>
  }
}

export function planDnd5eInterruptingTurn(
  state: Dnd5eInterruptibleInitiative,
  actorId: string,
  transactionId: string,
): { initiative: Dnd5eInterruptibleInitiative; receipt: Dnd5eInterruptedTurnReceipt } | undefined {
  const interruptedActorId = state.initiativeOrder[state.initiativeIndex]
  if (!interruptedActorId || !state.initiativeOrder.includes(actorId) || !transactionId.trim() ||
    !Number.isInteger(state.initiativeIndex) || state.initiativeIndex < 0 ||
    !Number.isInteger(state.round) || state.round < 1) return undefined
  if (state.initiativeSlotIds && state.initiativeSlotIds.length !== state.initiativeOrder.length) return undefined
  const slots = state.initiativeSlotIds ? [...state.initiativeSlotIds]
    : state.initiativeOrder.map((id, index) => `${id}:base:${index}`)
  if (new Set(slots).size !== slots.length) return undefined
  const interruptedSlotId = slots[state.initiativeIndex]
  const extraSlotId = `interrupting-turn:${encodeURIComponent(state.combatId)}:${encodeURIComponent(transactionId)}`
  if (slots.includes(extraSlotId) || state.oneShotInitiativeSlotIds?.includes(extraSlotId)) return undefined
  const index = state.initiativeIndex
  return {
    receipt: { schemaVersion: 1, combatId: state.combatId, round: state.round, actorId,
      interruptedActorId, interruptedSlotId, extraSlotId },
    initiative: { ...state,
      initiativeOrder: [...state.initiativeOrder.slice(0, index), actorId, ...state.initiativeOrder.slice(index)],
      initiativeSlotIds: [...slots.slice(0, index), extraSlotId, ...slots.slice(index)],
      oneShotInitiativeSlotIds: [...new Set([...(state.oneShotInitiativeSlotIds ?? []), extraSlotId])],
    },
  }
}

/** Restore the interrupted slot's budget, keeping reactions spent/reset since capture. */
export function restoreDnd5eInterruptedTurnEconomy(
  captured: TurnEconomy,
  current: TurnEconomy,
): TurnEconomy {
  return { ...captured, reactionAvailable: current.reactionAvailable }
}

export function planDnd5eResumeInterruptedTurn(
  state: Dnd5eInterruptibleInitiative,
  receipt: Dnd5eInterruptedTurnReceipt,
): Dnd5eInterruptibleInitiative | undefined {
  const index = state.initiativeIndex
  const slots = state.initiativeSlotIds
  if (receipt.schemaVersion !== 1 || state.combatId !== receipt.combatId || state.round !== receipt.round ||
    !slots || slots.length !== state.initiativeOrder.length ||
    slots[index] !== receipt.extraSlotId || state.initiativeOrder[index] !== receipt.actorId ||
    slots[index + 1] !== receipt.interruptedSlotId || state.initiativeOrder[index + 1] !== receipt.interruptedActorId ||
    !state.oneShotInitiativeSlotIds?.includes(receipt.extraSlotId)) return undefined
  return { ...state,
    initiativeOrder: state.initiativeOrder.filter((_, i) => i !== index),
    initiativeSlotIds: slots.filter((_, i) => i !== index),
    oneShotInitiativeSlotIds: state.oneShotInitiativeSlotIds.filter(slot => slot !== receipt.extraSlotId),
  }
}
