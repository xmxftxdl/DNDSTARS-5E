/**
 * Rules that constrain one concrete occurrence inside an otherwise ordinary
 * weapon Multiattack. Keeping them in a shared registry lets the Host, map
 * preparation, planner and simulation use the same semantics.
 */
export interface Dnd5eMonsterMultiattackOccurrenceConstraint {
  occurrenceIndex: number
  requiresPreviousHitAt?: number
  /** Every listed earlier occurrence must have hit before this step is legal. */
  requiresPreviousHitsAt?: readonly number[]
  sameTargetAs?: number
  differentTargetFrom?: number
  /** Every listed earlier occurrence must use another target. */
  differentTargetsFrom?: readonly number[]
  /**
   * Prefer another target when one exists, while retaining a legal same-target
   * fallback whose later validity depends on an earlier hit.
   */
  preferDifferentTargetFrom?: number
  /**
   * If the referenced earlier hit creates this source-linked relation against
   * the same target, the later occurrence becomes unused rather than rolling
   * back the otherwise valid parent transaction.
   */
  skipWhenPreviousHitLinksSameTarget?: {
    previousOccurrenceIndex: number
    slotGroup: string
  }
  /** Tiny=0, Small=1, Medium=2, Large=3, Huge=4, Gargantuan=5. */
  targetMaxSizeRank?: number
  targetNotLinkedToSourceSlotGroup?: string
  /**
   * A declared replacement child can become unusable because an earlier child
   * in the same transaction failed to create (or already consumed) its
   * target-linked relation. In that case the occurrence is unused; already
   * settled siblings remain valid.
   *
   * This is intentionally opt-in. Variants made entirely from relation-backed
   * replacements must instead satisfy `requiredSourceLinkedRelationsAtStart`,
   * so callers choose the sibling variant with ordinary attacks when possible.
   */
  skipWhenTargetLinkedRelationUnavailable?: true
  /**
   * Re-evaluate the child action's targetEligibility after earlier
   * occurrences. If it is still unmet, the prepared occurrence is unused.
   */
  skipWhenTargetEligibilityUnavailable?: true
}

export interface Dnd5eMonsterMultiattackConstraint {
  requiresActorAirborne?: boolean
  occurrences?: readonly Dnd5eMonsterMultiattackOccurrenceConstraint[]
  /**
   * Preconditions for selecting a relation-backed replacement variant.
   * Counts are evaluated against distinct, living targets at the transaction
   * boundary before any child is resolved.
   */
  requiredSourceLinkedRelationsAtStart?: readonly {
    slotGroup: string
    count: number
    /** Optional child-specific size ceiling for a usable linked target. */
    targetMaxSizeRank?: number
  }[]
}

