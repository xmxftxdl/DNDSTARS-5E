import {
  dnd5eMonsterMultiattackOccurrenceConstraint,
} from './monsterMultiattackConstraints'

export interface Dnd5eMonsterMultiattackTargetOccurrence {
  sequenceIndex: number
  actionId: string
  targetId: string
}

export interface Dnd5eMonsterMultiattackTargetCandidate {
  id: string
}

export interface Dnd5eAllocateMonsterMultiattackTargetsInput {
  monsterId: string
  actionId: string
  actionIds: readonly string[]
  candidates: readonly Dnd5eMonsterMultiattackTargetCandidate[]
  preferredTargetId?: string
  /**
   * An exact Host-authored occurrence list. A single entry retains the legacy
   * behaviour and is repeated for every occurrence.
   */
  requestedTargetIds?: readonly string[]
  canTarget?: (input: {
    sequenceIndex: number
    actionId: string
    targetId: string
    assigned: readonly Dnd5eMonsterMultiattackTargetOccurrence[]
  }) => boolean
}

function stableCandidateIds(
  candidates: readonly Dnd5eMonsterMultiattackTargetCandidate[],
  preferredTargetId?: string,
): string[] {
  const ids = [...new Set(candidates.map((candidate) => candidate.id))]
    .sort((left, right) => left.localeCompare(right))
  if (!preferredTargetId || !ids.includes(preferredTargetId)) return ids
  return [
    preferredTargetId,
    ...ids.filter((candidateId) => candidateId !== preferredTargetId),
  ]
}

function exactRequestedTargetIds(
  requestedTargetIds: readonly string[] | undefined,
  occurrenceCount: number,
): readonly string[] | undefined {
  if (!requestedTargetIds || requestedTargetIds.length === 0) return undefined
  if (requestedTargetIds.length === 1) {
    return Array.from({ length: occurrenceCount }, () => requestedTargetIds[0])
  }
  return requestedTargetIds.length === occurrenceCount
    ? requestedTargetIds
    : undefined
}

function targetAllowedByStaticConstraint(input: {
  monsterId: string
  parentActionId: string
  sequenceIndex: number
  targetId: string
  assigned: readonly Dnd5eMonsterMultiattackTargetOccurrence[]
}): boolean {
  const constraint = dnd5eMonsterMultiattackOccurrenceConstraint(
    input.monsterId,
    input.parentActionId,
    input.sequenceIndex,
  )
  if (!constraint) return true
  if (
    constraint.sameTargetAs != null &&
    input.assigned[constraint.sameTargetAs]?.targetId !== input.targetId
  ) return false
  if (
    constraint.differentTargetFrom != null &&
    input.assigned[constraint.differentTargetFrom]?.targetId === input.targetId
  ) return false
  if (
    constraint.differentTargetsFrom?.some((occurrenceIndex) =>
      input.assigned[occurrenceIndex]?.targetId === input.targetId)
  ) return false
  return true
}

/**
 * Allocates one target per concrete runtime occurrence.
 *
 * Candidate order is intentionally canonical: the tactical/manual focus is
 * first and the remainder are sorted by stable token id. Backtracking keeps a
 * valid later split-target constraint from being hidden by an early greedy
 * choice. The same function is shared by prepare, planner and simulation.
 */
export function dnd5eAllocateMonsterMultiattackTargets(
  input: Dnd5eAllocateMonsterMultiattackTargetsInput,
): readonly Dnd5eMonsterMultiattackTargetOccurrence[] | undefined {
  if (input.actionIds.length === 0) return undefined
  const candidateIds = stableCandidateIds(input.candidates, input.preferredTargetId)
  if (candidateIds.length === 0) return undefined
  const requested = exactRequestedTargetIds(
    input.requestedTargetIds,
    input.actionIds.length,
  )
  if (input.requestedTargetIds?.length && !requested) return undefined
  const assigned: Dnd5eMonsterMultiattackTargetOccurrence[] = []

  const assign = (sequenceIndex: number): boolean => {
    if (sequenceIndex >= input.actionIds.length) return true
    const actionId = input.actionIds[sequenceIndex]
    const constraint = dnd5eMonsterMultiattackOccurrenceConstraint(
      input.monsterId,
      input.actionId,
      sequenceIndex,
    )
    const baseCandidates = requested
      ? [requested[sequenceIndex]]
      : candidateIds
    const preferredDifferentTargetId =
      constraint?.preferDifferentTargetFrom == null
        ? undefined
        : assigned[constraint.preferDifferentTargetFrom]?.targetId
    const orderedCandidates = preferredDifferentTargetId == null
      ? baseCandidates
      : [
          ...baseCandidates.filter((targetId) =>
            targetId !== preferredDifferentTargetId),
          ...baseCandidates.filter((targetId) =>
            targetId === preferredDifferentTargetId),
        ]
    for (const targetId of orderedCandidates) {
      if (!candidateIds.includes(targetId)) continue
      if (!targetAllowedByStaticConstraint({
        monsterId: input.monsterId,
        parentActionId: input.actionId,
        sequenceIndex,
        targetId,
        assigned,
      })) continue
      if (input.canTarget?.({
        sequenceIndex,
        actionId,
        targetId,
        assigned,
      }) === false) continue
      assigned.push({ sequenceIndex, actionId, targetId })
      if (assign(sequenceIndex + 1)) return true
      assigned.pop()
    }
    return false
  }

  return assign(0) ? assigned : undefined
}
