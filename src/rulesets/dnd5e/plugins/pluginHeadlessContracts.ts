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
import type { JsonValue } from './pluginManifestContracts'

export interface Dnd5ePluginAction {
  type: 'plugin'
  pluginId: string
  actionId: string
  transactionId?: string
  featureId?: string
  actorId: string
  targetId?: string
  targetIds?: string[]
  targetCell?: { col: number; row: number }
  targetOrientation?: 0 | 1 | 2 | 3
  distanceFeet?: number
  rolls?: Record<string, Dnd5ePluginDiceRollResult>
  interruptChoiceId?: string
  payload?: JsonValue
}

export interface Dnd5ePluginDiceRollDeclaration {
  id: string
  label: string
  count: number
  sides: number
  modifier?: number
  visibility?: 'public' | 'dm'
}

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
  grantTemporaryHitPoints(targetId: string, amount: number): number
  heal(targetId: string, amount: number): number
  dealDamage(targetId: string, amount: number, damageType: Dnd5eDamageType): number
  applyStandardCondition(
    targetId: string,
    condition: Dnd5eStandardConditionId,
    duration: Dnd5ePluginEffectDuration,
  ): boolean
  spendResource(resourceId: string, amount?: number): boolean
  restoreResource(resourceId: string, amount?: number): boolean
  fail(reason: Dnd5eActionFailure): Dnd5eActionResult
  succeed(): Dnd5eActionResult
}

export interface Dnd5ePluginHeadlessActionDefinition {
  id: string
  allowOffTurn?: boolean
  execution?: 'trusted' | 'worker'
  rolls?: readonly Dnd5ePluginDiceRollDeclaration[]
  resolve?(context: Dnd5ePluginHeadlessActionContext): Dnd5eActionResult
}
