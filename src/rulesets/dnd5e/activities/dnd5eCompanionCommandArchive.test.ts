import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { exportDnd5eStarMod, readDnd5eStarMod } from '../starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from '../unifiedContent'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, dnd5eCombatantPairKey, dnd5eDirectedCombatantPairKey } from '../headlessCombatEngine'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'
import { getRegisteredDnd5eActivity } from './dnd5eActivityRegistry'
import { createDnd5eConditionEffect, createDnd5eMechanicalEffect } from '../activeEffects'

it.each(['direct', 'choice', 'slot'].flatMap(projection => [[false, false, false], [true, false, false], [false, true, false], [true, true, false], [false, false, true], [true, false, true]]
  .map(([sight, effect, reverse]) => ({ projection, sight, effect, reverse }))))('preserves archive target restrictions: $projection sight=$sight effect=$effect reverse=$reverse', async ({ projection, sight: requiresLineOfSight, effect: requiresLineOfEffect, reverse: requiresTargetSeeActor }) => {
  const namespace = 'test.companion-archive'
  const automation = automationCapabilityFromLegacyStatus('full')
  const bundle: Dnd5eUnifiedContentBundleV1 = {
    format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Synthetic command module', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' },
    assets: [], definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'order', name: 'Order', automation,
      payload: { id: 'order', name: 'Order', summary: 'Synthetic', description: 'Synthetic fixture', automation: 'full' },
      activities: [{ schemaVersion: 1, id: 'order', name: 'Order', activation: { kind: 'bonus-action' },
        target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: projection === 'direct' ? 120 : 5,
          requiresTargetSeeActor: projection === 'direct' && requiresTargetSeeActor,
          requiresLineOfSight: projection === 'direct' && requiresLineOfSight, requiresLineOfEffect: projection === 'direct' && requiresLineOfEffect }, automation,
        ...(projection === 'choice' ? { choices: [{ id: 'mode', label: 'Mode', options: [{ id: 'selected', label: 'Selected',
          targetOverride: { kind: 'creature' as const, relation: 'any' as const, count: 1, rangeFeet: 120, requiresLineOfSight, requiresLineOfEffect, requiresTargetSeeActor } }] }] } : {}),
        ...(projection === 'slot' ? { castLevelTargetProfiles: [{ minimumCastLevel: 3,
          target: { kind: 'creature' as const, relation: 'any' as const, count: 1, rangeFeet: 120, requiresLineOfSight, requiresLineOfEffect, requiresTargetSeeActor } }] } : {}),
        legacySource: { kind: 'feature', id: 'order' },
        requirements: [{ kind: 'owned-companion', subject: 'target', source: { packageId: namespace, activityId: 'summon' } }],
        consumption: [{ kind: 'action-economy', economy: 'bonus-action', amount: 1, consumeOn: 'resolve' }],
        outcomes: [{ id: 'order', when: { kind: 'always' }, operations: [{ id: 'help', kind: 'command-owned-companion',
          target: 'target', command: 'help', sourceActivityId: 'summon', requiresHelpTarget: true }] }],
      }],
    }],
  }
  const original = structuredClone(bundle)
  let bytes = await exportDnd5eStarMod(bundle)
  for (let installation = 0; installation < 2; installation++) {
    const decoded = await readDnd5eStarMod(bytes)
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
    try {
      expect(getRegisteredDnd5eActivity(namespace, 'order')?.outcomes[0].operations[0])
        .toMatchObject({ requiresHelpTarget: true })
      const actor = createDnd5eCombatant({ id: 'owner', name: 'Owner', controller: 'player', initiative: 20,
        abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
        armorClass: 12, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false,
        pluginFeatureIds: [`${namespace}:order`] })
      const helper = createDnd5eCombatant({ ...structuredClone(actor), id: 'helper', initiative: 10, pluginFeatureIds: [],
        summonedSourceCombatantId: 'owner', summonedSourcePackageId: namespace, summonedSourceActivityId: 'summon', summonedCommandPolicy: 'persistent-order' })
      const enemy = createDnd5eCombatant({ ...structuredClone(actor), id: 'enemy', controller: 'dm', initiative: 5, pluginFeatureIds: [] })
      const state = startDnd5eHeadlessCombat(`archive-${installation}`, [actor, helper, enemy])
      state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('owner', 'helper')]: 10, [dnd5eCombatantPairKey('helper', 'enemy')]: 5 }
      const before = structuredClone(state)
      const run = (targetId: string) => resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1,
        command: { schemaVersion: 1, commandId: `${installation}:order`, actorId: 'owner', packageId: namespace,
          packageVersion: '1.0.0', activityId: 'order', targetIds: ['helper'], expectedRevision: 1,
          castLevel: 3, ...(projection === 'choice' ? { choices: { mode: 'selected' } } : {}),
          companionHelpTargets: { help: { targetId, helpKind: 'attack' } } }, authoritativeRolls: {}, confirmedBy: 'actor' })
      expect(run('missing').result.ok).toBe(false)
      const runCompiled = () => resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: namespace,
        actionId: 'order', featureId: `${namespace}:order`, actorId: 'owner', targetId: 'helper', targetIds: ['helper'],
        distanceFeet: 10, castLevel: 3, rolls: {}, payload: {
          ...(projection === 'choice' ? { activityChoices: { mode: 'selected' } } : {}),
          companionHelpTargets: { help: { targetId: 'enemy', helpKind: 'attack' } },
        } })
      state.physicalLineOfSightBlockedByCombatantPair = { [dnd5eDirectedCombatantPairKey('owner', 'helper')]: true }
      const blockedBefore = structuredClone(state)
      expect(run('enemy').result.ok).toBe(!requiresLineOfSight)
      expect(runCompiled().ok).toBe(!requiresLineOfSight)
      expect(state).toEqual(blockedBefore)
      delete state.physicalLineOfSightBlockedByCombatantPair
      state.physicalLineOfSightBlockedByCombatantPair = { [dnd5eDirectedCombatantPairKey('helper', 'owner')]: true }
      const reverseBefore = structuredClone(state)
      expect(run('enemy').result.ok).toBe(!requiresTargetSeeActor)
      expect(runCompiled().ok).toBe(!requiresTargetSeeActor)
      expect(state).toEqual(reverseBefore)
      delete state.physicalLineOfSightBlockedByCombatantPair
      state.lineOfEffectBlockedByCombatantPair = { [dnd5eDirectedCombatantPairKey('owner', 'helper')]: true }
      const coverBefore = structuredClone(state)
      expect(run('enemy').result.ok).toBe(!requiresLineOfEffect)
      expect(runCompiled().ok).toBe(!requiresLineOfEffect)
      expect(state).toEqual(coverBefore)
      delete state.lineOfEffectBlockedByCombatantPair
      // Physical line of sight alone is not proof that a creature is perceived.
      state.combatants.helper.classState.activeEffects = [createDnd5eConditionEffect({ condition: 'invisible', targetId: 'helper', source: { kind: 'spell' } })]
      state.combatants.helper.conditions = ['invisible']
      expect(run('enemy').result.ok).toBe(!requiresLineOfSight)
      expect(runCompiled().ok).toBe(!requiresLineOfSight)
      state.combatants.owner.classState.activeEffects = [createDnd5eMechanicalEffect({ definitionId: 'test:vision', label: 'Vision',
        targetId: 'owner', source: { kind: 'spell' }, modifiers: { seeInvisible: true } })]
      expect(run('enemy').result.ok).toBe(true)
      expect(runCompiled().ok).toBe(true)
      state.combatants.helper = structuredClone(before.combatants.helper)
      state.combatants.owner = structuredClone(before.combatants.owner)
      state.combatants.owner.classState.activeEffects = [createDnd5eConditionEffect({ condition: 'blinded', targetId: 'owner', source: { kind: 'spell' } })]
      state.combatants.owner.conditions = ['blinded']
      expect(run('enemy').result.ok).toBe(!requiresLineOfSight)
      expect(runCompiled().ok).toBe(!requiresLineOfSight)
      state.combatants.owner = structuredClone(before.combatants.owner)
      for (const sourcePackage of ['other.module', undefined]) {
        state.combatants.helper.summonedSourcePackageId = sourcePackage
        const wrongSource = structuredClone(state)
        expect(runCompiled().ok).toBe(false)
        expect(run('enemy').result.ok).toBe(false)
        expect(state).toEqual(wrongSource)
      }
      state.combatants.helper.summonedSourcePackageId = namespace
      const compiled = runCompiled()
      expect(compiled.ok, JSON.stringify(compiled)).toBe(true)
      if (compiled.ok) expect(compiled.state.combatants.helper.classState.companionCommand).toMatchObject({ helpTargetId: 'enemy' })
      const issued = run('enemy')
      expect(issued.result.ok, JSON.stringify(issued)).toBe(true)
      if (issued.phase !== 'commit' || !issued.result.ok) throw Error('Order did not commit')
      expect(issued.result.state.combatants.owner.turn.bonusActionAvailable).toBe(false)
      const restored = JSON.parse(JSON.stringify(issued.result.state)) as typeof state
      expect(restored.combatants.helper.classState.companionCommand).toMatchObject({ helpTargetId: 'enemy', helpKind: 'attack' })
      const advanced = resolveDnd5eHeadlessAction(restored, { type: 'end-turn', actorId: 'owner' })
      expect(advanced.ok).toBe(true)
      if (!advanced.ok) throw Error('Could not advance')
      expect(resolveDnd5eHeadlessAction(advanced.state, { type: 'help', actorId: 'helper', targetId: 'owner', helpKind: 'ability-check' }).ok).toBe(false)
      const helped = resolveDnd5eHeadlessAction(advanced.state, { type: 'help', actorId: 'helper', targetId: 'enemy', helpKind: 'attack' })
      expect(helped.ok, JSON.stringify(helped)).toBe(true)
      if (helped.ok) expect(helped.state.combatants.enemy.classState.helpedAttackSourceId).toBe('helper')
      expect(state).toEqual(before)
      bytes = await exportDnd5eStarMod(decoded.bundle)
    } finally { dispose() }
    expect(getRegisteredDnd5eActivity(namespace, 'order')).toBeUndefined()
  }
  expect(bundle).toEqual(original)
})
