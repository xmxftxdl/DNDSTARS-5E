import type { Dnd5eHeadlessCombatState } from '../headlessCombatEngine'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import type { Dnd5eExecuteActivityCommandV1 } from './dnd5eActivityCommand'
import type { Dnd5eActivityCheckResult } from './dnd5eActivityExecutor'
import type { Dnd5eFormulaRollResult } from './dnd5eFormula'
import { getRegisteredDnd5eActivity } from './dnd5eActivityRegistry'
import { dnd5eCombatantPairKey } from '../headlessCombatPrimitives'
import { createDnd5eMechanicalEffect } from '../activeEffects'

/** One bounded continuation, whose data and rolls are owned exclusively by Host. */
export interface Dnd5eActivityContinuationDefinitionV1 {
  /** Omit only for a single completed batch followed by a terminal action. */
  nextActivityId?: string
  /** Optional terminal action, available after any step including the last. */
  finishActivityId?: string
  /** A numeric rules limit (1 requires a finisher), or a finite chain that must consume new targets. */
  maximumSteps: number | 'distinct-targets'
  excludePreviousTargets: boolean
  /** Mandatory splash: Host includes every living creature within the previous target radius. */
  requireAllTargetsInRadius?: boolean
  maximumDistanceFromPreviousTargetFeet?: number
  /** All declared gates must pass, e.g. a hit AND a matching pair of dice. */
  requiredSuccessfulCheckId?: string
  when?: { kind: 'check-success'; checkId: string } | { kind: 'equal-dice'; rollId: string; first: number; second: number }
  /** Copies only declared Host dice into named slots in the next stage. */
  carryRolls?: readonly { from: string; to: string }[]
}

export interface Dnd5eActivityContinuationStateV1 {
  id: string
  actorId: string
  packageId: string
  packageVersion: string
  rootActivityId: string
  nextActivityId?: string
  finishActivityId?: string
  turnKey: string
  steps: number
  maximumSteps: number
  /** Host-derived; each stage must add at least one previously unused creature. */
  distinctTargetsOnly?: true
  castLevel?: number
  previousTargetIds: readonly string[]
  visitedTargetIds: readonly string[]
  commandIds: readonly string[]
  rolls: Readonly<Record<string, Dnd5eFormulaRollResult>>
  excludePreviousTargets: boolean
  /** Mandatory splash: Host includes every living creature within the previous target radius. */
  requireAllTargetsInRadius?: boolean
  maximumDistanceFromPreviousTargetFeet?: number
}

function turnKey(state: Dnd5eHeadlessCombatState): string {
  return `${state.combatId}:${state.round}:${state.initiativeSlotIds?.[state.initiativeIndex] ?? state.initiativeIndex}`
}

