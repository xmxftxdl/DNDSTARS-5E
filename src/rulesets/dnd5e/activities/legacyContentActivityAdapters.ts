import { automationCapabilityFromLegacyStatus, type AutomationCapability } from '../../../domain/automation/automationCapability'
import type { SkillAoeTargeting } from '../../../lib/skillTargeting'
import type {
  DeclarativeDiceFormulaV1,
  DeclarativeSubclassAbilityV1,
  DeclarativeSubclassDurationV1,
  DeclarativeSubclassTargetingV1,
  DeclarativeValueFormulaV1,
} from '../declarativeSubclassAbility'
import type {
  Dnd5eMonsterAction,
  Dnd5eMonsterDamage,
  Dnd5eMonsterFailedSaveCondition,
  Dnd5eMonsterStatBlock,
} from '../monsters'
import { dnd5eMonsterAreaSavingThrowEffect } from '../monsters'
import type {
  Dnd5ePluginActionEconomy,
  Dnd5ePluginAutomationLevel,
  Dnd5ePluginFeatureAction,
  Dnd5ePluginFeatureDefinition,
  Dnd5ePluginItemDefinition,
  Dnd5ePluginSpellDefinition,
  Dnd5ePluginTargeting,
} from '../pluginApi'
import type { Dnd5eImportedSpell } from '../spellbook'
import type { Dnd5eSpellConditionDuration } from '../spellMechanics'
import type {
  Dnd5eActivityActivationV1,
  Dnd5eActivityCheckV1,
  Dnd5eActivityConsumptionV1,
  Dnd5eActivityDefinitionV1,
  Dnd5eActivityOperationV1,
  Dnd5eActivityOutcomeV1,
  Dnd5eActivityScalingV1,
  Dnd5eActivityTargetV1,
} from './dnd5eActivityContracts'
import type { Dnd5eEffectDurationV1, Dnd5ePredicateV1, Dnd5eTriggerEventV1 } from './dnd5eEffectContracts'
import type { Dnd5eFormulaV1 } from './dnd5eFormula'

type SpellActivitySource = Pick<
  Dnd5eImportedSpell,
  'id' | 'name' | 'description' | 'level' | 'castingTime' | 'range' | 'targeting' | 'duration' | 'mechanics'
>

export type Dnd5eLegacyMonsterActionCollection =
  | 'actions'
  | 'bonusActions'
  | 'reactions'
  | 'legendaryActions'
  | 'lairActions'

const constant = (value: number): Dnd5eFormulaV1 => ({ kind: 'constant', value })
const reference = (kind: Extract<Dnd5eFormulaV1, { kind: 'reference' }>['reference']['kind']): Dnd5eFormulaV1 =>
  ({ kind: 'reference', reference: { kind } as Extract<Dnd5eFormulaV1, { kind: 'reference' }>['reference'] })

function add(values: readonly Dnd5eFormulaV1[]): Dnd5eFormulaV1 {
  const filtered = values.filter((value) => value.kind !== 'constant' || value.value !== 0)
  if (filtered.length === 0) return constant(0)
  if (filtered.length === 1) return filtered[0]!
  return { kind: 'add', values: filtered }
}

function multiply(value: Dnd5eFormulaV1, amount: number): Dnd5eFormulaV1 {
  if (amount === 1) return value
  return { kind: 'multiply', values: [value, constant(amount)] }
}

function diceFormula(
  rollId: string,
  dice: Pick<Dnd5eMonsterDamage, 'count' | 'sides' | 'bonus'>,
  extra: readonly Dnd5eFormulaV1[] = [],
): Dnd5eFormulaV1 {
  return add([
    { kind: 'dice', rollId, count: dice.count, sides: dice.sides },
    constant(dice.bonus),
    ...extra,
  ])
}

function capability(
  requested: 'full' | 'partial' | 'manual' | 'reference-only',
  limitations: readonly string[] = [],
): AutomationCapability {
  if (requested === 'full' && limitations.length > 0) {
    return automationCapabilityFromLegacyStatus('partial', limitations)
  }
  return automationCapabilityFromLegacyStatus(requested, limitations)
}

function manualOperation(id: string, prompt: string, reason: string): Dnd5eActivityOperationV1 {
  return { id, kind: 'manual-adjudication', prompt, reason, requiresDmApproval: true }
}

function economyActivation(economy: Dnd5ePluginActionEconomy): Dnd5eActivityActivationV1 {
  if (economy === 'bonusAction') return { kind: 'bonus-action', cost: 1 }
  if (economy === 'reaction') return { kind: 'reaction', cost: 1 }
  if (economy === 'none') return { kind: 'free', cost: 0 }
  return { kind: 'action', cost: 1 }
}

function actionEconomyConsumption(economy: Dnd5ePluginActionEconomy): Dnd5eActivityConsumptionV1[] | undefined {
  if (economy === 'none') return undefined
  return [{
    kind: 'action-economy',
    economy: economy === 'bonusAction' ? 'bonus-action' : economy,
    amount: 1,
    consumeOn: 'resolve',
  }]
}

function aoeTarget(template: SkillAoeTargeting, relation: 'ally' | 'enemy' | 'any', includeSelf: boolean, maximumTargets: number): Dnd5eActivityTargetV1 {
  if (template.shape === 'circle') return {
    kind: 'area', relation, origin: template.origin, shape: 'circle', radiusFeet: template.radiusFeet,
    placeRangeFeet: template.placeRangeFeet, maximumTargets, includeSelf,
  }
  if (template.shape === 'rect') return {
    kind: 'area', relation, origin: 'point', shape: 'rect',
    lengthFeet: template.heightFeet, widthFeet: template.widthFeet, heightFeet: 5,
    placeRangeFeet: template.placeRangeFeet, maximumTargets, includeSelf,
    rotatable: template.rotatable,
  }
  if (template.shape === 'line') return {
    kind: 'area', relation, origin: 'self', shape: 'line', lengthFeet: template.lengthFeet,
    widthFeet: template.widthFeet, placeRangeFeet: template.aimRangeFeet, maximumTargets, includeSelf,
  }
  return {
    kind: 'area', relation, origin: 'self', shape: 'cone', lengthFeet: template.lengthFeet,
    placeRangeFeet: template.aimRangeFeet, maximumTargets, includeSelf,
  }
}

