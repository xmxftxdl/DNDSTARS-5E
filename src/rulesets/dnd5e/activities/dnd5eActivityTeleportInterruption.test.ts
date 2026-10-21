import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from '../unifiedContent'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, dnd5eCombatantPairKey, resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'

const ns = 'test.teleport-interruption'
const featureId = 'test.teleport-watcher:watcher.stop'
const usesId = 'test.teleport-watcher:decl-watcher-stop-uses'
const automation = automationCapabilityFromLegacyStatus('full')

for (const movement of ['teleport', 'swap-target', 'swap-actor'] as const)
for (const route of ['direct', 'compiled'] as const) for (const branch of ['fail', 'pass', 'decline', 'invalid-die', 'wrong-operation', 'wrong-target', 'duplicate'] as const) {
  it(`settles Activity teleport interruption atomically: ${movement}/${route}/${branch}`, () => {
    const targetId = movement === 'teleport' ? 'actor' : 'ally'
    const bundle: Dnd5eUnifiedContentBundleV1 = {
      format: 'dndstars5e-unified-content', schemaVersion: 1,
      manifest: { id: ns, name: 'Teleport fixture', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0', distributionPolicy: 'local-only', contentCategory: 'mixed' },
      assets: [], definitions: [{
        schemaVersion: 1, namespace: ns, version: '1.0.0', kind: 'feature', id: 'step', name: 'Step', automation,
        payload: { id: 'step', name: 'Step', summary: 'Synthetic', description: 'Synthetic', automation: 'full' },
        activities: [{
          schemaVersion: 1, id: 'step', name: 'Step', automation, legacySource: { kind: 'feature', id: 'step' },
          activation: { kind: 'action' }, target: movement === 'teleport' ? { kind: 'self' } : { kind: 'creature', relation: 'ally', count: 1, rangeFeet: 30 },
          consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' }],
          outcomes: [{ id: 'step', when: { kind: 'always' }, operations: [
            { id: 'step', kind: 'move', target: movement === 'teleport' ? 'actor' : 'target', mode: movement === 'teleport' ? 'teleport' : 'swap', distanceFeet: { kind: 'constant', value: 30 }, ignoresOpportunityAttacks: true },
            { id: 'independent', kind: 'healing', target: 'actor', amount: { kind: 'constant', value: 2 } },
          ] }],
        }],
      }],
    }
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(bundle))
    const disposeWatcher = registerDnd5eRulesPlugin({
      manifest: { id: 'test.teleport-watcher', name: 'Watcher', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' },
      setup(api) {
        api.registerDeclarativeSubclass({ schemaVersion: 1, id: 'watcher', classId: 'ranger', name: 'Watcher', summary: 'Synthetic', abilities: [{
          schemaVersion: 1, id: 'stop', name: 'Stop', description: 'Synthetic', level: 11,
          trigger: { kind: 'before-spell-effect' }, cost: { economy: 'reaction', uses: 1 }, targeting: { kind: 'self' },
          limits: { uses: { kind: 'fixed', value: 1 }, reset: 'short-rest' }, effects: [], automation: 'full',
          mechanic: { kind: 'source-action-interruption', events: ['teleport'], rangeFeet: 60, saveAbility: 'wis', dcAbility: 'wis' },
        }] })
      },
    })
    try {
      const actors = ['actor', 'watcher', 'ally'].map((id, i) => createDnd5eCombatant({
        id, name: id, controller: 'player', initiative: 20 - i,
        abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        proficiencyBonus: 4, armorClass: 10, currentHp: 10, maxHp: 20, temporaryHp: 0, speed: 30,
        position: { x: i * 5, y: 0 }, concentrating: false, pluginFeatureIds: i ? [featureId] : [ns + ':step'],
      }))
      Object.assign(actors[1], { classId: 'ranger', level: 11, classLevels: { ranger: 11 }, subclassIds: { ranger: 'test.teleport-watcher:watcher' } })
      actors[1].classResources[usesId] = { current: 1, max: 1 }
      const state = startDnd5eHeadlessCombat('teleport', actors)
      state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('actor', 'watcher')]: 30,
        [dnd5eCombatantPairKey('actor', 'ally')]: 10, [dnd5eCombatantPairKey('ally', 'watcher')]: 20 }
      const before = structuredClone(state)
      const use = {
        operationId: branch === 'wrong-operation' ? 'absent' : 'step', targetId: branch === 'wrong-target' ? 'watcher' : movement === 'swap-target' ? 'ally' : 'actor',
        reaction: { actorId: 'watcher', featureId, savingThrowD20: branch === 'invalid-die' ? 21 : branch === 'pass' ? 20 : 1 },
      }
      const activityTeleportInterruptions = branch === 'decline' ? undefined : branch === 'duplicate' ? [use, use] : [use]
      const direct = route === 'direct' ? resolveRegisteredDnd5eActivityInCombatV1({
        state, combatRevision: 1, authoritativeRolls: {}, activityTeleportInterruptions,
        command: { schemaVersion: 1, commandId: 'step', packageId: ns, packageVersion: '1.0.0', activityId: 'step', actorId: 'actor', targetIds: [targetId], expectedRevision: 1 },
      }) : undefined
      const result = route === 'compiled' ? resolveDnd5eHeadlessAction(state, {
        type: 'plugin', pluginId: ns, actionId: 'step', featureId: ns + ':step', actorId: 'actor', targetId, targetIds: [targetId], distanceFeet: movement === 'teleport' ? 0 : 10, rolls: {}, activityTeleportInterruptions,
      }) : direct!.result
      const invalid = ['invalid-die', 'wrong-operation', 'wrong-target', 'duplicate'].includes(branch)
      expect(result.ok, JSON.stringify({ route, branch, reason: result.ok ? undefined : result.reason })).toBe(!invalid)
      expect(state).toEqual(before)
      if (!result.ok) {
        if ('state' in result) expect(result.state).toEqual(before)
        return
      }
      if (!('state' in result)) throw Error('expected commit')
      expect(result.state.combatants.actor.currentHp).toBe(12)
      const checkpoint = result.activityHandoffs?.teleportInterruptionState
      expect(checkpoint?.combatants.actor.currentHp).toBe(10)
      expect(checkpoint?.combatants.watcher.classResources[usesId].current).toBe(1)
      expect(checkpoint?.combatants.watcher.turn.reactionAvailable).toBe(true)
      expect(checkpoint).not.toBe(result.state)
      expect(result.state.combatants.actor.turn.actionAvailable).toBe(false)
      expect(result.state.combatants.watcher.turn.reactionAvailable).toBe(branch === 'decline')
      expect(result.state.combatants.watcher.classResources[usesId].current).toBe(branch === 'decline' ? 1 : 0)
      expect(result.activityHandoffs?.movements ?? []).toHaveLength(branch === 'fail' ? 0 : 1)
      expect(result.events.filter(event => event.type === 'source-action-interrupted')).toHaveLength(branch === 'decline' ? 0 : 1)
    } finally {
      disposeWatcher()
      dispose()
    }
  })
}
