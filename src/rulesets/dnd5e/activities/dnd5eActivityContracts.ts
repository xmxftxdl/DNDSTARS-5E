import type { AutomationCapability } from '../../../domain/automation/automationCapability'
import type { AbilityKey } from '../../../lib/dnd'
import type { Dnd5eStandardConditionId } from '../conditions'
import type { Dnd5eDamageType } from '../damageTypes'
import type { Dnd5ePersistentAreaVisual } from '../persistentAreaTypes'
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
      weaponId?: string
      weaponProperties?: readonly string[]
    }
  | { kind: 'spell'; id: string; activityId?: string; level: number }
  | { kind: 'skill'; id: string; activityId?: string }
  | { kind: 'item' | 'feature' | 'action'; id: string; activityId?: string }
  | { kind: 'movement'; id?: string; distanceFeet: number; completed: boolean }
  | { kind: 'combat'; id?: string; activityId?: string }
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
      origin: 'self' | 'point'
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
  origin: 'self' | 'point'
  radiusFeet?: number
  lengthFeet?: number
  widthFeet?: number
  heightFeet?: number
}

export type Dnd5eActivityConsumptionV1 =
  | { kind: 'action-economy'; economy: 'action' | 'bonus-action' | 'reaction'; amount: 1; consumeOn: 'confirm' | 'resolve' }
  | { kind: 'spell-slot'; minimumLevel: number; level: 'selected'; amount: 1; consumeOn: 'confirm' | 'resolve' }
  | { kind: 'resource'; resourceId: string; amount: Dnd5eFormulaV1; consumeOn: 'confirm' | 'hit' | 'resolve' | 'dm-approval' }
  | { kind: 'item-charge' | 'ammo' | 'hit-die'; resourceId: string; amount: Dnd5eFormulaV1; consumeOn: 'confirm' | 'hit' | 'resolve' }
  | { kind: 'hp' | 'movement'; amount: Dnd5eFormulaV1; consumeOn: 'confirm' | 'resolve' }

export type Dnd5eActivityCheckV1 =
  | {
      id: string
      kind: 'attack-roll'
      rollId: string
      attackBonus: Dnd5eFormulaV1
      rollMode: 'normal' | 'advantage' | 'disadvantage' | 'host-derived'
      criticalThreshold?: number
      scope?: 'shared' | 'per-target'
    }
  | {
      id: string
      kind: 'saving-throw'
      rollId: string
      ability: AbilityKey
      dc: Dnd5eFormulaV1
      rollMode?: 'normal' | 'advantage' | 'disadvantage' | 'host-derived'
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

export type Dnd5eActivityOperationTargetV1 = 'actor' | 'target' | 'all-targets'

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
      kind: 'apply-standard-condition'
      target: Dnd5eActivityOperationTargetV1
      condition: Dnd5eStandardConditionId
      duration: Dnd5eEffectDurationV1
    }
  | { id: string; kind: 'remove-standard-condition'; target: Dnd5eActivityOperationTargetV1; condition: Dnd5eStandardConditionId }
  | { id: string; kind: 'resource'; subject: 'actor' | 'target'; resourceId: string; mode: 'spend' | 'restore'; amount: Dnd5eFormulaV1 }
  | { id: string; kind: 'move'; target: Dnd5eActivityOperationTargetV1; mode: 'push' | 'pull' | 'teleport'; distanceFeet: Dnd5eFormulaV1 }
  | {
      id: string
      kind: 'summon'
      monsterId: string
      count: Dnd5eFormulaV1
      timing: 'immediate' | 'source-next-turn-start'
      durationRounds: number
      concentration: boolean
      side: 'ally' | 'enemy'
    }
  | {
      id: string
      kind: 'create-persistent-area'
      label: string
      durationRounds: number
      concentration: boolean
      color?: string
      visual?: Dnd5ePersistentAreaVisual
    }
  | {
      id: string
      kind: 'invoke-activity'
      activityId: string
      target: 'actor' | 'target'
      repeat: Dnd5eFormulaV1
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
  basis: 'character-level' | 'class-level' | 'slot-level' | 'proficiency-bonus' | 'custom-table'
  classId?: string
  baseLevel?: number
  table?: readonly { level: number; value: number | string }[]
  adjustments?: readonly {
    operationId: string
    diceCountPerStep?: number
    flatAmountPerStep?: number
    additionalTargetsPerStep?: number
    additionalProjectilesPerStep?: number
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
