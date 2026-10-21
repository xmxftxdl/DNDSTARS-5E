import { dnd5eHeadlessTurnKey, dnd5eCombatantPairKey, dnd5eCombatantCanSee } from '../headlessCombatEngine'
import { dnd5eMovementExitedInitialSpaceTags, dnd5eMeleeCrossedInitialSpaceTags } from '../initialSpaceMovement'
import type {
  Dnd5eCombatEvent,
  Dnd5eHeadlessCombatState,
} from '../headlessCombatEngine'
import type {
  Dnd5eActivityTriggerContextV1,
} from './dnd5eActivityContracts'
import type { Dnd5eTriggerEventV1 } from './dnd5eEffectContracts'
import { dnd5eCombatantEntitledToActivityV1, dnd5eActivityExecutionGrant, dnd5eActivityUsesExecutionGrant } from './dnd5eActivityEntitlements'
import type { Character } from '../../../types/character'
import {
  listAvailableRegisteredDnd5eActivitiesV1,
  type AvailableRegisteredDnd5eActivityV1,
} from './dnd5eActivityRegistry'
import { dnd5eTrackableDefinitionIdV1, dnd5eExecutionEventKey } from './dnd5eActivityIdentity'
import { getDnd5eSrdCombatSpell } from '../spells'
import { dnd5eSpellSchoolIdFromLabel } from '../subclassSpellcasting'
import { dnd5ePluginSpellDefinition } from '../pluginApi'
import { ensureDnd5eCoreSpellActivitiesRegisteredV1 } from './dnd5eCoreSpellActivities'
import type { Dnd5eDamageCommitCheckpoint } from '../damageCommitCheckpoint'
import { dnd5eReactionsPrevented, dnd5eIsIncapacitated } from '../passiveDefenses'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './dnd5eActivityCombatAuthority'
import { dnd5eActivityRootRequirementsSatisfiedV1 } from './dnd5eActivityExecutor'
import { evaluateDnd5eFormulaV1 } from './dnd5eFormula'
import { prepareDnd5eDamageReactionSpell } from '../damageReactionSpellPreparation'

export interface Dnd5eActivityTriggerWindowV1 {
  eventIndex: number
  triggerContext: Dnd5eActivityTriggerContextV1
  available: readonly AvailableRegisteredDnd5eActivityV1[]
}

/** Discovery only for personal defenses at a live Host checkpoint. This does not
 * authorize a command or implement damage replacement/ally interception.
 * Unsupported costs and formulas needing a player choice are not guessed.
 */
