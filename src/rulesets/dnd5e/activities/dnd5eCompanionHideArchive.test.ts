import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { exportDnd5eStarMod, readDnd5eStarMod } from '../starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from '../unifiedContent'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, dnd5eCombatantPairKey, dnd5eDirectedCombatantPairKey } from '../headlessCombatEngine'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

it.each(['registered', 'compiled'] as const)('imports and resolves a group Hide command through %s authority', async path => {
  const namespace = 'test.companion-hide', automation = automationCapabilityFromLegacyStatus('full')
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'hide-order', name: 'Hide order',
    activation: { kind: 'bonus-action' }, automation, legacySource: { kind: 'feature', id: 'hide-order' },
    target: { kind: 'creature', count: 2, relation: 'any', rangeFeet: 60 },
    consumption: [{ kind: 'action-economy', economy: 'bonus-action', amount: 1, consumeOn: 'resolve' }],
    outcomes: [{ id: 'order', when: { kind: 'always' }, operations: [{ id: 'order', kind: 'command-owned-companion',
      target: 'target', sourceActivityId: 'summon', command: 'hide' }] }] }
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  const bundle: Dnd5eUnifiedContentBundleV1 = { format: 'dndstars5e-unified-content', schemaVersion: 1, assets: [],
    manifest: { id: namespace, name: 'Test', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0', distributionPolicy: 'local-only' },
    definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'hide-order', name: 'Hide order', automation,
      payload: { id: 'hide-order', name: 'Hide order', summary: 'Synthetic', description: 'Synthetic', automation: 'full' }, activities: [activity] }] }
  const archive = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
  expect(archive.bundle.definitions[0].activities).toEqual([activity])
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(archive.bundle))
  try {
    const state = startDnd5eHeadlessCombat('hide-test', ['owner', 'first', 'second', 'observer'].map(id => createDnd5eCombatant({
      id, name: id, controller: id === 'observer' ? 'dm' : 'player', initiative: id === 'owner' ? 20 : 10,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
      armorClass: 10, currentHp: 100, maxHp: 100, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false,
      pluginFeatureIds: id === 'owner' ? [namespace + ':hide-order'] : [] })))
    for (const id of ['first', 'second']) Object.assign(state.combatants[id], { summonedSourceCombatantId: 'owner',
      summonedSourcePackageId: namespace, summonedSourceActivityId: 'summon', summonedCommandPolicy: 'persistent-order' })
    state.distanceFeetByCombatantPair = Object.fromEntries(['first', 'second'].map(id => [dnd5eCombatantPairKey('owner', id), 30]))
    state.lineOfSightBlockedByCombatantPair = Object.fromEntries(['first', 'second'].map(id => [dnd5eDirectedCombatantPairKey('observer', id), true as const]))
    const result = path === 'registered' ? resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1, confirmedBy: 'actor', authoritativeRolls: {},
      command: { schemaVersion: 1, commandId: 'order', actorId: 'owner', packageId: namespace, packageVersion: '1.0.0', activityId: 'hide-order', targetIds: ['first', 'second'], expectedRevision: 1 } }).result
      : resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: namespace, featureId: namespace + ':hide-order', actionId: 'hide-order', actorId: 'owner',
        targetId: 'first', targetIds: ['first', 'second'], distanceFeet: 30 })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) throw Error('Command rejected')
    expect(result.state.combatants.owner.turn.bonusActionAvailable).toBe(false)
    expect(result.state.combatants.owner.turn.actionAvailable).toBe(true)
    const saved = JSON.parse(JSON.stringify(result.state)) as typeof state
    for (const id of ['first', 'second']) {
      expect(saved.combatants[id].classState.companionCommand?.command).toBe('hide')
      saved.initiativeIndex = saved.initiativeOrder.indexOf(id)
      const hidden = resolveDnd5eHeadlessAction(saved, { type: 'hide', actorId: id, d20: 20 })
      expect(hidden.ok, JSON.stringify(hidden)).toBe(true)
      expect(hidden.state.combatants[id].classState.hiddenCheckTotal).toBe(20)
      expect(hidden.state.combatants[id].turn.actionAvailable).toBe(false)
    }
  } finally { dispose() }
})
