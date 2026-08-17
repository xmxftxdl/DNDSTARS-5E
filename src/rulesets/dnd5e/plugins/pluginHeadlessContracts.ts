import type { RulesetAdapter } from '../../contracts'
import type {
  Dnd5eActionFailure,
  Dnd5eActionResult,
  Dnd5eCombatant,
  Dnd5eCombatEvent,
  Dnd5eHeadlessCombatState,
} from '../headlessCombatEngine'
import type { Dnd5eStandardConditionId } from '../conditions'
import type { Dnd5eDamageType } from '../damageTypes'
import type { Dnd5ePluginEffectDuration } from '../persistentAreaTypes'
import type { Dnd5eActivityAreaPlacementV1 } from '../activities/dnd5eActivityContracts'
import type { Dnd5eEffectDefinitionV1 } from '../activities/dnd5eEffectContracts'
import type { JsonValue } from './pluginManifestContracts'

export interface Dnd5ePluginAction {
  type: 'plugin'
  pluginId: string
  actionId: string
  transactionId?: string
  featureId?: string
  /** Host-validated declarative modifiers applied to this Activity. */
  modifierFeatureIds?: string[]
  actorId: string
  targetId?: string
  targetIds?: string[]
  targetCell?: { col: number; row: number }
  targetOrientation?: 0 | 1 | 2 | 3
  distanceFeet?: number
  /** Host-derived placement for a compiled Activity area. Never trust this from a remote client. */
  activityAreaPlacement?: Dnd5eActivityAreaPlacementV1
  activityAreaPlacementDistanceFeet?: number
  /** Host-derived spell slot/cast level used by unified Activity scaling. */
  castLevel?: number
  rolls?: Record<string, Dnd5ePluginDiceRollResult>
  interruptChoiceId?: string
  payload?: JsonValue
  /** Host-only entitlement established from a live map entity. */
  hostEntitlement?: { kind: 'persistent-area'; areaId: string }
  /** Host-derived distances from a non-actor Activity origin such as a vine. */
  hostDistanceFeetByTargetId?: Record<string, number>
  /** Host-only first activation granted by an area created by the same cast. */
  hostWaiveActionEconomy?: boolean
}

export interface Dnd5ePluginDiceRollDeclaration {
  id: string
  label: string
  count: number
  sides: number
  modifier?: number
  visibility?: 'public' | 'dm'
}

/**
 * A Host-expanded roll recipe. The registered plugin declares one stable base
 * id; the Host creates `${id}:${targetId}` rolls after authoritative target
 * selection, so clients cannot omit or forge one creature's check.
 */
export type Dnd5ePluginPerTargetDiceRollDeclaration = Dnd5ePluginDiceRollDeclaration

export interface Dnd5ePluginDiceRollResult {
  values: number[]
  modifier: number
  total: number
}

export interface Dnd5ePluginInterruptOption {
  id: string
  label: string
  description?: string
}

export interface Dnd5ePluginInterruptDeclaration {
  prompt: string
  audience: 'actor' | 'target' | 'dm'
  options: readonly Dnd5ePluginInterruptOption[]
  defaultOptionId: string
  cancelOptionId?: string
  timeoutMs?: number
}

export interface Dnd5ePluginHeadlessActionContext {
  state: Dnd5eHeadlessCombatState
  action: Dnd5ePluginAction
  events: Dnd5eCombatEvent[]
  rules: RulesetAdapter
  actor: Dnd5eCombatant
  target?: Dnd5eCombatant
  targets: readonly Dnd5eCombatant[]
  rolls: Readonly<Record<string, Dnd5ePluginDiceRollResult>>
  parentAttackDamageType?: Dnd5eDamageType
  /** Host-derived attack mode using the authoritative map/combat snapshot. */
  attackRollMode(targetId: string, delivery?: 'melee' | 'ranged'): 'normal' | 'advantage' | 'disadvantage'
  grantTemporaryHitPoints(targetId: string, amount: number): number
  heal(targetId: string, amount: number): number
  dealDamage(targetId: string, amount: number, damageType: Dnd5eDamageType): number
  applyStandardCondition(
    targetId: string,
    condition: Dnd5eStandardConditionId,
    duration: Dnd5ePluginEffectDuration,
  ): boolean
  removeStandardCondition(targetId: string, condition: Dnd5eStandardConditionId): boolean
  stabilize(targetId: string): boolean
  standUpUsingReactionIfAvailable(targetId: string): boolean
  /** Host-only compiler bridge for the shared Activity/Effect primitive. */
  applyEffectDefinition(
    targetId: string,
    effect: Dnd5eEffectDefinitionV1,
    castLevel?: number,
  ): boolean
  /** Removes only a bounded Activity effect instance selected by stable effect id. */
  removeEffectDefinition(targetId: string, effectId: string, source: 'self' | 'any'): boolean
  spendResource(resourceId: string, amount?: number): boolean
  restoreResource(resourceId: string, amount?: number): boolean
  /** Host-only target economy mutation used by compulsory reaction movement. */
  spendTargetReaction(targetId: string): boolean
  fail(reason: Dnd5eActionFailure): Dnd5eActionResult
  succeed(): Dnd5eActionResult
}

export interface Dnd5ePluginHeadlessActionDefinition {
  id: string
  allowOffTurn?: boolean
  execution?: 'trusted' | 'worker'
  rolls?: readonly Dnd5ePluginDiceRollDeclaration[]
  perTargetRolls?: readonly Dnd5ePluginPerTargetDiceRollDeclaration[]
  resolve?(context: Dnd5ePluginHeadlessActionContext): Dnd5eActionResult
}