export function listDnd5ePersonalDamageCheckpointActivitiesV1(input: {
  state: Dnd5eHeadlessCombatState
  checkpoint: Dnd5eDamageCommitCheckpoint
  eventBatchId: string
  character?: Character
  /** Host replay only; caller must carry material changes into the atomic commit. */
  allowMaterialWrites?: boolean
}): readonly Dnd5eActivityTriggerWindowV1[] {
  const { state, checkpoint } = input
  const actor = state.combatants[checkpoint.targetId]
  if (!actor || checkpoint.amount <= 0) return []
  ensureDnd5eCoreSpellActivitiesRegisteredV1()
  const triggerContext = context(state, checkpoint.occurrence, input.eventBatchId,
    'before-damage', actor.id, [actor.id], {
      kind: 'combat', id: 'damage-taken',
      damage: { amount: checkpoint.amount, damageTypes: [...checkpoint.damageTypes],
        temporaryHitPointsBefore: actor.temporaryHp, temporaryHitPointsAfter: actor.temporaryHp },
    })
  const snapshot = dnd5eActivityActorSnapshotFromCombatantV1(actor)
  const available = listAvailableRegisteredDnd5eActivitiesV1({
    triggerContext, actorId: actor.id, targetIds: [actor.id],
  }).filter(entry => {
    const activity = entry.activity
    const slotCost = activity.consumption?.some(cost => cost.kind === 'spell-slot') === true
    const isSpellEntry = activity.legacySource?.kind === 'spell' && !activity.requiresEffectGrant
    const spellPreparation = slotCost || isSpellEntry ? prepareDnd5eDamageReactionSpell({
      packageId: entry.packageId, activity, actor, character: input.character,
    }) : undefined
    // Inventory writes cannot be dropped when replay retains only the combatant.
    if (spellPreparation && (!spellPreparation.ok || (spellPreparation.requiresInventoryWrite &&
      (!input.allowMaterialWrites || spellPreparation.componentCheck.materialPlan?.consumptionTiming === 'spell-end')))) return false
    if (activity.target.kind !== 'self') return false
    if (activity.activation.kind === 'reaction' && (!actor.turn.reactionAvailable || dnd5eReactionsPrevented(actor))) return false
    if (!actorKnownStateRequirementsSatisfied(activity, actor)) return false
    if (dnd5eActivityUsesExecutionGrant(activity) && !dnd5eActivityExecutionGrant({
      packageId: entry.packageId, activity, combatant: actor, triggerContext,
    })) return false
    if (!combatantGrantedActivity(actor, activity.id, entry.packageId) &&
      !dnd5eCombatantEntitledToActivityV1({ packageId: entry.packageId, activity, combatant: actor, character: input.character })) return false
    if (!dnd5eActivityRootRequirementsSatisfiedV1({ activity, combatActive: state.active, currentTurnActorId: state.active ? state.initiativeOrder[state.initiativeIndex] : undefined, actor: snapshot, targets: [snapshot], rolls: {}, triggerContext })) return false
    // Sum repeated costs: two declarations cannot both reserve the last use.
    const spent = new Map<string, number>()
    try {
      return (activity.consumption ?? []).every(cost => {
        if (cost.kind === 'action-economy') return economy(state, actor.id)?.[cost.economy] === true &&
          (cost.economy !== 'reaction' || !dnd5eReactionsPrevented(actor))
        if (cost.kind === 'spell-slot') return spellPreparation?.ok === true
        if (cost.kind !== 'resource') return false
        const amount = evaluateDnd5eFormulaV1(cost.amount, { actor: snapshot, target: snapshot, rolls: {} })
        if (!Number.isFinite(amount) || amount < 0) return false
        const total = (spent.get(cost.resourceId) ?? 0) + amount
        spent.set(cost.resourceId, total)
        return (snapshot.resources?.[cost.resourceId]?.current ?? -1) >= total
      })
    } catch { return false }
  })
  return available.length ? [{ eventIndex: checkpoint.occurrence, triggerContext, available }] : []
}

function economy(state: Dnd5eHeadlessCombatState, actorId: string) {
  const turn = state.combatants[actorId]?.turn
  return turn ? {
    action: turn.actionAvailable,
    'bonus-action': turn.bonusActionAvailable,
    reaction: turn.reactionAvailable,
  } : undefined
}

function context(
  state: Dnd5eHeadlessCombatState,
  eventIndex: number,
  eventBatchId: string,
  triggerEvent: Dnd5eTriggerEventV1,
  actorId: string,
  targetIds: readonly string[],
  source: Dnd5eActivityTriggerContextV1['source'],
): Dnd5eActivityTriggerContextV1 {
  return {
    eventId: `activity-event:${state.combatId}:${eventBatchId}:${eventIndex}:${triggerEvent}`,
    event: triggerEvent,
    eligibleActorIds: [actorId],
    eligibleTargetIds: [...targetIds],
    source: {
      ...source,
      executionId: source.executionId ?? `activity-execution:${state.combatId}:${eventBatchId}`,
    },
    actionEconomyAvailable: economy(state, actorId),
  }
}

function actorKnownStateRequirementsSatisfied(
  activity: AvailableRegisteredDnd5eActivityV1['activity'],
  actor: Dnd5eHeadlessCombatState['combatants'][string],
): boolean {
  const snapshot = dnd5eActivityActorSnapshotFromCombatantV1(actor)
  return dnd5eActivityRootRequirementsSatisfiedV1({
    activity: { ...activity, requirements: activity.requirements?.filter(requirement =>
      (requirement.kind === 'active-effect' || requirement.kind === 'effect-bound-temporary-hit-points' || requirement.kind === 'rage-state') && requirement.subject === 'actor') },
    actor: snapshot, targets: [snapshot], rolls: {},
  })
}

