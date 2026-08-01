import type { Token } from '../store/maps'
import {
  getDnd5eSrdMonster,
  getDnd5eSrdMonsterBySlug,
} from '../rulesets/dnd5e/monsters'
import { dnd5eMonsterActionAutomation } from '../rulesets/dnd5e/monsterSchema'
import {
  buildSelectedEnemyAttack,
  type EnemyTurnResult,
} from './enemyAi'

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

export type Dnd5eMonsterAttackExecutionMode =
  | 'single'
  | 'automatic-sequential-multiattack'
  | 'manual-full-multiattack'

/**
 * A fresh parent Multiattack selected after DM takeover must not enter the AI
 * continuation loop: that loop intentionally stops whenever automation is
 * disabled. Resolve the complete manually selected parent transaction instead.
 */
export function dnd5eMonsterAttackExecutionMode(input: {
  actionKind?: string
  manualControl: boolean
  hasContinuationStep: boolean
}): Dnd5eMonsterAttackExecutionMode {
  if (input.actionKind !== 'multiattack' || input.hasContinuationStep) {
    return 'single'
  }
  return input.manualControl
    ? 'manual-full-multiattack'
    : 'automatic-sequential-multiattack'
}

/**
 * Projects the authoritative Headless continuation receipt into a small DM UI
 * descriptor. The receipt is deliberately stored on the monster combat state:
 * taking over the AI must not turn the already-spent parent action into a new
 * action, nor discard its unresolved child attacks.
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
