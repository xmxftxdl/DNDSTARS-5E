import {describe, expect, it} from 'vitest'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'
import {createDnd5eCombatant, startDnd5eHeadlessCombat, commitDnd5eActivityExecution, resolveDnd5eHeadlessAction} from '../headlessCombatEngine'
import {registerDnd5eRulesPlugin} from '../pluginApi'
import {dnd5eCombatantPairKey} from '../headlessCombatPrimitives'
import {compileDnd5eActivityHeadlessAction} from './dnd5eActivityHeadlessCompiler'
import {dnd5ePluginFeatureActionFromActivityV1} from './dnd5eActivityFeatureActionAdapter'
import {dnd5eActivityActorSnapshotFromCombatantV1 as snapshot} from './dnd5eActivityCombatAuthority'
import {resolveDnd5eActivity} from './dnd5eActivityExecutor'
import {validateDnd5eActivityDefinitionV1} from './dnd5eActivityValidation'
import type {Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'

function activity(drain = false): Dnd5eActivityDefinitionV1 {
  return {schemaVersion: 1, id: 'transfer', name: 'Transfer', activation: {kind: 'action'}, target: {kind: 'creature', relation: 'any', rangeFeet: 30, count: 1}, automation: automationCapabilityFromLegacyStatus('full'), outcomes: [{id: 'resolve', when: {kind: 'always'}, operations: [
    {id: 'cost', kind: 'damage', target: drain ? 'target' : 'actor', amount: {kind: 'constant', value: 14}, damageType: 'necrotic', magical: true},
    {id: 'benefit', kind: 'healing', target: drain ? 'actor' : 'target', amount: {kind: 'constant', value: 0}, damageResult: {operationId: 'cost', subject: drain ? 'target' : 'actor', multiplier: drain ? 0.5 : 2}},
  ]}]}
}
function fixture(defense: 'none' | 'resistant' | 'immune' | 'vulnerable' = 'none', temporaryHp = 0) {
  const actor = createDnd5eCombatant({id: 'actor', name: 'Actor', controller: 'player', initiative: 20, level: 5, abilities: {str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10}, proficiencyBonus: 3, armorClass: 14, currentHp: 50, maxHp: 100, temporaryHp, speed: 30, saveDc: 15, position: {x: 0, y: 0}, concentrating: false,
    damageResistances: defense === 'resistant' ? ['necrotic'] : [], damageImmunities: defense === 'immune' ? ['necrotic'] : [], damageVulnerabilities: defense === 'vulnerable' ? ['necrotic'] : []})
  const target = createDnd5eCombatant({...actor, id: 'target', controller: 'dm', initiative: 10, currentHp: 1, temporaryHp: 0, damageResistances: [], damageImmunities: [], damageVulnerabilities: []})
  const state = startDnd5eHeadlessCombat('transfer-test', [actor, target])
  state.distanceFeetByCombatantPair = {[dnd5eCombatantPairKey('actor', 'target')]: 10}
  return state
}
function resolve(state: ReturnType<typeof fixture>, definition = activity()) {
  return resolveDnd5eActivity({activity: definition, actor: snapshot(state.combatants.actor), targets: [snapshot(state.combatants.target)], rolls: {}, distanceFeetByTargetId: {target: 10}})
}
describe('healing from prior Host damage settlement', () => {
  it('uses the same damage dependency through the installed plugin compiler', () => {
    const definition = activity()
    definition.legacySource = {kind: 'feature', id: 'transfer'}
    const dispose = registerDnd5eRulesPlugin({manifest: {id: 'local.transfer.audit', name: 'Transfer audit', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0'}, setup(api) {
      api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(definition))
      api.registerFeature({id: 'transfer', name: 'Transfer', summary: 'Test', description: 'Test', automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(definition)})
    }})
    try {
      const state = fixture('resistant')
      state.combatants.actor.pluginFeatureIds = ['local.transfer.audit:transfer']
      const result = resolveDnd5eHeadlessAction(state, {type: 'plugin', pluginId: 'local.transfer.audit', actionId: 'transfer', featureId: 'local.transfer.audit:transfer', actorId: 'actor', targetId: 'target', targetIds: ['target'], distanceFeet: 10, rolls: {}})
      expect(result.ok, JSON.stringify(result)).toBe(true)
      expect(result.state.combatants.actor.currentHp).toBe(43)
      expect(result.state.combatants.target.currentHp).toBe(15)
    } finally { dispose() }
  })
  it.each([['none', 28], ['resistant', 14], ['immune', 0], ['vulnerable', 56]] as const)('uses %s defenses before calculating healing', (defense, expected) => {
    const state = fixture(defense), resolution = resolve(state)
    expect(resolution.ok, JSON.stringify(resolution)).toBe(true)
    const result = commitDnd5eActivityExecution(state, {actorId: 'actor', activityId: 'transfer', targetIds: ['target'], resolution})
    expect(result.ok, JSON.stringify(result)).toBe(true)
    expect(result.state.combatants.target.currentHp).toBe(1 + expected)
    expect(state.combatants.target.currentHp).toBe(1)
  })
  it('counts damage absorbed by temporary HP and rounds fractional healing down', () => {
    const state = fixture('none', 20)
    const result = commitDnd5eActivityExecution(state, {actorId: 'actor', activityId: 'transfer', targetIds: ['target'], resolution: resolve(state)})
    expect(result.state.combatants.actor.currentHp).toBe(50)
    expect(result.state.combatants.actor.temporaryHp).toBe(6)
    expect(result.state.combatants.target.currentHp).toBe(29)
    const other = fixture(); other.combatants.target.currentHp = 50; other.combatants.target.damageResistances = ['necrotic']
    const drained = commitDnd5eActivityExecution(other, {actorId: 'actor', activityId: 'transfer', targetIds: ['target'], resolution: resolve(other, activity(true))})
    expect(drained.ok).toBe(true)
    expect(drained.state.combatants.actor.currentHp).toBe(53)
  })
  it('rejects undeclared and forward dependencies before any damage or action spending', () => {
    const definition = activity()
    definition.outcomes[0].operations = [...definition.outcomes[0].operations].reverse()
    expect(validateDnd5eActivityDefinitionV1(definition).join(' ')).toContain('earlier damage operation')
    const state = fixture(), resolution = resolve(state)
    if (!resolution.ok) throw Error('fixture')
    resolution.proposals = [...resolution.proposals].reverse()
    const result = commitDnd5eActivityExecution(state, {actorId: 'actor', activityId: 'transfer', targetIds: ['target'], resolution})
    expect(result.ok).toBe(false)
    expect(result.state.combatants.actor.currentHp).toBe(50)
    expect(result.state.combatants.actor.turn.actionAvailable).toBe(true)
  })
})