function observedAttackTargetEligible(state: Dnd5eHeadlessCombatState, actorId: string,
  trigger: Dnd5eActivityTriggerContextV1, entry: AvailableRegisteredDnd5eActivityV1): boolean {
  if (trigger.event !== 'other-creature-took-attack-damage') return true
  const actor = state.combatants[actorId], target = entry.activity.target
  if (!actor || target.kind !== 'creature') return false
  return trigger.eligibleTargetIds.some(id => {
    const other = state.combatants[id]
    if (!other || (target.relation === 'enemy' && other.controller === actor.controller) ||
      (target.relation === 'ally' && other.controller !== actor.controller)) return false
    const distance = state.distanceFeetByCombatantPair?.[dnd5eCombatantPairKey(actorId, id)]
    if (target.rangeFeet != null && (distance == null || distance > target.rangeFeet)) return false
    return !target.requiresLineOfSight || dnd5eCombatantCanSee(state, actorId, id)
  })
}

/** Death reactions can belong to witnesses rather than the actor who dealt damage. */
function deathReactionEligible(state: Dnd5eHeadlessCombatState, actorId: string,
  triggerContext: Dnd5eActivityTriggerContextV1, entry: AvailableRegisteredDnd5eActivityV1): boolean {
  if (triggerContext.event !== 'creature-died') return true
  const actor = state.combatants[actorId], activity = entry.activity
  if (!actor || actor.deathSaves.dead) return false
  if (activity.activation.kind === 'reaction' && (!actor.turn.reactionAvailable || dnd5eReactionsPrevented(actor))) return false
  const targets = triggerContext.eligibleTargetIds.map(id => state.combatants[id])
  if (!targets.length || targets.some(target => !target?.deathSaves.dead)) return false
  const distances = Object.fromEntries(targets.map(target => [target.id,
    state.distanceFeetByCombatantPair?.[dnd5eCombatantPairKey(actorId, target.id)] ?? Number.POSITIVE_INFINITY]))
  if (activity.target.kind === 'creature') {
    const range = activity.target.rangeFeet
    if (range != null && targets.some(target => distances[target.id] > range)) return false
    if (activity.target.requiresLineOfSight && targets.some(target => !dnd5eCombatantCanSee(state, actorId, target.id))) return false
  }
  return dnd5eActivityRootRequirementsSatisfiedV1({activity,
    actor:dnd5eActivityActorSnapshotFromCombatantV1(actor,actor,state),
    targets:targets.map(target=>dnd5eActivityActorSnapshotFromCombatantV1(target,actor,state)),
    distanceFeetByTargetId:distances,rolls:{},triggerContext,combatActive:state.active,
    currentTurnActorId:state.active?state.initiativeOrder[state.initiativeIndex]:undefined})
}

function combatantGrantedActivity(
  actor: Dnd5eHeadlessCombatState['combatants'][string],
  activityId: string,
  packageId: string,
): boolean {
  return (actor.classState.activeEffects ?? []).some((effect) =>
    !effect.suspendedBy?.length &&
    (effect.source.pluginId ?? (effect.source.kind === 'spell' ? 'srd-5.1' : undefined)) === packageId &&
    effect.grantedActivities?.includes(activityId) === true)
}

