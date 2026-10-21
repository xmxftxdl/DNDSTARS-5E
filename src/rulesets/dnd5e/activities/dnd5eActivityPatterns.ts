import type { AbilityKey } from '../../../lib/dnd'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1, Dnd5eActivityOperationV1, Dnd5eActivityOutcomeV1 } from './dnd5eActivityContracts'
import type { Dnd5eEffectDefinitionV1 } from './dnd5eEffectContracts'
import type { Dnd5eFormulaV1 } from './dnd5eFormula'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'

type Operation<K extends Dnd5eActivityOperationV1['kind']> = Extract<Dnd5eActivityOperationV1, { kind: K }>
type Result<T> = T extends unknown ? Omit<T, 'id' | 'target'> : never
type Check = { kind: 'save'; ability: AbilityKey; dc?: Dnd5eFormulaV1; allowWillingFailure?: boolean } | { kind: 'attack'; bonus?: Dnd5eFormulaV1 }
interface Base {
  schemaVersion: 1
  id: string
  name: string
  source: NonNullable<Dnd5eActivityDefinitionV1['legacySource']>
  target: Dnd5eActivityDefinitionV1['target']
  activation?: Dnd5eActivityDefinitionV1['activation']
  invocation?: Dnd5eActivityDefinitionV1['invocation']
  requirements?: Dnd5eActivityDefinitionV1['requirements']
  consumption?: Dnd5eActivityDefinitionV1['consumption']
  scaling?: Dnd5eActivityDefinitionV1['scaling']
  choices?: Dnd5eActivityDefinitionV1['choices']
  continuation?: Dnd5eActivityDefinitionV1['continuation']
  requiresContinuationFrom?: string
  carriedRollIds?: readonly string[]
  /** Supplemental effect definitions used by choice branches. */
  effects?: readonly Dnd5eEffectDefinitionV1[]
}

/** Content-neutral A1–A8 authoring inputs. Compiled output uses the existing Host protocol. */
export type Dnd5eActivityPatternV1 = Base & (
  | { pattern: 'roll-effect'; check?: Check; result: Result<Operation<'damage' | 'healing' | 'temporary-hit-points'>>; recipient?: 'actor' | 'target'; saveSuccess?: 'none' | 'half' | 'full'; afterResult?: readonly Dnd5eActivityOperationV1[] }
  | { pattern: 'condition'; check?: Check; condition: NonNullable<Dnd5eEffectDefinitionV1['conditions']>[number]; duration: Dnd5eEffectDefinitionV1['duration']; concentration?: boolean }
  | { pattern: 'choice'; label: string; branches: readonly { id: string; label: string; outcomes: readonly Dnd5eActivityOutcomeV1[]; targetOverride?: Dnd5eActivityDefinitionV1['target'] }[]; checks?: Dnd5eActivityDefinitionV1['checks'] }
  | { pattern: 'resource'; resourceId: string; mode: 'spend' | 'restore'; amount: Dnd5eFormulaV1 }
  | { pattern: 'timed-effect'; effect: Dnd5eEffectDefinitionV1; recipient?: 'actor' | 'target'; check?: Check }
  | { pattern: 'grant-actions'; effect: Omit<Dnd5eEffectDefinitionV1, 'grants'>; actionIds: readonly string[]; recipient?: 'actor' | 'target' }
  | { pattern: 'area'; area: Omit<Operation<'create-persistent-area'>, 'id' | 'kind'> }
  | { pattern: 'movement'; movement: Result<Operation<'move' | 'relocate-granting-area'>> & { target?: 'actor' | 'target' | 'all-targets' | 'all-combatants' }; check?: Check }
  | { pattern: 'summon'; summon: Omit<Operation<'summon'>, 'id' | 'kind'> }
  | { pattern: 'transformation'; transformation: Omit<Operation<'transform-creature'>, 'id' | 'kind' | 'formChoiceId'>; forms: readonly { id: string; label: string }[]; formsFrom?: 'srd-beast-forms'; check?: Check }
  | { pattern: 'weapon-binding'; effect: Omit<Dnd5eEffectDefinitionV1, 'modifiers'>; binding: Extract<NonNullable<Dnd5eEffectDefinitionV1['modifiers']>[number], { kind: 'weapon-enchantment' }>; recipient?: 'actor' | 'target' }
  | { pattern: 'conjured-item'; item: Omit<Operation<'grant-inventory-item'>, 'id' | 'kind'> }
  | { pattern: 'hit-dice-benefit'; pools: readonly { sides: 6 | 8 | 10 | 12; maximumCount: number }[];
      abilityPerDie?: AbilityKey; minimumPerPoolAmount?: number; maximumTotalFraction?: number;
      result: Omit<Operation<'healing'>, 'id' | 'amount'> | Omit<Operation<'transfer-hit-point-maximum'>, 'id' | 'amount'>;
      setup?: readonly Dnd5eActivityOperationV1[] }
)