export function validateDnd5eActivityContinuationV1(activity: Dnd5eActivityDefinitionV1): string[] {
  const errors: string[] = []
  const id = (value: unknown) => typeof value === 'string' && /^[a-z0-9][a-z0-9._:-]{0,159}$/.test(value)
  const rule = activity.continuation
  if (activity.requiresContinuationFrom != null && !id(activity.requiresContinuationFrom)) errors.push('invalid continuation root')
  if (activity.carriedRollIds != null && (!activity.requiresContinuationFrom || !Array.isArray(activity.carriedRollIds) || activity.carriedRollIds.some(value => !id(value)) || activity.carriedRollIds.length > 32)) errors.push('invalid carried roll ids')
  if (!rule) return errors
  const terminalOnly = rule.maximumSteps === 1 && id(rule.finishActivityId)
  const validBound = rule.maximumSteps === 'distinct-targets'
    ? rule.excludePreviousTargets === true
    : typeof rule.maximumSteps === 'number' && Number.isInteger(rule.maximumSteps) && rule.maximumSteps >= (terminalOnly ? 1 : 2) && rule.maximumSteps <= 64
  if ((rule.nextActivityId == null ? !terminalOnly : !id(rule.nextActivityId)) || !validBound || typeof rule.excludePreviousTargets !== 'boolean') errors.push('invalid continuation bound')
  if (rule.finishActivityId != null && (!id(rule.finishActivityId) || rule.finishActivityId === rule.nextActivityId)) errors.push('invalid continuation finisher')
  if (rule.maximumDistanceFromPreviousTargetFeet != null && (!Number.isFinite(rule.maximumDistanceFromPreviousTargetFeet) || rule.maximumDistanceFromPreviousTargetFeet < 0)) errors.push('invalid continuation distance')
  if (rule.requireAllTargetsInRadius != null && (typeof rule.requireAllTargetsInRadius !== 'boolean' || rule.maximumDistanceFromPreviousTargetFeet == null || rule.excludePreviousTargets)) errors.push('invalid mandatory continuation splash')
  if (rule.requiredSuccessfulCheckId != null && !activity.checks?.some(check => check.id === rule.requiredSuccessfulCheckId)) errors.push('unknown required continuation check')
  if (rule.when?.kind === 'check-success') {
    const checkId = rule.when.checkId
    if (!activity.checks?.some(check => check.id === checkId)) errors.push('unknown continuation check')
  } else if (rule.when?.kind === 'equal-dice') {
    if (!id(rule.when.rollId) || !Number.isInteger(rule.when.first) || !Number.isInteger(rule.when.second) || rule.when.first < 0 || rule.when.second < 0 || rule.when.first === rule.when.second) errors.push('invalid continuation dice condition')
  } else if (rule.when) errors.push('unknown continuation condition')
  if (rule.carryRolls && (!Array.isArray(rule.carryRolls) || rule.carryRolls.length > 32 || rule.carryRolls.some(copy => !id(copy.from) || !id(copy.to)) || new Set(rule.carryRolls.map(copy => copy.to)).size !== rule.carryRolls.length)) errors.push('invalid continuation roll mapping')
  return errors
}

export function getDnd5eActivityContinuationV1(state: Dnd5eHeadlessCombatState, command: Dnd5eExecuteActivityCommandV1): Dnd5eActivityContinuationStateV1 | undefined {
  if (!command.continuationId) return undefined
  const pending = state.combatants[command.actorId]?.classState.activityContinuations?.[command.continuationId] ?? state.activityContinuations?.[command.continuationId]
  return pending && pending.actorId === command.actorId && pending.packageId === command.packageId &&
    pending.packageVersion === command.packageVersion &&
    ((pending.nextActivityId === command.activityId && pending.steps < pending.maximumSteps) || pending.finishActivityId === command.activityId) &&
    pending.turnKey === turnKey(state) ? pending : undefined
}

