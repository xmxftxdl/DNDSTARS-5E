import type { AutomationCapability } from '../../../domain/automation/automationCapability'
import type { AbilityKey } from '../../../lib/dnd'
import type { Dnd5eStandardConditionId } from '../conditions'
import type { Dnd5eDamageType } from '../damageTypes'
import type {
  Dnd5ePersistentAreaMovementDeclaration,
  Dnd5ePersistentAreaTurnLifecycle,
  Dnd5ePersistentAreaObscuration,
  Dnd5ePersistentAreaOccupantModifiers,
  Dnd5ePersistentAreaBlocking,
  Dnd5ePersistentAreaTriggerDeclaration,
  Dnd5ePersistentAreaVisual,
  Dnd5ePersistentAreaGrantedActivity,
  Dnd5ePersistentAreaWeaponHitBonusDamage,
  Dnd5ePersistentAreaLighting,
} from '../persistentAreaTypes'
import type { DeclarativeSubclassAbilityV1 } from '../declarativeSubclassAbility'
import type {
  Dnd5eEffectDefinitionV1,
  Dnd5eEffectDurationV1,
  Dnd5ePredicateV1,
  Dnd5eTriggerDefinitionV1,
  Dnd5eTriggerEventV1,
} from './dnd5eEffectContracts'
import type { Dnd5eFormulaV1 } from './dnd5eFormula'
import type { Dnd5eActivityBasicActionGrantActionV1 } from './dnd5eActivityBasicActionGrant'

export const DND5E_ACTIVITY_SCHEMA_VERSION = 1 as const

export type Dnd5eActivityActivationV1 =
  | { kind: 'action' | 'bonus-action' | 'reaction' | 'free' | 'movement'; cost?: number; reactionEvent?: string }
  | { kind: 'minute' | 'hour'; value: number }
  | { kind: 'passive' | 'special'; timing?: string }

export type Dnd5eActivityConfirmationV1 = 'automatic' | 'actor-choice' | 'target-choice' | 'dm-approval'

export type Dnd5eActivityTriggerRetentionV1 =
  | 'single-event'
  | 'until-triggered'
  | 'until-turn-end'
  | 'until-round-end'

export interface Dnd5eActivityEventIdentityV1 {
  /** Canonical, stable rules definition id used by statistics and exact trigger matching. */
  definitionId?: string
  /** Unique Host-owned id for this concrete execution/event batch. */
  executionId?: string
  /** Links a child attack/effect to the action that created it. */
  parentExecutionId?: string
}

/**
 * Defines whether an Activity is explicitly selected or becomes available in
 * an authority-owned event window. Optional for V1 compatibility; omitted
 * definitions are treated as active Activities unless a legacy self-trigger
 * can be projected safely.
 */
export type Dnd5eActivityInvocationV1 =
  | { kind: 'active'; confirmation?: 'actor-choice' | 'dm-approval' }
  | {
      kind: 'triggered'
      event: Dnd5eTriggerEventV1
      confirmation: Dnd5eActivityConfirmationV1
      retention?: Dnd5eActivityTriggerRetentionV1
    }

export type Dnd5eActivityEventSourceV1 = (
  | {
      kind: 'attack'
      id?: string
      activityId?: string
      mode: 'melee' | 'ranged' | 'spell' | 'unarmed'
      result?: 'hit' | 'miss' | 'critical-hit' | 'critical-miss'
      damageType?: Dnd5eDamageType
      weaponId?: string
      weaponProperties?: readonly string[]
      /** Host-derived proficiency for the concrete attack profile. */
      proficient?: boolean
      /** Host-derived action family for the concrete attack transaction. */
      origin?: 'attack-action' | 'bonus-action' | 'reaction' | 'other'
      /** Number of hands actually used for this weapon attack. */
      handsUsed?: 1 | 2
      /** Derived by correlating committed damage events in the same Host batch. */
      targetDroppedToZero?: boolean
      /** Authoritative damage facts correlated to this attack in the same event batch. */
      damage?: {
        amount: number
        temporaryHitPointsBefore: number
        temporaryHitPointsAfter: number
        damageTypes?: readonly Dnd5eDamageType[]
      }
    }
  | { kind: 'spell'; id: string; activityId?: string; level: number; school?: import('../spellbook').Dnd5eSpellbookSchoolId }
  | { kind: 'skill'; id: string; activityId?: string }
  | { kind: 'item' | 'feature' | 'action'; id: string; activityId?: string }
  | {
      kind: 'movement'
      id?: string
      distanceFeet: number
      completed: boolean
      /** Host-derived from the authoritative path, never accepted from a player payload. */
      straightLine?: boolean
      /** Host-derived from the committed Dash state for this exact turn. */
      dashedThisTurn?: boolean
    }
  | {
      kind: 'combat'
      id?: string
      activityId?: string
      damage?: {
        amount: number
        temporaryHitPointsBefore: number
        temporaryHitPointsAfter: number
        damageTypes?: readonly Dnd5eDamageType[]
      }
    }
) & Dnd5eActivityEventIdentityV1

