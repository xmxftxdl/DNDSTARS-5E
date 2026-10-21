import { dnd5eCombatantPairKey } from '../headlessCombatPrimitives'
import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { applyDnd5eStandardConditionEffect, createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { registerDnd5eActivityPackage } from './dnd5eActivityRegistry'
import { compileDnd5eActivityHeadlessAction } from './dnd5eActivityHeadlessCompiler'
import { dnd5ePluginFeatureActionFromActivityV1 } from './dnd5eActivityFeatureActionAdapter'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './dnd5eActivityCombatAuthority'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import { rollDnd5eActivityTriggerDiceV1 } from './dnd5eActivityTriggerSettlement'
import { dnd5eActivitySaveGateResultV1 } from './dnd5eActivitySaveGate'
import { filterDnd5eConditionalActivityRollDeclarationsV1 } from './dnd5eActivityPerTargetRolls'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

const activity: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1, id: 'save-table', name: 'Synthetic save table', activation: { kind: 'free' },
  target: { kind: 'creature', relation: 'any', count: 2, rangeFeet: 60 },
  legacySource: { kind: 'feature', id: 'save-table' },
  checks: [
    { id: 'save', kind: 'saving-throw', rollId: 'save', ability: 'con', scope: 'per-target', dc: { kind: 'constant', value: 12 } },
    { id: 'table', kind: 'random-roll', rollId: 'table', count: 1, sides: 4, scope: 'per-target',
      appliesWhenSave: { checkId: 'save', result: 'failure' } },
  ], outcomes: [{ id: 'hurt', when: { kind: 'check-total', checkId: 'table', minimum: 1 },
    operations: [{ id: 'hurt', kind: 'damage', target: 'target', amount: { kind: 'constant', value: 3 }, damageType: 'poison' }] }],
  automation: automationCapabilityFromLegacyStatus('full'),
}
const make = (id: string) => createDnd5eCombatant({ id, name: id, controller: 'dm', initiative: 10,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
  armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })

it('opens later sequential save gates after a Host counter success without inventing a d20', () => {
  const definition = structuredClone(activity)
  const save = definition.checks![0]
  if (save.kind !== 'saving-throw') throw Error('fixture')
  save.stopAfterFirstFailure = true
  const input = {
    activity: definition, actor: dnd5eActivityActorSnapshotFromCombatantV1(make('actor')),
    targets: ['first', 'second'].map(id => dnd5eActivityActorSnapshotFromCombatantV1(make(id))),
    rolls: { 'save:second': { values: [1] } },
    weaponCounterattackSuccessCheckKeys: new Set(['save:first']),
  }
  expect(dnd5eActivitySaveGateResultV1(input, [], 'save', 'first')).toBe(true)
  expect(dnd5eActivitySaveGateResultV1(input, [], 'save', 'second')).toBe(false)
  expect(dnd5eActivitySaveGateResultV1({ ...input,
    weaponCounterattackSuccessCheckKeys: new Set(['save:unrelated']),
  }, [], 'save', 'second')).toBeUndefined()
  expect(input.rolls).not.toHaveProperty('save:first')
})

it.each([
  [1, 'appliesWhenCheck', { checkId: 'save', result: 'success' }],
  [0, 'appliesWhenSave', { checkId: 'save', result: 'failure' }],
  [0, 'appliesWhenCheckTotal', { checkId: 'table', minimum: 1 }],
  [0, 'minimumTargetSpeedFeet', 1],
] as const)('rejects a gate placed on an unsupported check (%s, %s)', (index, key, value) => {
  const invalid = structuredClone(activity)
  Object.assign(invalid.checks![index], { [key]: value })
  expect(validateDnd5eActivityDefinitionV1(invalid)).toContainEqual(expect.stringContaining(`.${key} requires`))
})

function attackSaveTable(): Dnd5eActivityDefinitionV1 {
  const definition = structuredClone(activity)
  Object.assign(definition.checks![0], { appliesWhenCheck: { checkId: 'attack', result: 'success' } })
  definition.checks = [{ id: 'attack', kind: 'attack-roll', rollId: 'attack', scope: 'per-target',
    attackBonus: { kind: 'constant', value: 0 }, delivery: 'melee', rollMode: 'normal',
    appliesWhenChoice: { choiceId: 'mode', optionIds: ['on'] } }, ...definition.checks!]
  definition.choices = [{ id: 'mode', label: 'Mode', options: [{ id: 'on', label: 'On' }, { id: 'off', label: 'Off' }] }]
  return definition
}

it.each(['on', 'off'])('does not open a save-dependent table from an inactive or missed attack (%s)', mode => {
  const definition = attackSaveTable()
  expect(validateDnd5eActivityDefinitionV1(definition)).toEqual([])
  const input = { activity: definition, actor: dnd5eActivityActorSnapshotFromCombatantV1(make('actor')),
    targets: [dnd5eActivityActorSnapshotFromCombatantV1(make('target'))], choices: { mode },
    rolls: { 'attack:target': { values: [mode === 'on' ? 1 : 20] }, 'save:target': { values: [1] } } }
  expect(dnd5eActivitySaveGateResultV1(input, [], 'save', 'target')).toBeUndefined()
})

