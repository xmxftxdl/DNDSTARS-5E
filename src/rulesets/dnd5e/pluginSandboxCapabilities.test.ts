import { describe, expect, it } from 'vitest'
import { registerDnd5eRulesPlugin } from './pluginApi'
import {
  createDnd5eCombatant,
  resolveDnd5eSandboxedPluginCapabilities,
  startDnd5eHeadlessCombat,
} from './headlessCombatEngine'

const abilities = { str: 10, dex: 12, con: 14, int: 10, wis: 12, cha: 10 } as const

function combatant(id: string, initiative: number, controller: 'dm' | 'player', pluginFeatureIds: string[] = []) {
  return createDnd5eCombatant({
    id,
    name: id,
    controller,
    initiative,
    abilities,
    proficiencyBonus: 2,
    armorClass: 14,
    currentHp: 20,
    maxHp: 20,
    temporaryHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    concentrating: false,
    pluginFeatureIds,
  })
}

describe('D&D 5e plugin Worker capability application', () => {
  it('allows only the preflight actor or target and spends economy in the trusted host', () => {
    const pluginId = 'com.example.sandbox-test'
    const featureId = `${pluginId}:guard`
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: pluginId,
        name: 'Sandbox Test',
        version: '1.0.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Tests',
        license: 'CC0-1.0',
      },
      setup(api) {
        api.registerHeadlessAction({ id: 'guard', execution: 'worker' })
        api.registerFeature({
          id: 'guard',
          name: 'Guard',
          summary: 'Guard summary',
          description: 'Guard description',
          automation: 'full',
          action: {
            id: 'guard',
            label: 'Guard',
            economy: 'action',
            targeting: { kind: 'single-creature', relation: 'ally', rangeFeet: 30, includeSelf: true },
          },
        })
      },
    })
    try {
      const state = startDnd5eHeadlessCombat('sandbox-capability', [
        combatant('actor', 20, 'player', [featureId]),
        combatant('ally', 15, 'player'),
        combatant('enemy', 10, 'dm'),
      ])
      const action = {
        type: 'plugin' as const,
        pluginId,
        actionId: 'guard',
        featureId,
        actorId: 'actor',
        targetId: 'ally',
        distanceFeet: 10,
      }
      const escapedTarget = resolveDnd5eSandboxedPluginCapabilities(state, action, [
        { kind: 'heal', targetId: 'enemy', amount: 10 },
      ])
      expect(escapedTarget).toMatchObject({ ok: false, reason: 'invalid-plugin-action' })
      expect(escapedTarget.state.combatants.actor.turn.actionAvailable).toBe(true)

      const accepted = resolveDnd5eSandboxedPluginCapabilities(state, action, [
        { kind: 'grant-temporary-hit-points', targetId: 'ally', amount: 3 },
      ])
      expect(accepted.ok).toBe(true)
      expect(accepted.state.combatants.ally.temporaryHp).toBe(3)
      expect(accepted.state.combatants.actor.turn.actionAvailable).toBe(false)

      const conditioned = resolveDnd5eSandboxedPluginCapabilities(state, action, [{
        kind: 'apply-standard-condition',
        targetId: 'ally',
        condition: 'restrained',
        duration: { expiresAt: 'target-turn-end', remainingRounds: 2 },
      }])
      expect(conditioned.ok).toBe(true)
      expect(conditioned.state.combatants.ally.conditions).toContain('restrained')
      expect(conditioned.state.combatants.ally.turn.movementRemaining).toBe(0)
      expect(conditioned.state.combatants.ally.classState.activeEffects?.[0]).toMatchObject({
        standardCondition: 'restrained',
        duration: { remainingRounds: 2 },
        source: { actorId: 'actor' },
      })
    } finally {
      dispose()
    }
  })
})