/** Host-created event envelope. Clients may reference eventId but cannot author this data. */
export interface Dnd5eActivityTriggerContextV1 {
  eventId: string
  event: Dnd5eTriggerEventV1
  source: Dnd5eActivityEventSourceV1
  eligibleActorIds: readonly string[]
  eligibleTargetIds: readonly string[]
  actionEconomyAvailable?: Partial<Record<'action' | 'bonus-action' | 'reaction', boolean>>
}

export type Dnd5eActivityTargetV1 =
  | { kind: 'self' }
  | {
      kind: 'creature'
      relation: 'ally' | 'enemy' | 'any'
      rangeFeet?: number
      minimumRangeFeet?: number
      count: number
      includeSelf?: boolean
      allowDuplicateTargets?: boolean
      requiresLineOfSight?: boolean
      requiresLineOfEffect?: boolean
    }

  | {
      kind: 'area'
      relation: 'ally' | 'enemy' | 'any'
      /** event-target anchors a triggered area on the Host-authored event target. */
      origin: 'self' | 'point' | 'event-target'
      shape: 'circle' | 'sphere' | 'cone' | 'line' | 'cube' | 'cylinder' | 'rect'
      placeRangeFeet?: number
      radiusFeet?: number
      lengthFeet?: number
      widthFeet?: number
      heightFeet?: number
      minimumRadiusFeet?: number
      minimumLengthFeet?: number
      minimumWidthFeet?: number
      minimumHeightFeet?: number
      maximumTargets: number
      includeSelf?: boolean
      /** Requires this many feet of creature-sized square around the selected anchor to be empty. */
      unoccupiedAnchorSizeFeet?: number
      /** Snap rectangular planar coverage to an exact whole-cell footprint. */
      gridAligned?: boolean
      /** Excludes the creature used as the event-target anchor from the area result. */
      excludeEventTarget?: boolean
      rotatable?: boolean
      requiresLineOfSight?: boolean
      requiresLineOfEffect?: boolean
      /** Repeats the same template at independently selected Host anchors. */
      instanceCount?: number
      minimumInstanceCount?: number
      /** Every anchor after the first must join the existing set by one full face. */
      instanceAdjacency?: 'face'
    }

export interface Dnd5eActivityAreaPlacementV1 {
  x: number
  y: number
  elevationFeet?: number
  angleDegrees?: number
  radiusFeet?: number
  lengthFeet?: number
  widthFeet?: number
  heightFeet?: number
  /** Host-derived repeated template anchors; the first entry matches x/y. */
  instances?: readonly { x: number; y: number; elevationFeet?: number }[]
}

export interface Dnd5eActivityAreaInstanceV1 extends Dnd5eActivityAreaPlacementV1 {
  shape: Extract<Dnd5eActivityTargetV1, { kind: 'area' }>['shape']
  origin: 'self' | 'point' | 'event-target'
  radiusFeet?: number
  lengthFeet?: number
  widthFeet?: number
  heightFeet?: number
}

export type Dnd5eActivityConsumptionV1 =
  | { kind: 'action-economy'; economy: 'action' | 'bonus-action' | 'reaction'; amount: 1; consumeOn: 'confirm' | 'resolve' }
  | { kind: 'spell-slot'; minimumLevel: number; level: 'selected'; amount: 1; consumeOn: 'confirm' | 'resolve' }
  | { kind: 'resource'; resourceId: string; amount: Dnd5eFormulaV1; consumeOn: 'confirm' | 'hit' | 'resolve' | 'dm-approval' }
  | {
      kind: 'item-charge'
      resourceId: string
      amount: Dnd5eFormulaV1
      consumeOn: 'confirm' | 'hit' | 'resolve'
      /** Catalog allowlist for feature/feat Activities that consume a selected inventory item. */
      itemTemplateIds?: readonly string[]
    }
  | { kind: 'ammo' | 'hit-die'; resourceId: string; amount: Dnd5eFormulaV1; consumeOn: 'confirm' | 'hit' | 'resolve' }
  | { kind: 'hp' | 'movement'; amount: Dnd5eFormulaV1; consumeOn: 'confirm' | 'resolve' }

