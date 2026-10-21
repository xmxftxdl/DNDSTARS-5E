import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { normalizeSharedSceneOrchestration } from '../../../lib/sceneOrchestration'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { exportDnd5eStarMod, readDnd5eStarMod } from '../starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from '../unifiedContent'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'

const namespace = 'test.portal-query'
const activity: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1, id: 'detect', name: 'Portal query', activation: { kind: 'action' },
  legacySource: { kind: 'feature', id: 'detect' }, automation: automationCapabilityFromLegacyStatus('full'),
  target: { kind: 'self' },
  consumption: [
    { kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' },
    { kind: 'resource', resourceId: 'dnd5e-channel-divinity', amount: { kind: 'constant', value: 1 }, consumeOn: 'resolve' },
  ],
  outcomes: [{ id: 'report', when: { kind: 'always' }, operations: [
    { id: 'query', kind: 'detect-planar-portal', target: 'actor', rangeFeet: 5280 },
  ] }],
}

it('rejects client-supplied survey facts and unbounded queries in content', () => {
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  for (const patch of [{ rangeFeet: 0 }, { rangeFeet: 10001 }, { rangeFeet: '5280' }, { surveyComplete: true }, { target: 'target' }]) {
    const invalid = structuredClone(activity)
    Object.assign(invalid.outcomes[0].operations[0], patch)
    expect(validateDnd5eActivityDefinitionV1(invalid).length).toBeGreaterThan(0)
  }
})

it('imports, exports and executes a private report with atomic costs in both Host paths', async () => {
  const bundle: Dnd5eUnifiedContentBundleV1 = {
    format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Portal query', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0',
      distributionPolicy: 'local-only', contentCategory: 'mixed' },
    assets: [], definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature',
      id: 'detect', name: 'Portal query', automation: activity.automation, activities: [activity],
      payload: { id: 'detect', name: 'Portal query', summary: 'Synthetic', description: 'Synthetic', automation: 'full' } }],
  }
  const first = (await readDnd5eStarMod(await exportDnd5eStarMod(bundle))).bundle
  const second = (await readDnd5eStarMod(await exportDnd5eStarMod(first))).bundle
  for (const content of [first, second]) {
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(content))
    try {
      for (const scenario of ['found', 'none', 'incomplete', 'no-scene', 'spent'] as const) {
        const actor = createDnd5eCombatant({ id: 'actor', name: 'Actor', controller: 'player', initiative: 20,
          abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
          armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 },
          concentrating: false, pluginFeatureIds: [`${namespace}:detect`],
          classResources: { 'dnd5e-channel-divinity': { current: scenario === 'spent' ? 0 : 1, max: 1 } } })
        actor.classLevels = { cleric: 2 }
        const other = { ...structuredClone(actor), id: 'other', name: 'Other', controller: 'dm' as const, initiative: 1, pluginFeatureIds: [], classResources: {} }
        const state = startDnd5eHeadlessCombat('portal', [actor, other])
        state.mapId = 'map'
        if (scenario !== 'no-scene') state.companionScene = {
          map: { id: 'map', name: 'Map', dnd5ePlane: 'material', width: 500, height: 500, gridSize: 5, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [] },
          geometry: null, projectedTokenIds: ['actor'], worldMinute: 10,
          interactionScenes: normalizeSharedSceneOrchestration({ scenes: [{ id: 'scene', mapId: 'map',
            planarPortalSurvey: scenario === 'incomplete' ? undefined : { centerX: 0, centerY: 0, elevationFeet: 0, radiusFeet: 5280,
              externalPortals: scenario === 'none' ? [] : [{ eastFeet: 100, northFeet: 0, elevationFeet: 0, destinationPlane: 'feywild', enabled: true }] },
            triggers: [],
          }] }).scenes,
        }
        const before = JSON.stringify(state)
        const direct = resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1,
          command: { schemaVersion: 1, commandId: 'detect', actorId: 'actor', packageId: namespace, packageVersion: '1.0.0',
            activityId: 'detect', targetIds: ['actor'], expectedRevision: 1 }, authoritativeRolls: {}, confirmedBy: 'actor' })
        const compiled = resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: namespace, actionId: 'detect',
          featureId: `${namespace}:detect`, actorId: 'actor', targetId: 'actor', targetIds: ['actor'], rolls: {}, payload: {} })
        const allowed = scenario === 'found' || scenario === 'none'
        for (const result of [direct.result, compiled]) {
          expect(result.ok, `${scenario}/${result === compiled ? "compiled" : "direct"}: ${JSON.stringify(result.ok ? null : result.reason)}`).toBe(allowed)
          if (result.ok) {
            const resolved = result.state.combatants.actor
            expect(resolved.turn.actionAvailable).toBe(false)
            expect(resolved.classResources['dnd5e-channel-divinity'].current).toBe(0)
            expect(resolved.classState.planarPortalReports?.detect.report.status).toBe(scenario)
            expect(JSON.stringify(resolved.classState.planarPortalReports)).not.toContain('feywild')
            expect(result.state.combatants.other.classState.planarPortalReports).toBeUndefined()
          } else if ('state' in result) {
            if (scenario === 'incomplete' || scenario === 'no-scene')
              expect(result.reason).toBe('planar-portal-scene-unavailable')
            expect(result.state.combatants.actor.turn.actionAvailable, `${scenario}: action rollback`).toBe(true)
            expect(result.state.combatants.actor.classResources['dnd5e-channel-divinity'].current,
              `${scenario}: resource rollback`).toBe(scenario === 'spent' ? 0 : 1)
            expect(result.state.combatants.actor.classState.planarPortalReports).toBeUndefined()
          }
        }
        expect(JSON.stringify(state)).toBe(before)
      }
    } finally { dispose() }
  }
})
