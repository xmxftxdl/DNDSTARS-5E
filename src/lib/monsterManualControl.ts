import type { Token } from '../store/maps'
import {
  dnd5eMonsterAreaSavingThrowEffect,
  dnd5eMonsterRequiredAreaSavingThrowVariantId,
  getDnd5eSrdMonster,
  getDnd5eSrdMonsterBySlug,
} from '../rulesets/dnd5e/monsters'
import { dnd5eMonsterActionAutomation } from '../rulesets/dnd5e/monsterSchema'
import {
  buildSelectedEnemyAttack,
  type EnemyTurnResult,
} from './enemyAi'
import type { Dnd5eTraversalMode } from '../rulesets/dnd5e/traversal'
import { dnd5eLongJumpMaximumFeet } from '../rulesets/dnd5e/traversal'

export type Dnd5eManualMonsterMovementKind =
  | 'move'
  | 'dash'
  | 'disengage'
  | 'nimble-disengage'
  | 'running-jump'
  | 'standing-jump'

export interface Dnd5eManualMonsterMovementIntent {
  kind: Dnd5eManualMonsterMovementKind
  traversalMode: Dnd5eTraversalMode
}

/**
 * Resolves the exact catalog action and staged area variant that a DM is
 * allowed to select right now. Ordered actions such as the Androsphinx Roar
 * derive their next variant from the authoritative remaining-use counter; the
 * UI never asks the DM to choose an illegal later stage.
 */
export function dnd5eManualMonsterActionSelection(
  token: Token | undefined,
  actionIndex: number,
  resourceKind: 'action' | 'bonus-action' = 'action',
) {
  if (!token?.poolId || !Number.isInteger(actionIndex) || actionIndex < 0) {
    return undefined
  }
  const monster =
    getDnd5eSrdMonster(token.poolId) ??
    getDnd5eSrdMonsterBySlug(token.poolId)
  const actions = resourceKind === 'bonus-action'
    ? monster?.bonusActions ?? []
    : monster?.actions ?? []
  const action = actions[actionIndex]
  if (!action) return undefined
  const usesRemaining = token.dnd5eCombatState
    ?.monsterActionUsesByActionId?.[action.id]?.current
  const areaVariantId = dnd5eMonsterRequiredAreaSavingThrowVariantId(
    action,
    usesRemaining,
  )
  const areaEffect = dnd5eMonsterAreaSavingThrowEffect(action, areaVariantId)
  return {
    action,
    areaVariantId,
    areaEffect,
  }
}

/**
 * Converts a presentation action id back to its authoritative catalog index.
 *
 * The monster dock renders translated/presentation actions, while manual
 * settlement indexes the canonical SRD action array.  Those arrays are not a
 * safe positional contract: a presentation adapter may omit or reorder an
 * entry.  Resolve by the stable action id and retain the rendered index only
 * as a compatibility fallback for legacy/custom entries without ids.
 */
export function dnd5eManualMonsterActionIndexById(
  token: Token | undefined,
  actionId: string | undefined,
  fallbackIndex: number,
  resourceKind: 'action' | 'bonus-action' = 'action',
): number {
  if (!token?.poolId || !actionId) return fallbackIndex
  const monster =
    getDnd5eSrdMonster(token.poolId) ??
    getDnd5eSrdMonsterBySlug(token.poolId)
  const actions = resourceKind === 'bonus-action'
    ? monster?.bonusActions ?? []
    : monster?.actions ?? []
  const authoritativeIndex = actions.findIndex((action) => action.id === actionId)
  return authoritativeIndex >= 0 ? authoritativeIndex : fallbackIndex
}

export function dnd5eManualMonsterMovementIntent(
  kind: Dnd5eManualMonsterMovementKind,
): Dnd5eManualMonsterMovementIntent {
  return {
    kind,
    traversalMode: kind === 'running-jump'
      ? 'long-jump-running'
      : kind === 'standing-jump'
        ? 'long-jump-standing'
        : 'walk',
  }
}

export function dnd5eManualMonsterJumpMaximumFeet(
  kind: Dnd5eManualMonsterMovementKind,
  strengthScore: number,
  jumpDistanceMultiplier = 1,
): number | undefined {
  if (kind !== 'running-jump' && kind !== 'standing-jump') return undefined
  return dnd5eLongJumpMaximumFeet(
    strengthScore,
    kind === 'running-jump',
    0,
    jumpDistanceMultiplier,
  )
}