export type Dnd5eActivityCheckV1 =
  | {
      id: string
      kind: 'attack-roll'
      rollId: string
      attackBonus: Dnd5eFormulaV1
      rollMode: 'normal' | 'advantage' | 'disadvantage' | 'host-derived'
      /** Delivery is required for Host-derived melee/ranged situational modifiers. */
      delivery?: 'melee' | 'ranged'
      criticalThreshold?: number
      /** Skip this check unless the selected closed mode is one of these options. */
      appliesWhenChoice?: { choiceId: string; optionIds: readonly string[] }
      scope?: 'shared' | 'per-target'
    }
  | {
      id: string
      kind: 'saving-throw'
      rollId: string
      ability: AbilityKey
      abilityOptions?: readonly AbilityKey[]
      dc: Dnd5eFormulaV1
      rollMode?: 'normal' | 'advantage' | 'disadvantage' | 'host-derived'
      rollModeByCreatureType?: {
        creatureTypes: readonly string[]
        mode: 'advantage' | 'disadvantage'
      }
      rollModeBySizeRank?: {
        minimum?: number
        maximum?: number
        mode: 'advantage' | 'disadvantage'
      }
      /** Charm-like saves may automatically succeed for immune targets. */
      automaticSuccessIfConditionImmune?: Dnd5eStandardConditionId
      /** Willing/allied targets waive the save and follow the failed-save outcome. */
      automaticFailureIfAllied?: boolean
      /** Generic combat relation override, e.g. a creature already fighting the caster. */
      rollModeIfOpposed?: 'advantage' | 'disadvantage'
      /** Skip this check unless the selected closed mode is one of these options. */
      appliesWhenChoice?: { choiceId: string; optionIds: readonly string[] }
      /** Resolve this save only after the named earlier attack check succeeds. */
      appliesWhenCheck?: { checkId: string; result: 'success' }
      scope?: 'shared' | 'per-target'
    }
  | {
      id: string
      kind: 'ability-check' | 'skill-check' | 'concentration-check'
      rollId: string
      ability: AbilityKey
      skill?: string
      dc: Dnd5eFormulaV1
      rollMode?: 'normal' | 'advantage' | 'disadvantage' | 'host-derived'
      scope?: 'shared' | 'per-target'
    }
  | {
      id: string
      /** Two independent Host d20 recipes; ties favor the defending target. */
      kind: 'opposed-ability-check'
      rollId: string
      opposedRollId: string
      sourceAbility: AbilityKey
      sourceModifier: Dnd5eFormulaV1
      sourceRollMode?: 'normal' | 'advantage' | 'disadvantage' | 'host-derived'
      sourceRollModeByTargetSizeRank?: {
        minimum?: number
        maximum?: number
        mode: 'advantage' | 'disadvantage'
      }
      targetOptions: readonly { ability: AbilityKey; skill?: string }[]
      targetRollMode?: 'normal' | 'advantage' | 'disadvantage' | 'host-derived'
      scope: 'per-target'
    }
  | {
      id: string
      /** Host-rolled closed random table. It is not a d20 test and has no DC. */
      kind: 'random-roll'
      rollId: string
      /** User-facing label shown while the Host rolls this table. */
      label?: string
      count: number
      sides: number
      modifier?: number
      /** Faces that must be rolled again before this table result is accepted. */
      rerollValues?: readonly number[]
      /**
       * Defer this roll until an earlier random table for the same target lands
       * inside the declared inclusive range. This keeps chained tables honest:
       * an inactive branch is neither shown in the UI nor accepted by Host.
       */
      appliesWhenCheckTotal?: { checkId: string; minimum?: number; maximum?: number }
      scope?: 'shared' | 'per-target'
    }

export type Dnd5eActivityOutcomeConditionV1 =
  | { kind: 'check'; checkId: string; result: 'success' | 'failure' | 'critical-success' | 'critical-failure' }
  | { kind: 'check-total'; checkId: string; minimum?: number; maximum?: number }
  | { kind: 'choice'; choiceId: string; optionId: string }
  | { kind: 'predicate'; predicate: Dnd5ePredicateV1 }

export type Dnd5eActivityOutcomeWhenV1 =
  | { kind: 'always' }
  | Dnd5eActivityOutcomeConditionV1
  | {
      kind: 'all'
      conditions: readonly Dnd5eActivityOutcomeConditionV1[]
    }

export interface Dnd5eActivityChoiceDefinitionV1 {
  id: string
  label: string
  options: readonly Dnd5eActivityChoiceOptionV1[]
  defaultOptionId?: string
}

export interface Dnd5eActivityChoiceOptionV1 {
  id: string
  label: string
  description?: string
  requirements?: readonly Dnd5ePredicateV1[]
  /**
   * Closed geometry/target variant selected before map targeting. This is a
   * generic Activity primitive for spells and features with mutually exclusive
   * templates; the Host validates the selected option before accepting cells.
   */
  targetOverride?: Dnd5eActivityTargetV1
}

export type Dnd5eActivityOperationTargetV1 = 'actor' | 'target' | 'all-targets' | 'all-combatants'

/**
 * JSON-safe scalar parameters accepted by a Host-registered mechanic handler.
 * Content packages may select a handler and fill its public schema, but cannot
 * contribute executable code or nested objects through this boundary.
 */
export type Dnd5eMechanicParameterValueV1 = string | number | boolean | null

export interface Dnd5eActivityMechanicOperationV1 {
  id: string
  kind: 'mechanic'
  target: Dnd5eActivityOperationTargetV1
  /** Stable Host allowlist id, for example `core.event-damage-reflection`. */
  handlerId: string
  parameters?: Readonly<Record<string, Dnd5eMechanicParameterValueV1>>
}

