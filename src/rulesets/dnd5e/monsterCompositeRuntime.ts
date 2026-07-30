import type {
  Dnd5eMonsterAction,
  Dnd5eMonsterStatBlock,
} from './monsters'
import { dnd5eMonsterAreaSavingThrowEffect } from './monsters'
import {
  dnd5eMonsterCompositeStepSkipPolicy,
  dnd5eMonsterMultiattackChildIsCompositeSupported,
  type Dnd5eMonsterCompositeStepSkipPolicy,
} from './monsterCompositeMultiattack'

export type Dnd5eMonsterCompositeRuntimeChildKind =
  | 'weapon'
  | 'area'
  | 'special'

export interface Dnd5eMonsterCompositeRuntimeChild {
  sequenceIndex: number
  action: Dnd5eMonsterAction
  kind: Dnd5eMonsterCompositeRuntimeChildKind
  skipPolicy: Dnd5eMonsterCompositeStepSkipPolicy
}

export interface Dnd5eMonsterCompositeRuntimePlan {
  action: Dnd5eMonsterAction
  children: readonly Dnd5eMonsterCompositeRuntimeChild[]
}

export type Dnd5eMonsterCompositeConditionalSkipReason =
  | 'resource-unavailable'
  | 'relation-unavailable'

function runtimeChildKind(
  action: Dnd5eMonsterAction,
): Dnd5eMonsterCompositeRuntimeChildKind | undefined {
  if (action.kind === 'weapon-attack' && action.attack) return 'weapon'
  if (action.kind !== 'other' || !action.rule) return undefined
  return action.rule.kind === 'area-saving-throw' ? 'area' : 'special'
}

/**
 * Shared catalog-to-runtime adapter used by the DM map and Monte Carlo runner.
 *
 * The Headless core intentionally accepts only an exact ordered step list.
 * Keeping this expansion in one place prevents either client from silently
 * dropping a non-weapon child while still labelling the parent as Multiattack.
 */
export function prepareDnd5eMonsterCompositeRuntimePlan(
  monster: Dnd5eMonsterStatBlock,
  action: Dnd5eMonsterAction,
): Dnd5eMonsterCompositeRuntimePlan | undefined {
  if (
    action.kind !== 'multiattack' ||
    !action.sequence ||
    action.sequence.length === 0
  ) return undefined
  const children = action.sequence.map((actionId, sequenceIndex) => {
    const child = monster.actions.find((candidate) => candidate.id === actionId)
    const kind = child ? runtimeChildKind(child) : undefined
    if (
      !child ||
      !kind ||
      !dnd5eMonsterMultiattackChildIsCompositeSupported(child)
    ) return undefined
    return {
      sequenceIndex,
      action: child,
      kind,
      skipPolicy: dnd5eMonsterCompositeStepSkipPolicy(
        monster.id,
        action.id,
        sequenceIndex,
      ),
    }
  })
  if (children.some((child) => child == null)) return undefined
  return {
    action,
    children: children as Dnd5eMonsterCompositeRuntimeChild[],
  }
}

export function dnd5eMonsterActionNeedsCompositeRuntime(
  monster: Dnd5eMonsterStatBlock,
  action: Dnd5eMonsterAction,
): boolean {
  const plan = prepareDnd5eMonsterCompositeRuntimePlan(monster, action)
  return plan?.children.some((child) => child.kind !== 'weapon') === true
}

export function dnd5eMonsterCompositeChildResourceAvailable(
  child: Pick<Dnd5eMonsterCompositeRuntimeChild, 'action'>,
  resources: {
    rechargeReadyByActionId?: Readonly<Record<string, boolean>>
    usesByActionId?: Readonly<Record<string, { current: number }>>
  },
): boolean {
  const usage = child.action.usage
  if (usage?.kind === 'recharge') {
    return resources.rechargeReadyByActionId?.[child.action.id] !== false
  }
  if (usage?.kind === 'per-day') {
    return (resources.usesByActionId?.[child.action.id]?.current ?? 0) > 0
  }
  return true
}

/**
 * Resolves only declared conditional omission rules. The Headless transaction
 * supplies authoritative, sequential availability so this helper stays usable
 * by map preparation, tactical planning and simulation without importing the
 * combat engine.
 */
export function dnd5eMonsterCompositeConditionalSkipReason(input: {
  child: Pick<Dnd5eMonsterCompositeRuntimeChild, 'action' | 'skipPolicy'>
  resourceAvailable: boolean
  relationAvailable: boolean
  skipWhenTargetLinkedRelationUnavailable: boolean
}): Dnd5eMonsterCompositeConditionalSkipReason | undefined {
  if (
    input.child.skipPolicy === 'when-resource-unavailable' &&
    !input.resourceAvailable
  ) return 'resource-unavailable'
  if (
    input.skipWhenTargetLinkedRelationUnavailable &&
    input.child.action.relationRequirement?.kind ===
      'target-linked-to-source' &&
    !input.relationAvailable
  ) return 'relation-unavailable'
  return undefined
}

export function dnd5eMonsterCompositeTargetHasActionImmunity(input: {
  sourceActorId: string
  action: Dnd5eMonsterAction
  target: {
    classState: {
      monsterActionImmunityRoundsByKey?: Readonly<Record<string, number>>
      monsterFrightfulPresenceImmunityRoundsBySource?: Readonly<Record<string, number>>
    }
  }
}): boolean {
  const area = input.action.rule?.kind === 'area-saving-throw'
    ? dnd5eMonsterAreaSavingThrowEffect(input.action)
    : undefined
  const immunity = area?.immunityOnSuccessfulSaveOrEffectEnd ??
    (
      input.action.rule?.kind === 'saving-throw-condition'
        ? input.action.rule.immunityOnSuccessfulSaveOrEffectEnd
        : undefined
    )
  const key = immunity?.scope.kind === 'catalog-action'
    ? `catalog-action:${immunity.scope.actionKey}`
    : immunity
      ? `source-action:${input.sourceActorId}:${input.action.id}`
      : undefined
  if (
    key &&
    (input.target.classState.monsterActionImmunityRoundsByKey?.[key] ?? 0) > 0
  ) return true
  return !!(
    area?.frightfulPresenceImmunityRounds &&
    (
      input.target.classState
        .monsterFrightfulPresenceImmunityRoundsBySource?.[
          input.sourceActorId
        ] ?? 0
    ) > 0
  )
}
