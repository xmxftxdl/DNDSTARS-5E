import type { AbilityKey } from '../../../lib/dnd'
import type { Dnd5eStandardConditionId } from '../conditions'
import type { Dnd5eDamageType } from '../damageTypes'
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
  controller: string
  armorClass: number
  /** Tiny=0 through Gargantuan=5. */
  sizeRank?: number
  creatureType?: string
  illumination?: 'bright' | 'dim' | 'darkness' | 'magical-darkness'
  conditions: readonly Dnd5eStandardConditionId[]
  savingThrowModifiers?: Partial<Record<AbilityKey, number>>
  savingThrowProficiencies?: readonly AbilityKey[]
  activeEffectDefinitionIds?: readonly { definitionId: string; sourceActorId?: string }[]
  abilityCheckModifiers?: Partial<Record<AbilityKey, number>>
  /** Immutable Host equipment projection used only by closed Activity predicates. */
  equipment?: Dnd5eActivityEquipmentSnapshotV1
  spellcasting?: { capable: boolean; classIds: readonly string[] }
  successfulSpellSaveNegatesDamage?: boolean
  /** Spell damage dice of these types treat a natural 1 as 2. */
  elementalAdeptDamageTypes?: readonly Dnd5eDamageType[]
}

export type Dnd5eActivityRollMode = 'normal' | 'advantage' | 'disadvantage'

export interface Dnd5eActivityExecutionInput {
  activity: Dnd5eActivityDefinitionV1
  actor: Dnd5eActivityActorSnapshot
  targets: readonly Dnd5eActivityActorSnapshot[]
  castLevel?: number
  rolls: Readonly<Record<string, Dnd5eFormulaRollResult>>
  checkRollModes?: Readonly<Record<string, Dnd5eActivityRollMode>>
  distanceFeetByTargetId?: Readonly<Record<string, number>>
  areaPlacement?: Dnd5eActivityAreaPlacementV1
  areaPlacementDistanceFeet?: number
  projectileTargetIds?: readonly string[]
  parentDamageType?: Dnd5eDamageType
  choices?: Readonly<Record<string, string>>
  usedTurnKeys?: ReadonlySet<string>
  dmApproved?: boolean
  /** Host-owned event envelope. Never accept this object from a client payload. */
  triggerContext?: Dnd5eActivityTriggerContextV1
  confirmedBy?: Dnd5eActivityConfirmedByV1
}

export interface Dnd5eActivityCheckResult {
  key: string
  checkId: string
  targetId?: string
  /** The actual ability used after resolving a target-favorable ability choice. */
  ability?: AbilityKey
  d20: number
  modifier: number
  total: number
  success: boolean
  criticalSuccess: boolean
  criticalFailure: boolean
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
      damageOnFailure?: {
        count: number
        sides: number
        modifier?: number
        type: Dnd5eDamageType
      }
    }

