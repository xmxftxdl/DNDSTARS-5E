import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eConditionEffect, createDnd5eMechanicalEffect } from '../activeEffects'
import { createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from '../headlessCombatEngine'
import { dnd5eDirectedCombatantPairKey } from '../headlessCombatPrimitives'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { compileDnd5eActivityHeadlessAction } from './dnd5eActivityHeadlessCompiler'
import { dnd5ePluginFeatureActionFromActivityV1 } from './dnd5eActivityFeatureActionAdapter'
import { registerDnd5eActivityPackage } from './dnd5eActivityRegistry'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

const packageId = 'test.witnessed-harm'
const creature = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, controller: 'player', initiative,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 15,
  currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })

for (const sourceId of ['actor', 'enemy', 'unknown']) {
for (const mode of ['attack', 'damage', 'zero-damage'] as const) {
  it.each(['clear', 'wall', 'blind', 'blindsight', 'darkness', 'unconscious', 'sleep', 'petrified', 'victim-revealed'] as const)(`${sourceId}/${mode}: settles actual witnessed ally harm in both Host routes (%s)`, vision => {
    const trigger = mode === 'attack' ? 'witnesses-source-attack-ally' : 'witnesses-source-damage-ally'
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1, id: 'harm', name: 'Harm', activation: { kind: 'action' }, target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 30 },
      consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' }],
      checks: mode === 'attack' ? [{ id: 'attack', kind: 'attack-roll', rollId: 'attack', attackBonus: { kind: 'constant', value: 0 }, rollMode: 'normal', scope: 'per-target' }] : [],
      effects: [{ schemaVersion: 1, id: 'fresh', name: 'Fresh', stacking: 'stack', duration: { kind: 'permanent' }, breakOn: [trigger], modifiers: [{ kind: 'speed', mode: 'add', value: { kind: 'constant', value: 1 } }] }],
      outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [
        ...(mode !== 'attack' ? [{ id: 'damage', kind: 'damage' as const, target: 'target' as const, amount: { kind: 'constant' as const, value: mode === 'damage' ? 3 : 0 }, damageType: 'force' as const }] : []),
        { id: 'fresh', kind: 'apply-effect', target: 'actor', effectId: 'fresh' },
      ] }], automation: automationCapabilityFromLegacyStatus('full'), legacySource: { kind: 'feature', id: 'harm' },
    }
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    const registration = registerDnd5eActivityPackage({ packageId, packageVersion: '1.0.0', activities: [activity] })
    const dispose = registerDnd5eRulesPlugin({ manifest: { id: packageId, name: 'Witness', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
      api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity))
      api.registerFeature({ id: 'harm', name: 'Harm', summary: 'Test', description: 'Test', automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(activity) })
    } })
    try {
      const state = startDnd5eHeadlessCombat('witness', [creature('actor', 20), creature('victim', 15), creature('witness', 10), creature('enemy', 5)])
      state.combatants.actor.pluginFeatureIds = [`${packageId}:harm`]
      state.combatants.enemy.controller = 'dm'
      for (const id of ['victim', 'witness', 'enemy']) state.combatants[id].classState.activeEffects = [createDnd5eMechanicalEffect({ id: `old-${id}`, definitionId: 'old', label: 'Old', targetId: id, source: { kind: 'feature', actorId: sourceId }, breakOn: [trigger], modifiers: { speedBonusFeet: 1 } })]
      const pair = dnd5eDirectedCombatantPairKey('witness', 'victim')
      state.distanceFeetByCombatantPair = { ['actor\u0000victim']: 5, ['victim\u0000witness']: 5 }
      if (vision === 'wall') state.physicalLineOfSightBlockedByCombatantPair = { [pair]: true }
      if (vision === 'darkness') state.magicalDarknessByCombatantPair = { [pair]: true }
      if (vision === 'blind' || vision === 'blindsight') {
        state.combatants.witness.conditions = ['blinded']
        state.combatants.witness.classState.activeEffects!.push(createDnd5eConditionEffect({ condition: 'blinded', targetId: 'witness', source: { kind: 'feature', actorId: 'actor' } }))
      }
      if (vision === 'blindsight') state.combatants.witness.specialSenses = [{ kind: 'blindsight', rangeFeet: 30 }]
      if (vision === 'unconscious') state.combatants.witness.currentHp = 0
      if (vision === 'victim-revealed') {
        state.combatants.victim.conditions = ['invisible']
        state.combatants.victim.classState.activeEffects!.push(createDnd5eConditionEffect({ condition: 'invisible', targetId: 'victim', source: { kind: 'feature', actorId: 'actor' }, breakOn: ['takes-damage'] }))
      }
      if (vision === 'sleep' || vision === 'petrified') {
        const condition = vision === 'sleep' ? 'unconscious' : 'petrified'
        state.combatants.witness.conditions = [condition]
        state.combatants.witness.classState.activeEffects!.push(createDnd5eConditionEffect({ condition, targetId: 'witness', source: { kind: 'feature', actorId: 'actor' } }))
      }
      const before = structuredClone(state)
      const rolls: Record<string, { values: number[]; modifier: number; total: number }> = mode === 'attack' ? { 'attack:victim': { values: [2], modifier: 0, total: 2 } } : {}
      const direct = resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1, command: { schemaVersion: 1, commandId: 'harm', actorId: 'actor', packageId, packageVersion: '1.0.0', activityId: 'harm', targetIds: ['victim'], expectedRevision: 1 }, authoritativeRolls: rolls, confirmedBy: 'actor' }).result
      const plugin = resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: packageId, actionId: 'harm', featureId: `${packageId}:harm`, actorId: 'actor', targetId: 'victim', distanceFeet: 5, rolls })
      for (const result of [direct, plugin]) {
        expect(result.ok, JSON.stringify(result)).toBe(true)
        if (!result.ok) throw Error('Expected settlement')
        const shouldEnd = sourceId === 'actor' && mode !== 'zero-damage' && (vision === 'clear' || vision === 'blindsight')
        expect(result.state.combatants.witness.classState.activeEffects?.some(effect => effect.id === 'old-witness') ?? false).toBe(!shouldEnd)
        for (const id of ['victim', 'enemy']) expect(result.state.combatants[id].classState.activeEffects?.some(effect => effect.id === `old-${id}`)).toBe(true)
        expect(result.state.combatants.actor.classState.activeEffects?.some(effect => effect.definitionId.includes('fresh'))).toBe(true)
        if (vision === 'victim-revealed' && mode === 'damage') expect(result.state.combatants.victim.conditions).not.toContain('invisible')
      }
      expect(state).toEqual(before)
    } finally { dispose(); registration.dispose() }
  })
}

}