function checked(operations: readonly Dnd5eActivityOperationV1[], check?: Check): Pick<Dnd5eActivityDefinitionV1, 'checks' | 'outcomes'> {
  if (!check) return { outcomes: [{ id: 'resolve', when: { kind: 'always' }, operations }] }
  const success = check.kind === 'attack' ? 'success' : 'failure'
  return {
    checks: [check.kind === 'save'
      ? { id: 'check', kind: 'saving-throw', rollId: 'save', ability: check.ability, dc: check.dc ?? { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } }, scope: 'per-target', rollMode: 'host-derived', ...(check.allowWillingFailure !== undefined ? { allowWillingFailure: check.allowWillingFailure } : {}) }
      : { id: 'check', kind: 'attack-roll', rollId: 'attack', attackBonus: check.bonus ?? { kind: 'reference', reference: { kind: 'actor-spell-attack-bonus' } }, scope: 'per-target', rollMode: 'host-derived' }],
    outcomes: [{ id: 'resolve', when: { kind: 'check', checkId: 'check', result: success }, operations }],
  }
}

/** Generates no code, native spell IDs or authority bypasses. Invalid data fails before registration. */
export function compileDnd5eActivityPatternV1(pattern: Dnd5eActivityPatternV1): Dnd5eActivityDefinitionV1 {
  if (!pattern || pattern.schemaVersion !== 1 || !pattern.source) throw new Error('Activity pattern requires schemaVersion=1 and source')
  if ('check' in pattern && pattern.check && !['save', 'attack'].includes(pattern.check.kind)) throw new Error('Unknown pattern check')
  if (pattern.pattern === 'roll-effect' && pattern.saveSuccess && !['none', 'half', 'full'].includes(pattern.saveSuccess)) throw new Error('Invalid saveSuccess')
  const activation = pattern.activation ?? { kind: 'action' as const, cost: 1 }
  const economy = ['action', 'bonus-action', 'reaction'].includes(activation.kind)
    ? activation.kind as 'action' | 'bonus-action' | 'reaction' : undefined
  const activity: Dnd5eActivityDefinitionV1 = {
    schemaVersion: 1, id: pattern.id, name: pattern.name, target: pattern.target, activation,
    invocation: pattern.invocation ?? { kind: 'active', confirmation: 'actor-choice' },
    consumption: [...(economy && !pattern.consumption?.some(c => c.kind === 'action-economy')
      ? [{ kind: 'action-economy' as const, economy, amount: 1 as const, consumeOn: 'resolve' as const }] : []), ...pattern.consumption ?? []],
    requirements: pattern.requirements, scaling: pattern.scaling, effects: pattern.effects, choices: pattern.choices,
    outcomes: [], legacySource: pattern.source,
    continuation: pattern.continuation, requiresContinuationFrom: pattern.requiresContinuationFrom,
    carriedRollIds: pattern.carriedRollIds,
    automation: automationCapabilityFromLegacyStatus('full'),
  }
  switch (pattern.pattern) {
    case 'roll-effect': {
      const operation = { ...(pattern.result.kind === 'damage' && pattern.check?.kind === 'attack' ? { critical: 'double-dice' as const } : {}), ...pattern.result, id: 'result', target: pattern.recipient ?? 'target' } as Dnd5eActivityOperationV1
      Object.assign(activity, checked([operation, ...pattern.afterResult ?? []], pattern.check))
      if (pattern.check?.kind === 'save' && pattern.saveSuccess && pattern.saveSuccess !== 'none') {
        const amount = pattern.result.amount
        activity.outcomes = [...activity.outcomes, { id: 'saved', when: { kind: 'check', checkId: 'check', result: 'success' }, operations: [{
          ...operation, id: 'saved-result',
          amount: pattern.saveSuccess === 'half' ? { kind: 'floor', value: { kind: 'multiply', values: [amount, { kind: 'constant', value: 0.5 }] } } : amount,
        } as Dnd5eActivityOperationV1] }]
        // saved-result is compiler-generated from result. Its damage/healing
        // progression must follow the original before applying the save factor.
        activity.scaling = activity.scaling?.map(profile => !profile.adjustments ? profile : ({
          ...profile,
          adjustments: [...profile.adjustments, ...profile.adjustments
            .filter(adjustment => adjustment.operationId === 'result' && !profile.adjustments!.some(other => other.operationId === 'saved-result'))
            .map(adjustment => ({ ...adjustment, operationId: 'saved-result' }))],
        }))
      }
      break
    }
    case 'condition': {
      // A condition is carried by an Effect so concentration and repeat-save cleanup stay linked.
      const effect: Dnd5eEffectDefinitionV1 = { schemaVersion: 1, id: pattern.id + '-condition', name: pattern.name,
        conditions: [pattern.condition], duration: pattern.duration, stacking: 'unique-by-source',
        concentration: pattern.concentration ?? pattern.duration.kind === 'concentration' }
      activity.effects = [...pattern.effects ?? [], effect]
      Object.assign(activity, checked([{ id: 'result', kind: 'apply-effect', target: 'target', effectId: effect.id }], pattern.check))
      break
    }
    case 'choice':
      if (!Array.isArray(pattern.branches) || !pattern.branches.length) throw new Error('Activity choice requires branches')
      activity.choices = [{ id: 'mode', label: pattern.label, options: pattern.branches.map(b => ({ id: b.id, label: b.label, targetOverride: b.targetOverride })) }]
      activity.checks = pattern.checks
      activity.outcomes = pattern.branches.flatMap(branch => branch.outcomes.map((outcome: Dnd5eActivityOutcomeV1) => ({
        ...outcome, id: branch.id + '-' + outcome.id,
        operations: outcome.operations.map(op => ({ ...op, id: branch.id + '-' + op.id })),
        when: outcome.when.kind === 'always' ? { kind: 'choice' as const, choiceId: 'mode', optionId: branch.id } : { kind: 'all' as const, conditions: [{ kind: 'choice' as const, choiceId: 'mode', optionId: branch.id },
          ...(outcome.when.kind === 'all' ? outcome.when.conditions : [outcome.when])] },
      })))
      break
    case 'resource':
      Object.assign(activity, checked([{ id: 'result', kind: 'resource', subject: 'actor', resourceId: pattern.resourceId, mode: pattern.mode, amount: pattern.amount }]))
      break
    case 'timed-effect':
    case 'grant-actions': {
      const effect: Dnd5eEffectDefinitionV1 = pattern.pattern === 'grant-actions' ? { ...pattern.effect, grants: pattern.actionIds } : pattern.effect
      activity.effects = [...pattern.effects ?? [], effect]
      Object.assign(activity, checked([{ id: 'result', kind: 'apply-effect', target: pattern.recipient ?? 'target', effectId: effect.id }], pattern.pattern === 'timed-effect' ? pattern.check : undefined))
      break
    }
    case 'area':
      if (pattern.target.kind !== 'area') throw new Error('Persistent area pattern requires an area target')
      Object.assign(activity, checked([{ ...pattern.area, id: 'result', kind: 'create-persistent-area' }]))
      break
    case 'movement':
      Object.assign(activity, checked([{ ...pattern.movement, id: 'result' } as Dnd5eActivityOperationV1], pattern.check))
      break
    case 'summon':
      Object.assign(activity, checked([{ ...pattern.summon, id: 'result', kind: 'summon' }]))
      break
    case 'conjured-item':
      Object.assign(activity, checked([{ ...pattern.item, id: 'result', kind: 'grant-inventory-item' }]))
      break
    case 'hit-dice-benefit': {
      if (!Array.isArray(pattern.pools) || !pattern.pools.length || pattern.pools.length > 4 ||
        new Set(pattern.pools.map(pool => pool.sides)).size !== pattern.pools.length ||
        pattern.pools.some(pool => ![6, 8, 10, 12].includes(pool.sides) || !Number.isSafeInteger(pool.maximumCount) || pool.maximumCount < 1 || pool.maximumCount > 100)) throw new Error('Invalid Hit Dice pattern pools')
      if (!pattern.result || !['healing', 'transfer-hit-point-maximum'].includes(pattern.result.kind)) throw new Error('Invalid Hit Dice benefit')
      if (pattern.minimumPerPoolAmount != null && (!Number.isFinite(pattern.minimumPerPoolAmount) || pattern.minimumPerPoolAmount < 0)) throw new Error('Invalid minimum Hit Dice benefit')
      const choices = pattern.pools.map(pool => ({ id: `hit-dice-${pool.sides}`, label: `d${pool.sides} 数量`,
        optionsFrom: 'actor-hit-die-count' as const, hitDieSides: pool.sides, hitDieMaximumCount: pool.maximumCount, options: [], defaultOptionId: '0' }))
      if (pattern.choices?.some(choice => choices.some(generated => generated.id === choice.id))) throw new Error('Reserved Hit Dice choice ID')
      activity.choices = [...pattern.choices ?? [], ...choices]
      activity.outcomes = []
      for (const pool of pattern.pools) for (let count = 1; count <= pool.maximumCount; count++) {
        const id = `hit-dice-${pool.sides}-${count}`, choiceId = `hit-dice-${pool.sides}`
        if (pattern.setup?.length) {
          const conditions = [
          { kind: 'choice' as const, choiceId, optionId: String(count) },
          ...pattern.pools.slice(0, pattern.pools.indexOf(pool)).map(prior => ({ kind: 'choice' as const, choiceId: `hit-dice-${prior.sides}`, optionId: '0' })),
          ]
          activity.outcomes = [...activity.outcomes, { id: `${id}-setup`, when: conditions.length === 1 ? conditions[0] : { kind: 'all', conditions },
            operations: pattern.setup.map(operation => ({ ...operation, id: `${id}-setup-${operation.id}` })) }]
        }
        let amount: Dnd5eFormulaV1 = { kind: 'dice', rollId: id, count, sides: pool.sides }
        if (pattern.abilityPerDie) amount = { kind: 'add', values: [amount, { kind: 'multiply', values: [
          { kind: 'constant', value: count }, { kind: 'reference', reference: { kind: 'actor-ability-modifier', ability: pattern.abilityPerDie } },
        ] }] }
        if (pattern.minimumPerPoolAmount != null) amount = { kind: 'maximum', values: [amount, { kind: 'constant', value: pattern.minimumPerPoolAmount }] }
        activity.consumption = [...activity.consumption ?? [], { kind: 'hit-die', resourceId: `hit-die:d${pool.sides}`,
          amount: { kind: 'constant', value: count }, consumeOn: 'resolve', maximumTotalFraction: pattern.maximumTotalFraction,
          whenChoice: { choiceId, optionIds: [String(count)] } }]
        activity.outcomes = [...activity.outcomes, { id, when: { kind: 'choice', choiceId, optionId: String(count) },
          operations: [{ ...pattern.result, id, amount }] }]
      }
      break
    }
    case 'transformation':
      if (pattern.choices?.some(choice => choice.id === 'form')) throw new Error('Reserved transformation choice: form')
      if (pattern.formsFrom !== undefined && pattern.formsFrom !== 'srd-beast-forms') throw new Error('Unknown transformation forms source')
      activity.choices = [...pattern.choices ?? [], { id: 'form', label: '形态', options: pattern.forms, ...(pattern.formsFrom ? { optionsFrom: pattern.formsFrom } : {}), defaultOptionId: !pattern.formsFrom && pattern.forms.length === 1 ? pattern.forms[0].id : undefined }]
      Object.assign(activity, checked([{ ...pattern.transformation, id: 'result', kind: 'transform-creature', formChoiceId: 'form' }], pattern.check))
      break
    case 'weapon-binding': {
      const effect = { ...pattern.effect, modifiers: [pattern.binding] }
      activity.effects = [...pattern.effects ?? [], effect]
      Object.assign(activity, checked([{ id: 'result', kind: 'apply-effect', target: pattern.recipient ?? 'target', effectId: effect.id }]))
      break
    }
    default: throw new Error('Unknown Activity pattern')
  }
  const errors = validateDnd5eActivityDefinitionV1(activity)
  if (errors.length) throw new Error('Activity pattern ' + pattern.id + ': ' + errors.join('; '))
  return activity
}