export function dnd5eManualMonsterMovementTargetingFeet(input: {
  kind: Dnd5eManualMonsterMovementKind
  movementRemainingFeet: number
  strengthScore: number
  jumpDistanceMultiplier?: number
}): number {
  const movementRemainingFeet = Math.max(0, input.movementRemainingFeet)
  const jumpMaximumFeet = dnd5eManualMonsterJumpMaximumFeet(
    input.kind,
    input.strengthScore,
    input.jumpDistanceMultiplier,
  )
  return jumpMaximumFeet == null
    ? movementRemainingFeet
    : Math.min(movementRemainingFeet, jumpMaximumFeet)
}

export interface Dnd5eManualMonsterMultiattackContinuation {
  schemaVersion: 1
  parentActionId: string
  parentActionName: string
  occurrenceIndex: number
  occurrenceNumber: number
  occurrenceCount: number
  actionId: string
  actionIndex: number
  actionName: string
}

export type Dnd5eManualMonsterMultiattackContinuationCredential = Pick<
  Dnd5eManualMonsterMultiattackContinuation,
  'schemaVersion' | 'parentActionId' | 'occurrenceIndex' | 'actionId' | 'actionIndex'
>

/**
 * Projects the authoritative Headless continuation receipt into a small DM UI
 * descriptor. The receipt is deliberately stored on the monster combat state
 * so a refresh cannot turn an already-spent parent action into a new action or
 * discard its unresolved child attacks.
 */
export function dnd5eManualMonsterMultiattackContinuation(
  token: Token | undefined,
): Dnd5eManualMonsterMultiattackContinuation | undefined {
  const receipt = token?.dnd5eCombatState?.monsterMultiattackContinuation
  if (!token?.poolId || !receipt || receipt.schemaVersion !== 1) return undefined
  const monster =
    getDnd5eSrdMonster(token.poolId) ??
    getDnd5eSrdMonsterBySlug(token.poolId)
  if (!monster) return undefined
  const parent = monster.actions.find((action) =>
    action.id === receipt.parentActionId && action.kind === 'multiattack')
  const actionId = receipt.sequenceActionIds[receipt.nextOccurrenceIndex]
  const actionIndex = monster.actions.findIndex((action) => action.id === actionId)
  const action = actionIndex >= 0 ? monster.actions[actionIndex] : undefined
  if (
    !parent ||
    !action ||
    !action.attack ||
    dnd5eMonsterActionAutomation(action) !== 'headless' ||
    receipt.nextOccurrenceIndex < 0 ||
    receipt.nextOccurrenceIndex >= receipt.sequenceActionIds.length
  ) return undefined
  return {
    schemaVersion: 1,
    parentActionId: parent.id,
    parentActionName: parent.name,
    occurrenceIndex: receipt.nextOccurrenceIndex,
    occurrenceNumber: receipt.nextOccurrenceIndex + 1,
    occurrenceCount: receipt.sequenceActionIds.length,
    actionId: action.id,
    actionIndex,
    actionName: action.name,
  }
}

export function dnd5eManualMonsterContinuationMatches(
  live: Dnd5eManualMonsterMultiattackContinuation | undefined,
  requested: Dnd5eManualMonsterMultiattackContinuationCredential | undefined,
): boolean {
  return !!live && !!requested &&
    live.schemaVersion === requested.schemaVersion &&
    live.parentActionId === requested.parentActionId &&
    live.occurrenceIndex === requested.occurrenceIndex &&
    live.actionId === requested.actionId &&
    live.actionIndex === requested.actionIndex
}

/** Build one child-attack intent. Headless remains authoritative and consumes
 * the stored receipt only when the exact next occurrence settles successfully. */
export function buildDnd5eManualMonsterContinuationAttack(input: {
  actor: Token
  target: Token
  requested: Dnd5eManualMonsterMultiattackContinuationCredential
}): EnemyTurnResult | undefined {
  const live = dnd5eManualMonsterMultiattackContinuation(input.actor)
  if (!live || !dnd5eManualMonsterContinuationMatches(live, input.requested)) return undefined
  const result = buildSelectedEnemyAttack(
    input.actor,
    input.target,
    input.requested.actionIndex,
    [input.target.id],
  )
  if (!result) return undefined
  return {
    ...result,
    multiattackStep: {
      mode: 'continue',
      parentActionId: input.requested.parentActionId,
      occurrenceIndex: input.requested.occurrenceIndex,
    },
    message: `${input.actor.label} 继续${live.parentActionName}，以${live.actionName}攻击 ${input.target.label}。`,
  }
}
