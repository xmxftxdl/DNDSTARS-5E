import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, commitDnd5eActivityExecution, resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { compileDnd5eActivityHeadlessAction } from './dnd5eActivityHeadlessCompiler'
import { dnd5ePluginFeatureActionFromActivityV1 } from './dnd5eActivityFeatureActionAdapter'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './dnd5eActivityCombatAuthority'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import type { Dnd5eFormulaV1 } from './dnd5eFormula'

// The eligibility threshold is exact; only the amount healed is rounded down.
const half: Dnd5eFormulaV1 = { kind: 'multiply', values: [
  { kind: 'reference', reference: { kind: 'actor-max-hp' } }, { kind: 'constant', value: 0.5 },
] }
const activity: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1, id: 'recovery', name: 'Synthetic fractional recovery',
  activation: { kind: 'bonus-action' }, target: { kind: 'self' },
  legacySource: { kind: 'feature', id: 'recovery' }, automation: automationCapabilityFromLegacyStatus('full'),
  requirements: [{ kind: 'hp-value', subject: 'actor', comparison: 'below', value: half }],
  consumption: [{ kind: 'resource', resourceId: 'test.recovery:uses', amount: { kind: 'constant', value: 1 }, consumeOn: 'resolve' }],
  outcomes: [{ id: 'heal', when: { kind: 'always' }, operations: [
    { id: 'heal', kind: 'healing', target: 'actor', amount: { kind: 'floor', value: half } },
  ] }],
}

it.each([[29, 60, true], [30, 60, false], [30, 61, true], [31, 61, false]] as const)(
  'checks %i/%i against the live exact half threshold (eligible %s)', (currentHp, maxHp, eligible) => {
    const dispose = registerDnd5eRulesPlugin({
      manifest: { id: 'test.recovery', name: 'Recovery', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' },
      setup(api) {
        api.registerResource({ id: 'uses', label: 'Recovery uses', classId: 'sorcerer', minimumLevel: 18, maximum: 1, resetOn: 'long-rest' })
        api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity))
        api.registerFeature({ id: activity.id, name: activity.name, summary: 'Synthetic', description: 'Synthetic',
          automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(activity) })
      },
    })
    try {
      const actor = createDnd5eCombatant({ id: 'actor', name: 'Actor', controller: 'player', initiative: 20,
        abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
        armorClass: 10, currentHp, maxHp, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
      actor.pluginFeatureIds = ['test.recovery:recovery']
      actor.classId = 'sorcerer'
      actor.level = 18
      actor.classLevels = { sorcerer: 18 }
      actor.classResources['test.recovery:uses'] = { current: 1, max: 1 }
      const state = startDnd5eHeadlessCombat('recovery', [actor, { ...actor, id: 'opponent', controller: 'dm', initiative: 10 }])
      const before = structuredClone(state)
      for (const route of ['direct', 'compiled']) {
        const run = (current: typeof state) => {
          if (route === 'compiled') return resolveDnd5eHeadlessAction(current, { type: 'plugin', pluginId: 'test.recovery',
            actionId: activity.id, featureId: 'test.recovery:recovery', actorId: actor.id, targetId: actor.id, rolls: {} })
          const snapshot = dnd5eActivityActorSnapshotFromCombatantV1(current.combatants.actor)
          return commitDnd5eActivityExecution(current, { actorId: actor.id, activityId: activity.id, targetIds: [actor.id],
            resolution: resolveDnd5eActivity({ activity, actor: snapshot, targets: [snapshot], rolls: {} }) })
        }
        const result = run(state)
        expect(result.ok, `${route}: ${JSON.stringify(result.events)} ${result.ok ? '' : result.reason}`).toBe(eligible)
        expect(result.state.combatants.actor.currentHp).toBe(eligible ? currentHp + Math.floor(maxHp / 2) : currentHp)
        expect(result.state.combatants.actor.classResources['test.recovery:uses'].current).toBe(eligible ? 0 : 1)
        if (eligible) {
          const repeated = run(result.state)
          expect(repeated.ok).toBe(false)
          expect(repeated.state).toEqual(result.state)
        } else expect(result.state).toEqual(state)
        expect(state).toEqual(before)
      }
    } finally { dispose() }
  },
)
