import type {
  Dnd5eCombatEvent,
  Dnd5eHeadlessCombatState,
} from '../headlessCombatEngine'
import type {
  Dnd5eActivityTriggerContextV1,
} from './dnd5eActivityContracts'
import type { Dnd5eTriggerEventV1 } from './dnd5eEffectContracts'
import { dnd5eCombatantEntitledToActivityV1 } from './dnd5eActivityEntitlements'
import type { Character } from '../../../types/character'
import {
  listAvailableRegisteredDnd5eActivitiesV1,
  type AvailableRegisteredDnd5eActivityV1,
} from './dnd5eActivityRegistry'
import { dnd5eTrackableDefinitionIdV1 } from './dnd5eActivityIdentity'
import { getDnd5eSrdCombatSpell } from '../spells'
import { dnd5eSpellSchoolIdFromLabel } from '../subclassSpellcasting'
import { dnd5ePluginSpellDefinition } from '../pluginApi'

export interface Dnd5eActivityTriggerWindowV1 {
  eventIndex: number
  triggerContext: Dnd5eActivityTriggerContextV1
  available: readonly AvailableRegisteredDnd5eActivityV1[]
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

function attackEventSource(
  event: Extract<Dnd5eCombatEvent, { type: 'attack-resolved' }>,
  targetDroppedToZero = false,
): Extract<Dnd5eActivityTriggerContextV1['source'], { kind: 'attack' }> {
  const attackLocalId = event.weaponBaseId ?? event.weaponId ?? event.attackMode ?? 'unarmed'
  return {
    kind: 'attack',
    ...(event.opportunityAttack ? { id: 'opportunity-attack' } : {}),
    definitionId: dnd5eTrackableDefinitionIdV1({
      namespace: (event.weaponBaseId ?? event.weaponId)?.startsWith('srd-5.1:') ? 'srd-5.1' : 'core',
      kind: 'attack',
      localId: attackLocalId,
    }),
    mode: event.attackMode ?? (event.weaponId ? 'melee' : 'unarmed'),
    result: event.critical ? 'critical-hit' : event.hit ? 'hit' : 'miss',
    damageType: event.damageType,
    ...(event.weaponId ? { weaponId: event.weaponId, ...(event.opportunityAttack ? {} : { id: event.weaponId }) } : {}),
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
  if (event.type === 'turn-started') return [context(
    state, eventIndex, eventBatchId, 'turn-start', event.actorId, [event.actorId],
    {
      kind: 'combat', id: 'turn-start',
      definitionId: dnd5eTrackableDefinitionIdV1({ namespace: 'core', kind: 'action', localId: 'turn-start' }),
    },
  )]
  if (event.type === 'attack-resolved') {
    const targetDroppedToZero = eventBatch?.slice(eventIndex + 1).some((candidate) =>
      candidate.type === 'hit-points-reduced-to-zero' && candidate.sourceId === event.actorId &&
      candidate.targetId === event.targetId) === true
    const source = attackEventSource(event, targetDroppedToZero)
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
      ...(school ? { school } : {}),
      definitionId: dnd5eTrackableDefinitionIdV1({ namespace: 'srd-5.1', kind: 'spell', localId: event.spellId }),
    }
    return [
      context(state, eventIndex, eventBatchId, 'spell-cast', event.actorId, [event.targetId], source),
      context(state, eventIndex, eventBatchId, 'spell-resolved', event.actorId, [event.targetId], source),
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
    const sourceAttack = event.sourceId
      ? eventBatch?.slice(0, eventIndex).reverse().find((candidate): candidate is Extract<Dnd5eCombatEvent, { type: 'attack-resolved' }> =>
          candidate.type === 'attack-resolved' && candidate.actorId === event.sourceId &&
          candidate.targetId === event.targetId && candidate.hit)
      : undefined
    return [context(
      state, eventIndex, eventBatchId, 'after-damage', actorId, targetIds,
      sourceAttack ? { ...attackEventSource(sourceAttack), damage } : {
        kind: 'combat',
        id: 'damage-taken',
        damage,
        definitionId: dnd5eTrackableDefinitionIdV1({ namespace: 'core', kind: 'action', localId: 'damage-taken' }),
      },
    )]
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
  )]
  if (event.type === 'ability-check-resolved') return [context(
    state, eventIndex, eventBatchId, 'skill-used', event.actorId, [],
    {
      kind: 'skill', id: event.skill ?? event.ability,
      definitionId: dnd5eTrackableDefinitionIdV1({ namespace: 'core', kind: 'skill', localId: event.skill ?? event.ability }),
    },
  )]
  if (event.type === 'moved') return [context(
    state, eventIndex, eventBatchId, 'movement-completed', event.actorId, [event.actorId],
    {
      kind: 'movement', id: 'move', distanceFeet: event.distance, completed: true,
      straightLine: event.straightLine === true,
      dashedThisTurn: state.combatants[event.actorId]?.classState.dashedTurnKey ===
        `${state.combatId}:${state.round}:${state.initiativeSlotIds?.[state.initiativeIndex] ?? state.turnSlotId ?? event.actorId}`,
      definitionId: dnd5eTrackableDefinitionIdV1({ namespace: 'core', kind: 'movement', localId: 'move' }),
    },
  )]
  if (event.type === 'hit-points-reduced-to-zero') {
    const sourceAttack = eventBatch?.slice(0, eventIndex).reverse().find((candidate): candidate is Extract<Dnd5eCombatEvent, { type: 'attack-resolved' }> =>
      candidate.type === 'attack-resolved' && candidate.actorId === event.sourceId &&
      candidate.targetId === event.targetId && candidate.hit)
    return [context(
      state, eventIndex, eventBatchId, 'creature-dropped-to-zero', event.sourceId, [event.targetId],
      sourceAttack ? attackEventSource(sourceAttack) : { kind: 'combat' },
    )]
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
      state, eventIndex, eventBatchId, triggerEvent, event.actorId, event.targetIds, source,
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
      }).filter((entry) => dnd5eCombatantEntitledToActivityV1({
        packageId: entry.packageId,
        activity: entry.activity,
        combatant: actor,
        character: input.charactersByCombatantId?.[actorId],
      }))
      return available.length > 0 ? [{ eventIndex, triggerContext, available }] : []
    }))
}