export type Dnd5eActivityCapabilityProposal =
  | { kind: 'deal-damage'; operationId: string; targetId: string; amount: number; damageType: Dnd5eDamageType; magical: boolean }
  | { kind: 'heal'; operationId: string; targetId: string; amount: number }
  | { kind: 'grant-temporary-hit-points'; operationId: string; targetId: string; amount: number }
  | { kind: 'stabilize'; operationId: string; targetId: string }
  | { kind: 'stand-up'; operationId: string; targetId: string; usesTargetReactionIfAvailable: true }
  | { kind: 'apply-standard-condition'; operationId: string; targetId: string; condition: Dnd5eStandardConditionId; duration: Dnd5eResolvedEffectDuration }
  | {
      kind: 'apply-effect'
      operationId: string
      targetId: string
      effectId: string
      name: string
      duration: Dnd5eResolvedEffectDuration
      conditions: readonly Dnd5eStandardConditionId[]
      extensionCondition?: string
      modifierGroups: readonly Dnd5eActiveEffectModifiers[]
      breakOn?: readonly Dnd5eActiveEffectBreakTrigger[]
      sourceLink?: import('../activeEffects').Dnd5eActiveEffectRemoval['sourceLink']
      escapeCheck?: import('../activeEffects').Dnd5eActiveEffectEscapeCheck
      periodicDamage?: import('../activeEffects').Dnd5eActiveEffectPeriodicDamage
      magical?: boolean
      /** The Host owns concentration even when the effect also uses a repeat-save duration. */
      concentration: boolean
      stacking: Dnd5eActiveEffectStackingPolicy
      /** Remove the same effect previously applied by this source, even from a different target. */
      exclusiveBySource?: boolean
      exclusiveGroup?: string
    }
  | { kind: 'remove-standard-condition'; operationId: string; targetId: string; condition: Dnd5eStandardConditionId }
  | { kind: 'remove-effect'; operationId: string; targetId: string; effectId: string; source: 'self' | 'any' }
  | { kind: 'spend-resource' | 'restore-resource'; operationId: string; subjectId: string; resourceId: string; amount: number }
  | { kind: 'move'; operationId: string; targetId: string; mode: 'push' | 'pull' | 'teleport' | 'swap'; distanceFeet: number; placement?: 'host-automatic-maximum'; originIllumination?: readonly ('dim' | 'darkness' | 'magical-darkness')[]; destinationIllumination?: readonly ('dim' | 'darkness' | 'magical-darkness')[]; requiresLineOfSight?: boolean; ignoresOpportunityAttacks?: boolean; usesTargetReactionIfAvailable?: boolean; provokesOpportunityAttacks?: boolean }
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
    }
  | {
      kind: 'create-persistent-area'
      operationId: string
      label: string
      instanceCount?: number
      durationRounds: number
      concentration: boolean
      color?: string
      visual?: import('../persistentAreaTypes').Dnd5ePersistentAreaVisual
      utilityProjectionId?: string
      triggers?: readonly import('../persistentAreaTypes').Dnd5ePersistentAreaTriggerDeclaration[]
      movement?: import('../persistentAreaTypes').Dnd5ePersistentAreaMovementDeclaration
      lifecycle?: import('../persistentAreaTypes').Dnd5ePersistentAreaTurnLifecycle
      movementCostMultiplier?: number
      obscuration?: import('../persistentAreaTypes').Dnd5ePersistentAreaObscuration
      occupantModifiers?: import('../persistentAreaTypes').Dnd5ePersistentAreaOccupantModifiers
      blocking?: import('../persistentAreaTypes').Dnd5ePersistentAreaBlocking
      weaponHitBonusDamage?: import('../persistentAreaTypes').Dnd5ePersistentAreaWeaponHitBonusDamage
      grantedActivities?: readonly import('../persistentAreaTypes').Dnd5ePersistentAreaGrantedActivity[]
      areaInstance?: Dnd5eActivityAreaInstanceV1
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
      actions: readonly ('grapple' | 'shove')[]
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
    minimumDieValueByRollId,
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
    const actual = subject.creatureType.trim().toLocaleLowerCase()
    return predicate.types.some((type) => type.trim().toLocaleLowerCase() === actual)
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
  if (predicate.kind === 'target-identity') {
    if (!target) return false
    return predicate.identity === 'self' ? target.id === input.actor.id : target.id !== input.actor.id
  }
  if (predicate.kind === 'active-effect') {
    if (!subject) return false
    const present = subject.activeEffectDefinitionIds?.some((effect) =>
      effect.definitionId.includes(`:${predicate.effectId}`) &&
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
  const declaredMode = check.rollMode ?? 'normal'
  const baseMode = declaredMode === 'host-derived' ? input.checkRollModes?.[key] : declaredMode
  if (!baseMode) throw new Dnd5eFormulaEvaluationError(`missing Host roll mode: ${key}`)
  const modes = [baseMode, creatureTypeOverride, sizeRankOverride].filter(
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
  let resolvedAbility: AbilityKey | undefined
  if (check.kind === 'attack-roll') {
    if (!target) throw new Dnd5eFormulaEvaluationError(`attack target is unavailable: ${key}`)
    modifier = evaluateDnd5eFormulaV1(check.attackBonus, formulaContext(input, target))
    dc = target.armorClass
    success = d20 >= (check.criticalThreshold ?? 20) || (d20 !== 1 && d20 + modifier >= dc)
  } else if (check.kind === 'saving-throw') {
    if (!target) throw new Dnd5eFormulaEvaluationError(`saving throw target is unavailable: ${key}`)
    resolvedAbility = selectedSavingThrowAbility(target, check.ability, check.abilityOptions)
    modifier = savingThrowModifier(target, resolvedAbility)
    dc = evaluateDnd5eFormulaV1(check.dc, formulaContext(input, target))
    success = d20 + modifier >= dc
  } else {
    modifier = input.actor.abilityCheckModifiers?.[check.ability] ?? Math.floor((input.actor.abilities[check.ability] - 10) / 2)
    dc = evaluateDnd5eFormulaV1(check.dc, formulaContext(input, target))
    success = d20 + modifier >= dc
  }
  return {
    key,
    checkId: check.id,
    targetId: target?.id,
    ability: resolvedAbility,
    d20,
    modifier,
    total: d20 + modifier,
    success,
    criticalSuccess: d20 >= (check.kind === 'attack-roll' ? check.criticalThreshold ?? 20 : 20),
    criticalFailure: d20 === 1,
  }
}

function operationTargets(
  targetKind: Dnd5eActivityOperationTargetV1,
  input: Dnd5eActivityExecutionInput,
  currentTarget?: Dnd5eActivityActorSnapshot,
): readonly Dnd5eActivityActorSnapshot[] {
  if (targetKind === 'actor') return [input.actor]
  if (targetKind === 'all-targets') return input.targets
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
): number {
  const multipliers = critical && doubleDice
    ? Object.fromEntries(formulaDiceRollIds(formula).map((rollId) => [rollId, 2]))
    : undefined
  const minimums = minimumDieValue > 1
    ? Object.fromEntries(formulaDiceRollIds(formula).map((rollId) => [rollId, minimumDieValue]))
    : undefined
  return Math.max(0, Math.floor(evaluateDnd5eFormulaV1(
    formula,
    formulaContext(input, target, multipliers, minimums),
  )))
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
  }
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
  return !!check && (
    (condition.result === 'success' && check.success) ||
    (condition.result === 'failure' && !check.success) ||
    (condition.result === 'critical-success' && check.criticalSuccess) ||
    (condition.result === 'critical-failure' && check.criticalFailure)
  )
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
    } else if (modifier.kind === 'attack-roll') {
      if (modifier.mode === 'advantage') base.attackRollAdvantage = true
      if (modifier.mode === 'disadvantage') base.attackRollDisadvantage = true
    } else if (modifier.kind === 'attack-target-lock') {
      base.attackDisadvantageAgainstOthersThanSource = true
    } else if (modifier.kind === 'speed') {
      const value = evaluateDnd5eFormulaV1(modifier.value, evaluationContext)
      if (modifier.mode === 'multiply') base.speedMultiplier = Math.min(base.speedMultiplier ?? 1, value)
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
    } else if (modifier.kind === 'damage-resistance') {
      resistanceGroups.push({ damageResistance: modifier.damageType })
    } else if (modifier.kind === 'damage-immunity') {
      resistanceGroups.push({ damageImmunity: modifier.damageType })
    } else if (modifier.kind === 'damage-vulnerability') {
      resistanceGroups.push({ damageVulnerability: modifier.damageType })
    } else if (modifier.kind === 'condition-immunity') {
      base.conditionImmunities = [...new Set([...(base.conditionImmunities ?? []), modifier.condition])]
    } else if (modifier.kind === 'prohibit-reaction') {
      base.preventReactions = true
    } else if (modifier.kind === 'forced-flee-from-source') {
      base.preventReactions = true
      base.forcedFleeFromSource = true
    } else if (modifier.kind === 'maximum-attacks-per-turn') {
      base.maximumAttacksPerTurn = Math.min(base.maximumAttacksPerTurn ?? modifier.value, modifier.value)
    } else if (modifier.kind === 'darkvision') {
      base.darkvisionRangeFeet = Math.max(base.darkvisionRangeFeet ?? 0, modifier.rangeFeet)
    } else if (modifier.kind === 'flight-speed') {
      base.flySpeedFeet = Math.max(base.flySpeedFeet ?? 0, modifier.speedFeet)
    } else if (modifier.kind === 'see-invisible') {
      base.seeInvisible = true
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
    } else if (modifier.kind === 'movement-boundary-save') {
      base.movementBoundarySave = {
        maximumDistanceFeet: modifier.maximumDistanceFeet,
        ability: modifier.ability,
        dc: Math.max(1, Math.floor(evaluateDnd5eFormulaV1(modifier.dc, evaluationContext))),
      }
    }
  }
  const hasBaseModifiers = Object.values(base).some((value) => value != null)
  return {
    effectId: effect.id,
    name: effect.name,
    duration: effect.duration.kind === 'save-ends'
      ? {
          kind: 'save-ends' as const,
          maximumRounds: effect.duration.maximumRounds,
          timing: effect.duration.timing,
          ability: selectedSavingThrowAbility(target, effect.duration.ability, effect.duration.abilityOptions),
          dc: Math.max(1, Math.floor(evaluateDnd5eFormulaV1(effect.duration.dc, evaluationContext))),
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
        }
      : effect.duration,
    conditions: [...(effect.conditions ?? [])],
    extensionCondition: effect.extensionCondition,
    modifierGroups: [...(hasBaseModifiers || !(effect.conditions?.length) && resistanceGroups.length === 0 ? [base] : []), ...resistanceGroups],
    breakOn: effect.breakOn ? [...effect.breakOn] : undefined,
    sourceLink: effect.sourceLink ? { ...effect.sourceLink } : undefined,
    escapeCheck: effect.escapeCheck
      ? {
          ability: effect.escapeCheck.ability,
          skill: effect.escapeCheck.skill,
          alternativeAbility: effect.escapeCheck.alternativeAbility,
          alternativeSkill: effect.escapeCheck.alternativeSkill,
          dc: Math.max(1, Math.floor(evaluateDnd5eFormulaV1(effect.escapeCheck.dc, evaluationContext))),
          economy: 'action',
        }
      : undefined,
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
    magical: effect.periodicDamage?.magical === true,
    concentration: effect.concentration === true,
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
    }]
  }
  if (operation.kind === 'create-persistent-area') {
    return [{
      kind: 'create-persistent-area', operationId: operation.id, label: operation.label,
      instanceCount: operation.instanceCount,
      durationRounds: operation.durationRounds, concentration: operation.concentration,
      color: operation.color, visual: operation.visual,
      utilityProjectionId: operation.utilityProjectionId,
      triggers: operation.triggers?.map((trigger) => structuredClone(trigger)),
      movement: operation.movement ? { ...operation.movement } : undefined,
      lifecycle: operation.lifecycle ? structuredClone(operation.lifecycle) : undefined,
      movementCostMultiplier: operation.movementCostMultiplier,
      obscuration: operation.obscuration ? { ...operation.obscuration } : undefined,
      occupantModifiers: operation.occupantModifiers
        ? {
            ...operation.occupantModifiers,
            damageImmunities: operation.occupantModifiers.damageImmunities
              ? [...operation.occupantModifiers.damageImmunities]
              : undefined,
            damageResistances: operation.occupantModifiers.damageResistances
              ? [...operation.occupantModifiers.damageResistances]
              : undefined,
            conditionImmunities: operation.occupantModifiers.conditionImmunities
              ? [...operation.occupantModifiers.conditionImmunities]
              : undefined,
          }
        : undefined,
      blocking: operation.blocking ? { ...operation.blocking } : undefined,
      weaponHitBonusDamage: operation.weaponHitBonusDamage
        ? { ...operation.weaponHitBonusDamage }
        : undefined,
      grantedActivities: operation.grantedActivities?.map((grant) => ({ ...grant })),
      areaInstance: input.activity.target.kind === 'area' && input.areaPlacement
        ? {
            ...input.areaPlacement,
            origin: input.activity.target.origin,
            shape: input.activity.target.shape,
            radiusFeet: input.activity.target.radiusFeet,
            lengthFeet: input.activity.target.lengthFeet,
            widthFeet: input.activity.target.widthFeet,
            heightFeet: input.activity.target.heightFeet,
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
  return operationTargets(operation.target, input, currentTarget).map((target): Dnd5eActivityCapabilityProposal => {
    if (operation.kind === 'damage') {
      const damageType = operation.damageType === 'inherit-primary' ? input.parentDamageType : operation.damageType
      if (!damageType) throw new Dnd5eFormulaEvaluationError('parent damage type is unavailable')
      const elementalAdeptMinimum = input.activity.legacySource?.kind === 'spell' &&
        input.actor.elementalAdeptDamageTypes?.includes(damageType)
        ? 2
        : 1
      return {
        kind: 'deal-damage', operationId: operation.id, targetId: target.id,
        amount: evaluateAmount(
          operation.amount,
          input,
          target,
          critical,
          operation.critical === 'double-dice',
          elementalAdeptMinimum,
        ),
        damageType, magical: operation.magical === true,
      }
    }
    if (operation.kind === 'healing') return {
      kind: 'heal', operationId: operation.id, targetId: target.id,
      amount: evaluateAmount(operation.amount, input, target, false, false),
    }
    if (operation.kind === 'temporary-hit-points') return {
      kind: 'grant-temporary-hit-points', operationId: operation.id, targetId: target.id,
      amount: evaluateAmount(operation.amount, input, target, false, false),
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
    }
    if (operation.kind === 'move') return {
      kind: 'move', operationId: operation.id, targetId: target.id, mode: operation.mode,
      distanceFeet: evaluateAmount(operation.distanceFeet, input, target, false, false),
      placement: operation.placement,
      originIllumination: operation.originIllumination,
      destinationIllumination: operation.destinationIllumination,
      requiresLineOfSight: operation.requiresLineOfSight,
      ignoresOpportunityAttacks: operation.ignoresOpportunityAttacks,
      usesTargetReactionIfAvailable: operation.usesTargetReactionIfAvailable,
      provokesOpportunityAttacks: operation.provokesOpportunityAttacks,
    }
    if (operation.kind === 'remove-effect') return {
      kind: 'remove-effect', operationId: operation.id, targetId: target.id,
      effectId: operation.effectId, source: operation.source,
    }
    throw new Dnd5eFormulaEvaluationError(`unsupported Activity operation: ${operation.kind}`)
  })
}

export function resolveDnd5eActivity(input: Dnd5eActivityExecutionInput): Dnd5eActivityExecutionResult {
  const definitionErrors = validateDnd5eActivityDefinitionV1(input.activity)
  if (definitionErrors.length) return { ok: false, reason: 'invalid-definition', details: definitionErrors }
  const scaled = scaleActivity(input)
  const activity = scaled.activity
  const resolvedChoices: Record<string, string> = {}
  const knownChoiceIds = new Set([
    ...(activity.choices ?? []).map((choice) => choice.id),
    ...(activity.requirements ?? []).flatMap((requirement) => requirement.kind === 'choice' ? [requirement.choiceId] : []),
  ])
  if (Object.keys(input.choices ?? {}).some((choiceId) => !knownChoiceIds.has(choiceId))) {
    return { ok: false, reason: 'requirement-failed', details: ['unknown Activity choice'] }
  }
  for (const choice of activity.choices ?? []) {
    const selected = input.choices?.[choice.id] ?? choice.defaultOptionId
    if (!selected || !choice.options.some((option) => option.id === selected)) {
      return { ok: false, reason: 'requirement-failed', details: [`missing or invalid Activity choice: ${choice.id}`] }
    }
    resolvedChoices[choice.id] = selected
  }
  const executionInput: Dnd5eActivityExecutionInput = {
    ...input, activity,
    choices: Object.keys(resolvedChoices).length > 0 ? resolvedChoices : input.choices,
  }
  if (!input.actor.id || input.actor.level < 1 || input.actor.armorClass < 0) {
    return { ok: false, reason: 'invalid-actor', details: ['invalid actor snapshot'] }
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
    const resolveDimension = (selected: number | undefined, minimum: number | undefined, maximum: number | undefined) => {
      if (maximum == null) return selected == null ? undefined : null
      const value = selected ?? maximum
      const lower = minimum ?? maximum
      return Number.isFinite(value) && Number.isInteger(value) && value % 5 === 0 && value >= lower && value <= maximum
        ? value
        : null
    }
    const radiusFeet = resolveDimension(input.areaPlacement.radiusFeet, activity.target.minimumRadiusFeet, activity.target.radiusFeet)
    const lengthFeet = resolveDimension(input.areaPlacement.lengthFeet, activity.target.minimumLengthFeet, activity.target.lengthFeet)
    const widthFeet = resolveDimension(input.areaPlacement.widthFeet, activity.target.minimumWidthFeet, activity.target.widthFeet)
    const heightFeet = resolveDimension(input.areaPlacement.heightFeet, activity.target.minimumHeightFeet, activity.target.heightFeet)
    if ([radiusFeet, lengthFeet, widthFeet, heightFeet].some((value) => value === null)) {
      return { ok: false, reason: 'invalid-target', details: ['area dimensions are invalid'] }
    }
    areaInstance = {
      ...input.areaPlacement,
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
    const checks: Dnd5eActivityCheckResult[] = []
    for (const check of activity.checks ?? []) {
      if (check.scope === 'per-target') input.targets.forEach((target) => checks.push(resolveCheck(check, executionInput, target)))
      else checks.push(resolveCheck(check, executionInput, input.targets[0]))
    }
    const proposals: Dnd5eActivityCapabilityProposal[] = []
    const appliedOnce = new Set<string>()
    for (const outcome of activity.outcomes) {
      const resolvedProjectileTargets = projectileTargets?.filter((target): target is Dnd5eActivityActorSnapshot => target != null)
      const candidateTargets = resolvedProjectileTargets?.length ? resolvedProjectileTargets : input.targets.length ? input.targets : [undefined]
      for (const target of candidateTargets) {
        const when = outcome.when
        const applies = when.kind === 'always' || (when.kind === 'all'
          ? when.conditions.every((condition) => outcomeConditionApplies(condition, checks, executionInput.choices, target, executionInput))
          : outcomeConditionApplies(when, checks, executionInput.choices, target, executionInput))
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
          const once = operation.kind === 'summon' || operation.kind === 'create-persistent-area' ||
            operation.kind === 'grant-weapon-attack' || operation.kind === 'grant-basic-action' ||
            operation.kind === 'invoke-activity' || operation.kind === 'manual-adjudication' ||
            ('target' in operation && (operation.target === 'actor' || operation.target === 'all-targets'))
          const onceKey = `${outcome.id}:${operation.id}`
          if (once && appliedOnce.has(onceKey)) continue
          const repeats = input.projectileTargetIds?.length
            ? 1
            : 1 + Math.max(0, scaled.additionalProjectilesByOperationId.get(operation.id) ?? 0)
          for (let repeat = 0; repeat < repeats; repeat += 1) {
            operationProposals(operation, executionInput, target, criticalSuccess)
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
      consumptions: (activity.consumption ?? []).map((consumption) => resolveConsumption(consumption, executionInput)),
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
