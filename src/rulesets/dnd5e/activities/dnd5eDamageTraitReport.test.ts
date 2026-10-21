import { expect, it } from 'vitest'
import {dnd5eCombatantPairKey} from '../headlessCombatPrimitives'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { exportDnd5eStarMod, readDnd5eStarMod } from '../starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from '../unifiedContent'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'

const namespace = 'test.trait-query'
const activity: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1, id: 'detect', name: 'Damage trait query', activation: { kind: 'action' },
  legacySource: { kind: 'feature', id: 'detect' }, automation: automationCapabilityFromLegacyStatus('full'),
  target: { kind: 'creature',relation:'any',count:1,rangeFeet:60,requiresLineOfSight:true },
  consumption: [
    { kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' },
    { kind: 'resource', resourceId: 'dnd5e-channel-divinity', amount: { kind: 'constant', value: 1 }, consumeOn: 'resolve' },
  ],
  outcomes: [{ id: 'report', when: { kind: 'always' }, operations: [
    { id: 'query', kind: 'read-damage-traits', target: 'target' },
  ] }],
}

it('rejects client-supplied trait facts and operation targeting overrides', () => {
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  for (const patch of [{ rangeFeet: 0 }, { rangeFeet: 10001 }, { rangeFeet: '5280' }, { resistances: ['fire'] }, { target: 'actor' }]) {
    const invalid = structuredClone(activity)
    Object.assign(invalid.outcomes[0].operations[0], patch)
    expect(validateDnd5eActivityDefinitionV1(invalid).length).toBeGreaterThan(0)
  }
})

it('imports, exports and executes a private report with atomic costs in both Host paths', async () => {
  const bundle: Dnd5eUnifiedContentBundleV1 = {
    format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Damage trait query', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0',
      distributionPolicy: 'local-only', contentCategory: 'mixed' },
    assets: [], definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature',
      id: 'detect', name: 'Damage trait query', automation: activity.automation, activities: [activity],
      payload: { id: 'detect', name: 'Damage trait query', summary: 'Synthetic', description: 'Synthetic', automation: 'full' } }],
  }
  const first = (await readDnd5eStarMod(await exportDnd5eStarMod(bundle))).bundle
  const second = (await readDnd5eStarMod(await exportDnd5eStarMod(first))).bundle
  for (const content of [first, second]) {
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(content))
    try {
      for (const scenario of ['found', 'none', 'blocked', 'far', 'spent'] as const) {
        const actor = createDnd5eCombatant({ id: 'actor', name: 'Actor', controller: 'player', initiative: 20,
          abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
          armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 },
          concentrating: false, pluginFeatureIds: [`${namespace}:detect`],
          classResources: { 'dnd5e-channel-divinity': { current: scenario === 'spent' ? 0 : 1, max: 1 } } })
        actor.classLevels = { cleric: 2 }
        const other = { ...structuredClone(actor), id: 'other', name: 'Other', controller: 'dm' as const, initiative: 1, pluginFeatureIds: [], classResources: {} }
        const state = startDnd5eHeadlessCombat('damage-traits', [actor, other])
        state.mapId = 'map'
        state.combatants.other.damageResistances=scenario==='none'?[]:['fire']
        state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('actor','other')]:scenario==='far'?65:60}
        if(scenario==='blocked')state.lineOfSightBlockedByCombatantPair={[dnd5eCombatantPairKey('actor','other')]:true}
        const before = JSON.stringify(state)
        const direct = resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1,
          command: { schemaVersion: 1, commandId: 'detect', actorId: 'actor', packageId: namespace, packageVersion: '1.0.0',
            activityId: 'detect', targetIds: ['other'], expectedRevision: 1 }, authoritativeRolls: {}, confirmedBy: 'actor' })
        const compiled = resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: namespace, actionId: 'detect',
          featureId: `${namespace}:detect`, actorId: 'actor', targetId: 'other', targetIds: ['other'],
          distanceFeet: scenario === 'far' ? 65 : 60, rolls: {}, payload: {} })
        const allowed = scenario === 'found' || scenario === 'none'
        for (const result of [direct.result, compiled]) {
          expect(result.ok, `${scenario}/${result === compiled ? "compiled" : "direct"}: ${JSON.stringify(result.ok ? null : result.reason)}`).toBe(allowed)
          if (result.ok) {
            const resolved = result.state.combatants.actor
            expect(resolved.turn.actionAvailable).toBe(false)
            expect(resolved.classResources['dnd5e-channel-divinity'].current).toBe(0)
            expect(resolved.classState.damageTraitReports?.detect.report.resistances).toEqual(scenario==='found'?['fire']:[])
            expect(JSON.stringify(resolved.classState.damageTraitReports)).not.toContain('feywild')
            expect(result.state.combatants.other.classState.damageTraitReports).toBeUndefined()
          } else if ('state' in result) {
            expect(result.state.combatants.actor.turn.actionAvailable, `${scenario}: action rollback`).toBe(true)
            expect(result.state.combatants.actor.classResources['dnd5e-channel-divinity'].current,
              `${scenario}: resource rollback`).toBe(scenario === 'spent' ? 0 : 1)
            expect(result.state.combatants.actor.classState.damageTraitReports).toBeUndefined()
          }
        }
        expect(JSON.stringify(state)).toBe(before)
      }
    } finally { dispose() }
  }
})