export function prepareDnd5eActivityContinuationV1(state: Dnd5eHeadlessCombatState, command: Dnd5eExecuteActivityCommandV1, activity: Dnd5eActivityDefinitionV1, rolls: Readonly<Record<string, Dnd5eFormulaRollResult>>): { rolls: Readonly<Record<string, Dnd5eFormulaRollResult>>; pending?: Dnd5eActivityContinuationStateV1; error?: string } {
  if (!activity.continuation && !activity.requiresContinuationFrom && !command.continuationId) return { rolls }
  const pending = getDnd5eActivityContinuationV1(state, command)
  const receipts = state.combatants[command.actorId]?.classState.activityContinuations ?? state.activityContinuations ?? {}
  if ((command.continuationId && !pending) || (activity.requiresContinuationFrom && pending?.rootActivityId !== activity.requiresContinuationFrom)) return { rolls, error: 'invalid-or-expired-continuation' }
  if (Object.values(receipts).some(entry => entry.turnKey === turnKey(state) && entry.commandIds.includes(command.commandId))) return { rolls, error: 'continuation-command-replayed' }
  const distinctTargetsOnly = pending?.distinctTargetsOnly || activity.continuation?.maximumSteps === 'distinct-targets'
  const finishing = pending?.finishActivityId === command.activityId
  if (pending && activity.continuation && Boolean(pending.distinctTargetsOnly) !== (activity.continuation.maximumSteps === 'distinct-targets')) return { rolls, error: 'continuation-bound-mismatch' }
  if (distinctTargetsOnly && !finishing) {
    if (!command.targetIds.length || new Set(command.targetIds).size !== command.targetIds.length ||
      command.targetIds.some(id => !state.combatants[id] || pending?.visitedTargetIds.includes(id))) return { rolls, error: 'continuation-requires-new-targets' }
    if (pending && activity.continuation && (activity.continuation.maximumSteps !== 'distinct-targets' || !activity.continuation.excludePreviousTargets)) return { rolls, error: 'continuation-bound-mismatch' }
  }
  if (pending) {
    const finishing = pending.finishActivityId === command.activityId
    if (!finishing && pending.requireAllTargetsInRadius) {
      const expected = dnd5eMandatoryContinuationTargets(state, pending)
      if (expected.length !== new Set(command.targetIds).size || expected.some(id => !command.targetIds.includes(id))) return { rolls, error: 'continuation-splash-targets-incomplete' }
    }
    if (command.castLevel !== pending.castLevel) return { rolls, error: 'continuation-cast-level-mismatch' }
    if (!finishing && pending.excludePreviousTargets && command.targetIds.some(id => pending.visitedTargetIds.includes(id))) return { rolls, error: 'continuation-target-already-used' }
    if (!finishing && pending.maximumDistanceFromPreviousTargetFeet != null && command.targetIds.some(id => !pending.previousTargetIds.some(previous => {
      const distance = previous === id ? 0 : state.distanceFeetByCombatantPair?.[dnd5eCombatantPairKey(previous, id)]
      return distance != null && distance <= pending.maximumDistanceFromPreviousTargetFeet!
    }))) return { rolls, error: 'continuation-target-out-of-range' }
    if (Object.keys(pending.rolls).some(key => key in rolls)) return { rolls, error: 'continuation-roll-overwrite' }
  }
  if (activity.continuation) {
    if (activity.continuation.nextActivityId) {
      const next = getRegisteredDnd5eActivity(command.packageId, activity.continuation.nextActivityId)
      if (!next || next.requiresContinuationFrom !== (pending?.rootActivityId ?? activity.id)) return { rolls, error: 'continuation-next-activity-not-bound' }
    }
    if (activity.continuation.finishActivityId) {
      const finish = getRegisteredDnd5eActivity(command.packageId, activity.continuation.finishActivityId)
      if (!finish || finish.requiresContinuationFrom !== (pending?.rootActivityId ?? activity.id) || finish.continuation) return { rolls, error: 'continuation-finisher-not-bound' }
    }
    if (activity.continuation.carryRolls?.some(mapping => !rolls[mapping.from] && !pending?.rolls[mapping.from])) return { rolls, error: 'continuation-roll-missing' }
    if (Object.values(receipts).filter(entry => entry.turnKey === turnKey(state)).length >= 128 && !pending) return { rolls, error: 'continuation-capacity-exceeded' }
  }
  return { rolls: { ...rolls, ...pending?.rolls }, pending }
}

