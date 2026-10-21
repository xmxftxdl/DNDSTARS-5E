import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, dnd5eCombatantPairKey } from '../headlessCombatEngine'
import { createDnd5eMechanicalEffect } from '../activeEffects'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from '../unifiedContent'
import { exportDnd5eStarMod, readDnd5eStarMod } from '../starModAdapter'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

it.each([['registered',1],['registered',2],['compiled',1],['compiled',2]] as const)('debits committed attacks through %s at cost %i and rejects insufficient charges', async (path,cost) => {
  const namespace = 'test.finite-charge-attack'
  const automation = automationCapabilityFromLegacyStatus('full')
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'star', name: 'Star', activation: { kind: 'bonus-action' },
    consumption: [{ kind: 'action-economy', economy: 'bonus-action', amount: 1, consumeOn: 'resolve' }],
    target: { kind: 'creature', count: 1, relation: 'any', rangeFeet: 120 }, automation, requiresEffectGrant: true, effectGrantChargeCost: cost,
    legacySource: { kind: 'feature', id: 'stars' },
    checks: [{ id: 'attack', kind: 'attack-roll', rollId: 'attack', scope: 'per-target', rollMode: 'normal', delivery: 'ranged', attackBonus: { kind: 'constant', value: 5 } }],
    outcomes: [{ id: 'hit', when: { kind: 'check', checkId: 'attack', result: 'success' }, operations: [
      { id: 'damage', kind: 'damage', target: 'target', damageType: 'radiant', critical: 'double-dice',
        amount: { kind: 'dice', rollId: 'damage', count: 4, sides: 12 } }] }],
  }
  const bundle: Dnd5eUnifiedContentBundleV1 = { format: 'dndstars5e-unified-content', schemaVersion: 1, assets: [],
    manifest: { id: namespace, name: 'Synthetic stars', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0', distributionPolicy: 'local-only' },
    definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'stars', name: 'Stars', automation,
      payload: { id: 'stars', name: 'Stars', summary: 'Synthetic', description: 'Synthetic', automation: 'full' }, activities: [activity] }] }
  const decoded = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
  try {
    for (const scenario of ['hit', 'miss', 'last-hit', 'last-miss', 'invalid-roll', 'out-of-range', 'empty', 'insufficient', 'no-pool', 'no-bonus-action'] as const) {
      const make = (id: string) => createDnd5eCombatant({ id, name: id, controller: id === 'hero' ? 'player' : 'dm', initiative: id === 'hero' ? 20 : 10,
        abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 15,
        currentHp: 100, maxHp: 100, temporaryHp: 0, speed: 30, position: { x: id === 'hero' ? 0 : 30, y: 0 }, concentrating: false,
        pluginFeatureIds: id === 'hero' ? [`${namespace}:stars`] : [] })
      const state = startDnd5eHeadlessCombat(scenario, [make('hero'), make('target')])
      const current = scenario === 'empty' ? 0 : scenario === 'insufficient' ? cost-1 : scenario.startsWith('last') ? cost : 7
      state.combatants.hero.classState.activeEffects = [createDnd5eMechanicalEffect({ id: 'stars', definitionId: 'stars', label: 'Stars', targetId: 'hero',
        source: { kind: 'feature', actorId: 'hero', pluginId: namespace }, duration: { type: 'rounds', remainingRounds: 600, tickOn: 'source-turn-end' },
        grantedActivities: ['star'], grantedActivityCharges: { current, maximum: 7, endWhenEmpty: true } })]
      if(scenario==='no-pool')delete state.combatants.hero.classState.activeEffects![0].grantedActivityCharges
      const distance = scenario === 'out-of-range' ? 125 : 30
      state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('hero', 'target')]: distance }
      if (scenario === 'no-bonus-action') state.combatants.hero.turn.bonusActionAvailable = false
      const before = structuredClone(state)
      const d20 = scenario.includes('miss') ? 2 : scenario === 'invalid-roll' ? 21 : 15
      const rolls = { 'attack:target': { values: [d20], modifier: 0, total: d20 }, damage: { values: [2, 3, 4, 5], modifier: 0, total: 14 } }
      const result = path === 'registered' ? resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1, confirmedBy: 'actor', authoritativeRolls: rolls,
        command: { schemaVersion: 1, commandId: scenario, actorId: 'hero', packageId: namespace, packageVersion: '1.0.0', activityId: 'star', targetIds: ['target'], expectedRevision: 1 } }).result
        : resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: namespace, actionId: 'star', featureId: `${namespace}:stars`, actorId: 'hero',
          targetId: 'target', targetIds: ['target'], distanceFeet: distance, rolls, hostEntitlement: { kind: 'active-effect', effectId: 'stars' }, transactionId: scenario })
      expect(state).toEqual(before)
      const succeeds = !['invalid-roll', 'out-of-range', 'empty', 'insufficient', 'no-pool', 'no-bonus-action'].includes(scenario)
      expect(result.ok, JSON.stringify(result)).toBe(succeeds)
      if (!result.ok) continue
      expect(result.state.combatants.hero.turn.bonusActionAvailable).toBe(false)
      expect(result.state.combatants.target.currentHp).toBe(scenario.includes('miss') ? 100 : 86)
      const remaining = result.state.combatants.hero.classState.activeEffects?.find(effect => effect.id === 'stars')
      if (current === cost) expect(remaining).toBeUndefined()
      else {
        expect(remaining?.grantedActivityCharges?.current).toBe(7-cost)
        expect(remaining?.duration).toEqual(before.combatants.hero.classState.activeEffects![0].duration)
      }
    }
  } finally { dispose() }
})