it.each(['on', 'off'])('collects attack → save → random table only for active successful attacks (%s)', async mode => {
  const definition = attackSaveTable()
  const state = startDnd5eHeadlessCombat('attack-save-table', [make('actor'), make('a'), make('b')])
  const requested: string[] = []
  const result = await rollDnd5eActivityTriggerDiceV1({ state, actorId: 'actor', targetIds: ['a', 'b'], choices: { mode },
    available: { packageId: 'test.save-gate', packageVersion: '1.0.0', activity: definition, confirmation: 'automatic', retention: 'single-event' },
    triggerContext: { eventId: 'hit', event: 'attack-hit', source: { kind: 'attack', mode: 'melee', id: 'attack' }, eligibleActorIds: ['actor'], eligibleTargetIds: ['a', 'b'] },
    roll: async request => { requested.push(request.id); return [request.id === 'attack:a' ? 15 : 1] },
  })
  expect(result).not.toHaveProperty('unsupported')
  expect(requested).toEqual(mode === 'on' ? ['attack:a', 'attack:b', 'save:a', 'table:a'] : [])
})

it('uses the same save result in dice requests and execution, without treating pending saves as failures', () => {
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  const input = { activity, actor: dnd5eActivityActorSnapshotFromCombatantV1(make('actor')),
    targets: ['a', 'b'].map(id => dnd5eActivityActorSnapshotFromCombatantV1(make(id))),
    rolls: { 'save:a': { values: [15] }, 'save:b': { values: [5] } }, distanceFeetByTargetId: { a: 5, b: 5 } }
  const declarations = ['a', 'b', 'pending'].map(id => ({ id: `table:${id}`, label: id, count: 1, sides: 4 }))
  expect(filterDnd5eConditionalActivityRollDeclarationsV1({ activity, declarations, successfulCheckKeys: new Set(),
    savingThrowResult: (check, target) => dnd5eActivitySaveGateResultV1(input, [], check, target),
  }).map(d => d.id)).toEqual(['table:b'])
  const result = resolveDnd5eActivity({ ...input, rolls: { ...input.rolls, 'table:b': { values: [2] } } })
  expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
  if (!result.ok) return
  expect(result.checks.map(check => check.key)).toEqual(['save:a', 'save:b', 'table:b'])
  expect(result.proposals).toEqual([expect.objectContaining({ kind: 'deal-damage', targetId: 'b', amount: 3 })])
})

it.each([false, true])('requests the failed target table only from the trigger collector (restrained: %s)', async restrained => {
  const definition = structuredClone(activity)
  Object.assign(definition.checks![1], { minimumTargetSpeedFeet: 1 })
  const state = startDnd5eHeadlessCombat('gates', [make('actor'), make('a'), make('b')])
  if (restrained) state.combatants.b.conditions = ['restrained']
  const requested: string[] = []
  const result = await rollDnd5eActivityTriggerDiceV1({ state, actorId: 'actor', targetIds: ['a', 'b'],
    available: { packageId: 'test.save-gate', packageVersion: '1.0.0', activity: definition, confirmation: 'automatic', retention: 'single-event' },
    triggerContext: { eventId: 'hit', event: 'attack-hit', source: { kind: 'attack', mode: 'melee', id: 'attack' }, eligibleActorIds: ['actor'], eligibleTargetIds: ['a', 'b'] },
    roll: async request => { requested.push(request.id); return [request.id === 'save:a' ? 15 : request.id === 'save:b' ? 5 : 2] },
  })
  expect(result).not.toHaveProperty('unsupported')
  expect(requested).toEqual(restrained ? ['save:a', 'save:b'] : ['save:a', 'save:b', 'table:b'])
})

it.each(['advantage', 'disadvantage'] as const)('uses the resolved Host %s mode instead of the first die', mode => {
  const definition = structuredClone(activity)
  Object.assign(definition.checks![0], { rollMode: 'host-derived' })
  const input = { activity: definition, actor: dnd5eActivityActorSnapshotFromCombatantV1(make('actor')),
    targets: [dnd5eActivityActorSnapshotFromCombatantV1(make('target'))],
    rolls: { 'save:target': { values: [5, 15] } } }
  expect(dnd5eActivitySaveGateResultV1(input, [{ id: 'save:target', label: 'Save', count: 2, sides: 20, d20RollMode: mode }], 'save', 'target'))
    .toBe(mode === 'advantage')
})

it('preserves willing failure and condition-immunity success when opening a dependent table', () => {
  const definition = structuredClone(activity)
  Object.assign(definition.checks![0], { allowWillingFailure: true, automaticSuccessIfConditionImmune: 'charmed' })
  const actor = dnd5eActivityActorSnapshotFromCombatantV1(make('actor'))
  const target = dnd5eActivityActorSnapshotFromCombatantV1(make('target'))
  const input = { activity: definition, actor, targets: [target], rolls: { 'save:target': { values: [20] } }, willingTargetIds: ['target'] }
  expect(dnd5eActivitySaveGateResultV1(input, [], 'save', 'target')).toBe(false)
  target.conditionImmunities = ['charmed']
  expect(dnd5eActivitySaveGateResultV1(input, [], 'save', 'target')).toBe(true)
})