function pluginTarget(targeting: Dnd5ePluginTargeting): Dnd5eActivityTargetV1 {
  if (targeting.kind === 'self') return { kind: 'self' }
  if (targeting.kind === 'single-creature') return {
    kind: 'creature', relation: targeting.relation ?? 'any', count: 1,
    rangeFeet: targeting.rangeFeet, includeSelf: targeting.includeSelf ?? false,
  }
  return aoeTarget(
    targeting.template,
    targeting.relation ?? 'any',
    targeting.includeSelf ?? false,
    targeting.maximumTargets ?? 64,
  )
}

function spellActivation(spell: SpellActivitySource): Dnd5eActivityActivationV1 {
  const { unit, value, reactionTrigger } = spell.castingTime
  if (unit === 'action') return { kind: 'action', cost: value }
  if (unit === 'bonus-action') return { kind: 'bonus-action', cost: value }
  if (unit === 'reaction') return { kind: 'reaction', cost: value, reactionEvent: reactionTrigger }
  return { kind: unit, value }
}

function spellTarget(spell: SpellActivitySource): Dnd5eActivityTargetV1 {
  const range = spell.range
  const relation = spell.targeting?.relation ?? 'any'
  const includeSelf = spell.targeting?.includeSelf ?? range.type === 'self'
  const maximumTargets = spell.targeting?.maximumTargets ?? 256
  if (!range.shape) {
    if (range.type === 'self') return { kind: 'self' }
    return {
      kind: 'creature', relation, count: maximumTargets,
      rangeFeet: range.type === 'touch' ? 5 : range.type === 'distance' ? range.feet : undefined,
      includeSelf,
    }
  }
  const shape = range.shape === 'radius' ? 'circle' : range.shape
  const origin = range.type === 'self' ? 'self' : 'point'
  const size = range.sizeFeet ?? 5
  if (shape === 'circle' || shape === 'sphere' || shape === 'cylinder') return {
    kind: 'area', relation, origin, shape, radiusFeet: size,
    heightFeet: shape === 'cylinder' ? range.heightFeet ?? size : undefined,
    placeRangeFeet: origin === 'point' ? range.feet : undefined,
    maximumTargets, includeSelf,
  }
  if (shape === 'cone') return {
    kind: 'area', relation, origin, shape, lengthFeet: size,
    placeRangeFeet: origin === 'point' ? range.feet : undefined,
    maximumTargets, includeSelf,
  }
  if (shape === 'line') return {
    kind: 'area', relation, origin, shape, lengthFeet: size, widthFeet: range.widthFeet ?? 5,
    placeRangeFeet: origin === 'point' ? range.feet : undefined,
    maximumTargets, includeSelf,
  }
  if (shape === 'rect') return {
    kind: 'area', relation, origin, shape, lengthFeet: size,
    widthFeet: range.widthFeet ?? size, heightFeet: range.heightFeet ?? 5,
    placeRangeFeet: origin === 'point' ? range.feet : undefined,
    maximumTargets, includeSelf, rotatable: origin === 'point' ? range.rotatable ?? true : false,
  }
  return {
    kind: 'area', relation, origin, shape: 'cube', lengthFeet: size, widthFeet: size, heightFeet: size,
    placeRangeFeet: origin === 'point' ? range.feet : undefined,
    maximumTargets, includeSelf,
  }
}

function spellConditionDuration(duration: Dnd5eSpellConditionDuration): Dnd5eEffectDurationV1 {
  if (duration.kind === 'source-next-turn-start') return { kind: 'rounds', rounds: 1, expiresAt: 'source-turn-start' }
  if (duration.kind === 'target-next-turn-start') return { kind: 'rounds', rounds: 1, expiresAt: 'target-turn-start' }
  if (duration.kind === 'fixed-rounds') return { kind: 'rounds', rounds: duration.rounds, expiresAt: 'target-turn-end' }
  if (duration.kind === 'concentration') return { kind: 'concentration', maximumRounds: 14_400 }
  return {
    kind: 'save-ends', maximumRounds: duration.maximumRounds, timing: duration.timing,
    ability: duration.saveAbility, dc: reference('actor-spell-save-dc'),
  }
}

function half(formula: Dnd5eFormulaV1): Dnd5eFormulaV1 {
  return { kind: 'floor', value: multiply(formula, 0.5) }
}

function perTargetSpellOperation(operation: Dnd5eActivityOperationV1): Dnd5eActivityOperationV1 {
  if (!('target' in operation) || operation.target !== 'all-targets') return operation
  return { ...operation, target: 'target' }
}

function successfulSaveOperation(
  operation: Dnd5eActivityOperationV1,
  onSuccess: 'none' | 'half' | 'full',
): Dnd5eActivityOperationV1 | undefined {
  if (onSuccess === 'none') return undefined
  const targeted = perTargetSpellOperation(operation)
  if (onSuccess !== 'half' || targeted.kind !== 'damage') {
    return { ...targeted, id: `${targeted.id}-save-success` }
  }
  return {
    ...targeted,
    id: `${targeted.id}-save-success`,
    amount: half(targeted.amount),
  }
}

/**
 * A linked legacy Headless action describes effects, not whether a spell hit.
 * Preserve the owning spell's attack/save gate and make per-target saves truly
 * per-target instead of allowing the first target to gate an all-targets effect.
 */
