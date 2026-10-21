import { groupDnd5eActivityDamageProposals, type Dnd5eActivityDamageComponent } from './dnd5eActivityDamageGroups'
import { materializeDnd5eEquipmentWeaponDamage, type Dnd5eEquipmentWeaponDamageSnapshot } from './dnd5eEquipmentWeaponDamage'
import { dnd5eActivityCommunicationSaveSucceeds } from './dnd5eActivityCommunicationSave'
import type { Dnd5eAttackAttemptWard } from '../attackAttemptWard'
import { validDnd5eActivityTextInput } from './dnd5eActivityTextInput'
import { dnd5eActivityAnimatesSelectedObjects } from './dnd5eObjectAnimationTargeting'
import { parseSurfaceDrawing } from '../surfaceDrawing'
import { isDnd5eCompanionTaskDescriptions } from '../companionTask'
import { resolveDnd5eGroundWeaponEffect } from './dnd5eGroundWeaponEffect'
import { isDnd5eCompanionReadyTriggers } from '../companionReady'
import { normalizeDnd5eCompanionObjectInteraction } from '../companionObjectInteraction'
import { createDnd5eEffectGrantCharges, type Dnd5eEffectGrantCharges } from '../effectGrantCharges'
import { isDnd5eCompanionGuardSelections, normalizeDnd5eCompanionGuardArea } from '../companionGuardArea'
import type { Dnd5eFormulaDiceEvidenceV1 } from './dnd5eFormula'
import { resolveDnd5eAttackRollOutcome } from '../attackResolution'
import { dnd5eOpposedCheckSourceAbility, dnd5eOpposedSourceSkill } from './dnd5eFormula'
import { dnd5eActivityEffectMatches } from './dnd5eActivityEffectSelector'
import { dnd5eShareKnownLanguage, dnd5eCanUnderstandSourceLanguage } from '../sharedLanguage'
import { consumeDnd5eRollDiceModifier, dnd5eRollDiceCheckSlot, withDnd5eRollDicePreview, type Dnd5eRollDicePreviewContext } from '../rollDiceTransaction'
import type { dnd5eRollDiceRecipes } from '../rollDiceModifiers'
import { activityLogPredicate } from './dnd5eActivityLogPredicates'
import type { AbilityKey } from '../../../lib/dnd'
import type { Dnd5eStandardConditionId } from '../conditions'
import { DND5E_DAMAGE_TYPES, type Dnd5eDamageType } from '../damageTypes'
import { dnd5eFleshToStoneTargetHasFlesh } from '../fleshToStone'
import { dnd5eActivitySaveExcludesCreatureType, dnd5eActivityExcludesTarget, dnd5eActivityCreatureTypeMatches, dnd5eActivityGroundWithinVerticalRange } from './dnd5eActivityTargetExclusions'
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
  dnd5eActivityLanguageChoicesV1,
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
import { dnd5eInterruptedFeatureSpellActivity } from './dnd5eInterruptedFeatureSpell'
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
import { materializeDnd5eEventWeaponDice } from './dnd5eEventWeaponDice'
import { hashDnd5eArcaneLockPasswordV1 } from '../mapObjectState'
import type { Dnd5eMagicMouthConfigV1 } from '../magicMouth'
import {
  DND5E_BESTOW_CURSE_SPELL_DAMAGE_ROLL_ID,
  dnd5eBestowCurseSpellDamageRiderAppliesV1,
} from './dnd5eActivityRollRecipe'

import { isDnd5eCompanionMovementSelections, normalizeDnd5eCompanionMovementDestination, type Dnd5eCompanionMovementDestination } from '../companionMovementDestination'

export interface Dnd5eActivityHeldItemSnapshotV1 {
  itemId: string
  inventoryInstanceId?: string
  weaponId?: string
  weaponBaseId?: string
  intrinsicAttackBonus?: number
  intrinsicDamageBonus?: number
  /** Intrinsic item magic, before temporary effects; omitted means unknown. */
  magical?: boolean
  roles: readonly ('weapon' | 'shield' | 'spellcasting-focus' | 'other')[]
  weaponMode?: 'melee' | 'ranged'
  weaponProperties?: readonly string[]
  proficient?: boolean
}

export interface Dnd5eActivityInventoryItemSnapshotV1 extends Dnd5eActivityHeldItemSnapshotV1 {
  ownerActorId: string
  kind: 'weapon' | 'armor'
  inventoryInstanceId: string
}

export interface Dnd5eActivityEquipmentSnapshotV1 {
  /** Host-owned inventory facts; client action payloads only select an instance. */
  inventory?: { revision: number; items: readonly Omit<Dnd5eActivityInventoryItemSnapshotV1, 'ownerActorId'>[] }
  armor?: { itemId: string; inventoryInstanceId?: string; magical?: boolean }
  armorCategory: 'none' | 'light' | 'medium' | 'heavy'
  armorProficient: boolean
  armorProficiencies: readonly ('light' | 'medium' | 'heavy' | 'shield')[]
  mainHand?: Dnd5eActivityHeldItemSnapshotV1
  offHand?: Dnd5eActivityHeldItemSnapshotV1
  freeHands: 0 | 1 | 2
}

export interface Dnd5eActivityActorSnapshot extends Dnd5eFormulaActorSnapshot {
  temporaryHp?: number
  temporaryHitPointsSource?: { actorId: string; rulesId: string; effectDefinitionId?: string }
  /** Host class state, never a player-authored choice. */
  raging?: boolean
  /** Internal Host execution context; creature identity remains id. */
  projectileOccurrenceIndex?: number
  objectDamageThreshold?: number
  id: string
  /** Current Host effects, including suspension and instance identity; never command facts. */
  rollDiceEffects?: Parameters<typeof dnd5eRollDiceRecipes>[0]['effects']
  /** Immutable Host stat-block identity used only by closed Activity predicates. */
  statBlockId?: string
  name?: string
  communicationCreatureTypes?: readonly string[]
  languages?:readonly string[]
  canSpeakAudibly?: boolean
  languageCapabilities?: import('../activeEffects').Dnd5eActiveLanguageCapabilities
  controller: string
  /** Host-derived visible creatures perceived as enemies; never changes controller. */
  perceivedHostileTargetIds?: readonly string[]
  armorClass: number
  attackArmorClasses?: { default: number; melee: number; ranged: number; spell: number }
  /** Host-derived for this Activity source attacking this snapshot's bearer. */
  criticalThresholdAgainstSource?: number
  /** Tiny=0 through Gargantuan=5. */
  sizeRank?: number
  creatureType?: string
  illumination?: 'bright' | 'dim' | 'darkness' | 'magical-darkness'
  bodyPartPresence?: Readonly<Record<string, boolean>>
  corpse?: {bodyPresent:boolean; undeadCreationProtected?:boolean}
  airborne?: boolean
  elevationFeet?: number
  groundElevationFeet?: number
  upwardClearanceFeet?: number
  canRemainAirborne?: boolean
  conditions: readonly Dnd5eStandardConditionId[]
  /** Host-derived sources of currently effective charm conditions, never submitted command facts. */
  charmedByActorIds?: readonly string[]
  conditionImmunities?: readonly Dnd5eStandardConditionId[]
  environmentalImmunities?: readonly import('../environmentalProtection').Dnd5eEnvironmentalHazard[]
  /** Host scene and current phase projection; absent information grants neither outcome. */
  etherealAccess?: 'available' | 'unavailable' | 'unknown'
  savingThrowModifiers?: Partial<Record<AbilityKey, number>>
  savingThrowProficiencies?: readonly AbilityKey[]
  skillProficiencyRanks?: Readonly<Record<string, 0 | 1 | 2>>
  activeEffectDefinitionIds?: readonly { definitionId: string; stackingKey?: string; sourceActorId?: string; sourceCharacterId?: string; tags?: readonly string[]; spellLevel?: number; suspended?: boolean }[]
  abilityCheckModifiers?: Partial<Record<AbilityKey, number>>
  skillCheckModifiers?: Readonly<Record<string, number>>
  /** Immutable Host equipment projection used only by closed Activity predicates. */
  equipment?: Dnd5eActivityEquipmentSnapshotV1
  /** Current Host effects, refreshed at the execution boundary. */
  magicallyEnchantedWeaponIds?: readonly string[]
  magicallyEnchantedArmor?: boolean
  characterId?: string
  enchantedInventoryInstanceIds?: readonly string[]
  ammunitionContainers?: readonly import('../ammunitionBindings').Dnd5eAmmunitionContainerSnapshot[]
  spellcasting?: { capable: boolean; classIds: readonly string[] }
  successfulSpellSaveNegatesDamage?: boolean
  /** Spell damage dice of these types treat a natural 1 as 2. */
  elementalAdeptDamageTypes?: readonly Dnd5eDamageType[]
  /** Host-derived from active effects; only healing formula dice are maximized. */
  maximizeHealingDice?: boolean
  /** Host-derived caster trait; never grants recipient-side or non-spell maximization. */
  maximizeSpellHealingDiceAtZeroHp?: boolean
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
  summonedSourcePackageId?: string
  summonedSourceActivityId?: string
  summonedPersistent?: boolean
  summonedBondKey?:string
}

export type Dnd5eActivityRollMode = 'normal' | 'advantage' | 'disadvantage'

export interface Dnd5eActivityExecutionInput {
  /** Host preview only; validate original content before removing interrupted spell effects. */
  featureSpellInvocationInterrupted?: boolean
  resolveDamageRollBonus?: (targetId: string, attribution?: 'grant-source') => number
  /** Local to one resolution; never accepted from a wire command. */
  consumedDamageRollBonusKeys?: Set<string>
  /** Live Host turn owner, never taken from player command data. */
  /** Host-owned combat scope; never read from the submitted command. */
  combatActive?: boolean
  currentTurnActorId?: string
  /** Optional dice context for UI previews only; authoritative execution uses its enclosing transaction. */
  effectDicePreview?: Dnd5eRollDicePreviewContext
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
  /** Host-only optional retained dice, validated against the current effect and exact check. */
  optionalSavingThrowBonus?: (checkKey: string, targetId: string) => number
  validateOptionalSavingThrowUses?: (checks: readonly Dnd5eActivityCheckResult[]) => void
  checkRollModes?: Readonly<Record<string, Dnd5eActivityRollMode>>
  /** Host-only checkpoint after final mode calculation, before selecting the d20. */
  negateDisadvantage?: (roll: {
    rollId: string; rollerId: string; kind: 'attack' | 'ability-check' | 'saving-throw'; mode: Dnd5eActivityRollMode
  }) => boolean

  /** Internal Host hook; prior checks contain only rolls actually resolved in this execution. */
  resolveSequentialCheckRollModes?: (
    check: Dnd5eActivityCheckV1,
    target: Dnd5eActivityActorSnapshot | undefined,
    priorChecks: readonly Dnd5eActivityCheckResult[],
  ) => Readonly<Record<string, Dnd5eActivityRollMode>>
  distanceFeetByTargetId?: Readonly<Record<string, number>>
  /** Host-owned pair distances; never accepted from a submitted Activity command. */
  equipmentWeaponDamage?: Dnd5eEquipmentWeaponDamageSnapshot
  distanceFeetBetweenTargets?: Readonly<Record<string, Readonly<Record<string, number>>>>
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
  /** Untrusted operation-keyed selections, validated against the Host encounter. */
  companionHelpTargets?: unknown
  companionAttackTargets?: unknown
  companionMovementDestinations?: unknown
  companionGuardAreas?: unknown
  companionTaskDescriptions?: unknown
  companionReadyTriggers?: unknown
  companionObjectInteractions?: unknown
  /** Optional per-creature form selection; ids must belong to the declared form choice. */
  targetFormIds?: Readonly<Record<string, string>>
  willingTargetIds?: readonly string[]
  /** Trusted Host context, not a player command field. */
  targetQualificationIdsByTargetId?: Readonly<Record<string, readonly string[]>>
  saveFactsByTargetId?: import('./dnd5eActivitySaveFacts').Dnd5eActivitySaveFactsV1
  /** Host-owned chain history; never read from player command data. */
  continuationTargetIds?: readonly string[]
  usedTurnKeys?: ReadonlySet<string>
  dmApproved?: boolean
  /** Host-owned event envelope. Never accept this object from a client payload. */
  triggerContext?: Dnd5eActivityTriggerContextV1
  confirmedBy?: Dnd5eActivityConfirmedByV1
  /** Host-validated selection from the inventory command boundary. */
  inventoryInstanceId?: string
  selectedInventoryItem?: Dnd5eActivityInventoryItemSnapshotV1
  /** Host-validated durable spell record selected by an inventory-bound control. */
  spellAuthorityRecordId?: string
  /** Host-only replay override after an attack was redirected to an attack-decoy effect. */
  forcedAttackMissCheckKeys?: ReadonlySet<string>
  /** Host-only replay after an authorized critical cancellation; preserves hit. */
  cancelledCriticalCheckKeys?: ReadonlySet<string>
  /** Host-only: keys whose pre-save weapon counterattack has already hit. Never read from choices or payload. */
  weaponCounterattackSuccessCheckKeys?: ReadonlySet<string>
  /** Host already validated a critical-sized shared formula pool. */
  allowCriticalDiceSuperset?: boolean
}

