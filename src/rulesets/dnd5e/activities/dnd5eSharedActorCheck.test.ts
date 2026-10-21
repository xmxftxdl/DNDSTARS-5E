import { describe, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { dnd5eCombatantPairKey } from '../headlessCombatPrimitives'
import { compileDnd5eActivityHeadlessAction } from './dnd5eActivityHeadlessCompiler'
import { dnd5ePluginFeatureActionFromActivityV1 } from './dnd5eActivityFeatureActionAdapter'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { dnd5eActivitySharedRollDeclarationsV1 } from './dnd5eActivitySharedRolls'
import { registerDnd5eActivityPackage } from './dnd5eActivityRegistry'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'

function activity(kind: 'ability-check' | 'skill-check', mode: 'normal' | 'host-derived' = 'host-derived'): Dnd5eActivityDefinitionV1 {
  return {
    schemaVersion: 1, id: 'shared-check', name: 'Shared check', legacySource: { kind: 'feature', id: 'shared-check' },
    activation: { kind: 'action' }, target: { kind: 'creature', relation: 'any', rangeFeet: 30, count: 2 },
    automation: automationCapabilityFromLegacyStatus('full'),
    checks: [{ id: 'check', kind, ability: 'int', ...(kind === 'skill-check' ? { skill: 'arcana' } : {}),
      rollId: 'check-roll', scope: 'shared', rollMode: mode, dc: { kind: 'constant', value: 15 } }],
    outcomes: [{ id: 'success', when: { kind: 'check', checkId: 'check', result: 'success' },
      operations: [{ id: 'heal', kind: 'healing', target: 'target', amount: { kind: 'constant', value: 5 } }] }],
  }
}

describe('shared actor checks through installed Headless actions', () => {
  it('gates a DC20 caster Insight check by the selected rite through the installed action and live roll recipe', () => {
    const definition = activity('skill-check', 'normal')
    definition.choices = [{ id: 'rite', label: 'Rite', options: [{ id: 'atonement', label: 'Atonement' }, { id: 'water', label: 'Water' }] }]
    definition.checks = [{ id: 'check', kind: 'skill-check', ability: 'wis', skill: 'insight', rollId: 'check-roll',
      scope: 'shared', rollMode: 'normal', dc: { kind: 'constant', value: 20 }, appliesWhenChoice: { choiceId: 'rite', optionIds: ['atonement'] } }]
    expect(validateDnd5eActivityDefinitionV1(definition)).toEqual([])
    const compiled = compileDnd5eActivityHeadlessAction(definition)
    const dispose = registerDnd5eRulesPlugin({ manifest: { id: 'local.choice.check', name: 'Choice check', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
      api.registerHeadlessAction(compiled)
      api.registerFeature({ id: definition.id, name: definition.name, summary: 'Test', description: 'Test', automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(definition) })
    } })
    const registration = registerDnd5eActivityPackage({ packageId: 'local.choice.check', packageVersion: '1.0.0', activities: [definition] })
    try {
      const actor = createDnd5eCombatant({ id: 'actor', name: 'Actor', controller: 'player', initiative: 20, level: 5,
        abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 18, cha: 10 }, proficiencyBonus: 3,
        armorClass: 14, currentHp: 50, maxHp: 100, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
      actor.pluginFeatureIds = ['local.choice.check:shared-check']
      const target = createDnd5eCombatant({ ...actor, id: 'target', initiative: 10, currentHp: 1,
        abilities: { ...actor.abilities, wis: 30 } })
      const state = startDnd5eHeadlessCombat('choice-check-test', [actor, target])
      state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('actor', 'target')]: 10 }
      const action = { type: 'plugin' as const, pluginId: 'local.choice.check', actionId: definition.id,
        featureId: 'local.choice.check:shared-check', actorId: actor.id, targetId: target.id, targetIds: [target.id], distanceFeet: 10 }
      for (const rite of ['atonement', 'water']) {
        const choices = { rite }
        const recipe = dnd5eActivitySharedRollDeclarationsV1({ activity: definition, declarations: compiled.rolls, actor, choices })
        expect(recipe).toHaveLength(rite === 'atonement' ? 1 : 0)
        if (recipe.length) expect(recipe[0].rollerTokenId).toBe(actor.id)
        for (const d20 of [15, 16]) {
          const result = resolveDnd5eHeadlessAction(state, { ...action, payload: { activityChoices: choices },
            rolls: rite === 'atonement' ? { 'check-roll': { values: [d20], modifier: 0, total: d20 } } : {} })
          expect(result.ok, JSON.stringify(result)).toBe(true)
          expect(result.state.combatants.target.currentHp).toBe(rite === 'atonement' && d20 === 16 ? 6 : 1)
        }
      }
      expect(resolveDnd5eHeadlessAction(state, { ...action, payload: { activityChoices: { rite: 'atonement' } }, rolls: {} }).ok).toBe(false)
      expect(state.combatants.target.currentHp).toBe(1)
      const invalid = structuredClone(definition)
      Object.assign(invalid.checks![0], { appliesWhenChoice: { choiceId: 'rite', optionIds: ['missing'] } })
      expect(validateDnd5eActivityDefinitionV1(invalid).join(';')).toContain('unknown choice option')
      for (const malformed of [{ choiceId: 'rite', optionIds: 'atonement' }, { choiceId: 'rite' },
        { choiceId: 'rite', optionIds: [] }, { choiceId: 'rite', optionIds: ['atonement', 'atonement'] }]) {
        Object.assign(invalid.checks![0], { appliesWhenChoice: malformed })
        expect(validateDnd5eActivityDefinitionV1(invalid).join(';')).toContain('appliesWhenChoice is invalid')
      }
    } finally { registration.dispose(); dispose() }
  })
  it.each(['ability-check', 'skill-check'] as const)('uses one %s for every target with Host-derived mode', kind => {
    const definition = activity(kind)
    const compiled = compileDnd5eActivityHeadlessAction(definition)
    expect(compiled.rolls).toEqual([expect.objectContaining({ id: 'check-roll', count: 2, sides: 20 })])
    expect(compiled.perTargetRolls).toEqual([])
    const dispose = registerDnd5eRulesPlugin({ manifest: { id: 'local.shared.check', name: 'Shared check', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
      api.registerHeadlessAction(compiled)
      api.registerFeature({ id: definition.id, name: definition.name, summary: 'Test', description: 'Test', automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(definition) })
    } })
    try {
      for (const mode of ['normal', 'advantage', 'disadvantage', 'cancelled'] as const) {
        const actor = createDnd5eCombatant({ id: 'actor', name: 'Actor', controller: 'player', initiative: 20, level: 5,
          abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 }, proficiencyBonus: 3,
          armorClass: 14, currentHp: 50, maxHp: 100, temporaryHp: 0, speed: 30, saveDc: 15, position: { x: 0, y: 0 }, concentrating: false })
        actor.pluginFeatureIds = ['local.shared.check:shared-check']
        if (mode === 'advantage' || mode === 'cancelled') actor.classState.helpedAbilityCheckSourceId = 'helper'
        if (mode === 'disadvantage' || mode === 'cancelled') actor.exhaustionLevel = 1
        const first = createDnd5eCombatant({ ...actor, id: 'first', initiative: 10, currentHp: 1 })
        const second = createDnd5eCombatant({ ...actor, id: 'second', initiative: 5, currentHp: 1 })
        const state = startDnd5eHeadlessCombat('shared-check-test', [actor, first, second])
        state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('actor', 'first')]: 10, [dnd5eCombatantPairKey('actor', 'second')]: 10 }
        const action = { type: 'plugin' as const, pluginId: 'local.shared.check', actionId: definition.id,
          featureId: 'local.shared.check:shared-check', actorId: 'actor', targetId: 'first', targetIds: ['first', 'second'], distanceFeet: 10 }
        const recipe = dnd5eActivitySharedRollDeclarationsV1({ activity: definition, declarations: compiled.rolls, actor: state.combatants.actor })
        const effectiveMode = mode === 'cancelled' ? 'normal' : mode
        expect(recipe[0]).toMatchObject({ count: effectiveMode === 'normal' ? 1 : 2, sides: 20,
          d20RollKind: 'ability-check', d20RollMode: effectiveMode, rollerTokenId: 'actor' })
        const currentValues = effectiveMode === 'normal' ? [3] : [3, 17]
        const activityRegistration = registerDnd5eActivityPackage({ packageId: 'local.shared.check', packageVersion: '1.0.0', activities: [definition] })
        try {
          const current = resolveDnd5eHeadlessAction(state, { ...action, rolls: { 'check-roll': {
            values: currentValues, modifier: 0, total: currentValues.reduce((a,b) => a+b, 0) } } })
          expect(current.ok, JSON.stringify(current)).toBe(true)
          expect(current.state.combatants.first.currentHp).toBe(mode === 'advantage' ? 6 : 1)
          expect(current.state.combatants.second.currentHp).toBe(mode === 'advantage' ? 6 : 1)
        } finally { activityRegistration.dispose() }
        const result = resolveDnd5eHeadlessAction(state, { ...action, rolls: { 'check-roll': { values: [3, 17], modifier: 0, total: 20 } } })
        expect(result.ok, JSON.stringify(result)).toBe(true)
        expect(result.state.combatants.first.currentHp).toBe(mode === 'advantage' ? 6 : 1)
        expect(result.state.combatants.second.currentHp).toBe(mode === 'advantage' ? 6 : 1)
        const forged = resolveDnd5eHeadlessAction(state, { ...action, rolls: { 'check-roll': { values: [21, 21], modifier: 0, total: 42 } } })
        expect(forged.ok).toBe(false)
        expect(forged.state.combatants.first.currentHp).toBe(1)
        const missing = resolveDnd5eHeadlessAction(state, { ...action, rolls: {} })
        expect(missing.ok).toBe(false)
      }
    } finally { dispose() }
  })

  it('declares one die for normal checks and keeps target saves distinct', () => {
    expect(compileDnd5eActivityHeadlessAction(activity('ability-check', 'normal')).rolls?.[0].count).toBe(1)
    const definition = activity('ability-check')
    definition.checks = [{ id: 'check', kind: 'saving-throw', ability: 'dex', rollId: 'save', scope: 'shared', dc: { kind: 'constant', value: 15 } }]
    expect(() => compileDnd5eActivityHeadlessAction(definition)).toThrow('saving-throw/shared')
  })
})