export type Dnd5eActivityOperationV1 =
  | {
      id: string
      kind: 'damage'
      target: Dnd5eActivityOperationTargetV1
      amount: Dnd5eFormulaV1
      damageType: Dnd5eDamageType | 'inherit-primary'
      critical?: 'normal' | 'double-dice'
      magical?: boolean
    }
  | { id: string; kind: 'healing' | 'temporary-hit-points'; target: Dnd5eActivityOperationTargetV1; amount: Dnd5eFormulaV1 }
  | {
      id: string
      /** Returns an authoritative dead creature to life; ordinary healing can never do this. */
      kind: 'revive'
      target: Dnd5eActivityOperationTargetV1
      hitPoints: Dnd5eFormulaV1
      /** Omitted means no time limit. Ten rounds represents one minute. */
      maximumDeathAgeRounds?: number
      /** Requires the Host corpse ledger to explicitly confirm that death was not from old age. */
      excludesDeathFromOldAge?: boolean
      /** Requires the Host corpse ledger to explicitly confirm that the soul is free and willing. */
      requiresFreeWillingSoul?: boolean
      /** Most resurrection magic cannot affect undead or constructs. */
      excludedCreatureTypes?: readonly string[]
      /** Fails when the Host corpse/body ledger says no body remains. */
      requiresBody?: boolean
      /** Restores missing parts or recreates the complete body. */
      restoreBody?: 'missing-parts' | 'complete'
      /** Closed standard conditions removed as part of the revival transaction. */
      removeConditions?: readonly Dnd5eStandardConditionId[]
      /** Disease effects removed atomically with the revival. */
      removeDiseases?: 'nonmagical' | 'all'
      /** Curse effects removed atomically with the revival. */
      removeCurses?: 'all'
      /** Explicitly authorizes creation of a replacement body when no corpse remains. */
      createsNewBodyIfMissing?: boolean
      /** The live cast must name the creature before a replacement body is created. */
      requiresSpokenNameIfBodyMissing?: boolean
      /** Replacement body must appear in an unoccupied space within this distance of the caster. */
      newBodyPlacementRangeFeet?: number
      /** Applied after revival and reduced by this amount after each long rest. */
      longRestPenalty?: { initial: number; recoveryPerLongRest: number }
      /** At or beyond this corpse age, the caster is strained until completing a long rest. */
      casterLongRestStrainAfterDeathAgeRounds?: number
    }
  | { id: string; kind: 'stabilize'; target: Dnd5eActivityOperationTargetV1 }
  | {
      id: string
      /** Host-authoritative damage-free death; Death Ward may intercept it. */
      kind: 'instant-death'
      target: Dnd5eActivityOperationTargetV1
    }
  | { id: string; kind: 'stand-up'; target: Dnd5eActivityOperationTargetV1; usesTargetReactionIfAvailable: true }
  | {
      id: string
      kind: 'apply-standard-condition'
      target: Dnd5eActivityOperationTargetV1
      condition: Dnd5eStandardConditionId
      duration: Dnd5eEffectDurationV1
    }
  | {
      id: string
      /**
       * Applies one effect declared in `activity.effects`. The operation only
       * carries a stable reference; formulas, duration and allowed modifiers
       * remain part of the shared, data-only Effect contract.
       */
      kind: 'apply-effect'
      target: Dnd5eActivityOperationTargetV1
      effectId: string
    }
  | {
      id: string
      kind: 'remove-standard-condition'
      target: Dnd5eActivityOperationTargetV1
      condition: Dnd5eStandardConditionId
      sourceCreatureTypes?: readonly string[]
    }
  | {
      id: string
      kind: 'remove-effect'
      target: Dnd5eActivityOperationTargetV1
      effectId: string
      source: 'self' | 'any'
    }
  | {
      id: string
      /** Removes every matching semantic Effect from the selected target. */
      kind: 'remove-effects-by-tag'
      target: Dnd5eActivityOperationTargetV1
      tags: readonly string[]
      match: 'any' | 'all'
      source: 'self' | 'any'
      /** Optional closed filter on the authoritative source creature of each effect. */
      sourceCreatureTypes?: readonly string[]
      /** Omitted removes every match; a bounded value removes the oldest matches first. */
      maximumCount?: number
    }
  | {
      id: string
      kind: 'adjust-exhaustion'
      target: Dnd5eActivityOperationTargetV1
      /** Signed level delta; the Host always clamps the resulting level to 0–6. */
      amount: Dnd5eFormulaV1
    }
  | {
      id: string
      kind: 'recover-ability-score'
      target: Dnd5eActivityOperationTargetV1
      ability: AbilityKey
      maximumCount?: number
    }
  | {
      id: string
      /**
       * Lowers an ability to at most the declared score and records the exact
       * lost amount in the Host recovery ledger. This can never raise a score
       * or overwrite the authoritative character sheet with client data.
       */
      kind: 'lower-ability-score'
      target: Dnd5eActivityOperationTargetV1
      ability: AbilityKey
      maximumScore: Dnd5eFormulaV1
      recovery: 'restoration-magic'
      /** Stable group restored together when the originating effect ends. */
      recoveryGroupId?: string
    }
  | {
      id: string
      kind: 'recover-hit-point-maximum'
      target: Dnd5eActivityOperationTargetV1
      maximumCount?: number
    }
  | { id: string; kind: 'resource'; subject: 'actor' | 'target'; resourceId: string; mode: 'spend' | 'restore'; amount: Dnd5eFormulaV1 }
  | {
      id: string
      kind: 'move'
      target: Dnd5eActivityOperationTargetV1
      mode: 'push' | 'pull' | 'teleport' | 'swap' | 'ascend' | 'descend'
      distanceFeet: Dnd5eFormulaV1
      /** Host-derived vertical endpoint. `area-top` uses the validated Activity area volume; `ground` uses terrain elevation. */
      verticalDestination?: 'area-top' | 'ground'
      /** Host chooses the farthest legal destination in the declared direction. */
      placement?: 'host-automatic-maximum'
      originIllumination?: readonly ('dim' | 'darkness' | 'magical-darkness')[]
      destinationIllumination?: readonly ('dim' | 'darkness' | 'magical-darkness')[]
      requiresLineOfSight?: boolean
      ignoresOpportunityAttacks?: boolean
      /** Vertical self-movement spends exactly the resolved distance from the actor's movement budget. */
      usesActorMovement?: boolean
      /** If available, the affected creature spends its reaction to perform this movement. */
      usesTargetReactionIfAvailable?: boolean
      /** Voluntary/reaction movement may leave hostile reach and create ordinary opportunity windows. */
      provokesOpportunityAttacks?: boolean
    }
  | {
      id: string
      /**
       * Stores the orientation selected with an ordinary rotatable area
       * template as a Host-owned command. Effects may reference the stable
       * command key to constrain later movement without trusting client prose
       * or a client-computed direction vector.
       */
      kind: 'set-directional-command'
      target: 'actor'
      commandKey: string
    }
  | {
      id: string
      /** Atomically relocates the persistent area that granted this Activity. */
      kind: 'relocate-granting-area'
      target: 'target'
      maximumFeet: Dnd5eFormulaV1
      /**
       * Optional Host-owned command state for a movable interposing entity.
       * `clear` removes a prior interposition command. The Strength branch is
       * resolved from the authoritative target snapshot before map handoff.
       */
      interposition?:
        | { kind: 'clear' }
        | { kind: 'by-target-strength'; maximumStrengthToBlock: number }
    }
  | {
      id: string
      /** Replaces the granting area's Host-derived cells with this Activity's validated area template. */
      kind: 'reshape-granting-area'
      target: 'actor'
      /** Optional maximum displacement of the area's anchor from its current Host position. */
      maximumFeet?: Dnd5eFormulaV1
    }
  | {
      id: string
      /** Switches the source creature's senses between itself and the granting area's effect token. */
      kind: 'set-granting-area-senses'
      target: 'actor'
      mode: 'source' | 'projection'
    }
  | {
      id: string
      /**
       * Resolves every `on-detonate` trigger on the Host-authoritative area
       * that granted this Activity, then removes that area and its effect token.
       */
      kind: 'detonate-granting-area'
      target: 'actor'
    }
  | {
      id: string
      kind: 'summon'
      monsterId: string
      count: Dnd5eFormulaV1
      timing: 'immediate' | 'source-next-turn-start'
      durationRounds: number
      concentration: boolean
      side: 'ally' | 'enemy'
      persistent?: boolean
      /** The summon remains only after the bounded concentration duration completes naturally. */
      persistAfterConcentrationCompletes?: true
      /** Conjure Elemental keeps the creature for its remaining duration, but ends caster control and flips its side. */
      becomesHostileAfterConcentrationEnds?: true
      /** Optional Host-derived combat profile shared by summons and companions. */
      minimumMaximumHitPoints?: Dnd5eFormulaV1
      armorClassBonus?: Dnd5eFormulaV1
      weaponAttackBonus?: Dnd5eFormulaV1
      weaponDamageBonus?: Dnd5eFormulaV1
      savingThrowBonus?: Dnd5eFormulaV1
      proficientSkillCheckBonus?: Dnd5eFormulaV1
      weaponAttacksMagical?: boolean
      attacksPerAction?: Dnd5eFormulaV1
      shareSelfSpellsRangeFeet?: number
      /** Prevents every attack-like Headless action while preserving Dodge, Help and movement. */
      cannotAttack?: boolean
      /** Overrides the summoned stat block's walking speed. */
      walkingSpeedFeet?: Dnd5eFormulaV1
      /** Any positive damage starts this many-round delayed dismissal. */
      dismissAfterDamageRounds?: number
    }
  | {
      id: string
      /** Creates a Host-owned persistent duplicate from a target snapshot. */
      kind: 'duplicate-creature'
      target: Dnd5eActivityOperationTargetV1
      profile: 'simulacrum'
      persistent: true
      maximumHitPointDivisor: 2
      cannotIncreaseLevel: true
      cannotRegainSpellSlots: true
    }
  | {
      id: string
      /**
       * Replaces one creature's combat form with a Host-catalog creature.
       * The selected form comes from a closed Activity choice; clients never
       * submit an arbitrary stat block through this operation.
       */
      kind: 'transform-creature'
      target: Dnd5eActivityOperationTargetV1
      formChoiceId: string
      profile: 'polymorph' | 'true-polymorph' | 'animal-shapes' | 'shapechange'
      durationRounds: number
      /** Until-dispelled map enchantments keep a synthetic bounded round sentinel but do not expire at it. */
      permanent?: true
      /** True Polymorph becomes permanent only after its full concentration duration completes. */
      permanentAfterConcentrationCompletes?: true
      concentration: boolean
      /** Polymorph uses the target's CR, or its level when it has no CR. */
      maximumChallengeRating: 'target-level-or-challenge-rating' | number
      /** Tiny=0 through Gargantuan=5. Omitted means no size ceiling. */
      maximumSizeRank?: number
      /** Shapechange records the caster's explicit equipment handling choice. */
      equipmentChoiceId?: string
      /** Shapechange requires the caster to confirm that the selected species has been seen. */
      seenConfirmationChoiceId?: string
      /** Limits a control Activity to creatures already transformed by this actor/source Activity. */
      requiresExistingSourceActivityId?: string
    }
  | {
      id: string
      /** Inserts Host-owned one-shot turns immediately after the current slot. */
      kind: 'grant-extra-turns'
      target: 'actor'
      turns: Dnd5eFormulaV1
      /** Time Stop semantics: every other creature is suspended until the group ends. */
      freezeOtherCreatures: true
      /** End after the first successful action that targets another creature. */
      endOnAffectOther?: boolean
      /** End once the actor is farther than this distance from the casting origin. */
      maximumDistanceFromOriginFeet?: Dnd5eFormulaV1
    }
  | {
      id: string
      /** Host-authoritative inventory grant with a durable command receipt. */
      kind: 'grant-inventory-item'
      target: 'actor'
      templateId: string
      quantity: Dnd5eFormulaV1
      identified?: boolean
      /** Campaign-clock lifetime; omitted items do not automatically expire. */
      expiresAfterMinutes?: number
    }
  | {
      id: string
      /**
       * Captures a closed Host snapshot for a spell whose authority survives
       * the casting action and may be consumed by a later lifecycle event.
       */
      kind: 'establish-spell-authority'
      target: Dnd5eActivityOperationTargetV1
      recordKind: import('../spellAuthorityState').Dnd5eSpellAuthorityRecordKindV1
      linkedObjectProfile?: 'instant-summons' | 'secret-chest'
      /** Requires a Host-reloaded inventory instance and records its stable id. */
      requiresSelectedInventoryItem?: true
      /** Clone uses 120 days = 172,800 campaign minutes. */
      maturesAfterMinutes?: number
    }
  | {
      id: string
      /** Applies a closed transition to a previously established durable spell record. */
      kind: 'transition-spell-authority'
      target: Dnd5eActivityOperationTargetV1
      recordKind: 'linked-planar-object' | 'soul-vessel' | 'terrain-merge'
      linkedObjectProfile?: 'instant-summons' | 'secret-chest'
      transition:
        | 'recall-to-source'
        | 'send-to-ethereal'
        | 'possess-target'
        | 'return-to-vessel'
        | 'return-to-body'
        | 'exit-merged-terrain'
    }
  | {
      id: string
      /** Applies a bounded Host inventory mutation to the command-selected item instance. */
      kind: 'identify-inventory-item'
      target: 'actor'
    }
  | {
      id: string
      /** Clears poison/disease contamination from the command-selected food or drink instance. */
      kind: 'purify-inventory-item'
      target: 'actor'
    }
  | {
      id: string
      /**
       * Breaks attunement to the command-selected inventory instance without
       * deleting its curse metadata. Used by Remove Curse and reusable by
       * workshop content; the selected item must belong to this target.
       */
      kind: 'break-inventory-item-attunement'
      target: 'actor' | 'target' | 'all-targets'
      requireCursedMagicItem: true
    }
  | {
      id: string
      /** Emits a Host-owned audible event from the activity actor. */
      kind: 'emit-sound'
      target: 'actor'
      label: string
      audibleRadiusFeet: number
    }
  | {
      id: string
      /**
       * Opens a bounded Host communication channel. The Activity target and
       * map authority still own range and line-of-effect; content cannot name
       * an arbitrary account or bypass a wall with a callback.
       */
      kind: 'open-communication'
      target: 'target'
      medium: 'magical-whisper'
      requiresTargetLanguage: boolean
      allowsImmediateReply: boolean
    }
  | {
      id: string
      /**
       * Mutates a mapped door or obstacle-token object selected through the
       * ordinary point/area targeting boundary. Content never supplies an
       * object id directly.
       */
      kind: 'modify-map-object-lock'
      mode: 'arcane-lock' | 'knock'
      targetKinds: readonly ('door' | 'obstacle')[]
      /** Arcane Lock may designate creatures and optionally accept a spoken password. */
      accessPolicy?: 'selected-creatures-and-password'
      /** Knock suppresses Arcane Lock for ten minutes (100 combat rounds). */
      suppressionMinutes?: number
    }
  | {
      id: string
      /**
       * Attaches a Host-owned light source to the mapped object selected by
       * ordinary point/area targeting. Moving obstacle tokens carry the light;
       * fixed geometry objects receive a durable geometry light entity.
       */
      kind: 'enchant-map-object-light'
      brightRadiusFeet: number
      dimRadiusFeet: number
      color: string
      /** Omitted means the enchantment lasts until explicitly removed. */
      durationMinutes?: number
    }
  | {
      id: string
      /** Clears poison/disease markers from every mapped food/drink object in the validated area. */
      kind: 'purify-map-consumables'
      contaminants: readonly ('poison' | 'disease')[]
    }
  | {
      id: string
      kind: 'dispel-area'
      target: 'actor'
      areaKind: 'magical-darkness'
      radiusFeet: Dnd5eFormulaV1
      maximumSpellLevel: Dnd5eFormulaV1
    }
  | {
      id: string
      kind: 'command-owned-companion'
      target: 'target'
      command: 'attack' | 'dash' | 'disengage' | 'dodge' | 'help'
    }
  | {
      id: string
      kind: 'grant-weapon-attack'
      target: 'actor'
      /** Stable key overwritten by another grant with the same id. */
      grantId: string
      label: string
      economy: 'bonus-action' | 'none'
      expires: 'turn-end'
      /** Number of attacks authorized by this single grant. */
      attacks?: number
      weaponModes?: readonly ('melee' | 'ranged')[]
      weaponIds?: readonly string[]
      requiredWeaponProperties?: readonly string[]
      forbiddenWeaponProperties?: readonly string[]
      proficient?: boolean
      /** Replaces only the base weapon dice for this granted attack. */
      damageDice?: { count: number; sides: number }
      /** Replaces the damage type when the granted attack is consumed. */
      damageType?: Dnd5eDamageType
      /** Adds a deterministic flat bonus to this granted attack's damage. */
      damageBonus?: number
      /** Which equipped hand may satisfy this grant. Omitted means either hand. */
      weaponSlots?: readonly ('main-hand' | 'off-hand')[]
    }
  | {
      id: string
      kind: 'grant-basic-action'
      target: 'actor'
      grantId: string
      label: string
      economy: 'bonus-action'
      expires: 'turn-end'
      actions: readonly Dnd5eActivityBasicActionGrantActionV1[]
      shovePushDistanceBonusFeet?: number
    }
  | {
      id: string
      kind: 'create-persistent-area'
      label: string
      instanceCount?: number
      durationRounds: number
      /** Host-persisted until an explicit dispel or DM removal. */
      permanent?: true
      concentration: boolean
      /** Highest matching spell-slot profile replaces duration and concentration. */
      castLevelProfiles?: readonly {
        minimumCastLevel: number
        durationRounds: number
        permanent?: true
        concentration: boolean
        /** Replaces the base occupant modifiers for this cast level and above. */
        occupantModifiers?: Dnd5ePersistentAreaOccupantModifiers
      }[]
      color?: string
      visual?: Dnd5ePersistentAreaVisual
      lighting?: Dnd5ePersistentAreaLighting
      utilityProjectionId?: string
      /** Requires the selected anchor to resolve to a Host-mapped door or obstacle. */
      mappedObjectEnchantment?: 'magic-mouth'
      /** Generic Host-owned area lifecycle shared by spells, features, items and monsters. */
      triggers?: readonly Dnd5ePersistentAreaTriggerDeclaration[]
      movement?: Dnd5ePersistentAreaMovementDeclaration
      lifecycle?: Dnd5ePersistentAreaTurnLifecycle
      movementCostMultiplier?: number
      obscuration?: Dnd5ePersistentAreaObscuration
      occupantModifiers?: Dnd5ePersistentAreaOccupantModifiers
      blocking?: Dnd5ePersistentAreaBlocking
      /** Host validates all live occupants before committing the area. */
      creationConstraints?: {
        maximumCreatureCount?: number
        maximumCreatureSizeRank?: number
        /** Reject before settlement when any occupied cell overlaps this core spell area. */
        forbidCoreSpellOverlap?: string
      }
      /** Host-resolved permanent Hallow policy; choice ids never enter saved map state. */
      hallow?: {
        effectChoiceId: string
        damageTypeChoiceId: string
        scopeChoiceId: string
        wardExemptionChoiceIds: Readonly<Record<
          'celestial' | 'elemental' | 'fey' | 'fiend' | 'undead',
          string
        >>
      }
      /** Host resolves the selected natural-terrain appearance and persists it with the area. */
      hallucinatoryTerrain?: {
        appearanceChoiceId: string
      }
      /** Host resolves the closed portions of a Programmed Illusion declaration. */
      programmedIllusion?: {
        formChoiceId: string
        triggerSenseChoiceId: string
      }
      /** Closed combat-facing facts for a spell-created entity that is not a creature summon. */
      entityProfile?: {
        armorClass: number
        hitPoints: number | 'actor-max-hit-points'
        strength: number
        dexterity?: number
        cannotAttack: boolean
        invisible: boolean
      }
      /** Host-validated creatures selected at cast time are exempt from every declared area trigger. */
      triggerExemptions?: 'selected-creatures'
      /** Overrides the target-derived default without allowing arbitrary anchors. */
      anchorMode?: 'fixed' | 'source-token' | 'target-token'
      sourceExitBehavior?: 'remove-area'
      /** A source-anchored ward ends if moving its source would enclose an affected creature. */
      sourceOverlapBehavior?: 'remove-area'
      teleportationExitSavingThrow?: {
        ability: AbilityKey
        dc: number | 'source-save-dc'
      }
      /** Current eligible occupants add this damage to each weapon hit. */
      weaponHitBonusDamage?: Dnd5ePersistentAreaWeaponHitBonusDamage
      /** Active controls granted by the authoritative area entity. */
      grantedActivities?: readonly Dnd5ePersistentAreaGrantedActivity[]
      /**
       * Optional Host-owned map entity anchored to the area. This is a closed
       * presentation/vision contract, not an arbitrary Token payload supplied
       * by content. It is used by movable sensors and spell projections.
       */
      effectToken?: {
        label: string
        emoji?: string
        color?: string
        size?: number
        hiddenBody?: boolean
        /** The token body is rendered only for the source character and DM. */
        visibleToSourceOnly?: boolean
        shareVisionWithSource?: boolean
        visionRangeFeet?: number
        darkvisionRangeFeet?: number
      }
      /** Makes the independent effect token follow its source under bounded Host pathfinding. */
      sourceFollower?: {
        stationaryWithinFeet: number
        maximumSeparationFeet: number
        maximumStepHeightFeet?: number
        carryingCapacityPounds?: number
      }
    }
  | {
      id: string
      kind: 'invoke-activity'
      activityId: string
      target: 'actor' | 'target'
      repeat: Dnd5eFormulaV1
    }
  | Dnd5eActivityMechanicOperationV1
  | {
      id: string
      kind: 'manual-adjudication'
      prompt: string
      reason: string
      requiresDmApproval: true
    }