it.each([[5, 30], [15, 30], [5, 0], [15, 0]])('validates exact Host dice recipes after save %s with speed %s', (save, speed) => {
  const definition: Dnd5eActivityDefinitionV1 = { ...structuredClone(activity), target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 60 } }
  Object.assign(definition.checks![1], { minimumTargetSpeedFeet: 1 })
  definition.outcomes[0].when = { kind: 'check', checkId: 'save', result: 'failure' }
  definition.outcomes = [...definition.outcomes, { id: 'move', when: { kind: 'check-total', checkId: 'table', minimum: 2, maximum: 2 },
    operations: [{ id: 'move', kind: 'move', target: 'target', mode: 'forced', cardinalDirection: 'east', distanceFeet: { kind: 'constant', value: 5 } }] }]
  const packageId = 'test.save-gate'
  const registration = registerDnd5eActivityPackage({ packageId, packageVersion: '1.0.0', activities: [definition] })
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: packageId, name: 'Save gate', version: '1.0.0', apiVersion: 2,
    rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
    api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(definition))
    api.registerFeature({ id: activity.id, name: activity.name, summary: 'Synthetic', description: 'Synthetic', automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(definition) })
  } })
  try {
    const state = startDnd5eHeadlessCombat('save-gate', [make('actor'), make('target')])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('actor', 'target')]: 5 }
    if (speed === 0) applyDnd5eStandardConditionEffect(state.combatants.target, state.combatants.actor, {
      rulesId: 'test-restraint', condition: 'restrained', duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
      sourceKind: 'feature',
    }, [])
    state.combatants.actor.pluginFeatureIds = [`${packageId}:${activity.id}`]
    const roll = (value: number) => ({ values: [value], modifier: 0, total: value })
    const run = (includeTable: boolean) => resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: packageId,
      actionId: activity.id, featureId: `${packageId}:${activity.id}`, actorId: 'actor', targetId: 'target', distanceFeet: 5,
      rolls: { 'save:target': roll(save), ...(includeTable ? { 'table:target': roll(2) } : {}) } })
    const needsTable = save < 12 && speed > 0
    const result = run(needsTable)
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (result.ok) {
      expect(result.state.combatants.target.currentHp).toBe(save < 12 ? 17 : 20)
      expect(result.activityHandoffs?.movements ?? []).toHaveLength(needsTable ? 1 : 0)
    }
    expect(run(!needsTable).ok).toBe(false)
    expect(state.combatants.target.currentHp).toBe(20)
  } finally { dispose(); registration.dispose() }
})

it.each([undefined, NaN, Infinity, -1, 0, 1, 30])('gates random dice on known Host speed without cancelling save damage (%s)', speed => {
  const definition = structuredClone(activity)
  Object.assign(definition.checks![1], { minimumTargetSpeedFeet: 1 })
  definition.outcomes[0].when = { kind: 'check', checkId: 'save', result: 'failure' }
  const wantsTable = Number.isFinite(speed) && speed! >= 1
  const declarations = [{ id: 'table:target', label: 'Table', count: 1, sides: 4 }]
  expect(filterDnd5eConditionalActivityRollDeclarationsV1({ activity: definition, declarations,
    successfulCheckKeys: new Set(), savingThrowResult: () => false, targetSpeedFeet: () => speed,
  })).toHaveLength(wantsTable ? 1 : 0)
  const result = resolveDnd5eActivity({ activity: definition,
    actor: dnd5eActivityActorSnapshotFromCombatantV1(make('actor')),
    targets: [{ ...dnd5eActivityActorSnapshotFromCombatantV1(make('target')), speed }],
    rolls: { 'save:target': { values: [1] }, ...(wantsTable ? { 'table:target': { values: [2] } } : {}) },
    distanceFeetByTargetId: { target: 5 },
  })
  expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
  if (!result.ok) return
  expect(result.checks.filter(check => check.kind === 'random-roll')).toHaveLength(wantsTable ? 1 : 0)
  expect(result.proposals).toEqual([expect.objectContaining({ kind: 'deal-damage', amount: 3 })])
})

it.each([-1, NaN, Infinity, '1'])('rejects invalid random-table speed thresholds (%s)', minimumTargetSpeedFeet => {
  const invalid = structuredClone(activity)
  Object.assign(invalid.checks![1], { minimumTargetSpeedFeet })
  expect(validateDnd5eActivityDefinitionV1(invalid).some(error => error.includes('minimumTargetSpeedFeet'))).toBe(true)
})

it.each([{ checkId: 'missing', result: 'failure' }, { checkId: 'table', result: 'failure' }, { checkId: 'save', result: 'unknown' }])('rejects invalid save dependencies %j', gate => {
  const invalid = structuredClone(activity)
  Object.assign(invalid.checks![1], { appliesWhenSave: gate })
  expect(validateDnd5eActivityDefinitionV1(invalid).some(error => error.includes('appliesWhenSave'))).toBe(true)
})
