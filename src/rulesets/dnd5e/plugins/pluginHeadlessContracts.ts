import type { RulesetAdapter } from '../../contracts'
import type {
  Dnd5eActionFailure,
  Dnd5eActionResult,
  Dnd5eAttackDecoyOccurrenceRoll,
  Dnd5eCombatant,
  Dnd5eCombatEvent,
  Dnd5eHeadlessCombatState,
} from '../headlessCombatEngine'
import type { Dnd5eStandardConditionId } from '../conditions'
import type { Dnd5eDamageType } from '../damageTypes'
import type { Dnd5ePluginEffectDuration } from '../persistentAreaTypes'
import type { Dnd5eActivityAreaPlacementV1 } from '../activities/dnd5eActivityContracts'
import type { Dnd5eEffectDefinitionV1 } from '../activities/dnd5eEffectContracts'
import type { Dnd5eActivityCapabilityProposal } from '../activities/dnd5eActivityExecutor'
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
  /** Host-validated creatures designated not to trigger this Activity's persistent area. */
  activityAreaExemptTargetIds?: string[]
  /** Host-derived spell slot/cast level used by unified Activity scaling. */
  castLevel?: number
  rolls?: Record<string, Dnd5ePluginDiceRollResult>
  interruptChoiceId?: string
  payload?: JsonValue
  /** Host-only entitlement established from a live map entity or authoritative Active Effect. */
  hostEntitlement?:
    | { kind: 'persistent-area'; areaId: string }
    | { kind: 'active-effect'; effectId: string }
  /** Host-derived distances from a non-actor Activity origin such as a vine. */
  hostDistanceFeetByTargetId?: Record<string, number>
  /** Host-only first activation granted by an area created by the same cast. */
  hostWaiveActionEconomy?: boolean
  /** Host roll ledger shared by the outer atomic action. */
  attackDecoyRolls?: readonly Dnd5eAttackDecoyOccurrenceRoll[]
}

export interface Dnd5ePluginDiceRollDeclaration {
  id: string
  label: string
  count: number
  /** Host-only compatibility counts accepted for an already-recorded roll. */
  acceptedCounts?: readonly number[]
  sides: number
  modifier?: number
  /** Closed random-table faces that the Host roller must discard and reroll. */
  rerollValues?: readonly number[]
  visibility?: 'public' | 'dm'
  /** Host-derived identity of the creature actually rolling this die pool. */
  rollerTokenId?: string
  /** Host-derived d20 test metadata used by the shared player-interrupt bridge. */
  d20RollKind?: 'attack' | 'ability-check' | 'saving-throw'
  /** Inspiration grants advantage and therefore cannot add another die to an existing mode. */
  d20RollMode?: 'normal' | 'advantage' | 'disadvantage'
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
  /** Settles a generic attack-decoy effect before Activity outcomes are committed. */
  settleAttackDecoy(input: {
    occurrenceId: string
    targetId: string
    d20: number
    total: number
  }): { ok: true; redirected: boolean } | { ok: false; result: Dnd5eActionResult }
  grantTemporaryHitPoints(targetId: string, amount: number): number
  heal(targetId: string, amount: number): number
  revive(
    proposal: Extract<Dnd5eActivityCapabilityProposal, { kind: 'revive' }>,
  ): boolean
  dealDamage(targetId: string, amount: number, damageType: Dnd5eDamageType): number
  applyStandardCondition(
    targetId: string,
    condition: Dnd5eStandardConditionId,
    duration: Dnd5ePluginEffectDuration,
  ): boolean
  removeStandardCondition(
    targetId: string,
    condition: Dnd5eStandardConditionId,
    sourceCreatureTypes?: readonly string[],
  ): boolean
  stabilize(targetId: string): boolean
  standUpUsingReactionIfAvailable(targetId: string): boolean
  /** Host-only compiler bridge for the shared Activity/Effect primitive. */
  applyEffectDefinition(
    targetId: string,
    effect: Dnd5eEffectDefinitionV1,
    castLevel?: number,
  ): boolean
  /** Commits the exact formula-resolved proposal produced by the trusted Activity executor. */
  applyResolvedEffect(
    proposal: Extract<Dnd5eActivityCapabilityProposal, { kind: 'apply-effect' }>,
  ): boolean
  /** Applies a Host-catalog creature form after validating CR, size and source linkage. */
  transformCreature(
    proposal: Extract<Dnd5eActivityCapabilityProposal, { kind: 'transform-creature' }>,
  ): boolean
  /** Inserts Host-owned one-shot initiative slots and optionally suspends all other creatures. */
  grantExtraTurns(
    proposal: Extract<Dnd5eActivityCapabilityProposal, { kind: 'grant-extra-turns' }>,
  ): boolean
  /** Commits a Host-derived rotatable-template direction for later movement constraints. */
  setDirectionalCommand(
    proposal: Extract<Dnd5eActivityCapabilityProposal, { kind: 'set-directional-command' }>,
  ): boolean
  /** Commits a Host-validated durable spell authority record. */
  establishSpellAuthority(
    proposal: Extract<Dnd5eActivityCapabilityProposal, { kind: 'establish-spell-authority' }>,
  ): boolean
  /** Applies a Host-validated transition to a durable spell authority record. */
  transitionSpellAuthority(
    proposal: Extract<Dnd5eActivityCapabilityProposal, { kind: 'transition-spell-authority' }>,
  ): boolean
  /** Removes only a bounded Activity effect instance selected by stable effect id. */
  removeEffectDefinition(targetId: string, effectId: string, source: 'self' | 'any'): boolean
  removeEffectsByTag?(targetId: string, tags: readonly string[], match: 'any' | 'all', source: 'self' | 'any', maximumCount?: number, sourceCreatureTypes?: readonly string[]): boolean
  adjustExhaustion?(targetId: string, amount: number): boolean
  lowerAbilityScore?(targetId: string, ability: import('../../../lib/dnd').AbilityKey, maximumScore: number, recoveryGroupId?: string): boolean
  recoverAbilityScore?(targetId: string, ability: import('../../../lib/dnd').AbilityKey, maximumCount?: number): boolean
  recoverHitPointMaximum?(targetId: string, maximumCount?: number): boolean
  /** Damage-free Host death transaction; returns true when the target is valid even if Death Ward intercepts it. */
  instantDeath?(targetId: string): boolean
  spendResource(resourceId: string, amount?: number): boolean
  restoreResource(resourceId: string, amount?: number): boolean
  /** Host-only turn movement mutation for unified Activity consumption. */
  spendMovement?(amount: number): boolean
  /** Host-derived unified Activity usage keys for the actor's current turn. */
  activityUsedTurnKeys?(): readonly string[]
  /** Records unified Activity once-per-turn requirements on the authoritative actor. */
  markActivityTurnUsage?(keys: readonly string[]): void
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
