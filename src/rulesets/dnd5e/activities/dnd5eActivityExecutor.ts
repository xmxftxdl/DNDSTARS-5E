import type { AbilityKey } from '../../../lib/dnd'
import type { Dnd5eStandardConditionId } from '../conditions'
import { DND5E_DAMAGE_TYPES, type Dnd5eDamageType } from '../damageTypes'
import { dnd5eFleshToStoneTargetHasFlesh } from '../fleshToStone'
import type {
  Dnd5eActiveEffectBreakTrigger,
  Dnd5eActiveEffectModifiers,
  Dnd5eActiveEffectStackingPolicy,
} from '../activeEffects'
import type {
  Dnd5eActivityAreaInstanceV1,
  Dnd5eActivityAreaPlacementV1,
  Dnd5eActivityCheckV1,
  Dnd5eActivityConsumptionV1,
  Dnd5eActivityDefinitionV1,
  Dnd5eActivityOperationTargetV1,
  Dnd5eActivityOperationV1,
  Dnd5eActivityTriggerContextV1,
} from './dnd5eActivityContracts'
import {
  dnd5eActivityChoiceIsRelevantV1,
  dnd5eActivityWithTargetChoicesV1,
} from './dnd5eActivityChoices'
import type {
  Dnd5eEffectDefinitionV1,
  Dnd5eEffectDurationV1,
  Dnd5ePredicateV1,
} from './dnd5eEffectContracts'
import {
  Dnd5eFormulaEvaluationError,
  evaluateDnd5eFormulaV1,
  type Dnd5eFormulaActorSnapshot,
  type Dnd5eFormulaEvaluationContext,
  type Dnd5eFormulaRollResult,
  type Dnd5eFormulaV1,
} from './dnd5eFormula'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import type { Dnd5eActivityBasicActionGrantActionV1 } from './dnd5eActivityBasicActionGrant'
import {
  dnd5eActivityAutomationAnalysisV1,
  resolveDnd5eMechanicOperationV1,
} from '../plugins/pluginMechanicsRegistry'
import {
  dnd5eContextPredicateSatisfiedV1,
  matchDnd5eActivityInvocationV1,
  type Dnd5eActivityConfirmedByV1,
} from './dnd5eActivityInvocation'
import { scaleDnd5eActivityDefinitionV1 } from './dnd5eActivityScaling'
import { hashDnd5eArcaneLockPasswordV1 } from '../mapObjectState'
import type { Dnd5eMagicMouthConfigV1 } from '../magicMouth'
import {
  DND5E_BESTOW_CURSE_SPELL_DAMAGE_ROLL_ID,
  dnd5eBestowCurseSpellDamageRiderAppliesV1,
} from './dnd5eActivityRollRecipe'

export interface Dnd5eActivityHeldItemSnapshotV1 {
  itemId: string
  roles: readonly ('weapon' | 'shield' | 'spellcasting-focus' | 'other')[]
  weaponMode?: 'melee' | 'ranged'
  weaponProperties?: readonly string[]
  proficient?: boolean
}

export interface Dnd5eActivityEquipmentSnapshotV1 {
  armorCategory: 'none' | 'light' | 'medium' | 'heavy'
  armorProficient: boolean
  armorProficiencies: readonly ('light' | 'medium' | 'heavy' | 'shield')[]
  mainHand?: Dnd5eActivityHeldItemSnapshotV1
  offHand?: Dnd5eActivityHeldItemSnapshotV1
  freeHands: 0 | 1 | 2
}

export interface Dnd5eActivityActorSnapshot extends Dnd5eFormulaActorSnapshot {
  id: string
  /** Immutable Host stat-block identity used only by closed Activity predicates. */
  statBlockId?: string
  name?: string
  controller: string
  armorClass: number
  /** Tiny=0 through Gargantuan=5. */
  sizeRank?: number
  creatureType?: string
  illumination?: 'bright' | 'dim' | 'darkness' | 'magical-darkness'
  airborne?: boolean
  canRemainAirborne?: boolean
  conditions: readonly Dnd5eStandardConditionId[]
  conditionImmunities?: readonly Dnd5eStandardConditionId[]
  savingThrowModifiers?: Partial<Record<AbilityKey, number>>
  savingThrowProficiencies?: readonly AbilityKey[]
  activeEffectDefinitionIds?: readonly { definitionId: string; sourceActorId?: string }[]
  abilityCheckModifiers?: Partial<Record<AbilityKey, number>>
  skillCheckModifiers?: Readonly<Record<string, number>>
  /** Immutable Host equipment projection used only by closed Activity predicates. */
  equipment?: Dnd5eActivityEquipmentSnapshotV1
  spellcasting?: { capable: boolean; classIds: readonly string[] }
  successfulSpellSaveNegatesDamage?: boolean
  /** Spell damage dice of these types treat a natural 1 as 2. */
  elementalAdeptDamageTypes?: readonly Dnd5eDamageType[]
  /** Host-derived from active effects; only healing formula dice are maximized. */
  maximizeHealingDice?: boolean
  /** Universal numeric modifier applied to attack rolls, saving throws and ability checks. */
  d20RollModifier?: number
  /** Source-relative sensory fact supplied by the Host for this execution. */
  canHearActivitySource?: boolean
  /** Transient map-derived fact: spell effects cannot operate on this snapshot. */
  magicSuppressed?: boolean
  /** Spell-level barriers that currently contain this snapshot. */
  spellSuppressionAreas?: readonly { areaId: string; maximumSpellLevel: number }[]
  /** Host-derived summon ownership; never accepted from a player payload. */
  summonedSourceCombatantId?: string
  summonedPersistent?: boolean
}

export type Dnd5eActivityRollMode = 'normal' | 'advantage' | 'disadvantage'

export interface Dnd5eActivityExecutionInput {
  activity: Dnd5eActivityDefinitionV1
  actor: Dnd5eActivityActorSnapshot
  targets: readonly Dnd5eActivityActorSnapshot[]
  /** Host-owned full encounter projection for bounded source-effect cleanup. */
  combatants?: readonly Dnd5eActivityActorSnapshot[]
  castLevel?: number
  /** Host-owned elapsed time before a long-cast Activity takes effect. */
  completionDelayRounds?: number
  rolls: Readonly<Record<string, Dnd5eFormulaRollResult>>
  /** Host-resolved checks exposed only to registered core mechanic handlers. */
  resolvedChecks?: readonly Dnd5eActivityCheckResult[]
  checkRollModes?: Readonly<Record<string, Dnd5eActivityRollMode>>
  distanceFeetByTargetId?: Readonly<Record<string, number>>
  areaPlacement?: Dnd5eActivityAreaPlacementV1
  areaPlacementDistanceFeet?: number
  /** Host-validated creature ids selected separately from geometric area occupants. */
  areaExemptTargetIds?: readonly string[]
  /** Optional cast-time phrase. Only its normalized digest may leave this resolver. */
  secretPhrase?: string
  /** Host-normalized open text for the closed Magic Mouth map operation. */
  magicMouth?: Dnd5eMagicMouthConfigV1
  projectileTargetIds?: readonly string[]
  parentDamageType?: Dnd5eDamageType
  choices?: Readonly<Record<string, string>>
  usedTurnKeys?: ReadonlySet<string>
  dmApproved?: boolean
  /** Host-owned event envelope. Never accept this object from a client payload. */
  triggerContext?: Dnd5eActivityTriggerContextV1
  confirmedBy?: Dnd5eActivityConfirmedByV1
  /** Host-validated selection from the inventory command boundary. */
  inventoryInstanceId?: string
  /** Host-validated durable spell record selected by an inventory-bound control. */
  spellAuthorityRecordId?: string
  /** Host-only replay override after an attack was redirected to an attack-decoy effect. */
  forcedAttackMissCheckKeys?: ReadonlySet<string>
  /** Host already validated a critical-sized shared formula pool. */
  allowCriticalDiceSuperset?: boolean
}

export interface Dnd5eActivityCheckResult {
  key: string
  checkId: string
  kind?: Dnd5eActivityCheckV1['kind']
  targetId?: string
  /** The actual ability used after resolving a target-favorable ability choice. */
  ability?: AbilityKey
  skill?: string
  rollMode?: Dnd5eActivityRollMode
  d20: number
  modifier: number
  total: number
  /** Resolved target number for attack rolls, saving throws and fixed-DC checks. */
  dc?: number
  success: boolean
  /** Explains a deterministic outcome whose d20 was not used for adjudication. */
  automaticOutcome?: 'condition-immunity-success' | 'allied-unresisted-failure'
  criticalSuccess: boolean
  criticalFailure: boolean
  opposedD20?: number
  opposedModifier?: number
  opposedTotal?: number
  opposedAbility?: AbilityKey
  opposedSkill?: string
}

export type Dnd5eResolvedActivityConsumption =
  | Extract<Dnd5eActivityConsumptionV1, { kind: 'action-economy' | 'spell-slot' }>
  | { kind: 'resource' | 'ammo' | 'hit-die'; resourceId: string; amount: number; consumeOn: 'confirm' | 'hit' | 'resolve' | 'dm-approval' }
  | { kind: 'item-charge'; resourceId: string; amount: number; consumeOn: 'confirm' | 'hit' | 'resolve'; itemTemplateIds?: readonly string[] }
  | { kind: 'hp' | 'movement'; amount: number; consumeOn: 'confirm' | 'resolve' }

export type Dnd5eResolvedEffectDuration =
  | Exclude<Dnd5eEffectDurationV1, { kind: 'save-ends' }>
  | {
      kind: 'save-ends'
      maximumRounds: number
      timing: 'target-turn-start' | 'target-turn-end'
      ability: AbilityKey
      dc: number
      requiresSourceNotVisible?: boolean
      damageOnFailure?: {
        count: number
        sides: number
        modifier?: number
        type: Dnd5eDamageType
      }
      successesRequired?: number
      failuresRequired?: number
      initialSuccesses?: number
      initialFailures?: number
      onFailureThreshold?:
        | { outcome: 'retain-effect' }
        | {
            outcome?: 'replace-condition'
            replaceWithCondition: Dnd5eStandardConditionId
            duration: 'permanent' | 'source-concentration-then-permanent'
          }
    }

