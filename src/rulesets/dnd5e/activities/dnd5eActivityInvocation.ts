import type {
  Dnd5eActivityConfirmationV1,
  Dnd5eActivityDefinitionV1,
  Dnd5eActivityInvocationV1,
  Dnd5eActivityTriggerContextV1,
} from './dnd5eActivityContracts'
import {
  DND5E_TRIGGER_EVENT_IDS_V1,
  type Dnd5ePredicateV1,
  type Dnd5eTriggerEventV1,
} from './dnd5eEffectContracts'
import { isDnd5eTrackableDefinitionIdV1 } from './dnd5eActivityIdentity'

export type Dnd5eActivityConfirmedByV1 = 'actor' | 'target' | 'dm' | 'system'

export type Dnd5eActivityInvocationMatchV1 =
  | { ok: true; invocation: Dnd5eActivityInvocationV1 }
  | {
      ok: false
      reason: 'trigger-context-required' | 'trigger-mismatch' | 'confirmation-required'
      details: readonly string[]
    }

const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,255}$/
const TRIGGER_EVENTS = new Set<string>(DND5E_TRIGGER_EVENT_IDS_V1)

/** Old event names remain readable, while all new adapters emit canonical names. */
export function canonicalDnd5eTriggerEventV1(event: Dnd5eTriggerEventV1): Dnd5eTriggerEventV1 {
  if (event === 'before-attack') return 'before-attack-roll'
  if (event === 'after-attack') return 'after-attack-roll'
  if (event === 'on-hit') return 'attack-hit'
  if (event === 'on-miss') return 'attack-missed'
  if (event === 'on-move') return 'movement-completed'
  if (event === 'on-cast') return 'spell-cast'
  if (event === 'after-cast') return 'spell-resolved'
  if (event === 'on-defeat') return 'creature-dropped-to-zero'
  return event
}

/**
 * Projects legacy self-referencing Trigger metadata into the executable gate.
 * This keeps old packages usable without trusting their trigger metadata alone.
 */
export function resolveDnd5eActivityInvocationV1(
  activity: Dnd5eActivityDefinitionV1,
): Dnd5eActivityInvocationV1 {
  if (activity.invocation) return activity.invocation
  const legacy = activity.triggers?.find((trigger) => trigger.activityId === activity.id)
  if (legacy) return {
    kind: 'triggered',
    event: canonicalDnd5eTriggerEventV1(legacy.event),
    confirmation: legacy.decision ?? 'actor-choice',
    retention: 'single-event',
  }
  if (activity.activation.kind === 'reaction') return {
    kind: 'triggered',
    event: 'reaction-window',
    confirmation: 'actor-choice',
    retention: 'single-event',
  }
  return {
    kind: 'active',
    confirmation: activity.automation.level === 'dm-adjudication' ? 'dm-approval' : 'actor-choice',
  }
}

export function validateDnd5eActivityTriggerContextV1(
  context: Dnd5eActivityTriggerContextV1,
): readonly string[] {
  const errors: string[] = []
  if (!TRIGGER_EVENTS.has(context.event)) errors.push('trigger context event is invalid')
  if (!['attack', 'spell', 'skill', 'item', 'feature', 'movement', 'action', 'combat'].includes(context.source.kind)) {
    errors.push('trigger context source kind is invalid')
  }
  if (!ID_PATTERN.test(context.eventId)) errors.push('trigger context eventId is invalid')
  if (!Array.isArray(context.eligibleActorIds) || context.eligibleActorIds.some((id) => !ID_PATTERN.test(id))) {
    errors.push('trigger context eligibleActorIds are invalid')
  }
  if (!Array.isArray(context.eligibleTargetIds) || context.eligibleTargetIds.some((id) => !ID_PATTERN.test(id))) {
    errors.push('trigger context eligibleTargetIds are invalid')
  }
  if (new Set(context.eligibleActorIds).size !== context.eligibleActorIds.length) {
    errors.push('trigger context eligibleActorIds are duplicated')
  }
  if (new Set(context.eligibleTargetIds).size !== context.eligibleTargetIds.length) {
    errors.push('trigger context eligibleTargetIds are duplicated')
  }
  if ('id' in context.source && context.source.id != null && !ID_PATTERN.test(context.source.id)) {
    errors.push('trigger context source id is invalid')
  }
  if ('activityId' in context.source && context.source.activityId != null && !ID_PATTERN.test(context.source.activityId)) {
    errors.push('trigger context source activityId is invalid')
  }
  if (context.source.definitionId != null && !isDnd5eTrackableDefinitionIdV1(context.source.definitionId)) {
    errors.push('trigger context source definitionId is invalid')
  }
  if (context.source.executionId != null && (!context.source.executionId.trim() || context.source.executionId.length > 300)) {
    errors.push('trigger context source executionId is invalid')
  }
  if (context.source.kind === 'spell' && (!Number.isInteger(context.source.level) || context.source.level < 0 || context.source.level > 9)) {
    errors.push('trigger context spell level is invalid')
  }
  if (context.source.kind === 'movement' && (!Number.isFinite(context.source.distanceFeet) || context.source.distanceFeet < 0)) {
    errors.push('trigger context movement distance is invalid')
  }
  if (context.source.kind === 'attack' && context.source.weaponProperties?.some((property) => !ID_PATTERN.test(property))) {
    errors.push('trigger context weapon properties are invalid')
  }
  return errors
}