export interface Dnd5eActivityOutcomeV1 {
  id: string
  when: Dnd5eActivityOutcomeWhenV1
  operations: readonly Dnd5eActivityOperationV1[]
}

export interface Dnd5eActivityScalingV1 {
  basis: 'character-level' | 'class-level' | 'slot-level' | 'proficiency-bonus' | 'custom-table'
  classId?: string
  baseLevel?: number
  /** Optional cap for bounded upcasting or progression tables. */
  maximumSteps?: number
  /** Adds to an area target's radius for every resolved scaling step. */
  areaRadiusFeetPerStep?: number
  table?: readonly { level: number; value: number | string }[]
  adjustments?: readonly {
    operationId: string
    diceCountPerStep?: number
    flatAmountPerStep?: number
    additionalTargetsPerStep?: number
    additionalProjectilesPerStep?: number
    additionalUsesPerStep?: number
    durationRoundsPerStep?: number
  }[]
  notes?: string
}

/**
 * Binds one unified Activity to an audited Host primitive. The binding contains
 * no executable content: ids and the closed mechanic discriminator are checked
 * again by the authority before it delegates to a built-in or room-owned Host
 * transaction.
 */
export type Dnd5eActivityAuthorityBindingV1 =
  | {
      kind: 'declarative-subclass-mechanic'
      subclassId: string
      abilityId: string
      mechanicKind: NonNullable<DeclarativeSubclassAbilityV1['mechanic']>['kind']
      execution: 'plugin-headless-action' | 'headless-event-engine'
      /** Present only when the ordinary trusted plugin action is the executor. */
      actionId?: string
    }
  | {
      /** Native core spell Activity delegated to the audited Host spell transaction. */
      kind: 'core-spell-transaction'
      spellId: string
      execution: 'headless-event-engine'
    }