function linkedSpellOutcomes(
  linkedActivity: Dnd5eActivityDefinitionV1,
  mechanics: SpellActivitySource['mechanics'],
  checkId: string | undefined,
): Dnd5eActivityOutcomeV1[] {
  if (!checkId || !mechanics || mechanics.resolution === 'automatic' || mechanics.resolution === 'dm-adjudication') {
    return linkedActivity.outcomes.map((outcome) => ({
      ...outcome,
      operations: outcome.operations.map(perTargetSpellOperation),
    }))
  }
  const gated: Dnd5eActivityOutcomeV1[] = []
  for (const outcome of linkedActivity.outcomes) {
    if (outcome.when.kind !== 'always') {
      gated.push({ ...outcome, operations: outcome.operations.map(perTargetSpellOperation) })
      continue
    }
    const primaryResult = mechanics.resolution === 'spell-attack' ? 'success' : 'failure'
    gated.push({
      ...outcome,
      id: `${outcome.id}-${primaryResult}`,
      when: { kind: 'check', checkId, result: primaryResult },
      operations: outcome.operations.map(perTargetSpellOperation),
    })
    if (mechanics.resolution === 'saving-throw' && mechanics.savingThrow?.onSuccess !== 'none') {
      const successfulOperations = outcome.operations
        .map((operation) => successfulSaveOperation(operation, mechanics.savingThrow!.onSuccess))
        .filter((operation): operation is Dnd5eActivityOperationV1 => operation != null)
      if (successfulOperations.length) gated.push({
        id: `${outcome.id}-success`,
        when: { kind: 'check', checkId, result: 'success' },
        operations: successfulOperations,
      })
    }
  }
  return gated
}

/** Projects structured spell mechanics into the shared Activity IR. */
export function dnd5eActivityFromSpellDefinition(
  spell: SpellActivitySource | Dnd5ePluginSpellDefinition,
  automationMode: 'headless-action' | 'reference-only' = 'reference-only',
  linkedActivity?: Dnd5eActivityDefinitionV1,
): Dnd5eActivityDefinitionV1 {
  const checks: Dnd5eActivityCheckV1[] = []
  const failure: Dnd5eActivityOperationV1[] = []
  const success: Dnd5eActivityOperationV1[] = []
  const always: Dnd5eActivityOperationV1[] = []
  const limitations: string[] = []
  const mechanics = spell.mechanics
  let checkId: string | undefined
  if (mechanics?.resolution === 'spell-attack') {
    checkId = 'spell-attack'
    checks.push({
      id: checkId, kind: 'attack-roll', rollId: 'spell-attack-d20',
      attackBonus: reference('actor-spell-attack-bonus'), rollMode: 'host-derived', scope: 'per-target',
    })
  } else if (mechanics?.resolution === 'saving-throw' && mechanics.savingThrow) {
    const savingThrow = mechanics.savingThrow
    checkId = 'spell-save'
    checks.push({
      id: checkId, kind: 'saving-throw', rollId: 'spell-save-d20', ability: savingThrow.ability,
      dc: reference('actor-spell-save-dc'), rollMode: 'host-derived', scope: 'per-target',
    })
  }
  if (mechanics?.damage) {
    const amount = diceFormula('spell-damage', mechanics.damage.dice, mechanics.damage.addSpellcastingModifier
      ? [reference('actor-spellcasting-ability-modifier')]
      : [])
    const operation: Dnd5eActivityOperationV1 = {
      id: 'spell-damage', kind: 'damage', target: 'target', amount,
      damageType: mechanics.damage.type, critical: mechanics.resolution === 'spell-attack' ? 'double-dice' : 'normal', magical: true,
    }
    if (mechanics.resolution === 'spell-attack' || mechanics.resolution === 'saving-throw') failure.push(operation)
    else always.push(operation)
    const savingThrow = mechanics.resolution === 'saving-throw' ? mechanics.savingThrow : undefined
    if (savingThrow && savingThrow.onSuccess !== 'none') {
      success.push({ ...operation, id: 'spell-damage-save-success', amount: savingThrow.onSuccess === 'half' ? half(amount) : amount })
    }
  }
  for (const [index, condition] of (mechanics?.conditions ?? []).entries()) {
    const operation: Dnd5eActivityOperationV1 = {
      id: `spell-condition-${index}`, kind: 'apply-standard-condition', target: 'target',
      condition: condition.condition, duration: spellConditionDuration(condition.duration),
    }
    if (condition.trigger === 'always') always.push(operation)
    else failure.push(operation)
  }
  if ((!mechanics || mechanics.resolution === 'dm-adjudication') && !linkedActivity) {
    limitations.push('法术没有可由通用 Activity 安全执行的结构化机械。')
  }
  if (mechanics?.kind === 'healing' && failure.length + success.length + always.length === 0 && !linkedActivity) {
    limitations.push('旧法术 mechanics 未声明治疗公式。')
  }
  if (failure.length + success.length + always.length === 0 && !linkedActivity) {
    always.push(manualOperation('spell-manual', '请由 DM 结算此法术。', limitations.join(' ') || '缺少结构化法术效果。'))
  }
  const outcomes: Dnd5eActivityOutcomeV1[] = []
  if (always.length) outcomes.push({ id: 'always', when: { kind: 'always' }, operations: always })
  if (failure.length && checkId) outcomes.push({ id: 'check-failure', when: { kind: 'check', checkId, result: mechanics?.resolution === 'spell-attack' ? 'success' : 'failure' }, operations: failure })
  if (success.length && checkId) outcomes.push({ id: 'check-success', when: { kind: 'check', checkId, result: 'success' }, operations: success })
  const cantripScaling = mechanics?.damage?.cantripScaling
  const damageOperationIds = mechanics?.damage
    ? ['spell-damage', ...(mechanics.resolution === 'saving-throw' && mechanics.savingThrow?.onSuccess !== 'none'
      ? ['spell-damage-save-success']
      : [])]
    : []
  const conditionOperationIds = (mechanics?.conditions ?? []).flatMap((condition, index) =>
    condition.duration.kind === 'fixed-rounds' || condition.duration.kind === 'save-ends'
      ? [`spell-condition-${index}`]
      : [])
  const upcastAdjustments: NonNullable<Dnd5eActivityScalingV1['adjustments']>[number][] = []
  for (const effect of mechanics?.upcast?.effects ?? []) {
    if (effect.kind === 'damage-dice' || effect.kind === 'flat-damage' || effect.kind === 'additional-projectiles') {
      if (damageOperationIds.length === 0) {
        limitations.push(`升环效果 ${effect.kind} 缺少可缩放的主要伤害组件。`)
        continue
      }
      upcastAdjustments.push(...damageOperationIds.map((operationId) => ({
        operationId,
        ...(effect.kind === 'damage-dice' ? { diceCountPerStep: effect.diceCountPerSlot } : {}),
        ...(effect.kind === 'flat-damage' ? { flatAmountPerStep: effect.amountPerSlot } : {}),
        ...(effect.kind === 'additional-projectiles' ? { additionalProjectilesPerStep: effect.countPerSlot } : {}),
      })))
    } else if (effect.kind === 'additional-targets') {
      const operationId = damageOperationIds[0] ?? conditionOperationIds[0]
      if (operationId) upcastAdjustments.push({ operationId, additionalTargetsPerStep: effect.countPerSlot })
      else limitations.push('升环额外目标缺少可作用的结构化效果。')
    } else if (conditionOperationIds.length > 0) {
      upcastAdjustments.push(...conditionOperationIds.map((operationId) => ({
        operationId, durationRoundsPerStep: effect.roundsPerSlot,
      })))
    } else {
      limitations.push('升环持续轮数缺少固定轮数或豁免结束的状态效果。')
    }
  }
  const scaling = mechanics?.upcast && upcastAdjustments.length > 0 ? [{
    basis: 'slot-level' as const,
    baseLevel: mechanics.upcast.fromSlotLevel,
    adjustments: upcastAdjustments,
  }] : cantripScaling === true ? [{
    basis: 'custom-table' as const,
    table: [{ level: 1, value: 0 }, { level: 5, value: 1 }, { level: 11, value: 2 }, { level: 17, value: 3 }],
    adjustments: [{ operationId: 'spell-damage', diceCountPerStep: mechanics?.damage?.dice.count ?? 1 }],
  }] : cantripScaling ? cantripScaling.steps.map((step) => ({
    basis: 'custom-table' as const,
    table: [{ level: 1, value: 0 }, { level: step.level, value: 1 }],
    adjustments: [{
      operationId: 'spell-damage',
      ...(step.diceCount > 0 ? { diceCountPerStep: step.diceCount } : {}),
      ...((step.flatDamage ?? 0) > 0 ? { flatAmountPerStep: step.flatDamage } : {}),
    }],
  })) : undefined
  const requested = automationMode === 'headless-action' ? 'full' : 'reference-only'
  return {
    schemaVersion: 1,
    id: `spell:${spell.id}`,
    name: spell.name,
    description: spell.description,
    activation: spellActivation(spell),
    target: spellTarget(spell),
    consumption: [
      ...(spell.level > 0 ? [{ kind: 'spell-slot' as const, minimumLevel: spell.level, level: 'selected' as const, amount: 1 as const, consumeOn: 'resolve' as const }] : []),
      ...((spell.castingTime.unit === 'action' || spell.castingTime.unit === 'bonus-action' || spell.castingTime.unit === 'reaction')
        ? [{ kind: 'action-economy' as const, economy: spell.castingTime.unit, amount: 1 as const, consumeOn: 'resolve' as const }]
        : []),
    ],
    requirements: linkedActivity?.requirements,
    checks: linkedActivity
      ? [...checks, ...(linkedActivity.checks ?? []).filter((linkedCheck) => !checks.some((check) => check.id === linkedCheck.id))]
      : checks,
    outcomes: linkedActivity ? linkedSpellOutcomes(linkedActivity, mechanics, checkId) : outcomes,
    effects: linkedActivity?.effects,
    triggers: linkedActivity?.triggers,
    scaling: scaling ?? linkedActivity?.scaling,
    automation: capability(requested, requested === 'reference-only' ? [] : limitations),
    legacySource: { kind: 'spell', id: spell.id },
  }
}

