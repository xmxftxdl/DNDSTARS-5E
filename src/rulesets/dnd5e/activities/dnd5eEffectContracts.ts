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
  | { kind: 'weapon-damage-roll'; mode: 'add'; value: Dnd5eFormulaV1; appliesTo?: 'this-weapon' | 'all-weapon-attacks' }
  | { kind: 'saving-throw'; ability?: AbilityKey; mode: 'add' | 'advantage' | 'disadvantage'; value?: Dnd5eFormulaV1 }
  | { kind: 'damage-resistance'; damageType: Dnd5eDamageType }
  | { kind: 'damage-immunity'; damageType: Dnd5eDamageType }
  | { kind: 'damage-vulnerability'; damageType: Dnd5eDamageType }
  | { kind: 'condition-immunity'; condition: Dnd5eStandardConditionId }
  | { kind: 'prohibit-reaction' }
  | { kind: 'maximum-attacks-per-turn'; value: number }
  | {
      kind: 'damage-reduction'
      amount: Dnd5eFormulaV1
      damageTypes?: readonly Dnd5eDamageType[]
      minimumIncomingDamage?: number
      maximumCurrentHitPointPercent?: number
      oncePerTurn?: boolean
      resourceId?: string
      resourceCost?: number
    }
  | {
      kind: 'on-hit-bonus-damage'
      amount: Dnd5eFormulaV1
      damageType: Dnd5eDamageType | 'inherit-primary'
      appliesTo: 'this-weapon' | 'all-weapon-attacks'
      doubleDiceOnCritical?: boolean
      oncePerTurn?: boolean
      targetCreatureTypes?: readonly string[]
      resourceId?: string
      resourceCost?: number
    }
  | {
      kind: 'attack-roll-reroll'
      maximumDice: 1
      appliesTo: 'this-weapon' | 'all-weapon-attacks'
      resourceId?: string
      resourceCost?: number
    }
  | { kind: 'death-prevention'; hitPointsAfter: number; preventsMassiveDamage?: boolean; resourceId?: string; resourceCost?: number }

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
  | 'attack-declared'
  | 'before-attack-roll'
  | 'after-attack-roll'
  | 'attack-hit'
  | 'attack-missed'
  | 'attack-resolved'
  | 'before-damage'
  | 'after-damage'
  | 'before-save'
  | 'after-save'
  | 'on-move'
  | 'movement-started'
  | 'movement-completed'
  | 'on-enter-area'
  | 'on-leave-area'
  | 'on-cast'
  | 'after-cast'
  | 'spell-cast'
  | 'spell-resolved'
  | 'skill-used'
  | 'item-used'
  | 'feature-used'
  | 'action-resolved'
  | 'd20-roll-resolved'
  | 'reaction-window'
  | 'legendary-action-window'
  | 'lair-action-window'
  | 'on-concentration-check'
  | 'on-condition-applied'
  | 'on-defeat'
  | 'creature-dropped-to-zero'
  | 'before-drop-to-zero'
  | 'short-rest-complete'
  | 'long-rest-complete'

export const DND5E_TRIGGER_EVENT_IDS_V1: readonly Dnd5eTriggerEventV1[] = [
  'combat-start', 'combat-end', 'round-start', 'round-end', 'turn-start', 'turn-end',
  'before-attack', 'after-attack', 'on-hit', 'on-miss',
  'attack-declared', 'before-attack-roll', 'after-attack-roll', 'attack-hit', 'attack-missed', 'attack-resolved',
  'before-damage', 'after-damage', 'before-save', 'after-save',
  'on-move', 'movement-started', 'movement-completed', 'on-enter-area', 'on-leave-area',
  'on-cast', 'after-cast', 'spell-cast', 'spell-resolved', 'skill-used', 'item-used', 'feature-used',
  'action-resolved', 'd20-roll-resolved', 'reaction-window', 'legendary-action-window', 'lair-action-window',
  'on-concentration-check', 'on-condition-applied', 'on-defeat', 'creature-dropped-to-zero', 'before-drop-to-zero',
  'short-rest-complete', 'long-rest-complete',
]

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
  | {
      kind: 'event-source'
      source: 'attack' | 'spell' | 'skill' | 'item' | 'feature' | 'movement' | 'action' | 'combat'
      sourceId?: string
      activityId?: string
    }
  /** Exact stable-id match. Prefer this over legacy sourceId/activityId for new content. */
  | { kind: 'activity-definition'; definitionId: string }
  | { kind: 'weapon-property'; property: string; present: boolean }
  | { kind: 'attack-mode'; mode: 'melee' | 'ranged' | 'spell' | 'unarmed' }
  | { kind: 'attack-result'; result: 'hit' | 'miss' | 'critical-hit' | 'critical-miss' }
  | { kind: 'movement-distance'; minimumFeet?: number; maximumFeet?: number }
  | { kind: 'spell-used'; spellId?: string; minimumLevel?: number; maximumLevel?: number }
  | { kind: 'skill-used'; skillId?: string }
  | { kind: 'action-economy-available'; economy: 'action' | 'bonus-action' | 'reaction'; amount?: 1 }
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