const CONSTRAINTS = {
  'srd-5.1:giant-crocodile:multiattack': {
    occurrences: [{
      occurrenceIndex: 1,
      preferDifferentTargetFrom: 0,
      skipWhenPreviousHitLinksSameTarget: {
        previousOccurrenceIndex: 0,
        slotGroup: 'bite',
      },
      targetNotLinkedToSourceSlotGroup: 'bite',
    }],
  },
  'srd-5.1:chuul:multiattack-pincers-and-tentacles': {
    occurrences: [{
      occurrenceIndex: 2,
      skipWhenTargetLinkedRelationUnavailable: true,
    }],
  },
  'srd-5.1:grick:multiattack': {
    occurrences: [{
      occurrenceIndex: 1,
      requiresPreviousHitAt: 0,
      sameTargetAs: 0,
    }],
  },
  'srd-5.1:roper:multiattack': {
    occurrences: [{
      occurrenceIndex: 5,
      skipWhenTargetLinkedRelationUnavailable: true,
    }],
  },
  'srd-5.1:shambling-mound:multiattack': {
    occurrences: [
      {
        occurrenceIndex: 1,
        sameTargetAs: 0,
      },
      {
        occurrenceIndex: 2,
        sameTargetAs: 0,
        requiresPreviousHitsAt: [0, 1],
        targetMaxSizeRank: 2,
      },
    ],
  },
  'srd-5.1:kraken:multiattack-two-tentacles-and-fling': {
    occurrences: [{
      occurrenceIndex: 2,
      skipWhenTargetLinkedRelationUnavailable: true,
    }],
  },
  'srd-5.1:kraken:multiattack-tentacle-and-two-flings': {
    occurrences: [
      {
        occurrenceIndex: 1,
        skipWhenTargetLinkedRelationUnavailable: true,
      },
      {
        occurrenceIndex: 2,
        differentTargetFrom: 1,
        skipWhenTargetLinkedRelationUnavailable: true,
      },
    ],
  },
  'srd-5.1:kraken:multiattack-flings': {
    occurrences: [
      {
        occurrenceIndex: 1,
        differentTargetFrom: 0,
      },
      {
        occurrenceIndex: 2,
        differentTargetsFrom: [0, 1],
      },
    ],
    requiredSourceLinkedRelationsAtStart: [{
      slotGroup: 'tentacle',
      count: 3,
      targetMaxSizeRank: 3,
    }],
  },
  'srd-5.1:tarrasque:multiattack-swallow': {
    requiredSourceLinkedRelationsAtStart: [{
      slotGroup: 'bite',
      count: 1,
      targetMaxSizeRank: 3,
    }],
  },
  'srd-5.1:tarrasque:multiattack-frightful-presence-and-swallow': {
    requiredSourceLinkedRelationsAtStart: [{
      slotGroup: 'bite',
      count: 1,
      targetMaxSizeRank: 3,
    }],
  },
  'srd-5.1:vampire-spawn:multiattack-grapple-and-bite': {
    occurrences: [{
      occurrenceIndex: 1,
      skipWhenTargetEligibilityUnavailable: true,
    }],
  },
  'srd-5.1:vampire-vampire:multiattack-unarmed-grapple-and-bite': {
    occurrences: [{
      occurrenceIndex: 1,
      skipWhenTargetEligibilityUnavailable: true,
    }],
  },
  'srd-5.1:tyrannosaurus-rex:multiattack': {
    occurrences: [{
      occurrenceIndex: 1,
      differentTargetFrom: 0,
    }],
  },
  'srd-5.1:wyvern:multiattack-claws-and-stinger': {
    requiresActorAirborne: true,
  },
  'srd-5.1:wyvern:multiattack-bite-and-claws': {
    requiresActorAirborne: true,
  },
} as const satisfies Readonly<Record<string, Dnd5eMonsterMultiattackConstraint>>

export function dnd5eMonsterMultiattackConstraint(
  monsterId: string,
  actionId: string,
): Dnd5eMonsterMultiattackConstraint | undefined {
  return (CONSTRAINTS as Readonly<Record<string, Dnd5eMonsterMultiattackConstraint>>)[
    `${monsterId}:${actionId}`
  ]
}

export function dnd5eMonsterMultiattackOccurrenceConstraint(
  monsterId: string,
  actionId: string,
  occurrenceIndex: number,
): Dnd5eMonsterMultiattackOccurrenceConstraint | undefined {
  return dnd5eMonsterMultiattackConstraint(monsterId, actionId)
    ?.occurrences?.find((constraint) =>
      constraint.occurrenceIndex === occurrenceIndex)
}

export function dnd5eMonsterMultiattackSupportsSingleTarget(
  monsterId: string,
  actionId: string,
): boolean {
  const constraint = dnd5eMonsterMultiattackConstraint(monsterId, actionId)
  if (
    constraint?.requiredSourceLinkedRelationsAtStart?.some((requirement) =>
      requirement.count > 1)
  ) return false
  return constraint?.occurrences?.every((occurrence) =>
    occurrence.differentTargetFrom == null &&
    (occurrence.differentTargetsFrom?.length ?? 0) === 0) ?? true
}