function featureActionOperations(action: Dnd5ePluginFeatureAction): Dnd5eActivityOperationV1[] {
  const operations: Dnd5eActivityOperationV1[] = []
  if (action.summon) operations.push({
    id: 'summon', kind: 'summon', monsterId: action.summon.monsterId, count: constant(1),
    timing: 'immediate', durationRounds: action.summon.durationRounds,
    concentration: action.summon.concentration ?? false, side: action.summon.side ?? 'ally',
  })
  if (action.persistentArea) operations.push({
    id: 'persistent-area', kind: 'create-persistent-area', label: action.persistentArea.label,
    durationRounds: action.persistentArea.durationRounds, concentration: action.persistentArea.concentration ?? false,
    color: action.persistentArea.color, visual: action.persistentArea.visual,
  })
  return operations
}

/** Binds a legacy feature's activation/target declaration to a shared Activity recipe. */
export function dnd5eActivityFromPluginFeature(
  feature: Dnd5ePluginFeatureDefinition,
  linkedActivity?: Dnd5eActivityDefinitionV1,
  identityKind: 'feature' | 'feat' = 'feature',
): Dnd5eActivityDefinitionV1 | undefined {
  if (!feature.action) return undefined
  const mapOperations = featureActionOperations(feature.action)
  const limitations = [...(feature.automationReasons ?? [])]
  if (!linkedActivity && mapOperations.length === 0) limitations.push('特性引用的旧 Headless 行动配方未找到。')
  const outcomes = linkedActivity?.outcomes.map((outcome) => ({ ...outcome, operations: [...outcome.operations] })) ?? [{
    id: 'resolve', when: { kind: 'always' as const }, operations: mapOperations.length
      ? mapOperations
      : [manualOperation('feature-manual', '请由 DM 结算此特性。', limitations.join(' '))],
  }]
  if (linkedActivity && mapOperations.length) {
    outcomes.push({ id: 'map-effects', when: { kind: 'always' }, operations: mapOperations })
  }
  return {
    ...(linkedActivity ?? {
      schemaVersion: 1 as const,
      requirements: undefined,
      checks: undefined,
      effects: undefined,
      triggers: undefined,
      scaling: undefined,
    }),
    id: `${identityKind}:${feature.id}`,
    name: feature.name,
    description: feature.description,
    activation: economyActivation(feature.action.economy),
    target: pluginTarget(feature.action.targeting),
    consumption: actionEconomyConsumption(feature.action.economy),
    outcomes,
    automation: capability(feature.automation, limitations),
    legacySource: { kind: identityKind, id: feature.id },
  }
}