export type Dnd5eActivityCapabilityProposal =
  | { kind: 'deal-damage'; operationId: string; targetId: string; amount: number; damageType: Dnd5eDamageType; magical: boolean }
  | {
      kind: 'heal'
      operationId: string
      targetId: string
      amount: number
      /** Host-resolved dice retained so the visible combat log can audit healing formulas. */
      diceAudit?: readonly { rollId: string; count: number; sides: number; values: readonly number[] }[]
      /** The resolved total minus the displayed dice (constants/references/formula transforms). */
      formulaAdjustment?: number
    }
  | {
      kind: 'revive'
      operationId: string
      targetId: string
      hitPoints: number
      maximumDeathAgeRounds?: number
      excludesDeathFromOldAge?: boolean
      requiresFreeWillingSoul?: boolean
      excludedCreatureTypes?: readonly string[]
      requiresBody?: boolean
      restoreBody?: 'missing-parts' | 'complete'
      removeConditions?: readonly Dnd5eStandardConditionId[]
      removeDiseases?: 'nonmagical' | 'all'
      removeCurses?: 'all'
      createsNewBodyIfMissing?: boolean
      requiresSpokenNameIfBodyMissing?: boolean
      newBodyPlacementRangeFeet?: number
      /** Host-owned casting delay included in corpse-age eligibility at completion. */
      completionDelayRounds?: number
      longRestPenalty?: { initial: number; recoveryPerLongRest: number }
      casterLongRestStrainAfterDeathAgeRounds?: number
    }
  | { kind: 'grant-temporary-hit-points'; operationId: string; targetId: string; amount: number }
  | { kind: 'stabilize'; operationId: string; targetId: string }
  | { kind: 'instant-death'; operationId: string; targetId: string }
  | { kind: 'stand-up'; operationId: string; targetId: string; usesTargetReactionIfAvailable: true }
  | { kind: 'apply-standard-condition'; operationId: string; targetId: string; condition: Dnd5eStandardConditionId; duration: Dnd5eResolvedEffectDuration }
  | {
      kind: 'apply-effect'
      operationId: string
      targetId: string
      effectId: string
      name: string
      disposition?: 'buff' | 'debuff'
      tags?: readonly string[]
      grantedActivities?: readonly string[]
      duration: Dnd5eResolvedEffectDuration
      conditions: readonly Dnd5eStandardConditionId[]
      extensionCondition?: string
      modifierGroups: readonly Dnd5eActiveEffectModifiers[]
      breakOn?: readonly Dnd5eActiveEffectBreakTrigger[]
      sourceLink?: import('../activeEffects').Dnd5eActiveEffectRemoval['sourceLink']
      suspendWhileEffectId?: string
      repeatSaveOnDamage?: Pick<
        import('../activeEffects').Dnd5eActiveEffectRepeatSave,
        'ability' | 'dc' | 'onDamage' | 'onSuccess'
      >
      repeatSaveAfterMovement?: Pick<
        import('../activeEffects').Dnd5eActiveEffectRepeatSave,
        'ability' | 'dc' | 'onSuccess'
      >
      escapeCheck?: import('../activeEffects').Dnd5eActiveEffectEscapeCheck
      escapeSavingThrow?: import('../activeEffects').Dnd5eActiveEffectEscapeSavingThrow
      removalAction?: NonNullable<import('../activeEffects').Dnd5eActiveEffectRemoval['action']>
      onDamageCondition?: import('../activeEffects').Dnd5eActiveEffectOnDamageCondition
      afterEffectEnds?: import('../activeEffects').Dnd5eActiveEffectAfterEffectEnds
      periodicDamage?: import('../activeEffects').Dnd5eActiveEffectPeriodicDamage
      periodicHealing?: import('../activeEffects').Dnd5eActiveEffectPeriodicHealing
      bodyRestoration?: import('../activeEffects').Dnd5eActiveEffectBodyRestoration
      calendarRepeatSave?: import('../activeEffects').Dnd5eActiveEffectCalendarRepeatSave
      planarBanishment?: {
        foreignCreatureTypes: readonly string[]
        foreignDuration: 'permanent'
        localDurationRounds: number
      }
      magical?: boolean
      /** The Host owns concentration even when the effect also uses a repeat-save duration. */
      concentration: boolean
      persistAfterConcentrationCompletes?: boolean
      stacking: Dnd5eActiveEffectStackingPolicy
      /** Remove the same effect previously applied by this source, even from a different target. */
      exclusiveBySource?: boolean
      exclusiveGroup?: string
    }
  | { kind: 'remove-standard-condition'; operationId: string; targetId: string; condition: Dnd5eStandardConditionId; sourceCreatureTypes?: readonly string[] }
  | { kind: 'remove-effect'; operationId: string; targetId: string; effectId: string; source: 'self' | 'any' }
  | { kind: 'remove-effects-by-tag'; operationId: string; targetId: string; tags: readonly string[]; match: 'any' | 'all'; source: 'self' | 'any'; sourceCreatureTypes?: readonly string[]; maximumCount?: number }
  | { kind: 'adjust-exhaustion'; operationId: string; targetId: string; amount: number }
  | { kind: 'lower-ability-score'; operationId: string; targetId: string; ability: AbilityKey; maximumScore: number; recovery: 'restoration-magic'; recoveryGroupId?: string }
  | { kind: 'recover-ability-score'; operationId: string; targetId: string; ability: AbilityKey; maximumCount?: number }
  | { kind: 'recover-hit-point-maximum'; operationId: string; targetId: string; maximumCount?: number }
  | { kind: 'spend-resource' | 'restore-resource'; operationId: string; subjectId: string; resourceId: string; amount: number }
  | { kind: 'move'; operationId: string; targetId: string; mode: 'push' | 'pull' | 'teleport' | 'swap' | 'ascend' | 'descend'; distanceFeet: number; verticalDestination?: 'area-top' | 'ground'; placement?: 'host-automatic-maximum'; originIllumination?: readonly ('dim' | 'darkness' | 'magical-darkness')[]; destinationIllumination?: readonly ('dim' | 'darkness' | 'magical-darkness')[]; requiresLineOfSight?: boolean; ignoresOpportunityAttacks?: boolean; usesActorMovement?: boolean; usesTargetReactionIfAvailable?: boolean; provokesOpportunityAttacks?: boolean }
  | { kind: 'set-directional-command'; operationId: string; actorId: string; commandKey: string; angleDegrees: number }
  | {
      kind: 'relocate-granting-area'
      operationId: string
      targetId: string
      maximumFeet: number
      interposition?: 'clear' | 'blocked' | 'difficult-terrain'
    }
  | { kind: 'reshape-granting-area'; operationId: string; targetId: string; maximumFeet?: number }
  | { kind: 'set-granting-area-senses'; operationId: string; targetId: string; mode: 'source' | 'projection' }
  | { kind: 'detonate-granting-area'; operationId: string; actorId: string }
  | {
      kind: 'transform-creature'
      operationId: string
      targetId: string
      formId: string
      profile: 'polymorph' | 'true-polymorph' | 'animal-shapes' | 'shapechange'
      durationRounds: number
      permanent?: true
      permanentAfterConcentrationCompletes?: true
      concentration: boolean
      maximumChallengeRating: 'target-level-or-challenge-rating' | number
      maximumSizeRank?: number
      equipmentDisposition?: 'drop' | 'merge' | 'wear'
      seenConfirmed?: boolean
      requiresExistingSourceActivityId?: string
    }
  | {
      kind: 'grant-extra-turns'
      operationId: string
      actorId: string
      turns: number
      freezeOtherCreatures: true
      endOnAffectOther: boolean
      maximumDistanceFromOriginFeet?: number
    }
  | {
      kind: 'duplicate-creature'
      operationId: string
      sourceActorId: string
      targetId: string
      profile: 'simulacrum'
      persistent: true
      level: number
      proficiencyBonus: number
      abilities: Readonly<Record<AbilityKey, number>>
      armorClass: number
      maximumHitPoints: number
      speed: number
      sizeRank: number
      creatureType?: string
      saveDc?: number
      classLevels?: Readonly<Record<string, number>>
      resources: Readonly<Record<string, { current: number; maximum: number }>>
      cannotIncreaseLevel: true
      cannotRegainSpellSlots: true
    }
  | {
      kind: 'grant-inventory-item'
      operationId: string
      actorId: string
      templateId: string
      quantity: number
      identified: boolean
      expiresAfterMinutes?: number
    }
  | {
      kind: 'establish-spell-authority'
      operationId: string
      sourceActivityId: string
      sourceActorId: string
      targetId: string
      recordKind: import('../spellAuthorityState').Dnd5eSpellAuthorityRecordKindV1
      linkedObjectProfile?: 'instant-summons' | 'secret-chest'
      inventoryInstanceId?: string
      spellLevel?: number
      maturesAfterMinutes?: number
    }
  | {
      kind: 'transition-spell-authority'
      operationId: string
      sourceActivityId: string
      sourceActorId: string
      targetId: string
      recordKind: 'linked-planar-object' | 'soul-vessel' | 'terrain-merge'
      linkedObjectProfile?: 'instant-summons' | 'secret-chest'
      authorityRecordId?: string
      transition: 'recall-to-source' | 'send-to-ethereal' | 'possess-target' | 'return-to-vessel' | 'return-to-body' | 'exit-merged-terrain'
    }
  | {
      kind: 'identify-inventory-item'
      operationId: string
      actorId: string
    }
  | {
      kind: 'purify-inventory-item'
      operationId: string
      actorId: string
    }
  | {
      kind: 'break-inventory-item-attunement'
      operationId: string
      ownerId: string
      requireCursedMagicItem: true
    }
  | {
      kind: 'emit-sound'
      operationId: string
      actorId: string
      label: string
      audibleRadiusFeet: number
    }
  | {
      kind: 'open-communication'
      operationId: string
      actorId: string
      targetId: string
      medium: 'magical-whisper'
      requiresTargetLanguage: boolean
      allowsImmediateReply: boolean
    }
  | {
      kind: 'modify-map-object-lock'
      operationId: string
      mode: 'arcane-lock' | 'knock'
      targetKinds: readonly ('door' | 'obstacle')[]
      spellLevel: number
      authorizedTargetIds?: readonly string[]
      passwordDigest?: string
      suppressionMinutes?: number
    }
  | {
      kind: 'purify-map-consumables'
      operationId: string
      contaminants: readonly ('poison' | 'disease')[]
    }
  | {
      kind: 'summon'
      operationId: string
      monsterId: string
      count: number
      timing: 'immediate' | 'source-next-turn-start'
      durationRounds: number
      concentration: boolean
      side: 'ally' | 'enemy'
      persistent?: boolean
      /** True Polymorph keeps the creature only when the full concentration duration completes. */
      persistAfterConcentrationCompletes?: boolean
      /** The creature remains for the original duration but becomes hostile when concentration ends. */
      becomesHostileAfterConcentrationEnds?: boolean
      /** Host-derived bonus applied when the map token is created. */
      temporaryHitPoints?: number
      minimumMaximumHitPoints?: number
      maximumHitPointBonus?: number
      armorClassBonus?: number
      weaponAttackBonus?: number
      weaponDamageBonus?: number
      savingThrowBonus?: number
      proficientSkillCheckBonus?: number
      weaponAttacksMagical?: boolean
      attacksPerAction?: number
      shareSelfSpellsRangeFeet?: number
      cannotAttack?: boolean
      walkingSpeedFeet?: number
      dismissAfterDamageRounds?: number
    }
  | {
      kind: 'create-persistent-area'
      operationId: string
      label: string
      instanceCount?: number
      durationRounds: number
      permanent?: true
      concentration: boolean
      color?: string
      visual?: import('../persistentAreaTypes').Dnd5ePersistentAreaVisual
      lighting?: import('../persistentAreaTypes').Dnd5ePersistentAreaLighting
      utilityProjectionId?: string
      triggers?: readonly import('../persistentAreaTypes').Dnd5ePersistentAreaTriggerDeclaration[]
      movement?: import('../persistentAreaTypes').Dnd5ePersistentAreaMovementDeclaration
      lifecycle?: import('../persistentAreaTypes').Dnd5ePersistentAreaTurnLifecycle
      movementCostMultiplier?: number
      obscuration?: import('../persistentAreaTypes').Dnd5ePersistentAreaObscuration
      occupantModifiers?: import('../persistentAreaTypes').Dnd5ePersistentAreaOccupantModifiers
      blocking?: import('../persistentAreaTypes').Dnd5ePersistentAreaBlocking
      creationConstraints?: {
        maximumCreatureCount?: number
        maximumCreatureSizeRank?: number
        forbidCoreSpellOverlap?: string
      }
      hallow?: import('../persistentAreaTypes').Dnd5eHallowAreaState
      hallucinatoryTerrain?: import('../persistentAreaTypes').Dnd5eHallucinatoryTerrainAreaState
      programmedIllusion?: import('../persistentAreaTypes').Dnd5eProgrammedIllusionAreaState
      entityProfile?: {
        armorClass: number
        hitPoints: number
        strength: number
        dexterity?: number
        cannotAttack: boolean
        invisible: boolean
      }
      triggerExemptTargetIds?: readonly string[]
      anchorMode?: 'fixed' | 'source-token' | 'target-token'
      sourceExitBehavior?: 'remove-area'
      sourceOverlapBehavior?: 'remove-area'
      teleportationExitSavingThrow?: {
        ability: AbilityKey
        dc: number | 'source-save-dc'
      }
      weaponHitBonusDamage?: import('../persistentAreaTypes').Dnd5ePersistentAreaWeaponHitBonusDamage
      grantedActivities?: readonly import('../persistentAreaTypes').Dnd5ePersistentAreaGrantedActivity[]
      effectToken?: {
        label: string
        emoji?: string
        color?: string
        size?: number
        hiddenBody?: boolean
        visibleToSourceOnly?: boolean
        shareVisionWithSource?: boolean
        visionRangeFeet?: number
        darkvisionRangeFeet?: number
      }
      sourceFollower?: {
        stationaryWithinFeet: number
        maximumSeparationFeet: number
        maximumStepHeightFeet?: number
        carryingCapacityPounds?: number
      }
      areaInstance?: Dnd5eActivityAreaInstanceV1
      mappedObjectEnchantment?: 'magic-mouth'
      magicMouth?: Dnd5eMagicMouthConfigV1
    }
  | {
      kind: 'enchant-map-object-light'
      operationId: string
      brightRadiusFeet: number
      dimRadiusFeet: number
      color: string
      durationMinutes?: number
    }
  | { kind: 'dispel-area'; operationId: string; actorId: string; areaKind: 'magical-darkness'; radiusFeet: number; maximumSpellLevel: number }
  | { kind: 'command-owned-companion'; operationId: string; targetId: string; command: 'attack' | 'dash' | 'disengage' | 'dodge' | 'help' }
  | {
      kind: 'grant-weapon-attack'
      operationId: string
      grantId: string
      label: string
      economy: 'bonus-action' | 'none'
      attacks: number
      weaponModes?: readonly ('melee' | 'ranged')[]
      weaponIds?: readonly string[]
      requiredWeaponProperties?: readonly string[]
      forbiddenWeaponProperties?: readonly string[]
      proficient?: boolean
      damageDice?: { count: number; sides: number }
      damageType?: Dnd5eDamageType
      damageBonus?: number
      weaponSlots?: readonly ('main-hand' | 'off-hand')[]
    }
  | {
      kind: 'grant-basic-action'
      operationId: string
      grantId: string
      label: string
      economy: 'bonus-action'
      actions: readonly Dnd5eActivityBasicActionGrantActionV1[]
      shovePushDistanceBonusFeet?: number
    }
  | { kind: 'invoke-activity'; operationId: string; activityId: string; actorId: string; targetId?: string; repeat: number }
  | { kind: 'request-dm-adjudication'; operationId: string; prompt: string; reason: string }

export type Dnd5eActivityExecutionResult =
  | {
      ok: true
      status: 'resolved' | 'dm-adjudication-required'
      checks: readonly Dnd5eActivityCheckResult[]
      consumptions: readonly Dnd5eResolvedActivityConsumption[]
      proposals: readonly Dnd5eActivityCapabilityProposal[]
      areaInstance?: Dnd5eActivityAreaInstanceV1
    }
  | {
      ok: false
      reason: 'invalid-definition' | 'invalid-actor' | 'invalid-target' | 'requirement-failed' | 'invalid-rolls' | 'dm-approval-required' |
        'trigger-context-required' | 'trigger-mismatch' | 'confirmation-required'
      details: readonly string[]
    }

function relation(actor: Dnd5eActivityActorSnapshot, target: Dnd5eActivityActorSnapshot): 'self' | 'ally' | 'enemy' {
  if (actor.id === target.id) return 'self'
  return actor.controller === target.controller ? 'ally' : 'enemy'
}

function scaleActivity(input: Dnd5eActivityExecutionInput): {
  activity: Dnd5eActivityDefinitionV1
  additionalProjectilesByOperationId: ReadonlyMap<string, number>
} {
  return scaleDnd5eActivityDefinitionV1(input.activity, {
    actor: input.actor,
    castLevel: input.castLevel,
  })
}

function formulaContext(
  input: Dnd5eActivityExecutionInput,
  target?: Dnd5eActivityActorSnapshot,
  diceMultiplierByRollId?: Readonly<Record<string, number>>,
  minimumDieValueByRollId?: Readonly<Record<string, number>>,
  maximizeDiceRollIds?: readonly string[],
  maximumDiceMultiplierByRollId?: Readonly<Record<string, number>>,
): Dnd5eFormulaEvaluationContext {
  const rolls: Record<string, Dnd5eFormulaRollResult> = { ...input.rolls }
  if (target) {
    const suffix = `:${target.id}`
    for (const [key, value] of Object.entries(input.rolls)) {
      if (key.endsWith(suffix)) rolls[key.slice(0, -suffix.length)] = value
    }
  }
  return {
    actor: input.actor,
    target,
    castLevel: input.castLevel,
    rolls,
    diceMultiplierByRollId,
    maximumDiceMultiplierByRollId,
    minimumDieValueByRollId,
    maximizeDiceRollIds,
  }
}

function predicateSatisfied(
  predicate: Dnd5ePredicateV1,
  input: Dnd5eActivityExecutionInput,
  target?: Dnd5eActivityActorSnapshot,
): boolean {
  const contextual = dnd5eContextPredicateSatisfiedV1(predicate, input.triggerContext)
  if (contextual != null) return contextual
  const subject = 'subject' in predicate && predicate.subject === 'target' ? target : input.actor
  if (predicate.kind === 'minimum-level') return input.actor.level >= predicate.level
  if (predicate.kind === 'class-level') return (input.actor.classLevels?.[predicate.classId] ?? 0) >= predicate.minimum
  if (predicate.kind === 'damage-type') return input.parentDamageType != null && predicate.damageTypes.includes(input.parentDamageType)
  if (predicate.kind === 'size-rank') {
    if (subject?.sizeRank == null) return false
    return subject.sizeRank >= (predicate.minimum ?? 0) && subject.sizeRank <= (predicate.maximum ?? 5)
  }
  if (predicate.kind === 'creature-type') {
    if (!subject?.creatureType) return false
    const canonical = (value: string): string => {
      const normalized = value.trim().toLocaleLowerCase()
      if (normalized === 'celestial' || normalized.includes('天界')) return 'celestial'
      if (normalized === 'elemental' || normalized.includes('元素')) return 'elemental'
      if (normalized === 'fey' || normalized.includes('精类') || normalized.includes('妖精')) return 'fey'
      if (normalized === 'fiend' || normalized.includes('邪魔')) return 'fiend'
      if (normalized === 'undead' || normalized.includes('不死') || normalized.includes('亡灵')) return 'undead'
      if (normalized === 'aberration' || normalized.includes('异怪')) return 'aberration'
      if (normalized === 'construct' || normalized.includes('构装')) return 'construct'
      if (normalized === 'humanoid' || normalized.includes('类人') || normalized.includes('人型')) return 'humanoid'
      if (normalized === 'beast' || normalized.includes('野兽')) return 'beast'
      return normalized
    }
    const actual = canonical(subject.creatureType)
    return predicate.types.some((type) => canonical(type) === actual)
  }
  if (predicate.kind === 'hp-percentage') {
    if (subject?.currentHp == null || subject.maxHp == null || subject.maxHp <= 0) return false
    const percentage = (subject.currentHp / subject.maxHp) * 100
    return predicate.comparison === 'at-most' ? percentage <= predicate.value : percentage >= predicate.value
  }
  if (predicate.kind === 'hp-value') {
    if (subject?.currentHp == null) return false
    const threshold = typeof predicate.value === 'number'
      ? predicate.value
      : evaluateDnd5eFormulaV1(predicate.value, formulaContext(input, target))
    if (predicate.comparison === 'below') return subject.currentHp < threshold
    if (predicate.comparison === 'at-most') return subject.currentHp <= threshold
    if (predicate.comparison === 'at-least') return subject.currentHp >= threshold
    return subject.currentHp > threshold
  }
  if (predicate.kind === 'condition') {
    if (!subject) return false
    return subject.conditions.includes(predicate.condition) === predicate.present
  }
  if (predicate.kind === 'target-relation') {
    if (!target) return predicate.relation === 'any'
    const actual = relation(input.actor, target)
    return predicate.relation === 'any' || predicate.relation === actual || (predicate.relation === 'ally' && actual === 'self')
  }
  if (predicate.kind === 'distance') {
    if (!target) return false
    const distance = input.distanceFeetByTargetId?.[target.id]
    return distance != null && distance >= (predicate.minimumFeet ?? 0) && distance <= (predicate.maximumFeet ?? Number.POSITIVE_INFINITY)
  }
  if (predicate.kind === 'resource') {
    const resource = input.actor.resources?.[predicate.resourceId]
    if (!resource) return false
    return resource.current >= evaluateDnd5eFormulaV1(predicate.minimum, formulaContext(input, target))
  }
  if (predicate.kind === 'ability-score') {
    if (!subject) return false
    const score = subject.abilities[predicate.ability]
    if (predicate.comparison === 'below') return score < predicate.value
    if (predicate.comparison === 'at-most') return score <= predicate.value
    if (predicate.comparison === 'at-least') return score >= predicate.value
    return score > predicate.value
  }
  if (predicate.kind === 'illumination') {
    return subject?.illumination != null && predicate.values.includes(subject.illumination)
  }
  if (predicate.kind === 'airborne-state') {
    if (!subject) return false
    if (predicate.state === 'grounded') return subject.airborne !== true
    if (predicate.state === 'unsupported-airborne') {
      return subject.airborne === true && subject.canRemainAirborne !== true
    }
    return subject.airborne === true
  }
  if (predicate.kind === 'target-identity') {
    if (!target) return false
    return predicate.identity === 'self' ? target.id === input.actor.id : target.id !== input.actor.id
  }
  if (predicate.kind === 'owned-companion') {
    return !!target && target.summonedPersistent === true &&
      target.summonedSourceCombatantId === input.actor.id
  }
  if (predicate.kind === 'can-hear-source') return target?.canHearActivitySource === true
  if (predicate.kind === 'active-effect') {
    if (!subject) return false
    const present = subject.activeEffectDefinitionIds?.some((effect) =>
      (
        effect.definitionId === predicate.effectId ||
        effect.definitionId.endsWith(`:${predicate.effectId}`) ||
        effect.definitionId.includes(`:${predicate.effectId}:`)
      ) &&
      (predicate.source === 'any' || effect.sourceActorId === input.actor.id),
    ) === true
    return present === predicate.present
  }
  if (predicate.kind === 'resource-capacity') {
    const resource = input.actor.resources?.[predicate.resourceId]
    if (!resource) return false
    const missing = resource.maximum - resource.current
    return missing >= evaluateDnd5eFormulaV1(predicate.minimumMissing, formulaContext(input, target))
  }
  if (predicate.kind === 'once-per-turn') return !input.usedTurnKeys?.has(predicate.key)
  if (predicate.kind === 'armor-equipped') {
    const equipment = subject?.equipment
    if (!equipment || !predicate.categories.includes(equipment.armorCategory)) return false
    return predicate.proficient == null || equipment.armorProficient === predicate.proficient
  }
  if (predicate.kind === 'armor-proficiency') {
    const owned = subject?.equipment?.armorProficiencies ?? []
    return (predicate.match ?? 'all') === 'all'
      ? predicate.categories.every((category) => owned.includes(category))
      : predicate.categories.some((category) => owned.includes(category))
  }
  if (predicate.kind === 'held-item') {
    const equipment = subject?.equipment
    if (!equipment) return false
    const candidates = predicate.slot === 'main-hand'
      ? [equipment.mainHand]
      : predicate.slot === 'off-hand'
        ? [equipment.offHand]
        : [equipment.mainHand, equipment.offHand]
    return candidates.some((item) => !!item &&
      (predicate.roles == null || predicate.roles.every((role) => item.roles.includes(role))) &&
      (predicate.itemIds == null || predicate.itemIds.includes(item.itemId)) &&
      (predicate.weaponModes == null || (item.weaponMode != null && predicate.weaponModes.includes(item.weaponMode))) &&
      (predicate.requiredWeaponProperties == null || predicate.requiredWeaponProperties.every((property) =>
        item.weaponProperties?.includes(property) === true)) &&
      (predicate.proficient == null || item.proficient === predicate.proficient))
  }
  if (predicate.kind === 'free-hands') return (subject?.equipment?.freeHands ?? -1) >= predicate.minimum
  if (predicate.kind === 'spellcasting-capability') {
    const spellcasting = subject?.spellcasting
    if (!spellcasting || spellcasting.capable !== predicate.capable) return false
    return predicate.classIds == null || predicate.classIds.some((classId) => spellcasting.classIds.includes(classId))
  }
  if (predicate.kind === 'choice') return input.choices?.[predicate.choiceId] === predicate.optionId
  return false
}

