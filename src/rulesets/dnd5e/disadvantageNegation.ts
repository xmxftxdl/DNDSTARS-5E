import type { Character } from '../../types/character'
import type { D20RollMode } from '../contracts'
import { spendClassResource } from '../../lib/classResources'
import { dnd5eCharacterHasPluginFeature, registeredDnd5ePluginFeatures } from './pluginApi'
import { dnd5eDeclarativeResourceKey } from './plugins/pluginDeclarativeCompiler'
import type { Dnd5eCombatant } from './headlessCombatEngine'
import { dnd5ePluginFeatureDefinition } from './pluginApi'

export interface DisadvantageNegationReceipt {
  rollId: string
  transactionId: string
  featureId: string
  kind: DisadvantageNegationRoll['kind']
  occurrence?: number
  contextId?: string
}

/** Host-collected choice; debit inside the owning Headless transaction, after reconstruction. */
export function stageDnd5eCombatantDisadvantageNegation(actor: Dnd5eCombatant,
  choice: { featureId: string; rollId: string; transactionId: string },
  context: { kind: DisadvantageNegationRoll['kind']; mode: D20RollMode; contextId?: string }) {
  if (!choice.rollId.trim() || choice.rollId.length > 240 || !choice.transactionId.trim() ||
    actor.classState.disadvantageNegationReceipts?.[choice.rollId]) throw Error('negation-staged-choice-invalid')
  const feature = dnd5ePluginFeatureDefinition(choice.featureId)
  const receipt = { ...choice, kind: context.kind, contextId: context.contextId }
  const probe = { ...actor, classState: { ...actor.classState,
    disadvantageNegationReceipts: { ...actor.classState.disadvantageNegationReceipts, [choice.rollId]: receipt } } }
  consumeDnd5eDisadvantageNegation(probe, { ...choice, ...context })
  const costs = (feature?.declarativeAbility?.cost?.resources ?? []).map(cost => ({
    key: cost.scope === 'core' ? cost.resourceId : dnd5eDeclarativeResourceKey(feature!.ownerPluginId, cost), amount: cost.amount,
  }))
  if (!costs.length || new Set(costs.map(cost => cost.key)).size !== costs.length || costs.some(cost =>
    !Number.isSafeInteger(cost.amount) || cost.amount <= 0 || (actor.classResources[cost.key]?.current ?? 0) < cost.amount)) {
    throw Error('negation-staged-cost-unavailable')
  }
  actor.classResources = { ...actor.classResources }
  for (const cost of costs) actor.classResources[cost.key] = {
    ...actor.classResources[cost.key], current: actor.classResources[cost.key].current - cost.amount,
  }
  actor.classState.disadvantageNegationReceipts = { ...actor.classState.disadvantageNegationReceipts, [choice.rollId]: receipt }
}

/** Consume only the paid receipt for this exact Host roll and action. */
export function consumeDnd5eDisadvantageNegation(actor: Dnd5eCombatant, input: {
  rollId: string; transactionId: string; kind: DisadvantageNegationRoll['kind']; mode: D20RollMode; occurrence?: number; contextId?: string
}): 'normal' {
  const receipt = actor.classState.disadvantageNegationReceipts?.[input.rollId]
  const feature = receipt ? dnd5ePluginFeatureDefinition(receipt.featureId) : undefined
  const mechanic = feature?.declarativeAbility?.mechanic
  if (!receipt || receipt.rollId !== input.rollId || receipt.transactionId !== input.transactionId || receipt.kind !== input.kind ||
    receipt.contextId !== input.contextId || (receipt.occurrence ?? 0) !== (input.occurrence ?? 0) || input.mode !== 'disadvantage' || !feature || feature.automation !== 'full' ||
    !actor.pluginFeatureIds.includes(feature.id) || mechanic?.kind !== 'd20-disadvantage-negation' || !mechanic.rollKinds.includes(input.kind) ||
    (feature.sourceClassId && (actor.classLevels?.[feature.sourceClassId] ?? (actor.classId === feature.sourceClassId ? actor.level : 0)) < (feature.minimumLevel ?? 1)) ||
    (feature.sourceClassId && feature.sourceSubclassId && actor.subclassIds?.[feature.sourceClassId] !== feature.sourceSubclassId)) {
    throw Error('negation-receipt-unavailable')
  }
  const remaining = { ...actor.classState.disadvantageNegationReceipts }
  delete remaining[input.rollId]
  actor.classState.disadvantageNegationReceipts = Object.keys(remaining).length ? remaining : undefined
  return 'normal'
}

