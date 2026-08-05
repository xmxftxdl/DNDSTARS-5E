import type { AbilityKey } from '../../../lib/dnd'
import type { Dnd5eStandardConditionId } from '../conditions'
import type { Dnd5eDamageType } from '../damageTypes'
import type { Dnd5eFormulaV1 } from './dnd5eFormula'

export const DND5E_EFFECT_SCHEMA_VERSION = 1 as const

export type Dnd5eEffectDurationV1 =
  | { kind: 'instantaneous' }
  | { kind: 'rounds'; rounds: number; expiresAt: 'source-turn-start' | 'source-turn-end' | 'target-turn-start' | 'target-turn-end' }
  | { kind: 'save-ends'; maximumRounds: number; timing: 'target-turn-end'; ability: AbilityKey; dc: Dnd5eFormulaV1 }
  | { kind: 'concentration'; maximumRounds: number }
  | { kind: 'permanent' }

export type Dnd5eEffectModifierV1 =
  | { kind: 'armor-class'; mode: 'add' | 'minimum' | 'maximum' | 'override'; value: Dnd5eFormulaV1 }
  | { kind: 'speed'; mode: 'add' | 'multiply' | 'minimum' | 'maximum' | 'override'; value: Dnd5eFormulaV1 }
  | { kind: 'attack-roll'; mode: 'add' | 'advantage' | 'disadvantage'; value?: Dnd5eFormulaV1 }
  | { kind: 'saving-throw'; ability?: AbilityKey; mode: 'add' | 'advantage' | 'disadvantage'; value?: Dnd5eFormulaV1 }
  | { kind: 'damage-resistance'; damageType: Dnd5eDamageType }
  | { kind: 'damage-immunity'; damageType: Dnd5eDamageType }
  | { kind: 'damage-vulnerability'; damageType: Dnd5eDamageType }
  | { kind: 'condition-immunity'; condition: Dnd5eStandardConditionId }
  | { kind: 'prohibit-reaction' }
  | { kind: 'maximum-attacks-per-turn'; value: number }

export type Dnd5eTriggerEventV1 =
  | 'combat-start'
  | 'combat-end'
  | 'round-start'
  | 'round-end'
  | 'turn-start'
  | 'turn-end'
  | 'before-attack'
  | 'after-attack'
  | 'on-hit'
  | 'on-miss'
  | 'before-damage'
  | 'after-damage'
  | 'before-save'
  | 'after-save'
  | 'on-move'
  | 'on-enter-area'
  | 'on-leave-area'
  | 'on-cast'
  | 'after-cast'
  | 'on-concentration-check'
  | 'on-condition-applied'
  | 'on-defeat'
  | 'short-rest-complete'
  | 'long-rest-complete'

export type Dnd5ePredicateV1 =
  | { kind: 'minimum-level'; level: number }
  | { kind: 'class-level'; classId: string; minimum: number }
  | { kind: 'hp-percentage'; subject: 'actor' | 'target'; comparison: 'at-most' | 'at-least'; value: number }
  | { kind: 'hp-value'; subject: 'actor' | 'target'; comparison: 'below' | 'at-most' | 'at-least' | 'above'; value: number }
  | { kind: 'condition'; subject: 'actor' | 'target'; condition: Dnd5eStandardConditionId; present: boolean }
  | { kind: 'target-relation'; relation: 'self' | 'ally' | 'enemy' | 'any' }
  | { kind: 'distance'; minimumFeet?: number; maximumFeet?: number }
  | { kind: 'resource'; resourceId: string; minimum: Dnd5eFormulaV1 }
  | { kind: 'once-per-turn'; key: string }
  | { kind: 'choice'; choiceId: string; optionId: string }

export interface Dnd5eTriggerLimitV1 {
  uses: number
  reset: 'turn' | 'round' | 'combat' | 'short-rest' | 'long-rest' | 'never'
}

export interface Dnd5eTriggerDefinitionV1 {
  id: string
  event: Dnd5eTriggerEventV1
  predicates?: readonly Dnd5ePredicateV1[]
  activityId?: string
  effectId?: string
  decision?: 'automatic' | 'actor-choice' | 'target-choice' | 'dm-approval'
  limit?: Dnd5eTriggerLimitV1
}

export interface Dnd5eEffectDefinitionV1 {
  schemaVersion: typeof DND5E_EFFECT_SCHEMA_VERSION
  id: string
  name: string
  duration: Dnd5eEffectDurationV1
  conditions?: readonly Dnd5eStandardConditionId[]
  modifiers?: readonly Dnd5eEffectModifierV1[]
  grants?: readonly string[]
  triggers?: readonly Dnd5eTriggerDefinitionV1[]
  stacking: 'replace' | 'refresh-duration' | 'stack' | 'highest' | 'lowest' | 'unique-by-source'
  concentration?: boolean
  dispel?: { kind: 'spell-level'; level: number } | { kind: 'dm-adjudication'; reason: string }
}