/**
 * Lightweight Host preflight for root Activity requirements.  Interactive
 * callers use this before collecting dice or opening an adjudication window;
 * the full resolver repeats the same checks transactionally at commit time.
 */
export function dnd5eActivityRootRequirementsSatisfiedV1(
  input: Dnd5eActivityExecutionInput,
): boolean {
  try {
    const targets = input.targets.length > 0 ? input.targets : [undefined]
    return (input.activity.requirements ?? []).every((predicate) =>
      targets.every((target) => predicateSatisfied(predicate, input, target)),
    )
  } catch {
    return false
  }
}

function selectedD20(values: readonly number[], mode: Dnd5eActivityRollMode): number {
  const required = mode === 'normal' ? 1 : 2
  // A host-derived recipe reserves two d20s because the target's live effect
  // state can produce advantage/disadvantage after the package is registered.
  // In normal mode the second authoritative die is deliberately ignored.
  if (
    (mode === 'normal' ? values.length !== 1 && values.length !== 2 : values.length !== required) ||
    values.some((value) => !Number.isInteger(value) || value < 1 || value > 20)
  ) {
    throw new Dnd5eFormulaEvaluationError('invalid d20 result')
  }
  if (mode === 'advantage') return Math.max(values[0]!, values[1]!)
  if (mode === 'disadvantage') return Math.min(values[0]!, values[1]!)
  return values[0]!
}

function checkKey(check: Dnd5eActivityCheckV1, target?: Dnd5eActivityActorSnapshot): string {
  return check.scope === 'per-target' && target ? `${check.id}:${target.id}` : check.id
}

function checkRollKey(check: Dnd5eActivityCheckV1, target?: Dnd5eActivityActorSnapshot): string {
  return check.scope === 'per-target' && target ? `${check.rollId}:${target.id}` : check.rollId
}

function opposedCheckRollKey(
  check: Extract<Dnd5eActivityCheckV1, { kind: 'opposed-ability-check' }>,
  target: Dnd5eActivityActorSnapshot,
): string {
  return `${check.opposedRollId}:${target.id}`
}

function savingThrowModifier(target: Dnd5eActivityActorSnapshot, ability: AbilityKey): number {
  return target.savingThrowModifiers?.[ability] ?? Math.floor((target.abilities[ability] - 10) / 2)
}

function selectedSavingThrowAbility(
  target: Dnd5eActivityActorSnapshot,
  primary: AbilityKey,
  options?: readonly AbilityKey[],
): AbilityKey {
  return (options?.length ? options : [primary]).reduce((best, candidate) =>
    savingThrowModifier(target, candidate) > savingThrowModifier(target, best) ? candidate : best, primary)
}

function resolveCheck(
  check: Dnd5eActivityCheckV1,
  input: Dnd5eActivityExecutionInput,
  target?: Dnd5eActivityActorSnapshot,
): Dnd5eActivityCheckResult {
  const key = checkKey(check, target)
  if (check.kind === 'random-roll') {
    const roll = input.rolls[checkRollKey(check, target)]
    if (
      !roll || roll.values.length !== check.count ||
      roll.values.some((value) =>
        !Number.isInteger(value) || value < 1 || value > check.sides ||
        check.rerollValues?.includes(value) === true)
    ) throw new Dnd5eFormulaEvaluationError(`invalid random-table result: ${key}`)
    const modifier = check.modifier ?? 0
    const total = roll.values.reduce((sum, value) => sum + value, modifier)
    return {
      key, kind: check.kind,
      checkId: check.id,
      targetId: target?.id,
      d20: roll.values[0] ?? 0,
      modifier,
      total,
      success: true,
      criticalSuccess: false,
      criticalFailure: false,
    }
  }
  if (check.kind === 'opposed-ability-check') {
    if (!target) throw new Dnd5eFormulaEvaluationError(`opposed target is unavailable: ${key}`)
    const sizeMode = check.sourceRollModeByTargetSizeRank && target.sizeRank != null &&
      (check.sourceRollModeByTargetSizeRank.minimum == null ||
        target.sizeRank >= check.sourceRollModeByTargetSizeRank.minimum) &&
      (check.sourceRollModeByTargetSizeRank.maximum == null ||
        target.sizeRank <= check.sourceRollModeByTargetSizeRank.maximum)
      ? check.sourceRollModeByTargetSizeRank.mode
      : undefined
    const sourceDeclared = check.sourceRollMode ?? 'normal'
    const sourceBase = sourceDeclared === 'host-derived'
      ? input.checkRollModes?.[`${key}:source`]
      : sourceDeclared
    const targetDeclared = check.targetRollMode ?? 'normal'
    const targetBase = targetDeclared === 'host-derived'
      ? input.checkRollModes?.[`${key}:target`]
      : targetDeclared
    if (!sourceBase || !targetBase) {
      throw new Dnd5eFormulaEvaluationError(`missing Host opposed roll mode: ${key}`)
    }
    const sourceModes = [sourceBase, sizeMode].filter(
      (mode): mode is Dnd5eActivityRollMode => mode != null && mode !== 'normal',
    )
    const sourceMode: Dnd5eActivityRollMode = sourceModes.includes('advantage') &&
      sourceModes.includes('disadvantage') ? 'normal' : sourceModes[0] ?? 'normal'
    const sourceRoll = input.rolls[checkRollKey(check, target)]
    const opposedRoll = input.rolls[opposedCheckRollKey(check, target)]
    if (!sourceRoll || !opposedRoll) {
      throw new Dnd5eFormulaEvaluationError(`missing opposed d20 result: ${key}`)
    }
    const d20 = selectedD20(sourceRoll.values, sourceMode)
    const opposedD20 = selectedD20(opposedRoll.values, targetBase)
    const sourceModifier = evaluateDnd5eFormulaV1(check.sourceModifier, formulaContext(input, target))
    const targetOption = check.targetOptions.reduce((best, candidate) => {
      const modifier = candidate.skill
        ? target.skillCheckModifiers?.[candidate.skill] ??
          target.abilityCheckModifiers?.[candidate.ability] ??
          Math.floor((target.abilities[candidate.ability] - 10) / 2)
        : target.abilityCheckModifiers?.[candidate.ability] ??
          Math.floor((target.abilities[candidate.ability] - 10) / 2)
      const bestModifier = best.skill
        ? target.skillCheckModifiers?.[best.skill] ??
          target.abilityCheckModifiers?.[best.ability] ??
          Math.floor((target.abilities[best.ability] - 10) / 2)
        : target.abilityCheckModifiers?.[best.ability] ??
          Math.floor((target.abilities[best.ability] - 10) / 2)
      return modifier > bestModifier ? candidate : best
    }, check.targetOptions[0]!)
    const opposedModifier = targetOption.skill
      ? target.skillCheckModifiers?.[targetOption.skill] ??
        target.abilityCheckModifiers?.[targetOption.ability] ??
        Math.floor((target.abilities[targetOption.ability] - 10) / 2)
      : target.abilityCheckModifiers?.[targetOption.ability] ??
        Math.floor((target.abilities[targetOption.ability] - 10) / 2)
    const total = d20 + sourceModifier
    const opposedTotal = opposedD20 + opposedModifier
    return {
      key, kind: check.kind, checkId: check.id, targetId: target.id, ability: check.sourceAbility,
      rollMode: sourceMode,
      d20, modifier: sourceModifier, total, success: total > opposedTotal,
      criticalSuccess: false, criticalFailure: false,
      opposedD20, opposedModifier, opposedTotal,
      opposedAbility: targetOption.ability, opposedSkill: targetOption.skill,
    }
  }
  const creatureTypeOverride = check.kind === 'saving-throw' && target?.creatureType &&
    check.rollModeByCreatureType?.creatureTypes.some((type) =>
      type.trim().toLocaleLowerCase() === target.creatureType!.trim().toLocaleLowerCase())
    ? check.rollModeByCreatureType.mode
    : undefined
  const sizeRankOverride = check.kind === 'saving-throw' && target?.sizeRank != null &&
    check.rollModeBySizeRank &&
    (check.rollModeBySizeRank.minimum == null || target.sizeRank >= check.rollModeBySizeRank.minimum) &&
    (check.rollModeBySizeRank.maximum == null || target.sizeRank <= check.rollModeBySizeRank.maximum)
    ? check.rollModeBySizeRank.mode
    : undefined
  const opposedOverride = check.kind === 'saving-throw' && target && check.rollModeIfOpposed &&
    target.controller !== input.actor.controller
    ? check.rollModeIfOpposed
    : undefined
  const declaredMode = check.rollMode ?? 'normal'
  const baseMode = declaredMode === 'host-derived' ? input.checkRollModes?.[key] : declaredMode
  if (!baseMode) throw new Dnd5eFormulaEvaluationError(`missing Host roll mode: ${key}`)
  const modes = [baseMode, creatureTypeOverride, sizeRankOverride, opposedOverride].filter(
    (mode): mode is Dnd5eActivityRollMode => mode != null && mode !== 'normal',
  )
  const mode: Dnd5eActivityRollMode = modes.includes('advantage') && modes.includes('disadvantage')
    ? 'normal'
    : modes[0] ?? 'normal'
  const roll = input.rolls[checkRollKey(check, target)]
  if (!roll) throw new Dnd5eFormulaEvaluationError(`missing d20 result: ${key}`)
  const d20 = selectedD20(roll.values, mode)
  let modifier: number
  let dc: number
  let success: boolean
  let automaticSuccess = false
  let automaticFailure = false
  let resolvedAbility: AbilityKey | undefined
  if (check.kind === 'attack-roll') {
    if (!target) throw new Dnd5eFormulaEvaluationError(`attack target is unavailable: ${key}`)
    modifier = evaluateDnd5eFormulaV1(check.attackBonus, formulaContext(input, target)) +
      (input.actor.d20RollModifier ?? 0)
    dc = target.armorClass
    success = d20 >= (check.criticalThreshold ?? 20) || (d20 !== 1 && d20 + modifier >= dc)
    if (input.forcedAttackMissCheckKeys?.has(key)) success = false
  } else if (check.kind === 'saving-throw') {
    if (!target) throw new Dnd5eFormulaEvaluationError(`saving throw target is unavailable: ${key}`)
    resolvedAbility = selectedSavingThrowAbility(target, check.ability, check.abilityOptions)
    modifier = savingThrowModifier(target, resolvedAbility) + (target.d20RollModifier ?? 0)
    dc = evaluateDnd5eFormulaV1(check.dc, formulaContext(input, target))
    automaticSuccess = check.automaticSuccessIfConditionImmune != null &&
      (target.conditionImmunities?.includes(check.automaticSuccessIfConditionImmune) ?? false)
    automaticFailure = check.automaticFailureIfAllied === true &&
      (target.id === input.actor.id || target.controller === input.actor.controller)
    success = automaticSuccess || (!automaticFailure && d20 + modifier >= dc)
  } else {
    resolvedAbility = check.ability
    modifier = ((check.kind === 'skill-check' && check.skill
      ? input.actor.skillCheckModifiers?.[check.skill] ??
        input.actor.abilityCheckModifiers?.[check.ability]
      : input.actor.abilityCheckModifiers?.[check.ability]) ??
      Math.floor((input.actor.abilities[check.ability] - 10) / 2)) +
      (input.actor.d20RollModifier ?? 0)
    dc = evaluateDnd5eFormulaV1(check.dc, formulaContext(input, target))
    success = d20 + modifier >= dc
  }
  return {
    key, kind: check.kind,
    checkId: check.id,
    targetId: target?.id,
    ability: resolvedAbility,
    skill: check.kind === 'skill-check' ? check.skill : undefined,
    rollMode: mode,
    d20,
    modifier,
    total: d20 + modifier,
    dc,
    success,
    automaticOutcome: automaticSuccess
      ? 'condition-immunity-success'
      : automaticFailure
        ? 'allied-unresisted-failure'
        : undefined,
    criticalSuccess: !automaticSuccess && !automaticFailure &&
      !(check.kind === 'attack-roll' && input.forcedAttackMissCheckKeys?.has(key)) &&
      d20 >= (check.kind === 'attack-roll' ? check.criticalThreshold ?? 20 : 20),
    criticalFailure: !automaticSuccess && !automaticFailure && d20 === 1,
  }
}

function operationTargets(
  targetKind: Dnd5eActivityOperationTargetV1,
  input: Dnd5eActivityExecutionInput,
  currentTarget?: Dnd5eActivityActorSnapshot,
): readonly Dnd5eActivityActorSnapshot[] {
  if (targetKind === 'actor') return [input.actor]
  if (targetKind === 'all-targets') return input.targets
  if (targetKind === 'all-combatants') return input.combatants ?? [input.actor, ...input.targets]
  return currentTarget ? [currentTarget] : input.targets
}

function formulaDiceRollIds(formula: Dnd5eFormulaV1): readonly string[] {
  if (formula.kind === 'dice') return [formula.rollId]
  if (formula.kind === 'add' || formula.kind === 'multiply' || formula.kind === 'minimum' || formula.kind === 'maximum') {
    return formula.values.flatMap(formulaDiceRollIds)
  }
  if (formula.kind === 'floor' || formula.kind === 'ceil' || formula.kind === 'round' || formula.kind === 'clamp') {
    return formulaDiceRollIds(formula.value)
  }
  return []
}

function evaluateAmount(
  formula: Dnd5eFormulaV1,
  input: Dnd5eActivityExecutionInput,
  target: Dnd5eActivityActorSnapshot | undefined,
  critical: boolean,
  doubleDice: boolean,
  minimumDieValue = 1,
  maximizeDice = false,
): number {
  const multipliers = critical && doubleDice
    ? Object.fromEntries(formulaDiceRollIds(formula).map((rollId) => [rollId, 2]))
    : undefined
  const maximumMultipliers = !critical && doubleDice && input.allowCriticalDiceSuperset
    ? Object.fromEntries(formulaDiceRollIds(formula).map((rollId) => [rollId, 2]))
    : undefined
  const minimums = minimumDieValue > 1
    ? Object.fromEntries(formulaDiceRollIds(formula).map((rollId) => [rollId, minimumDieValue]))
    : undefined
  return Math.max(0, Math.floor(evaluateDnd5eFormulaV1(
    formula,
    formulaContext(
      input,
      target,
      multipliers,
      minimums,
      maximizeDice ? formulaDiceRollIds(formula) : undefined,
      maximumMultipliers,
    ),
  )))
}

function evaluateSignedAmount(
  formula: Dnd5eFormulaV1,
  input: Dnd5eActivityExecutionInput,
  target: Dnd5eActivityActorSnapshot | undefined,
): number {
  return Math.floor(evaluateDnd5eFormulaV1(formula, formulaContext(input, target)))
}