function attackEventSource(
  event: Extract<Dnd5eCombatEvent, { type: 'attack-resolved' }>,
  targetDroppedToZero = false,
): Extract<Dnd5eActivityTriggerContextV1['source'], { kind: 'attack' }> {
  const attackLocalId = event.spellId ?? event.weaponBaseId ?? event.weaponId ?? event.attackMode ?? 'unarmed'
  return {
    kind: 'attack',
    targetId: event.targetId,
    magical: event.magical,
    projectileAttackSnapshot: event.projectileAttackSnapshot ? {...event.projectileAttackSnapshot,damage:{...event.projectileAttackSnapshot.damage}} : undefined,
    ...(event.spellId ? { id: event.spellId } : {}),
    ...(event.activityId ? { activityId: event.activityId } : {}),
    ...(event.opportunityAttack ? { id: 'opportunity-attack' } : {}),
    definitionId: dnd5eTrackableDefinitionIdV1({
      namespace: (event.weaponBaseId ?? event.weaponId)?.startsWith('srd-5.1:') ? 'srd-5.1' : 'core',
      kind: 'attack',
      localId: attackLocalId,
    }),
    mode: event.attackMode ?? (event.weaponId ? 'melee' : 'unarmed'),
    delivery: event.attackDelivery ?? (event.attackMode === 'melee' || event.attackMode === 'unarmed' ? 'melee' : event.attackMode === 'ranged' ? 'ranged' : undefined),
    category: event.attackCategory ?? (event.attackMode === 'spell' ? 'spell' :
      event.attackMode === 'melee' || event.attackMode === 'ranged' || event.attackMode === 'unarmed' || event.weaponId ? 'weapon' : undefined),
    result: event.critical ? 'critical-hit' : event.hit ? 'hit' : 'miss',
    damageType: event.damageType,
    ...(event.precedingStraightMovementFeet != null ? { precedingStraightMovementFeet: event.precedingStraightMovementFeet } : {}),
    ...(event.weaponCategory ? { weaponCategory: event.weaponCategory } : {}),
    ...(event.weaponDamageDice ? { weaponDamageDice: { ...event.weaponDamageDice } } : {}),
    ...(event.weaponId ? { weaponId: event.weaponId, ...(event.opportunityAttack ? {} : { id: event.weaponId }) } : {}),
    ...(event.weaponBaseId ? { weaponBaseId: event.weaponBaseId } : {}),
    ...(event.weaponProperties?.length ? { weaponProperties: [...event.weaponProperties] } : {}),
    ...(event.proficient != null ? { proficient: event.proficient } : {}),
    ...(event.attackOrigin ? { origin: event.attackOrigin } : {}),
    ...(event.handsUsed ? { handsUsed: event.handsUsed } : {}),
    ...(targetDroppedToZero ? { targetDroppedToZero: true } : {}),
  }
}