/** Projects ordinary consumable-item use; passive equipment remains Effect data. */
export function dnd5eActivityFromPluginItem(
  item: Dnd5ePluginItemDefinition,
): Dnd5eActivityDefinitionV1 | undefined {
  if (!item.use && !item.headlessEffects?.length) return undefined
  const use = item.use
  const limitations: string[] = []
  const operations: Dnd5eActivityOperationV1[] = []
  if (use?.effect.kind === 'healing') operations.push({
    id: 'item-healing', kind: 'healing', target: 'target', amount: diceFormula('item-healing', use.effect.dice),
  })
  if (use?.effect.kind === 'dm-adjudication') {
    limitations.push('物品效果明确要求 DM 裁定。')
    operations.push(manualOperation('item-manual', use.effect.adjudication, limitations[0]!))
  }
  if (item.headlessEffects?.length) limitations.push('物品的触发式 Headless 效果继续由现有物品事务处理。')
  if (!operations.length) operations.push(manualOperation(
    'item-trigger-manual', '请使用现有物品 Headless 事务结算该触发效果。', limitations.join(' '),
  ))
  let target: Dnd5eActivityTargetV1 = { kind: 'self' }
  if (use?.targeting?.kind === 'creature') target = {
    kind: 'creature', relation: 'any', count: 1, rangeFeet: use.targeting.rangeFeet,
    includeSelf: use.targeting.includeSelf ?? false,
  }
  if (use?.targeting?.kind === 'map-area') target = {
    kind: 'area', relation: 'any', origin: 'point', shape: 'rect',
    lengthFeet: use.targeting.heightFeet, widthFeet: use.targeting.widthFeet, heightFeet: 5,
    placeRangeFeet: use.targeting.rangeFeet, maximumTargets: 256, includeSelf: true, rotatable: true,
  }
  const economy = use?.economy ?? 'none'
  const consumption: Dnd5eActivityConsumptionV1[] = [...(actionEconomyConsumption(economy) ?? [])]
  if (use) consumption.push({
    kind: 'item-charge',
    resourceId: use.chargesPerItem ? `item:${item.id}:charges` : `item:${item.id}:quantity`,
    amount: constant(use.consumeQuantity), consumeOn: 'resolve',
  })
  const manual = use?.effect.kind === 'dm-adjudication' || !use
  return {
    schemaVersion: 1,
    id: `item:${item.id}:use`,
    name: item.name,
    description: item.description,
    activation: economyActivation(economy),
    target,
    consumption,
    outcomes: [{ id: 'resolve', when: { kind: 'always' }, operations }],
    automation: capability(manual ? 'manual' : 'full', limitations),
    legacySource: { kind: 'item', id: item.id },
  }
}

function declarativeValueFormula(value: DeclarativeValueFormulaV1): Dnd5eFormulaV1 {
  if (value.kind === 'fixed') return constant(value.value)
  let formula: Dnd5eFormulaV1
  if (value.kind === 'proficiency-bonus') formula = reference('actor-proficiency-bonus')
  else if (value.kind === 'ability-modifier') formula = { kind: 'reference', reference: { kind: 'actor-ability-modifier', ability: value.ability } }
  else {
    formula = { kind: 'reference', reference: { kind: 'actor-class-level', classId: value.classId } }
    if (value.divisor && value.divisor !== 1) formula = { kind: 'floor', value: multiply(formula, 1 / value.divisor) }
  }
  formula = multiply(formula, value.multiplier ?? 1)
  return value.minimum == null ? formula : { kind: 'maximum', values: [formula, constant(value.minimum)] }
}

function declarativeDiceFormula(id: string, value: DeclarativeDiceFormulaV1): Dnd5eFormulaV1 {
  return add([
    { kind: 'dice', rollId: id, count: value.count, sides: value.sides },
    ...(value.modifier ? [declarativeValueFormula(value.modifier)] : []),
  ])
}

function declarativeDuration(duration: DeclarativeSubclassDurationV1): Dnd5eEffectDurationV1 {
  if (duration.kind === 'instantaneous') return { kind: 'instantaneous' }
  if (duration.kind === 'permanent') return { kind: 'permanent' }
  if (duration.kind === 'concentration') return { kind: 'concentration', maximumRounds: duration.rounds }
  if (duration.kind === 'fixed-rounds' && duration.repeatSave) return {
    kind: 'save-ends', maximumRounds: duration.rounds, timing: 'target-turn-end', ability: duration.repeatSave.ability,
    dc: constant(duration.repeatSave.dc),
  }
  if (duration.kind === 'fixed-rounds') return { kind: 'rounds', rounds: duration.rounds, expiresAt: 'target-turn-end' }
  if (duration.kind === 'until-source-turn-start') return { kind: 'rounds', rounds: 1, expiresAt: 'source-turn-start' }
  if (duration.kind === 'until-source-turn-end') return { kind: 'rounds', rounds: 1, expiresAt: 'source-turn-end' }
  if (duration.kind === 'until-target-turn-start') return { kind: 'rounds', rounds: 1, expiresAt: 'target-turn-start' }
  return { kind: 'rounds', rounds: duration.rounds ?? 1, expiresAt: 'target-turn-end' }
}

function declarativeTarget(targeting: DeclarativeSubclassTargetingV1): Dnd5eActivityTargetV1 {
  if (targeting.kind === 'self') return { kind: 'self' }
  if (targeting.kind === 'single-creature' || targeting.kind === 'multiple-creatures') return {
    kind: 'creature', relation: targeting.relation ?? 'any',
    count: targeting.kind === 'single-creature' ? 1 : targeting.maximumTargets,
    rangeFeet: targeting.rangeFeet, includeSelf: targeting.includeSelf ?? false,
    requiresLineOfSight: targeting.kind === 'single-creature' ? targeting.requiresSight : undefined,
  }
  return {
    kind: 'area', relation: targeting.relation ?? 'any',
    origin: targeting.shape === 'rect' ? 'point' : 'self', shape: targeting.shape,
    placeRangeFeet: targeting.shape === 'rect' ? targeting.rangeFeet : undefined,
    radiusFeet: targeting.radiusFeet,
    lengthFeet: targeting.lengthFeet ?? (targeting.shape === 'cone' || targeting.shape === 'line' ? targeting.rangeFeet : undefined),
    widthFeet: targeting.widthFeet,
    heightFeet: targeting.shape === 'rect' ? targeting.heightFeet ?? 5 : targeting.heightFeet,
    maximumTargets: targeting.maximumTargets ?? 256, includeSelf: targeting.includeSelf ?? false,
    rotatable: targeting.shape === 'rect',
  }
}