function resolveEffectDuration(
  duration: Dnd5eEffectDurationV1,
  input: Dnd5eActivityExecutionInput,
  target: Dnd5eActivityActorSnapshot,
): Dnd5eResolvedEffectDuration {
  if (duration.kind !== 'save-ends') return duration
  const ability = selectedSavingThrowAbility(target, duration.ability, duration.abilityOptions)
  return {
    kind: 'save-ends', maximumRounds: duration.maximumRounds, timing: duration.timing, ability,
    dc: Math.max(1, Math.floor(evaluateDnd5eFormulaV1(duration.dc, formulaContext(input, target)))),
    requiresSourceNotVisible: duration.requiresSourceNotVisible,
    damageOnFailure: duration.damageOnFailure
      ? {
          count: duration.damageOnFailure.count,
          sides: duration.damageOnFailure.sides,
          modifier: duration.damageOnFailure.modifier == null
            ? undefined
            : Math.floor(evaluateDnd5eFormulaV1(
                duration.damageOnFailure.modifier,
                formulaContext(input, target),
              )),
          type: duration.damageOnFailure.type,
        }
      : undefined,
    successesRequired: duration.successesRequired,
    failuresRequired: duration.failuresRequired,
    initialSuccesses: duration.initialSuccesses,
    initialFailures: duration.initialFailures,
    onFailureThreshold: duration.onFailureThreshold
      ? { ...duration.onFailureThreshold }
      : undefined,
  }
}

function formulaDiceAudit(
  formula: Dnd5eFormulaV1,
  input: Dnd5eActivityExecutionInput,
  maximizeDice: boolean,
): readonly { rollId: string; count: number; sides: number; values: readonly number[] }[] {
  const declarations: { rollId: string; count: number; sides: number }[] = []
  const visit = (node: Dnd5eFormulaV1): void => {
    if (node.kind === 'dice') {
      declarations.push({ rollId: node.rollId, count: node.count, sides: node.sides })
      return
    }
    if (node.kind === 'add' || node.kind === 'multiply' || node.kind === 'minimum' || node.kind === 'maximum') {
      node.values.forEach(visit)
      return
    }
    if (node.kind === 'floor' || node.kind === 'ceil' || node.kind === 'round' || node.kind === 'clamp') visit(node.value)
  }
  visit(formula)
  return declarations.map((declaration) => ({
    ...declaration,
    values: maximizeDice
      ? Array.from({ length: declaration.count }, () => declaration.sides)
      : [...(input.rolls[declaration.rollId]?.values ?? [])].slice(0, declaration.count),
  }))
}

function outcomeConditionApplies(
  condition: Exclude<Dnd5eActivityDefinitionV1['outcomes'][number]['when'], { kind: 'always' | 'all' }>,
  checks: readonly Dnd5eActivityCheckResult[],
  choices: Readonly<Record<string, string>> | undefined,
  target?: Dnd5eActivityActorSnapshot,
  input?: Dnd5eActivityExecutionInput,
): boolean {
  if (condition.kind === 'choice') return choices?.[condition.choiceId] === condition.optionId
  if (condition.kind === 'predicate') return input != null && predicateSatisfied(condition.predicate, input, target)
  const check = checks.find((candidate) => candidate.checkId === condition.checkId &&
    (candidate.targetId == null || candidate.targetId === target?.id))
  if (condition.kind === 'check-total') {
    return !!check &&
      (condition.minimum == null || check.total >= condition.minimum) &&
      (condition.maximum == null || check.total <= condition.maximum)
  }
  return !!check && (
    (condition.result === 'success' && check.success) ||
    (condition.result === 'failure' && !check.success) ||
    (condition.result === 'critical-success' && check.criticalSuccess) ||
    (condition.result === 'critical-failure' && check.criticalFailure)
  )
}

/**
 * Delayed hit damage must keep its dice unresolved until the attack lands.
 * V1 intentionally accepts only an additive pool (one die size plus any
 * deterministic formulas); nonlinear dice expressions cannot be represented
 * by the authoritative weapon-damage transaction and are rejected.
 */
function compileDelayedDamageFormula(
  formula: Dnd5eFormulaV1,
  context: Dnd5eFormulaEvaluationContext,
): { count: number; sides: number; bonus: number } {
  let dice: { count: number; sides: number } | undefined
  let bonus = 0
  const visit = (node: Dnd5eFormulaV1): void => {
    if (node.kind === 'dice') {
      if (dice && dice.sides !== node.sides) {
        throw new Dnd5eFormulaEvaluationError('delayed damage cannot mix die sizes')
      }
      dice = { count: (dice?.count ?? 0) + node.count, sides: node.sides }
      return
    }
    if (node.kind === 'add') {
      node.values.forEach(visit)
      return
    }
    if (formulaDiceRollIds(node).length > 0) {
      throw new Dnd5eFormulaEvaluationError('delayed damage dice must be additive')
    }
    bonus += Math.floor(evaluateDnd5eFormulaV1(node, context))
  }
  visit(formula)
  return { count: dice?.count ?? 0, sides: dice?.sides ?? 2, bonus }
}

