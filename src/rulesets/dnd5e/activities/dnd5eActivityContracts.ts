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
      /** Excludes the creature used as the event-target anchor from the area result. */
      excludeEventTarget?: boolean
      rotatable?: boolean
      requiresLineOfSight?: boolean
      requiresLineOfEffect?: boolean
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

export type Dnd5eActivityOutcomeWhenV1 =
  | { kind: 'always' }
  | { kind: 'check'; checkId: string; result: 'success' | 'failure' | 'critical-success' | 'critical-failure' }
  | { kind: 'choice'; choiceId: string; optionId: string }
  | { kind: 'predicate'; predicate: Dnd5ePredicateV1 }
  | {
      kind: 'all'
      conditions: readonly (
        | { kind: 'check'; checkId: string; result: 'success' | 'failure' | 'critical-success' | 'critical-failure' }
        | { kind: 'choice'; choiceId: string; optionId: string }
        | { kind: 'predicate'; predicate: Dnd5ePredicateV1 }
      )[]
    }

export interface Dnd5eActivityChoiceDefinitionV1 {
  id: string
  label: string
  options: readonly { id: string; label: string; description?: string; requirements?: readonly Dnd5ePredicateV1[] }[]
  defaultOptionId?: string
}

export type Dnd5eActivityOperationTargetV1 = 'actor' | 'target' | 'all-targets'

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
  | { id: string; kind: 'stabilize'; target: Dnd5eActivityOperationTargetV1 }
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
  | { id: string; kind: 'remove-standard-condition'; target: Dnd5eActivityOperationTargetV1; condition: Dnd5eStandardConditionId }
  | {
      id: string
      kind: 'remove-effect'
      target: Dnd5eActivityOperationTargetV1
      effectId: string
      source: 'self' | 'any'
    }
  | { id: string; kind: 'resource'; subject: 'actor' | 'target'; resourceId: string; mode: 'spend' | 'restore'; amount: Dnd5eFormulaV1 }
  | {
      id: string
      kind: 'move'
      target: Dnd5eActivityOperationTargetV1
      mode: 'push' | 'pull' | 'teleport' | 'swap'
      distanceFeet: Dnd5eFormulaV1
      /** Host chooses the farthest legal destination in the declared direction. */
      placement?: 'host-automatic-maximum'
      originIllumination?: readonly ('dim' | 'darkness' | 'magical-darkness')[]
      destinationIllumination?: readonly ('dim' | 'darkness' | 'magical-darkness')[]
      requiresLineOfSight?: boolean
      ignoresOpportunityAttacks?: boolean
      /** If available, the affected creature spends its reaction to perform this movement. */
      usesTargetReactionIfAvailable?: boolean
      /** Voluntary/reaction movement may leave hostile reach and create ordinary opportunity windows. */
      provokesOpportunityAttacks?: boolean
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
      actions: readonly ('grapple' | 'shove')[]
      shovePushDistanceBonusFeet?: number
    }
  | {
      id: string
      kind: 'create-persistent-area'
      label: string
      instanceCount?: number
      durationRounds: number
      concentration: boolean
      color?: string
      visual?: Dnd5ePersistentAreaVisual
      utilityProjectionId?: string
      /** Generic Host-owned area lifecycle shared by spells, features, items and monsters. */
      triggers?: readonly Dnd5ePersistentAreaTriggerDeclaration[]
      movement?: Dnd5ePersistentAreaMovementDeclaration
      lifecycle?: Dnd5ePersistentAreaTurnLifecycle
      movementCostMultiplier?: number
      obscuration?: Dnd5ePersistentAreaObscuration
      occupantModifiers?: Dnd5ePersistentAreaOccupantModifiers
      blocking?: Dnd5ePersistentAreaBlocking
      /** Current eligible occupants add this damage to each weapon hit. */
      weaponHitBonusDamage?: Dnd5ePersistentAreaWeaponHitBonusDamage
      /** Active controls granted by the authoritative area entity. */
      grantedActivities?: readonly Dnd5ePersistentAreaGrantedActivity[]
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
 * again by the authority before it delegates to the installed room plugin.
 */
export interface Dnd5eActivityAuthorityBindingV1 {
  kind: 'declarative-subclass-mechanic'
  subclassId: string
  abilityId: string
  mechanicKind: NonNullable<DeclarativeSubclassAbilityV1['mechanic']>['kind']
  execution: 'plugin-headless-action' | 'headless-event-engine'
  /** Present only when the ordinary trusted plugin action is the executor. */
  actionId?: string
}

export interface Dnd5eActivityDefinitionV1 {
  schemaVersion: typeof DND5E_ACTIVITY_SCHEMA_VERSION
  id: string
  name: string
  description?: string
  activation: Dnd5eActivityActivationV1
  invocation?: Dnd5eActivityInvocationV1
  target: Dnd5eActivityTargetV1
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
  }
}