function declarativeTriggerEvent(trigger: DeclarativeSubclassAbilityV1['trigger']): Dnd5eTriggerEventV1 | undefined {
  if (trigger.kind === 'active-use') return undefined
  const events: Record<Exclude<DeclarativeSubclassAbilityV1['trigger']['kind'], 'active-use'>, Dnd5eTriggerEventV1> = {
    'before-attack-roll': 'before-attack', 'after-attack-roll': 'after-attack',
    'after-attack-hit': 'on-hit', 'after-attack-miss': 'on-miss', 'after-d20-roll': 'after-save',
    'before-damage-taken': 'before-damage', 'after-damage-taken': 'after-damage',
    'after-spell-cast': 'after-cast', 'turn-start': 'turn-start', 'turn-end': 'turn-end',
    'short-rest-complete': 'short-rest-complete', 'long-rest-complete': 'long-rest-complete',
  }
  return events[trigger.kind]
}

/** Converts the previous subclass DSL into the common Activity/Trigger vocabulary. */
export function dnd5eActivityFromDeclarativeSubclassAbility(
  ability: DeclarativeSubclassAbilityV1,
): Dnd5eActivityDefinitionV1 {
  const requirements: Dnd5ePredicateV1[] = []
  const predicates = ability.predicates
  if (predicates?.minimumLevel) requirements.push({ kind: 'minimum-level', level: predicates.minimumLevel })
  if (predicates?.classId) requirements.push({ kind: 'class-level', classId: predicates.classId, minimum: predicates.minimumLevel ?? ability.level })
  predicates?.actorHasConditions?.forEach((condition) => requirements.push({ kind: 'condition', subject: 'actor', condition, present: true }))
  predicates?.actorLacksConditions?.forEach((condition) => requirements.push({ kind: 'condition', subject: 'actor', condition, present: false }))
  predicates?.targetHasConditions?.forEach((condition) => requirements.push({ kind: 'condition', subject: 'target', condition, present: true }))
  predicates?.targetLacksConditions?.forEach((condition) => requirements.push({ kind: 'condition', subject: 'target', condition, present: false }))
  predicates?.resources?.forEach((resource) => requirements.push({ kind: 'resource', resourceId: resource.resourceId, minimum: constant(resource.minimum) }))
  predicates?.subclassChoices?.forEach((choice) => requirements.push({ kind: 'choice', choiceId: choice.groupId, optionId: choice.optionId }))
  if (predicates?.oncePerTurn) requirements.push({ kind: 'once-per-turn', key: ability.id })
  if (predicates?.minimumDistanceFeet != null || predicates?.maximumDistanceFeet != null) requirements.push({
    kind: 'distance', minimumFeet: predicates.minimumDistanceFeet, maximumFeet: predicates.maximumDistanceFeet,
  })

  const consumption: Dnd5eActivityConsumptionV1[] = []
  const economy = ability.cost?.economy
  if (economy && economy !== 'none') consumption.push({
    kind: 'action-economy', economy: economy === 'bonusAction' ? 'bonus-action' : economy,
    amount: 1, consumeOn: 'resolve',
  })
  ability.cost?.resources?.forEach((resource) => consumption.push({
    kind: 'resource', resourceId: resource.resourceId, amount: constant(resource.amount), consumeOn: 'resolve',
  }))
  if (ability.cost?.movementFeet) consumption.push({ kind: 'movement', amount: constant(ability.cost.movementFeet), consumeOn: 'resolve' })

  const rollFormulas = new Map<string, Dnd5eFormulaV1>()
  const checks: Dnd5eActivityCheckV1[] = []
  for (const roll of ability.rolls ?? []) {
    if (roll.kind === 'damage' || roll.kind === 'healing') rollFormulas.set(roll.id, declarativeDiceFormula(roll.id, roll.dice))
    else if (roll.kind === 'attack') checks.push({
      id: roll.id, kind: 'attack-roll', rollId: `${roll.id}-d20`,
      attackBonus: add([
        { kind: 'reference', reference: { kind: 'actor-ability-modifier', ability: roll.ability } },
        ...(roll.proficiency ? [reference('actor-proficiency-bonus')] : []),
      ]),
      rollMode: 'host-derived', scope: 'per-target',
    })
    else checks.push({
      id: roll.id, kind: 'saving-throw', rollId: `${roll.id}-d20`, ability: roll.ability,
      dc: declarativeValueFormula(roll.dc), rollMode: 'host-derived', scope: 'per-target',
    })
  }
  const operations: Dnd5eActivityOperationV1[] = []
  for (const [index, effect] of ability.effects.entries()) {
    const id = `effect-${index}`
    if (effect.kind === 'damage' || effect.kind === 'healing') {
      const amount = rollFormulas.get(effect.rollId)
      if (amount && effect.kind === 'damage') operations.push({
        id, kind: 'damage', target: effect.target, amount, damageType: 'inherit-primary',
      })
      else if (amount) operations.push({ id, kind: 'healing', target: effect.target, amount })
    } else if (effect.kind === 'temporary-hit-points') {
      const amount = effect.rollId ? rollFormulas.get(effect.rollId) : effect.amount ? declarativeValueFormula(effect.amount) : undefined
      if (amount) operations.push({ id, kind: 'temporary-hit-points', target: effect.target, amount })
    } else if (effect.kind === 'standard-condition') {
      operations.push({ id, kind: 'apply-standard-condition', target: effect.target, condition: effect.condition, duration: declarativeDuration(effect.duration) })
    } else if (effect.kind === 'move') {
      operations.push({ id, kind: 'move', target: effect.target, mode: effect.mode ?? 'push', distanceFeet: constant(effect.distanceFeet) })
    } else {
      operations.push({ id, kind: 'resource', subject: 'actor', resourceId: effect.resourceId,
        mode: effect.kind === 'spend-resource' ? 'spend' : 'restore', amount: declarativeValueFormula(effect.amount) })
    }
  }
  const limitations: string[] = []
  if (ability.mechanic) {
    limitations.push(`旧版特殊 mechanic ${ability.mechanic.kind} 仍由兼容执行器处理。`)
    operations.push(manualOperation('legacy-mechanic', '此能力包含特殊规则，请在兼容执行器或 DM 裁定后继续。', limitations[0]!))
  }
  if (operations.length === 0) {
    limitations.push('能力没有可投影的通用效果。')
    operations.push(manualOperation('ability-manual', '请由 DM 结算此能力。', limitations[0]!))
  }
  const check = checks[0]
  if (checks.length > 1) limitations.push('能力包含多个检查，旧兼容执行器仍负责其组合顺序。')
  const outcome: Dnd5eActivityOutcomeV1 = {
    id: 'resolve',
    when: check ? { kind: 'check', checkId: check.id, result: check.kind === 'saving-throw' ? 'failure' : 'success' } : { kind: 'always' },
    operations,
  }
  const triggerEvent = declarativeTriggerEvent(ability.trigger)
  return {
    schemaVersion: 1,
    id: `subclass-ability:${ability.id}`,
    name: ability.name,
    description: ability.description,
    activation: ability.trigger.kind === 'active-use'
      ? economyActivation(economy ?? 'none')
      : { kind: 'passive', timing: ability.trigger.kind },
    target: declarativeTarget(ability.targeting),
    requirements,
    consumption,
    checks,
    outcomes: [outcome],
    triggers: triggerEvent ? [{
      id: `trigger:${ability.id}`, event: triggerEvent, activityId: `subclass-ability:${ability.id}`,
      decision: ability.automation === 'full' ? 'actor-choice' : 'dm-approval',
      ...(ability.limits?.oncePerTurn ? { limit: { uses: 1, reset: 'turn' as const } } : {}),
    }] : undefined,
    automation: capability(ability.automation, limitations),
    legacySource: { kind: 'subclass-ability', id: ability.id },
  }
}