export interface Dnd5eActivityDefinitionV1 {
  schemaVersion: typeof DND5E_ACTIVITY_SCHEMA_VERSION
  id: string
  name: string
  description?: string
  activation: Dnd5eActivityActivationV1
  invocation?: Dnd5eActivityInvocationV1
  target: Dnd5eActivityTargetV1
  /**
   * Highest matching spell-slot profile replaces `target` before UI selection,
   * roll declaration and authoritative execution. This covers non-linear
   * higher-slot wording such as Etherealness (self / 3 / 6 creatures) without
   * trusting a client-supplied target limit.
   */
  castLevelTargetProfiles?: readonly {
    minimumCastLevel: number
    target: Dnd5eActivityTargetV1
  }[]
  requirements?: readonly Dnd5ePredicateV1[]
  consumption?: readonly Dnd5eActivityConsumptionV1[]
  checks?: readonly Dnd5eActivityCheckV1[]
  /** Closed player/DM decisions. Commands submit option ids; the Host validates them here. */
  choices?: readonly Dnd5eActivityChoiceDefinitionV1[]
  outcomes: readonly Dnd5eActivityOutcomeV1[]
  effects?: readonly Dnd5eEffectDefinitionV1[]
  triggers?: readonly Dnd5eTriggerDefinitionV1[]
  scaling?: readonly Dnd5eActivityScalingV1[]
  automation: AutomationCapability
  /** Host-owned execution route for closed mechanics that cannot be flattened into generic outcome operations. */
  authorityBinding?: Dnd5eActivityAuthorityBindingV1
  /** Traceability only. Runtime execution never dispatches on this locator. */
  legacySource?: {
    kind: 'spell' | 'feature' | 'feat' | 'item' | 'class' | 'subclass' | 'subclass-ability' |
      'race' | 'background' | 'monster' | 'monster-action' | 'custom-headless-action'
    id: string
    /** Host-authored source fact used by antimagic and similar suppression zones. */
    magical?: boolean
  }
}
