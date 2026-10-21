import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { createDnd5eMechanicalEffect, validateDnd5eActiveEffectsStrict } from './activeEffects'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, commitDnd5eActivityExecution, dnd5eDispelMagicEffectsOnTarget } from './headlessCombatEngine'
import { resolveDnd5eActivity } from './activities/dnd5eActivityExecutor'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './activities/dnd5eActivityCombatAuthority'
import { compileDnd5eActivityHeadlessAction } from './activities/dnd5eActivityHeadlessCompiler'
import { dnd5ePluginFeatureActionFromActivityV1 } from './activities/dnd5eActivityFeatureActionAdapter'
import { registerDnd5eRulesPlugin } from './pluginApi'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'

it.each([['direct', 'id'], ['direct', 'tag'], ['compiled', 'id'], ['compiled', 'tag']] as const)(
  'preserves protected linked ledgers through %s removal by %s', (route, mode) => {
    const protectedEffect = { ...createDnd5eMechanicalEffect({ id: 'protected', definitionId: 'protected', label: 'Protected',
      targetId: 'actor', tags: ['test-marked'], source: { kind: 'feature', actorId: 'actor' }, duration: { type: 'permanent' } }),
      linkedLifetime: { actorId: 'absent-peer', effectId: 'peer-effect', protectedRemoval: true as const } }
    expect(validateDnd5eActiveEffectsStrict([protectedEffect]).ok).toBe(true)
    expect(validateDnd5eActiveEffectsStrict([{ ...protectedEffect, linkedLifetime: { ...protectedEffect.linkedLifetime, protectedRemoval: 'yes' } }]).ok).toBe(false)
    const plain = { ...protectedEffect, id: 'plain', definitionId: 'plain', stackingKey: 'plain', linkedLifetime: undefined }
    const actor = createDnd5eCombatant({ id: 'actor', name: 'Actor', controller: 'player', initiative: 20,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 10,
      currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false,
      pluginFeatureIds: ['test.protected-removal:strip'], classState: { activeEffects: [protectedEffect, plain],
        hitPointMaximumReductionLedger: { schemaVersion: 1, baseMaximum: 30,
          entries: [{ id: 'debit', amount: 10, recovery: 'effect-removal', sourceEffectId: protectedEffect.id }] } } })
    const state = startDnd5eHeadlessCombat('protected', [actor, { ...structuredClone(actor), id: 'other', classState: { schemaVersion: 2 } }])
    const dispelState = structuredClone(state)
    dispelState.combatants.actor.classState.activeEffects![0].source = { kind: 'spell', actorId: 'source', rulesId: 'mage-armor' }
    dispelState.combatants.actor.classState.concentrationEffectsBySource = { source: 'mage-armor' }
    expect(dnd5eDispelMagicEffectsOnTarget(dispelState, 'actor')).toEqual([])
    const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'strip', name: 'Strip', activation: { kind: 'free' },
      target: { kind: 'self' }, legacySource: { kind: 'feature', id: 'strip' }, automation: automationCapabilityFromLegacyStatus('full'),
      outcomes: [{ id: 'strip', when: { kind: 'always' }, operations: [mode === 'id'
        ? { id: 'strip', kind: 'remove-effect', target: 'actor', effectId: protectedEffect.definitionId, source: 'any' }
        : { id: 'strip', kind: 'remove-effects-by-tag', target: 'actor', tags: ['test-marked'], match: 'any', source: 'any' }] }] }
    const dispose = registerDnd5eRulesPlugin({ manifest: { id: 'test.protected-removal', name: 'Removal', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
      api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity))
      api.registerFeature({ id: 'strip', name: 'Strip', summary: 'Synthetic', description: 'Synthetic', automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(activity) })
    } })
    try {
      const before = structuredClone(state)
      const snapshot = dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.actor)
      const result = route === 'compiled'
        ? resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: 'test.protected-removal', actionId: 'strip', featureId: 'test.protected-removal:strip', actorId: 'actor', targetId: 'actor', rolls: {} })
        : commitDnd5eActivityExecution(state, { actorId: 'actor', activityId: 'strip', targetIds: ['actor'],
          resolution: resolveDnd5eActivity({ activity, actor: snapshot, targets: [snapshot], rolls: {} }), source: { kind: 'feature', id: 'strip', packageId: 'test.protected-removal' } })
      // The existing compiled exact-ID contract rejects when nothing can be
      // removed; direct removal is a no-op. Both must preserve the protected debit.
      expect(result.ok, result.ok ? undefined : result.reason).toBe(!(route === 'compiled' && mode === 'id'))
      expect(result.state.combatants.actor.classState.activeEffects?.map(effect => effect.id)).toEqual(mode === 'tag' ? ['protected'] : ['protected', 'plain'])
      expect(result.state.combatants.actor.maxHp).toBe(20)
      expect(result.state.combatants.actor.classState.hitPointMaximumReductionLedger?.entries).toHaveLength(1)
      expect(result.events.some(event => event.type === 'active-effect-removed' && event.effectId === 'protected')).toBe(false)
      expect(state).toEqual(before)
    } finally { dispose() }
  },
)