function monsterActionId(monster: Pick<Dnd5eMonsterStatBlock, 'id'>, actionId: string): string {
  return `monster:${monster.id}:${actionId}`
}

function monsterDamageFormula(id: string, damage: Dnd5eMonsterDamage): Dnd5eFormulaV1 {
  return diceFormula(id, damage)
}

function failedSaveDuration(condition: Dnd5eMonsterFailedSaveCondition): Dnd5eEffectDurationV1 {
  if (condition.repeatSaveAtEndOfTargetTurn) return {
    kind: 'save-ends', maximumRounds: condition.durationRounds, timing: 'target-turn-end', ability: 'con', dc: constant(10),
  }
  return {
    kind: 'rounds', rounds: condition.durationRounds,
    expiresAt: condition.expiresAtSourceTurnEnd ? 'source-turn-end' : 'target-turn-end',
  }
}

function monsterCollectionActivation(collection: Dnd5eLegacyMonsterActionCollection, action: Dnd5eMonsterAction): Dnd5eActivityActivationV1 {
  if (collection === 'bonusActions' || action.economy === 'bonus-action') return { kind: 'bonus-action', cost: 1 }
  if (collection === 'reactions') return { kind: 'reaction', cost: 1, reactionEvent: action.reactionTrigger?.kind }
  if (collection === 'legendaryActions') return { kind: 'special', timing: `legendary action cost ${action.legendaryCost ?? 1}` }
  if (collection === 'lairActions') return { kind: 'special', timing: 'lair initiative' }
  return { kind: 'action', cost: 1 }
}

function monsterAreaTarget(area: SkillAoeTargeting, relation: 'ally' | 'enemy' | 'any' = 'enemy'): Dnd5eActivityTargetV1 {
  return aoeTarget(area, relation, false, 256)
}

