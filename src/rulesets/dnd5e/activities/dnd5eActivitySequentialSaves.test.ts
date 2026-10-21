import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, dnd5eCombatantPairKey } from '../headlessCombatEngine'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { registerDnd5eActivityPackage } from './dnd5eActivityRegistry'
import { compileDnd5eActivityHeadlessAction } from './dnd5eActivityHeadlessCompiler'
import { dnd5ePluginFeatureActionFromActivityV1 } from './dnd5eActivityFeatureActionAdapter'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './dnd5eActivityCombatAuthority'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import { filterDnd5eConditionalActivityRollDeclarationsV1 } from './dnd5eActivityPerTargetRolls'
import { dnd5eActivitySaveGateResultV1 } from './dnd5eActivitySaveGate'
import { rollDnd5eActivityTriggerDiceV1 } from './dnd5eActivityTriggerSettlement'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

const definition: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1, id: 'ordered-impact', name: 'Ordered impact', activation: { kind: 'free' },
  target: { kind: 'creature', relation: 'any', count: 3, rangeFeet: 150 },
  checks: [{ id: 'save', kind: 'saving-throw', ability: 'dex', rollId: 'save', scope: 'per-target',
    stopAfterFirstFailure: true, dc: { kind: 'constant', value: 12 } }],
  outcomes: [{ id: 'impact', when: { kind: 'check', checkId: 'save', result: 'failure' },
    operations: [{ id: 'impact', kind: 'damage', target: 'target', amount: { kind: 'constant', value: 10 }, damageType: 'bludgeoning' }] }],
  automation: automationCapabilityFromLegacyStatus('full'),
}
const make = (id: string) => createDnd5eCombatant({ id, name: id, controller: 'dm', initiative: 10,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
  armorClass: 10, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
const actor = dnd5eActivityActorSnapshotFromCombatantV1(make('actor'))
const targets = ['a','b','c'].map(id => dnd5eActivityActorSnapshotFromCombatantV1(make(id)))
const declarations = targets.map(t => ({ id: `save:${t.id}`, label: t.id, sides: 20, count: 1 }))

it.each([0,1,2,3])('stops at failed target index %s and never needs later dice', async failureIndex => {
  expect(validateDnd5eActivityDefinitionV1(definition)).toEqual([])
  const rolls = Object.fromEntries(targets.slice(0, failureIndex + 1).map((t,index) => [`save:${t.id}`, { values: [index === failureIndex ? 5 : 15] }]))
  const input = { activity: definition, actor, targets, rolls, distanceFeetByTargetId: { a: 5, b: 10, c: 15 } }
  const result = resolveDnd5eActivity(input)
  expect(result.ok, JSON.stringify(result)).toBe(true)
  if (result.ok) {
    expect(result.checks).toHaveLength(Math.min(3, failureIndex + 1))
    expect(result.proposals.filter(p => p.kind === 'deal-damage')).toEqual(failureIndex < 3
      ? [expect.objectContaining({ targetId: targets[failureIndex].id, amount: 10 })] : [])
  }
  const requested: string[] = []
  const state = startDnd5eHeadlessCombat('ordered', [make('actor'), ...targets.map(t => make(t.id))])
  const collected = await rollDnd5eActivityTriggerDiceV1({ state, actorId: 'actor', targetIds: targets.map(t => t.id),
    available: { packageId: 'test.ordered', packageVersion: '1.0.0', activity: definition, confirmation: 'automatic', retention: 'single-event' },
    triggerContext: { eventId: 'test-hit', event: 'attack-hit', source: { kind: 'attack', mode: 'melee', id: 'attack' }, eligibleActorIds: ['actor'], eligibleTargetIds: targets.map(t => t.id) },
    roll: async request => { requested.push(request.id); return [request.id === `save:${targets[failureIndex]?.id}` ? 5 : 15] },
  })
  expect(collected).not.toHaveProperty('unsupported')
  expect(requested).toEqual(targets.slice(0, failureIndex + 1).map(t => `save:${t.id}`))
})

it('requests only the next proven-reachable target, retaining the full order as pending dice shrink', () => {
  const ready = (rolls: Record<string, { values: number[] }>, pending = declarations) => filterDnd5eConditionalActivityRollDeclarationsV1({
    activity: definition, declarations: pending, orderedTargetIds: targets.map(t => t.id), successfulCheckKeys: new Set(),
    savingThrowResult: (checkId, targetId) => dnd5eActivitySaveGateResultV1({ activity: definition, actor, targets, rolls }, declarations, checkId, targetId),
  }).map(d => d.id)
  expect(ready({})).toEqual(['save:a'])
  expect(ready({ 'save:a': { values: [15] } }, declarations.slice(1))).toEqual(['save:b'])
  expect(ready({ 'save:a': { values: [15] }, 'save:b': { values: [5] } }, declarations.slice(2))).toEqual([])
  expect(dnd5eActivitySaveGateResultV1({ activity: definition, actor, targets,
    rolls: { 'save:a': { values: [5] }, 'save:b': { values: [15] }, 'save:c': { values: [5] } } }, declarations, 'save','c')).toBeUndefined()
})

it.each([{ scope: 'shared', stopAfterFirstFailure: true }, { stopAfterFirstFailure: false }, { stopAfterFirstFailure: 'yes' }])('rejects invalid sequential-save metadata %j', patch => {
  const invalid = structuredClone(definition)
  Object.assign(invalid.checks![0], patch)
  expect(validateDnd5eActivityDefinitionV1(invalid).some(e => e.includes('stopAfterFirstFailure'))).toBe(true)
})

it.each([0,1,2,3])('compiled Host action validates only reachable dice and commits exactly one impact (%s)', failureIndex => {
  const packageId = 'test.ordered'
  const registration = registerDnd5eActivityPackage({ packageId, packageVersion: '1.0.0', activities: [definition] })
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: packageId, name: 'Ordered', version: '1.0.0', apiVersion: 2,
    rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
    api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(definition))
    api.registerFeature({ id: definition.id, name: definition.name, summary: 'Test', description: 'Test', automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(definition) })
  } })
  try {
    const state = startDnd5eHeadlessCombat('ordered', [make('actor'), ...targets.map(t => make(t.id))])
    state.distanceFeetByCombatantPair = Object.fromEntries(targets.map(t => [dnd5eCombatantPairKey('actor', t.id), 5]))
    state.combatants.actor.pluginFeatureIds = [`${packageId}:${definition.id}`]
    const rolls = Object.fromEntries(targets.slice(0, failureIndex + 1).map((t,index) => {
      const value = index === failureIndex ? 5 : 15
      return [`save:${t.id}`, { values: [value], modifier: 0, total: value }]
    }))
    const result = resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: packageId, actionId: definition.id,
      featureId: `${packageId}:${definition.id}`, actorId: 'actor', targetId: 'a', targetIds: targets.map(t => t.id), distanceFeet: 5, rolls })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (result.ok) for (const [index,target] of targets.entries()) expect(result.state.combatants[target.id].currentHp).toBe(index === failureIndex ? 20 : 30)
    expect(state.combatants.a.currentHp).toBe(30)
  } finally { dispose(); registration.dispose() }
})