export function resolveDnd5eAppliedEffectDefinitionV1(
  effect: Dnd5eEffectDefinitionV1,
  input: {
    actor: Dnd5eActivityActorSnapshot
    target: Dnd5eActivityActorSnapshot
    castLevel?: number
    rolls?: Readonly<Record<string, Dnd5eFormulaRollResult>>
  },
): Omit<Extract<Dnd5eActivityCapabilityProposal, { kind: 'apply-effect' }>, 'kind' | 'operationId' | 'targetId'> {
  const castLevelProfile = [...(effect.castLevelProfiles ?? [])]
    .filter((profile) => profile.minimumCastLevel <= (input.castLevel ?? 0))
    .sort((left, right) => right.minimumCastLevel - left.minimumCastLevel)[0]
  if (castLevelProfile) {
    effect = {
      ...effect,
      duration: castLevelProfile.duration,
      concentration: castLevelProfile.concentration,
    }
  }
  const target = input.target
  const evaluationContext: Dnd5eFormulaEvaluationContext = {
    actor: input.actor,
    target,
    castLevel: input.castLevel,
    rolls: input.rolls ?? {},
  }
  const base: Dnd5eActiveEffectModifiers = {}
  const resistanceGroups: Dnd5eActiveEffectModifiers[] = []
  const allAbilities: readonly AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
  for (const modifier of effect.modifiers ?? []) {
    if (modifier.kind === 'armor-class') {
      base.armorClassBonus = (base.armorClassBonus ?? 0) +
        evaluateDnd5eFormulaV1(modifier.value, evaluationContext)
    } else if (modifier.kind === 'attacks-against-source-armor-class') {
      base.attacksAgainstSourceArmorClassBonus =
        (base.attacksAgainstSourceArmorClassBonus ?? 0) + modifier.bonus
    } else if (modifier.kind === 'attack-roll') {
      if (modifier.mode === 'advantage' && modifier.ability == null) base.attackRollAdvantage = true
      if (modifier.mode === 'disadvantage' && modifier.ability == null) base.attackRollDisadvantage = true
      if (modifier.mode === 'disadvantage' && modifier.ability != null) {
        base.attackRollDisadvantageAbilities = [...new Set([
          ...(base.attackRollDisadvantageAbilities ?? []), modifier.ability,
        ])]
      }
    } else if (modifier.kind === 'attacks-against-target') {
      if (modifier.mode === 'advantage') base.attacksAgainstTargetAdvantage = true
      else base.attacksAgainstTargetDisadvantage = true
    } else if (modifier.kind === 'cannot-be-surprised-while-conscious') {
      base.cannotBeSurprisedWhileConscious = true
    } else if (modifier.kind === 'attack-target-lock') {
      base.attackDisadvantageAgainstOthersThanSource = true
    } else if (modifier.kind === 'speed') {
      const value = evaluateDnd5eFormulaV1(modifier.value, evaluationContext)
      if (modifier.mode === 'override') base.speedOverrideFeet = Math.max(0, value)
      else if (modifier.mode === 'minimum') base.speedMinimumFeet = Math.max(base.speedMinimumFeet ?? 0, value)
      else if (modifier.mode === 'maximum') base.speedMaximumFeet = Math.min(base.speedMaximumFeet ?? Number.POSITIVE_INFINITY, value)
      else if (modifier.mode === 'multiply') base.speedMultiplier = (base.speedMultiplier ?? 1) * value
      else if (value >= 0) base.speedBonusFeet = (base.speedBonusFeet ?? 0) + value
      else base.speedPenaltyFeet = (base.speedPenaltyFeet ?? 0) + Math.abs(value)
    } else if (modifier.kind === 'saving-throw') {
      if (modifier.mode === 'add' && modifier.value) {
        const value = evaluateDnd5eFormulaV1(modifier.value, evaluationContext)
        if (modifier.ability) base.savingThrowBonusByAbility = {
          ...base.savingThrowBonusByAbility,
          [modifier.ability]: (base.savingThrowBonusByAbility?.[modifier.ability] ?? 0) + value,
        }
        else base.savingThrowBonus = (base.savingThrowBonus ?? 0) + value
      } else {
        const abilities = modifier.ability ? [modifier.ability] : allAbilities
        if (modifier.mode === 'advantage') base.savingThrowAdvantages = [
          ...new Set([...(base.savingThrowAdvantages ?? []), ...abilities]),
        ]
        if (modifier.mode === 'disadvantage') base.savingThrowDisadvantages = [
          ...new Set([...(base.savingThrowDisadvantages ?? []), ...abilities]),
        ]
      }
    } else if (modifier.kind === 'death-saving-throw') {
      base.deathSavingThrowAdvantage = true
    } else if (modifier.kind === 'maximize-healing-dice') {
      base.maximizeHealingDice = true
    } else if (modifier.kind === 'saving-throw-proficiency') {
      if (!target.savingThrowProficiencies?.includes(modifier.ability)) {
        base.savingThrowBonusByAbility = {
          ...base.savingThrowBonusByAbility,
          [modifier.ability]: (base.savingThrowBonusByAbility?.[modifier.ability] ?? 0) + target.proficiencyBonus,
        }
      }
    } else if (modifier.kind === 'ability-check') {
      const selectedAbilities = modifier.ability ? [modifier.ability] : modifier.skill ? [] : [...allAbilities]
      if (selectedAbilities.length > 0) {
        const key = modifier.mode === 'advantage' ? 'abilityCheckAdvantages' : 'abilityCheckDisadvantages'
        base[key] = [...new Set([...(base[key] ?? []), ...selectedAbilities])]
      }
      if (modifier.skill) {
        const key = modifier.mode === 'advantage' ? 'skillCheckAdvantages' : 'skillCheckDisadvantages'
        base[key] = [...new Set([...(base[key] ?? []), modifier.skill])]
      }
    } else if (modifier.kind === 'perception-target-lock') {
      base.perceptionDisadvantageAgainstOthersThanSource =
        modifier.disadvantageAgainstOthersThanSource
    } else if (modifier.kind === 'skill-check-bonus-aura') {
      base.skillCheckBonusAuras = [
        ...(base.skillCheckBonusAuras ?? []),
        {
          skill: modifier.skill,
          bonus: modifier.bonus,
          radiusFeet: modifier.radiusFeet,
          relation: modifier.relation,
          mundaneTracking: modifier.mundaneTracking,
          leavesTracks: modifier.leavesTracks,
        },
      ]
    } else if (modifier.kind === 'minimum-ability-check-d20') {
      base.minimumAbilityCheckD20ByAbility = {
        ...base.minimumAbilityCheckD20ByAbility,
        [modifier.ability]: Math.max(
          base.minimumAbilityCheckD20ByAbility?.[modifier.ability] ?? 1,
          modifier.minimum,
        ),
      }
    } else if (modifier.kind === 'damage-resistance') {
      resistanceGroups.push({ damageResistance: modifier.damageType })
    } else if (modifier.kind === 'conditional-damage-resistance') {
      base.conditionalDamageResistances = [
        ...(base.conditionalDamageResistances ?? []),
        {
          damageTypes: [...new Set(modifier.damageTypes)],
          sourceMagical: modifier.sourceMagical,
          deliveries: modifier.deliveries ? [...new Set(modifier.deliveries)] : undefined,
        },
      ]
    } else if (modifier.kind === 'damage-immunity') {
      resistanceGroups.push({ damageImmunity: modifier.damageType })
    } else if (modifier.kind === 'damage-vulnerability') {
      if (modifier.damageType === 'all') base.vulnerabilityToAllDamage = true
      else resistanceGroups.push({ damageVulnerability: modifier.damageType })
    } else if (modifier.kind === 'condition-immunity') {
      base.conditionImmunities = [...new Set([...(base.conditionImmunities ?? []), modifier.condition])]
    } else if (modifier.kind === 'condition-immunity-by-source-creature-type') {
      base.conditionImmunitiesBySourceCreatureType = [
        ...(base.conditionImmunitiesBySourceCreatureType ?? []),
        {
          conditions: [...new Set(modifier.conditions)],
          sourceCreatureTypes: [...new Set(modifier.sourceCreatureTypes.map((value) => value.trim().toLowerCase()))],
        },
      ]
    } else if (modifier.kind === 'saving-throw-advantage-by-source-creature-type') {
      base.savingThrowAdvantagesBySourceCreatureType = [
        ...(base.savingThrowAdvantagesBySourceCreatureType ?? []),
        {
          conditions: [...new Set(modifier.conditions.map((value) => value.trim().toLowerCase()))],
          sourceCreatureTypes: [...new Set(modifier.sourceCreatureTypes.map((value) => value.trim().toLowerCase()))],
        },
      ]
    } else if (modifier.kind === 'condition-immunity-by-source-magic') {
      base.conditionImmunitiesBySourceMagic = [
        ...(base.conditionImmunitiesBySourceMagic ?? []),
        {
          conditions: [...new Set(modifier.conditions.map((value) => value.trim().toLowerCase()))],
          sourceMagical: modifier.sourceMagical,
          suppressExisting: modifier.suppressExisting,
        },
      ]
    } else if (modifier.kind === 'attacks-against-target-by-creature-type') {
      base.attacksAgainstTargetDisadvantageCreatureTypes = [...new Set([
        ...(base.attacksAgainstTargetDisadvantageCreatureTypes ?? []),
        ...modifier.sourceCreatureTypes.map((value) => value.trim().toLowerCase()),
      ])]
    } else if (modifier.kind === 'prohibit-reaction') {
      base.preventReactions = true
    } else if (modifier.kind === 'forced-flee-from-source') {
      base.preventReactions = true
      base.forcedFleeFromSource = true
    } else if (modifier.kind === 'maximum-attacks-per-turn') {
      base.maximumAttacksPerTurn = Math.min(base.maximumAttacksPerTurn ?? modifier.value, modifier.value)
    } else if (modifier.kind === 'restricted-extra-action') {
      base.restrictedExtraAction = {
        allowedActions: [...new Set(modifier.allowedActions)],
        maximumWeaponAttacks: 1,
      }
    } else if (modifier.kind === 'darkvision') {
      base.darkvisionRangeFeet = Math.max(base.darkvisionRangeFeet ?? 0, modifier.rangeFeet)
    } else if (modifier.kind === 'climb-speed') {
      base.climbSpeedEqualsWalking = modifier.mode === 'walking-speed'
    } else if (modifier.kind === 'truesight') {
      base.truesightRangeFeet = Math.max(base.truesightRangeFeet ?? 0, modifier.rangeFeet)
      base.seeInvisible = true
    } else if (modifier.kind === 'spell-targeting-immunity') {
      base.spellTargetingImmunitySchools = [...new Set([
        ...(base.spellTargetingImmunitySchools ?? []),
        ...modifier.schools,
      ])]
    } else if (modifier.kind === 'flight-speed') {
      base.flySpeedFeet = Math.max(base.flySpeedFeet ?? 0, modifier.speedFeet)
      if (modifier.hover === true) base.hoverWhileFlying = true
    } else if (modifier.kind === 'magically-held-aloft') {
      base.magicallyHeldAloft = true
    } else if (modifier.kind === 'safe-fall') {
      base.safeFallFeet = Math.max(base.safeFallFeet ?? 0, modifier.maximumFeet)
    } else if (modifier.kind === 'controlled-descent') {
      base.controlledDescent = {
        maximumFeetPerRound: Math.max(
          base.controlledDescent?.maximumFeetPerRound ?? 0,
          modifier.maximumFeetPerRound,
        ),
        safeLanding: true,
        endsOnLanding: true,
      }
    } else if (modifier.kind === 'automatic-escape') {
      base.automaticEscape = {
        conditions: [...new Set(modifier.conditions)],
        movementCostFeet: modifier.movementCostFeet,
        sourceMagical: modifier.sourceMagical,
      }
    } else if (modifier.kind === 'ignore-magical-speed-reductions') {
      base.ignoreMagicalSpeedReductions = true
    } else if (modifier.kind === 'prevent-actions') {
      base.preventActions = true
    } else if (modifier.kind === 'action-restriction') {
      base.actionRestriction = {
        prohibited: [...new Set(modifier.prohibited)],
        ...(modifier.allowedBasicActions
          ? { allowedBasicActions: [...new Set(modifier.allowedBasicActions)] }
          : {}),
        ...(modifier.allowedActivityIds
          ? { allowedActivityIds: [...new Set(modifier.allowedActivityIds)] }
          : {}),
      }
    } else if (modifier.kind === 'on-hit-bonus-damage') {
      const delayed = compileDelayedDamageFormula(modifier.amount, evaluationContext)
      const heldWeapon = modifier.appliesTo === 'this-weapon'
        ? target.equipment?.mainHand?.roles.includes('weapon')
          ? target.equipment.mainHand
          : target.equipment?.offHand?.roles.includes('weapon')
            ? target.equipment.offHand
            : undefined
        : undefined
      if (modifier.appliesTo === 'this-weapon' && !heldWeapon) {
        throw new Dnd5eFormulaEvaluationError('on-hit-bonus-damage requires a held weapon')
      }
      base.onHitBonusDamage = {
        ...delayed,
        damageType: modifier.damageType,
        appliesTo: modifier.appliesTo,
        weaponId: heldWeapon?.itemId,
        doubleDiceOnCritical: modifier.doubleDiceOnCritical !== false,
        oncePerTurn: modifier.oncePerTurn === true,
        targetCreatureTypes: modifier.targetCreatureTypes
          ? [...modifier.targetCreatureTypes]
          : undefined,
        onHitTargetEffect: modifier.onHitTargetEffect
          ? {
              revealInvisible: modifier.onHitTargetEffect.revealInvisible,
              preventInvisibility: modifier.onHitTargetEffect.preventInvisibility,
              emittedLight: modifier.onHitTargetEffect.emittedLight
                ? { ...modifier.onHitTargetEffect.emittedLight }
                : undefined,
            }
          : undefined,
        consumeEffectOnHit: effect.duration.kind !== 'permanent',
      }
    } else if (modifier.kind === 'hit-point-maximum') {
      base.hitPointMaximumBonus = (base.hitPointMaximumBonus ?? 0) + Math.max(
        0,
        Math.floor(evaluateDnd5eFormulaV1(modifier.value, evaluationContext)),
      )
      if (modifier.increaseCurrentHitPoints !== false) base.increaseCurrentHitPointsWithMaximum = true
    } else if (modifier.kind === 'see-invisible') {
      base.seeInvisible = true
    } else if (modifier.kind === 'emitted-light') {
      const currentOuter = (base.emittedLight?.brightRadiusFeet ?? 0) +
        (base.emittedLight?.dimRadiusFeet ?? 0)
      const nextOuter = modifier.brightRadiusFeet + modifier.dimRadiusFeet
      if (nextOuter > currentOuter) {
        base.emittedLight = {
          brightRadiusFeet: modifier.brightRadiusFeet,
          dimRadiusFeet: modifier.dimRadiusFeet,
          color: modifier.color,
        }
      }
    } else if (modifier.kind === 'language-capability') {
      base.languageCapabilities = {
        understandSpoken: modifier.understandSpoken ?? base.languageCapabilities?.understandSpoken,
        understandWritten: modifier.understandWritten ?? base.languageCapabilities?.understandWritten,
        writtenRequiresTouch: modifier.writtenRequiresTouch ?? base.languageCapabilities?.writtenRequiresTouch,
        writtenMinutesPerPage: modifier.writtenMinutesPerPage ?? base.languageCapabilities?.writtenMinutesPerPage,
        speechUnderstoodBy: modifier.speechUnderstoodBy ?? base.languageCapabilities?.speechUnderstoodBy,
      }
    } else if (modifier.kind === 'language-restriction') {
      base.languageRestriction = {
        understandLanguages: modifier.understandLanguages,
        intelligibleCommunication: modifier.intelligibleCommunication,
      }
    } else if (modifier.kind === 'attack-decoys') {
      base.attackDecoys = {
        remaining: modifier.count,
        redirectMinimumD20: [...modifier.redirectMinimumD20],
        armorClassBase: modifier.armorClassBase,
        armorClassAbility: modifier.armorClassAbility,
        requiresOrdinarySight: true,
      }
    } else if (modifier.kind === 'planar-phase') {
      base.planarPhase = {
        plane: modifier.plane,
        ignoresMaterialCollision: modifier.ignoresMaterialCollision,
        suppressCrossPlaneEffects: true,
        unrestrictedVerticalMovement: modifier.unrestrictedVerticalMovement,
      }
    } else if (modifier.kind === 'tracking-capability') {
      base.trackingCapability = {
        mundaneTracking: modifier.mundaneTracking,
        leavesTracks: modifier.leavesTracks,
      }
    } else if (modifier.kind === 'environmental-capability') {
      const breatheIn = [...new Set([
          ...(base.environmentalCapabilities?.breatheIn ?? []),
          ...(modifier.breatheIn ?? []),
        ])]
      base.environmentalCapabilities = {
        breatheIn: breatheIn.length > 0 ? breatheIn : undefined,
        treatLiquidSurfacesAsSolidGround:
          modifier.treatLiquidSurfacesAsSolidGround ??
          base.environmentalCapabilities?.treatLiquidSurfacesAsSolidGround,
        ignoreDifficultTerrain:
          modifier.ignoreDifficultTerrain ?? base.environmentalCapabilities?.ignoreDifficultTerrain,
        ignoreUnderwaterMovementPenalty:
          modifier.ignoreUnderwaterMovementPenalty ?? base.environmentalCapabilities?.ignoreUnderwaterMovementPenalty,
        ignoreUnderwaterAttackPenalty:
          modifier.ignoreUnderwaterAttackPenalty ?? base.environmentalCapabilities?.ignoreUnderwaterAttackPenalty,
        occupyCreatureSpaces:
          modifier.occupyCreatureSpaces ?? base.environmentalCapabilities?.occupyCreatureSpaces,
        riseTowardLiquidSurfaceFeetPerRound: Math.max(
          modifier.riseTowardLiquidSurfaceFeetPerRound ?? 0,
          base.environmentalCapabilities?.riseTowardLiquidSurfaceFeetPerRound ?? 0,
        ) || undefined,
        minimumPassageGapInches: Math.min(
          modifier.minimumPassageGapInches ?? Number.POSITIVE_INFINITY,
          base.environmentalCapabilities?.minimumPassageGapInches ?? Number.POSITIVE_INFINITY,
        ) < Number.POSITIVE_INFINITY
          ? Math.min(
              modifier.minimumPassageGapInches ?? Number.POSITIVE_INFINITY,
              base.environmentalCapabilities?.minimumPassageGapInches ?? Number.POSITIVE_INFINITY,
            )
          : undefined,
      }
    } else if (modifier.kind === 'spell-save-disadvantage-aura') {
      base.spellSaveDisadvantageAura = {
        radiusFeet: modifier.radiusFeet,
        damageTypes: [...(modifier.damageTypes ?? [])],
        spellcastingClassIds: [...(modifier.spellcastingClassIds ?? [])],
      }
    } else if (modifier.kind === 'spell-action-as-bonus-action') {
      base.spellActionAsBonusActionClassIds = [...modifier.spellcastingClassIds]
    } else if (modifier.kind === 'attack-profile') {
      base.attackProfiles = [
        ...(base.attackProfiles ?? []),
        {
          attackModes: [...modifier.attackModes],
          weaponIds: modifier.weaponIds ? [...modifier.weaponIds] : undefined,
          reachBonusFeet: modifier.reachBonusFeet,
          damageTypeOverride: modifier.damageTypeOverride,
        },
      ]
    } else if (modifier.kind === 'weapon-enchantment') {
      const heldItem = target.equipment?.[modifier.weaponSlot === 'main-hand' ? 'mainHand' : 'offHand']
      if (!heldItem?.roles.includes('weapon')) {
        throw new Dnd5eFormulaEvaluationError(`weapon-enchantment requires a held weapon in ${modifier.weaponSlot}`)
      }
      const attackAndDamageBonus = Math.max(0, Math.min(3, Math.floor(
        evaluateDnd5eFormulaV1(modifier.attackAndDamageBonus, evaluationContext),
      ))) as 0 | 1 | 2 | 3
      base.weaponEnchantment = {
        weaponId: heldItem.itemId,
        attackAndDamageBonus,
        bonusDamage: modifier.bonusDamage ? { ...modifier.bonusDamage } : undefined,
      }
    } else if (modifier.kind === 'weapon-damage-replacement') {
      base.weaponDamageReplacementAttackModes = [...new Set(modifier.attackModes)]
    } else if (modifier.kind === 'weapon-damage-multiplier') {
      base.weaponDamageMultipliers = [
        ...(base.weaponDamageMultipliers ?? []),
        {
          multiplier: modifier.multiplier,
          ability: modifier.ability,
          attackModes: modifier.attackModes ? [...new Set(modifier.attackModes)] : undefined,
        },
      ]
    } else if (modifier.kind === 'movement-boundary-save') {
      base.movementBoundarySave = {
        maximumDistanceFeet: modifier.maximumDistanceFeet,
        ability: modifier.ability,
        dc: Math.max(1, Math.floor(evaluateDnd5eFormulaV1(modifier.dc, evaluationContext))),
      }
    }
  }
  const hasBaseModifiers = Object.values(base).some((value) => value != null)
  const modifierGroups = hasBaseModifiers && resistanceGroups.length === 1
    ? [{ ...base, ...resistanceGroups[0] }]
    : [...(
        hasBaseModifiers ||
        !(effect.conditions?.length) && !effect.extensionCondition && resistanceGroups.length === 0
          ? [base]
          : []
      ), ...resistanceGroups]
  return {
    effectId: effect.id,
    name: effect.name,
    disposition: effect.disposition,
    tags: effect.tags ? [...effect.tags] : undefined,
    grantedActivities: effect.grants ? [...effect.grants] : undefined,
    duration: effect.duration.kind === 'save-ends'
      ? {
          kind: 'save-ends' as const,
          maximumRounds: effect.duration.maximumRounds,
          timing: effect.duration.timing,
          ability: selectedSavingThrowAbility(target, effect.duration.ability, effect.duration.abilityOptions),
          dc: Math.max(1, Math.floor(evaluateDnd5eFormulaV1(effect.duration.dc, evaluationContext))),
          requiresSourceNotVisible: effect.duration.requiresSourceNotVisible,
          damageOnFailure: effect.duration.damageOnFailure
            ? {
                count: effect.duration.damageOnFailure.count,
                sides: effect.duration.damageOnFailure.sides,
                modifier: effect.duration.damageOnFailure.modifier == null
                  ? undefined
                  : Math.floor(evaluateDnd5eFormulaV1(
                      effect.duration.damageOnFailure.modifier,
                      evaluationContext,
                    )),
                type: effect.duration.damageOnFailure.type,
              }
            : undefined,
          successesRequired: effect.duration.successesRequired,
          failuresRequired: effect.duration.failuresRequired,
          initialSuccesses: effect.duration.initialSuccesses,
          initialFailures: effect.duration.initialFailures,
          onFailureThreshold: effect.duration.onFailureThreshold
            ? { ...effect.duration.onFailureThreshold }
            : undefined,
        }
      : effect.duration,
    conditions: [...(effect.conditions ?? [])],
    extensionCondition: effect.extensionCondition,
    // An extension-only effect is already materialized by the extension marker
    // path. Emitting an additional empty modifier group creates a second,
    // mechanically inert ActiveEffect with the same label in the live UI.
    // One resistance plus other modifiers still represents one logical
    // effect. Keep those fields in one ActiveEffect row so replacement and
    // an explicit dismissal remove the whole effect atomically.
    modifierGroups,
    breakOn: effect.breakOn ? [...effect.breakOn] : undefined,
    sourceLink: effect.sourceLink ? { ...effect.sourceLink } : undefined,
    suspendWhileEffectId: effect.suspendWhileEffectId,
    repeatSaveOnDamage: effect.repeatSaveOnDamage
      ? {
          ability: effect.repeatSaveOnDamage.ability,
          dc: Math.max(1, Math.floor(evaluateDnd5eFormulaV1(
            effect.repeatSaveOnDamage.dc,
            evaluationContext,
          ))),
          onDamage: {
            mode: effect.repeatSaveOnDamage.mode,
            ...(effect.repeatSaveOnDamage.sourceFilter
              ? { sourceFilter: effect.repeatSaveOnDamage.sourceFilter }
              : {}),
            ...(effect.repeatSaveOnDamage.advantageIfSourceOrAllies === true
              ? { advantageIfSourceOrAllies: true as const }
              : {}),
          },
          onSuccess: 'remove' as const,
        }
      : undefined,
    repeatSaveAfterMovement: effect.repeatSaveAfterMovement
      ? {
          ability: effect.repeatSaveAfterMovement.ability,
          dc: Math.max(1, Math.floor(evaluateDnd5eFormulaV1(
            effect.repeatSaveAfterMovement.dc,
            evaluationContext,
          ))),
          onSuccess: 'remove' as const,
        }
      : undefined,
    escapeCheck: effect.escapeCheck
      ? {
          ability: effect.escapeCheck.ability,
          skill: effect.escapeCheck.skill,
          alternativeAbility: effect.escapeCheck.alternativeAbility,
          alternativeSkill: effect.escapeCheck.alternativeSkill,
          dc: Math.max(1, Math.floor(evaluateDnd5eFormulaV1(effect.escapeCheck.dc, evaluationContext))),
          economy: 'action',
          automaticSuccessStatBlockIds: effect.escapeCheck.automaticSuccessStatBlockIds
            ? [...effect.escapeCheck.automaticSuccessStatBlockIds]
            : undefined,
      }
      : undefined,
    escapeSavingThrow: effect.escapeSavingThrow
      ? {
          ability: effect.escapeSavingThrow.ability,
          dc: Math.max(1, Math.floor(evaluateDnd5eFormulaV1(
            effect.escapeSavingThrow.dc,
            evaluationContext,
          ))),
          economy: 'action',
      }
      : undefined,
    removalAction: effect.removalAction
      ? {
          label: effect.removalAction.label,
          economy: 'action',
          maxDistanceFeet: effect.removalAction.maxDistanceFeet,
          abilityCheck: effect.removalAction.abilityCheck
            ? {
                ability: effect.removalAction.abilityCheck.ability,
                skill: effect.removalAction.abilityCheck.skill,
                dc: Math.max(1, Math.floor(evaluateDnd5eFormulaV1(
                  effect.removalAction.abilityCheck.dc,
                  evaluationContext,
                ))),
              }
            : undefined,
        }
      : undefined,
    onDamageCondition: effect.onDamageCondition ? { ...effect.onDamageCondition } : undefined,
    afterEffectEnds: effect.afterEffectEnds ? { ...effect.afterEffectEnds } : undefined,
    periodicDamage: effect.periodicDamage
      ? {
          timing: effect.periodicDamage.timing,
          count: effect.periodicDamage.count,
          sides: effect.periodicDamage.sides,
          modifier: effect.periodicDamage.modifier == null
            ? undefined
            : Math.floor(evaluateDnd5eFormulaV1(effect.periodicDamage.modifier, evaluationContext)),
          type: effect.periodicDamage.type,
        }
      : undefined,
    periodicHealing: effect.periodicHealing
      ? {
          timing: effect.periodicHealing.timing,
          amount: Math.max(0, Math.floor(evaluateDnd5eFormulaV1(
            effect.periodicHealing.amount,
            evaluationContext,
          ))),
        }
      : undefined,
    bodyRestoration: effect.bodyRestoration
      ? { roundsRemaining: effect.bodyRestoration.afterRounds }
      : undefined,
    calendarRepeatSave: effect.calendarRepeatSave
      ? {
          intervalMinutes: effect.calendarRepeatSave.intervalMinutes,
          ability: effect.calendarRepeatSave.ability,
          dc: Math.max(1, Math.floor(evaluateDnd5eFormulaV1(
            effect.calendarRepeatSave.dc,
            evaluationContext,
          ))),
          onSuccess: effect.calendarRepeatSave.onSuccess,
        }
      : undefined,
    planarBanishment: effect.planarBanishment
      ? {
          foreignCreatureTypes: [...effect.planarBanishment.foreignCreatureTypes],
          foreignDuration: effect.planarBanishment.foreignDuration,
          localDurationRounds: effect.planarBanishment.localDurationRounds,
        }
      : undefined,
    magical: effect.periodicDamage?.magical === true,
    concentration: effect.concentration === true,
    persistAfterConcentrationCompletes: effect.persistAfterConcentrationCompletes === true,
    stacking: effect.stacking === 'refresh-duration'
      ? 'refresh-duration'
      : effect.stacking === 'stack'
        ? 'stack'
        : 'replace',
    exclusiveBySource: effect.stacking === 'unique-by-source',
    exclusiveGroup: effect.exclusiveGroup,
  }
}