/** Projects common weapon, multiattack, area, summon, healing and teleport actions. */
export function dnd5eActivityFromMonsterAction(
  monster: Pick<Dnd5eMonsterStatBlock, 'id' | 'name'>,
  action: Dnd5eMonsterAction,
  collection: Dnd5eLegacyMonsterActionCollection = 'actions',
): Dnd5eActivityDefinitionV1 {
  const id = monsterActionId(monster, action.id)
  const checks: Dnd5eActivityCheckV1[] = []
  const operations: Dnd5eActivityOperationV1[] = []
  const limitations: string[] = []
  let target: Dnd5eActivityTargetV1 = { kind: 'creature', relation: 'enemy', count: 1, includeSelf: false }
  let when: Dnd5eActivityOutcomeV1['when'] = { kind: 'always' }
  if (action.kind === 'weapon-attack' && action.attack) {
    target = {
      kind: 'creature', relation: 'enemy', count: 1, includeSelf: false,
      rangeFeet: action.attack.mode === 'melee' ? action.attack.reachFeet ?? 5 : action.attack.rangeFeet?.long ?? action.attack.reachFeet ?? 5,
    }
    checks.push({
      id: 'attack', kind: 'attack-roll', rollId: 'attack-d20', attackBonus: constant(action.attack.toHit),
      rollMode: 'host-derived', criticalThreshold: action.attack.criticalThreshold, scope: 'per-target',
    })
    when = { kind: 'check', checkId: 'attack', result: 'success' }
    action.attack.damage.forEach((damage, index) => operations.push({
      id: `damage-${index}`, kind: 'damage', target: 'target', amount: monsterDamageFormula(`damage-${index}`, damage),
      damageType: damage.type, critical: 'double-dice',
    }))
    if (action.attack.onHitEffects?.length || action.attack.onHitRule) {
      limitations.push('复杂命中后效果继续由现有怪物 Headless 兼容执行器处理。')
    }
  } else if (action.kind === 'multiattack') {
    for (const [index, child] of (action.sequence ?? []).entries()) operations.push({
      id: `invoke-${index}`, kind: 'invoke-activity', activityId: monsterActionId(monster, child), target: 'target', repeat: constant(1),
    })
    if (action.randomRepeat) operations.push({
      id: 'invoke-random', kind: 'invoke-activity', activityId: monsterActionId(monster, action.randomRepeat.actionId), target: 'target',
      repeat: { kind: 'dice', rollId: 'multiattack-repeat', count: 1, sides: action.randomRepeat.dieSides },
    })
    if (!operations.length) limitations.push('多重攻击没有结构化子动作序列。')
  } else if (action.referencedActionId) {
    operations.push({ id: 'invoke-reference', kind: 'invoke-activity', activityId: monsterActionId(monster, action.referencedActionId), target: 'target', repeat: constant(1) })
  } else if (action.rule?.kind === 'summon') {
    operations.push({
      id: 'summon', kind: 'summon', monsterId: action.rule.monsterId,
      count: action.rule.count.kind === 'fixed' ? constant(action.rule.count.value) : diceFormula('summon-count', action.rule.count),
      timing: action.rule.timing, durationRounds: action.rule.durationRounds,
      concentration: action.rule.concentration, side: action.rule.side,
    })
  } else if (action.rule?.kind === 'teleport') {
    target = { kind: 'self' }
    operations.push({ id: 'teleport', kind: 'move', target: 'actor', mode: 'teleport', distanceFeet: constant(action.rule.rangeFeet) })
  } else if (action.rule?.kind === 'healing-touch') {
    target = { kind: 'creature', relation: 'ally', count: 1, rangeFeet: action.rule.rangeFeet, includeSelf: false }
    operations.push({ id: 'healing', kind: 'healing', target: 'target', amount: diceFormula('healing', action.rule.healing) })
    if (action.rule.removes.length) limitations.push('治疗之外的诅咒、疾病或状态移除仍由现有怪物兼容执行器处理。')
  } else if (action.rule?.kind === 'saving-throw-condition') {
    target = { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: action.rule.rangeFeet, includeSelf: false }
    checks.push({ id: 'save', kind: 'saving-throw', rollId: 'save-d20', ability: action.rule.ability, dc: constant(action.rule.dc), rollMode: 'host-derived', scope: 'per-target' })
    when = { kind: 'check', checkId: 'save', result: 'failure' }
    operations.push({
      id: 'condition', kind: 'apply-standard-condition', target: 'target', condition: action.rule.condition,
      duration: action.rule.repeatSaveAtEndOfTargetTurn
        ? { kind: 'save-ends', maximumRounds: action.rule.durationRounds ?? 10, timing: 'target-turn-end', ability: action.rule.ability, dc: constant(action.rule.dc) }
        : { kind: 'rounds', rounds: action.rule.durationRounds ?? 1, expiresAt: action.rule.expiresAtSourceTurnEnd ? 'source-turn-end' : 'target-turn-end' },
    })
    if (action.rule.additionalConditionsOnFailedSave?.length) limitations.push('附加失败条件继续由现有怪物兼容执行器处理。')
  } else {
    const area = dnd5eMonsterAreaSavingThrowEffect(action)
    if (area) {
      target = monsterAreaTarget(area.area, area.target === 'hostile' ? 'enemy' : 'any')
      checks.push({ id: 'area-save', kind: 'saving-throw', rollId: 'area-save-d20', ability: area.ability, dc: constant(area.dc), rollMode: 'host-derived', scope: 'per-target' })
      when = { kind: 'check', checkId: 'area-save', result: 'failure' }
      if (area.damage) operations.push({
        id: 'area-damage', kind: 'damage', target: 'target', amount: monsterDamageFormula('area-damage', area.damage), damageType: area.damage.type,
      })
      if (area.conditionOnFailedSave) operations.push({
        id: 'area-condition', kind: 'apply-standard-condition', target: 'target',
        condition: area.conditionOnFailedSave.condition, duration: failedSaveDuration(area.conditionOnFailedSave),
      })
      if (area.damageOnSuccessfulSave === 'half' && area.damage) limitations.push('成功豁免减半结果继续由现有怪物兼容执行器处理。')
      if (area.additionalConditionsOnFailedSave?.length || area.activeEffectOnFailedSave || area.forcedMovementOnFailedSave) {
        limitations.push('范围动作的附加状态、主动效果或强制移动继续由现有怪物兼容执行器处理。')
      }
    }
  }
  if (action.usage?.kind === 'recharge') limitations.push('充能掷骰与可用性由现有怪物资源系统继续管理。')
  if (operations.length === 0) {
    limitations.push('该怪物动作没有可安全投影的通用 Activity 操作。')
    operations.push(manualOperation('monster-manual', '请由 DM 结算此怪物动作。', limitations.join(' ')))
  }
  const requested: Dnd5ePluginAutomationLevel = action.automation === 'dm-adjudication' ? 'manual' : 'full'
  const activation = monsterCollectionActivation(collection, action)
  return {
    schemaVersion: 1,
    id,
    name: action.name,
    description: action.description,
    activation,
    target,
    consumption: activation.kind === 'action' || activation.kind === 'bonus-action' || activation.kind === 'reaction'
      ? [{ kind: 'action-economy', economy: activation.kind, amount: 1, consumeOn: 'resolve' }]
      : undefined,
    checks,
    outcomes: [{ id: 'resolve', when, operations }],
    automation: capability(requested, limitations),
    legacySource: { kind: 'monster-action', id: `${monster.id}:${action.id}` },
  }
}

export function dnd5eActivitiesFromMonster(monster: Dnd5eMonsterStatBlock): readonly Dnd5eActivityDefinitionV1[] {
  const collections: readonly [Dnd5eLegacyMonsterActionCollection, readonly Dnd5eMonsterAction[]][] = [
    ['actions', monster.actions],
    ['bonusActions', monster.bonusActions ?? []],
    ['reactions', monster.reactions ?? []],
    ['legendaryActions', monster.legendaryActions ?? []],
    ['lairActions', monster.lairActions ?? []],
  ]
  return collections.flatMap(([collection, actions]) => actions.map((action) => dnd5eActivityFromMonsterAction(monster, action, collection)))
}
