import type { AutomationCapability } from '../../../domain/automation/automationCapability'
import type { AbilityKey } from '../../../lib/dnd'
import type { Dnd5eStandardConditionId } from '../conditions'
import type { Dnd5eDamageType } from '../damageTypes'
import type {
  Dnd5ePersistentAreaMovementDeclaration,
  Dnd5ePersistentAreaDirectionalMovementDeclaration,
  Dnd5ePersistentAreaModeDeclaration,
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
      /** An explicit decline also consumes the exact single-use granting effect. */
      releaseSingleUseGrantOnDecline?: true
      /** Only a grant created by the execution that produced this Host event may authorize it. */
      effectGrantScope?: 'trigger-execution'
      /** End a single-use grant when its temporary-HP or Activity completion event batch finishes. */
      expireGrantAtWindowEnd?: true
    }

export type Dnd5eActivityEventSourceV1 = (
  | {
      kind: 'attack'
      /** Original target of this authoritative attack, unaffected by Activity selection. */
      targetId?: string
      projectileAttackSnapshot?: import('./dnd5eActivityWeaponAttackGrant').Dnd5eProjectileAttackSnapshotV1
      magical?: boolean
      /** Host snapshot; later attacks cannot reuse the same movement. */
      precedingStraightMovementFeet?: number
      id?: string
      activityId?: string
      mode: 'melee' | 'ranged' | 'spell' | 'unarmed'
      /** Host-derived weapon/spell attack classification, including unarmed weapon attacks. */
      category?: 'weapon' | 'spell'
      delivery?: 'melee' | 'ranged'
      crossedInitialSpaceTags?: readonly string[]
      result?: 'hit' | 'miss' | 'critical-hit' | 'critical-miss'
      damageType?: Dnd5eDamageType
      weaponId?: string
      /** Host-resolved equipment type, distinct from the owned inventory instance. */
      weaponBaseId?: string
      weaponCategory?: 'simple' | 'martial'
      /** Original Host attack dice, before critical doubling; never re-read from current equipment. */
      weaponDamageDice?: { count: number; sides: number }
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
  | { kind: 'spell'; id: string; activityId?: string; level: number; school?: import('../spellbook').Dnd5eSpellbookSchoolId; castingClassId?: string }
  | { kind: 'skill'; id: string; activityId?: string }
  | { kind: 'item' | 'feature' | 'action'; id: string; activityId?: string }
  | {
      kind: 'movement'
      id?: string
      distanceFeet: number
      /** Host-committed contiguous horizontal straight movement in the same turn. */
      straightDistanceFeet?: number
      completed: boolean
      /** Host-derived movement provenance; absence is deliberately not voluntary. */
      movementKind?: 'voluntary' | 'mounted' | 'forced' | 'teleport'
      /** Actual distance to the source after a Host map movement is committed. */
      distanceFromSourceFeet?: number
      crossedInitialSpaceTags?: readonly string[]
      sourceActorId?: string
      activityId?: string
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
) & Dnd5eActivityEventIdentityV1 & {
  /** Committed damage facts are available for spell/feature/item sources too. */
  damage?: {
    amount: number
    temporaryHitPointsBefore: number
    temporaryHitPointsAfter: number
    damageTypes?: readonly Dnd5eDamageType[]
  }
}

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
      /** Opt-in single-target damaging attacks may also select authored physical objects. */
      allowObjectAttack?: true
      /** Explicit room-wide same-plane companion lookup for rest HP transfers. */
      roomCompanion?: { bondKey: string; sourceActivityId: string }
      /** Host must obtain explicit consent from every selected target's controller. */
      requiresWilling?: boolean
      /** Host-confirmed facts specific to this casting, never inferred from client claims. */
      requiredQualifications?: readonly import('./dnd5eActivityTargetQualifications').Dnd5eActivityTargetQualificationV1[]
      /** These creatures receive no checks or effects; other selected creatures still resolve. */
      excludedCreatureTypes?: readonly string[]
      /** Skip all checks/effects for creatures immune to any listed condition. */
      excludedConditionImmunities?: readonly Dnd5eStandardConditionId[]
      /** Inclusive Host ability-score bounds; nonqualifying targets receive no checks/effects. */
      minimumAbilityScores?: Partial<Record<AbilityKey, number>>
      maximumAbilityScores?: Partial<Record<AbilityKey, number>>
      /** Measure the effect from the weapon's current holder, retaining caster target selection. */
      effectOrigin?: {effectId:string;rangeFeet:number}
      /** Measure creature range from the Host-owned granting area's anchor, not its edge. */
      rangeOrigin?: 'actor' | 'granting-area'
      /** Host validates both the selected target and the chosen scene object against the live grant. */
      requiresInsideGrantingArea?: true
      mappedObjectOrigin?: { naturalFeature: 'rock'; withinGrantingArea: true }
      /** This Activity's attacks have advantage against occupants of its own granting area. */
      attackAdvantageInsideGrantingArea?: true
      relation: 'ally' | 'enemy' | 'any'
      rangeFeet?: number
      minimumRangeFeet?: number
      /** Every pair of selected creatures must be within this Host-measured distance. */
      maximumTargetSeparationFeet?: number
      count: number
      /** Defaults to one. Zero allows optional victims while actor effects still resolve. */
      minimumCount?: number
      includeSelf?: boolean
      allowDuplicateTargets?: boolean
      /** Host checks perception from each selected creature back to the actor. */
      requiresTargetSeeActor?: boolean
      /** Host sighting history; supported retention is at most sixty seconds. */
      requiresSeenWithinSeconds?: number
      requiresLineOfSight?: boolean
      requiresLineOfEffect?: boolean
    }

  | {
      kind: 'area'
      /** These creatures receive no checks or effects; other occupants still resolve. */
      excludedCreatureTypes?: readonly string[]
      /** Skip all checks/effects for occupants immune to any listed condition. */
      excludedConditionImmunities?: readonly Dnd5eStandardConditionId[]
      minimumAbilityScores?: Partial<Record<AbilityKey, number>>
      maximumAbilityScores?: Partial<Record<AbilityKey, number>>
      relation: 'ally' | 'enemy' | 'any'
      /** event-target anchors a triggered area on the Host-authored event target. */
      origin: 'self' | 'point' | 'event-target'
      shape: 'circle' | 'sphere' | 'cone' | 'line' | 'cube' | 'cylinder' | 'rect'
      placeRangeFeet?: number
      /** Measure placement range from the owned area granting this activity. Sight remains actor-based. */
      rangeOrigin?: 'actor' | 'granting-area'
      /** Ground anchors match terrain; sky anchors require authored outdoor, uncovered air and sight. */
      placementSurface?: 'ground' | 'sky'
      /** Host confirms a narrative fact about this exact point before casting. */
      placementQualification?: { prompt: string }
      /** Point sphere bottom must stay between terrain and this height; omitted elevation rests on terrain. */
      maximumBottomHeightAboveGroundFeet?: number
      /** A point projectile detonates at the first Host-mapped solid on its path. */
      projectileImpact?: 'first-solid'
      radiusFeet?: number
      /** Hollow cylinder: radial thickness measured inward from the outer radius. */
      wallThicknessFeet?: number
      lengthFeet?: number
      widthFeet?: number
      heightFeet?: number
      minimumRadiusFeet?: number
      minimumLengthFeet?: number
      minimumWidthFeet?: number
      minimumHeightFeet?: number
      /** Omit when the rule affects every eligible creature in the area. */
      maximumTargets?: number
      includeSelf?: boolean
      /** Requires this many feet of creature-sized square around the selected anchor to be empty. */
      unoccupiedAnchorSizeFeet?: number
      /** Snap rectangular planar coverage to an exact whole-cell footprint. */
      gridAligned?: boolean
      /** Excludes the creature used as the event-target anchor from the area result. */
      excludeEventTarget?: boolean
      /** A triggered event-centered effect asks its owner to choose one eligible creature. */
      selection?: 'choose-one' | 'choose-any'
      /** Minimum explicitly chosen area occupants; defaults to zero for choose-any. */
      minimumTargets?: number
      rotatable?: boolean
      /** Explicit opt-in to pitch/roll of a rectangular volume. */
      tiltable?: boolean
      /** Only occupants whose feet touch Host-authored terrain make checks or receive effects. */
      requiresGroundContact?: true
      /** Filter occupants by the actor's perception, independently of anchor visibility. */
      requiresVisibleTargets?: boolean
      requiresLineOfSight?: boolean
      requiresLineOfEffect?: boolean
      /** Follow reachable paths around corners within the radius; never cross closed barriers. */
      spreadsAroundCorners?: boolean
      /** Propagation excludes only opaque physical cover; placement retains its own line-of-effect rule. */
      propagationCover?: 'opaque-only'
      /** Repeats the same template at independently selected Host anchors. */
      instanceCount?: number
      minimumInstanceCount?: number
      /** Every anchor after the first must join the existing set by one full face. */
      instanceAdjacency?: 'face'
    }

export interface Dnd5eActivityAreaPlacementV1 {
  x: number
  y: number
  /** Untrusted face reference. Host reconstructs the actual surface from map geometry. */
  verticalSurface?: { entityId: string; edgeIndex: number; centerFraction: number }
  elevationFeet?: number
  angleDegrees?: number
  pitchDegrees?: number
  rollDegrees?: number
  objectLaunchPitchDegrees?: number
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
  | { kind: 'resource'; resourceId: string; amount: Dnd5eFormulaV1; consumeOn: 'confirm' | 'hit' | 'resolve' | 'dm-approval';
      /** Selected casting cost, consumed once independently of the number of targets. */
      whenChoice?: { choiceId: string; optionIds: readonly string[] } }
  | {
      kind: 'item-charge'
      resourceId: string
      amount: Dnd5eFormulaV1
      consumeOn: 'confirm' | 'hit' | 'resolve'
      /** Catalog allowlist for feature/feat Activities that consume a selected inventory item. */
      itemTemplateIds?: readonly string[]
    }
  /** hit-die resourceId is hit-die:d6/d8/d10/d12 and spends the real character pool. */
  | { kind: 'ammo'; resourceId: string; amount: Dnd5eFormulaV1; consumeOn: 'confirm' | 'hit' | 'resolve' }
  | { kind: 'hit-die'; resourceId: string; amount: Dnd5eFormulaV1; consumeOn: 'confirm' | 'hit' | 'resolve';
      whenChoice?: { choiceId: string; optionIds: readonly string[] };
      /** Cap all Hit Dice spent by this execution at floor(total maximum dice * fraction). */
      maximumTotalFraction?: number }
  | { kind: 'hp' | 'movement'; amount: Dnd5eFormulaV1; consumeOn: 'confirm' | 'resolve' }

export type Dnd5eActivityCheckV1 =
  | {
      id: string
      kind: 'attack-roll'
      /** Attack category is independent of whether the granting content is a spell or feature. */
      attackType?: 'spell' | 'weapon'
      /** Resolve separately for each explicitly ordered projectile. */
      perProjectile?: true
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
      /** These creature types do not make this save; other outcomes may still affect them. */
      excludedCreatureTypes?: readonly string[]
      /** Advantage only for observers who identified the authoritative granting illusion. */
      advantageIfIllusionRecognized?: true
      /** Resolve separately for each explicitly ordered projectile. */
      perProjectile?: true
      rollId: string
      ability: AbilityKey
      abilityOptions?: readonly AbilityKey[]
      dc: Dnd5eFormulaV1
      rollMode?: 'normal' | 'advantage' | 'disadvantage' | 'host-derived'
      rollModeByCreatureType?: {
        creatureTypes: readonly string[]
        mode: 'advantage' | 'disadvantage'
      }
      /** Exact Host stat-block identities, never token names or broad creature types. */
      rollModeByStatBlock?: {
        statBlockIds: readonly string[]
        mode: 'advantage' | 'disadvantage'
      }
      rollModeBySizeRank?: {
        minimum?: number
        maximum?: number
        mode: 'advantage' | 'disadvantage'
      }
      /** Charm-like saves may automatically succeed for immune targets. */
      automaticSuccessIfConditionImmune?: Dnd5eStandardConditionId
      /** Host communication facts cause success, not an ineligible action. */
      automaticSuccessIfCannotHearSource?: true
      automaticSuccessIfNoSharedLanguage?: true
      /** Environmental exposure only; protected targets automatically pass this save. */
      environmentalHazard?: import('../environmentalProtection').Dnd5eEnvironmentalHazard
      /** Willing/allied targets waive the save and follow the failed-save outcome. */
      automaticFailureIfAllied?: boolean
      /** Only a current Host-derived charm from this Activity's actor waives the save. */
      automaticFailureIfCharmedByActor?: true
      /** Host-confirmed target consent, independent of team/controller. */
      allowWillingFailure?: boolean
      /** Additive save modifiers from closed, Host-validated choices. */
      modifierByChoice?: readonly { choiceId: string; modifiers: Readonly<Record<string, number>> }[]
      /** Different known controllers; this alone does not establish that the creatures are fighting. */
      rollModeIfOpposed?: 'advantage' | 'disadvantage'
      /** Per-target Host assessment; false permits a normal save, missing assessment blocks resolution. */
      rollModeByHostFact?: import('./dnd5eActivitySaveFacts').Dnd5eActivitySaveFactV1
      /** Skip this check unless the selected closed mode is one of these options. */
      appliesWhenChoice?: { choiceId: string; optionIds: readonly string[] }
      /** Resolve this save only after the named earlier attack check succeeds. */
      appliesWhenCheck?: { checkId: string; result: 'success' }
      /** Resolve in Host target order, stopping after the first failed save. */
      stopAfterFirstFailure?: true
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
      /** Resolve this caster check only in the selected closed mode. */
      appliesWhenChoice?: { choiceId: string; optionIds: readonly string[] }
    }
  | {
      id: string
      /** Two independent Host d20 recipes; ties favor target unless explicitly declared. */
      kind: 'opposed-ability-check'
      tiesFavor?: 'source' | 'target'
      rollId: string
      opposedRollId: string
      sourceAbility: AbilityKey | 'spellcasting'
      /** Skill context for Host advantage/disadvantage. A direct skill-modifier reference implies this value. */
      sourceSkill?: string
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
      /** Per-target random table opened only after an earlier saving throw settles. */
      appliesWhenSave?: { checkId: string; result: 'success' | 'failure' }
      /** Skip this per-target table unless the Host effective speed meets this threshold. */
      minimumTargetSpeedFeet?: number
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
  /** Host rolls first, then the DM selects an installed creature from the matching CR band. */
  dmSelection?: { afterCheckId: string; challengeRatingByTotal: readonly {
    minimum: number; maximum: number; maximumChallengeRating: number
  }[] }
  textInput?: { maximumLength: number; maximumWords?: number; format?: 'hex-color' | 'surface-drawing' }
  optionsFrom?: 'actor-languages' | 'actor-hit-dice' | 'actor-hit-die-count' | 'srd-beast-forms' | 'srd-monsters' | 'installed-monsters' | 'combat-creatures'
  /** Quantity options use integer-string IDs; each is bounded by this real pool. */
  hitDieSides?: 6 | 8 | 10 | 12
  /** Declared branch ceiling, default 20. Does not authorize unavailable dice. */
  hitDieMaximumCount?: number
  monsterFilter?: { creatureTypes?: readonly string[]; subtype?: string; maximumChallengeRating?: number }
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
  | { id: string; kind: 'secondary-weapon-damage'; target: 'actor'; damageOperationId: string; rangeFeet: number; requiresLineOfSight: boolean }
  | { id:string;kind:'reaction-follow';target:'actor';pushOperationId:string;movementBudget:'walking-speed';targetRadiusFeet:number }
  | {
      id: string
      kind: 'damage'
      /** Adjacent typed components of one save-damage occurrence; amount is before this multiplier. */
      damageGroup?: { id: string; multiplier: 0.5 | 1 }
      target: Dnd5eActivityOperationTargetV1
      /** Roll damage independently for each explicitly ordered projectile. */
      perProjectile?: true
      amount: Dnd5eFormulaV1
      /** Independent damage pool for each distinct creature; does not permit repeat targets. */
      perTarget?: true
      damageType: Dnd5eDamageType | 'inherit-primary'
      /** Extra dice from the triggering weapon hit; amount must be constant zero. */
      weaponDiceFromTrigger?: { rollId: string; count: number }
      /** Add Host base weapon damage to amount, then apply the multiplier and round down. */
      equipmentWeaponDamage?: { rollId: string; weaponBaseIds: readonly string[]; multiplier?: 0.5 | 1 }
      /** Attribute settled damage to the authoritative granting Effect's source. */
      damageSource?: 'grant-source'
      /** Select the type directly from a declared choice whose option ids are damage types. */
      damageTypeChoiceId?: string
      /** Derives the type from an actual Host die; the choice selects only its index. */
      damageTypeFromRoll?: { rollId: string; indexChoiceId: string; types: readonly Dnd5eDamageType[] }
      critical?: 'normal' | 'double-dice'
      /** Explicit rules-only damage that bypasses immunity/resistance and reductions. */
      cannotBeReduced?: boolean
      /** Destroy remains only if this damage actually kills, never merely at zero HP. */
      destroysBodyOnDeath?: boolean
      magical?: boolean
      /** Only on actual death, and only when Host anatomy confirms this part exists. */
      destroysBodyPartOnDeath?: import('../lethalBodyPart').Dnd5eLethalBodyPartDestruction
    }
  | { id: string; kind: 'healing'; target: Dnd5eActivityOperationTargetV1; amount: Dnd5eFormulaV1;
      /** Select another Host creature to receive healing; amount still refers to the Activity target. */
      recipientChoice?: { choiceId: string; rangeFeet: number }
      /** Replaces a zero amount with prior Host-settled damage, including defenses/reduction. */
      damageResult?: { operationId: string; subject: 'actor' | 'target'; multiplier: number }
    }
  | { id: string; kind: 'reveal-target-location'; target: 'target' }
  | { id: string; kind: 'read-damage-traits'; target: 'target' }
  | { id: string; kind: 'detect-planar-portal'; target: 'actor'; rangeFeet: number }
  | { id: string; kind: 'temporary-hit-points'; target: Dnd5eActivityOperationTargetV1; amount: Dnd5eFormulaV1; sourceEffectId?: string; replacement?: 'replace' }
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
  | { id: string; kind: 'recognize-granting-disguise'; target: 'target' }
  | { id: string; kind: 'restore-original-alignment'; target: Dnd5eActivityOperationTargetV1 }
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
      /** Bind fear to a Host-validated creature choice while retaining the author. */
      frightenedSourceChoiceId?: string
      /** Bind charm to a Host-validated creature while retaining the author and duration. */
      charmedSourceChoiceId?: string
      /** Host distance from the affected creature to the selected condition entity. */
      conditionSourceMaximumDistanceFeet?: number
      /** Preserve the single target's identity on an effect applied to the actor. */
      captureTargetIdentity?: true
      /** Use only the captured identity of the exact single-use granting effect. */
      disguiseFromGrant?: true
      /** Personal before-damage reactions only; applies after the triggering damage finishes. */
      timing?: 'after-triggering-damage'
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
  | { id: string; kind: 'reduce-hit-point-maximum'; target: Dnd5eActivityOperationTargetV1;
      amount: Dnd5eFormulaV1; owningEffectId: string; minimumMaximum?: number }
  | { id: string; kind: 'transfer-hit-point-maximum'; target: Dnd5eActivityOperationTargetV1;
      amount: Dnd5eFormulaV1; owningEffectId: string; beneficiaryEffectId: string;
      minimumMaximum?: number; increaseCurrentHp?: boolean; linkLifetimes?: boolean; protectLinkedLifetime?: true }
  | { id: string; kind: 'resource'; subject: 'actor' | 'target'; resourceId: string; mode: 'spend' | 'restore'; amount: Dnd5eFormulaV1 }
  | {
      id: string
      kind: 'move'
      /** Refuse teleport when the Host inventory exceeds the target's carrying capacity. */
      requiresWithinCarryingCapacity?: true
      optionalCompanion?: import('../teleportCompanion').Dnd5eTeleportCompanionPolicy
      target: Dnd5eActivityOperationTargetV1
      /** The installed activity declares harmful intent; transport payloads cannot override it. */
      harmful?: true
      mode: 'push' | 'pull' | 'forced' | 'voluntary' | 'teleport' | 'swap' | 'ascend' | 'descend'
      /** Direction only; actor range limits remain measured from the actor. */
        directionOrigin?: 'actor' | 'area-center'
        /** Host-derived exact cardinal displacement; blocked destinations leave the target in place. */
        cardinalDirection?: 'north' | 'east' | 'south' | 'west'
        /** Positional movement must change the target's map anchor. */
        requiresDifferentDestination?: true
        /** Move to a neighboring map space; distanceFeet remains the reserved movement budget. */
        destinationPolicy?: 'adjacent-space'
      distanceFeet: Dnd5eFormulaV1
      maximumDistanceFromActorFeet?: number
      /** Teleport destination must adjoin a previously selected continuation target. */
      continuationTargetRadiusFeet?: number
      /** Host-derived vertical endpoint. `area-top` uses the validated Activity area volume; `ground` uses terrain elevation. */
      verticalDestination?: 'area-top' | 'ground'
      /** Ascend only as far as the first mapped solid permits; damage remains a separate declared outcome. */
      stopAtMappedObstacle?: true
      /** Host chooses the farthest legal destination in the declared direction. */
      placement?: 'host-automatic-maximum'
      originIllumination?: readonly ('dim' | 'darkness' | 'magical-darkness')[]
      destinationIllumination?: readonly ('dim' | 'darkness' | 'magical-darkness')[]
      requiresLineOfSight?: boolean
      /** The actor must perceive the exact teleport destination with its current senses. */
      requiresVisibleDestination?: boolean
      ignoresOpportunityAttacks?: boolean
       /** Self-directed vertical or voluntary movement spends the declared distance budget. */
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
      /** Reject a destination with the same map anchor cell as the current area. */
      requiresDifferentAnchor?: boolean
      /** Preserve unused distance for further movement in this same Host turn. */
      retainMovementBudget?: true
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
      /** Shortens the owned granting rectangle about its center; zero ends its source area. */
      kind: 'shrink-granting-area'
      target: 'actor'
      lengthFeet: Dnd5eFormulaV1
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
      kind: 'change-granting-area-mode'
      /** Reorient environmental direction from the Host's area selection without moving its footprint. */
      direction?: 'area-orientation'
      target: 'actor'
      change: 'select' | 'pause' | 'resume'
      modeId?: string
      modeChoiceId?: string
    }
  | {
      id: string
      /** Switches the source creature's senses between itself and the granting area's effect token. */
      kind: 'set-granting-area-senses'
      target: 'actor'
      mode: 'source' | 'projection' | 'projection-sight' | 'projection-hearing'
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
      /** Removes the actor-owned granting area without running detonation triggers. */
      kind: 'dismiss-granting-area'
      target: 'actor'
    }
  | {
      id: string
      kind: 'summon'
      /** Grants a spell-equivalent summon benefit without a spell-cast event or slot cost. */
      spellEffectSourceId?: string
      placementRangeFeet?: number
      requiresVisiblePlacement?: boolean
      /** Summon from a target actually killed by this earlier damage operation. */
      afterDamageKillOperationId?: string
      /** Explicit campaign-clock delay used only when cast outside combat. */
      explorationDelaySeconds?: number
      /** Persistent creatures from separate casts may coexist. */
      independentPersistent?: true
      /** Animate each selected mundane, unattached map object instead of placing a new creature. */
      animatedObjectSize?: 'tiny' | 'small' | 'medium' | 'large' | 'huge'
      corpseFormChoiceId?: string
      /** Select an installed monster ID from this activity's declared choice options. */
      monsterChoiceId?: string
      bondKey?: string
      /** Prevent these bond keys from coexisting across packages, including dismissed bonds. */
      exclusiveBondKeys?: readonly string[]
      /** Reject creation while any living creature in this persistent bond remains, including dismissed ones. */
      existingBondPolicy?: 'reject-living'
      protectiveCircle?:boolean
      bondDismissActivityId?: string
      bondActivityIds?:readonly string[]
      understandsCasterLanguage?: boolean
      languageChoiceId?: string
      telepathyRangeFeet?: number
      controlSave?: { ability: AbilityKey; dc: Dnd5eFormulaV1; disadvantage?: boolean; lingerDieSides?: number }
      uncontrolledLinger?: import('../summonedControl').Dnd5eSummonLingerPolicy
      maximumChallengeRating?: Dnd5eFormulaV1
      /** Require an unconsumed inventory material tag `${prefix}:${resolvedMonsterId}`. */
      requiredMonsterMaterialTagPrefix?: string
      requiredCreatureSubtype?: string
      groupInitiative?: boolean
      autonomousBehavior?: 'attack-nearest-visible' | 'attack-nearest-other-subtype' | 'protect-source'
      commandPolicy?: 'persistent-order' | 'turn-order'
      monsterId: string
      count: Dnd5eFormulaV1
      timing: 'immediate' | 'source-next-turn-start'
      /** Required for temporary summons; omit for persistent:true (no elapsed-time expiry). */
      durationRounds?: number
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
  shareSelfSpellsRequiresMounted?: boolean
  creatureTypeOverride?: 'celestial' | 'fey' | 'fiend'
  minimumIntelligence?: number
      /** Prevents every attack-like Headless action while preserving Dodge, Help and movement. */
      cannotAttack?: boolean
      /** Overrides the summoned stat block's walking speed. */
      walkingSpeedFeet?: Dnd5eFormulaV1
      /** Any positive damage starts this many-round delayed dismissal. */
      dismissAfterDamageRounds?: number
      /** A confirmed source death causes one instant-death effect, preserving a corpse. */
      sourceDeathBehavior?: 'die'
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
      maximumChallengeRating: 'target-level-or-challenge-rating' | 'target-half-level-or-challenge-rating' | number
      hitPointMode?: 'replace' | 'retain-with-form-temporary-hp'
      allowWillingShapechanger?: boolean
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
      kind: 'alter-inventory-item'
      target: 'actor' | 'target'
      /** Select physical objects from Host-validated nearby inventories. Requires actor target. */
      selectionRangeFeet?: number
      includeGroundItems?: true
      /** Host selects only these original physical templates; never a client supplied item. */
      originalTemplateIds: readonly string[]
      templateId: string
      quantity: Dnd5eFormulaV1
      /** Physical conversion, without a reversible effect lease. */
      permanent?: true
      sourceEffectId?: string
      captureSpellcastingModifier?: boolean
    }
  | {
      id: string
      kind: 'exchange-inventory-items'
      /** Registered output choices; Host still enforces the exchange policy. */
      templateOptions?: string[]
      /** Discover installed templates under the policy, including later imported packages. */
      templateSource?: import('../inventoryExchange').Dnd5eInventoryExchangeTemplateSource
      /** When set, output must be placed in an empty scene cell within this range. */
      sceneRangeFeet?: number
      target: 'actor'
      templateId: string
      quantity: Dnd5eFormulaV1
      policy: import('../inventoryExchange').Dnd5eInventoryExchangePolicy
    }
  | {
      id: string
      /** Host-authoritative inventory grant with a durable command receipt. */
      kind: 'grant-inventory-item'
      target: 'actor'
      /** Equip a single granted weapon into an empty hand; never replace existing gear. */
      equipToFreeHand?: true
      /** The actor effect applied by this execution owns the generated items. */
      sourceEffectId?: string
      reuseSourceEffect?: boolean
      captureSpellcastingModifier?: boolean
      maximumPerSource?: number
      templateId: string
      templateVariants?: readonly { minimumCastLevel: number; templateId: string }[]
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
      /** Required only for benefit-history; stored on the recipient, not the caster. */
      benefitKey?: string
      /** Explicitly share the declared benefit identity across imported packages. */
      benefitScope?: 'package' | 'ruleset'
      /** Renew only after certified death of prior co-recipients; no arbitrary reset. */
      benefitRenewal?: { kind: 'recipient-death'; match: 'any' | 'all' }
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
      medium: 'magical-whisper' | 'telepathy'
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
  | { id: string; kind: 'enchant-map-weapon'; effectId: string }
  | { id: string; kind: 'ignite-area-fuel' }
  | { id: string; kind: 'extinguish-area-flames'; groundSpreadFeet: number }
  | {
      id: string
      /** Host resolves the independent entity occupying the selected point. */
      kind: 'affect-persistent-entity'
      amount: Dnd5eFormulaV1
      damageType: Dnd5eDamageType
      savingThrow?: { ability: AbilityKey; dc: Dnd5eFormulaV1 }
      conditions?: readonly string[]
    }
  | { id: string; kind: 'control-map-water'; change: import('../controlledWater').Dnd5eWaterIntent; rules?: import('../controlledWater').Dnd5eWaterRules }
  | { id: string; kind: 'control-map-flame'; change: import('../controlledFlame').Dnd5eFlameIntent; requireAreaOrigin?: boolean }
  | {
      id: string
      /** Host selects the mapped object at the point anchor and traces its flight. */
      kind: 'launch-map-object'
      limits: import('../mapObjectFlight').Dnd5eMapObjectFlightLimits
      savingThrowCheckId?: string
      /** Push away from the actor without saves, impact damage or off-map projectiles. Requires zero amount. */
      harmlessPush?: true
      amount: Dnd5eFormulaV1
      damageType: 'bludgeoning'
    }
  | {
      id: string
      kind: 'transfer-loose-earth'
      maximumSideFeet: number
      distanceFeet: number
      depthFeet?: number
    }
  | {
      id: string
      /** Clears poison/disease markers from every mapped food/drink object in the validated area. */
      kind: 'convert-map-inventory-item'
      originalTemplateIds: readonly string[]
      templateId: string
      /** Permanent conversion of one selected physical stack; no effect lease. */
      quantity: number
    }
  | {
      id: string
      kind: 'protect-map-remains'
      durationMinutes: number
      minimumPower: 'wish'
    }
  | {
      id: string
      kind: 'purify-map-consumables'
      contaminants: readonly ('poison' | 'disease')[]
    }
  | {
      id: string
      /** Kills explicitly classified nonmagical plant objects in the validated area. */
      kind: 'wither-map-vegetation'
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
      /** Require an explicit target and Help kind in the submitted command. */
      requiresHelpTarget?: true
      task?: import('../companionTask').Dnd5eCompanionTask; ready?: import('../companionReady').Dnd5eCompanionReady
      /** Allow the controller to supply a bounded perceptible trigger, retaining the declared action kind. */
      allowsReadyTrigger?: true
      allowsTaskDescription?: true
      requiresObjectInteraction?: true
      /** Require an actor-selected attack target, validated and retained by the Host. */
      requiresAttackTarget?: true
      /** Bind an explicit special attack instead of permitting weapon substitution. */
      attackKind?: import('../companionAttackKind').Dnd5eCompanionAttackKind
      /** Attack visible hostile intruders within a selected persistent guard region. */
      requiresGuardArea?: true
      /** Optional per-recipient destination, executed on that creature's own turn. */
      allowsMovementDestination?: true
      requiresSpeech?:boolean
      /** A single voluntary order after control loss; requires trusted DM approval. */
      voluntaryAfterControlEnds?: true
      controlSaveDisadvantage?:boolean
      sourceActivityId?: string
      target: 'target'
      command: 'attack' | 'dash' | 'disengage' | 'dodge' | 'help' | 'hide' | 'use-object' | 'ready' | 'task'
    }
  | {
      id: string
      /** Ends command authority without dismissing the creature or ending concentration. */
      kind: 'end-owned-companion-control'
      target: 'target'
      sourceActivityId: string
      requiresSpeech?: boolean
      /** Omit when losing command authority does not itself change allegiance. */
      becomesHostile?: boolean
    }
  | { id: string; kind: 'dismiss-owned-temporary-summons'; sourceActivityIds: readonly string[] }
  | { id:string; kind:'dismiss-owned-summon'; bondKey:string; releaseBond?:boolean }
  | {
      id: string
      kind: 'grant-weapon-attack'
      /** Additional attack remains part of the action that emitted the trigger. */
      inheritTriggerAttackOrigin?: true
      available?: 'immediate' | 'next-own-turn'
      bindTriggerTarget?: true
      separateByTarget?: true
      attackAdvantage?: true
      attackResourceCost?: { resourceId: string; amount: number }
      /** Bind a follow-up to another target near the triggering attack target. */
      differentTargetWithinFeetOfEventTarget?: number
      /** Reuses the Host-recorded missed ranged projectile; no second ammunition cost. */
      reuseMissedProjectile?: true
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
      /** Evaluated by Host when granting; added once to the attack damage. */
      damageBonus?: number | Dnd5eFormulaV1
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
      labelTextChoiceId?: string
      colorTextChoiceId?: string
      drawingTextChoiceId?: string
      ignitesUnattendedFuel?: true
      label: string
      /** Create independently damageable entities at each selected area anchor. */
      separateSelectedInstances?: true
      /** Clip a ground entity's height against mapped solids and creatures it is lifting. */
      clipHeightToMappedSolids?: true
      bindRestraintEffectIds?: readonly string[]
      /** Keep the lasting area on the terrain surface even when the initial spell affects a volume. */
      groundOnly?: true
      /** Filter residual ground cells by Host-authored surface material at creation. */
      surfaceMaterials?: readonly import('../../../lib/mapGeometry').MapGeometrySurfaceMaterial[]
      /** Reject the cast unless every selected ground cell has an allowed material. */
      requireAllSurfaceMaterials?: true
      /** Require explicit Host-authored nonmagical classification on all selected ground. */
      requireNonmagicalSurfaceMaterials?: true
      /** Transform explicitly authored material volume below the selected ground surface. */
      materialTransformation?: { mode: 'rock-to-mud' | 'mud-to-rock' | 'ceiling-rock-to-mud'; depthFeet: number | 'selected-height' }
      /** Validate material on a solid top at placement height rather than ground level. */
      surfaceAtPlacementElevation?: true
      normalGroundTerrain?: true
      /** Hand-clearing rate; requires permanent, fixed, non-concentration ground terrain. */
      terrainClearing?: import('../../../../shared/terrain-clearing.mjs').TerrainClearing
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
      /** Host-resolved recipe for a generated fortress; never supplied by a player command. */
      structureServices?: { mealTemplateId: string; furnishings?: {templateId:string;size:number}[] }
      /** Requires the selected anchor to resolve to a Host-mapped door or obstacle. */
      mappedObjectEnchantment?: 'magic-mouth'
      /** Generic Host-owned area lifecycle shared by spells, features, items and monsters. */
      triggers?: readonly Dnd5ePersistentAreaTriggerDeclaration[]
      movement?: Dnd5ePersistentAreaMovementDeclaration
      lifecycle?: Dnd5ePersistentAreaTurnLifecycle
      modes?: readonly Dnd5ePersistentAreaModeDeclaration[]
      initialModeId?: string
      initialModeChoiceId?: string
      directionalMovementCost?: Dnd5ePersistentAreaDirectionalMovementDeclaration
      movementCostMultiplier?: number
      /** Movement cost applies only while the live source touches its Host terrain surface. */
      movementRequiresGroundedSource?: boolean
      /** Exempts only the source's movement cost, not other occupant effects. */
      movementGroundCover?: import('../persistentAreaGroundCover').Dnd5ePersistentAreaGroundCover
      movementExcludesSource?: boolean
      extinguishesUnprotectedFlames?: 'torch-or-smaller'
      /** Extinguish ordinary flames around the area's ground impact when it ends. */
      endFlameExtinguishRadiusFeet?: number
      excludesWindDispersibleGas?: boolean
      obscuration?: Dnd5ePersistentAreaObscuration
      /** Remove this area when overlapping an active strong-wind area. */
      dispersedByStrongWind?: boolean
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
      symbolMode?: import('../symbolSpell').SymbolMode
      programmedIllusion?: {
        formChoiceId: string
        triggerSenseChoiceId: string
      }
      /** Closed combat-facing facts for a spell-created entity that is not a creature summon. */
      /** Independent illusion: no AC/HP, automatic misses/saves and damage/condition immunity. */
      projectionDefense?: 'untouchable-illusion'
      investigationDc?: 'source-save-dc'
      /** Hidden physical area discovered by the declared search skill at the captured source DC. */
      discovery?: { skill: 'perception' | 'investigation'; dc: 'source-save-dc' }
      entityProfile?: {
        material?: import('../entityMaterial').Dnd5eEntityMaterial
        /** Attacks fail regardless of roll total or natural 20. */
        attacksAutomaticallyMiss?: true
        supportsStanding?: true
        destructionTerrain?: import('../entityDestructionTerrain').Dnd5eEntityDestructionTerrain
        armorClass: number
        hitPoints: number | 'actor-max-hit-points'
        strength?: number
        dexterity?: number
        cannotAttack: boolean
        invisible: boolean
      }
      /** Host-validated creatures selected at cast time are exempt from every declared area trigger. */
      triggerExemptions?: 'selected-creatures'
      /** Overrides the target-derived default without allowing arbitrary anchors. */
      anchorMode?: 'fixed' | 'source-token' | 'target-token'
      sourceExitBehavior?: 'remove-area'
      /** Bind to the authenticated rest-start session; end with that session. */
      bindToRestSession?: true
      concealsFlameLightFromOutside?: true
      /** Invisible region: retain Host mechanics without exposing its outline to players. */
      hiddenFromPlayers?: true
      /** Host chooses the source character's last long-rest location on this plane. */
      teleportationPortal?: { destination: 'last-long-rest' }
      /** Ends this area when its authoritative source is incapacitated. */
      /** Area owner may spend a reaction to grant one attack against an occupant advantage. */
      /** Optional chosen-occupant healing after the source spends a spell slot and heals. */
      sourceSlotSpellHealing?: { amount: Dnd5eFormulaV1 }
      creatureDetectionAdvantage?: 'source-and-allies'
      attackAdvantageReaction?: 'area-source'
      sourceIncapacitatedBehavior?: 'remove-area'
      /** Check modifiers owned by the area's source, only while this area exists. */
      sourceAbilityCheckRules?: readonly import('../abilityCheckRules').Dnd5eAbilityCheckRule[]
      /** A source-anchored ward ends if moving its source would enclose an affected creature. */
      sourceOverlapBehavior?: 'remove-area'
      sourceLimit?: import('../persistentAreaSourceLimit').Dnd5ePersistentAreaSourceLimit
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
        /** Project the source's current visual ranges rather than fixed sensor ranges. */
        visionFromSource?: true
        /** Listen using the source creature's hearing, independently of sight. */
        hearingFromSource?: true
        /** Host binds the sensor to exactly one selected creature. */
        followSelectedTarget?: true
        sensorSense?: 'sight' | 'hearing'
        /** Invisible image of the exact linked target saved by the granting effect. */
        linkedTargetProjection?: true
        /** Host chooses a mapped same-plane location and confirms the narrative memory fact. */
        remotePlacement?: { memoryPrompt: string }
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
      /** Rules costs settle normally; the narrative answer remains with the DM. */
      kind: 'narrative-prompt'
      prompt: string
    }
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
  basis: 'character-level' | 'class-level' | 'slot-level' | 'proficiency-bonus' | 'ability-modifier' | 'custom-table'
  ability?: AbilityKey
  /** Class-level basis requires this; custom-table uses this class instead of total level when present. */
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
    /** Increases the first formula dice pool's sides; persistent dice use the same increment. */
    diceSidesPerStep?: number
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
  /** Host equipment projectile route; unreachable targets consume the shot without checks/effects. */
  equipmentHomingProjectile?: true
  /** Consume one attack from the Host's shared Attack action budget. Not a spell cast. */
  usesAttackActionAttack?: true
  /** A feature casts this registered spell; its own Activity declares the cost and effects. */
  spellInvocation?: { spellId: string; castAtLevel: number; operationIds: readonly string[] }
  /** Only spell Activities: maintain this target distance throughout observed casting. */
  castingConstraints?: import('../castingProximity').Dnd5eCastingConstraints
  continuation?: import('./dnd5eActivityContinuation').Dnd5eActivityContinuationDefinitionV1
  /** This Activity may only run from a Host-owned continuation of this root. */
  requiresContinuationFrom?: string
  /** Ownership of the parent spell/feature does not bypass a temporary grant. */
  requiresEffectGrant?: true
  /** Host-scoped self-drop triggers or automatic effect-granted bound-HP retaliation may execute while unable to act. */
  usableWhileIncapacitated?: true
  /** Successful use of a single-use grant also ends that grant's named source concentration. */
  endsGrantSourceConcentration?: true
  /** Finite charges consumed from the authorizing actor-owned Effect on success. Defaults to one. */
  effectGrantChargeCost?: number
  /** Spell concentration starts only when this cast leaves a concentration Effect. */
  concentrationRequiresEffect?: true
  carriedRollIds?: readonly string[]
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

