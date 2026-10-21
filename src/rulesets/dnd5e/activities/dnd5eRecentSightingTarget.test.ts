import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eConditionEffect } from '../activeEffects'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { exportDnd5eStarMod, readDnd5eStarMod } from '../starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from '../unifiedContent'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
const namespace = 'test.recent-sight'
const activity: Dnd5eActivityDefinitionV1 = {
 schemaVersion: 1, id: 'recent', name: 'Recent sight', activation: { kind: 'action' },
 legacySource: { kind: 'feature', id: 'recent' }, automation: automationCapabilityFromLegacyStatus('full'),
 target: { kind: 'creature', relation: 'any', count: 1, requiresSeenWithinSeconds: 60 },
 consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' }],
 outcomes: [{ id: 'benefit', when: { kind: 'always' }, operations: [
 { id: 'pool', kind: 'temporary-hit-points', target: 'target', amount: { kind: 'constant', value: 5 } },
 ] }],
}
it('validates the bounded sighting window', () => {
 expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
 for (const value of [0, -1, 61, 1.5, '60', true, {}, []]) {
  const malformed = JSON.parse(JSON.stringify(activity)); malformed.target.requiresSeenWithinSeconds = value
  expect(validateDnd5eActivityDefinitionV1(malformed)).toContain('activity.target.requiresSeenWithinSeconds is invalid')
 }
})
it('enforces historical sight after archive installation in direct and compiled Host execution', async () => {
 const bundle: Dnd5eUnifiedContentBundleV1 = { format: 'dndstars5e-unified-content', schemaVersion: 1,
 manifest: { id: namespace, name: 'Recent sight', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' },
 assets: [], definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'recent', name: 'Recent', automation: activity.automation, activities: [activity], payload: { id: 'recent', name: 'Recent', summary: 'Synthetic', description: 'Synthetic', automation: 'full' } }],
 }
 const decoded = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
 const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
 try {
  for (const scenario of ['visible', 'recent', 'boundary', 'expired', 'future', 'other-map', 'missing-clock', 'never-seen'] as const) {
   const actors = ['actor', 'target'].map((id, i) => createDnd5eCombatant({ id, name: id, controller: 'player', initiative: 20-i,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 75+i*50, y: 75 }, concentrating: false, pluginFeatureIds: i ? [] : [`${namespace}:recent`] }))
   const state = startDnd5eHeadlessCombat('recent', actors)
   state.mapId = 'map'
   state.companionScene = { map: { id: 'map', name: 'Map', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [] }, geometry: null, worldSecondRemainder: 0, projectedTokenIds: ['actor', 'target'], worldMinute: scenario === 'missing-clock' ? undefined : 10 }
   if (scenario !== 'visible') {
    state.combatants.target.classState.activeEffects = [createDnd5eConditionEffect({ condition: 'invisible', targetId: 'target', source: { kind: 'spell' } })]
    state.combatants.target.conditions = ['invisible']
   }
   if (scenario !== 'never-seen') state.combatants.actor.classState.recentCreatureSightings = { target: { mapId: scenario === 'other-map' ? 'elsewhere' : 'map', worldMinute: scenario === 'expired' ? 8 : scenario === 'future' ? 11 : scenario === 'boundary' ? 9 : 9.5 } }
   const before = JSON.stringify(state)
   const direct = resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1, command: { schemaVersion: 1, commandId: 'recent', actorId: 'actor', packageId: namespace, packageVersion: '1.0.0', activityId: 'recent', targetIds: ['target'], expectedRevision: 1 }, authoritativeRolls: {}, confirmedBy: 'actor' })
   const compiled = resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: namespace, actionId: 'recent', featureId: `${namespace}:recent`, actorId: 'actor', targetId: 'target', targetIds: ['target'], rolls: {}, payload: {} })
   const allowed = ['visible', 'recent', 'boundary'].includes(scenario)
   expect(direct.result.ok, scenario + JSON.stringify(direct)).toBe(allowed)
   expect(compiled.ok, scenario + JSON.stringify(compiled)).toBe(allowed)
   if (compiled.ok) {
    expect(compiled.state.combatants.target.temporaryHp).toBe(5)
    expect(compiled.state.combatants.actor.turn.actionAvailable).toBe(false)
   }
   expect(JSON.stringify(state)).toBe(before)
  }
 } finally { dispose() }
})