/** Converts legacy/built-in combat events into canonical Activity windows. */
export function dnd5eActivityTriggerContextsFromCombatEventV1(
  state: Dnd5eHeadlessCombatState,
  event: Dnd5eCombatEvent,
  eventIndex: number,
  eventBatchId: string,
  eventBatch?: readonly Dnd5eCombatEvent[],
): readonly Dnd5eActivityTriggerContextV1[] {
  if (event.type === 'class-state-changed' && event.stateKey === 'rage' && event.active) {
    if (!state.combatants[event.actorId]?.classState.raging) return []
    return [context(state, eventIndex, eventBatchId, 'rage-start', event.actorId,
      Object.keys(state.combatants), {
        kind: 'feature', id: 'barbarian-rage',
        definitionId: dnd5eTrackableDefinitionIdV1({ namespace: 'core', kind: 'feature', localId: 'barbarian-rage' }),
      })]
  }
  if (event.type === 'creature-died') {
    if (!state.combatants[event.targetId]?.deathSaves.dead) return []
    return [...new Set(event.witnessIds)].filter(id => state.combatants[id] && id !== event.targetId).map(id => {
      const death = context(state, eventIndex, eventBatchId, 'creature-died', id, [event.targetId],
        { kind: 'combat', id: 'creature-died' })
      death.eventId += `:${id}`
      return death
    })
  }
  if (event.type === 'temporary-hit-points-gained') {
    if (event.amount <= 0) return []
    return [context(state, eventIndex, eventBatchId, 'temporary-hit-points-gained', event.actorId, [event.actorId],
      { kind: 'combat', id: event.source?.rulesId ?? 'temporary-hit-points-gained', executionId: event.source?.executionId })]
  }
  if (event.type === 'sleeping-creature-awakened') {
    if (!state.combatants[event.targetId]) return []
    // The creature that woke owns this window, not the helper spending an action.
    return [context(state, eventIndex, eventBatchId, 'creature-awakened', event.targetId, [event.targetId],
      { kind: 'combat', id: 'creature-awakened' })]
  }
  if (event.type === 'counterspell-resolved' || event.type === 'spell-dispelled') {
    if (!event.success) return []
    // The spell source describes the spell that was actually interrupted/ended,
    // not a guessed casting slot of the actor's Counterspell or Dispel Magic.
    return [context(state, eventIndex, eventBatchId,
      event.type === 'counterspell-resolved' ? 'spell-countered' : 'spell-dispelled',
      event.actorId, [event.type === 'counterspell-resolved' ? event.casterId : event.targetId],
      { kind: 'spell', id: event.spellId, level: event.spellLevel },
    )]
  }
  if (event.type === 'turn-started' || event.type === 'turn-ended') return [context(
    state, eventIndex, eventBatchId, event.type === 'turn-started' ? 'turn-start' : 'turn-end', event.actorId, [event.actorId],
    {
      kind: 'combat', id: event.type === 'turn-started' ? 'turn-start' : 'turn-end',
      definitionId: dnd5eTrackableDefinitionIdV1({ namespace: 'core', kind: 'action', localId: event.type === 'turn-started' ? 'turn-start' : 'turn-end' }),
    },
  ), ...(event.type === 'turn-ended' && state.combatants[event.actorId]
    ? Object.values(state.combatants).filter(actor => actor.id !== event.actorId).map(actor => {
        const observer = context(state, eventIndex, eventBatchId, 'other-turn-end', actor.id, [event.actorId], {
          kind: 'combat', id: 'turn-end',
          definitionId: dnd5eTrackableDefinitionIdV1({ namespace: 'core', kind: 'action', localId: 'turn-end' }),
        })
        // Each holder gets an independent receipt; the ended creature remains
        // the target even after initiative has advanced to a different actor.
        return { ...observer, eventId: `${observer.eventId}:observer:${actor.id}` }
      })
    : [])]
  if (event.type === 'attack-resolved') {
    const targetDroppedToZero = eventBatch?.slice(eventIndex + 1).some((candidate) =>
      candidate.type === 'hit-points-reduced-to-zero' && candidate.sourceId === event.actorId &&
      candidate.targetId === event.targetId) === true
    const source = attackEventSource(event, targetDroppedToZero)
    source.crossedInitialSpaceTags = dnd5eMeleeCrossedInitialSpaceTags(state,event,eventBatch?.slice(eventIndex+1))
    return [
      context(state, eventIndex, eventBatchId, 'attack-resolved', event.actorId, [event.targetId], source),
      context(state, eventIndex, eventBatchId, event.hit ? 'attack-hit' : 'attack-missed', event.actorId, [event.targetId], source),
      ...(event.hit ? [context(
        state,
        eventIndex,
        eventBatchId,
        'reaction-window',
        event.targetId,
        [event.actorId],
        source,
      )] : []),
    ]
  }
  if (event.type === 'spell-cast') {
    const school = dnd5ePluginSpellDefinition(event.spellId)?.school ??
      (getDnd5eSrdCombatSpell(event.spellId)?.school
        ? dnd5eSpellSchoolIdFromLabel(getDnd5eSrdCombatSpell(event.spellId)!.school)
        : undefined)
    const source = {
      kind: 'spell' as const,
      id: event.spellId,
      level: event.slotLevel,
      executionId: event.executionId,
      ...(school ? { school } : {}),
      definitionId: dnd5eTrackableDefinitionIdV1({ namespace: 'srd-5.1', kind: 'spell', localId: event.spellId }),
    }
    const hasCompletion = !!event.executionId && eventBatch?.some(candidate =>
      candidate.type === 'activity-resolved' && candidate.sourceKind === 'spell' &&
      candidate.actorId === event.actorId && candidate.executionId === event.executionId &&
      (candidate.sourceId === event.spellId || candidate.sourceId.endsWith(`:${event.spellId}`) || event.spellId.endsWith(`:${candidate.sourceId}`)))
    return [
      context(state, eventIndex, eventBatchId, 'spell-cast', event.actorId, [event.targetId], source),
      ...hasCompletion ? [] : [context(state, eventIndex, eventBatchId, 'spell-resolved', event.actorId, [event.targetId], source)],
    ]
  }
  if (event.type === 'damage-applied' && event.amount > 0) {
    const actorId = event.targetId
    const targetIds = event.sourceId ? [event.sourceId] : [event.targetId]
    const damage = {
      amount: event.amount,
      temporaryHitPointsBefore: event.temporaryHpBefore,
      temporaryHitPointsAfter: event.temporaryHpAfter,
      ...(event.damageTypes?.length ? { damageTypes: [...event.damageTypes] } : {}),
    }
    const sourceAttack = !event.origin && event.sourceId
      ? eventBatch?.slice(0, eventIndex).reverse().find((candidate): candidate is Extract<Dnd5eCombatEvent, { type: 'attack-resolved' }> =>
          candidate.type === 'attack-resolved' && candidate.actorId === event.sourceId &&
          candidate.targetId === event.targetId && candidate.hit)
      : undefined
    const damageSource: Dnd5eActivityTriggerContextV1['source'] = event.origin
      ? event.origin.kind === 'spell'
        ? event.origin.spellLevel == null
          ? { kind: 'combat', id: event.origin.id, activityId: event.origin.activityId, damage }
          : { kind: 'spell', id: event.origin.id, level: event.origin.spellLevel, activityId: event.origin.activityId, castingClassId: event.origin.castingClassId, damage }
        : { kind: event.origin.kind, id: event.origin.id, activityId: event.origin.activityId, damage }
      : sourceAttack ? { ...attackEventSource(sourceAttack), damage } : {
        kind: 'combat',
        id: 'damage-taken',
        damage,
        definitionId: dnd5eTrackableDefinitionIdV1({ namespace: 'core', kind: 'action', localId: 'damage-taken' }),
      }
    const contexts = [context(state, eventIndex, eventBatchId, 'after-damage', actorId, targetIds, damageSource)]
    if (event.sourceId && !event.suppressAfterDealtDamageTrigger) contexts.push(
      context(state, eventIndex, eventBatchId, 'damage-dealt', event.sourceId, [event.targetId], damageSource),
    )
    const bearer = event.sourceId ? state.combatants[event.sourceId] : undefined
    const victim = state.combatants[event.targetId]
    if (sourceAttack && bearer && victim && !victim.objectInteractionOnly && victim.objectDamageThreshold == null) {
      for (const observer of Object.values(state.combatants)) {
        if (observer.id === victim.id || observer.id === bearer.id || observer.deathSaves.dead ||
          dnd5eIsIncapacitated(observer) || observer.objectInteractionOnly || observer.objectDamageThreshold != null) continue
        const observed = context(state, eventIndex, eventBatchId, 'other-creature-took-attack-damage',
          observer.id, [bearer.id], { ...attackEventSource(sourceAttack), damage })
        observed.eventId += `:observer:${observer.id}`
        contexts.push(observed)
      }
    }
    if (bearer && victim && !victim.objectInteractionOnly && victim.objectDamageThreshold == null &&
      !event.suppressAfterDealtDamageTrigger) {
      const notified = new Set<string>()
      for (const effect of bearer.classState.activeEffects ?? []) {
        const sourceId = effect.source.actorId
        const source = sourceId ? state.combatants[sourceId] : undefined
        if (!effect.modifiers?.notifySourceOnBearerDamage || effect.suspendedBy?.length || !source ||
          source.id === victim.id || source.deathSaves.dead || dnd5eIsIncapacitated(source) || notified.has(source.id)) continue
        notified.add(source.id)
        contexts.push(context(state, eventIndex, eventBatchId, 'marked-creature-damaged-other', source.id, [bearer.id],
          { kind: 'combat', id: 'marked-creature-damaged-other', damage }))
      }
    }
    // Ordinary damage has its own HP transition event; the explicit reduction
    // event is reserved for effects that set HP to zero without dealing damage.
    if (event.hpBefore > 0 && event.hpAfter === 0) contexts.push(
      context(state, eventIndex, eventBatchId, 'self-dropped-to-zero', actorId, [actorId], damageSource),
    )
    return contexts
  }
  if (event.type === 'saving-throw-resolved') return [context(
    state, eventIndex, eventBatchId, 'after-save', event.targetId, [event.targetId],
    {
      kind: 'combat', id: `saving-throw:${event.ability}`,
      definitionId: dnd5eTrackableDefinitionIdV1({ namespace: 'core', kind: 'action', localId: `saving-throw:${event.ability}` }),
    },
  )]
  if (event.type === 'condition-attempted') return [context(
    state, eventIndex, eventBatchId, 'on-condition-attempted', event.targetId, [event.actorId],
    {
      kind: 'combat', id: `condition:${event.condition}`,
      definitionId: dnd5eTrackableDefinitionIdV1({ namespace: 'core', kind: 'action', localId: `condition:${event.condition}` }),
    },
  )]
  if (event.type === 'condition-applied') return [context(
    state, eventIndex, eventBatchId, 'on-condition-applied', event.targetId, [event.actorId],
    {
      kind: 'combat', id: `condition:${event.condition}`,
      definitionId: dnd5eTrackableDefinitionIdV1({ namespace: 'core', kind: 'action', localId: `condition:${event.condition}` }),
    },
  ), ...(event.becameIncapacitatedInvoluntarily ? [context(
    state, eventIndex, eventBatchId, 'self-involuntarily-incapacitated', event.targetId, [event.targetId],
    { kind: 'combat', id: `condition:${event.condition}` },
  )] : [])]
  if (event.type === 'ability-check-resolved') return [context(
    state, eventIndex, eventBatchId, 'skill-used', event.actorId, [],
    {
      kind: 'skill', id: event.skill ?? event.ability,
      definitionId: dnd5eTrackableDefinitionIdV1({ namespace: 'core', kind: 'skill', localId: event.skill ?? event.ability }),
    },
  )]
  if (event.type === 'moved') {
    const moved = context(
    state, eventIndex, eventBatchId, 'movement-completed', event.actorId, [event.actorId],
    {
      kind: 'movement', id: 'move', distanceFeet: event.distance, completed: true,
      crossedInitialSpaceTags: dnd5eMovementExitedInitialSpaceTags(state,event),
      straightDistanceFeet: event.straightDistanceFeet,
      movementKind: event.movementKind,
      distanceFromSourceFeet: event.distanceFromSourceFeet,
      sourceActorId: event.sourceActorId,
      activityId: event.activityId,
      straightLine: event.straightLine === true,
      dashedThisTurn: state.combatants[event.actorId]?.classState.dashedTurnKey ===
        dnd5eHeadlessTurnKey(state, event.actorId),
      definitionId: dnd5eTrackableDefinitionIdV1({ namespace: 'core', kind: 'movement', localId: 'move' }),
    },
    )
    // Source-owned continuations preserve caster scaling and damage attribution.
    if (event.sourceActorId && event.sourceActorId !== event.actorId) {
      const caused = context(state, eventIndex, eventBatchId, 'movement-completed',
        event.sourceActorId, [event.actorId], moved.source)
      caused.eventId += ':source'
      return [moved, caused]
    }
    return [moved]
  }
  if (event.type === 'hit-points-reduced-to-zero') {
    const sourceAttack = eventBatch?.slice(0, eventIndex).reverse().find((candidate): candidate is Extract<Dnd5eCombatEvent, { type: 'attack-resolved' }> =>
      candidate.type === 'attack-resolved' && candidate.actorId === event.sourceId &&
      candidate.targetId === event.targetId && candidate.hit)
    const eventSource = sourceAttack ? attackEventSource(sourceAttack) : { kind: 'combat' as const }
    return [context(
      state, eventIndex, eventBatchId, 'creature-dropped-to-zero', event.sourceId, [event.targetId], eventSource,
    ), ...(event.hpBefore > 0 ? [context(
      state, eventIndex, eventBatchId, 'self-dropped-to-zero', event.targetId, [event.targetId], eventSource,
    )] : [])]
  }
  if (event.type === 'activity-resolved') {
    const triggerEvent = event.sourceKind === 'spell'
      ? 'spell-resolved' as const
      : event.sourceKind === 'item'
        ? 'item-used' as const
        : event.sourceKind === 'feature'
          ? 'feature-used' as const
          : 'action-resolved' as const
    const definitionKind = event.sourceKind === 'spell' || event.sourceKind === 'item' || event.sourceKind === 'feature'
      ? event.sourceKind
      : 'action'
    const definitionId = dnd5eTrackableDefinitionIdV1({
      namespace: event.sourceId.startsWith('srd-5.1:') ? 'srd-5.1' : 'core',
      kind: definitionKind,
      localId: event.sourceId,
    })
    const activitySpellSchool = event.sourceKind === 'spell'
      ? dnd5ePluginSpellDefinition(event.sourceId)?.school ??
        (getDnd5eSrdCombatSpell(event.sourceId)?.school
          ? dnd5eSpellSchoolIdFromLabel(getDnd5eSrdCombatSpell(event.sourceId)!.school)
          : undefined)
      : undefined
    const source = event.sourceKind === 'spell'
      ? { kind: 'spell' as const, id: event.sourceId, activityId: event.activityId, definitionId, level: event.castLevel ?? 0, ...(activitySpellSchool ? { school: activitySpellSchool } : {}) }
      : { kind: event.sourceKind as 'item' | 'feature' | 'action', id: event.sourceId, activityId: event.activityId, definitionId }
    return [context(
      // One completion belongs to a concrete Host execution. Redelivery under
      // another network batch must not reopen persistent effect grant choices.
      state, event.executionId ? 0 : eventIndex, event.executionId ? `execution:${dnd5eExecutionEventKey(event.executionId)}` : eventBatchId,
      triggerEvent, event.actorId, event.targetIds, { ...source, executionId: event.executionId },
    )]
  }
  return []
}