export function dnd5eContextPredicateSatisfiedV1(
  predicate: Dnd5ePredicateV1,
  context: Dnd5eActivityTriggerContextV1 | undefined,
): boolean | undefined {
  if (predicate.kind === 'activity-definition') {
    return context?.source.definitionId === predicate.definitionId
  }
  if (predicate.kind === 'event-source') {
    if (!context || context.source.kind !== predicate.source) return false
    if (predicate.sourceId != null && ('id' in context.source ? context.source.id : undefined) !== predicate.sourceId) return false
    return predicate.activityId == null || ('activityId' in context.source ? context.source.activityId : undefined) === predicate.activityId
  }
  if (predicate.kind === 'weapon-property') {
    if (!context || context.source.kind !== 'attack') return false
    return context.source.weaponProperties?.includes(predicate.property) === predicate.present
  }
  if (predicate.kind === 'attack-mode') return context?.source.kind === 'attack' && context.source.mode === predicate.mode
  if (predicate.kind === 'attack-result') return context?.source.kind === 'attack' && context.source.result === predicate.result
  if (predicate.kind === 'movement-distance') {
    if (!context || context.source.kind !== 'movement') return false
    return context.source.distanceFeet >= (predicate.minimumFeet ?? 0) &&
      context.source.distanceFeet <= (predicate.maximumFeet ?? Number.POSITIVE_INFINITY)
  }
  if (predicate.kind === 'spell-used') {
    if (!context || context.source.kind !== 'spell') return false
    return (predicate.spellId == null || context.source.id === predicate.spellId) &&
      context.source.level >= (predicate.minimumLevel ?? 0) &&
      context.source.level <= (predicate.maximumLevel ?? 9)
  }
  if (predicate.kind === 'skill-used') {
    return context?.source.kind === 'skill' && (predicate.skillId == null || context.source.id === predicate.skillId)
  }
  if (predicate.kind === 'action-economy-available') {
    return context?.actionEconomyAvailable?.[predicate.economy] === true
  }
  return undefined
}

function confirmationMatches(
  expected: Dnd5eActivityConfirmationV1,
  confirmedBy: Dnd5eActivityConfirmedByV1 | undefined,
  dmApproved: boolean,
): boolean {
  if (expected === 'automatic') return confirmedBy === 'system'
  if (expected === 'actor-choice') return confirmedBy === 'actor'
  if (expected === 'target-choice') return confirmedBy === 'target'
  return confirmedBy === 'dm' || dmApproved
}

export function matchDnd5eActivityInvocationV1(input: {
  activity: Dnd5eActivityDefinitionV1
  actorId: string
  targetIds: readonly string[]
  triggerContext?: Dnd5eActivityTriggerContextV1
  confirmedBy?: Dnd5eActivityConfirmedByV1
  dmApproved?: boolean
}): Dnd5eActivityInvocationMatchV1 {
  const invocation = resolveDnd5eActivityInvocationV1(input.activity)
  if (invocation.kind === 'active') {
    if (input.triggerContext) return {
      ok: false, reason: 'trigger-mismatch', details: ['active Activity cannot consume a trigger event'],
    }
    if (invocation.confirmation === 'dm-approval' && input.confirmedBy !== 'dm' && !input.dmApproved) return {
      ok: false, reason: 'confirmation-required', details: ['DM approval is required'],
    }
    return { ok: true, invocation }
  }
  if (!input.triggerContext) return {
    ok: false, reason: 'trigger-context-required', details: [`Host trigger context is required for ${invocation.event}`],
  }
  const contextErrors = validateDnd5eActivityTriggerContextV1(input.triggerContext)
  if (contextErrors.length) return { ok: false, reason: 'trigger-mismatch', details: contextErrors }
  if (canonicalDnd5eTriggerEventV1(input.triggerContext.event) !== canonicalDnd5eTriggerEventV1(invocation.event)) return {
    ok: false, reason: 'trigger-mismatch', details: [`expected ${invocation.event}, received ${input.triggerContext.event}`],
  }
  if (!input.triggerContext.eligibleActorIds.includes(input.actorId)) return {
    ok: false, reason: 'trigger-mismatch', details: ['actor is not eligible for this Host event'],
  }
  if (input.targetIds.some((id) => !input.triggerContext!.eligibleTargetIds.includes(id))) return {
    ok: false, reason: 'trigger-mismatch', details: ['one or more targets are not eligible for this Host event'],
  }
  for (const predicate of input.activity.requirements ?? []) {
    const contextual = dnd5eContextPredicateSatisfiedV1(predicate, input.triggerContext)
    if (contextual === false) return {
      ok: false, reason: 'trigger-mismatch', details: [`trigger requirement failed: ${predicate.kind}`],
    }
  }
  if (!confirmationMatches(invocation.confirmation, input.confirmedBy, input.dmApproved === true)) return {
    ok: false, reason: 'confirmation-required', details: [`${invocation.confirmation} confirmation is required`],
  }
  return { ok: true, invocation }
}