export interface Dnd5eActivityCheckResult {
  attackType?: 'spell' | 'weapon'
  projectileOccurrenceIndex?: number
  attackDelivery?: 'melee' | 'ranged'
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
  automaticOutcome?: 'condition-immunity-success' | 'communication-immunity-success' | 'environmental-immunity-success' | 'weapon-counterattack-success' | 'source-charm-failure' | 'allied-unresisted-failure'
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
  | { kind: 'resource' | 'ammo' | 'hit-die'; resourceId: string; amount: number; consumeOn: 'confirm' | 'hit' | 'resolve' | 'dm-approval'; maximumTotalFraction?: number }
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
        destroysBodyOnDeath?: boolean
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

export type Dnd5eActivityCapabilityProposal = (
  | { kind: 'select-secondary-weapon-damage'; operationId: string; damageOperationId: string; rangeFeet: number; requiresLineOfSight: boolean }
  | {kind:'select-reaction-follow';operationId:string;pushOperationId:string;movementBudget:'walking-speed';targetRadiusFeet:number}
  | { kind: 'dismiss-owned-temporary-summons'; operationId: string; sourceActivityIds: readonly string[] }
  | {kind:'dismiss-owned-summon';operationId:string;bondKey:string;releaseBond?:boolean}
  | { kind: 'deal-damage'; damageGroup?: { id: string; multiplier: 0.5 | 1 }; damageComponents?: readonly Dnd5eActivityDamageComponent[]; attackCheckKeys?: readonly string[]; diceAudit?: readonly Dnd5eFormulaDiceEvidenceV1[]; formulaAdjustment?: number; operationId: string; targetId: string; amount: number; damageType: Dnd5eDamageType; magical: boolean; magicalOverride?: boolean; damageSource?: 'grant-source'; cannotBeReduced?: boolean; destroysBodyOnDeath?: boolean; destroysBodyPartOnDeath?: import('../lethalBodyPart').Dnd5eLethalBodyPartDestruction; attackDamage?: boolean }
  | {
      kind: 'heal'
      operationId: string
      targetId: string
      amount: number
      /** Host-resolved dice retained so the visible combat log can audit healing formulas. */
      damageResult?: { operationId: string; targetId: string; multiplier: number }
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
  | { kind: 'reveal-target-location'; operationId: string; targetId: string }
  | { kind: 'read-damage-traits'; operationId: string; targetId: string }
  | { kind: 'detect-planar-portal'; operationId: string; targetId: string; rangeFeet: number }
  | { kind: 'grant-temporary-hit-points'; operationId: string; targetId: string; amount: number; sourceEffectId?: string; replacement?: 'replace' }
  | { kind: 'stabilize'; operationId: string; targetId: string }
  | { kind: 'instant-death'; operationId: string; targetId: string }
  | { kind: 'stand-up'; operationId: string; targetId: string; usesTargetReactionIfAvailable: true }
  | { kind: 'apply-standard-condition'; operationId: string; targetId: string; condition: Dnd5eStandardConditionId; duration: Dnd5eResolvedEffectDuration; involuntary?: true }
  | {
      kind: 'apply-effect'
      involuntary?: true
      captureInitialSpace?: true
      captureIdentityActorId?: string
      disguiseFromGrant?: true
      disguiseGrantEffectId?: string
      timing?: 'after-triggering-damage'
      operationId: string
      targetId: string
      effectId: string
      name: string
      disposition?: 'buff' | 'debuff'
      tags?: readonly string[]
      grantedActivities?: readonly string[]
      grantedActivitiesSingleUse?: true
      grantedActivityCharges?: Dnd5eEffectGrantCharges
      completionGrant?: { activityIds: readonly string[]; availableRounds: number; recipient?: 'source'; bindTarget?: 'bearer' | 'source'; singleUse?: true }
      duration: Dnd5eResolvedEffectDuration
      conditions: readonly Dnd5eStandardConditionId[]
      extensionCondition?: string
      modifierGroups: readonly Dnd5eActiveEffectModifiers[]
      breakOn?: readonly Dnd5eActiveEffectBreakTrigger[]
      completionReward?: { kind: 'short-rest'; requiresCondition: Dnd5eStandardConditionId }
      sourceLink?: import('../activeEffects').Dnd5eActiveEffectRemoval['sourceLink']
      suspendWhileEffectId?: string
      attackAttemptWard?: Dnd5eAttackAttemptWard
      spellcastingSave?: { ability: AbilityKey; dc: number }
      repeatSaveAtTurnBoundary?: { ability: AbilityKey; dc:number; timing:'target-turn-start'|'target-turn-end'; onSuccess:'remove' }
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
      sourceAttitude?: 'friendly'
      endSavingThrow?: import('../effectEndSavingThrow').Dnd5eEffectEndSavingThrow
  onEndAwareness?: 'charmed-by-source'
      afterEffectEnds?: import('../activeEffects').Dnd5eActiveEffectAfterEffectEnds
      periodicDamage?: import('../activeEffects').Dnd5eActiveEffectPeriodicDamage
      periodicHealing?: import('../activeEffects').Dnd5eActiveEffectPeriodicHealing
      undeadCreationProtection?: import('../undeadCreationProtection').Dnd5eUndeadCreationProtection
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
      exclusiveGroupScope?: 'source' | 'bearer'
    }
  | { kind: 'remove-standard-condition'; operationId: string; targetId: string; condition: Dnd5eStandardConditionId; sourceCreatureTypes?: readonly string[] }
  | { kind: 'remove-effect'; operationId: string; targetId: string; effectId: string; source: 'self' | 'any' }
  | { kind: 'remove-effects-by-tag'; operationId: string; targetId: string; tags: readonly string[]; match: 'any' | 'all'; source: 'self' | 'any'; sourceCreatureTypes?: readonly string[]; maximumCount?: number }
  | { kind: 'adjust-exhaustion'; operationId: string; targetId: string; amount: number }
  | { kind: 'lower-ability-score'; operationId: string; targetId: string; ability: AbilityKey; maximumScore: number; recovery: 'restoration-magic'; recoveryGroupId?: string }
  | { kind: 'recover-ability-score'; operationId: string; targetId: string; ability: AbilityKey; maximumCount?: number }
  | { kind: 'recover-hit-point-maximum'; operationId: string; targetId: string; maximumCount?: number }
  | { kind: 'reduce-hit-point-maximum'; operationId: string; targetId: string; amount: number; owningEffectId: string; minimumMaximum: number }
  | { kind: 'transfer-hit-point-maximum'; operationId: string; targetId: string; amount: number; owningEffectId: string; beneficiaryEffectId: string; minimumMaximum: number; increaseCurrentHp: boolean; linkLifetimes?: boolean; protectLinkedLifetime?: true }
  | { kind: 'spend-resource' | 'restore-resource'; operationId: string; subjectId: string; resourceId: string; amount: number }
  | { kind: 'move'; requiresWithinCarryingCapacity?: true; operationId: string; targetId: string; harmful?: true; mode: 'push' | 'pull' | 'forced' | 'voluntary' | 'teleport' | 'swap' | 'ascend' | 'descend'; directionOrigin?: 'actor' | 'area-center'; cardinalDirection?: 'north' | 'east' | 'south' | 'west'; requiresDifferentDestination?: true; destinationPolicy?: 'adjacent-space'; distanceFeet: number; maximumDistanceFromActorFeet?: number; continuationTargetRadiusFeet?: number; continuationTargetIds?: readonly string[]; verticalDestination?: 'area-top' | 'ground'; stopAtMappedObstacle?: true; placement?: 'host-automatic-maximum'; originIllumination?: readonly ('dim' | 'darkness' | 'magical-darkness')[]; destinationIllumination?: readonly ('dim' | 'darkness' | 'magical-darkness')[]; requiresLineOfSight?: boolean; requiresVisibleDestination?: boolean; ignoresOpportunityAttacks?: boolean; usesActorMovement?: boolean; usesTargetReactionIfAvailable?: boolean; provokesOpportunityAttacks?: boolean }
  | { kind: 'set-directional-command'; operationId: string; actorId: string; commandKey: string; angleDegrees: number }
  | {
      kind: 'relocate-granting-area'
      operationId: string
      targetId: string
      maximumFeet: number
      requiresDifferentAnchor?: boolean
      retainMovementBudget?: true
      interposition?: 'clear' | 'blocked' | 'difficult-terrain'
    }
  | { kind: 'shrink-granting-area'; operationId: string; targetId: string; lengthFeet: number }
  | { kind: 'reshape-granting-area'; operationId: string; targetId: string; maximumFeet?: number }
  | { kind: 'change-granting-area-mode'; direction?: 'area-orientation'; operationId: string; targetId: string; change: 'select' | 'pause' | 'resume'; modeId?: string }
  | { kind: 'set-granting-area-senses'; operationId: string; targetId: string; mode: 'source' | 'projection' | 'projection-sight' | 'projection-hearing' }
  | { kind: 'detonate-granting-area'; operationId: string; actorId: string }
  | { kind: 'dismiss-granting-area'; operationId: string; actorId: string }
  | { kind: 'recognize-granting-disguise'; operationId: string; targetId: string; grantEffectId?: string }
  | { kind: 'restore-original-alignment'; operationId: string; targetId: string }
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
      maximumChallengeRating: 'target-level-or-challenge-rating' | 'target-half-level-or-challenge-rating' | number
      hitPointMode?: 'replace' | 'retain-with-form-temporary-hp'
      maximumSizeRank?: number
      equipmentDisposition?: 'drop' | 'merge' | 'wear'
      seenConfirmed?: boolean
      willingShapechanger?: boolean
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
      kind: 'alter-inventory-item'
      operationId: string
      actorId: string
      selectionRangeFeet?: number
      includeGroundItems?: true
      /** Selected recipient combatant; omitted for the original actor inventory route. */
      ownerActorId?: string
      originalTemplateIds: readonly string[]
      inventoryInstanceId?: string
      templateId: string
      quantity: number
      permanent?: true
      sourceEffectId?: string
      sourceEffectTag?: string
      sourceSpellcastingModifier?: number
    }
  | {
      kind: 'exchange-inventory-items'
      /** When set, output must be placed in an empty scene cell within this range. */
      sceneRangeFeet?: number
      operationId: string
      actorId: string
      templateId: string
      quantity: number
      policy: import('../inventoryExchange').Dnd5eInventoryExchangePolicy
    }
  | {
      kind: 'grant-inventory-item'
      operationId: string
      equipToFreeHand?: true
      actorId: string
      sourceEffectId?: string
      reuseSourceEffect?: boolean
      sourceSpellcastingModifier?: number
      maximumPerSource?: number
      sourceEffectTag?: string
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
      benefitKey?: string
      benefitScope?: 'package' | 'ruleset'
      benefitRenewal?: import('../benefitHistoryRenewal').Dnd5eBenefitRenewalPolicy
      /** Bound by the authority bridge, never accepted in authored operations. */
      benefitRecipients?: readonly import('../cohortArmorClass').Dnd5eCohortMember[]
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
      medium: 'magical-whisper' | 'telepathy'
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
      kind: 'convert-map-inventory-item'
      operationId: string
      originalTemplateIds: readonly string[]
      templateId: string
      quantity: number
    }
  | {
      kind: 'protect-map-remains'
      operationId: string
      durationMinutes: number
      minimumPower: 'wish'
      spellLevel: number
    }
  | {
      kind: 'purify-map-consumables'
      operationId: string
      contaminants: readonly ('poison' | 'disease')[]
    }
  | {
      kind: 'wither-map-vegetation'
      operationId: string
    }
  | {
      kind: 'summon'
      /** Grants a spell-equivalent summon benefit without a spell-cast event or slot cost. */
      spellEffectSourceId?: string
      placementRangeFeet?: number
      requiresVisiblePlacement?: boolean
      objectTokenId?: string
      animatedObjectSize?: 'tiny' | 'small' | 'medium' | 'large' | 'huge'
      corpseTokenId?: string
      afterDamageKillOperationId?: string
      /** Explicit campaign-clock delay used only when cast outside combat. */
      explorationDelaySeconds?: number
      independentPersistent?: true
      bondKey?: string
      exclusiveBondKeys?: readonly string[]
      existingBondPolicy?: 'reject-living'
      protectiveCircle?:boolean
      bondDismissActivityId?:string
      bondActivityIds?:readonly string[]
      understoodLanguage?:string
      bondEffectId?:string
      telepathyRangeFeet?:number
      controlSave?: { ability: AbilityKey; dc: number; disadvantage?: boolean; lingerDieSides?: number }
      uncontrolledLinger?: import('../summonedControl').Dnd5eSummonLingerPolicy
      maximumChallengeRating?: number
      /** Require an unconsumed inventory material tag `${prefix}:${resolvedMonsterId}`. */
      requiredMonsterMaterialTagPrefix?: string
      requiredCreatureSubtype?: string
      groupInitiative?: boolean
      autonomousBehavior?: 'attack-nearest-visible' | 'attack-nearest-other-subtype' | 'protect-source'
      commandPolicy?: 'persistent-order' | 'turn-order'
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
      naturalWeaponAttacksMagical?: true
      weaponAttacksMagical?: boolean
      attacksPerAction?: number
      shareSelfSpellsRangeFeet?: number
  shareSelfSpellsRequiresMounted?: boolean
  creatureTypeOverride?: 'celestial' | 'fey' | 'fiend'
  minimumIntelligence?: number
      cannotAttack?: boolean
      walkingSpeedFeet?: number
      dismissAfterDamageRounds?: number
      sourceDeathBehavior?: 'die'
    }
  | {
      kind: 'create-persistent-area'
      sensorTargetId?: string
      ignitesUnattendedFuel?: true
      operationId: string
      label: string
      instanceCount?: number
      separateSelectedInstances?: true
      clipHeightToMappedSolids?: true
      bindRestraintEffectIds?: readonly string[]
      durationRounds: number
      permanent?: true
      concentration: boolean
      color?: string
      visual?: import('../persistentAreaTypes').Dnd5ePersistentAreaVisual
      lighting?: import('../persistentAreaTypes').Dnd5ePersistentAreaLighting
      utilityProjectionId?: string
      structureServices?: { mealTemplateId: string; furnishings?: {templateId:string;size:number}[] }
      triggers?: readonly import('../persistentAreaTypes').Dnd5ePersistentAreaTriggerDeclaration[]
      movement?: import('../persistentAreaTypes').Dnd5ePersistentAreaMovementDeclaration
      lifecycle?: import('../persistentAreaTypes').Dnd5ePersistentAreaTurnLifecycle
      modes?: readonly import('../persistentAreaTypes').Dnd5ePersistentAreaModeDeclaration[]
      initialModeId?: string
      directionalMovementCost?: import('../persistentAreaTypes').Dnd5ePersistentAreaDirectionalMovementDeclaration
      movementCostMultiplier?: number
      groundOnly?: true
      /** Filter residual ground cells by Host-authored surface material at creation. */
      surfaceMaterials?: readonly import('../../../lib/mapGeometry').MapGeometrySurfaceMaterial[]
      requireAllSurfaceMaterials?: true
      requireNonmagicalSurfaceMaterials?: true
      materialTransformation?: { mode: 'rock-to-mud' | 'mud-to-rock' | 'ceiling-rock-to-mud'; depthFeet: number | 'selected-height' }
      surfaceAtPlacementElevation?: true
      normalGroundTerrain?: true
      terrainClearing?: import('../../../../shared/terrain-clearing.mjs').TerrainClearing
      movementRequiresGroundedSource?: boolean
      movementGroundCover?: import('../persistentAreaGroundCover').Dnd5ePersistentAreaGroundCover
      movementExcludesSource?: boolean
      extinguishesUnprotectedFlames?: 'torch-or-smaller'
      endFlameExtinguishRadiusFeet?: number
      excludesWindDispersibleGas?: boolean
      obscuration?: import('../persistentAreaTypes').Dnd5ePersistentAreaObscuration
      dispersedByStrongWind?: boolean
      occupantModifiers?: import('../persistentAreaTypes').Dnd5ePersistentAreaOccupantModifiers
      blocking?: import('../persistentAreaTypes').Dnd5ePersistentAreaBlocking
      creationConstraints?: {
        maximumCreatureCount?: number
        maximumCreatureSizeRank?: number
        forbidCoreSpellOverlap?: string
      }
      hallow?: import('../persistentAreaTypes').Dnd5eHallowAreaState
      hallucinatoryTerrain?: import('../persistentAreaTypes').Dnd5eHallucinatoryTerrainAreaState
      symbolMode?: import('../symbolSpell').SymbolMode
      programmedIllusion?: import('../persistentAreaTypes').Dnd5eProgrammedIllusionAreaState
      /** Independent illusion: no AC/HP, automatic misses/saves and damage/condition immunity. */
      projectionDefense?: 'untouchable-illusion'
      investigationDc?: 'source-save-dc'
      discovery?: { skill: 'perception' | 'investigation'; dc: 'source-save-dc' }
      entityProfile?: {
        /** Attacks fail regardless of roll total or natural 20. */
        attacksAutomaticallyMiss?: true
        supportsStanding?: true
        material?: import('../entityMaterial').Dnd5eEntityMaterial
        destructionTerrain?: import('../entityDestructionTerrain').Dnd5eEntityDestructionTerrain
        armorClass: number
        hitPoints: number
        strength?: number
        dexterity?: number
        cannotAttack: boolean
        invisible: boolean
      }
      triggerExemptTargetIds?: readonly string[]
      anchorMode?: 'fixed' | 'source-token' | 'target-token'
      sourceExitBehavior?: 'remove-area'
      /** Bind to the authenticated rest-start session; end with that session. */
      bindToRestSession?: true
      concealsFlameLightFromOutside?: true
      hiddenFromPlayers?: true
      teleportationPortal?: { destination: 'last-long-rest' }
      /** Area owner may spend a reaction to grant one attack against an occupant advantage. */
      sourceSlotSpellHealing?: { amount: number }
      creatureDetectionAdvantage?: 'source-and-allies'
      attackAdvantageReaction?: 'area-source'
      sourceIncapacitatedBehavior?: 'remove-area'
      /** Check modifiers owned by the area's source, only while this area exists. */
      sourceAbilityCheckRules?: readonly import('../abilityCheckRules').Dnd5eAbilityCheckRule[]
      sourceOverlapBehavior?: 'remove-area'
      sourceLimit?: import('../persistentAreaSourceLimit').Dnd5ePersistentAreaSourceLimit
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
        visionFromSource?: true
        hearingFromSource?: true
        /** Host binds the sensor to exactly one selected creature. */
        followSelectedTarget?: true
        sensorSense?: 'sight' | 'hearing'
        remotePlacement?: { memoryPrompt: string }
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
  | { kind: 'enchant-map-weapon'; operationId: string; rangeFeet: number; resolved: import('./dnd5eGroundWeaponEffect').Dnd5eResolvedGroundWeaponEffect }
  | { kind: 'ignite-area-fuel'; operationId: string }
  | { kind: 'extinguish-area-flames'; operationId: string; groundSpreadFeet: number }
  | { kind: 'affect-persistent-entity'; operationId: string; amount: number; damageType: Dnd5eDamageType;
      savingThrow?: { ability: AbilityKey; dc: number }; conditions?: readonly string[] }
  | { kind: 'control-map-water'; operationId: string; change: import('../controlledWater').Dnd5eWaterIntent; rules?: import('../controlledWater').Dnd5eWaterRules }
  | { kind: 'control-map-flame'; operationId: string; change: import('../controlledFlame').Dnd5eFlameIntent; requireAreaOrigin?: boolean }
  | { kind: 'transfer-loose-earth'; operationId: string; maximumSideFeet: number; distanceFeet: number; depthFeet?: number }
  | { kind: 'launch-map-object'; operationId: string; limits: import('../mapObjectFlight').Dnd5eMapObjectFlightLimits;
      harmlessPush?: true;
      castLevel: number; amount: number; damageType: 'bludgeoning'; impactTargetId?: string;
      departureSave?: { ability: AbilityKey; dc: number; successfulTargetIds: string[] } }
  | { kind: 'dispel-area'; operationId: string; actorId: string; areaKind: 'magical-darkness'; radiusFeet: number; maximumSpellLevel: number }
  | { kind: 'end-owned-companion-control'; operationId: string; targetId: string; sourceActivityId: string; requiresSpeech?: boolean; becomesHostile?: boolean }
  | { kind: 'command-owned-companion'; task?: import('../companionTask').Dnd5eCompanionTask; ready?: import('../companionReady').Dnd5eCompanionReady; objectInteraction?: import('../companionObjectInteraction').Dnd5eCompanionObjectInteraction; attackKind?: import('../companionAttackKind').Dnd5eCompanionAttackKind; guardArea?: import('../companionGuardArea').Dnd5eCompanionGuardArea; movementDestination?: Dnd5eCompanionMovementDestination; attackTargetId?: string; helpTargetId?: string; helpKind?: 'attack' | 'ability-check'; requiresSpeech?:boolean;voluntaryAfterControlEnds?:true;controlSaveDisadvantage?:boolean; sourceActivityId?: string; operationId: string; targetId: string; command: 'attack' | 'dash' | 'disengage' | 'dodge' | 'help' | 'hide' | 'use-object' | 'ready' | 'task' }
  | {
      kind: 'grant-weapon-attack'
      inheritedAttackOrigin?: 'attack-action' | 'bonus-action' | 'reaction' | 'other'
      available?: 'immediate' | 'next-own-turn'
      activatedGrantId?: string
      requiredTargetId?: string
      attackAdvantage?: true
      attackResourceCost?: { resourceId: string; amount: number }
      reusedProjectileWeaponId?: string
      projectileAttackSnapshot?: import('./dnd5eActivityWeaponAttackGrant').Dnd5eProjectileAttackSnapshotV1
      targetRestriction?: { originTargetId: string; maximumFeet: number }
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
  | { kind: 'narrative-prompt'; operationId: string; prompt: string }

) & { logTrigger?: { activityName: string; outcomeId: string; operationId: string; conditions: readonly string[] } }

export type Dnd5eActivityExecutionResult =
  | {
      ok: true
      status: 'resolved' | 'dm-adjudication-required'
      checks: readonly Dnd5eActivityCheckResult[]
      consumptions: readonly Dnd5eResolvedActivityConsumption[]
      proposals: readonly Dnd5eActivityCapabilityProposal[]
      /** Host-resolved spell elements reaching the area, independent of creature saves. */
      areaSpellDamageTypes?: readonly Dnd5eDamageType[]
      coldSpellMissTargetIds?: readonly string[]
      areaInstance?: Dnd5eActivityAreaInstanceV1
    }
  | {
      ok: false
      reason: 'invalid-definition' | 'invalid-actor' | 'invalid-target' | 'requirement-failed' | 'invalid-rolls' | 'dm-approval-required' |
        'trigger-context-required' | 'trigger-mismatch' | 'confirmation-required'
      details: readonly string[]
    }

function operationDamageType(operation:Extract<Dnd5eActivityOperationV1,{kind:'damage'}>,input:Dnd5eActivityExecutionInput):Dnd5eDamageType {
 let damageType=operation.damageType==='inherit-primary'?input.parentDamageType:operation.damageType
 if(operation.damageTypeChoiceId!=null){
  const selected=input.choices?.[operation.damageTypeChoiceId]
  if(!(DND5E_DAMAGE_TYPES as readonly string[]).includes(selected??''))throw new Dnd5eFormulaEvaluationError('damage type choice is unavailable')
  damageType=selected as Dnd5eDamageType
 }
 if(operation.damageTypeFromRoll){
  const mapping=operation.damageTypeFromRoll,choice=input.choices?.[mapping.indexChoiceId]
  const index=choice==null||!/^(0|[1-9][0-9]*)$/.test(choice)?-1:Number(choice),die=input.rolls[mapping.rollId]?.values[index]
  if(!Number.isInteger(die)||!mapping.types[(die??0)-1])throw new Dnd5eFormulaEvaluationError('invalid damage type die selection')
  damageType=mapping.types[die!-1]
 }
 if(!damageType)throw new Dnd5eFormulaEvaluationError('parent damage type is unavailable')
 return damageType
}

function relation(actor: Dnd5eActivityActorSnapshot, target: Dnd5eActivityActorSnapshot): 'self' | 'ally' | 'enemy' {
  if (actor.id === target.id) return 'self'
  return actor.perceivedHostileTargetIds?.includes(target.id) || actor.controller !== target.controller ? 'enemy' : 'ally'
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

/** Unknown clearance must not suppress a damage roll before authoritative resolution. */
export function previewDnd5eActivityUpwardClearanceV1(
  clearanceFeet: number | undefined, distanceFeet: number | undefined, blocked: boolean,
): boolean | undefined {
  if (!Number.isFinite(clearanceFeet) || !Number.isFinite(distanceFeet) || distanceFeet! <= 0) return undefined
  return blocked === (clearanceFeet! < distanceFeet! - 1e-7)
}

function predicateSatisfied(
  predicate: Dnd5ePredicateV1,
  input: Dnd5eActivityExecutionInput,
  target?: Dnd5eActivityActorSnapshot,
): boolean {
  const contextual = dnd5eContextPredicateSatisfiedV1(predicate, input.triggerContext)
  if (contextual != null) return contextual
  const subject = 'subject' in predicate && predicate.subject === 'target' ? target : input.actor
  if (predicate.kind === 'combat-active') return input.combatActive === true
  if (predicate.kind === 'ethereal-access') {
    const access = input.actor.etherealAccess ?? 'unknown'
    return predicate.state === 'known' ? access !== 'unknown' : access === predicate.state
  }
  if (predicate.kind === 'turn-owner') {
    if (input.combatActive === false || !input.currentTurnActorId) return false
    return predicate.owner === 'actor' ? input.currentTurnActorId === input.actor.id : input.currentTurnActorId !== input.actor.id
  }
  if (predicate.kind === 'minimum-level') return input.actor.level >= predicate.level
  if (predicate.kind === 'class-level') {
    const level = input.actor.classLevels?.[predicate.classId] ?? 0
    return level >= predicate.minimum && (predicate.maximum == null || level <= predicate.maximum)
  }
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
    return predicate.relation === 'any' || predicate.relation === actual || (predicate.relation === 'ally' && actual === 'self') ||
      (predicate.relation === 'ally' && predicate.orCharmedByActor === true && target.charmedByActorIds?.includes(input.actor.id) === true)
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
  if (predicate.kind === 'speed') {
    const speed = subject?.speed
    if (speed == null || !Number.isFinite(speed) || speed < 0) return false
    if (predicate.comparison === 'below') return speed < predicate.value
    if (predicate.comparison === 'at-most') return speed <= predicate.value
    if (predicate.comparison === 'at-least') return speed >= predicate.value
    return speed > predicate.value
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
  if (predicate.kind === 'rage-state') {
    return subject?.raging != null && subject.raging === predicate.active
  }
  if (predicate.kind === 'upward-clearance') {
    const distance = predicate.distanceFeet === 'area-height' ? input.areaPlacement?.heightFeet : predicate.distanceFeet
    return previewDnd5eActivityUpwardClearanceV1(subject?.upwardClearanceFeet, distance, predicate.blocked) ?? false
  }
  if (predicate.kind === 'target-identity') {
    if (!target) return false
    return predicate.identity === 'self' ? target.id === input.actor.id : target.id !== input.actor.id
  }
  if (predicate.kind === 'owned-companion') {
    // Ownership is independent of lifetime. Temporary controlled summons use
    // the same predicate; loss of control clears their source owner at Host.
    return !!target &&
      target.summonedSourceCombatantId === input.actor.id && (!predicate.bondKey || target.summonedBondKey===predicate.bondKey) &&
      (!predicate.source || ((target.summonedSourcePackageId ?? 'srd-5.1') === predicate.source.packageId &&
        target.summonedSourceActivityId === predicate.source.activityId))
  }
  if (predicate.kind === 'can-hear-source') return target?.canHearActivitySource === true
  if (predicate.kind === 'shared-language') return dnd5eShareKnownLanguage(input.actor.languages, target?.languages)
  if (predicate.kind === 'can-understand-source-language') return dnd5eCanUnderstandSourceLanguage(input.actor, target)
  if (predicate.kind === 'can-speak') return subject?.canSpeakAudibly === true
  if (predicate.kind === 'effect-bound-temporary-hit-points') {
    const source = subject?.temporaryHitPointsSource
    if (!subject || !(subject.temporaryHp && subject.temporaryHp > 0) || !source?.effectDefinitionId) return false
    const definitionId = source.effectDefinitionId
    const matches = (value?: string) => value === definitionId || value?.startsWith(`${definitionId}:`) === true
    return subject.activeEffectDefinitionIds?.some(effect => !effect.suspended &&
      (matches(effect.definitionId) || matches(effect.stackingKey)) && effect.sourceActorId === source.actorId &&
      dnd5eActivityEffectMatches({ kind: 'active-effect', subject: predicate.subject,
        effectId: predicate.effectId, present: true, source: 'any' }, { ...effect, definitionId }, input.actor.id, target?.id)) === true
  }
  if (predicate.kind === 'active-effect') {
    if (!subject) return false
    const present = subject.activeEffectDefinitionIds?.some(effect =>
      dnd5eActivityEffectMatches(predicate, effect, input.actor.id, target?.id,input.actor.characterId,target?.characterId)) === true
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
  if (predicate.kind === 'skill-proficiency') return subject?.skillProficiencyRanks?.[predicate.skill] === predicate.rank
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

function activityD20Mode(input: Dnd5eActivityExecutionInput, roll: {
  rollId: string; rollerId: string; kind: 'attack' | 'ability-check' | 'saving-throw'; mode: Dnd5eActivityRollMode
}): Dnd5eActivityRollMode {
  if (!input.negateDisadvantage?.(roll)) return roll.mode
  if (roll.mode !== 'disadvantage') throw new Dnd5eFormulaEvaluationError('disadvantage negation requires actual disadvantage')
  return 'normal'
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
  return check.scope === 'per-target' && target ? `${check.id}${'perProjectile' in check && check.perProjectile && target.projectileOccurrenceIndex != null ? `:projectile:${target.projectileOccurrenceIndex}` : ''}:${target.id}` : check.id
}

function checkRollKey(check: Dnd5eActivityCheckV1, target?: Dnd5eActivityActorSnapshot): string {
  return check.scope === 'per-target' && target ? `${check.rollId}${'perProjectile' in check && check.perProjectile && target.projectileOccurrenceIndex != null ? `:projectile:${target.projectileOccurrenceIndex}` : ''}:${target.id}` : check.rollId
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

export function selectedSavingThrowAbility(
  target: Dnd5eActivityActorSnapshot,
  primary: AbilityKey,
  options?: readonly AbilityKey[],
): AbilityKey {
  return (options?.length ? options : [primary]).reduce((best, candidate) =>
    savingThrowModifier(target, candidate) > savingThrowModifier(target, best) ? candidate : best, primary)
}

export function dnd5eActivityCheckTargetForRollV1(
  input: Pick<Dnd5eActivityExecutionInput, 'targets' | 'projectileTargetIds'>,
  check: Dnd5eActivityCheckV1,
  rollId: string,
  targetId?: string,
): Dnd5eActivityActorSnapshot | undefined {
  if ('perProjectile' in check && check.perProjectile) {
    for (const [projectileOccurrenceIndex, targetId] of (input.projectileTargetIds ?? []).entries()) {
      const target = input.targets.find(candidate => candidate.id === targetId)
      if (!target) continue
      const occurrence = { ...target, projectileOccurrenceIndex }
      if (checkRollKey(check, occurrence) === rollId) return occurrence
    }
    return undefined
  }
  return input.targets.find(candidate => (targetId == null || candidate.id === targetId) && checkRollKey(check, candidate) === rollId)
}

/** Resolve one submitted save before requesting damage, using the settlement rules. */
export function previewDnd5eActivitySavingThrowV1(
  input: Dnd5eActivityExecutionInput,
  rollId: string,
  rollerTokenId?: string,
  resolvedRollMode?: Dnd5eActivityRollMode,
): Dnd5eActivityCheckResult | undefined {
  for (const check of input.activity.checks ?? []) {
    if (check.kind !== 'saving-throw') continue
    const target = dnd5eActivityCheckTargetForRollV1(input, check, rollId, rollerTokenId)
    if (!target || target.id !== rollerTokenId) continue
    const result = withDnd5eRollDicePreview(() => resolveCheck(check, input, target, resolvedRollMode), input.effectDicePreview)
    if (target.projectileOccurrenceIndex != null) result.projectileOccurrenceIndex = target.projectileOccurrenceIndex
    return result
  }
}

/** Preview an attack with the same rules as final settlement, without executing effects. */
export function previewDnd5eActivityAttackV1(
  input: Dnd5eActivityExecutionInput,
  rollId: string,
  resolvedRollMode?: Dnd5eActivityRollMode,
): Dnd5eActivityCheckResult | undefined {
  for (const check of input.activity.checks ?? []) {
    if (check.kind !== 'attack-roll') continue
    const target = dnd5eActivityCheckTargetForRollV1(input, check, rollId)
    if (target) {
      const result = withDnd5eRollDicePreview(() => resolveCheck(check, input, target, resolvedRollMode), input.effectDicePreview)
      if (target.projectileOccurrenceIndex != null) result.projectileOccurrenceIndex = target.projectileOccurrenceIndex
      return result
    }
  }
}

function resolveCheck(
  check: Dnd5eActivityCheckV1,
  input: Dnd5eActivityExecutionInput,
  target?: Dnd5eActivityActorSnapshot,
  resolvedRollMode?: Dnd5eActivityRollMode,
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
    const sourceBaseMode: Dnd5eActivityRollMode = input.checkRollModes?.[`${key}:source-final`] ??
      (sourceModes.includes('advantage') && sourceModes.includes('disadvantage') ? 'normal' : sourceModes[0] ?? 'normal')
    const sourceRoll = input.rolls[checkRollKey(check, target)]
    const opposedRoll = input.rolls[opposedCheckRollKey(check, target)]
    if (!sourceRoll || !opposedRoll) {
      throw new Dnd5eFormulaEvaluationError(`missing opposed d20 result: ${key}`)
    }
    const sourceMode = activityD20Mode(input, { rollId: checkRollKey(check, target), rollerId: input.actor.id,
      kind: 'ability-check', mode: sourceBaseMode })
    const targetMode = activityD20Mode(input, { rollId: opposedCheckRollKey(check, target), rollerId: target.id,
      kind: 'ability-check', mode: input.checkRollModes?.[`${key}:target-final`] ?? targetBase })
    const d20 = selectedD20(sourceRoll.values, sourceMode)
    const opposedD20 = selectedD20(opposedRoll.values, targetMode)
    const sourceModifier = evaluateDnd5eFormulaV1(check.sourceModifier, formulaContext(input, target)) +
      consumeDnd5eRollDiceModifier(input.actor.id, input.actor.rollDiceEffects, 'ability-check', dnd5eRollDiceCheckSlot(input.activity.id, key, 'source'))
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
    const opposedModifier = (targetOption.skill
      ? target.skillCheckModifiers?.[targetOption.skill] ??
        target.abilityCheckModifiers?.[targetOption.ability] ??
        Math.floor((target.abilities[targetOption.ability] - 10) / 2)
      : target.abilityCheckModifiers?.[targetOption.ability] ??
        Math.floor((target.abilities[targetOption.ability] - 10) / 2)) +
      consumeDnd5eRollDiceModifier(target.id, target.rollDiceEffects, 'ability-check', dnd5eRollDiceCheckSlot(input.activity.id, key, 'target'))
    const total = d20 + sourceModifier
    const opposedTotal = opposedD20 + opposedModifier
    return {
      key, kind: check.kind, checkId: check.id, targetId: target.id, ability: dnd5eOpposedCheckSourceAbility(check.sourceAbility, input.actor),
      skill: dnd5eOpposedSourceSkill(check),
      rollMode: sourceMode,
      d20, modifier: sourceModifier, total, success: total > opposedTotal || (total === opposedTotal && check.tiesFavor === 'source'),
      criticalSuccess: false, criticalFailure: false,
      opposedD20, opposedModifier, opposedTotal,
      opposedAbility: targetOption.ability, opposedSkill: targetOption.skill,
    }
  }
  const creatureTypeOverride = check.kind === 'saving-throw' && target?.creatureType &&
    check.rollModeByCreatureType?.creatureTypes.some((type) =>
      dnd5eActivityCreatureTypeMatches(type, target.creatureType!))
    ? check.rollModeByCreatureType.mode
    : undefined
  const statBlockOverride = check.kind === 'saving-throw' && target?.statBlockId &&
    check.rollModeByStatBlock?.statBlockIds.includes(target.statBlockId)
    ? check.rollModeByStatBlock.mode
    : undefined
  const sizeRankOverride = check.kind === 'saving-throw' && target?.sizeRank != null &&
    check.rollModeBySizeRank &&
    (check.rollModeBySizeRank.minimum == null || target.sizeRank >= check.rollModeBySizeRank.minimum) &&
    (check.rollModeBySizeRank.maximum == null || target.sizeRank <= check.rollModeBySizeRank.maximum)
    ? check.rollModeBySizeRank.mode
    : undefined
  const opposedOverride = check.kind === 'saving-throw' && target && check.rollModeIfOpposed &&
    target.controller != null && input.actor.controller != null &&
    target.controller !== input.actor.controller
    ? check.rollModeIfOpposed
    : undefined
  const declaredMode = check.rollMode ?? 'normal'
  const communicationSuccess = check.kind === 'saving-throw' && dnd5eActivityCommunicationSaveSucceeds(check, input.actor, target)
  const counterattackSuccess = check.kind === 'saving-throw' && input.weaponCounterattackSuccessCheckKeys?.has(key) === true
  const immuneSuccess = check.kind === 'saving-throw' && (counterattackSuccess || communicationSuccess ||
    (check.automaticSuccessIfConditionImmune != null && target?.conditionImmunities?.includes(check.automaticSuccessIfConditionImmune) === true) ||
    (check.environmentalHazard != null && target?.environmentalImmunities?.includes(check.environmentalHazard) === true))
  const sourceCharmFailure = check.kind === 'saving-throw' && check.automaticFailureIfCharmedByActor === true &&
    target?.conditions.includes('charmed') === true && target.charmedByActorIds?.includes(input.actor.id) === true
  const declaredFailure = check.kind === 'saving-throw' && target != null &&
    (sourceCharmFailure ||
    ((check.allowWillingFailure === true && input.willingTargetIds?.includes(target.id) === true) ||
      (check.automaticFailureIfAllied === true && (target.id === input.actor.id || target.controller === input.actor.controller))))
  const baseMode = declaredMode === 'host-derived' ? input.checkRollModes?.[key] ?? (immuneSuccess || declaredFailure ? 'normal' : undefined) : declaredMode
  if (!baseMode) throw new Dnd5eFormulaEvaluationError(`missing Host roll mode: ${key}`)
  const factOverride=check.kind==='saving-throw'&&target&&check.rollModeByHostFact&&
    input.saveFactsByTargetId?.[target.id]?.[check.rollModeByHostFact.id]===true?check.rollModeByHostFact.mode:undefined
  const modes = [baseMode, creatureTypeOverride, statBlockOverride, sizeRankOverride, opposedOverride, factOverride].filter(
    (mode): mode is Dnd5eActivityRollMode => mode != null && mode !== 'normal',
  )
  const originalMode: Dnd5eActivityRollMode = resolvedRollMode ?? (modes.includes('advantage') && modes.includes('disadvantage')
    ? 'normal'
    : modes[0] ?? 'normal')
  const roll = input.rolls[checkRollKey(check, target)]
  if (!roll && !immuneSuccess && !declaredFailure) throw new Dnd5eFormulaEvaluationError(`missing d20 result: ${key}`)
  const mode = immuneSuccess || declaredFailure ? originalMode : activityD20Mode(input, {
    rollId: checkRollKey(check, target), rollerId: check.kind === 'saving-throw' ? target!.id : input.actor.id,
    kind: check.kind === 'attack-roll' ? 'attack' : check.kind === 'saving-throw' || check.kind === 'concentration-check' ? 'saving-throw' : 'ability-check',
    mode: originalMode,
  })
  // Automatic saves have no die; the automatic outcome carries the result.
  const d20 = immuneSuccess || declaredFailure ? 0 : selectedD20(roll!.values, mode)
  let modifier: number
  let dc: number
  let success: boolean
  let automaticSuccess = false
  let automaticFailure = false
  let attackCritical = false
  let resolvedAbility: AbilityKey | undefined
  if (check.kind === 'attack-roll') {
    if (!target) throw new Dnd5eFormulaEvaluationError(`attack target is unavailable: ${key}`)
    modifier = evaluateDnd5eFormulaV1(check.attackBonus, formulaContext(input, target)) +
      (input.actor.d20RollModifier ?? 0) + consumeDnd5eRollDiceModifier(input.actor.id, input.actor.rollDiceEffects, 'attack', dnd5eRollDiceCheckSlot(input.activity.id, key, 'source'))
    const attackMode = (check.attackType === 'spell' || (check.attackType == null && input.activity.legacySource?.kind === 'spell')) ? 'spell' : check.delivery ?? 'default'
    dc = target.attackArmorClasses?.[attackMode] ?? target.armorClass
    const outcome = resolveDnd5eAttackRollOutcome({ roll: { d20, total: d20 + modifier, naturalOne: d20 === 1, naturalTwenty: d20 === 20 },
      targetArmorClass: dc, criticalThreshold: Math.min(check.criticalThreshold ?? 20, target.criticalThresholdAgainstSource ?? 20) })
    success = outcome.hit
    attackCritical = outcome.critical && !input.cancelledCriticalCheckKeys?.has(key)
    if (input.forcedAttackMissCheckKeys?.has(key)) success = false
  } else if (check.kind === 'saving-throw') {
    if (!target) throw new Dnd5eFormulaEvaluationError(`saving throw target is unavailable: ${key}`)
    resolvedAbility = selectedSavingThrowAbility(target, check.ability, check.abilityOptions)
    const choiceModifier=(check.modifierByChoice??[]).reduce((sum,table)=>{
      const choice=input.activity.choices?.find(candidate=>candidate.id===table.choiceId)
      const optionId=input.choices?.[table.choiceId]??choice?.defaultOptionId
      if(!optionId||!choice?.options.some(option=>option.id===optionId)||!Object.hasOwn(table.modifiers,optionId)||
        !Number.isSafeInteger(table.modifiers[optionId]))throw new Dnd5eFormulaEvaluationError('invalid saving throw modifier choice')
      return sum+table.modifiers[optionId]
    },0)
    modifier = savingThrowModifier(target, resolvedAbility) + (target.d20RollModifier ?? 0) + choiceModifier
    dc = evaluateDnd5eFormulaV1(check.dc, formulaContext(input, target))
    automaticSuccess = immuneSuccess
    automaticFailure = !counterattackSuccess && declaredFailure
    if (!automaticSuccess && !automaticFailure) modifier +=
      consumeDnd5eRollDiceModifier(target.id, target.rollDiceEffects, 'saving-throw', dnd5eRollDiceCheckSlot(input.activity.id, key, 'target')) +
      (input.optionalSavingThrowBonus?.(key, target.id) ?? 0)
    success = automaticSuccess || (!automaticFailure && d20 + modifier >= dc)
  } else {
    resolvedAbility = check.ability
    modifier = (check.kind === 'concentration-check' ? savingThrowModifier(input.actor, check.ability) : (check.kind === 'skill-check' && check.skill
      ? input.actor.skillCheckModifiers?.[check.skill] ??
        input.actor.abilityCheckModifiers?.[check.ability]
      : input.actor.abilityCheckModifiers?.[check.ability]) ??
      Math.floor((input.actor.abilities[check.ability] - 10) / 2)) +
      (input.actor.d20RollModifier ?? 0)
    dc = evaluateDnd5eFormulaV1(check.dc, formulaContext(input, target))
    modifier += consumeDnd5eRollDiceModifier(input.actor.id, input.actor.rollDiceEffects,
      check.kind === 'concentration-check' ? 'concentration-save' : 'ability-check', dnd5eRollDiceCheckSlot(input.activity.id, key, 'source'))
    success = d20 + modifier >= dc
  }
  return {
    key, kind: check.kind,
    attackDelivery: check.kind === 'attack-roll' ? check.delivery : undefined,
    attackType: check.kind === 'attack-roll' ? check.attackType ?? 'spell' : undefined,
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
      ? counterattackSuccess ? 'weapon-counterattack-success' : communicationSuccess ? 'communication-immunity-success' : check.kind === 'saving-throw' && check.environmentalHazard && target?.environmentalImmunities?.includes(check.environmentalHazard)
        ? 'environmental-immunity-success' : 'condition-immunity-success'
      : automaticFailure
        ? sourceCharmFailure ? 'source-charm-failure' : 'allied-unresisted-failure'
        : undefined,
    criticalSuccess: !automaticSuccess && !automaticFailure &&
      !(check.kind === 'attack-roll' && input.forcedAttackMissCheckKeys?.has(key)) &&
      (check.kind === 'attack-roll' ? attackCritical : d20 >= 20),
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
  if (formula.kind === 'damage-roll' || formula.kind === 'floor' || formula.kind === 'ceil' || formula.kind === 'round' || formula.kind === 'clamp') {
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
  diceAudit?: Dnd5eFormulaDiceEvidenceV1[],
  damageRollBonus?: (rollId: string) => number,
  sharedCriticalDice?: Readonly<Record<string, number>>,
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
    { ...formulaContext(
      input,
      target,
      multipliers,
      minimums,
      maximizeDice ? formulaDiceRollIds(formula) : undefined,
      { ...maximumMultipliers, ...sharedCriticalDice },
    ), damageRollBonus, onDiceEvaluated: diceAudit ? evidence => diceAudit.push(evidence) : undefined },
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
          destroysBodyOnDeath: duration.damageOnFailure.destroysBodyOnDeath,
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
    if (node.kind === 'damage-roll' || node.kind === 'floor' || node.kind === 'ceil' || node.kind === 'round' || node.kind === 'clamp') visit(node.value)
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
    inventoryInstanceId?: string
    selectedInventoryItem?: Dnd5eActivityInventoryItemSnapshotV1
    castLevel?: number
    rolls?: Readonly<Record<string, Dnd5eFormulaRollResult>>
    /** Host-authorized critical damage pools may share their base dice with a non-damage effect. */
    maximumDiceMultiplierByRollId?: Readonly<Record<string, number>>
    selectedCreatureIds?: readonly string[]
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
  const grantedActivityCharges = effect.grantCharges ? createDnd5eEffectGrantCharges(effect.grantCharges, input.castLevel) : undefined
  if (effect.grantCharges && !grantedActivityCharges) throw new Dnd5eFormulaEvaluationError('effect grant charges require a valid cast level')
  const target = input.target
  const evaluationContext: Dnd5eFormulaEvaluationContext = {
    actor: input.actor,
    target,
    castLevel: input.castLevel,
    rolls: input.rolls ?? {},
    maximumDiceMultiplierByRollId: input.maximumDiceMultiplierByRollId,
  }
  const base: Dnd5eActiveEffectModifiers = {}
  const resistanceGroups: Dnd5eActiveEffectModifiers[] = []
  const allAbilities: readonly AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
  for (const modifier of effect.modifiers ?? []) {
    if (modifier.kind === 'roll-dice') {
      base.rollDiceModifiers = [...(base.rollDiceModifiers ?? []), structuredClone(modifier.dice)]
    } else if (modifier.kind === 'armor-class') {
      const bonus = evaluateDnd5eFormulaV1(modifier.value, evaluationContext)
      if (modifier.cohortProximity) {
        base.cohortArmorClass = { bonus, ...modifier.cohortProximity, recipients: [] }
      } else base.armorClassBonus = (base.armorClassBonus ?? 0) + bonus
    } else if (modifier.kind === 'attacks-against-source-armor-class') {
      base.attacksAgainstSourceArmorClassBonus =
        (base.attacksAgainstSourceArmorClassBonus ?? 0) + modifier.bonus
    } else if (modifier.kind === 'weapon-attack-roll') {
      if (modifier.weaponCategories) {
        base.weaponCategoryRollModes = [...(base.weaponCategoryRollModes ?? []), {
          mode: modifier.mode, categories: [...modifier.weaponCategories],
        }]
      } else {
        if (modifier.mode === 'advantage') base.weaponAttackRollAdvantage = true
        if (modifier.mode === 'disadvantage') base.weaponAttackRollDisadvantage = true
      }
    } else if (modifier.kind === 'attack-roll' && modifier.sourceProximity) {
      base.sourceProximityAttackAdvantage = { ...modifier.sourceProximity }
    } else if (modifier.kind === 'attack-roll') {
      if (modifier.mode === 'advantage' && modifier.ability == null) base.attackRollAdvantage = true
      if (modifier.mode === 'advantage' && modifier.ability != null) {
        base.attackRollAdvantageAbilities = [...new Set([
          ...(base.attackRollAdvantageAbilities ?? []), modifier.ability,
        ])]
      }
      if (modifier.mode === 'disadvantage' && modifier.ability == null) base.attackRollDisadvantage = true
      if (modifier.mode === 'disadvantage' && modifier.ability != null) {
        base.attackRollDisadvantageAbilities = [...new Set([
          ...(base.attackRollDisadvantageAbilities ?? []), modifier.ability,
        ])]
      }
    } else if (modifier.kind === 'weapon-attacks-against-target') {
      base.weaponAttacksAgainstTarget = [...(base.weaponAttacksAgainstTarget ?? []), {
        mode: modifier.mode, ...(modifier.delivery ? { delivery: modifier.delivery } : {}),
      }]
    } else if (modifier.kind === 'attacks-against-target') {
      if (modifier.mode === 'advantage') base.attacksAgainstTargetAdvantage = true
      else base.attacksAgainstTargetDisadvantage = true
    } else if (modifier.kind === 'speed-after-own-turn-weapon-attack') {
      base.speedAfterOwnTurnWeaponAttackFeet = modifier.bonusFeet
      base.speedAfterOwnTurnWeaponAttackActionOnly = modifier.attackActionOnly
    } else if (modifier.kind === 'prevent-movement-opportunity-attacks') {
      base.preventMovementOpportunityAttacks = true
    } else if (modifier.kind === 'damage-rolls-by-source-bonus') {
      base.damageRollsBySourceBonus = Math.min(1000, Math.max(-1000, Math.floor(evaluateDnd5eFormulaV1(modifier.value, evaluationContext))))
    } else if (modifier.kind === 'attacks-by-source-critical-threshold') {
      base.attacksBySourceCriticalThreshold = Math.min(base.attacksBySourceCriticalThreshold ?? 20, modifier.threshold)
    } else if (modifier.kind === 'cannot-be-surprised-while-conscious') {
      base.cannotBeSurprisedWhileConscious = true
    } else if (modifier.kind === 'revival-prevention') {
      base.preventsRevival = true
    } else if (modifier.kind === 'next-d20-advantage') {
      base.nextD20AdvantageRollKinds = [...modifier.rollKinds]
    } else if (modifier.kind === 'perceive-visible-creatures-as-hostile') {
      base.perceiveVisibleCreaturesAsHostile = true
    } else if (modifier.kind === 'random-visible-creature-targets') {
      base.randomVisibleCreatureTargets = true
    } else if (modifier.kind === 'mandatory-opportunity-attacks') {
      base.mandatoryOpportunityAttacks = true
    } else if (modifier.kind === 'attack-target-lock') {
      base.attackDisadvantageAgainstOthersThanSource = true
      base.attackDisadvantageAgainstOthersThanSourceRangeFeet = modifier.sourceRangeFeet
      base.notifySourceOnBearerDamage = modifier.notifySourceOnDamage
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
      if (modifier.whenOwnedCompanionWithin) {
        base.maximizeHealingDiceNearCompanion = [...(base.maximizeHealingDiceNearCompanion ?? []), structuredClone(modifier.whenOwnedCompanionWithin)]
      } else base.maximizeHealingDice = true
    } else if (modifier.kind === 'healing-prevention') {
      if (modifier.scope === 'all') base.preventHealing = true
      else base.preventNonmagicalHealing = true
    } else if (modifier.kind === 'optional-bonus-die') {
      base.optionalBonusDie = { sides: modifier.sides, appliesTo: [...modifier.appliesTo], consumeOnUse: modifier.consumeOnUse,
        ...(modifier.boundTargetSource ? { boundTargetSource: { ...modifier.boundTargetSource } } : {}) }
    } else if (modifier.kind === 'own-turn-attack-action-bonus') {
      base.ownTurnAttackActionBonus = (base.ownTurnAttackActionBonus ?? 0) + modifier.attacks
    } else if (modifier.kind === 'attack-action-minimum') {
      base.attackActionMinimum = Math.max(base.attackActionMinimum ?? 1, modifier.attacks)
    } else if (modifier.kind === 'equipment-proficiency') {
      base.equipmentProficiencies = [...new Set([...(base.equipmentProficiencies ?? []), ...modifier.categories])]
    } else if (modifier.kind === 'saving-throw-proficiency') {
      base.savingThrowProficiencies = [...new Set([...(base.savingThrowProficiencies ?? []), modifier.ability])]
    } else if (modifier.kind === 'skill-expertise') {
      base.skillExpertise = [...new Set([...(base.skillExpertise ?? []), modifier.skill])]
    } else if (modifier.kind === 'ability-check' && modifier.mode === 'add') {
      base.skillCheckBonuses = [...(base.skillCheckBonuses ?? []), {
        skill: modifier.skill, ability: modifier.ability,
        bonus: evaluateDnd5eFormulaV1(modifier.value, evaluationContext),
      }]
    } else if (modifier.kind === 'ability-check' && ((modifier.ability && modifier.skill) || modifier.excludedSkills || modifier.sense)) {
      base.abilityCheckRules = [...(base.abilityCheckRules ?? []), {
        mode: modifier.mode, ability: modifier.ability, skill: modifier.skill,
        excludedSkills: modifier.excludedSkills ? [...modifier.excludedSkills] : undefined,
        sense: modifier.sense,
      }]
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
    } else if (modifier.kind === 'suppress-damage-resistance') {
      resistanceGroups.push({ suppressDamageResistance: modifier.damageType })
    } else if (modifier.kind === 'conditional-damage-resistance') {
      base.conditionalDamageResistances = [
        ...(base.conditionalDamageResistances ?? []),
        {
          sourceAura: modifier.sourceAura ? { ...modifier.sourceAura } : undefined,
          damageTypes: [...new Set(modifier.damageTypes)],
          sourceMagical: modifier.sourceMagical,
          attackOnly: modifier.attackOnly,
          deliveries: modifier.deliveries ? [...new Set(modifier.deliveries)] : undefined,
        },
      ]
    } else if (modifier.kind === 'damage-immunity') {
      resistanceGroups.push({ damageImmunity: modifier.damageType })
    } else if (modifier.kind === 'next-source-or-ally-attack-vulnerability') {
      base.nextSourceOrAllyAttackVulnerability = true
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
      if (modifier.ifAbsent && modifier.existingRangeSource === 'race') {
        base.darkvisionRacialFallbackFeet = Math.max(Number(base.darkvisionRacialFallbackFeet ?? 0), modifier.rangeFeet)
        if (modifier.existingBonusFeet) base.darkvisionRacialBonusFeet = Number(base.darkvisionRacialBonusFeet ?? 0) + modifier.existingBonusFeet
      } else if (modifier.ifAbsent) {
        base.darkvisionIfAbsentFeet = Math.max(base.darkvisionIfAbsentFeet ?? 0, modifier.rangeFeet)
        if (modifier.existingBonusFeet) base.darkvisionExistingBonusFeet = (base.darkvisionExistingBonusFeet ?? 0) + modifier.existingBonusFeet
      } else base.darkvisionRangeFeet = Math.max(base.darkvisionRangeFeet ?? 0, modifier.rangeFeet)
    } else if (modifier.kind === 'swim-speed') {
      base.swimSpeedEqualsWalking = modifier.mode === 'walking-speed'
    } else if (modifier.kind === 'climb-speed') {
      base.climbSpeedEqualsWalking = modifier.mode === 'walking-speed'
    } else if (modifier.kind === 'sight-range-limit') {
      base.sightRangeLimitFeet = Math.min(base.sightRangeLimitFeet ?? Infinity, modifier.rangeFeet)
    } else if (modifier.kind === 'truesight') {
      base.truesightRangeFeet = Math.max(base.truesightRangeFeet ?? 0, modifier.rangeFeet)
      base.seeInvisible = true
    } else if (modifier.kind === 'spell-targeting-immunity') {
      base.spellTargetingImmunitySchools = [...new Set([
        ...(base.spellTargetingImmunitySchools ?? []),
        ...modifier.schools,
      ])]
    } else if (modifier.kind === 'flight-speed-limit') {
      base.flySpeedLimitFeet = Math.min(base.flySpeedLimitFeet ?? Infinity, modifier.maximumFeet)
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
        ...(modifier.forceWhileFlightBlocked === true || base.controlledDescent?.forceWhileFlightBlocked === true ? { forceWhileFlightBlocked: true as const } : {}),
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
    } else if (modifier.kind === 'prevent-rest-benefits') {
      base.preventRestBenefits = true
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
      if (modifier.bindToSelectedTarget && (input.selectedCreatureIds?.length !== 1 || !input.selectedCreatureIds[0])) {
        throw new Dnd5eFormulaEvaluationError('on-hit-bonus-damage requires exactly one selected creature')
      }
      const delayed = modifier.amount.kind === 'weapon-dice'
        ? { count: modifier.amount.count, sides: 2, bonus: modifier.amount.bonus ?? 0, useWeaponDie: true as const }
        : compileDelayedDamageFormula(modifier.amount, evaluationContext)
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
        consumeEffectOnHit: modifier.consumeEffectOnHit ?? effect.duration.kind !== 'permanent',
        ...(modifier.bindToSelectedTarget ? { boundTargetId: input.selectedCreatureIds![0] } : {}),
        ...(modifier.attackDamageTypeOverride ? { attackDamageTypeOverride: modifier.attackDamageTypeOverride } : {}),
      }
    } else if (modifier.kind === 'hit-point-maximum') {
      const value = evaluateDnd5eFormulaV1(modifier.value, evaluationContext)
      const total = (base.hitPointMaximumBonus ?? 0) + Math.floor(value)
      if (value < 0 || total > 1_000_000) {
        throw new Dnd5eFormulaEvaluationError('hit-point-maximum only supports a nonnegative bonus up to 1000000; reductions need a reduction ledger')
      }
      base.hitPointMaximumBonus = total
      if (modifier.increaseCurrentHitPoints !== false) base.increaseCurrentHitPointsWithMaximum = true
    } else if (modifier.kind === 'darkvision-concealment') {
      base.invisibleToDarkvision = true
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
        ...(modifier.materialSightRangeFeet != null ? { materialSightRangeFeet: modifier.materialSightRangeFeet } : {}),
        plane: modifier.plane,
        ignoresMaterialCollision: modifier.ignoresMaterialCollision,
        suppressCrossPlaneEffects: true,
        unrestrictedVerticalMovement: modifier.unrestrictedVerticalMovement,
      }
    } else if (modifier.kind === 'solid-material-traversal') {
      base.solidMaterialTraversal = { materials: [...modifier.materials], endInside: modifier.endInside }
    } else if (modifier.kind === 'source-location-awareness') {
      base.locationKnownToSource = true
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
        doesNotNeedAir: modifier.doesNotNeedAir ?? base.environmentalCapabilities?.doesNotNeedAir,
        holdBreathSeconds: Math.max(modifier.holdBreathSeconds ?? 0, base.environmentalCapabilities?.holdBreathSeconds ?? 0) || undefined,
        breatheIn: breatheIn.length > 0 ? breatheIn : undefined,
        treatLiquidSurfacesAsSolidGround:
          modifier.treatLiquidSurfacesAsSolidGround ??
          base.environmentalCapabilities?.treatLiquidSurfacesAsSolidGround,
        ignoreDifficultTerrainMaterials: modifier.ignoreDifficultTerrainMaterials || base.environmentalCapabilities?.ignoreDifficultTerrainMaterials
          ? [...new Set([...(base.environmentalCapabilities?.ignoreDifficultTerrainMaterials ?? []), ...(modifier.ignoreDifficultTerrainMaterials ?? [])])]
          : undefined,
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
          criticalThreshold: modifier.criticalThreshold,
          damageTypeOverride: modifier.damageTypeOverride,
        },
      ]
    } else if (modifier.kind === 'weapon-enchantment') {
      const selected = input.selectedInventoryItem
      if (modifier.weaponSlot === 'inventory-item' && (!selected || selected.kind !== 'weapon' || selected.ownerActorId !== target.id)) throw new Dnd5eFormulaEvaluationError('weapon-enchantment requires an authorized inventory weapon')
      const heldItem = modifier.weaponSlot === 'inventory-item' ? selected : target.equipment?.[modifier.weaponSlot === 'main-hand' ? 'mainHand' : 'offHand']
      const ammunitionContainer = modifier.weaponSlot === 'ammunition-container' ? target.ammunitionContainers?.find(container=>container.instanceId===input.inventoryInstanceId) : undefined
      if (modifier.weaponSlot === 'ammunition-container' ? !ammunitionContainer : !heldItem?.roles.includes('weapon')) {
        throw new Dnd5eFormulaEvaluationError(`weapon-enchantment requires a held weapon in ${modifier.weaponSlot}`)
      }
      if (modifier.requiresNonmagical && (modifier.weaponSlot === 'ammunition-container' ||
        heldItem?.magical !== false || modifier.weaponSlot !== 'inventory-item' && target.magicallyEnchantedWeaponIds?.includes(heldItem.weaponId ?? heldItem.itemId))) {
        throw new Dnd5eFormulaEvaluationError('weapon-enchantment requires a verified nonmagical weapon')
      }
      if (modifier.weaponBaseIds && (!heldItem?.weaponBaseId || !modifier.weaponBaseIds.includes(heldItem.weaponBaseId))) {
        throw new Dnd5eFormulaEvaluationError('weapon-enchantment requires an eligible base weapon type')
      }
      if (modifier.requiresNoIntrinsicAttackAndDamageBonus && (!heldItem ||
        !Number.isFinite(heldItem.intrinsicAttackBonus) || !Number.isFinite(heldItem.intrinsicDamageBonus) ||
        (heldItem.intrinsicAttackBonus! > 0 && heldItem.intrinsicDamageBonus! > 0))) {
        throw new Dnd5eFormulaEvaluationError('weapon-enchantment excludes intrinsic attack and damage bonuses')
      }
      const attackAndDamageBonus = Math.max(0, Math.min(3, Math.floor(
        evaluateDnd5eFormulaV1(modifier.attackAndDamageBonus, evaluationContext),
      ))) as 0 | 1 | 2 | 3
      const remainingAttacks = modifier.attackUses ? evaluateDnd5eFormulaV1(modifier.attackUses, evaluationContext) : undefined
      if (modifier.spellcastingFocusClassIds && (ammunitionContainer || !heldItem?.inventoryInstanceId)) {
        throw new Dnd5eFormulaEvaluationError('weapon focus requires a concrete inventory weapon')
      }
      if (remainingAttacks != null && (!Number.isInteger(remainingAttacks) || remainingAttacks < 1 || remainingAttacks > 1000)) throw new Dnd5eFormulaEvaluationError('weapon-enchantment attackUses must be 1..1000')
      base.weaponEnchantment = {
        sourceWielderOnly: modifier.sourceWielderOnly,
        weaponId: ammunitionContainer ? 'container:'+ammunitionContainer.instanceId : heldItem!.weaponId ?? heldItem!.itemId,
        inventoryInstanceId: ammunitionContainer?.instanceId ?? heldItem!.inventoryInstanceId,
        ammunitionContainer: ammunitionContainer ? true : undefined,
        consumeOnDraw: modifier.consumeOnDraw,
        weaponIds: ammunitionContainer?.weaponIds,
        remainingAttacks,
        attackAndDamageBonus,
        spellcastingFocusClassIds: modifier.spellcastingFocusClassIds ? [...modifier.spellcastingFocusClassIds] : undefined,
        bonusDamage: modifier.bonusDamage ? { ...modifier.bonusDamage } : undefined,
      }
    } else if (modifier.kind === 'armor-enchantment') {
      const selected = input.selectedInventoryItem
      if (modifier.itemSelection === 'inventory-item' && (!selected || selected.kind !== 'armor' || selected.ownerActorId !== target.id)) throw new Dnd5eFormulaEvaluationError('armor-enchantment requires authorized inventory armor')
      const armor = modifier.itemSelection === 'inventory-item' ? selected : target.equipment?.armor
      if (!armor || modifier.itemSelection !== 'inventory-item' && target.equipment?.armorCategory === 'none') throw new Dnd5eFormulaEvaluationError('armor-enchantment requires worn body armor')
      if (modifier.requiresNonmagical && (armor.magical !== false || modifier.itemSelection !== 'inventory-item' && target.magicallyEnchantedArmor === true)) throw new Dnd5eFormulaEvaluationError('armor-enchantment requires verified nonmagical armor')
      const bonus = evaluateDnd5eFormulaV1(modifier.armorClassBonus, evaluationContext)
      if (!Number.isInteger(bonus) || bonus < 1 || bonus > 3) throw new Dnd5eFormulaEvaluationError('armor-enchantment bonus must be 1..3')
      base.armorEnchantment = { armorId: armor.itemId, inventoryInstanceId: armor.inventoryInstanceId, armorClassBonus: bonus }
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
    grantedActivitiesSingleUse: effect.grantsSingleUse,
    grantedActivityCharges,
    captureInitialSpace: effect.captureInitialSpace,
    completionGrant: effect.completionGrant ? { ...effect.completionGrant, activityIds: [...effect.completionGrant.activityIds] } : undefined,
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
                destroysBodyOnDeath: effect.duration.damageOnFailure.destroysBodyOnDeath,
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
    completionReward: effect.completionReward ? { ...effect.completionReward } : undefined,
    sourceLink: effect.sourceLink ? { ...effect.sourceLink } : undefined,
    suspendWhileEffectId: effect.suspendWhileEffectId,
    attackAttemptWard: effect.attackAttemptWard ? { ...effect.attackAttemptWard, dc: Math.max(1, Math.floor(evaluateDnd5eFormulaV1(effect.attackAttemptWard.dc, evaluationContext))) } : undefined,
    spellcastingSave: effect.spellcastingSave ? { ability: effect.spellcastingSave.ability, dc: Math.max(1, Math.floor(evaluateDnd5eFormulaV1(effect.spellcastingSave.dc, evaluationContext))) } : undefined,
    repeatSaveAtTurnBoundary: effect.repeatSaveAtTurnBoundary ? {
      ability:effect.repeatSaveAtTurnBoundary.ability,timing:effect.repeatSaveAtTurnBoundary.timing,
      dc:Math.max(1,Math.floor(evaluateDnd5eFormulaV1(effect.repeatSaveAtTurnBoundary.dc,evaluationContext))),onSuccess:'remove',
    } : undefined,
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
          economy: effect.removalAction.economy,
          maxDistanceFeet: effect.removalAction.maxDistanceFeet,
          ...(effect.removalAction.selfOnly === true ? { selfOnly: true as const } : {}),
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
    sourceAttitude: effect.sourceAttitude,
    endSavingThrow: effect.endSavingThrow ? {...effect.endSavingThrow} : undefined,
    onEndAwareness: effect.onEndAwareness,
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
    undeadCreationProtection: effect.undeadCreationProtection ? { ...effect.undeadCreationProtection } : undefined,
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
    magical: effect.magical === true || effect.periodicDamage?.magical === true,
    concentration: effect.concentration === true,
    persistAfterConcentrationCompletes: effect.persistAfterConcentrationCompletes === true,
    stacking: effect.stacking === 'refresh-duration'
      ? 'refresh-duration'
      : effect.stacking === 'stack'
        ? 'stack'
        : 'replace',
    exclusiveBySource: effect.stacking === 'unique-by-source',
    exclusiveGroup: effect.exclusiveGroup,
    exclusiveGroupScope: effect.exclusiveGroupScope,
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
  criticalForTarget: (target: Dnd5eActivityActorSnapshot) => boolean,
): readonly Dnd5eActivityCapabilityProposal[] {
  if(operation.kind==='reaction-follow')return [{kind:'select-reaction-follow',operationId:operation.id,pushOperationId:operation.pushOperationId,movementBudget:operation.movementBudget,targetRadiusFeet:operation.targetRadiusFeet}]
  if (operation.kind === 'secondary-weapon-damage') return [{kind:'select-secondary-weapon-damage',operationId:operation.id,
    damageOperationId:operation.damageOperationId,rangeFeet:operation.rangeFeet,requiresLineOfSight:operation.requiresLineOfSight}]
  if (operation.kind === 'manual-adjudication') {
    return [{ kind: 'request-dm-adjudication', operationId: operation.id, prompt: operation.prompt, reason: operation.reason }]
  }
  if (operation.kind === 'narrative-prompt') return [{ kind: 'narrative-prompt', operationId: operation.id, prompt: operation.prompt }]
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
  if(operation.kind==='dismiss-owned-temporary-summons')return [{kind:operation.kind,operationId:operation.id,sourceActivityIds:[...operation.sourceActivityIds]}]
  if(operation.kind==='dismiss-owned-summon')return [{kind:'dismiss-owned-summon',operationId:operation.id,bondKey:operation.bondKey,releaseBond:operation.releaseBond}]
  if (operation.kind === 'summon') {
    let understoodLanguage = operation.understandsCasterLanguage ? input.actor.languages?.[0] : undefined
    if (operation.languageChoiceId) {
      const choice = input.activity.choices?.find(choice => choice.id === operation.languageChoiceId && choice.optionsFrom === 'actor-languages')
      understoodLanguage = choice?.options.find(option => option.id === input.choices?.[operation.languageChoiceId!])?.label
      if (!understoodLanguage || !input.actor.languages?.includes(understoodLanguage)) throw new Dnd5eFormulaEvaluationError('A language known by the caster is required')
    }
    if (operation.animatedObjectSize && !currentTarget) throw new Dnd5eFormulaEvaluationError('Selected object is required')
    let monsterId=operation.monsterId
    if (operation.monsterChoiceId) {
      const choice = input.activity.choices?.find(entry => entry.id === operation.monsterChoiceId)
      const selected = input.choices?.[operation.monsterChoiceId]
      if (!selected || !choice?.options.some(option => option.id === selected)) throw new Dnd5eFormulaEvaluationError('Invalid summon monster choice')
      monsterId = selected
    }
    if (operation.corpseFormChoiceId) {
      if (currentTarget?.corpse?.undeadCreationProtected) throw new Dnd5eFormulaEvaluationError('Remains are protected against undead creation')
      if (!currentTarget?.corpse?.bodyPresent || currentTarget.currentHp!==0 || ![1,2].includes(currentTarget.sizeRank??-1)) throw new Dnd5eFormulaEvaluationError('A present Small or Medium corpse is required')
      const choice=input.activity.choices?.find(choice=>choice.id===operation.corpseFormChoiceId)
      const form=input.targetFormIds?.[currentTarget.id]??input.choices?.[operation.corpseFormChoiceId]
      if(!form || !choice?.options.some(option=>option.id===form)) throw new Dnd5eFormulaEvaluationError('Invalid corpse form')
      monsterId=form
    }
    return [{
      kind: 'summon', operationId: operation.id, monsterId,
      spellEffectSourceId: operation.spellEffectSourceId,
      placementRangeFeet: operation.placementRangeFeet,
      requiresVisiblePlacement: operation.requiresVisiblePlacement,
      bondKey:operation.bondKey,bondDismissActivityId:operation.bondDismissActivityId,
      existingBondPolicy: operation.existingBondPolicy,
      exclusiveBondKeys: operation.exclusiveBondKeys,
      bondActivityIds:operation.bondActivityIds,
      protectiveCircle:operation.protectiveCircle,
      understoodLanguage,
      telepathyRangeFeet:operation.telepathyRangeFeet,
      controlSave:operation.controlSave ? {...operation.controlSave,dc:evaluateAmount(operation.controlSave.dc,input,input.actor,false,false)} : undefined,
      uncontrolledLinger: operation.uncontrolledLinger ? { ...operation.uncontrolledLinger } : undefined,
      maximumChallengeRating:operation.maximumChallengeRating == null ? undefined :
        Math.max(0, evaluateDnd5eFormulaV1(operation.maximumChallengeRating, formulaContext(input, input.actor))),
      requiredCreatureSubtype:operation.requiredCreatureSubtype,
      requiredMonsterMaterialTagPrefix:operation.requiredMonsterMaterialTagPrefix,
      objectTokenId:operation.animatedObjectSize ? currentTarget!.id : undefined,
      animatedObjectSize:operation.animatedObjectSize,
      corpseTokenId:operation.corpseFormChoiceId || operation.afterDamageKillOperationId ? currentTarget!.id : undefined,
      afterDamageKillOperationId: operation.afterDamageKillOperationId,
      explorationDelaySeconds: operation.explorationDelaySeconds,
      independentPersistent: operation.independentPersistent,
      groupInitiative:operation.groupInitiative,
      autonomousBehavior:operation.autonomousBehavior,
      commandPolicy:operation.commandPolicy,
      count: evaluateAmount(operation.count, input, currentTarget, false, false),
      // Legacy map handoffs carry a numeric expiry even for persistent tokens;
      // their persistent flag disables that clock. Do not require authors to invent a duration.
      timing: operation.timing, durationRounds: operation.durationRounds ?? 1,
      concentration: operation.concentration, side: operation.side, persistent: operation.persistent,
      persistAfterConcentrationCompletes: operation.persistAfterConcentrationCompletes,
      becomesHostileAfterConcentrationEnds: operation.becomesHostileAfterConcentrationEnds,
      minimumMaximumHitPoints: operation.minimumMaximumHitPoints == null ? undefined
        : Math.max(1, evaluateAmount(operation.minimumMaximumHitPoints, input, input.actor, false, false)),
      armorClassBonus: operation.armorClassBonus == null ? undefined
        : evaluateAmount(operation.armorClassBonus, input, input.actor, false, false),
      weaponAttackBonus: operation.weaponAttackBonus == null ? undefined
        : evaluateSignedAmount(operation.weaponAttackBonus, input, input.actor),
      weaponDamageBonus: operation.weaponDamageBonus == null ? undefined
        : evaluateSignedAmount(operation.weaponDamageBonus, input, input.actor),
      savingThrowBonus: operation.savingThrowBonus == null ? undefined
        : evaluateAmount(operation.savingThrowBonus, input, input.actor, false, false),
      proficientSkillCheckBonus: operation.proficientSkillCheckBonus == null ? undefined
        : evaluateAmount(operation.proficientSkillCheckBonus, input, input.actor, false, false),
      weaponAttacksMagical: operation.weaponAttacksMagical === true ? true : undefined,
      attacksPerAction: operation.attacksPerAction == null ? undefined
        : Math.max(1, Math.min(10, evaluateAmount(operation.attacksPerAction, input, input.actor, false, false))),
      shareSelfSpellsRangeFeet: operation.shareSelfSpellsRangeFeet,
      shareSelfSpellsRequiresMounted: operation.shareSelfSpellsRequiresMounted,
      creatureTypeOverride: operation.creatureTypeOverride,
      minimumIntelligence: operation.minimumIntelligence,
      cannotAttack: operation.cannotAttack === true ? true : undefined,
      walkingSpeedFeet: operation.walkingSpeedFeet == null ? undefined
        : Math.max(0, Math.min(1_000, evaluateAmount(operation.walkingSpeedFeet, input, input.actor, false, false))),
      dismissAfterDamageRounds: operation.dismissAfterDamageRounds,
      sourceDeathBehavior: operation.sourceDeathBehavior,
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
      formId: (() => {
        const selected = input.targetFormIds?.[target.id] ?? formId
        const option = input.activity.choices?.find(choice => choice.id === operation.formChoiceId)?.options.find(candidate => candidate.id === selected)
        if (!option || (selected !== formId && (option.requirements?.length ?? 0) > 0)) throw new Dnd5eFormulaEvaluationError('invalid per-target form choice')
        return selected
      })(),
      profile: operation.profile,
      durationRounds: operation.durationRounds,
      permanent: operation.permanent,
      permanentAfterConcentrationCompletes: operation.permanentAfterConcentrationCompletes,
      concentration: operation.concentration,
      maximumChallengeRating: operation.maximumChallengeRating,
      hitPointMode: operation.hitPointMode,
      maximumSizeRank: operation.maximumSizeRank,
      equipmentDisposition,
      seenConfirmed,
      willingShapechanger: operation.allowWillingShapechanger === true && input.willingTargetIds?.includes(target.id) === true,
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
  if (operation.kind === 'alter-inventory-item') return operationTargets(operation.target, input, currentTarget).map(target => ({
    kind: 'alter-inventory-item', operationId: operation.id, actorId: input.actor.id,
    selectionRangeFeet: operation.selectionRangeFeet,
    includeGroundItems: operation.includeGroundItems,
    ...(operation.target === 'target' ? { ownerActorId: target.id } : {}),
    originalTemplateIds: operation.originalTemplateIds, inventoryInstanceId: input.inventoryInstanceId,
    templateId: operation.templateId, quantity: evaluateAmount(operation.quantity, input, input.actor, false, false),
    sourceEffectId: operation.sourceEffectId, permanent: operation.permanent,
    sourceSpellcastingModifier: operation.captureSpellcastingModifier ? evaluateDnd5eFormulaV1({kind:'reference',reference:{kind:'actor-spellcasting-ability-modifier'}},{actor:input.actor,rolls:input.rolls}) : undefined,
  }))
  if (operation.kind === 'exchange-inventory-items') return [{
    kind: 'exchange-inventory-items', operationId: operation.id, actorId: input.actor.id,
    templateId: operation.templateId, quantity: evaluateAmount(operation.quantity, input, input.actor, false, false),
    policy: structuredClone(operation.policy), sceneRangeFeet: operation.sceneRangeFeet,
  }]
  if (operation.kind === 'grant-inventory-item') return [{
    kind: 'grant-inventory-item',
    operationId: operation.id,
    actorId: input.actor.id,
    templateId: [...(operation.templateVariants ?? [])].sort((a,b) => b.minimumCastLevel-a.minimumCastLevel).find(variant => (input.castLevel ?? 0) >= variant.minimumCastLevel)?.templateId ?? operation.templateId,
    quantity: evaluateAmount(operation.quantity, input, input.actor, false, false),
    identified: operation.identified !== false,
    expiresAfterMinutes: operation.expiresAfterMinutes,
    sourceEffectId: operation.sourceEffectId,
    reuseSourceEffect: operation.reuseSourceEffect,
    sourceSpellcastingModifier: operation.captureSpellcastingModifier ? evaluateDnd5eFormulaV1({kind:'reference',reference:{kind:'actor-spellcasting-ability-modifier'}},{actor:input.actor,rolls:input.rolls}) : undefined,
    maximumPerSource: operation.maximumPerSource,
    equipToFreeHand: operation.equipToFreeHand,
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
    benefitKey: operation.benefitKey,
    benefitScope: operation.benefitScope,
    benefitRenewal: operation.benefitRenewal ? { ...operation.benefitRenewal } : undefined,
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
  if (operation.kind === 'convert-map-inventory-item') return [{kind: operation.kind, operationId: operation.id,
    originalTemplateIds: operation.originalTemplateIds, templateId: operation.templateId, quantity: operation.quantity}]
  if (operation.kind === 'protect-map-remains') return [{
    kind: 'protect-map-remains', operationId: operation.id, durationMinutes: operation.durationMinutes, minimumPower: operation.minimumPower,
    spellLevel: input.castLevel ?? 0,
  }]
  if (operation.kind === 'purify-map-consumables') return [{
    kind: 'purify-map-consumables', operationId: operation.id,
    contaminants: [...operation.contaminants],
  }]
  if (operation.kind === 'wither-map-vegetation') return [{
    kind: 'wither-map-vegetation', operationId: operation.id,
  }]
  if (operation.kind === 'enchant-map-weapon') {
    const effect = input.activity.effects?.find(effect => effect.id === operation.effectId)
    if (!effect || input.activity.target.kind !== 'area' || input.activity.target.placeRangeFeet == null) throw new Dnd5eFormulaEvaluationError('ground weapon effect or area range is unavailable')
    return [{ kind: operation.kind, operationId: operation.id, rangeFeet: input.activity.target.placeRangeFeet, resolved: resolveDnd5eGroundWeaponEffect(effect, { actor: input.actor, castLevel: input.castLevel, rolls: input.rolls ?? {} }) }]
  }
  if (operation.kind === 'ignite-area-fuel') return [{kind: operation.kind, operationId: operation.id}]
  if (operation.kind === 'extinguish-area-flames') return [{kind: operation.kind, operationId: operation.id, groundSpreadFeet: operation.groundSpreadFeet}]
  if (operation.kind === 'affect-persistent-entity') return [{
    kind: operation.kind, operationId: operation.id,
    amount: evaluateAmount(operation.amount, input, input.actor, false, false), damageType: operation.damageType,
    savingThrow: operation.savingThrow ? { ability: operation.savingThrow.ability,
      dc: evaluateDnd5eFormulaV1(operation.savingThrow.dc, formulaContext(input, input.actor)) } : undefined,
    conditions: operation.conditions ? [...operation.conditions] : undefined,
  }]
  if (operation.kind === 'control-map-water') return [{ kind: operation.kind, operationId: operation.id, change: structuredClone(operation.change), ...(operation.kind === 'control-map-water' && operation.rules ? {rules: structuredClone(operation.rules)} : {}) }]
  if (operation.kind === 'control-map-flame') return [{ kind: operation.kind, operationId: operation.id, change: structuredClone(operation.change), requireAreaOrigin: operation.requireAreaOrigin }]
  if (operation.kind === 'enchant-map-object-light') return [{
    kind: 'enchant-map-object-light', operationId: operation.id,
    brightRadiusFeet: operation.brightRadiusFeet,
    dimRadiusFeet: operation.dimRadiusFeet,
    color: operation.color,
    durationMinutes: operation.durationMinutes,
  }]
  if (operation.kind === 'transfer-loose-earth') return [{kind:operation.kind,operationId:operation.id,maximumSideFeet:operation.maximumSideFeet,distanceFeet:operation.distanceFeet,depthFeet:operation.depthFeet}]
  if (operation.kind === 'launch-map-object') {
    const check = input.activity.checks?.find(candidate => candidate.id === operation.savingThrowCheckId)
    const departureSave = check?.kind === 'saving-throw' && ['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(check.ability)
      ? { ability: check.ability as AbilityKey, dc: evaluateDnd5eFormulaV1(check.dc, formulaContext(input, input.actor)),
        successfulTargetIds: (input.resolvedChecks ?? []).filter(result => result.checkId === check.id && result.success && result.targetId != null).map(result => result.targetId!) }
      : undefined
    return [{
    kind: 'launch-map-object', operationId: operation.id, limits: { ...operation.limits }, harmlessPush: operation.harmlessPush,
    castLevel: input.castLevel ?? operation.limits.baseSlotLevel,
    amount: evaluateAmount(operation.amount, input, input.actor, false, false), damageType: operation.damageType,
    impactTargetId: input.resolvedChecks?.find(check => check.checkId === operation.savingThrowCheckId && !check.success)?.targetId,
    departureSave,
  }]
  }
  if (operation.kind === 'recognize-granting-disguise') return operationTargets(operation.target, input, currentTarget).map(target => ({kind: 'recognize-granting-disguise' as const, operationId: operation.id, targetId: target.id}))
  if (operation.kind === 'restore-original-alignment') return operationTargets(operation.target, input, currentTarget).map(target => ({
    kind: 'restore-original-alignment' as const, operationId: operation.id, targetId: target.id,
  }))
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
      kind: 'create-persistent-area', operationId: operation.id,
      sensorTargetId: operation.effectToken?.followSelectedTarget && input.activity.target.kind === 'creature' ? currentTarget?.id : undefined,
      label: operation.labelTextChoiceId ? input.choices?.[operation.labelTextChoiceId] ?? operation.label : operation.label,
      ignitesUnattendedFuel: operation.ignitesUnattendedFuel,
      instanceCount: operation.instanceCount,
      separateSelectedInstances: operation.separateSelectedInstances,
      clipHeightToMappedSolids: operation.clipHeightToMappedSolids,
      bindRestraintEffectIds: operation.bindRestraintEffectIds,
      durationRounds: castLevelProfile?.durationRounds ?? operation.durationRounds,
      permanent: castLevelProfile?.permanent ?? operation.permanent,
      concentration: castLevelProfile?.concentration ?? operation.concentration,
      mappedObjectEnchantment: operation.mappedObjectEnchantment,
      magicMouth,
      color: operation.colorTextChoiceId ? input.choices?.[operation.colorTextChoiceId] ?? operation.color : operation.color,
      visual: operation.drawingTextChoiceId ? {preset:'surface-drawing',drawing:parseSurfaceDrawing(input.choices?.[operation.drawingTextChoiceId])} : operation.visual,
      lighting: hallowLighting ?? operation.lighting,
      utilityProjectionId: operation.utilityProjectionId,
      structureServices: operation.structureServices ? {...operation.structureServices, ...(operation.structureServices.furnishings?{furnishings:operation.structureServices.furnishings.map(entry=>({...entry}))}:{})} : undefined,
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
      modes: operation.modes ? structuredClone(operation.modes) : undefined,
      initialModeId: operation.initialModeId ?? (operation.initialModeChoiceId ? input.choices?.[operation.initialModeChoiceId] : undefined),
      directionalMovementCost: operation.directionalMovementCost,
      movementCostMultiplier: operation.movementCostMultiplier,
      groundOnly: operation.groundOnly,
      surfaceMaterials: operation.surfaceMaterials ? [...operation.surfaceMaterials] : undefined,
      requireAllSurfaceMaterials: operation.requireAllSurfaceMaterials,
      requireNonmagicalSurfaceMaterials: operation.requireNonmagicalSurfaceMaterials,
      materialTransformation: operation.materialTransformation ? {...operation.materialTransformation} : undefined,
      surfaceAtPlacementElevation: operation.surfaceAtPlacementElevation,
      normalGroundTerrain: operation.normalGroundTerrain,
      terrainClearing: operation.terrainClearing ? { ...operation.terrainClearing } : undefined,
      movementRequiresGroundedSource: operation.movementRequiresGroundedSource,
      movementExcludesSource: operation.movementExcludesSource,
      movementGroundCover: operation.movementGroundCover,
      extinguishesUnprotectedFlames: operation.extinguishesUnprotectedFlames,
      endFlameExtinguishRadiusFeet: operation.endFlameExtinguishRadiusFeet,
      excludesWindDispersibleGas: operation.excludesWindDispersibleGas,
      obscuration: operation.obscuration ? { ...operation.obscuration } : undefined,
      dispersedByStrongWind: operation.dispersedByStrongWind,
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
      symbolMode: operation.symbolMode,
      entityProfile: operation.entityProfile ? {
        // Numeric entities remain separate from invulnerable projections.
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
      bindToRestSession: operation.bindToRestSession,
      concealsFlameLightFromOutside: operation.concealsFlameLightFromOutside,
      hiddenFromPlayers: operation.hiddenFromPlayers,
      teleportationPortal: operation.teleportationPortal ? { ...operation.teleportationPortal } : undefined,
      sourceSlotSpellHealing: operation.sourceSlotSpellHealing ? { amount: Math.max(0, Math.min(1000000, Math.floor(evaluateDnd5eFormulaV1(operation.sourceSlotSpellHealing.amount, formulaContext(input, currentTarget))))) } : undefined,
      creatureDetectionAdvantage: operation.creatureDetectionAdvantage,
      attackAdvantageReaction: operation.attackAdvantageReaction,
      sourceIncapacitatedBehavior: operation.sourceIncapacitatedBehavior,
      sourceAbilityCheckRules: operation.sourceAbilityCheckRules?.map(rule => structuredClone(rule)),
      sourceOverlapBehavior: operation.sourceOverlapBehavior,
      sourceLimit: operation.sourceLimit ? { ...operation.sourceLimit } : undefined,
      teleportationExitSavingThrow: operation.teleportationExitSavingThrow
        ? { ...operation.teleportationExitSavingThrow }
        : undefined,
      weaponHitBonusDamage: operation.weaponHitBonusDamage
        ? { ...operation.weaponHitBonusDamage }
        : undefined,
      grantedActivities: operation.grantedActivities?.map((grant) => ({ ...grant })),
      effectToken: operation.effectToken ? { ...operation.effectToken } : undefined,
      projectionDefense: operation.projectionDefense,
      investigationDc: operation.investigationDc,
      discovery: operation.discovery ? { ...operation.discovery } : undefined,
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
        critical: criticalForTarget(target),
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
  if (operation.kind === 'end-owned-companion-control') return currentTarget ? [{
    kind: operation.kind, operationId: operation.id, targetId: currentTarget.id,
    sourceActivityId: operation.sourceActivityId, requiresSpeech: operation.requiresSpeech,
    becomesHostile: operation.becomesHostile,
  }] : []
  if (operation.kind === 'command-owned-companion') {
    if (!currentTarget) return []
    const task = operation.task ? { ...operation.task } : undefined
    if (operation.allowsTaskDescription) {
      if (!task || !isDnd5eCompanionTaskDescriptions(input.companionTaskDescriptions) || !Object.hasOwn(input.companionTaskDescriptions, operation.id)) throw new Dnd5eFormulaEvaluationError('invalid companion task description')
      task.description = input.companionTaskDescriptions[operation.id].trim()
    }
    const ready = operation.ready ? { ...operation.ready } : undefined
    if (operation.allowsReadyTrigger) {
      if (!ready || !isDnd5eCompanionReadyTriggers(input.companionReadyTriggers) || !Object.hasOwn(input.companionReadyTriggers, operation.id)) {
        throw new Dnd5eFormulaEvaluationError('invalid companion ready trigger')
      }
      ready.trigger = input.companionReadyTriggers[operation.id].trim()
    }
    let objectInteraction: import('../companionObjectInteraction').Dnd5eCompanionObjectInteraction | undefined
    if (operation.requiresObjectInteraction) {
      const selections = input.companionObjectInteractions
      objectInteraction = normalizeDnd5eCompanionObjectInteraction(selections && typeof selections === 'object' && !Array.isArray(selections)
        ? (selections as Record<string, unknown>)[operation.id] : undefined)
      if (!objectInteraction) throw new Dnd5eFormulaEvaluationError('invalid companion object interaction')
    }
    let guardArea: import('../companionGuardArea').Dnd5eCompanionGuardArea | undefined
    if (operation.requiresGuardArea) {
      if (!isDnd5eCompanionGuardSelections(input.companionGuardAreas)) throw new Dnd5eFormulaEvaluationError('invalid companion guard selection')
      guardArea = normalizeDnd5eCompanionGuardArea(input.companionGuardAreas[operation.id])
      if (!guardArea) throw new Dnd5eFormulaEvaluationError('missing companion guard area')
    }
    let movementDestination: Dnd5eCompanionMovementDestination | undefined
    if (operation.allowsMovementDestination && input.companionMovementDestinations != null) {
      const selections = input.companionMovementDestinations
      if (!isDnd5eCompanionMovementSelections(selections) || !selections[operation.id]) throw new Dnd5eFormulaEvaluationError('invalid companion movement selection')
      const selected = selections[operation.id][currentTarget.id]
      if (selected != null) {
        movementDestination = normalizeDnd5eCompanionMovementDestination(selected)
        if (!movementDestination) throw new Dnd5eFormulaEvaluationError('invalid companion movement destination')
      }
    }
    let attackTargetId: string | undefined
    if (operation.requiresAttackTarget) {
      const selections = input.companionAttackTargets
      const selected = selections && typeof selections === 'object' && !Array.isArray(selections)
        ? (selections as Record<string, unknown>)[operation.id] : undefined
      if (typeof selected !== 'string' || selected === currentTarget.id ||
        !input.combatants?.some(target => target.id === selected && target.objectDamageThreshold == null)) {
        throw new Dnd5eFormulaEvaluationError('invalid companion attack target')
      }
      attackTargetId = selected
    }
    let helpTargetId: string | undefined
    let helpKind: 'attack' | 'ability-check' | undefined
    if (operation.requiresHelpTarget) {
      const selections = input.companionHelpTargets
      const selection = selections && typeof selections === 'object' && !Array.isArray(selections)
        ? (selections as Record<string, unknown>)[operation.id] : undefined
      const value = selection && typeof selection === 'object' && !Array.isArray(selection)
        ? selection as Record<string, unknown> : undefined
      if (!value || typeof value.targetId !== 'string' ||
        !input.combatants?.some(target => target.id === value.targetId) ||
        value.targetId === currentTarget.id || (value.helpKind !== 'attack' && value.helpKind !== 'ability-check')) {
        throw new Dnd5eFormulaEvaluationError('invalid companion Help target')
      }
      helpTargetId = value.targetId
      helpKind = value.helpKind
    }
    return [{
      kind: 'command-owned-companion', operationId: operation.id,
      task, ready, objectInteraction, guardArea, movementDestination, attackTargetId, attackKind: operation.attackKind, helpTargetId, helpKind,
      targetId: currentTarget.id, command: operation.command,sourceActivityId:operation.sourceActivityId,
      requiresSpeech:operation.requiresSpeech,voluntaryAfterControlEnds:operation.voluntaryAfterControlEnds,controlSaveDisadvantage:operation.controlSaveDisadvantage,
    }]
  }
  if (operation.kind === 'grant-weapon-attack') {
    const damageBonus = typeof operation.damageBonus === 'number' || operation.damageBonus == null
      ? operation.damageBonus : Math.floor(evaluateAmount(operation.damageBonus, input, input.actor, false, false))
    if (damageBonus != null && (!Number.isFinite(damageBonus) || damageBonus < -1000 || damageBonus > 1000)) throw new Error('invalid weapon grant damage bonus')
    const triggerAttackTarget = input.triggerContext?.source.kind === 'attack' ? input.triggerContext.source.targetId : undefined
    const boundTargetIds = triggerAttackTarget ? [triggerAttackTarget] : input.triggerContext?.eligibleTargetIds.filter(id => id !== input.actor.id)
    if (operation.bindTriggerTarget && (!boundTargetIds || boundTargetIds.length !== 1)) {
      throw new Error('weapon-attack grant requires exactly one Host trigger target')
    }
    const targetGrantId = operation.separateByTarget ? `${operation.grantId}:target:${encodeURIComponent(boundTargetIds![0])}` : operation.grantId
    const originTargetId = input.triggerContext?.source.kind === 'attack'
      ? input.triggerContext.source.targetId : undefined
    if (operation.differentTargetWithinFeetOfEventTarget != null && !originTargetId) {
      throw new Error('weapon-attack grant requires one authoritative event target')
    }
    const source = input.triggerContext?.source
    if (operation.inheritTriggerAttackOrigin && (source?.kind !== 'attack' || !source.origin)) {
      throw new Error('attack follow-up requires a Host attack origin')
    }
    if (operation.reuseMissedProjectile && (source?.kind !== 'attack' || source.result !== 'miss' ||
      source.mode !== 'ranged' || !source.weaponId || !source.weaponProperties?.includes('ammunition') || !source.projectileAttackSnapshot)) {
      throw new Error('projectile reuse requires a Host missed ammunition attack')
    }
    return [{
    projectileAttackSnapshot: operation.reuseMissedProjectile && source?.kind === 'attack' && source.projectileAttackSnapshot
      ? {...source.projectileAttackSnapshot,damage:{...source.projectileAttackSnapshot.damage}} : undefined,
    reusedProjectileWeaponId: operation.reuseMissedProjectile && source?.kind === 'attack' ? source.weaponId : undefined,
    targetRestriction: operation.differentTargetWithinFeetOfEventTarget != null
      ? {originTargetId: originTargetId!, maximumFeet: operation.differentTargetWithinFeetOfEventTarget} : undefined,
    kind: 'grant-weapon-attack',
    inheritedAttackOrigin: operation.inheritTriggerAttackOrigin && source?.kind === 'attack' ? source.origin : undefined,
    available: operation.available,
    requiredTargetId: operation.bindTriggerTarget ? boundTargetIds![0] : undefined,
    attackAdvantage: operation.attackAdvantage,
    attackResourceCost: operation.attackResourceCost ? { ...operation.attackResourceCost } : undefined,
    operationId: operation.id,
    grantId: operation.separateByTarget && operation.available === 'next-own-turn' ? `${targetGrantId}:pending` : targetGrantId,
    activatedGrantId: operation.separateByTarget && operation.available === 'next-own-turn' ? targetGrantId : undefined,
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
    damageBonus,
    weaponSlots: operation.weaponSlots ? [...operation.weaponSlots] : undefined,
  }]
  }
  if (operation.kind === 'grant-basic-action') return [{
    kind: 'grant-basic-action',
    operationId: operation.id,
    grantId: operation.grantId,
    label: operation.label,
    economy: operation.economy,
    actions: [...operation.actions],
    shovePushDistanceBonusFeet: operation.shovePushDistanceBonusFeet,
  }]
  if (operation.kind === 'relocate-granting-area' && input.activity.target.kind === 'area' && input.areaPlacement) {
    return [{ kind: 'relocate-granting-area', operationId: operation.id, targetId: input.actor.id,
      maximumFeet: evaluateAmount(operation.maximumFeet, input, input.actor, false, false),
      requiresDifferentAnchor: operation.requiresDifferentAnchor,
      retainMovementBudget: operation.retainMovementBudget }]
  }
  return operationTargets(operation.target, input, currentTarget).map((target):
    Dnd5eActivityCapabilityProposal | Dnd5eActivityCapabilityProposal[] => {
    if (operation.kind === 'damage') {
      const critical = criticalForTarget(target)
      const damageType = operationDamageType(operation,input)
      const elementalAdeptMinimum = input.activity.legacySource?.kind === 'spell' &&
        input.actor.elementalAdeptDamageTypes?.includes(damageType)
        ? 2
        : 1
      const diceAudit: Dnd5eFormulaDiceEvidenceV1[] = []
      const baseAmount = evaluateAmount(
        operation.amount,
        input,
        target,
        critical,
        operation.critical === 'double-dice',
        elementalAdeptMinimum,
        false,
        diceAudit,
        rollId => {
          const key = JSON.stringify([target.id, operation.damageSource ?? 'actor', rollId])
          if (input.consumedDamageRollBonusKeys?.has(key)) return 0
          input.consumedDamageRollBonusKeys?.add(key)
          return input.resolveDamageRollBonus?.(target.id, operation.damageSource) ?? 0
        },
      )
      const damageEvidence = diceAudit.length ? { diceAudit, formulaAdjustment: baseAmount - diceAudit.reduce((sum, die) => sum + die.values.reduce((a, b) => a + b, 0), 0) } : {}
      if (
        baseAmount <= 0 ||
        !dnd5eBestowCurseSpellDamageRiderAppliesV1(input.activity, input.actor, target)
      ) return {
        kind: 'deal-damage', damageGroup: operation.damageGroup, ...damageEvidence, operationId: operation.id, targetId: target.id,
        amount: baseAmount, damageType, magical: operation.magical === true, magicalOverride: operation.magical, damageSource: operation.damageSource,
        cannotBeReduced: operation.cannotBeReduced,
        destroysBodyOnDeath: operation.destroysBodyOnDeath,
        destroysBodyPartOnDeath: operation.destroysBodyPartOnDeath,
      }
      const rollId = `${DND5E_BESTOW_CURSE_SPELL_DAMAGE_ROLL_ID}:${target.id}`
      const riderRoll = input.rolls[rollId]
      const expectedDice = critical && operation.critical === 'double-dice' ? 2 : 1
      if (
        !riderRoll || riderRoll.values.length !== expectedDice ||
        riderRoll.values.some((value) => !Number.isInteger(value) || value < 1 || value > 8)
      ) throw new Dnd5eFormulaEvaluationError(`invalid Bestow Curse spell-damage roll: ${rollId}`)
      return [{
        kind: 'deal-damage', damageGroup: operation.damageGroup, ...damageEvidence,
        operationId: operation.id,
        targetId: target.id,
        amount: baseAmount,
        damageType,
        damageSource: operation.damageSource,
        magical: operation.magical === true,
        cannotBeReduced: operation.cannotBeReduced,
        destroysBodyOnDeath: operation.destroysBodyOnDeath,
        destroysBodyPartOnDeath: operation.destroysBodyPartOnDeath,
      }, {
        kind: 'deal-damage',
        operationId: `${operation.id}:${DND5E_BESTOW_CURSE_SPELL_DAMAGE_ROLL_ID}`,
        diceAudit: [{ rollId, count: expectedDice, submittedCount: expectedDice, sides: 8, rawValues: [...riderRoll.values], values: [...riderRoll.values] }],
        formulaAdjustment: 0,
        targetId: target.id,
        amount: riderRoll.values.reduce((total, value) => total + value, 0),
        damageType: 'necrotic',
        damageSource: operation.damageSource,
        magical: true,
      }]
    }
    if (operation.kind === 'healing') {
      const recipient = operation.recipientChoice
        ? [input.actor, ...(input.combatants ?? [])].find(candidate => candidate.id === input.choices?.[operation.recipientChoice!.choiceId])
        : target
      if (!recipient) throw new Dnd5eFormulaEvaluationError('Healing recipient is unavailable')
      if (operation.recipientChoice) {
        const distance = recipient.id === input.actor.id ? 0 : input.distanceFeetByTargetId?.[recipient.id]
        if (distance == null || !Number.isFinite(distance) || distance < 0 || distance > operation.recipientChoice.rangeFeet) {
          throw new Dnd5eFormulaEvaluationError('Healing recipient is out of range')
        }
        if (recipient.corpse != null) throw new Dnd5eFormulaEvaluationError('Healing cannot revive a corpse')
      }
      if (operation.damageResult) {
        const subject = operation.damageResult.subject === 'actor' ? input.actor : currentTarget
        if (!subject) throw new Dnd5eFormulaEvaluationError('damage result target is unavailable')
        return { kind: 'heal', operationId: operation.id, targetId: target.id, amount: 0,
          damageResult: { operationId: operation.damageResult.operationId, targetId: subject.id, multiplier: operation.damageResult.multiplier } }
      }
      const maximizeDice = recipient.maximizeHealingDice === true ||
        (input.actor.maximizeSpellHealingDiceAtZeroHp === true &&
          input.activity.legacySource?.kind === 'spell' && recipient.currentHp === 0)
      const amount = evaluateAmount(operation.amount, input, target, false, false, 1, maximizeDice)
      const diceAudit = formulaDiceAudit(operation.amount, input, maximizeDice)
      const displayedDiceTotal = diceAudit.reduce((total, die) =>
        total + die.values.reduce((sum, value) => sum + value, 0), 0)
      return {
        kind: 'heal', operationId: operation.id, targetId: recipient.id, amount,
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
    if (operation.kind === 'reveal-target-location') return { kind: 'reveal-target-location', operationId: operation.id, targetId: target.id }
    if (operation.kind === 'read-damage-traits') return { kind: 'read-damage-traits', operationId: operation.id, targetId: target.id }
    if (operation.kind === 'detect-planar-portal') return { kind: 'detect-planar-portal', operationId: operation.id, targetId: input.actor.id, rangeFeet: operation.rangeFeet }
    if (operation.kind === 'temporary-hit-points') return {
      kind: 'grant-temporary-hit-points', operationId: operation.id, targetId: target.id,
      sourceEffectId: operation.sourceEffectId,
      replacement: operation.replacement,
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
      if (operation.captureTargetIdentity && (operation.target !== 'actor' || input.targets.length !== 1)) {
        throw new Dnd5eFormulaEvaluationError('Identity capture requires one authoritative target')
      }
      const effect = input.activity.effects?.find((candidate) => candidate.id === operation.effectId)
      if (!effect) throw new Dnd5eFormulaEvaluationError(`activity effect is unavailable: ${operation.effectId}`)
      const conditionChoiceId = operation.frightenedSourceChoiceId ?? operation.charmedSourceChoiceId
      const conditionSourceId = conditionChoiceId ? input.choices?.[conditionChoiceId] : undefined
      if (conditionChoiceId && (!conditionSourceId || conditionSourceId === target.id ||
        !input.combatants?.some(creature => creature.id === conditionSourceId))) {
        throw new Dnd5eFormulaEvaluationError('A different Host-confirmed condition source creature is required')
      }
      if (operation.conditionSourceMaximumDistanceFeet != null && conditionSourceId) {
        const distance = input.distanceFeetBetweenTargets?.[target.id]?.[conditionSourceId] ??
          input.distanceFeetBetweenTargets?.[conditionSourceId]?.[target.id]
        if (distance == null || !Number.isFinite(distance) || distance < 0 || distance > operation.conditionSourceMaximumDistanceFeet) {
          throw new Dnd5eFormulaEvaluationError('The selected condition source is outside the Host-confirmed range')
        }
      }
      if (effect.undeadCreationProtection && (!target.corpse?.bodyPresent || target.currentHp !== 0)) {
        throw new Dnd5eFormulaEvaluationError('A Host-confirmed present corpse is required for remains protection')
      }
      const sharedCriticalDice = input.targets.some(criticalForTarget)
        ? Object.fromEntries(input.activity.outcomes.flatMap(outcome => outcome.operations.flatMap(candidate =>
            candidate.kind === 'damage' && candidate.critical === 'double-dice'
              ? formulaDiceRollIds(candidate.amount).map(id => [id, 2]) : [])))
        : undefined
      return {
        kind: 'apply-effect', operationId: operation.id, targetId: target.id,
        ...(operation.captureTargetIdentity ? { captureIdentityActorId: input.targets[0].id } : {}),
        ...(operation.disguiseFromGrant ? { disguiseFromGrant: true as const } : {}),
        ...(operation.timing ? { timing: operation.timing } : {}),
        ...resolveDnd5eAppliedEffectDefinitionV1(conditionSourceId ? { ...effect,
          tags: [...(effect.tags ?? []), `condition-entity:${conditionSourceId}`] } : effect, {
          actor: input.actor,
          target,
          inventoryInstanceId: input.inventoryInstanceId,
          selectedInventoryItem: input.selectedInventoryItem,
          castLevel: input.castLevel,
          rolls: input.rolls,
          maximumDiceMultiplierByRollId: sharedCriticalDice,
          selectedCreatureIds: input.activity.target.kind === 'creature' ? input.targets.map(creature => creature.id) : undefined,
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
      requiresWithinCarryingCapacity: operation.requiresWithinCarryingCapacity,
      harmful: operation.harmful,
      directionOrigin: operation.directionOrigin,
      cardinalDirection: operation.cardinalDirection,
      distanceFeet: evaluateAmount(operation.distanceFeet, input, target, false, false, 1, false, undefined, undefined,
        input.targets.some(criticalForTarget) ? Object.fromEntries(input.activity.outcomes.flatMap(outcome => {
          const index = outcome.operations.indexOf(operation)
          return index < 0 ? [] : outcome.operations.slice(0, index).flatMap(prior => prior.kind === 'damage' && prior.critical === 'double-dice'
            ? formulaDiceRollIds(prior.amount).map(id => [id, 2]) : [])
        })) : undefined),
      maximumDistanceFromActorFeet: operation.maximumDistanceFromActorFeet,
      requiresDifferentDestination: operation.requiresDifferentDestination,
      destinationPolicy: operation.destinationPolicy,
      continuationTargetRadiusFeet: operation.continuationTargetRadiusFeet,
      continuationTargetIds: operation.continuationTargetRadiusFeet == null ? undefined : [...input.continuationTargetIds ?? []],
      verticalDestination: operation.verticalDestination,
      stopAtMappedObstacle: operation.stopAtMappedObstacle,
      placement: operation.placement,
      originIllumination: operation.originIllumination,
      destinationIllumination: operation.destinationIllumination,
      requiresLineOfSight: operation.requiresLineOfSight,
      requiresVisibleDestination: operation.requiresVisibleDestination,
      ignoresOpportunityAttacks: operation.ignoresOpportunityAttacks,
      usesActorMovement: operation.usesActorMovement,
      usesTargetReactionIfAvailable: operation.usesTargetReactionIfAvailable,
      provokesOpportunityAttacks: operation.provokesOpportunityAttacks,
    }
    if (operation.kind === 'relocate-granting-area') return {
      kind: 'relocate-granting-area', operationId: operation.id, targetId: target.id,
      maximumFeet: evaluateAmount(operation.maximumFeet, input, target, false, false),
      requiresDifferentAnchor: operation.requiresDifferentAnchor,
      retainMovementBudget: operation.retainMovementBudget,
      interposition: operation.interposition?.kind === 'clear'
        ? 'clear' as const
        : operation.interposition?.kind === 'by-target-strength'
          ? target.abilities.str <= operation.interposition.maximumStrengthToBlock
            ? 'blocked' as const
            : 'difficult-terrain' as const
          : undefined,
    }
    if (operation.kind === 'shrink-granting-area') return {
      kind: 'shrink-granting-area', operationId: operation.id, targetId: input.actor.id,
      lengthFeet: evaluateAmount(operation.lengthFeet, input, input.actor, false, false),
    }
    if (operation.kind === 'reshape-granting-area') return {
      kind: 'reshape-granting-area', operationId: operation.id, targetId: input.actor.id,
      maximumFeet: operation.maximumFeet
        ? evaluateAmount(operation.maximumFeet, input, input.actor, false, false)
        : undefined,
    }
    if (operation.kind === 'change-granting-area-mode') return {
      kind: 'change-granting-area-mode', operationId: operation.id, targetId: input.actor.id, change: operation.change, direction: operation.direction,
      modeId: operation.modeId ?? (operation.modeChoiceId ? input.choices?.[operation.modeChoiceId] : undefined),
    }
    if (operation.kind === 'set-granting-area-senses') return {
      kind: 'set-granting-area-senses', operationId: operation.id,
      targetId: input.actor.id, mode: operation.mode,
    }
    if (operation.kind === 'detonate-granting-area' || operation.kind === 'dismiss-granting-area') return {
      kind: operation.kind, operationId: operation.id, actorId: input.actor.id,
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
    if (operation.kind === 'transfer-hit-point-maximum') return {
      kind: 'transfer-hit-point-maximum', operationId: operation.id, targetId: target.id,
      amount: evaluateAmount(operation.amount, input, target, false, false), owningEffectId: operation.owningEffectId,
      beneficiaryEffectId: operation.beneficiaryEffectId, minimumMaximum: operation.minimumMaximum ?? 1,
      increaseCurrentHp: operation.increaseCurrentHp === true,
      linkLifetimes: operation.linkLifetimes === true,
      ...(operation.protectLinkedLifetime === true ? { protectLinkedLifetime: true as const } : {}),
    }
    if (operation.kind === 'reduce-hit-point-maximum') return {
      kind: 'reduce-hit-point-maximum', operationId: operation.id, targetId: target.id,
      amount: evaluateAmount(operation.amount, input, target, false, false), owningEffectId: operation.owningEffectId,
      minimumMaximum: operation.minimumMaximum ?? 1,
    }
    if (operation.kind === 'recover-hit-point-maximum') return {
      kind: 'recover-hit-point-maximum', operationId: operation.id, targetId: target.id,
      maximumCount: operation.maximumCount,
    }
    if (operation.kind === 'break-inventory-item-attunement') return {
      kind: 'break-inventory-item-attunement', operationId: operation.id,
      ownerId: target.id, requireCursedMagicItem: true,
    }
    throw new Dnd5eFormulaEvaluationError(`unsupported Activity operation: ${(operation as { kind: string }).kind}`)
  }).flat()
}

export function resolveDnd5eActivity(input: Dnd5eActivityExecutionInput): Dnd5eActivityExecutionResult {
  const definitionErrors = validateDnd5eActivityDefinitionV1(input.activity)
  if (definitionErrors.length) return { ok: false, reason: 'invalid-definition', details: definitionErrors }
  if (input.featureSpellInvocationInterrupted) input = { ...input, activity: dnd5eInterruptedFeatureSpellActivity(input.activity) }
  try {
    input = { ...input, activity: materializeDnd5eEventWeaponDice(input.activity, input.triggerContext) }
  } catch (error) {
    return { ok: false, reason: 'trigger-mismatch', details: [error instanceof Error ? error.message : 'activity-trigger-weapon-dice-unavailable'] }
  }
  if (input.activity.scaling?.some(rule => rule.basis === 'ability-modifier' && !Number.isFinite(input.actor.abilities?.[rule.ability!]))) {
    return { ok: false, reason: 'invalid-actor', details: ['activity-scaling-ability-score-missing'] }
  }
  const scaled = scaleActivity(input)
  // Level scaling belongs to the declared extra damage, never the equipped weapon.
  try {
    scaled.activity = materializeDnd5eEquipmentWeaponDamage(scaled.activity, input.equipmentWeaponDamage)
  } catch (error) {
    return { ok: false, reason: 'trigger-mismatch', details: [error instanceof Error ? error.message : 'activity-equipment-weapon-unavailable'] }
  }
  const baseActivity = dnd5eActivityLanguageChoicesV1(scaled.activity, input.actor.languages, input.actor.hitPointDice, input.combatants)
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
    if (selected == null || (choice.textInput ? !validDnd5eActivityTextInput(selected, choice.textInput.maximumLength, choice.textInput.format, choice.textInput.maximumWords) :
      (!selected || !choice.options.some((option) => option.id === selected)))) {
      return { ok: false, reason: 'requirement-failed', details: [`missing or invalid Activity choice: ${choice.id}`] }
    }
    resolvedChoices[choice.id] = selected
  }
  const activity = dnd5eActivityWithTargetChoicesV1(baseActivity, resolvedChoices)
  const executionInput: Dnd5eActivityExecutionInput = {
    ...input, activity,
    consumedDamageRollBonusKeys: new Set<string>(),
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
  const animatesSelectedObjects = dnd5eActivityAnimatesSelectedObjects(activity)
  if (!animatesSelectedObjects && activity.outcomes.some(outcome => outcome.operations.some(operation =>
    operation.kind === 'summon' && operation.animatedObjectSize))) {
    return { ok: false, reason: 'invalid-target', details: ['Object animation cannot mix creature operations'] }
  }
  if (animatesSelectedObjects && input.targets.some(target => target.objectDamageThreshold == null)) {
    return { ok: false, reason: 'invalid-target', details: ['Object animation requires object targets'] }
  }
  if (input.targets.some(target => target.objectDamageThreshold != null) && !animatesSelectedObjects &&
      !(activity.target.kind === 'creature' && activity.target.allowObjectAttack === true && activity.target.count === 1 &&
        activity.target.relation === 'any' && activity.checks?.length === 1 && activity.checks[0].kind === 'attack-roll' &&
        activity.outcomes.every(outcome => outcome.operations.every(operation => operation.kind === 'damage' && operation.target === 'target')))) {
    return { ok: false, reason: 'invalid-target', details: ['Activity does not allow object attacks'] }
  }
  if (activity.target.kind === 'self' && (input.targets.length !== 1 || input.targets[0]?.id !== input.actor.id)) {
    return { ok: false, reason: 'invalid-target', details: ['self Activity requires the actor as its only target'] }
  }
  {
    for(const check of activity.checks??[]){
      if(check.kind!=='saving-throw'||!check.rollModeByHostFact)continue
      if(input.targets.some(target=>typeof input.saveFactsByTargetId?.[target.id]?.[check.rollModeByHostFact!.id]!=='boolean')){
        return {ok:false,reason:'invalid-target',details:[`Host save fact required: ${check.rollModeByHostFact.id}`]}
      }
    }
  }
  if (activity.target.kind === 'creature') {
    for (const qualification of activity.target.requiredQualifications ?? []) {
      if (qualification.whenChoice && !qualification.whenChoice.optionIds.includes(resolvedChoices[qualification.whenChoice.choiceId] ?? '')) continue
      if (input.targets.some(target => !input.targetQualificationIdsByTargetId?.[target.id]?.includes(qualification.id) ||
        (qualification.creatureTypes && (!target.creatureType || !qualification.creatureTypes.some(type => dnd5eActivityCreatureTypeMatches(type, target.creatureType!)))))) {
        return { ok: false, reason: 'invalid-target', details: [`Host target qualification required: ${qualification.id}`] }
      }
    }
    if (activity.target.requiresWilling && input.targets.some(target => !input.willingTargetIds?.includes(target.id))) {
      return { ok: false, reason: 'invalid-target', details: ['explicit target willingness is required'] }
    }
    if (activity.target.maximumTargetSeparationFeet != null) {
      for (let first = 0; first < input.targets.length; first++) {
        for (let second = first + 1; second < input.targets.length; second++) {
          const a = input.targets[first]!.id
          const b = input.targets[second]!.id
          const distance = a === b ? 0 : input.distanceFeetBetweenTargets?.[a]?.[b] ?? input.distanceFeetBetweenTargets?.[b]?.[a]
          if (distance == null || !Number.isFinite(distance) || distance < 0 || distance > activity.target.maximumTargetSeparationFeet) {
            return { ok: false, reason: 'invalid-target', details: ['target separation is invalid or unavailable'] }
          }
        }
      }
    }
    if (input.targets.length < (activity.target.minimumCount ?? 1) || input.targets.length > activity.target.count) {
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
      const range=activity.target.effectOrigin?.rangeFeet??activity.target.rangeFeet
      if (
        range != null &&
        (distance == null || distance > range || distance < (activity.target.minimumRangeFeet ?? 0))
      ) return { ok: false, reason: 'invalid-target', details: ['target distance is invalid'] }
    }
  }
  let areaInstance: Dnd5eActivityAreaInstanceV1 | undefined
  if (activity.target.kind === 'area') {
    if (activity.target.selection === 'choose-any' && input.targets.length < (activity.target.minimumTargets ?? 0)) {
      return { ok: false, reason: 'invalid-target', details: ['area target count is below the declared minimum'] }
    }
    if (activity.target.maximumTargets != null && input.targets.length > activity.target.maximumTargets) {
      return { ok: false, reason: 'invalid-target', details: ['area target count is invalid'] }
    }
    if (!input.areaPlacement) return { ok: false, reason: 'invalid-target', details: ['area placement is required'] }
    if ([input.areaPlacement.pitchDegrees,input.areaPlacement.rollDegrees].some(angle=>angle!=null &&
      (activity.target.kind!=='area' || !activity.target.tiltable || activity.target.shape!=='rect' || !Number.isFinite(angle) || angle < -180 || angle > 180))) {
      return {ok:false,reason:'invalid-target',details:['area tilt is invalid or unavailable']}
    }
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
    if (input.areaPlacement.objectLaunchPitchDegrees != null && (
      !Number.isFinite(input.areaPlacement.objectLaunchPitchDegrees) || input.areaPlacement.objectLaunchPitchDegrees < -90 ||
      input.areaPlacement.objectLaunchPitchDegrees > 90 || !activity.outcomes.some(outcome => outcome.operations.some(operation => operation.kind === 'launch-map-object'))
    )) return { ok: false, reason: 'invalid-target', details: ['object flight pitch is invalid or unavailable'] }
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
        (!gridAligned || minimum == null && value === maximum || value % gridStepFeet === 0) && value >= lower && value <= maximum
        ? value
        : null
    }
    const radiusStepFeet = activity.target.minimumRadiusFeet != null && activity.target.minimumRadiusFeet % 5 !== 0 ? 2.5 : 5
    const radiusFeet = resolveDimension(input.areaPlacement.radiusFeet, activity.target.minimumRadiusFeet, activity.target.radiusFeet, true, radiusStepFeet)
    const planarGridAligned = activity.target.shape === 'rect' || activity.target.shape === 'cube'
      ? (activity.target.gridAligned ?? activity.target.shape === 'cube')
      : true
    const lengthFeet = resolveDimension(input.areaPlacement.lengthFeet, activity.target.minimumLengthFeet, activity.target.lengthFeet, planarGridAligned)
    const widthFeet = resolveDimension(input.areaPlacement.widthFeet, activity.target.minimumWidthFeet, activity.target.widthFeet, planarGridAligned)
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
      verticalSurface: areaInstance.verticalSurface ? { ...areaInstance.verticalSurface } : undefined,
      elevationFeet: areaInstance.elevationFeet,
      angleDegrees: areaInstance.angleDegrees,
      objectLaunchPitchDegrees: areaInstance.objectLaunchPitchDegrees,
      radiusFeet: areaInstance.radiusFeet,
      lengthFeet: areaInstance.lengthFeet,
      widthFeet: areaInstance.widthFeet,
      heightFeet: areaInstance.heightFeet,
      instances: areaInstance.instances?.map((instance) => ({ ...instance })),
    }
  }
  if (input.projectileTargetIds?.length &&
    (activity.target.kind !== 'creature' || activity.target.allowDuplicateTargets !== true ||
      input.projectileTargetIds.length > activity.target.count ||
      input.projectileTargetIds.length < (activity.target.minimumCount ?? 1))) {
    return { ok: false, reason: 'invalid-target', details: ['projectile occurrences violate the target contract'] }
  }
  if (((activity.checks ?? []).some(check => 'perProjectile' in check && check.perProjectile) ||
    activity.outcomes.some(outcome => outcome.operations.some(operation => operation.kind === 'damage' && operation.perProjectile))) && !input.projectileTargetIds?.length) {
    return { ok: false, reason: 'invalid-target', details: ['per-projectile checks require an ordered projectile declaration'] }
  }
  const projectileTargets = input.projectileTargetIds?.map((id) => input.targets.find((target) => target.id === id))
  if (activity.outcomes.some(outcome => outcome.operations.some(operation => operation.kind === 'damage' && operation.perTarget)) &&
    (input.projectileTargetIds?.length || new Set(input.targets.map(target => target.id)).size !== input.targets.length)) {
    return { ok: false, reason: 'invalid-target', details: ['independent target damage requires distinct creatures'] }
  }
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
    const applicableTargets = input.targets.filter(target => !dnd5eActivityExcludesTarget(activity.target, target) &&
      dnd5eActivityGroundWithinVerticalRange(activity.target, input.areaPlacement?.elevationFeet ?? input.actor.elevationFeet!, target.groundElevationFeet!))
    const resolutionTargets = spellActivity
      ? applicableTargets.filter((target) =>
          !spellEffectSuppressedForTarget(target) &&
          (!divineWordActivity || target.canHearActivitySource !== false) &&
          (!fleshToStoneActivity || dnd5eFleshToStoneTargetHasFlesh(target)) &&
          (!fireStormSparesPlants || !isPlantCreature(target)))
      : applicableTargets
    const resolutionInput = resolutionTargets === input.targets
      ? executionInput
      : { ...executionInput, targets: resolutionTargets }
    const checks: Dnd5eActivityCheckResult[] = []
    for (const check of activity.checks ?? []) {
      if ('appliesWhenChoice' in check && check.appliesWhenChoice &&
        !check.appliesWhenChoice.optionIds.includes(resolutionInput.choices?.[check.appliesWhenChoice.choiceId] ?? '')) {
        continue
      }
      const perProjectile = 'perProjectile' in check && check.perProjectile === true
      const checkTargets = check.scope === 'per-target'
        ? perProjectile
          ? projectileTargets!.flatMap((target, projectileOccurrenceIndex) => target && resolutionTargets.some(candidate => candidate.id === target.id)
            ? [{ ...target, projectileOccurrenceIndex }] : [])
          : resolutionTargets
        : resolutionTargets[0] || !spellActivity ||
          (activity.target.kind === 'area' && check.kind === 'random-roll' && check.scope === 'shared')
          ? [resolutionTargets[0]]
          : []
      for (const target of checkTargets) {
        if (check.kind === 'saving-throw' && dnd5eActivitySaveExcludesCreatureType(check, target?.creatureType)) continue
        const priorChecks = checks.filter(result => result.projectileOccurrenceIndex == null || result.projectileOccurrenceIndex === target?.projectileOccurrenceIndex)
        if (check.kind === 'random-roll' && check.minimumTargetSpeedFeet != null &&
          (target?.speed == null || !Number.isFinite(target.speed) || target.speed < check.minimumTargetSpeedFeet)) continue
        if (check.kind === 'saving-throw' && check.appliesWhenCheck) {
          const prerequisite = priorChecks.find((candidate) =>
            candidate.checkId === check.appliesWhenCheck!.checkId &&
            (candidate.targetId == null || candidate.targetId === target?.id))
          if (!prerequisite?.success) continue
        }
        if (check.kind === 'random-roll' && check.appliesWhenSave) {
          const prerequisite = priorChecks.find(candidate => candidate.checkId === check.appliesWhenSave!.checkId && candidate.targetId === target?.id)
          if (!prerequisite || prerequisite.success !== (check.appliesWhenSave.result === 'success')) continue
        }
        if (check.kind === 'random-roll' && check.appliesWhenCheckTotal) {
          const prerequisite = priorChecks.find((candidate) =>
            candidate.checkId === check.appliesWhenCheckTotal!.checkId &&
            (candidate.targetId == null || candidate.targetId === target?.id))
          if (
            !prerequisite ||
            (check.appliesWhenCheckTotal.minimum != null && prerequisite.total < check.appliesWhenCheckTotal.minimum) ||
            (check.appliesWhenCheckTotal.maximum != null && prerequisite.total > check.appliesWhenCheckTotal.maximum)
          ) continue
        }
        const sequentialModes = resolutionInput.resolveSequentialCheckRollModes?.(check, target, priorChecks)
        const result = resolveCheck(check, sequentialModes
          ? { ...resolutionInput, checkRollModes: { ...resolutionInput.checkRollModes, ...sequentialModes } }
          : resolutionInput, target)
        // One actor check governs every outcome target; the first selected
        // target is only formula context, not the ownership of that result.
        if (check.scope !== 'per-target' && (check.kind === 'ability-check' || check.kind === 'skill-check' || check.kind === 'concentration-check')) {
          result.targetId = undefined
        }
        if (perProjectile) result.projectileOccurrenceIndex = target?.projectileOccurrenceIndex
        checks.push(result)
        if (check.kind === 'saving-throw' && check.stopAfterFirstFailure && !result.success) break
      }
    }
    resolutionInput.validateOptionalSavingThrowUses?.(checks)
    const sharedOperationExecutionInput: Dnd5eActivityExecutionInput = {
      ...resolutionInput,
      resolvedChecks: checks,
    }
    const proposals: Dnd5eActivityCapabilityProposal[] = []
    const areaSpellDamageTypes=new Set<Dnd5eDamageType>()
    const coldSpellMissTargetIds = new Set<string>()
    if (spellActivity && activity.target.kind === 'creature') {
      for (const target of resolutionTargets) for (const outcome of activity.outcomes) {
        const conditions = outcome.when.kind === 'all' ? outcome.when.conditions : [outcome.when]
        const missedAttack = (condition: typeof conditions[number]) =>
          condition.kind === 'check' && condition.result === 'success' &&
          activity.checks?.some(check => check.id === condition.checkId && check.kind === 'attack-roll') &&
          checks.some(check => check.checkId === condition.checkId && check.targetId === target.id && !check.success)
        // A miss suppresses damage, not the cold spell's path. Other predicates still apply.
        if (!conditions.some(missedAttack) || !conditions.every(condition =>
          missedAttack(condition) || condition.kind === 'always' ||
          outcomeConditionApplies(condition, checks, resolutionInput.choices, target, resolutionInput))) continue
        for (const operation of outcome.operations) {
          if (operation.kind !== 'damage' || operation.target === 'actor' || operation.damageSource === 'grant-source') continue
          // A missed attack need not roll damage. Do not invent a rolled element.
          if (operation.damageTypeFromRoll && !resolutionInput.rolls[operation.damageTypeFromRoll.rollId]) continue
          if (operationDamageType(operation, sharedOperationExecutionInput) === 'cold') coldSpellMissTargetIds.add(target.id)
        }
      }
    }
    if(spellActivity&&activity.target.kind==='area')for(const outcome of activity.outcomes){
      const conditions=outcome.when.kind==='all'?outcome.when.conditions:[outcome.when]
      // Creature saves select damage amounts, not whether the element reaches the area.
      const applies=conditions.every(condition=>condition.kind==='always'||
        (condition.kind==='check'&&activity.checks?.some(check=>check.id===condition.checkId&&check.kind==='saving-throw'))||
        outcomeConditionApplies(condition,checks,resolutionInput.choices,undefined,resolutionInput))
      if(applies)for(const operation of outcome.operations)if(operation.kind==='damage'&&operation.target!=='actor'&&operation.damageSource!=='grant-source'){
        areaSpellDamageTypes.add(operationDamageType(operation,sharedOperationExecutionInput))
      }
    }
    const appliedOnce = new Set<string>()
    for (const outcome of activity.outcomes) {
      const resolvedProjectileTargets = projectileTargets?.filter((target): target is Dnd5eActivityActorSnapshot => target != null)
      const candidateTargets = resolvedProjectileTargets?.length
        ? resolvedProjectileTargets
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
      const allChecks = checks
      for (const [projectileOccurrenceIndex, target] of candidateTargets.entries()) {
        if (target && !resolutionTargets.some(candidate => candidate.id === target.id)) continue
        const checks = allChecks.filter(result => result.projectileOccurrenceIndex == null || result.projectileOccurrenceIndex === projectileOccurrenceIndex)
        const operationExecutionInput = { ...sharedOperationExecutionInput, resolvedChecks: checks }
        const when = outcome.when
        const applies = when.kind === 'always' || (when.kind === 'all'
          ? when.conditions.every((condition) => outcomeConditionApplies(condition, checks, resolutionInput.choices, target, resolutionInput))
          : outcomeConditionApplies(when, checks, resolutionInput.choices, target, resolutionInput))
        if (!applies) continue
        const conditions = when.kind === 'all' ? when.conditions : [when]
        const involuntaryForTarget = (targetId: string) =>
          !resolutionInput.willingTargetIds?.includes(targetId) && conditions.some(condition =>
            condition.kind === 'check' && ['failure', 'critical-failure'].includes(condition.result) &&
            checks.some(check => check.checkId === condition.checkId && check.targetId === targetId &&
              check.kind === 'saving-throw' && !check.success && check.automaticOutcome !== 'allied-unresisted-failure'))
        const attackCheckIds = new Set(conditions.flatMap(condition =>
          condition.kind === 'check' && ['success', 'critical-success'].includes(condition.result) &&
          activity.checks?.some(check => check.id === condition.checkId && check.kind === 'attack-roll')
            ? [condition.checkId] : []))
        const attackChecksForTarget = (targetId: string) => checks.filter(check =>
          attackCheckIds.has(check.checkId) && check.success &&
          (check.targetId == null || check.targetId === targetId))
        const criticalForTarget = (affected: Dnd5eActivityActorSnapshot): boolean => {
          // Local checks own their own result; another check or another target
          // cannot donate a critical. Save-dependent damage is an independent pool.
          if (conditions.some(condition => condition.kind === 'check' || condition.kind === 'check-total')) {
            return attackChecksForTarget(affected.id).some(check => check.criticalSuccess)
          }
          return executionInput.triggerContext?.source.kind === 'attack' &&
            executionInput.triggerContext.source.result === 'critical-hit' &&
            executionInput.triggerContext.eligibleTargetIds.includes(affected.id)
        }
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
          const once = (operation.kind === 'summon' && !operation.corpseFormChoiceId && !operation.afterDamageKillOperationId && !operation.animatedObjectSize) || operation.kind === 'duplicate-creature' || operation.kind === 'create-persistent-area' ||
            (operation.kind === 'relocate-granting-area' && activity.target.kind === 'area') ||
            operation.kind === 'grant-extra-turns' || operation.kind === 'control-map-flame' || operation.kind === 'control-map-water' ||
            operation.kind === 'exchange-inventory-items' || operation.kind === 'grant-inventory-item' ||
            operation.kind === 'identify-inventory-item' ||
            operation.kind === 'purify-inventory-item' ||
            operation.kind === 'emit-sound' || operation.kind === 'modify-map-object-lock' || operation.kind === 'launch-map-object' || operation.kind === 'transfer-loose-earth' ||
            operation.kind === 'ignite-area-fuel' || operation.kind === 'extinguish-area-flames' || operation.kind === 'convert-map-inventory-item' || operation.kind === 'protect-map-remains' || operation.kind === 'purify-map-consumables' ||
            operation.kind === 'wither-map-vegetation' ||
            operation.kind === 'grant-weapon-attack' || operation.kind === 'grant-basic-action' ||
            operation.kind === 'invoke-activity' || operation.kind === 'manual-adjudication' || operation.kind === 'narrative-prompt' ||
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
            let scopedInput = operationExecutionInput
            if (operation.kind === 'damage' && operation.perTarget) {
              if (!target || operation.target !== 'target') throw new Dnd5eFormulaEvaluationError('independent damage requires a creature target')
              const rolls = { ...operationExecutionInput.rolls }
              for (const rollId of formulaDiceRollIds(operation.amount)) {
                const scopedRollId = `${rollId}:${target.id}`
                const roll = input.rolls[scopedRollId]
                if (!roll) throw new Dnd5eFormulaEvaluationError(`missing target damage dice: ${scopedRollId}`)
                rolls[rollId] = roll
                rolls[scopedRollId] = roll
              }
              scopedInput = { ...operationExecutionInput, rolls, allowCriticalDiceSuperset: false }
            }
            if (operation.kind === 'damage' && operation.perProjectile) {
              if (!input.projectileTargetIds?.length || !target || operation.target !== 'target') {
                throw new Dnd5eFormulaEvaluationError('projectile damage requires ordered creature targets')
              }
              const rolls = { ...operationExecutionInput.rolls }
              for (const rollId of formulaDiceRollIds(operation.amount)) {
                const scopedRollId = `${rollId}:projectile:${projectileOccurrenceIndex}:${target.id}`
                const roll = input.rolls[scopedRollId]
                if (!roll) throw new Dnd5eFormulaEvaluationError(`missing projectile damage dice: ${scopedRollId}`)
                // Replace both aliases so target-specific shared dice cannot override this occurrence.
                rolls[rollId] = roll
                rolls[`${rollId}:${target.id}`] = roll
              }
              scopedInput = { ...operationExecutionInput, rolls, allowCriticalDiceSuperset: false }
            }
            operationProposals(operation, scopedInput, target, criticalForTarget)
              .forEach((proposal) => proposals.push({ ...proposal,
                ...((proposal.kind === 'apply-standard-condition' || proposal.kind === 'apply-effect') && involuntaryForTarget(proposal.targetId)
                  ? { involuntary: true as const } : {}),
                ...(proposal.kind === 'deal-damage' && attackChecksForTarget(proposal.targetId).length ? { attackDamage: true, attackCheckKeys: attackChecksForTarget(proposal.targetId).map(check => check.key) } : {}), logTrigger: {
                activityName: activity.name, outcomeId: outcome.id, operationId: operation.id,
                conditions: (when.kind === 'always' ? [] : when.kind === 'all' ? when.conditions : [when]).map(condition => {
                  if (condition.kind === 'choice') {
                    const choice = activity.choices?.find(item => item.id === condition.choiceId)
                    return `选择${choice?.label ?? '规则选项'}：${choice?.options.find(item => item.id === condition.optionId)?.label ?? '指定选项'}`
                  }
                  if (condition.kind === 'check') {
                    const check = activity.checks?.find(item => item.id === condition.checkId)
                    const label = check?.kind === 'saving-throw' ? '目标豁免' : check?.kind === 'attack-roll' ? '攻击检定' : '规则检定'
                    return `${label}${{'success':'成功','failure':'失败','critical-success':'重击成功','critical-failure':'大失败'}[condition.result]}`
                  }
                  if (condition.kind === 'check-total') return '效果判定落入本分支的结果范围'
                  return activityLogPredicate(condition.predicate)
                }),
              } }))
          }
          if (once) appliedOnce.add(onceKey)
        }
      }
    }
    const inventoryLeaseTags = new Map<string,string>()
    for (const grant of proposals) {
      if ((grant.kind !== 'grant-inventory-item' && grant.kind !== 'alter-inventory-item') || !grant.sourceEffectId) continue
      if (grant.kind === 'grant-inventory-item' && grant.reuseSourceEffect) {
        const source = input.actor.activeEffectDefinitionIds?.find(effect => {
          // Headless may split a native Effect into runtime modifier/marker entries.
          // Match its authored definition after removing only those generated suffixes.
          const definitionId = effect.definitionId.replace(/:(?:modifiers:\d+|extension|marker)$/, '')
          return (effect.definitionId === grant.sourceEffectId || effect.definitionId.endsWith(':' + grant.sourceEffectId) ||
            definitionId === grant.sourceEffectId || definitionId.endsWith(':' + grant.sourceEffectId)) &&
            effect.sourceActorId === input.actor.id && effect.tags?.some(tag => /^item-lease:[a-f0-9-]{36}$/.test(tag))
        })
        const tag = source?.tags?.find(tag => /^item-lease:[a-f0-9-]{36}$/.test(tag))
        if (!tag) throw new Dnd5eFormulaEvaluationError('Generated item source no longer exists')
        grant.sourceEffectTag = tag
        const operation = activity.outcomes.flatMap(outcome=>outcome.operations).find(operation=>operation.id===grant.operationId)
        if (operation?.kind === 'grant-inventory-item') grant.templateId = [...(operation.templateVariants ?? [])].sort((a,b)=>b.minimumCastLevel-a.minimumCastLevel).find(variant=>(source?.spellLevel ?? 0)>=variant.minimumCastLevel)?.templateId ?? operation.templateId
        continue
      }
      const parents = proposals.filter((proposal): proposal is Extract<Dnd5eActivityCapabilityProposal,{kind:'apply-effect'}> => proposal.kind === 'apply-effect' && proposal.effectId === grant.sourceEffectId && proposal.targetId === input.actor.id)
      if (!parents.length) throw new Dnd5eFormulaEvaluationError('Generated item source effect was not applied to its actor')
      let tag = inventoryLeaseTags.get(grant.sourceEffectId)
      if (!tag) {
        tag = 'item-lease:' + crypto.randomUUID()
        inventoryLeaseTags.set(grant.sourceEffectId,tag)
        for (const parent of parents) {
          if ((parent.tags?.length ?? 0) >= 32) throw new Dnd5eFormulaEvaluationError('Generated item source effect has too many tags')
          parent.tags = [...(parent.tags ?? []),tag]
        }
      }
      grant.sourceEffectTag = tag
    }
    return {
      ok: true,
      status: proposals.some((proposal) => proposal.kind === 'request-dm-adjudication')
        ? 'dm-adjudication-required'
        : 'resolved',
      checks,
      consumptions: (activity.consumption ?? []).filter(consumption => (consumption.kind !== 'hit-die' && consumption.kind !== 'resource') || !consumption.whenChoice ||
        consumption.whenChoice.optionIds.includes(resolutionInput.choices?.[consumption.whenChoice.choiceId] ?? ''))
        .map((consumption) => resolveConsumption(consumption, resolutionInput)),
      proposals: groupDnd5eActivityDamageProposals(proposals),
      areaSpellDamageTypes:areaSpellDamageTypes.size?[...areaSpellDamageTypes]:undefined,
      coldSpellMissTargetIds:coldSpellMissTargetIds.size?[...coldSpellMissTargetIds]:undefined,
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

