import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eMechanicalEffect, validateDnd5eActiveEffectsStrict, type Dnd5eActiveEffectBreakTrigger } from '../activeEffects'
import { createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from '../headlessCombatEngine'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { compileDnd5eActivityHeadlessAction } from './dnd5eActivityHeadlessCompiler'
import { dnd5ePluginFeatureActionFromActivityV1 } from './dnd5eActivityFeatureActionAdapter'
import { registerDnd5eActivityPackage } from './dnd5eActivityRegistry'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'


const packageId = 'test.source-ally-break'
const creature = (id: string, controller: 'player' | 'dm', initiative: number) => createDnd5eCombatant({ id, name: id, controller, initiative,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 15,
  currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })

{
const triggers: Dnd5eActiveEffectBreakTrigger[] = ['attacked-by-condition-entity', 'damaged-by-condition-entity', 'forced-save-by-condition-entity']
for (const mode of ['attack', 'damage', 'zero-damage', 'save'] as Array<'attack' | 'damage' | 'zero-damage' | 'save'>) {
  for (const relationship of ['source', 'ally', 'enemy', 'missing'] as const) {
    it(`${mode} ends only the matching preexisting source/ally effect (${relationship}, selected entity) in both Host routes`, () => {
      const trigger = triggers[mode === 'attack' ? 0 : mode === 'save' ? 2 : 1]!
      const activity: Dnd5eActivityDefinitionV1 = {
        schemaVersion: 1, id: 'harm', name: 'Harm', activation: { kind: 'action' }, target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 30 },
        consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' }],
        checks: mode === 'attack' ? [{ id: 'roll', rollId: 'roll', kind: 'attack-roll', attackBonus: { kind: 'constant', value: 0 }, scope: 'per-target', rollMode: 'normal', delivery: 'ranged' }] : mode === 'save' ? [{ id: 'roll', rollId: 'roll', kind: 'saving-throw', ability: 'wis', dc: { kind: 'constant', value: 10 }, scope: 'per-target', rollMode: 'normal' }] : [],
        effects: [{ schemaVersion: 1, id: 'fresh', name: 'Fresh', stacking: 'stack', duration: { kind: 'permanent' }, breakOn: [trigger], modifiers: [{ kind: 'speed', mode: 'add', value: { kind: 'constant', value: 1 } }] }],
        outcomes: [{ id: 'resolve', when: { kind: 'always' }, operations: [
          ...(mode === 'damage' || mode === 'zero-damage' ? [{ id: 'damage', kind: 'damage' as const, target: 'target' as const, amount: { kind: 'constant' as const, value: mode === 'damage' ? 3 : 0 }, damageType: 'force' as const }] : []),
          ...(mode === 'damage' ? [{ id: 'second-damage', kind: 'damage' as const, target: 'target' as const, amount: { kind: 'constant' as const, value: 3 }, damageType: 'force' as const }] : []),
          { id: 'fresh', kind: 'apply-effect', target: 'target', effectId: 'fresh' },
        ] }], automation: automationCapabilityFromLegacyStatus('full'), legacySource: { kind: 'feature', id: 'harm' },
      }
      expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
      const registration = registerDnd5eActivityPackage({ packageId, packageVersion: '1.0.0', activities: [activity] })
      const dispose = registerDnd5eRulesPlugin({ manifest: { id: packageId, name: 'Harm', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
        api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity))
        api.registerFeature({ id: 'harm', name: 'Harm', description: 'Test', summary: 'Test', automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(activity) })
      } })
      try {
        const state = startDnd5eHeadlessCombat('break', [creature('actor', 'player', 20), creature('source', relationship === 'enemy' ? 'dm' : 'player', 15), creature('target', 'dm', 10)])
        const sourceId = relationship === 'source' ? 'actor' : relationship === 'missing' ? 'unknown' : 'source'
        state.combatants.actor.pluginFeatureIds = [`${packageId}:harm`]
        state.distanceFeetByCombatantPair = { ['actor\u0000target']: 5 }
        state.combatants.target.classState.activeEffects = triggers.map((kind, i) => createDnd5eMechanicalEffect({ id: `old-${i}`, definitionId: `old-${i}`, label: 'Old', targetId: 'target', source: { kind: 'feature', actorId: 'source' }, tags: relationship === 'missing' ? undefined : [`condition-entity:${sourceId}`], breakOn: [kind], modifiers: { speedBonusFeet: 1, ...((kind === 'damaged-by-source-or-ally' || kind === 'damaged-by-source-ally') ? { resistanceToAllDamage: true } : {}) } }))
        expect(validateDnd5eActiveEffectsStrict(state.combatants.target.classState.activeEffects).issues).toEqual([])
        const before = structuredClone(state)
        const rolls: Record<string, { values: number[]; modifier: number; total: number }> = mode === 'damage' || mode === 'zero-damage' ? {} : { 'roll:target': { values: [2], modifier: 0, total: 2 } }
        const direct = resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1, command: { schemaVersion: 1, commandId: 'harm', actorId: 'actor', packageId, packageVersion: '1.0.0', activityId: 'harm', targetIds: ['target'], expectedRevision: 1 }, authoritativeRolls: rolls, confirmedBy: 'actor' })
        const plugin = resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: packageId, actionId: 'harm', featureId: `${packageId}:harm`, actorId: 'actor', targetId: 'target', distanceFeet: 5, rolls })
        for (const result of [direct.result, plugin]) {
          expect(result.ok, JSON.stringify(result)).toBe(true)
          if (!result.ok) throw Error('Expected settlement')
          const removed = mode !== 'zero-damage' && (relationship === 'source')
          const effects = result.state.combatants.target.classState.activeEffects ?? []
          expect(effects.some(effect => effect.id === `old-${triggers.indexOf(trigger)}`)).toBe(!removed)
          expect(effects.filter(effect => effect.id.startsWith('old-'))).toHaveLength(removed ? 2 : 3)
          expect(effects.some(effect => effect.definitionId.includes('fresh'))).toBe(true)
          if (mode === 'damage') expect(result.state.combatants.target.currentHp).toBe(14)
          expect(result.events.filter(event => event.type === 'active-effect-removed' && event.reason === trigger)).toHaveLength(removed ? 1 : 0)
          if (mode === 'attack') expect(result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', hit: false }))
        }
        expect(state).toEqual(before)
      } finally { dispose(); registration.dispose() }
    })
  }
}

}


