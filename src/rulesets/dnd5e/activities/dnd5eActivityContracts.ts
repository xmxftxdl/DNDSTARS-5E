import type { AutomationCapability } from '../../../domain/automation/automationCapability'
import type { AbilityKey } from '../../../lib/dnd'
import type { Dnd5eStandardConditionId } from '../conditions'
import type { Dnd5eDamageType } from '../damageTypes'
import type { Dnd5ePersistentAreaVisual } from '../persistentAreaTypes'
import type { Dnd5eEffectDefinitionV1, Dnd5eEffectDurationV1, Dnd5ePredicateV1, Dnd5eTriggerDefinitionV1 } from './dnd5eEffectContracts'
import type { Dnd5eFormulaV1 } from './dnd5eFormula'

export const DND5E_ACTIVITY_SCHEMA_VERSION = 1 as const

export type Dnd5eActivityActivationV1 =
  | { kind: 'action' | 'bonus-action' | 'reaction' | 'free' | 'movement'; cost?: number; reactionEvent?: string }
  | { kind: 'minute' | 'hour'; value: number }
  | { kind: 'passive' | 'special'; timing?: string }

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

export interface Dnd5eActivityDefinitionV1 {
  schemaVersion: typeof DND5E_ACTIVITY_SCHEMA_VERSION
  id: string
  name: string
  description?: string
  activation: Dnd5eActivityActivationV1
  target: Dnd5eActivityTargetV1
  requirements?: readonly Dnd5ePredicateV1[]
  consumption?: readonly Dnd5eActivityConsumptionV1[]
  checks?: readonly Dnd5eActivityCheckV1[]
  outcomes: readonly Dnd5eActivityOutcomeV1[]
  effects?: readonly Dnd5eEffectDefinitionV1[]
  triggers?: readonly Dnd5eTriggerDefinitionV1[]
  scaling?: readonly Dnd5eActivityScalingV1[]
  automation: AutomationCapability
  /** Traceability only. Runtime execution never dispatches on this locator. */
  legacySource?: { kind: 'spell' | 'feature' | 'feat' | 'item' | 'subclass-ability' | 'monster-action' | 'custom-headless-action'; id: string }
}
