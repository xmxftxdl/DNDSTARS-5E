import { describe, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { createDnd5eMechanicalEffect, normalizeDnd5eActiveEffects, validateDnd5eActiveEffectsStrict } from './activeEffects'
import { createDnd5eCombatant, endDnd5eConcentration, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { resolveDnd5eActivity } from './activities/dnd5eActivityExecutor'
import { validateDnd5eActivityDefinitionV1 } from './activities/dnd5eActivityValidation'
import { dnd5eActivityAutomationAnalysisV1 } from './plugins/pluginMechanicsRegistry'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'

const abilities = { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 }
const actor = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, controller: 'player', initiative,
  abilities, proficiencyBonus: 2, armorClass: 10, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30,
  position: { x: 0, y: 0 }, concentrating: false })
const suppression = () => createDnd5eMechanicalEffect({ definitionId: 'test:suppression', label: 'Suppression',
  source: { kind: 'spell', actorId: 'attacker' }, targetId: 'target', duration: { type: 'permanent' },
  modifiers: { suppressDamageResistance: 'fire' } })

describe('temporary typed resistance suppression', () => {
  it.each(['base', 'effect', 'conditional', 'defense-rule', 'immune', 'vulnerable', 'other-type', 'removed', 'suspended', 'concentration-ended'] as const)('%s defense after JSON persistence', mode => {
    const attacker = actor('attacker', 20), target = actor('target', 10)
    target.damageResistances = ['fire', 'cold']
    const effect = suppression()
    if (mode === 'concentration-ended') {
      attacker.concentrating = true
      attacker.classState.concentrationSpellId = 'suppression'
      effect.duration = { type: 'concentration', sourceActorId: attacker.id, concentrationId: 'suppression', remainingRounds: 10 }
    }
    if (mode === 'suspended') effect.suspendedBy = ['test:suspension']
    target.classState.activeEffects = mode === 'removed' ? [] : [effect]
    if (mode === 'effect' || mode === 'conditional') {
      target.damageResistances = []
      target.classState.activeEffects.push(createDnd5eMechanicalEffect({ definitionId: 'test:resistance', label: 'Resistance',
        source: { kind: 'spell' }, targetId: target.id, duration: { type: 'permanent' }, modifiers: mode === 'effect'
          ? { damageResistance: 'fire' } : { conditionalDamageResistances: [{ damageTypes: ['fire'], sourceMagical: false }] } }))
    }
    if (mode === 'immune') target.damageImmunities = ['fire']
    if (mode === 'vulnerable') target.damageVulnerabilities = ['fire']
    if (mode === 'defense-rule') {
      target.damageResistances = []
      target.damageDefenseRules = [{ outcome: 'resistant', damageTypes: ['fire'], magical: false }]
    }
    target.classState.activeEffects = normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify(target.classState.activeEffects)))
    const state = startDnd5eHeadlessCombat('suppression', [attacker, target])
    if (mode === 'concentration-ended') {
      endDnd5eConcentration(state, state.combatants.attacker, [])
      expect(state.combatants.target.classState.activeEffects ?? []).toHaveLength(0)
    }
    const before = JSON.stringify(state)
    const result = resolveDnd5eHeadlessAction(state, { type: 'attack', actorId: attacker.id, targetId: target.id,
      attackModifier: 10, d20: 15, damage: { count: 1, sides: 8, bonus: 0, rolls: [8], type: mode === 'other-type' ? 'cold' : 'fire' } })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const damage = mode === 'immune' ? 0 : mode === 'vulnerable' ? 16 : ['other-type', 'removed', 'suspended', 'concentration-ended'].includes(mode) ? 4 : 8
    expect(result.state.combatants.target.currentHp).toBe(30 - damage)
    expect(result.state.combatants.target.damageResistances).toEqual(target.damageResistances)
    expect(JSON.stringify(state)).toBe(before)
  })

  it('validates and projects a public modifier, rejecting invalid damage types', () => {
    const definition: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'suppress', name: 'Suppress', activation: { kind: 'action' }, automation: automationCapabilityFromLegacyStatus('full'),
      target: { kind: 'self' }, effects: [{ schemaVersion: 1, id: 'suppression', name: 'Suppression', stacking: 'replace',
        duration: { kind: 'rounds', rounds: 10, expiresAt: 'target-turn-end' }, modifiers: [{ kind: 'suppress-damage-resistance', damageType: 'fire' }] }],
      outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [{ id: 'apply', kind: 'apply-effect', target: 'actor', effectId: 'suppression' }] }] }
    expect(validateDnd5eActivityDefinitionV1(definition)).toEqual([])
    expect(dnd5eActivityAutomationAnalysisV1(definition).capability.level).toBe('full')
    const snapshot = { id: 'actor', controller: 'players' as const, level: 5, proficiencyBonus: 3, abilities,
      armorClass: 10, currentHp: 30, maxHp: 30, conditions: [] }
    const resolved = resolveDnd5eActivity({ activity: definition, actor: snapshot, targets: [snapshot], rolls: {} })
    expect(resolved.ok).toBe(true)
    expect(JSON.stringify(resolved)).toContain('"suppressDamageResistance":"fire"')
    const invalid = JSON.parse(JSON.stringify(definition))
    invalid.effects[0].modifiers[0].damageType = 'invalid'
    expect(validateDnd5eActivityDefinitionV1(invalid).length).toBeGreaterThan(0)
    const invalidEffect = JSON.parse(JSON.stringify(suppression()))
    invalidEffect.modifiers.suppressDamageResistance = 'invalid'
    expect(validateDnd5eActiveEffectsStrict([invalidEffect]).issues.length).toBeGreaterThan(0)
  })
})
