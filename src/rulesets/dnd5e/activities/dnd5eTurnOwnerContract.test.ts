import { dnd5eActivityAutomationAnalysisV1 } from '../plugins/pluginMechanicsRegistry'
import { afterEach, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from '../headlessCombatEngine'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { resolveRegisteredDnd5eActivityInCombatV1, dnd5eActivityActorSnapshotFromCombatantV1 } from './dnd5eActivityCombatAuthority'
import { clearDnd5eActivityRegistryForTests, registerDnd5eActivityPackage } from './dnd5eActivityRegistry'
import { compileDnd5eActivityHeadlessAction } from './dnd5eActivityHeadlessCompiler'
import { dnd5ePluginFeatureActionFromActivityV1 } from './dnd5eActivityFeatureActionAdapter'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { settleDnd5eActivityTriggerWindowsV1 } from './dnd5eActivityTriggerSettlement'
import { createDnd5eConditionEffect } from '../activeEffects'
import { dnd5eCombatantPairKey } from '../headlessCombatPrimitives'
import { listDnd5eActivityTriggerWindowsV1 } from './dnd5eActivityTriggerWindows'
import { exportDnd5eStarMod, readDnd5eStarMod } from '../starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from '../unifiedContent'
const definition = (owner: 'actor' | 'other'): Dnd5eActivityDefinitionV1 => ({
  schemaVersion: 1, id: 'turn-benefit', name: 'Turn benefit', activation: { kind: 'free' },
  target: { kind: 'self' }, requirements: [{ kind: 'turn-owner', owner }],
  legacySource: { kind: 'feature', id: 'turn-benefit' }, automation: automationCapabilityFromLegacyStatus('full'),
  outcomes: [{ id: 'grant', when: { kind: 'always' }, operations: [{ id: 'hp', kind: 'temporary-hit-points', target: 'actor', amount: { kind: 'constant', value: 3 } }] }],
})
function combat() {
  const actor = (id: string, initiative: number) => createDnd5eCombatant({
    id, name: id, initiative, controller: 'player', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 2, armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30,
    position: { x: 0, y: 0 }, concentrating: false, pluginFeatureIds: ['turn-benefit'],
  })
  return startDnd5eHeadlessCombat('turn-check', [actor('actor', 20), actor('other', 10)])
}
afterEach(clearDnd5eActivityRegistryForTests)
it.each(['near', 'far', 'ally', 'unowned'] as const)('dispatches independent other-turn-end windows: %s', async mode => {
  const activity: Dnd5eActivityDefinitionV1 = { ...definition('other'), requirements: [],
    activation: { kind: 'reaction' },
    consumption: [{ kind: 'action-economy', economy: 'reaction', amount: 1, consumeOn: 'resolve' }],
    target: { kind: 'creature', count: 1, relation: 'enemy', rangeFeet: 5 },
    invocation: { kind: 'triggered', event: 'other-turn-end', confirmation: 'actor-choice', retention: 'single-event' } }
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  expect(dnd5eActivityAutomationAnalysisV1(activity).missingComponents).toEqual([])
  registerDnd5eActivityPackage({ packageId: 'test.observer', packageVersion: '1.0.0', activities: [activity] })
  const before = combat()
  before.combatants.actor.controller = mode === 'ally' ? 'player' : 'dm'
  before.combatants.third = { ...structuredClone(before.combatants.other), id: 'third', name: 'third' }
  before.initiativeOrder = [...before.initiativeOrder, 'third']
  for (const actor of Object.values(before.combatants)) actor.pluginFeatureIds = mode === 'unowned' ? [] : ['test.observer:turn-benefit']
  before.distanceFeetByCombatantPair = Object.fromEntries(['other', 'third'].map(id =>
    [dnd5eCombatantPairKey('actor', id), mode === 'far' ? 10 : 5]))
  const ended = resolveDnd5eHeadlessAction(before, { type: 'end-turn', actorId: 'actor' })
  expect(ended.ok).toBe(true)
  const windows = listDnd5eActivityTriggerWindowsV1({ state: ended.state, events: ended.events, eventBatchId: 'observer-end' })
    .filter(window => window.triggerContext.event === 'other-turn-end')
  if (mode !== 'unowned') {
    expect(windows.map(window => window.triggerContext.eligibleActorIds[0]).sort()).toEqual(['other', 'third'])
    expect(new Set(windows.map(window => window.triggerContext.eventId)).size).toBe(2)
    expect(windows.every(window => window.triggerContext.eligibleTargetIds.join() === 'actor')).toBe(true)
  } else expect(windows).toEqual([])
  const settle = (state: typeof before) => settleDnd5eActivityTriggerWindowsV1({ state, combatRevision: 1,
    events: [...ended.events], eventBatchId: 'observer-end', confirm: async () => true, roll: async () => [] })
  const result = await settle(ended.state)
  expect(result.state.combatants.actor.temporaryHp).toBe(0)
  for (const id of ['other', 'third']) {
    expect(result.state.combatants[id].temporaryHp, JSON.stringify(result.diagnostics)).toBe(mode === 'near' ? 3 : 0)
    expect(result.state.combatants[id].turn.reactionAvailable).toBe(mode !== 'near')
  }
  const replay = await settle(JSON.parse(JSON.stringify(result.state)))
  expect(replay.state.combatants).toEqual(result.state.combatants)
})
it.each(['eligible', 'target-threshold', 'half-hp', 'low-class-level', 'inactive', 'incapacitated', 'stunned', 'unowned'] as const)(
  'settles a combat-only turn-end healing recipe with Host boundaries: %s', async mode => {
  const activity: Dnd5eActivityDefinitionV1 = { ...definition('actor'), activation: { kind: 'special' },
    requirements: [{ kind: 'combat-active' }, { kind: 'class-level', classId: 'paladin', minimum: 15 },
      { kind: 'condition', subject: 'actor', condition: 'incapacitated', present: false },
      { kind: 'hp-value', subject: 'actor', comparison: 'below', value: { kind: 'multiply', values: [
        { kind: 'reference', reference: { kind: mode === 'target-threshold' ? 'target-max-hp' : 'actor-max-hp' } }, { kind: 'constant', value: 0.5 }] } }],
    invocation: { kind: 'triggered', event: 'turn-end', confirmation: 'automatic', retention: 'single-event' },
    outcomes: [{ id: 'heal', when: { kind: 'always' }, operations: [{ id: 'heal', kind: 'healing', target: 'actor',
      amount: { kind: 'add', values: [{ kind: 'dice', rollId: 'heal', count: 1, sides: 6 },
        { kind: 'floor', value: { kind: 'multiply', values: [{ kind: 'reference', reference: { kind: 'actor-class-level', classId: 'paladin' } }, { kind: 'constant', value: 0.5 }] } }] } }] }],
  }
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  const namespace = 'test.heal-scope'
  const bundle: Dnd5eUnifiedContentBundleV1 = { format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Synthetic turn healing', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' },
    assets: [], definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'turn-benefit', name: 'Turn benefit', automation: activity.automation,
      payload: { id: 'turn-benefit', name: 'Turn benefit', summary: 'Synthetic', description: 'Synthetic', automation: 'full' }, activities: [activity] }] }
  const decoded = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
  try {
  const before = combat(), actor = before.combatants.actor
  actor.pluginFeatureIds = mode === 'unowned' ? [] : ['test.heal-scope:turn-benefit']
  actor.level = 20
  actor.classLevels = { paladin: mode === 'low-class-level' ? 14 : 15, fighter: 5 }
  actor.maxHp = 40
  actor.currentHp = mode === 'half-hp' ? 20 : 19
  if (mode === 'incapacitated' || mode === 'stunned') actor.classState.activeEffects = [createDnd5eConditionEffect({
    condition: mode, targetId: actor.id, source: { kind: 'system' } })]
  const ended = resolveDnd5eHeadlessAction(before, { type: 'end-turn', actorId: actor.id })
  expect(ended.ok).toBe(true)
  ended.state.active = mode !== 'inactive'
  let rolls = 0
  const settle = (state: typeof before) => settleDnd5eActivityTriggerWindowsV1({ state, combatRevision: 1,
    events: [...ended.events], eventBatchId: 'healing-end', confirm: async () => true,
    roll: async () => { rolls += 1; return [3] } })
  const result = await settle(ended.state)
  const eligible = mode === 'eligible' || mode === 'target-threshold'
  expect(result.state.combatants.actor.currentHp, JSON.stringify(result.diagnostics)).toBe(eligible ? 29 : actor.currentHp)
  expect(rolls).toBe(eligible ? 1 : 0)
  const replay = await settle(JSON.parse(JSON.stringify(result.state)))
  expect(replay.state.combatants.actor.currentHp).toBe(result.state.combatants.actor.currentHp)
  expect(rolls).toBe(eligible ? 1 : 0)
  } finally { dispose() }
})
it.each([true, false])('checks combat scope after turn ownership advances, active=%s', async active => {
  const activity: Dnd5eActivityDefinitionV1 = { ...definition('actor'), activation: { kind: 'special' },
    requirements: [{ kind: 'combat-active' }],
    invocation: { kind: 'triggered', event: 'turn-end', confirmation: 'automatic', retention: 'single-event' } }
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  expect(dnd5eActivityAutomationAnalysisV1(activity).missingComponents).toEqual([])
  registerDnd5eActivityPackage({ packageId: 'test.combat-scope', packageVersion: '1.0.0', activities: [activity] })
  const before = combat()
  before.combatants.actor.pluginFeatureIds = ['test.combat-scope:turn-benefit']
  const ended = resolveDnd5eHeadlessAction(before, { type: 'end-turn', actorId: 'actor' })
  expect(ended.ok).toBe(true)
  const state = ended.state
  expect(state.initiativeOrder[state.initiativeIndex]).toBe('other')
  state.active = active
  const result = await settleDnd5eActivityTriggerWindowsV1({ state, combatRevision: 1,
    events: [...ended.events], eventBatchId: 'scope-end',
    confirm: async () => { throw Error('Automatic scope must not prompt') }, roll: async () => [] })
  expect(result.state.combatants.actor.temporaryHp, JSON.stringify(result.diagnostics)).toBe(active ? 3 : 0)
  expect(result.state.combatants.other.temporaryHp).toBe(0)
  expect(state.combatants.actor.temporaryHp).toBe(0)
  const snapshot = dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.actor)
  for (const combatActive of [undefined, false, true]) {
    const resolved = resolveDnd5eActivity({ activity: { ...activity, invocation: undefined }, actor: snapshot, targets: [snapshot], rolls: {}, combatActive })
    expect(resolved.ok).toBe(combatActive === true)
  }
})
it.each(['actor', 'other'] as const)('requires a known live turn for %s and validates the public selector', owner => {
  const activity = definition(owner)
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  expect(dnd5eActivityAutomationAnalysisV1(activity).missingComponents).toEqual([])
  expect(validateDnd5eActivityDefinitionV1({ ...activity, requirements: [{ kind: 'turn-owner', owner: 'unknown' }] } as any).length).toBeGreaterThan(0)
  const state = combat(), snapshot = dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.actor)
  for (const turn of [undefined, '', 'actor', 'other']) {
    const result = resolveDnd5eActivity({ activity, actor: snapshot, targets: [snapshot], rolls: {}, currentTurnActorId: turn })
    expect(result.ok).toBe(turn === owner)
    const ended = resolveDnd5eActivity({ activity, actor: snapshot, targets: [snapshot], rolls: {}, currentTurnActorId: turn, combatActive: false })
    expect(ended.ok).toBe(false)
  }
})
it('derives turn ownership from the registered Host state and ignores forged command fields', () => {
  registerDnd5eActivityPackage({ packageId: 'test.turn-owner', packageVersion: '1.0.0', activities: [definition('actor')] })
  const state = combat()
  const command = { schemaVersion: 1 as const, commandId: 'turn-request', actorId: 'actor', packageId: 'test.turn-owner',
    packageVersion: '1.0.0', activityId: 'turn-benefit', targetIds: ['actor'], expectedRevision: 1, currentTurnActorId: 'actor' }
  const run = () => resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1, command, authoritativeRolls: {}, confirmedBy: 'actor' })
  expect(run().result.ok).toBe(true)
  state.initiativeIndex = 1
  expect(run().result.ok).toBe(false)
  state.initiativeIndex = 0
  state.active = false
  expect(run().result.ok).toBe(false)
  expect(state.combatants.actor.temporaryHp).toBe(0)
})
it('checks the compiled plugin against Host turn state even when the action allows off-turn execution', () => {
  const activity = definition('actor'), packageId = 'test.compiled-turn-owner'
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: packageId, name: 'Turn test', version: '1.0.0', apiVersion: 2,
    rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
    api.registerHeadlessAction({ ...compileDnd5eActivityHeadlessAction(activity), allowOffTurn: true })
    api.registerFeature({ id: activity.id, name: 'Turn test', summary: 'Synthetic', description: 'Synthetic', automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(activity) })
  } })
  try {
    const state = combat()
    state.combatants.actor.pluginFeatureIds = [`${packageId}:${activity.id}`]
    const action = { type: 'plugin' as const, pluginId: packageId, actionId: activity.id, featureId: `${packageId}:${activity.id}`,
      actorId: 'actor', targetId: 'actor', targetIds: ['actor'], rolls: {}, payload: { currentTurnActorId: 'actor' } }
    expect(resolveDnd5eHeadlessAction(state, action).ok).toBe(true)
    state.initiativeIndex = 1
    const rejected = resolveDnd5eHeadlessAction(state, action)
    expect(rejected.ok).toBe(false)
    expect(rejected.state.combatants.actor.temporaryHp).toBe(0)
    state.initiativeIndex = 0
    state.active = false
    expect(resolveDnd5eHeadlessAction(state, action).ok).toBe(false)
  } finally { dispose() }
})

