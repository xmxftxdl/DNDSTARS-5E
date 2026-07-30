import type { Token } from '../../store/maps'
import {
  dnd5eAllocateMonsterMultiattackTargets,
} from '../../rulesets/dnd5e/monsterMultiattackTargets'
import {
  dnd5eMonsterMultiattackOccurrenceConstraint,
} from '../../rulesets/dnd5e/monsterMultiattackConstraints'

export interface Dnd5eMapMonsterTargetOccurrence {
  sequenceIndex: number
  targetId: string
}

export interface Dnd5eMapAssignedMonsterTargetOccurrence
  extends Dnd5eMapMonsterTargetOccurrence {
  actionId: string
}

export interface Dnd5eMapSettledMonsterOccurrence {
  sequenceIndex: number
  targetId: string
  hit: boolean
  linkedSlotGroups?: readonly string[]
}

export type Dnd5eMapKnownUnusedMonsterOccurrenceReason =
  | 'requires-previous-hit'
  | 'previous-hit-linked-same-target'
  | 'target-ineligible'
  | 'target-linked-relation-unavailable'

/**
 * Turns a preferred click plus the remaining legal combatants into an exact,
 * deterministic target list for the authoritative prepare call.
 */
export function dnd5eMapMonsterStableOccurrenceTargetIds(input: {
  monsterId: string
  parentActionId: string
  actionIds: readonly string[]
  candidateTargetIds: readonly string[]
  preferredTargetId: string
  canTarget?: (input: {
    sequenceIndex: number
    actionId: string
    targetId: string
    assigned: readonly Dnd5eMapAssignedMonsterTargetOccurrence[]
  }) => boolean
}): readonly string[] | undefined {
  return dnd5eAllocateMonsterMultiattackTargets({
    monsterId: input.monsterId,
    actionId: input.parentActionId,
    actionIds: input.actionIds,
    candidates: input.candidateTargetIds.map((id) => ({ id })),
    preferredTargetId: input.preferredTargetId,
    canTarget: ({ sequenceIndex, actionId, targetId, assigned }) =>
      input.canTarget?.({
        sequenceIndex,
        actionId,
        targetId,
        assigned,
      }) !== false,
  })?.map((occurrence) => occurrence.targetId)
}

/**
 * Predicts only skips that are already certain before presenting the next
 * attack roll. The Headless engine remains authoritative and receives a dummy
 * roll at the same occurrence index.
 */
export function dnd5eMapKnownUnusedMonsterOccurrence(input: {
  monsterId: string
  parentActionId: string
  sequenceIndex: number
  targetId: string
  settledOccurrences: readonly Dnd5eMapSettledMonsterOccurrence[]
  targetEligible?: boolean
  targetLinkedRelationAvailable?: boolean
}): Dnd5eMapKnownUnusedMonsterOccurrenceReason | undefined {
  const constraint = dnd5eMonsterMultiattackOccurrenceConstraint(
    input.monsterId,
    input.parentActionId,
    input.sequenceIndex,
  )
  if (!constraint) return undefined
  const occurrenceAt = (sequenceIndex: number) =>
    input.settledOccurrences.find((occurrence) =>
      occurrence.sequenceIndex === sequenceIndex)
  if (
    constraint.requiresPreviousHitAt != null &&
    occurrenceAt(constraint.requiresPreviousHitAt)?.hit !== true
  ) return 'requires-previous-hit'
  if (
    constraint.requiresPreviousHitsAt?.some((sequenceIndex) =>
      occurrenceAt(sequenceIndex)?.hit !== true)
  ) return 'requires-previous-hit'
  const linkedSkip = constraint.skipWhenPreviousHitLinksSameTarget
  if (linkedSkip) {
    const previous = occurrenceAt(linkedSkip.previousOccurrenceIndex)
    if (
      previous?.hit === true &&
      previous.targetId === input.targetId &&
      previous.linkedSlotGroups?.includes(linkedSkip.slotGroup)
    ) return 'previous-hit-linked-same-target'
  }
  if (
    constraint.skipWhenTargetEligibilityUnavailable === true &&
    input.targetEligible === false
  ) return 'target-ineligible'
  if (
    constraint.skipWhenTargetLinkedRelationUnavailable === true &&
    input.targetLinkedRelationAvailable === false
  ) return 'target-linked-relation-unavailable'
  return undefined
}

export function dnd5eMapMonsterRandomRepeatTargetIds(
  targetIds: readonly string[] | undefined,
  occurrenceCount: number,
): readonly string[] | undefined {
  if (!targetIds) return undefined
  return targetIds.slice(0, Math.max(0, occurrenceCount))
}

export function dnd5eMapMonsterOccurrenceTarget(
  occurrences: readonly Dnd5eMapMonsterTargetOccurrence[],
  tokens: readonly Token[],
  sequenceIndex: number,
  fallback: Token,
): Token {
  const targetId = occurrences.find((occurrence) =>
    occurrence.sequenceIndex === sequenceIndex)?.targetId
  return tokens.find((token) => token.id === targetId) ?? fallback
}