function resolveConsumption(
  consumption: Dnd5eActivityConsumptionV1,
  input: Dnd5eActivityExecutionInput,
): Dnd5eResolvedActivityConsumption {
  if (consumption.kind === 'action-economy' || consumption.kind === 'spell-slot') return consumption
  return {
    ...consumption,
    amount: evaluateAmount(consumption.amount, input, input.actor, false, false),
  }
}

function operationProposals(
  operation: Dnd5eActivityOperationV1,
  input: Dnd5eActivityExecutionInput,
  currentTarget: Dnd5eActivityActorSnapshot | undefined,
  critical: boolean,
): readonly Dnd5eActivityCapabilityProposal[] {
  if (operation.kind === 'manual-adjudication') {
    return [{ kind: 'request-dm-adjudication', operationId: operation.id, prompt: operation.prompt, reason: operation.reason }]
  }
  if (operation.kind === 'stabilize') {
    return operationTargets(operation.target, input, currentTarget).map((target) => ({
      kind: 'stabilize' as const,
      operationId: operation.id,
      targetId: target.id,
    }))
  }
  if (operation.kind === 'stand-up') {
    return operationTargets(operation.target, input, currentTarget).map((target) => ({
      kind: 'stand-up' as const,
      operationId: operation.id,
      targetId: target.id,
      usesTargetReactionIfAvailable: true as const,
    }))
  }
  if (operation.kind === 'summon') {
    return [{
      kind: 'summon', operationId: operation.id, monsterId: operation.monsterId,
      count: evaluateAmount(operation.count, input, currentTarget, false, false),
      timing: operation.timing, durationRounds: operation.durationRounds,
      concentration: operation.concentration, side: operation.side, persistent: operation.persistent,
      persistAfterConcentrationCompletes: operation.persistAfterConcentrationCompletes,
      becomesHostileAfterConcentrationEnds: operation.becomesHostileAfterConcentrationEnds,
      minimumMaximumHitPoints: operation.minimumMaximumHitPoints == null ? undefined
        : Math.max(1, evaluateAmount(operation.minimumMaximumHitPoints, input, input.actor, false, false)),
      armorClassBonus: operation.armorClassBonus == null ? undefined
        : evaluateAmount(operation.armorClassBonus, input, input.actor, false, false),
      weaponAttackBonus: operation.weaponAttackBonus == null ? undefined
        : evaluateAmount(operation.weaponAttackBonus, input, input.actor, false, false),
      weaponDamageBonus: operation.weaponDamageBonus == null ? undefined
        : evaluateAmount(operation.weaponDamageBonus, input, input.actor, false, false),
      savingThrowBonus: operation.savingThrowBonus == null ? undefined
        : evaluateAmount(operation.savingThrowBonus, input, input.actor, false, false),
      proficientSkillCheckBonus: operation.proficientSkillCheckBonus == null ? undefined
        : evaluateAmount(operation.proficientSkillCheckBonus, input, input.actor, false, false),
      weaponAttacksMagical: operation.weaponAttacksMagical === true ? true : undefined,
      attacksPerAction: operation.attacksPerAction == null ? undefined
        : Math.max(1, Math.min(10, evaluateAmount(operation.attacksPerAction, input, input.actor, false, false))),
      shareSelfSpellsRangeFeet: operation.shareSelfSpellsRangeFeet,
      cannotAttack: operation.cannotAttack === true ? true : undefined,
      walkingSpeedFeet: operation.walkingSpeedFeet == null ? undefined
        : Math.max(0, Math.min(1_000, evaluateAmount(operation.walkingSpeedFeet, input, input.actor, false, false))),
      dismissAfterDamageRounds: operation.dismissAfterDamageRounds,
    }]
  }
  if (operation.kind === 'set-directional-command') {
    const angle = input.areaPlacement?.angleDegrees
    if (!Number.isFinite(angle)) {
      throw new Dnd5eFormulaEvaluationError('directional command requires a Host-validated area orientation')
    }
    return [{
      kind: 'set-directional-command', operationId: operation.id,
      actorId: input.actor.id, commandKey: operation.commandKey,
      angleDegrees: ((Number(angle) % 360) + 360) % 360,
    }]
  }
  if (operation.kind === 'transform-creature') {
    const formId = input.choices?.[operation.formChoiceId]
    if (!formId) throw new Dnd5eFormulaEvaluationError(`activity form choice is unavailable: ${operation.formChoiceId}`)
    const rawEquipmentDisposition = operation.equipmentChoiceId
      ? input.choices?.[operation.equipmentChoiceId]
      : undefined
    const equipmentDisposition = rawEquipmentDisposition === 'drop' ||
      rawEquipmentDisposition === 'merge' || rawEquipmentDisposition === 'wear'
      ? rawEquipmentDisposition
      : undefined
    if (operation.equipmentChoiceId && !equipmentDisposition) {
      throw new Dnd5eFormulaEvaluationError(`activity equipment choice is unavailable: ${operation.equipmentChoiceId}`)
    }
    const seenConfirmed = operation.seenConfirmationChoiceId
      ? input.choices?.[operation.seenConfirmationChoiceId] === 'confirmed'
      : undefined
    if (operation.seenConfirmationChoiceId && !seenConfirmed) {
      throw new Dnd5eFormulaEvaluationError(`activity seen-form confirmation is unavailable: ${operation.seenConfirmationChoiceId}`)
    }
    return operationTargets(operation.target, input, currentTarget).map((target) => ({
      kind: 'transform-creature' as const,
      operationId: operation.id,
      targetId: target.id,
      formId,
      profile: operation.profile,
      durationRounds: operation.durationRounds,
      permanent: operation.permanent,
      permanentAfterConcentrationCompletes: operation.permanentAfterConcentrationCompletes,
      concentration: operation.concentration,
      maximumChallengeRating: operation.maximumChallengeRating,
      maximumSizeRank: operation.maximumSizeRank,
      equipmentDisposition,
      seenConfirmed,
      requiresExistingSourceActivityId: operation.requiresExistingSourceActivityId,
    }))
  }
  if (operation.kind === 'grant-extra-turns') {
    return [{
      kind: 'grant-extra-turns',
      operationId: operation.id,
      actorId: input.actor.id,
      turns: evaluateAmount(operation.turns, input, input.actor, false, false),
      freezeOtherCreatures: true,
      endOnAffectOther: operation.endOnAffectOther === true,
      maximumDistanceFromOriginFeet: operation.maximumDistanceFromOriginFeet == null
        ? undefined
        : evaluateAmount(
            operation.maximumDistanceFromOriginFeet,
            input,
            input.actor,
            false,
            false,
          ),
    }]
  }
  if (operation.kind === 'duplicate-creature') return operationTargets(
    operation.target, input, currentTarget,
  ).map((target) => ({
    kind: 'duplicate-creature' as const,
    operationId: operation.id,
    sourceActorId: input.actor.id,
    targetId: target.id,
    profile: operation.profile,
    persistent: true as const,
    level: target.level,
    proficiencyBonus: target.proficiencyBonus,
    abilities: { ...target.abilities },
    armorClass: target.armorClass,
    maximumHitPoints: Math.max(1, Math.floor((target.maxHp ?? target.currentHp ?? 1) / operation.maximumHitPointDivisor)),
    speed: target.speed ?? 30,
    sizeRank: target.sizeRank ?? 2,
    creatureType: target.creatureType,
    saveDc: target.spellSaveDc,
    classLevels: target.classLevels ? { ...target.classLevels } : undefined,
    resources: Object.fromEntries(Object.entries(target.resources ?? {}).map(([id, resource]) => [id, { ...resource }])),
    cannotIncreaseLevel: true as const,
    cannotRegainSpellSlots: true as const,
  }))
  if (operation.kind === 'grant-inventory-item') return [{
    kind: 'grant-inventory-item',
    operationId: operation.id,
    actorId: input.actor.id,
    templateId: operation.templateId,
    quantity: evaluateAmount(operation.quantity, input, input.actor, false, false),
    identified: operation.identified !== false,
    expiresAfterMinutes: operation.expiresAfterMinutes,
  }]
  if (operation.kind === 'establish-spell-authority') return operationTargets(
    operation.target,
    input,
    currentTarget,
  ).map((target) => ({
    kind: 'establish-spell-authority' as const,
    operationId: operation.id,
    sourceActivityId: input.activity.id,
    sourceActorId: input.actor.id,
    targetId: target.id,
    recordKind: operation.recordKind,
    linkedObjectProfile: operation.linkedObjectProfile,
    inventoryInstanceId: operation.requiresSelectedInventoryItem ? input.inventoryInstanceId : undefined,
    spellLevel: input.castLevel,
    maturesAfterMinutes: operation.maturesAfterMinutes,
  }))
  if (operation.kind === 'transition-spell-authority') return operationTargets(
    operation.target, input, currentTarget,
  ).map((target) => ({
    kind: 'transition-spell-authority' as const,
    operationId: operation.id,
    sourceActivityId: input.activity.id,
    sourceActorId: input.actor.id,
    targetId: target.id,
    recordKind: operation.recordKind,
    linkedObjectProfile: operation.linkedObjectProfile,
    authorityRecordId: input.spellAuthorityRecordId,
    transition: operation.transition,
  }))
  if (operation.kind === 'identify-inventory-item') return [{
    kind: 'identify-inventory-item', operationId: operation.id, actorId: input.actor.id,
  }]
  if (operation.kind === 'purify-inventory-item') return [{
    kind: 'purify-inventory-item', operationId: operation.id, actorId: input.actor.id,
  }]
  if (operation.kind === 'emit-sound') return [{
    kind: 'emit-sound', operationId: operation.id, actorId: input.actor.id,
    label: operation.label, audibleRadiusFeet: operation.audibleRadiusFeet,
  }]
  if (operation.kind === 'open-communication') return operationTargets(
    operation.target,
    input,
    currentTarget,
  ).map((target) => ({
    kind: 'open-communication' as const,
    operationId: operation.id,
    actorId: input.actor.id,
    targetId: target.id,
    medium: operation.medium,
    requiresTargetLanguage: operation.requiresTargetLanguage,
    allowsImmediateReply: operation.allowsImmediateReply,
  }))
  if (operation.kind === 'modify-map-object-lock') return [{
    kind: 'modify-map-object-lock', operationId: operation.id, mode: operation.mode,
    targetKinds: [...operation.targetKinds], spellLevel: Math.max(0, Math.min(9, Math.floor(input.castLevel ?? 0))),
    authorizedTargetIds: operation.accessPolicy === 'selected-creatures-and-password'
      ? [...(input.areaExemptTargetIds ?? [])]
      : undefined,
    passwordDigest: operation.accessPolicy === 'selected-creatures-and-password' && input.secretPhrase
      ? hashDnd5eArcaneLockPasswordV1(input.secretPhrase)
      : undefined,
    suppressionMinutes: operation.suppressionMinutes,
  }]
  if (operation.kind === 'purify-map-consumables') return [{
    kind: 'purify-map-consumables', operationId: operation.id,
    contaminants: [...operation.contaminants],
  }]
  if (operation.kind === 'enchant-map-object-light') return [{
    kind: 'enchant-map-object-light', operationId: operation.id,
    brightRadiusFeet: operation.brightRadiusFeet,
    dimRadiusFeet: operation.dimRadiusFeet,
    color: operation.color,
    durationMinutes: operation.durationMinutes,
  }]
  if (operation.kind === 'create-persistent-area') {
    const magicMouth = operation.mappedObjectEnchantment === 'magic-mouth'
      ? input.magicMouth
      : undefined
    const castLevelProfile = [...(operation.castLevelProfiles ?? [])]
      .filter((profile) => profile.minimumCastLevel <= (input.castLevel ?? 0))
      .sort((left, right) => right.minimumCastLevel - left.minimumCastLevel)[0]
    const occupantModifiers = castLevelProfile?.occupantModifiers ?? operation.occupantModifiers
    const hallow = operation.hallow
      ? (() => {
          const additionalEffect = input.choices?.[operation.hallow.effectChoiceId]
          const scope = input.choices?.[operation.hallow.scopeChoiceId]
          const damageType = input.choices?.[operation.hallow.damageTypeChoiceId]
          const effectScope: import('../persistentAreaTypes').Dnd5eHallowAreaState['effectScope'] =
            scope === 'allies' || scope === 'enemies'
            ? scope
            : scope?.startsWith('type-')
              ? 'creature-type' as const
              : 'all' as const
          const affectedCreatureType = scope?.startsWith('type-')
            ? scope.slice('type-'.length)
            : undefined
          const wardedCreatureTypes = (Object.entries(operation.hallow.wardExemptionChoiceIds) as [
            'celestial' | 'elemental' | 'fey' | 'fiend' | 'undead', string,
          ][]).flatMap(([creatureType, choiceId]) =>
            input.choices?.[choiceId] === 'exempt' ? [] : [creatureType])
          return {
            additionalEffect: additionalEffect as import('../persistentAreaTypes').Dnd5eHallowAdditionalEffect,
            ...((additionalEffect === 'energy-protection' || additionalEffect === 'energy-vulnerability') &&
              (DND5E_DAMAGE_TYPES as readonly string[]).includes(damageType ?? '')
              ? { damageType: damageType as Dnd5eDamageType }
              : {}),
            effectScope,
            ...(affectedCreatureType ? { affectedCreatureType } : {}),
            wardedCreatureTypes,
          }
        })()
      : undefined
    const hallucinatoryTerrain = operation.hallucinatoryTerrain
      ? {
          appearance: input.choices?.[
            operation.hallucinatoryTerrain.appearanceChoiceId
          ] as import('../persistentAreaTypes').Dnd5eHallucinatoryTerrainAppearance,
        }
      : undefined
    const programmedIllusion = operation.programmedIllusion
      ? {
          form: input.choices?.[
            operation.programmedIllusion.formChoiceId
          ] as import('../persistentAreaTypes').Dnd5eProgrammedIllusionForm,
          triggerSense: input.choices?.[
            operation.programmedIllusion.triggerSenseChoiceId
          ] as import('../persistentAreaTypes').Dnd5eProgrammedIllusionTriggerSense,
        }
      : undefined
    const hallowLighting = hallow?.additionalEffect === 'darkness'
      ? {
          kind: 'magical-darkness' as const,
          radiusFeet: 60,
          spellLevel: 5,
          suppressesMagicalLightThroughLevel: 4,
        }
      : hallow?.additionalEffect === 'daylight'
        ? {
            kind: 'light' as const,
            brightRadiusFeet: 60,
            dimRadiusFeet: 0,
            color: '#fff7cc',
            spellLevel: 5,
            suppressesMagicalDarknessThroughLevel: 4,
          }
        : undefined
    const hallowRequiresCreatureSave = hallow && [
      'courage', 'energy-protection', 'energy-vulnerability',
      'extradimensional-interference', 'fear', 'tongues',
    ].includes(hallow.additionalEffect)
    const hallowTriggers = hallowRequiresCreatureSave
      ? [{
          id: 'hallow-effect-enter', frequencyGroupId: 'hallow-additional-effect-save',
          label: `${operation.label}·附加效果（进入）`, timing: 'on-enter' as const,
          oncePerTurn: true,
          savingThrow: {
            ability: 'cha' as const, dc: 'source-save-dc' as const,
            onSuccess: 'none' as const, magical: true,
          },
          ...(hallow.additionalEffect === 'fear' ? { condition: {
            condition: 'frightened' as const,
            duration: { expiresAt: 'target-turn-end' as const, remainingRounds: 1 },
          } } : {}),
        }, {
          id: 'hallow-effect-turn-start', frequencyGroupId: 'hallow-additional-effect-save',
          label: `${operation.label}·附加效果（回合开始）`, timing: 'turn-start' as const,
          oncePerTurn: true,
          savingThrow: {
            ability: 'cha' as const, dc: 'source-save-dc' as const,
            onSuccess: 'none' as const, magical: true,
          },
          ...(hallow.additionalEffect === 'fear' ? { condition: {
            condition: 'frightened' as const,
            duration: { expiresAt: 'target-turn-end' as const, remainingRounds: 1 },
          } } : {}),
        }]
      : undefined
    return [{
      kind: 'create-persistent-area', operationId: operation.id, label: operation.label,
      instanceCount: operation.instanceCount,
      durationRounds: castLevelProfile?.durationRounds ?? operation.durationRounds,
      permanent: castLevelProfile?.permanent ?? operation.permanent,
      concentration: castLevelProfile?.concentration ?? operation.concentration,
      mappedObjectEnchantment: operation.mappedObjectEnchantment,
      magicMouth,
      color: operation.color, visual: operation.visual,
      lighting: hallowLighting ?? operation.lighting,
      utilityProjectionId: operation.utilityProjectionId,
      triggers: magicMouth?.triggerMode === 'proximity'
        ? [{
            id: 'magic-mouth-proximity',
            label: '魔嘴术·触发讯息',
            timing: 'on-enter' as const,
            oncePerRound: false,
            maximumTotalUses: magicMouth.repeat ? undefined : 1,
            notification: {
              delivery: 'audible' as const,
              audibleRadiusFeet: 30,
              message: magicMouth.message,
            },
          }]
        : (hallowTriggers ?? operation.triggers)?.map((trigger) => structuredClone(trigger)),
      movement: operation.movement ? { ...operation.movement } : undefined,
      lifecycle: operation.lifecycle ? structuredClone(operation.lifecycle) : undefined,
      movementCostMultiplier: operation.movementCostMultiplier,
      obscuration: operation.obscuration ? { ...operation.obscuration } : undefined,
      occupantModifiers: hallow && hallow.wardedCreatureTypes.length > 0
        ? {
            conditionImmunitiesBySourceCreatureType: [{
              conditions: ['charmed', 'frightened', 'possessed'],
              sourceCreatureTypes: hallow.wardedCreatureTypes,
            }],
          }
        : occupantModifiers
        ? {
            ...occupantModifiers,
            damageImmunities: occupantModifiers.damageImmunities
              ? [...occupantModifiers.damageImmunities]
              : undefined,
            damageResistances: occupantModifiers.damageResistances
              ? [...occupantModifiers.damageResistances]
              : undefined,
            damageVulnerabilities: occupantModifiers.damageVulnerabilities
              ? [...occupantModifiers.damageVulnerabilities]
              : undefined,
            conditionImmunities: occupantModifiers.conditionImmunities
              ? [...occupantModifiers.conditionImmunities]
              : undefined,
          }
        : undefined,
      blocking: hallow && hallow.wardedCreatureTypes.length > 0
        ? {
            movement: true,
            movementMode: 'enter' as const,
            includedCreatureTypes: [...hallow.wardedCreatureTypes],
            blocksTeleportationEntry: true,
          }
        : operation.blocking ? { ...operation.blocking } : undefined,
      creationConstraints: operation.creationConstraints ? { ...operation.creationConstraints } : undefined,
      hallow,
      hallucinatoryTerrain,
      programmedIllusion,
      entityProfile: operation.entityProfile ? {
        ...operation.entityProfile,
        hitPoints: operation.entityProfile.hitPoints === 'actor-max-hit-points'
          ? Math.max(1, Math.floor(input.actor.maxHp ?? 1))
          : operation.entityProfile.hitPoints,
      } : undefined,
      triggerExemptTargetIds: operation.triggerExemptions === 'selected-creatures'
        ? [...(input.areaExemptTargetIds ?? [])]
        : undefined,
      anchorMode: operation.anchorMode,
      sourceExitBehavior: operation.sourceExitBehavior,
      sourceOverlapBehavior: operation.sourceOverlapBehavior,
      teleportationExitSavingThrow: operation.teleportationExitSavingThrow
        ? { ...operation.teleportationExitSavingThrow }
        : undefined,
      weaponHitBonusDamage: operation.weaponHitBonusDamage
        ? { ...operation.weaponHitBonusDamage }
        : undefined,
      grantedActivities: operation.grantedActivities?.map((grant) => ({ ...grant })),
      effectToken: operation.effectToken ? { ...operation.effectToken } : undefined,
      sourceFollower: operation.sourceFollower ? { ...operation.sourceFollower } : undefined,
      areaInstance: input.activity.target.kind === 'area' && input.areaPlacement
        ? {
            ...input.areaPlacement,
            origin: input.activity.target.origin,
            shape: input.activity.target.shape,
          }
        : undefined,
    }]
  }
  if (operation.kind === 'invoke-activity') {
    return [{
      kind: 'invoke-activity', operationId: operation.id, activityId: operation.activityId,
      actorId: input.actor.id,
      targetId: operation.target === 'target' ? currentTarget?.id : input.actor.id,
      repeat: evaluateAmount(operation.repeat, input, currentTarget, false, false),
    }]
  }
  if (operation.kind === 'mechanic') {
    return operationTargets(operation.target, input, currentTarget).flatMap((target) =>
      resolveDnd5eMechanicOperationV1({
        activity: input.activity,
        operation,
        execution: input,
        target,
        critical,
      }))
  }
  if (operation.kind === 'resource') {
    const subject = operation.subject === 'actor' ? input.actor : currentTarget
    if (!subject) return []
    return [{
      kind: operation.mode === 'spend' ? 'spend-resource' : 'restore-resource',
      operationId: operation.id,
      subjectId: subject.id,
      resourceId: operation.resourceId,
      amount: evaluateAmount(operation.amount, input, currentTarget, false, false),
    }]
  }
  if (operation.kind === 'dispel-area') return [{
    kind: 'dispel-area', operationId: operation.id, actorId: input.actor.id, areaKind: operation.areaKind,
    radiusFeet: evaluateAmount(operation.radiusFeet, input, input.actor, false, false),
    maximumSpellLevel: evaluateAmount(operation.maximumSpellLevel, input, input.actor, false, false),
  }]
  if (operation.kind === 'command-owned-companion') {
    if (!currentTarget) return []
    return [{
      kind: 'command-owned-companion', operationId: operation.id,
      targetId: currentTarget.id, command: operation.command,
    }]
  }
  if (operation.kind === 'grant-weapon-attack') return [{
    kind: 'grant-weapon-attack',
    operationId: operation.id,
    grantId: operation.grantId,
    label: operation.label,
    economy: operation.economy,
    attacks: operation.attacks ?? 1,
    weaponModes: operation.weaponModes ? [...operation.weaponModes] : undefined,
    weaponIds: operation.weaponIds ? [...operation.weaponIds] : undefined,
    requiredWeaponProperties: operation.requiredWeaponProperties ? [...operation.requiredWeaponProperties] : undefined,
    forbiddenWeaponProperties: operation.forbiddenWeaponProperties ? [...operation.forbiddenWeaponProperties] : undefined,
    proficient: operation.proficient,
    damageDice: operation.damageDice ? { ...operation.damageDice } : undefined,
    damageType: operation.damageType,
    damageBonus: operation.damageBonus,
    weaponSlots: operation.weaponSlots ? [...operation.weaponSlots] : undefined,
  }]
  if (operation.kind === 'grant-basic-action') return [{
    kind: 'grant-basic-action',
    operationId: operation.id,
    grantId: operation.grantId,
    label: operation.label,
    economy: operation.economy,
    actions: [...operation.actions],
    shovePushDistanceBonusFeet: operation.shovePushDistanceBonusFeet,
  }]
  return operationTargets(operation.target, input, currentTarget).map((target):
    Dnd5eActivityCapabilityProposal | Dnd5eActivityCapabilityProposal[] => {
    if (operation.kind === 'damage') {
      const damageType = operation.damageType === 'inherit-primary' ? input.parentDamageType : operation.damageType
      if (!damageType) throw new Dnd5eFormulaEvaluationError('parent damage type is unavailable')
      const elementalAdeptMinimum = input.activity.legacySource?.kind === 'spell' &&
        input.actor.elementalAdeptDamageTypes?.includes(damageType)
        ? 2
        : 1
      const baseAmount = evaluateAmount(
        operation.amount,
        input,
        target,
        critical,
        operation.critical === 'double-dice',
        elementalAdeptMinimum,
      )
      if (
        baseAmount <= 0 ||
        !dnd5eBestowCurseSpellDamageRiderAppliesV1(input.activity, input.actor, target)
      ) return {
        kind: 'deal-damage', operationId: operation.id, targetId: target.id,
        amount: baseAmount, damageType, magical: operation.magical === true,
      }
      const rollId = `${DND5E_BESTOW_CURSE_SPELL_DAMAGE_ROLL_ID}:${target.id}`
      const riderRoll = input.rolls[rollId]
      const expectedDice = critical && operation.critical === 'double-dice' ? 2 : 1
      if (
        !riderRoll || riderRoll.values.length !== expectedDice ||
        riderRoll.values.some((value) => !Number.isInteger(value) || value < 1 || value > 8)
      ) throw new Dnd5eFormulaEvaluationError(`invalid Bestow Curse spell-damage roll: ${rollId}`)
      return [{
        kind: 'deal-damage',
        operationId: operation.id,
        targetId: target.id,
        amount: baseAmount,
        damageType,
        magical: operation.magical === true,
      }, {
        kind: 'deal-damage',
        operationId: `${operation.id}:${DND5E_BESTOW_CURSE_SPELL_DAMAGE_ROLL_ID}`,
        targetId: target.id,
        amount: riderRoll.values.reduce((total, value) => total + value, 0),
        damageType: 'necrotic',
        magical: true,
      }]
    }
    if (operation.kind === 'healing') {
      const maximizeDice = target.maximizeHealingDice === true
      const amount = evaluateAmount(operation.amount, input, target, false, false, 1, maximizeDice)
      const diceAudit = formulaDiceAudit(operation.amount, input, maximizeDice)
      const displayedDiceTotal = diceAudit.reduce((total, die) =>
        total + die.values.reduce((sum, value) => sum + value, 0), 0)
      return {
        kind: 'heal', operationId: operation.id, targetId: target.id, amount,
        ...(diceAudit.length > 0
          ? { diceAudit, formulaAdjustment: amount - displayedDiceTotal }
          : {}),
      }
    }
    if (operation.kind === 'revive') return {
      kind: 'revive', operationId: operation.id, targetId: target.id,
      hitPoints: Math.max(1, evaluateAmount(operation.hitPoints, input, target, false, false)),
      maximumDeathAgeRounds: operation.maximumDeathAgeRounds,
      excludesDeathFromOldAge: operation.excludesDeathFromOldAge,
      requiresFreeWillingSoul: operation.requiresFreeWillingSoul,
      excludedCreatureTypes: operation.excludedCreatureTypes ? [...operation.excludedCreatureTypes] : undefined,
      requiresBody: operation.requiresBody,
      restoreBody: operation.restoreBody,
      removeConditions: operation.removeConditions ? [...operation.removeConditions] : undefined,
      removeDiseases: operation.removeDiseases,
      removeCurses: operation.removeCurses,
      createsNewBodyIfMissing: operation.createsNewBodyIfMissing,
      requiresSpokenNameIfBodyMissing: operation.requiresSpokenNameIfBodyMissing,
      newBodyPlacementRangeFeet: operation.newBodyPlacementRangeFeet,
      completionDelayRounds: input.completionDelayRounds,
      longRestPenalty: operation.longRestPenalty ? { ...operation.longRestPenalty } : undefined,
      casterLongRestStrainAfterDeathAgeRounds:
        operation.casterLongRestStrainAfterDeathAgeRounds,
    }
    if (operation.kind === 'temporary-hit-points') return {
      kind: 'grant-temporary-hit-points', operationId: operation.id, targetId: target.id,
      amount: evaluateAmount(operation.amount, input, target, false, false),
    }
    if (operation.kind === 'instant-death') return {
      kind: 'instant-death', operationId: operation.id, targetId: target.id,
    }
    if (operation.kind === 'apply-standard-condition') return {
      kind: 'apply-standard-condition', operationId: operation.id, targetId: target.id,
      condition: operation.condition, duration: resolveEffectDuration(operation.duration, input, target),
    }
    if (operation.kind === 'apply-effect') {
      const effect = input.activity.effects?.find((candidate) => candidate.id === operation.effectId)
      if (!effect) throw new Dnd5eFormulaEvaluationError(`activity effect is unavailable: ${operation.effectId}`)
      return {
        kind: 'apply-effect', operationId: operation.id, targetId: target.id,
        ...resolveDnd5eAppliedEffectDefinitionV1(effect, {
          actor: input.actor,
          target,
          castLevel: input.castLevel,
          rolls: input.rolls,
        }),
      }
    }
    if (operation.kind === 'remove-standard-condition') return {
      kind: 'remove-standard-condition', operationId: operation.id, targetId: target.id,
      condition: operation.condition,
      sourceCreatureTypes: operation.sourceCreatureTypes
        ? [...operation.sourceCreatureTypes]
        : undefined,
    }
    if (operation.kind === 'move') return {
      kind: 'move', operationId: operation.id, targetId: target.id, mode: operation.mode,
      distanceFeet: evaluateAmount(operation.distanceFeet, input, target, false, false),
      verticalDestination: operation.verticalDestination,
      placement: operation.placement,
      originIllumination: operation.originIllumination,
      destinationIllumination: operation.destinationIllumination,
      requiresLineOfSight: operation.requiresLineOfSight,
      ignoresOpportunityAttacks: operation.ignoresOpportunityAttacks,
      usesActorMovement: operation.usesActorMovement,
      usesTargetReactionIfAvailable: operation.usesTargetReactionIfAvailable,
      provokesOpportunityAttacks: operation.provokesOpportunityAttacks,
    }
    if (operation.kind === 'relocate-granting-area') return {
      kind: 'relocate-granting-area', operationId: operation.id, targetId: target.id,
      maximumFeet: evaluateAmount(operation.maximumFeet, input, target, false, false),
      interposition: operation.interposition?.kind === 'clear'
        ? 'clear' as const
        : operation.interposition?.kind === 'by-target-strength'
          ? target.abilities.str <= operation.interposition.maximumStrengthToBlock
            ? 'blocked' as const
            : 'difficult-terrain' as const
          : undefined,
    }
    if (operation.kind === 'reshape-granting-area') return {
      kind: 'reshape-granting-area', operationId: operation.id, targetId: input.actor.id,
      maximumFeet: operation.maximumFeet
        ? evaluateAmount(operation.maximumFeet, input, input.actor, false, false)
        : undefined,
    }
    if (operation.kind === 'set-granting-area-senses') return {
      kind: 'set-granting-area-senses', operationId: operation.id,
      targetId: input.actor.id, mode: operation.mode,
    }
    if (operation.kind === 'detonate-granting-area') return {
      kind: 'detonate-granting-area', operationId: operation.id, actorId: input.actor.id,
    }
    if (operation.kind === 'remove-effect') return {
      kind: 'remove-effect', operationId: operation.id, targetId: target.id,
      effectId: operation.effectId, source: operation.source,
    }
    if (operation.kind === 'remove-effects-by-tag') return {
      kind: 'remove-effects-by-tag', operationId: operation.id, targetId: target.id,
      tags: [...operation.tags], match: operation.match, source: operation.source,
      sourceCreatureTypes: operation.sourceCreatureTypes
        ? [...operation.sourceCreatureTypes]
        : undefined,
      maximumCount: operation.maximumCount,
    }
    if (operation.kind === 'adjust-exhaustion') return {
      kind: 'adjust-exhaustion', operationId: operation.id, targetId: target.id,
      amount: evaluateSignedAmount(operation.amount, input, target),
    }
    if (operation.kind === 'lower-ability-score') return {
      kind: 'lower-ability-score', operationId: operation.id, targetId: target.id,
      ability: operation.ability,
      maximumScore: evaluateAmount(operation.maximumScore, input, target, false, false),
      recovery: operation.recovery,
      recoveryGroupId: operation.recoveryGroupId,
    }
    if (operation.kind === 'recover-ability-score') return {
      kind: 'recover-ability-score', operationId: operation.id, targetId: target.id,
      ability: operation.ability, maximumCount: operation.maximumCount,
    }
    if (operation.kind === 'recover-hit-point-maximum') return {
      kind: 'recover-hit-point-maximum', operationId: operation.id, targetId: target.id,
      maximumCount: operation.maximumCount,
    }
    if (operation.kind === 'break-inventory-item-attunement') return {
      kind: 'break-inventory-item-attunement', operationId: operation.id,
      ownerId: target.id, requireCursedMagicItem: true,
    }
    throw new Dnd5eFormulaEvaluationError(`unsupported Activity operation: ${operation.kind}`)
  }).flat()
}