export function finishDnd5eActivityContinuationV1(state: Dnd5eHeadlessCombatState, command: Dnd5eExecuteActivityCommandV1, activity: Dnd5eActivityDefinitionV1, rolls: Readonly<Record<string, Dnd5eFormulaRollResult>>, checks: readonly Dnd5eActivityCheckResult[], pending?: Dnd5eActivityContinuationStateV1): void {
  const rule = activity.continuation
  if (!rule && !pending) return
  const condition = rule?.when
  const values = condition?.kind === 'equal-dice' ? rolls[condition.rollId]?.values : undefined
  const eligible = (!rule?.requiredSuccessfulCheckId || checks.some(check => check.checkId === rule.requiredSuccessfulCheckId && check.success)) && (!condition || (condition.kind === 'check-success'
    ? checks.some(check => check.checkId === condition.checkId && check.success)
    : values != null && values[condition.first] != null && values[condition.first] === values[condition.second]))
  const carried: Record<string, Dnd5eFormulaRollResult> = {}
  for (const mapping of rule?.carryRolls ?? []) {
    if (!rolls[mapping.from]) throw new Error('Missing validated continuation roll: ' + mapping.from)
    carried[mapping.to] = structuredClone(rolls[mapping.from])
  }
  const id = pending?.id ?? command.commandId
  const steps = (pending?.steps ?? 0) + 1
  const visitedTargetIds = [...new Set([...(pending?.visitedTargetIds ?? []), ...command.targetIds])]
  const distinctTargetsOnly = pending?.distinctTargetsOnly || rule?.maximumSteps === 'distinct-targets'
  // The remaining bound comes from Host state, never a made-up spell limit.
  // Targets that leave the map remain visited; new creatures can be included
  // while the chain is live, but no creature can create a cycle.
  const maximumSteps = distinctTargetsOnly
    ? steps + Object.keys(state.combatants).filter(id => !visitedTargetIds.includes(id)).length
    : pending?.maximumSteps ?? (rule!.maximumSteps as number)
  const hasReachableNewTarget = !distinctTargetsOnly || rule?.maximumDistanceFromPreviousTargetFeet == null ||
    Object.keys(state.combatants).some(id => !visitedTargetIds.includes(id) && command.targetIds.some(previous => {
      const distance = state.distanceFeetByCombatantPair?.[dnd5eCombatantPairKey(previous, id)]
      return distance != null && distance <= rule.maximumDistanceFromPreviousTargetFeet!
    }))
  state.activityContinuations = Object.fromEntries(Object.entries(state.activityContinuations ?? {}).filter(([, value]) => value.turnKey === turnKey(state)))
  state.activityContinuations[id] = {
    id, actorId: command.actorId, packageId: command.packageId, packageVersion: command.packageVersion,
    rootActivityId: pending?.rootActivityId ?? activity.id, turnKey: turnKey(state), steps, maximumSteps,
    ...(distinctTargetsOnly ? { distinctTargetsOnly: true as const } : {}),
    nextActivityId: rule && eligible && steps < maximumSteps && hasReachableNewTarget ? rule.nextActivityId : undefined,
    finishActivityId: rule?.finishActivityId,
    castLevel: command.castLevel, previousTargetIds: [...command.targetIds],
    visitedTargetIds,
    commandIds: [...pending?.commandIds ?? [], command.commandId], rolls: carried,
    excludePreviousTargets: distinctTargetsOnly ? true : rule?.excludePreviousTargets ?? pending!.excludePreviousTargets,
    maximumDistanceFromPreviousTargetFeet: rule?.maximumDistanceFromPreviousTargetFeet,
    requireAllTargetsInRadius: rule?.requireAllTargetsInRadius,
  }
  const actor = state.combatants[command.actorId]
  const record = state.activityContinuations[id]
  actor.classState.activityContinuations = { ...Object.fromEntries(Object.entries(actor.classState.activityContinuations ?? {}).filter(([, value]) => value.turnKey === turnKey(state))), [id]: record }
  const effectId = `continuation:${id}`
  actor.classState.activeEffects = (actor.classState.activeEffects ?? []).filter(effect => effect.id !== effectId)
  const granted = [record.nextActivityId, record.finishActivityId].filter((id): id is string => !!id)
  if (granted.length) actor.classState.activeEffects.push(createDnd5eMechanicalEffect({
    id: effectId, definitionId: `${activity.id}:continuation`, label: '继续：' + activity.name, kind: 'buff', targetId: actor.id,
    source: { kind: 'feature', rulesId: activity.id, actorId: actor.id, pluginId: command.packageId, spellLevel: command.castLevel },
    duration: { type: 'until-turn-boundary', boundary: 'source-turn-end' },
    grantedActivities: granted,
  }))
}

export function dnd5eMandatoryContinuationTargets(state: Dnd5eHeadlessCombatState, pending: Dnd5eActivityContinuationStateV1): string[] {
  if (!pending.requireAllTargetsInRadius || pending.maximumDistanceFromPreviousTargetFeet == null) return []
  return Object.values(state.combatants).filter(target => target.currentHp > 0 && !target.deathSaves.dead && pending.previousTargetIds.some(previous => {
    const distance = previous === target.id ? 0 : state.distanceFeetByCombatantPair?.[dnd5eCombatantPairKey(previous, target.id)]
    return distance != null && distance <= pending.maximumDistanceFromPreviousTargetFeet!
  })).map(target => target.id)
}
