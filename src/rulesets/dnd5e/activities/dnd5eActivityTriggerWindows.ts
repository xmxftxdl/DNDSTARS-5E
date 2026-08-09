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

/** Converts legacy/built-in combat events into canonical Activity windows. */
export function dnd5eActivityTriggerContextsFromCombatEventV1(
  state: Dnd5eHeadlessCombatState,
  event: Dnd5eCombatEvent,
  eventIndex: number,
  eventBatchId: string,
): readonly Dnd5eActivityTriggerContextV1[] {
  if (event.type === 'attack-resolved') {
    const attackLocalId = event.weaponId ?? event.attackMode ?? 'unarmed'
    const source = {
      kind: 'attack' as const,
      definitionId: dnd5eTrackableDefinitionIdV1({
        namespace: event.weaponId?.startsWith('srd-5.1:') ? 'srd-5.1' : 'core',
        kind: 'attack',
        localId: attackLocalId,
      }),
      mode: event.attackMode ?? (event.weaponId ? 'melee' as const : 'unarmed' as const),
      result: event.critical ? 'critical-hit' as const : event.hit ? 'hit' as const : 'miss' as const,
      ...(event.weaponId ? { weaponId: event.weaponId, id: event.weaponId } : {}),
      ...(event.weaponProperties?.length ? { weaponProperties: [...event.weaponProperties] } : {}),
    }
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
    const source = {
      kind: 'spell' as const,
      id: event.spellId,
      level: event.slotLevel,
      definitionId: dnd5eTrackableDefinitionIdV1({ namespace: 'srd-5.1', kind: 'spell', localId: event.spellId }),
    }
    return [
      context(state, eventIndex, eventBatchId, 'spell-cast', event.actorId, [event.targetId], source),
      context(state, eventIndex, eventBatchId, 'spell-resolved', event.actorId, [event.targetId], source),
    ]
  }
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
      definitionId: dnd5eTrackableDefinitionIdV1({ namespace: 'core', kind: 'movement', localId: 'move' }),
    },
  )]
  if (event.type === 'hit-points-reduced-to-zero') return [context(
    state, eventIndex, eventBatchId, 'creature-dropped-to-zero', event.sourceId, [event.targetId],
    { kind: 'combat' },
  )]
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
    const source = event.sourceKind === 'spell'
      ? { kind: 'spell' as const, id: event.sourceId, activityId: event.activityId, definitionId, level: event.castLevel ?? 0 }
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
      input.state, event, eventIndex, input.eventBatchId,
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
