import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, dnd5eCombatantPairKey, resolveDnd5eHeadlessAction, type Dnd5eCombatEvent } from '../headlessCombatEngine'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { registerDnd5eActivityPackage, clearDnd5eActivityRegistryForTests } from './dnd5eActivityRegistry'
import { settleDnd5eActivityTriggerWindowsV1 } from './dnd5eActivityTriggerSettlement'

it.each(['accepted', 'declined', 'empty', 'wrong-class', 'unowned'] as const)(
  'settles an optional spell-damage rider with resource and turn limits (%s)', async mode => {
    const packageId = 'test.damage-rider'
    const resourceId = `${packageId}:charges`
    const dispose = registerDnd5eRulesPlugin({
      manifest: { id: packageId, name: 'Synthetic rider', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0' },
      setup(api) { api.registerFeature({ id: 'rider', name: 'Rider', summary: 'Test', description: 'Test', automation: 'full',
        resources: [{ id: 'charges', label: 'Charges', maximum: 3, resetOn: 'long-rest' }],
      }) },
    })
    registerDnd5eActivityPackage({ packageId, packageVersion: '1.0.0', activities: [{
      schemaVersion: 1, id: 'rider', name: 'Rider', activation: { kind: 'free' },
      legacySource: { kind: 'feature', id: 'rider' }, automation: automationCapabilityFromLegacyStatus('full'),
      invocation: { kind: 'triggered', event: 'damage-dealt', confirmation: 'actor-choice', retention: 'single-event' },
      target: { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 60 },
      requirements: [{ kind: 'spell-used', castingClassIds: ['wizard'] }, { kind: 'once-per-turn', key: 'rider-use' }],
      consumption: [{ kind: 'resource', resourceId, amount: { kind: 'constant', value: 1 }, consumeOn: 'resolve' }],
      outcomes: [{ id: 'rider', when: { kind: 'always' }, operations: [{
        id: 'damage', kind: 'damage', target: 'target', damageType: 'force', magical: true,
        amount: { kind: 'constant', value: 4 },
      }] }],
    }] })
    try {
      const actor = createDnd5eCombatant({ id: 'hero', name: 'Hero', controller: 'player', initiative: 20,
        abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 }, proficiencyBonus: 3, armorClass: 12,
        maxHp: 30, currentHp: 30, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false,
        pluginFeatureIds: mode === 'unowned' ? [] : [`${packageId}:rider`],
        classResources: { [resourceId]: { current: mode === 'empty' ? 0 : 3, max: 3 } },
      })
      const target = { ...structuredClone(actor), id: 'enemy', controller: 'dm' as const, initiative: 10, currentHp: 25, pluginFeatureIds: [] }
      const state = startDnd5eHeadlessCombat('rider', [actor, target])
      state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('hero', 'enemy')]: 5 }
      // Synthetic already-committed source event. Actual prepared spell provenance is tested separately.
      const event: Dnd5eCombatEvent = { type: 'damage-applied', sourceId: 'hero', targetId: 'enemy', amount: 5,
        temporaryHpBefore: 0, temporaryHpAfter: 0, hpBefore: 30, hpAfter: 25,
        damageTypes: ['fire'], origin: { kind: 'spell', id: 'test:spell', spellLevel: 3,
          castingClassId: mode === 'wrong-class' ? 'cleric' : 'wizard' },
      }
      let prompts = 0
      const result = await settleDnd5eActivityTriggerWindowsV1({ state, combatRevision: 1, events: [event],
        eventBatchId: 'first-damage', confirm: async request => {
          prompts++
          expect(request.actorId).toBe('hero')
          expect(request.targetIds).toEqual(['enemy'])
          return mode !== 'declined'
        }, roll: async () => { throw Error('Constant damage must not roll') },
      })
      const accepted = mode === 'accepted'
      expect(result.state.combatants.enemy.currentHp, JSON.stringify(result.diagnostics)).toBe(accepted ? 21 : 25)
      expect(result.state.combatants.hero.classResources[resourceId].current).toBe(mode === 'empty' ? 0 : accepted ? 2 : 3)
      expect(result.diagnostics.filter(entry => entry.status === 'resolved')).toHaveLength(accepted ? 1 : 0)
      if (mode === 'wrong-class' || mode === 'unowned') expect(prompts).toBe(0)
      if (accepted) {
        expect(prompts).toBe(1)
        const persisted = JSON.parse(JSON.stringify(result.state)) as typeof state
        for (const batch of ['first-damage', 'second-damage']) {
          const replay = await settleDnd5eActivityTriggerWindowsV1({ state: persisted, combatRevision: result.combatRevision,
            events: [event], eventBatchId: batch, confirm: async () => { throw Error('Turn limit must hide repeat choice') }, roll: async () => [],
          })
          expect(replay.state.combatants.enemy.currentHp).toBe(21)
          expect(replay.state.combatants.hero.classResources[resourceId].current).toBe(2)
        }
        const ended = resolveDnd5eHeadlessAction(persisted, { type: 'end-turn', actorId: 'hero' })
        expect(ended.ok).toBe(true)
        const next = resolveDnd5eHeadlessAction(ended.state, { type: 'end-turn', actorId: 'enemy' })
        expect(next.ok).toBe(true)
        const oldEvent = await settleDnd5eActivityTriggerWindowsV1({ state: JSON.parse(JSON.stringify(next.state)),
          combatRevision: result.combatRevision + 2, events: [event], eventBatchId: 'first-damage',
          confirm: async () => { throw Error('Previously settled event must not prompt on a later turn') }, roll: async () => [],
        })
        expect(oldEvent.state.combatants.enemy.currentHp).toBe(21)
        expect(oldEvent.state.combatants.hero.classResources[resourceId].current).toBe(2)
        const renewed = await settleDnd5eActivityTriggerWindowsV1({ state: next.state, combatRevision: result.combatRevision + 2,
          events: [event], eventBatchId: 'new-turn-damage', confirm: async () => true, roll: async () => [],
        })
        expect(renewed.state.combatants.enemy.currentHp).toBe(17)
        expect(renewed.state.combatants.hero.classResources[resourceId].current).toBe(1)
        expect(renewed.diagnostics.filter(entry => entry.status === 'resolved')).toHaveLength(1)
      }
      expect(state.combatants.enemy.currentHp).toBe(25)
      expect(state.combatants.hero.classState.activityTriggerReceipts).toBeUndefined()
      if (mode === 'declined') {
        expect(result.state.combatants.hero.classState.activityTriggerReceipts?.ids).toContain('activity-event:rider:first-damage:0:damage-dealt:test.damage-rider:rider')
      } else if (!accepted) expect(result.state.combatants.hero.classState.activityTriggerReceipts).toBeUndefined()
      expect(state.combatants.hero.classResources[resourceId].current).toBe(mode === 'empty' ? 0 : 3)
    } finally { clearDnd5eActivityRegistryForTests(); dispose() }
  },
)
