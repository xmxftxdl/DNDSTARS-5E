import type { Dnd5eClassId } from './classes'
import type { D20RollMode } from '../contracts'
import type {
  Dnd5eCombatant,
  Dnd5eCombatEvent,
  Dnd5eHeadlessCombatState,
} from './headlessCombatEngine'
import { dnd5ePluginFeatureDefinition } from './pluginApi'
import { resolveDnd5eRollMode } from './rollMode'

export type Dnd5eNextD20RollKind =
  | 'attack'
  | 'ability-check'
  | 'saving-throw'

export interface Dnd5eNextD20AdvantageCarrier {
  level: number
  classId?: Dnd5eClassId
  subclassId?: string
  classLevels?: Partial<Record<Dnd5eClassId, number>>
  subclassIds?: Partial<Record<Dnd5eClassId, string>>
  pluginFeatureIds?: readonly string[]
  classState: {
    nextD20Advantage?: {
      featureId: string
      rollKinds: readonly Dnd5eNextD20RollKind[]
    }
  }
}

function classLevel(
  actor: Dnd5eNextD20AdvantageCarrier,
  classId: Dnd5eClassId,
): number {
  return actor.classLevels?.[classId] ??
    (actor.classId === classId ? actor.level : 0)
}

export function dnd5eNextD20AdvantageApplies(
  actor: Dnd5eNextD20AdvantageCarrier,
  rollKind: Dnd5eNextD20RollKind,
): boolean {
  const marker = actor.classState.nextD20Advantage
  if (
    !marker ||
    !marker.rollKinds.includes(rollKind) ||
    !actor.pluginFeatureIds?.includes(marker.featureId)
  ) return false
  const feature = dnd5ePluginFeatureDefinition(marker.featureId)
  const mechanic = feature?.declarativeAbility?.mechanic
  if (
    !feature ||
    feature.automation !== 'full' ||
    mechanic?.kind !== 'next-d20-advantage' ||
    !mechanic.rollKinds.includes(rollKind)
  ) return false
  if (
    feature.sourceClassId &&
    classLevel(actor, feature.sourceClassId) <
      (feature.minimumLevel ?? feature.declarativeAbility?.level ?? 1)
  ) return false
  if (
    feature.sourceClassId &&
    feature.sourceSubclassId &&
    actor.subclassIds?.[feature.sourceClassId] !== feature.sourceSubclassId &&
    !(actor.classId === feature.sourceClassId &&
      actor.subclassId === feature.sourceSubclassId)
  ) return false
  return true
}

/** Death saves have no ability key, so they cannot use the normal save-mode helper. */
export function dnd5eDeathSavingThrowMode(
  actor: Dnd5eNextD20AdvantageCarrier & { exhaustionLevel: number },
): D20RollMode {
  return resolveDnd5eRollMode({
    advantage: [{
      active: dnd5eNextD20AdvantageApplies(actor, 'saving-throw'),
      reason: 'next-d20-advantage',
    }],
    disadvantage: [{
      active: actor.exhaustionLevel >= 3,
      reason: 'exhaustion-level-3',
    }],
  }).mode
}

function resolvedRollOwner(event: Dnd5eCombatEvent): {
  actorId: string
  rollKind: Dnd5eNextD20RollKind
} | undefined {
  if (event.type === 'attack-resolved') {
    return { actorId: event.actorId, rollKind: 'attack' }
  }
  if (event.type === 'ability-check-resolved') {
    return { actorId: event.actorId, rollKind: 'ability-check' }
  }
  if (event.type === 'saving-throw-resolved') {
    return { actorId: event.targetId, rollKind: 'saving-throw' }
  }
  if (event.type === 'concentration-resolved') {
    return { actorId: event.actorId, rollKind: 'saving-throw' }
  }
  if (event.type === 'relentless-rage-resolved' || event.type === 'death-save-resolved') {
    return { actorId: event.actorId, rollKind: 'saving-throw' }
  }
  return undefined
}

/** Consume at most one pending marker per creature from the ordered event log. */
export function consumeDnd5eNextD20Advantages(
  state: Dnd5eHeadlessCombatState,
  resolvedEvents: readonly Dnd5eCombatEvent[],
  outputEvents: Dnd5eCombatEvent[],
): void {
  const consumedActorIds = new Set<string>()
  for (const event of resolvedEvents) {
    const resolved = resolvedRollOwner(event)
    if (!resolved || consumedActorIds.has(resolved.actorId)) continue
    const actor: Dnd5eCombatant | undefined = state.combatants[resolved.actorId]
    if (!actor || !dnd5eNextD20AdvantageApplies(actor, resolved.rollKind)) continue
    actor.classState.nextD20Advantage = undefined
    consumedActorIds.add(actor.id)
    outputEvents.push({
      type: 'class-state-changed',
      actorId: actor.id,
      stateKey: 'next-d20-advantage',
      active: false,
    })
  }
}
