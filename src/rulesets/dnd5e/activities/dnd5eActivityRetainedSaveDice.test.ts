import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eMechanicalEffect } from '../activeEffects'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import { dnd5eCombatantPairKey } from '../headlessCombatPrimitives'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { exportDnd5eStarMod, readDnd5eStarMod } from '../starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from '../unifiedContent'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

const namespace = 'test.retained-save'
const activity: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1, id: 'blast', name: 'Blast', activation: { kind: 'action' },
  legacySource: { kind: 'feature', id: 'blast' }, automation: automationCapabilityFromLegacyStatus('full'),
  target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 60 },
  consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' }],
  checks: [{ id: 'save', kind: 'saving-throw', rollId: 'save-d20', ability: 'dex', dc: { kind: 'constant', value: 15 },
    scope: 'per-target', rollMode: 'normal' }],
  outcomes: [{ id: 'failed', when: { kind: 'check', checkId: 'save', result: 'failure' }, operations: [
    { id: 'hurt', kind: 'damage', target: 'target', amount: { kind: 'constant', value: 8 }, damageType: 'fire' },
  ] }],
}
const make = (id: string, initiative: number) => createDnd5eCombatant({
  id, name: id, controller: id === 'actor' ? 'dm' : 'player', initiative,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
  armorClass: 10, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false,
})

it('exports and reimports exact-check optional save dice in both authority paths', async () => {
  const bundle: Dnd5eUnifiedContentBundleV1 = {
    format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Test', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1',
      publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' },
    assets: [], definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'blast', name: 'Blast',
      automation: activity.automation, activities: [activity],
      payload: { id: 'blast', name: 'Blast', summary: 'Synthetic', description: 'Synthetic', automation: 'full' } }],
  }
  const first = (await readDnd5eStarMod(await exportDnd5eStarMod(bundle))).bundle
  const second = (await readDnd5eStarMod(await exportDnd5eStarMod(first))).bundle
  for (const content of [first, second]) {
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(content))
    try {
      for (const mode of ['use', 'skip', 'wrong-source', 'low', 'bad-die', 'unused-key', 'wrong-target', 'consumable'] as const) {
        const actor = make('actor', 20), target = make('target', 1)
        actor.pluginFeatureIds = [`${namespace}:blast`]
        target.classLevels = { ranger: mode === 'low' ? 6 : 7 }
        target.classState.activeEffects = [createDnd5eMechanicalEffect({
          id: 'prey', definitionId: 'test:prey', label: 'Prey', targetId: 'target', source: { kind: 'feature', actorId: 'target' },
          modifiers: {
            onHitBonusDamage: { count: 1, sides: 6, bonus: 0, damageType: 'inherit-primary', appliesTo: 'all-weapon-attacks',
              doubleDiceOnCritical: true, oncePerTurn: true, consumeEffectOnHit: false, boundTargetId: mode === 'wrong-source' ? 'other' : 'actor' },
            optionalBonusDie: { sides: 6, appliesTo: ['saving-throw'], consumeOnUse: mode === 'consumable',
              boundTargetSource: { classId: 'ranger', minimumLevel: 7 } },
          },
        })]
        const state = startDnd5eHeadlessCombat('activity-source', [actor, target])
        state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('actor', 'target')]: 5 }
        const before = structuredClone(state)
        const uses = mode === 'skip' ? undefined : { [mode === 'unused-key' ? 'other:target' : 'save:target']: {
          effectId: 'prey', targetId: mode === 'wrong-target' ? 'actor' : 'target', roll: mode === 'bad-die' ? 7 : 6,
        } }
        const rolls = { 'save-d20:target': { values: [10], modifier: 0, total: 10 } }
        const direct = resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1, authoritativeRolls: rolls,
          authoritativeRetainedSaveDice: uses, confirmedBy: 'actor',
          command: { schemaVersion: 1, commandId: 'blast', actorId: 'actor', packageId: namespace, packageVersion: '1.0.0',
            activityId: 'blast', targetIds: ['target'], expectedRevision: 1 } })
        const compiled = resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: namespace, actionId: 'blast',
          featureId: `${namespace}:blast`, actorId: 'actor', targetId: 'target', distanceFeet: 5, rolls,
          payload: uses ? { activityRetainedSaveDice: uses } : {} })
        for (const result of [direct.result, compiled]) {
          expect(result.ok, `${mode}/${result === compiled ? 'compiled' : 'direct'}:${JSON.stringify(result.ok ? null : result.reason)}`)
            .toBe(mode === 'use' || mode === 'skip')
          if (result.ok) {
            expect(result.state.combatants.target.currentHp).toBe(mode === 'use' ? 30 : 22)
            expect(result.state.combatants.actor.turn.actionAvailable).toBe(false)
            expect(result.state.combatants.target.classState.activeEffects?.some(effect => effect.id === 'prey')).toBe(true)
          } else if ('state' in result) {
            expect(result.state.combatants.actor.turn.actionAvailable).toBe(true)
            expect(result.state.combatants.target.currentHp).toBe(30)
          }
        }
        expect(state).toEqual(before)
      }
    } finally { dispose() }
  }
})