export interface DisadvantageNegationRoll {
  /** Host-generated identity; callers must atomically persist this with the spend. */
  rollId: string
  characterId: string
  kind: 'attack' | 'ability-check' | 'saving-throw'
  mode: D20RollMode
  phase: 'before-roll' | 'rolled'
  occurrence?: number
  contextId?: string
  /** Host reservations for the parent action, not additional costs for this feature. */
  reservedResources?: readonly { resourceKey: string; amount: number }[]
}

/** Reserve already selected costs without mutating the character before the parent commits. */
export function dnd5ePendingNegationReservations(character: Character, choices: readonly { featureId: string }[]) {
  const totals = new Map<string, number>()
  for (const choice of choices) {
    const feature = dnd5ePluginFeatureDefinition(choice.featureId)
    if (!feature || !dnd5eCharacterHasPluginFeature(character, feature.id)) throw Error('negation-reservation-unavailable')
    for (const cost of feature.declarativeAbility?.cost?.resources ?? []) {
      const key = cost.scope === 'core' ? cost.resourceId : dnd5eDeclarativeResourceKey(feature.ownerPluginId, cost)
      totals.set(key, (totals.get(key) ?? 0) + cost.amount)
    }
  }
  return [...totals].map(([resourceKey, amount]) => ({ resourceKey, amount }))
}

export function dnd5eDisadvantageNegationOptions(character: Character, roll: DisadvantageNegationRoll) {
  if (!roll.rollId.trim() || roll.rollId.length > 240 || roll.characterId !== character.id ||
    roll.phase !== 'before-roll' || roll.mode !== 'disadvantage') return []
  if (roll.occurrence != null && (!Number.isSafeInteger(roll.occurrence) || roll.occurrence < 0 || roll.occurrence > 1000)) return []
  if (roll.contextId != null && (typeof roll.contextId !== 'string' || !roll.contextId || roll.contextId.length > 500)) return []
  const reserved = roll.reservedResources ?? []
  if (reserved.length > 32 || new Set(reserved.map(cost => cost.resourceKey)).size !== reserved.length ||
    reserved.some(cost => !cost.resourceKey || !Number.isSafeInteger(cost.amount) || cost.amount < 0 ||
      (character.classResources?.[cost.resourceKey]?.current ?? 0) < cost.amount)) return []
  return registeredDnd5ePluginFeatures().flatMap(feature => {
    const ability = feature.declarativeAbility
    const mechanic = ability?.mechanic
    if (feature.automation !== 'full' || mechanic?.kind !== 'd20-disadvantage-negation' ||
      !mechanic.rollKinds.includes(roll.kind) || !dnd5eCharacterHasPluginFeature(character, feature.id)) return []
    const resourceCosts = (ability?.cost?.resources ?? []).map(cost => ({
      resourceKey: cost.scope === 'core' ? cost.resourceId : dnd5eDeclarativeResourceKey(feature.ownerPluginId, cost),
      amount: cost.amount,
    }))
    if (!resourceCosts.length || new Set(resourceCosts.map(cost => cost.resourceKey)).size !== resourceCosts.length ||
      resourceCosts.some(cost => (character.classResources?.[cost.resourceKey]?.current ?? 0) < cost.amount +
        (reserved.find(entry => entry.resourceKey === cost.resourceKey)?.amount ?? 0))) return []
    return [{ featureId: feature.id, pluginId: feature.ownerPluginId, label: feature.name, resourceCosts }]
  })
}

/** Pure Host plan. Not a network commit: the caller must CAS the roll and character together. */
export function planDnd5eDisadvantageNegation(character: Character, roll: DisadvantageNegationRoll, featureId: string) {
  const option = dnd5eDisadvantageNegationOptions(character, roll).find(option => option.featureId === featureId)
  if (!option) return undefined
  let changed: Character | null = character
  for (const cost of option.resourceCosts) {
    if (!changed) return undefined
    changed = spendClassResource(changed, cost.resourceKey, cost.amount)
  }
  return changed ? { character: changed, roll: { ...roll, mode: 'normal' as const }, featureId, resourceCosts: option.resourceCosts } : undefined
}
