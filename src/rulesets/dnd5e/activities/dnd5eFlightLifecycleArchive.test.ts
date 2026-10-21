import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { exportDnd5eStarMod, readDnd5eStarMod } from '../starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from '../unifiedContent'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import { createDnd5eConditionEffect } from '../activeEffects'

it.each(['dismiss', 'incapacitated', 'stunned', 'paralyzed', 'unconscious', 'petrified', 'death'] as const)(
  'ends installed synthetic flight through %s while enforcing the grant', async mode => {
  const namespace = 'test.flight-lifecycle'
  const automation = automationCapabilityFromLegacyStatus('full')
  const bundle: Dnd5eUnifiedContentBundleV1 = {
    format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Synthetic flight', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' },
    assets: [], definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'wings', name: 'Wings', automation,
      payload: { id: 'wings', name: 'Wings', summary: 'Synthetic', description: 'Synthetic fixture', automation: 'full' },
      activities: [
        { schemaVersion: 1, id: 'wings', name: 'Wings', activation: { kind: 'bonus-action' }, target: { kind: 'self' }, automation,
          legacySource: { kind: 'feature', id: 'wings' }, effects: [{ schemaVersion: 1, id: 'flight', name: 'Flight', stacking: 'replace',
            duration: { kind: 'permanent' }, modifiers: [{ kind: 'flight-speed', speedFeet: 30 }],
            sourceLink: { sourceMustNotBeIncapacitated: true }, breakOn: ['source-dies'], grants: ['dismiss'] }],
          outcomes: [{ id: 'grow', when: { kind: 'always' }, operations: [{ id: 'grow', kind: 'apply-effect', target: 'actor', effectId: 'flight' }] }] },
        { schemaVersion: 1, id: 'dismiss', name: 'Dismiss', activation: { kind: 'bonus-action' }, target: { kind: 'self' }, automation,
          requiresEffectGrant: true, legacySource: { kind: 'feature', id: 'wings' },
          outcomes: [{ id: 'remove', when: { kind: 'always' }, operations: [{ id: 'remove', kind: 'remove-effect', target: 'actor', effectId: 'flight', source: 'self' }] }] },
      ],
    }],
  }
  const decoded = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
  try {
    const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative, controller: 'dm',
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 10,
      currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
    const actor = make('actor', 20), other = make('other', 10)
    actor.pluginFeatureIds = [`${namespace}:wings`]
    const state = startDnd5eHeadlessCombat('flight', [actor, other])
    const command = (actionId: string) => ({ type: 'plugin' as const, pluginId: namespace, actionId,
      featureId: `${namespace}:${actionId === 'dismiss' ? 'effect-control.dismiss' : 'wings'}`, actorId: actor.id, targetId: actor.id, targetIds: [actor.id], rolls: {} })
    expect(resolveDnd5eHeadlessAction(state, command('dismiss')).ok).toBe(false)
    const applied = resolveDnd5eHeadlessAction(state, command('wings'))
    expect(applied.ok, JSON.stringify(applied)).toBe(true)
    const effect = applied.state.combatants.actor.classState.activeEffects?.find(effect => effect.modifiers?.flySpeedFeet === 30)
    expect(effect).toBeDefined()
    const restored = JSON.parse(JSON.stringify(applied.state)) as typeof state
    let ended
    if (mode === 'dismiss') {
      expect(resolveDnd5eHeadlessAction(restored, command('dismiss')).ok).toBe(false)
      const dismiss = { ...command('dismiss'), hostEntitlement: { kind: 'active-effect' as const, effectId: effect!.id } }
      expect(resolveDnd5eHeadlessAction(restored, dismiss).ok).toBe(false)
      restored.combatants.actor.turn.bonusActionAvailable = true
      ended = resolveDnd5eHeadlessAction(restored, dismiss)
      expect(ended.ok, JSON.stringify(ended)).toBe(true)
      expect(ended.state.combatants.actor.turn.bonusActionAvailable).toBe(false)
    } else {
      restored.initiativeIndex = restored.initiativeOrder.indexOf(other.id)
      if (mode === 'death') {
        ended = resolveDnd5eHeadlessAction(restored, { type: 'attack', actorId: other.id, targetId: actor.id,
          attackModifier: 20, d20: 10, damage: { count: 1, sides: 100, bonus: 0, rolls: [100], type: 'slashing' } })
        expect(ended.state.combatants.actor.currentHp).toBe(0)
      } else {
        restored.combatants.actor.conditions = [mode]
        restored.combatants.actor.classState.activeEffects!.push(createDnd5eConditionEffect({ condition: mode,
          source: { kind: 'system' }, targetId: actor.id }))
        ended = resolveDnd5eHeadlessAction(restored, { type: 'ability-check', actorId: other.id, ability: 'int', d20: 10, dc: 5 })
      }
    }
    expect(ended.ok, JSON.stringify(ended)).toBe(true)
    expect(ended.state.combatants.actor.classState.activeEffects?.some(candidate => candidate.id === effect!.id)).toBeFalsy()
  } finally { dispose() }
})