/** Expands authoring-only fields before persistence; exported packages need no recipe compiler. */
export function expandDnd5eActivityPatternsV1(input: Record<string, unknown>): Record<string, unknown> {
  const root = structuredClone(input)
  const nested = root.content && typeof root.content === 'object' && !Array.isArray(root.content) ? root.content as Record<string, unknown> : undefined
  if (root.activityPatterns !== undefined && nested?.activityPatterns !== undefined) throw new Error('activityPatterns must have one location')
  const owner = nested?.activityPatterns !== undefined ? nested : root
  if (owner.activityPatterns === undefined) return root
  if (!Array.isArray(owner.activityPatterns) || owner.activityPatterns.length > 500) throw new Error('activityPatterns must be an array of at most 500 entries')
  if (owner.activities != null && !Array.isArray(owner.activities)) throw new Error('activities must be an array')
  const generated = owner.activityPatterns.map(p => compileDnd5eActivityPatternV1(p as Dnd5eActivityPatternV1))
  const activities = [...(owner.activities as Dnd5eActivityDefinitionV1[] | undefined) ?? [], ...generated]
  const ids = new Set<string>()
  for (const activity of activities) {
    if (ids.has(activity.id)) throw new Error('Duplicate Activity ID: ' + activity.id)
    ids.add(activity.id)
  }
  const grantOwners = new Map<string, string>()
  for (const activity of activities) if (activity.continuation) {
    const child = activities.find(candidate => candidate.id === activity.continuation!.nextActivityId)
    if (activity.continuation.nextActivityId && (!child || child.requiresContinuationFrom !== (activity.requiresContinuationFrom ?? activity.id))) throw new Error('Invalid continuation Activity: ' + activity.id)
    if (activity.continuation.finishActivityId) {
      const finish = activities.find(candidate => candidate.id === activity.continuation!.finishActivityId)
      if (!finish || finish.requiresContinuationFrom !== (activity.requiresContinuationFrom ?? activity.id) || finish.continuation) throw new Error('Invalid continuation finisher: ' + activity.id)
    }
    if (child) child.carriedRollIds = [...new Set([...(child.carriedRollIds ?? []), ...(activity.continuation.carryRolls ?? []).map(copy => copy.to)])]
  }
  for (const activity of generated) for (const effect of activity.effects ?? []) for (const granted of [...effect.grants ?? [], ...effect.completionGrant?.activityIds ?? []]) {
    if (!ids.has(granted)) throw new Error('Unknown granted Activity: ' + granted)
    if (grantOwners.has(granted) && grantOwners.get(granted) !== effect.id) throw new Error('Ambiguous Activity grant: ' + granted)
    grantOwners.set(granted, effect.id)
    const child = activities.find(candidate => candidate.id === granted)!
    // A shared legacySource must not make a temporary follow-up permanently usable.
    const requirements = child.requirements ?? []
    if (!requirements.some(r => r.kind === 'active-effect' && r.subject === 'actor' && r.effectId === effect.id && r.present)) {
      child.requirements = [...requirements, { kind: 'active-effect', subject: 'actor', effectId: effect.id, present: true, source: 'any' }]
    }
    if (activity.legacySource?.kind === 'spell') {
      const sourceDc: Dnd5eFormulaV1 = { kind: 'reference', reference: { kind: 'actor-active-effect-source-spell-save-dc', effectId: effect.id } }
      child.checks = child.checks?.map(check => {
        if (check.kind === 'saving-throw' && check.dc.kind === 'reference' && check.dc.reference.kind === 'actor-spell-save-dc') return { ...check, dc: sourceDc }
        if (check.kind === 'attack-roll' && check.attackBonus.kind === 'reference' && check.attackBonus.reference.kind === 'actor-spell-attack-bonus') return { ...check, attackBonus: { kind: 'add', values: [sourceDc, { kind: 'constant', value: -8 }] } }
        return check
      })
    }
  }
  for (const activity of activities) {
    const errors = validateDnd5eActivityDefinitionV1(activity)
    if (errors.length) throw new Error('Expanded Activity ' + activity.id + ': ' + errors.join('; '))
  }
  owner.activities = activities
  delete owner.activityPatterns
  return root
}