export function resolveDnd5eActivity(input: Dnd5eActivityExecutionInput): Dnd5eActivityExecutionResult {
  const definitionErrors = validateDnd5eActivityDefinitionV1(input.activity)
  if (definitionErrors.length) return { ok: false, reason: 'invalid-definition', details: definitionErrors }
  const scaled = scaleActivity(input)
  const baseActivity = scaled.activity
  const resolvedChoices: Record<string, string> = {}
  const knownChoiceIds = new Set([
    ...(baseActivity.choices ?? []).map((choice) => choice.id),
    ...(baseActivity.requirements ?? []).flatMap((requirement) => requirement.kind === 'choice' ? [requirement.choiceId] : []),
  ])
  if (Object.keys(input.choices ?? {}).some((choiceId) => !knownChoiceIds.has(choiceId))) {
    return { ok: false, reason: 'requirement-failed', details: ['unknown Activity choice'] }
  }
  for (const choice of baseActivity.choices ?? []) {
    if (!dnd5eActivityChoiceIsRelevantV1(baseActivity, choice, {
      ...input.choices,
      ...resolvedChoices,
    })) continue
    const selected = input.choices?.[choice.id] ?? choice.defaultOptionId
    if (!selected || !choice.options.some((option) => option.id === selected)) {
      return { ok: false, reason: 'requirement-failed', details: [`missing or invalid Activity choice: ${choice.id}`] }
    }
    resolvedChoices[choice.id] = selected
  }
  const activity = dnd5eActivityWithTargetChoicesV1(baseActivity, resolvedChoices)
  const executionInput: Dnd5eActivityExecutionInput = {
    ...input, activity,
    choices: Object.keys(resolvedChoices).length > 0 ? resolvedChoices : input.choices,
  }
  if (!input.actor.id || input.actor.level < 1 || input.actor.armorClass < 0) {
    return { ok: false, reason: 'invalid-actor', details: ['invalid actor snapshot'] }
  }
  const spellActivity = activity.legacySource?.kind === 'spell'
  if (spellActivity && input.actor.magicSuppressed) {
    return {
      ok: false,
      reason: 'requirement-failed',
      details: ['spellcasting is suppressed by an antimagic area'],
    }
  }
  const invocation = matchDnd5eActivityInvocationV1({
    activity: input.activity,
    actorId: input.actor.id,
    targetIds: input.targets.map((target) => target.id),
    triggerContext: input.triggerContext,
    confirmedBy: input.confirmedBy,
    dmApproved: input.dmApproved,
  })
  if (!invocation.ok) return invocation
  for (const choice of activity.choices ?? []) {
    const selected = choice.options.find((option) => option.id === resolvedChoices[choice.id])
    if (selected?.requirements?.some((requirement) => !predicateSatisfied(requirement, executionInput, input.targets[0]))) {
      return { ok: false, reason: 'requirement-failed', details: [`choice requirement failed: ${choice.id}/${selected.id}`] }
    }
  }
  if (activity.target.kind === 'self' && (input.targets.length !== 1 || input.targets[0]?.id !== input.actor.id)) {
    return { ok: false, reason: 'invalid-target', details: ['self Activity requires the actor as its only target'] }
  }
  if (activity.target.kind === 'creature') {
    if (input.targets.length < 1 || input.targets.length > activity.target.count) {
      return { ok: false, reason: 'invalid-target', details: ['target count is invalid'] }
    }
    for (const target of input.targets) {
      const actual = relation(input.actor, target)
      if (!activity.target.includeSelf && actual === 'self') {
        return { ok: false, reason: 'invalid-target', details: ['self targeting is unavailable'] }
      }
      if (activity.target.relation !== 'any' && activity.target.relation !== actual && !(activity.target.relation === 'ally' && actual === 'self')) {
        return { ok: false, reason: 'invalid-target', details: ['target relation is invalid'] }
      }
      const distance = input.distanceFeetByTargetId?.[target.id]
      if (
        activity.target.rangeFeet != null &&
        (distance == null || distance > activity.target.rangeFeet || distance < (activity.target.minimumRangeFeet ?? 0))
      ) return { ok: false, reason: 'invalid-target', details: ['target distance is invalid'] }
    }
  }
  let areaInstance: Dnd5eActivityAreaInstanceV1 | undefined
  if (activity.target.kind === 'area') {
    if (input.targets.length > activity.target.maximumTargets) {
      return { ok: false, reason: 'invalid-target', details: ['area target count is invalid'] }
    }
    if (!input.areaPlacement) return { ok: false, reason: 'invalid-target', details: ['area placement is required'] }
    const areaInstances = input.areaPlacement.instances ?? [{
      x: input.areaPlacement.x,
      y: input.areaPlacement.y,
      elevationFeet: input.areaPlacement.elevationFeet,
    }]
    const maximumInstances = activity.target.instanceCount ?? 1
    const minimumInstances = activity.target.minimumInstanceCount ?? maximumInstances
    if (
      areaInstances.length < minimumInstances || areaInstances.length > maximumInstances ||
      areaInstances[0]?.x !== input.areaPlacement.x || areaInstances[0]?.y !== input.areaPlacement.y ||
      new Set(areaInstances.map((instance) => `${instance.x}\u0000${instance.y}\u0000${instance.elevationFeet ?? ''}`)).size !== areaInstances.length
    ) return { ok: false, reason: 'invalid-target', details: ['area instance count or anchors are invalid'] }
    for (const target of input.targets) {
      const actual = relation(input.actor, target)
      if (!activity.target.includeSelf && actual === 'self') {
        return { ok: false, reason: 'invalid-target', details: ['self targeting is unavailable'] }
      }
      if (activity.target.relation !== 'any' && activity.target.relation !== actual && !(activity.target.relation === 'ally' && actual === 'self')) {
        return { ok: false, reason: 'invalid-target', details: ['target relation is invalid'] }
      }
    }
    if (
      activity.target.origin === 'point' && activity.target.placeRangeFeet != null &&
      (input.areaPlacementDistanceFeet == null || input.areaPlacementDistanceFeet < 0 ||
        input.areaPlacementDistanceFeet > activity.target.placeRangeFeet)
    ) return { ok: false, reason: 'invalid-target', details: ['area placement distance is invalid'] }
    if (!activity.target.rotatable && input.areaPlacement.angleDegrees != null && input.areaPlacement.angleDegrees !== 0) {
      return { ok: false, reason: 'invalid-target', details: ['area rotation is unavailable'] }
    }
    const resolveDimension = (
      selected: number | undefined,
      minimum: number | undefined,
      maximum: number | undefined,
      gridAligned: boolean,
      gridStepFeet = 5,
    ) => {
      if (maximum == null) return selected == null ? undefined : null
      const value = selected ?? maximum
      const lower = minimum ?? maximum
      return Number.isFinite(value) &&
        (!gridAligned || value % gridStepFeet === 0) && value >= lower && value <= maximum
        ? value
        : null
    }
    const radiusStepFeet = activity.target.minimumRadiusFeet != null && activity.target.minimumRadiusFeet % 5 !== 0 ? 2.5 : 5
    const radiusFeet = resolveDimension(input.areaPlacement.radiusFeet, activity.target.minimumRadiusFeet, activity.target.radiusFeet, true, radiusStepFeet)
    const lengthFeet = resolveDimension(input.areaPlacement.lengthFeet, activity.target.minimumLengthFeet, activity.target.lengthFeet, true)
    const widthFeet = resolveDimension(input.areaPlacement.widthFeet, activity.target.minimumWidthFeet, activity.target.widthFeet, true)
    // Vertical extent is not a grid-plane dimension. Rules-valid heights such
    // as Passwall's 8-foot opening must not be rounded to five-foot squares.
    const heightFeet = resolveDimension(input.areaPlacement.heightFeet, activity.target.minimumHeightFeet, activity.target.heightFeet, false)
    if ([radiusFeet, lengthFeet, widthFeet, heightFeet].some((value) => value === null)) {
      return { ok: false, reason: 'invalid-target', details: ['area dimensions are invalid'] }
    }
    areaInstance = {
      ...input.areaPlacement,
      instances: input.areaPlacement.instances?.map((instance) => ({ ...instance })),
      angleDegrees: input.areaPlacement.angleDegrees == null
        ? undefined
        : ((input.areaPlacement.angleDegrees % 360) + 360) % 360,
      origin: activity.target.origin,
      shape: activity.target.shape,
      radiusFeet: radiusFeet ?? undefined,
      lengthFeet: lengthFeet ?? undefined,
      widthFeet: widthFeet ?? undefined,
      heightFeet: heightFeet ?? undefined,
    }
    executionInput.areaPlacement = {
      x: areaInstance.x,
      y: areaInstance.y,
      elevationFeet: areaInstance.elevationFeet,
      angleDegrees: areaInstance.angleDegrees,
      radiusFeet: areaInstance.radiusFeet,
      lengthFeet: areaInstance.lengthFeet,
      widthFeet: areaInstance.widthFeet,
      heightFeet: areaInstance.heightFeet,
      instances: areaInstance.instances?.map((instance) => ({ ...instance })),
    }
  }
  const projectileTargets = input.projectileTargetIds?.map((id) => input.targets.find((target) => target.id === id))
  if (projectileTargets?.some((target) => !target)) {
    return { ok: false, reason: 'invalid-target', details: ['projectile target is unavailable'] }
  }
  try {
    for (const predicate of activity.requirements ?? []) {
      const targets = input.targets.length ? input.targets : [undefined]
      if (!targets.every((target) => predicateSatisfied(predicate, executionInput, target))) {
        return { ok: false, reason: 'requirement-failed', details: [`requirement failed: ${predicate.kind}`] }
      }
    }
  } catch (error) {
    return { ok: false, reason: 'requirement-failed', details: [error instanceof Error ? error.message : String(error)] }
  }
  const automation = dnd5eActivityAutomationAnalysisV1(activity).capability
  if ((automation.level === 'dm-adjudication' || automation.level === 'unsupported') && !input.dmApproved) {
    return { ok: false, reason: 'dm-approval-required', details: [...automation.limitations] }
  }
  try {
    // Keep the submitted targets for entitlement/range validation and resource
    // consumption, but never ask for dice or emit spell-effect proposals for a
    // creature currently inside an antimagic volume.
    const baseSpellLevel = activity.consumption?.find((entry) => entry.kind === 'spell-slot')?.minimumLevel ?? 0
    const actorSpellSuppressionAreaIds = new Set(
      input.actor.spellSuppressionAreas?.map((entry) => entry.areaId) ?? [],
    )
    const spellEffectSuppressedForTarget = (target: Dnd5eActivityActorSnapshot) =>
      target.magicSuppressed === true || target.spellSuppressionAreas?.some((entry) =>
        !actorSpellSuppressionAreaIds.has(entry.areaId) && baseSpellLevel <= entry.maximumSpellLevel) === true
    const divineWordActivity = activity.legacySource?.kind === 'spell' &&
      activity.legacySource.id === 'divine-word'
    const fleshToStoneActivity = activity.legacySource?.kind === 'spell' &&
      activity.legacySource.id === 'flesh-to-stone'
    const fireStormSparesPlants = activity.legacySource?.kind === 'spell' &&
      activity.legacySource.id === 'fire-storm' &&
      executionInput.choices?.mode === 'spare-plants'
    const isPlantCreature = (target: Dnd5eActivityActorSnapshot): boolean => {
      const creatureType = target.creatureType?.trim().toLocaleLowerCase()
      return creatureType === 'plant' || creatureType?.includes('植物') === true
    }
    const resolutionTargets = spellActivity
      ? input.targets.filter((target) =>
          !spellEffectSuppressedForTarget(target) &&
          (!divineWordActivity || target.canHearActivitySource !== false) &&
          (!fleshToStoneActivity || dnd5eFleshToStoneTargetHasFlesh(target)) &&
          (!fireStormSparesPlants || !isPlantCreature(target)))
      : input.targets
    const resolutionInput = resolutionTargets === input.targets
      ? executionInput
      : { ...executionInput, targets: resolutionTargets }
    const checks: Dnd5eActivityCheckResult[] = []
    for (const check of activity.checks ?? []) {
      if ((check.kind === 'saving-throw' || check.kind === 'attack-roll') && check.appliesWhenChoice &&
        !check.appliesWhenChoice.optionIds.includes(resolutionInput.choices?.[check.appliesWhenChoice.choiceId] ?? '')) {
        continue
      }
      const checkTargets = check.scope === 'per-target'
        ? resolutionTargets
        : resolutionTargets[0] || !spellActivity
          ? [resolutionTargets[0]]
          : []
      for (const target of checkTargets) {
        if (check.kind === 'saving-throw' && check.appliesWhenCheck) {
          const prerequisite = checks.find((candidate) =>
            candidate.checkId === check.appliesWhenCheck!.checkId &&
            (candidate.targetId == null || candidate.targetId === target?.id))
          if (!prerequisite?.success) continue
        }
        if (check.kind === 'random-roll' && check.appliesWhenCheckTotal) {
          const prerequisite = checks.find((candidate) =>
            candidate.checkId === check.appliesWhenCheckTotal!.checkId &&
            (candidate.targetId == null || candidate.targetId === target?.id))
          if (
            !prerequisite ||
            (check.appliesWhenCheckTotal.minimum != null && prerequisite.total < check.appliesWhenCheckTotal.minimum) ||
            (check.appliesWhenCheckTotal.maximum != null && prerequisite.total > check.appliesWhenCheckTotal.maximum)
          ) continue
        }
        checks.push(resolveCheck(check, resolutionInput, target))
      }
    }
    const operationExecutionInput: Dnd5eActivityExecutionInput = {
      ...resolutionInput,
      resolvedChecks: checks,
    }
    const proposals: Dnd5eActivityCapabilityProposal[] = []
    const appliedOnce = new Set<string>()
    for (const outcome of activity.outcomes) {
      const resolvedProjectileTargets = projectileTargets?.filter((target): target is Dnd5eActivityActorSnapshot => target != null)
      const eligibleProjectileTargets = resolvedProjectileTargets?.filter((target) =>
        !spellActivity || !spellEffectSuppressedForTarget(target))
      const candidateTargets = eligibleProjectileTargets?.length
        ? eligibleProjectileTargets
        : resolutionTargets.length
          ? resolutionTargets
          : activity.target.kind === 'area'
            // A valid area placement can have no creature occupants. Target-
            // independent operations (persistent areas, summons, sounds and
            // DM boundaries) must still resolve once; target-bound operations
            // naturally emit no proposal for an undefined current target.
            ? [undefined]
            : spellActivity
              ? []
              : [undefined]
      for (const target of candidateTargets) {
        const when = outcome.when
        const applies = when.kind === 'always' || (when.kind === 'all'
          ? when.conditions.every((condition) => outcomeConditionApplies(condition, checks, resolutionInput.choices, target, resolutionInput))
          : outcomeConditionApplies(when, checks, resolutionInput.choices, target, resolutionInput))
        if (!applies) continue
        const criticalSuccess = (
          executionInput.triggerContext?.source.kind === 'attack' &&
          executionInput.triggerContext.source.result === 'critical-hit'
        ) || checks.some((candidate) => candidate.criticalSuccess === true &&
          activity.checks?.some((check) =>
            check.id === candidate.checkId && check.kind === 'attack-roll') === true &&
          (candidate.targetId == null || candidate.targetId === target?.id))
        for (const operation of outcome.operations) {
          if (
            operation.kind === 'damage' && target?.successfulSpellSaveNegatesDamage === true &&
            activity.legacySource?.kind === 'spell' &&
            (when.kind === 'check' && checks.some((check) =>
              check.checkId === when.checkId && check.success &&
              (check.targetId == null || check.targetId === target.id)) ||
              when.kind === 'all' && when.conditions.some((condition) =>
                condition.kind === 'check' && checks.some((check) =>
                  check.checkId === condition.checkId && check.success &&
                  (check.targetId == null || check.targetId === target.id))))
          ) continue
          const once = operation.kind === 'summon' || operation.kind === 'duplicate-creature' || operation.kind === 'create-persistent-area' ||
            operation.kind === 'grant-extra-turns' ||
            operation.kind === 'grant-inventory-item' ||
            operation.kind === 'identify-inventory-item' ||
            operation.kind === 'purify-inventory-item' ||
            operation.kind === 'emit-sound' || operation.kind === 'modify-map-object-lock' ||
            operation.kind === 'purify-map-consumables' ||
            operation.kind === 'grant-weapon-attack' || operation.kind === 'grant-basic-action' ||
            operation.kind === 'invoke-activity' || operation.kind === 'manual-adjudication' ||
            ('target' in operation && (
              operation.target === 'actor' ||
              operation.target === 'all-targets' ||
              operation.target === 'all-combatants'
            ))
          const onceKey = `${outcome.id}:${operation.id}`
          if (once && appliedOnce.has(onceKey)) continue
          const repeats = input.projectileTargetIds?.length
            ? 1
            : 1 + Math.max(0, scaled.additionalProjectilesByOperationId.get(operation.id) ?? 0)
          for (let repeat = 0; repeat < repeats; repeat += 1) {
            operationProposals(operation, operationExecutionInput, target, criticalSuccess)
              .forEach((proposal) => proposals.push(proposal))
          }
          if (once) appliedOnce.add(onceKey)
        }
      }
    }
    return {
      ok: true,
      status: proposals.some((proposal) => proposal.kind === 'request-dm-adjudication')
        ? 'dm-adjudication-required'
        : 'resolved',
      checks,
      consumptions: (activity.consumption ?? []).map((consumption) => resolveConsumption(consumption, resolutionInput)),
      proposals,
      areaInstance,
    }
  } catch (error) {
    return {
      ok: false,
      reason: 'invalid-rolls',
      details: [error instanceof Error ? error.message : String(error)],
    }
  }
}