/** Discovers all registered choices created by one committed combat result. */
export function listDnd5eActivityTriggerWindowsV1(input: {
  state: Dnd5eHeadlessCombatState
  events: readonly Dnd5eCombatEvent[]
  /** Host-owned unique id, normally the committed combat revision. */
  eventBatchId: string
  charactersByCombatantId?: Readonly<Record<string, Character>>
}): readonly Dnd5eActivityTriggerWindowV1[] {
  // The map authority can be the first route loaded in a fresh browser tab.
  // Trigger discovery must therefore bootstrap the built-in activity catalog
  // instead of depending on a spellbook/cast route having run beforehand.
  ensureDnd5eCoreSpellActivitiesRegisteredV1()
  return input.events.flatMap((event, eventIndex) =>
    dnd5eActivityTriggerContextsFromCombatEventV1(
      input.state, event, eventIndex, input.eventBatchId, input.events,
    ).flatMap((triggerContext) => {
      const actorId = triggerContext.eligibleActorIds[0]
      if (!actorId) return []
      const actor = input.state.combatants[actorId]
      if (!actor) return []
      const available = listAvailableRegisteredDnd5eActivitiesV1({
        triggerContext,
        actorId,
        targetIds: triggerContext.eligibleTargetIds,
      }).filter((entry) =>
        deathReactionEligible(input.state, actorId, triggerContext, entry) &&
        observedAttackTargetEligible(input.state, actorId, triggerContext, entry) &&
        (entry.activity.activation.kind !== 'reaction' || (actor.turn.reactionAvailable && !dnd5eReactionsPrevented(actor))) &&
        !(event.type === 'attack-resolved' && event.handledHitActivities?.some(handled =>
          handled.packageId === entry.packageId && handled.activityId === entry.activity.id)) &&
        (!dnd5eActivityUsesExecutionGrant(entry.activity) || !!dnd5eActivityExecutionGrant({
          packageId: entry.packageId, activity: entry.activity, combatant: actor, triggerContext,
        })) &&
        (entry.activity.requirements ?? []).every(requirement => requirement.kind !== 'once-per-turn' ||
          actor.classState.declarativeUsedTurnKeys?.[requirement.key] !== dnd5eHeadlessTurnKey(input.state, actor.id)) &&
        actorKnownStateRequirementsSatisfied(entry.activity, actor) &&
        (
          combatantGrantedActivity(actor, entry.activity.id, entry.packageId) ||
          dnd5eCombatantEntitledToActivityV1({
            packageId: entry.packageId,
            activity: entry.activity,
            combatant: actor,
            character: input.charactersByCombatantId?.[actorId],
          })
        ))
      return available.length > 0 ? [{ eventIndex, triggerContext, available }] : []
    }))
}
