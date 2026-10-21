import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import {
  applyDnd5eStandardConditionEffect,
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
} from '../headlessCombatEngine'
import { dnd5eCombatantPairKey } from '../headlessCombatPrimitives'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'
import {
  clearDnd5eActivityRegistryForTests,
  registerDnd5eActivityPackage,
} from './dnd5eActivityRegistry'
import { listDnd5eActivityTriggerWindowsV1 } from './dnd5eActivityTriggerWindows'
import { settleDnd5eActivityTriggerWindowsV1 } from './dnd5eActivityTriggerSettlement'
import { createDnd5eMechanicalEffect } from '../activeEffects'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { compileDnd5eActivityHeadlessAction } from './dnd5eActivityHeadlessCompiler'
import { dnd5ePluginFeatureActionFromActivityV1 } from './dnd5eActivityFeatureActionAdapter'
import { normalizeCharacter } from '../../../store/characters'
import type { BattleMap } from '../../../store/maps'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from '../mapBridge'
import { dnd5eStandardConditionId } from '../conditions'

const PACKAGE_ID = 'e2e.unified-activities'
const PACKAGE_VERSION = '1.0.0'
const automation = automationCapabilityFromLegacyStatus('full')
const abilities = { str: 14, dex: 14, con: 12, int: 10, wis: 10, cha: 10 } as const

const activities: readonly Dnd5eActivityDefinitionV1[] = [{
  schemaVersion: 1,
  id: 'active-pulse',
  name: 'Active pulse',
  activation: { kind: 'action', cost: 1 },
  invocation: { kind: 'active', confirmation: 'actor-choice' },
  target: { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 30 },
  consumption: [
    { kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' },
    { kind: 'resource', resourceId: 'focus', amount: { kind: 'constant', value: 1 }, consumeOn: 'resolve' },
  ],
  outcomes: [{ id: 'resolve', when: { kind: 'always' }, operations: [{
    id: 'damage', kind: 'damage', target: 'target', amount: { kind: 'constant', value: 3 }, damageType: 'force',
  }] }],
  automation,
  legacySource: { kind: 'feature', id: 'active-pulse' },
}, {
  schemaVersion: 1,
  id: 'light-follow-up',
  name: 'Light weapon follow-up',
  activation: { kind: 'bonus-action', cost: 1 },
  invocation: { kind: 'triggered', event: 'attack-resolved', confirmation: 'actor-choice', retention: 'until-turn-end' },
  target: { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 5 },
  requirements: [
    { kind: 'event-source', source: 'attack' },
    { kind: 'weapon-property', property: 'light', present: true },
    { kind: 'action-economy-available', economy: 'bonus-action' },
    { kind: 'once-per-turn', key: 'light-follow-up' },
  ],
  consumption: [{ kind: 'action-economy', economy: 'bonus-action', amount: 1, consumeOn: 'resolve' }],
  outcomes: [{ id: 'resolve', when: { kind: 'always' }, operations: [{
    id: 'damage', kind: 'damage', target: 'target', amount: { kind: 'constant', value: 2 }, damageType: 'slashing',
  }] }],
  automation,
  legacySource: { kind: 'feature', id: 'light-follow-up' },
}, {
  schemaVersion: 1,
  id: 'retaliation',
  name: 'Retaliation',
  activation: { kind: 'reaction', cost: 1, reactionEvent: 'after being hit' },
  invocation: { kind: 'triggered', event: 'reaction-window', confirmation: 'actor-choice' },
  target: { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 5 },
  requirements: [
    { kind: 'event-source', source: 'attack' },
    { kind: 'attack-result', result: 'hit' },
    { kind: 'action-economy-available', economy: 'reaction' },
  ],
  consumption: [{ kind: 'action-economy', economy: 'reaction', amount: 1, consumeOn: 'resolve' }],
  outcomes: [{ id: 'resolve', when: { kind: 'always' }, operations: [{
    id: 'damage', kind: 'damage', target: 'target', amount: { kind: 'constant', value: 1 }, damageType: 'force',
  }] }],
  automation,
  legacySource: { kind: 'feature', id: 'retaliation' },
}, {
  schemaVersion: 1,
  id: 'event-target-splash',
  name: 'Event target splash',
  activation: { kind: 'free', cost: 0 },
  invocation: { kind: 'triggered', event: 'attack-hit', confirmation: 'automatic' },
  target: {
    kind: 'area', relation: 'any', origin: 'event-target', shape: 'circle', radiusFeet: 5,
    maximumTargets: 8, includeSelf: true, excludeEventTarget: true,
  },
  requirements: [{ kind: 'attack-result', result: 'hit' }],
  outcomes: [{ id: 'splash', when: { kind: 'always' }, operations: [{
    id: 'splash-damage', kind: 'damage', target: 'all-targets', amount: { kind: 'constant', value: 2 }, damageType: 'force',
  }] }],
  automation,
  legacySource: { kind: 'feature', id: 'event-target-splash' },
}, {
  schemaVersion: 1,
  id: 'after-hurt-guard',
  name: 'After hurt guard',
  activation: { kind: 'free', cost: 0 },
  invocation: { kind: 'triggered', event: 'after-damage', confirmation: 'automatic' },
  target: { kind: 'self' },
  outcomes: [{ id: 'resolve', when: { kind: 'always' }, operations: [{
    id: 'guard', kind: 'temporary-hit-points', target: 'actor', amount: { kind: 'constant', value: 2 },
  }] }],
  automation,
  legacySource: { kind: 'feature', id: 'after-hurt-guard' },
}, {
  schemaVersion: 1,
  id: 'condition-reflection',
  name: 'Condition reflection',
  activation: { kind: 'reaction', cost: 1, reactionEvent: 'after a condition is attempted' },
  invocation: { kind: 'triggered', event: 'on-condition-attempted', confirmation: 'actor-choice' },
  target: { kind: 'creature', relation: 'enemy', count: 1 },
  requirements: [
    { kind: 'event-source', source: 'combat', sourceId: 'condition:charmed' },
    { kind: 'action-economy-available', economy: 'reaction' },
  ],
  consumption: [{ kind: 'action-economy', economy: 'reaction', amount: 1, consumeOn: 'resolve' }],
  checks: [{
    id: 'reflection-save', kind: 'saving-throw', rollId: 'reflection-save', ability: 'wis',
    dc: { kind: 'constant', value: 13 }, scope: 'per-target',
  }],
  effects: [{
    schemaVersion: 1,
    id: 'reflected-charm',
    name: 'Reflected charm',
    duration: { kind: 'rounds', rounds: 10, expiresAt: 'target-turn-end' },
    conditions: ['charmed'],
    breakOn: ['takes-damage'],
    stacking: 'unique-by-source',
  }],
  outcomes: [{ id: 'failed-save', when: { kind: 'check', checkId: 'reflection-save', result: 'failure' }, operations: [{
    id: 'reflect-charm', kind: 'apply-effect', target: 'target', effectId: 'reflected-charm',
  }] }],
  automation,
  legacySource: { kind: 'feature', id: 'condition-reflection' },
}, {
  schemaVersion: 1,
  id: 'feature-chain',
  name: 'Feature chain observer',
  activation: { kind: 'free', cost: 0 },
  invocation: { kind: 'triggered', event: 'feature-used', confirmation: 'automatic' },
  target: { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 30 },
  outcomes: [{ id: 'resolve', when: { kind: 'always' }, operations: [{
    id: 'observe', kind: 'temporary-hit-points', target: 'actor', amount: { kind: 'constant', value: 1 },
  }] }],
  automation,
  legacySource: { kind: 'feature', id: 'feature-chain' },
}, {
  schemaVersion: 1,
  id: 'fire-fist-stance',
  name: 'Fire fist stance',
  activation: { kind: 'free', cost: 0 },
  invocation: { kind: 'active', confirmation: 'actor-choice' },
  target: { kind: 'self' },
  consumption: [{ kind: 'resource', resourceId: 'ki', amount: { kind: 'constant', value: 1 }, consumeOn: 'resolve' }],
  effects: [{
    schemaVersion: 1,
    id: 'fire-fist-mode',
    name: 'Fire fist mode',
    duration: { kind: 'rounds', rounds: 1, expiresAt: 'source-turn-end' },
    modifiers: [{ kind: 'attack-profile', attackModes: ['unarmed'], reachBonusFeet: 10, damageTypeOverride: 'fire' }],
    stacking: 'refresh-duration',
  }],
  outcomes: [{ id: 'resolve', when: { kind: 'always' }, operations: [{
    id: 'apply-fire-fist', kind: 'apply-effect', target: 'actor', effectId: 'fire-fist-mode',
  }] }],
  automation,
  legacySource: { kind: 'feature', id: 'fire-fist-stance' },
}, {
  schemaVersion: 1,
  id: 'fire-fist-hit',
  name: 'Fire fist hit',
  activation: { kind: 'free', cost: 0 },
  invocation: { kind: 'triggered', event: 'attack-hit', confirmation: 'actor-choice', retention: 'single-event' },
  target: { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 15 },
  requirements: [
    { kind: 'attack-mode', mode: 'unarmed' },
    { kind: 'active-effect', subject: 'actor', effectId: 'fire-fist-mode', present: true, source: 'self' },
  ],
  consumption: [{ kind: 'resource', resourceId: 'ki', amount: { kind: 'constant', value: 1 }, consumeOn: 'resolve' }],
  outcomes: [{ id: 'resolve', when: { kind: 'always' }, operations: [{
    id: 'fire-fist-damage', kind: 'damage', target: 'target',
    amount: { kind: 'dice', rollId: 'fire-fist-damage', count: 1, sides: 10 }, damageType: 'fire',
  }] }],
  automation,
  legacySource: { kind: 'feature', id: 'fire-fist-hit' },
}, {
  schemaVersion: 1,
  id: 'suspended-cloud-stance',
  name: 'Suspended cloud stance',
  activation: { kind: 'free', cost: 0 },
  invocation: { kind: 'active', confirmation: 'actor-choice' },
  target: { kind: 'self' },
  effects: [{
    schemaVersion: 1,
    id: 'cloud-transition',
    name: 'Cloud transition',
    duration: { kind: 'rounds', rounds: 1, expiresAt: 'target-turn-end' },
    conditions: ['incapacitated'],
    modifiers: [{ kind: 'speed', mode: 'override', value: { kind: 'constant', value: 0 } }],
    stacking: 'refresh-duration',
  }, {
    schemaVersion: 1,
    id: 'cloud-mode',
    name: 'Cloud mode',
    duration: { kind: 'rounds', rounds: 10, expiresAt: 'target-turn-end' },
    modifiers: [{ kind: 'flight-speed', speedFeet: 300 }],
    suspendWhileEffectId: 'cloud-transition',
    stacking: 'replace',
  }],
  outcomes: [{ id: 'resolve', when: { kind: 'always' }, operations: [{
    id: 'start-transition', kind: 'apply-effect', target: 'actor', effectId: 'cloud-transition',
  }, {
    id: 'apply-cloud', kind: 'apply-effect', target: 'actor', effectId: 'cloud-mode',
  }] }],
  automation,
  legacySource: { kind: 'feature', id: 'suspended-cloud-stance' },
}]

function combatant(id: string, controller: 'player' | 'dm', initiative: number) {
  return createDnd5eCombatant({
    id,
    name: id,
    controller,
    initiative,
    abilities,
    proficiencyBonus: 2,
    armorClass: 12,
    currentHp: 20,
    maxHp: 20,
    temporaryHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    concentrating: false,
    classResources: id === 'actor' ? { focus: { current: 2, max: 2 }, ki: { current: 2, max: 2 } } : undefined,
    pluginFeatureIds: id === 'actor'
      ? [
          'active-pulse', 'light-follow-up', 'feature-chain', 'fire-fist-stance', 'fire-fist-hit',
          'suspended-cloud-stance',
        ]
      : ['retaliation', 'after-hurt-guard', 'condition-reflection'],
    conditionImmunities: id === 'target' ? ['charmed'] : undefined,
  })
}

function combat() {
  const state = startDnd5eHeadlessCombat('activity-e2e', [
    combatant('actor', 'player', 20),
    combatant('target', 'dm', 10),
  ])
  state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('actor', 'target')]: 5 }
  return state
}

beforeEach(() => registerDnd5eActivityPackage({
  packageId: PACKAGE_ID,
  packageVersion: PACKAGE_VERSION,
  activities,
}))
afterEach(clearDnd5eActivityRegistryForTests)

describe('unified Activity Host combat E2E', () => {
  it.each([10, 15, undefined])('does not roll automatic retaliation outside its fixed Host range (%s feet)', async distance => {
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1, id: 'range-retaliation', name: 'Synthetic retaliation', activation: { kind: 'special', timing: 'hit' },
      legacySource: { kind: 'feature', id: 'range-retaliation' },
      invocation: { kind: 'triggered', event: 'reaction-window', confirmation: 'automatic', retention: 'single-event' },
      target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 10 }, automation,
      requirements: [{ kind: 'event-source', source: 'attack' }, { kind: 'attack-result', result: 'hit' }],
      outcomes: [{ id: 'retaliate', when: { kind: 'always' }, operations: [{ id: 'hurt', kind: 'damage', target: 'target', amount: { kind: 'dice', rollId: 'hurt', count: 1, sides: 4 }, damageType: 'necrotic' }] }],
    }
    registerDnd5eActivityPackage({ packageId: 'test.range-retaliation', packageVersion: '1.0.0', activities: [activity] })
    const state = combat()
    state.combatants.actor.pluginFeatureIds = []
    state.combatants.target.pluginFeatureIds = [activity.id]
    state.combatants.target.turn.reactionAvailable = false
    state.distanceFeetByCombatantPair = distance == null ? {} : { [dnd5eCombatantPairKey('actor', 'target')]: distance }
    let rolls = 0, prompts = 0
    const result = await settleDnd5eActivityTriggerWindowsV1({ state, combatRevision: 1, eventBatchId: 'hit',
      events: [{ type: 'attack-resolved', actorId: 'actor', targetId: 'target', attackMode: 'melee', d20: 15, total: 20, armorClass: 12, hit: true, critical: false }],
      confirm: async () => { prompts++; return true }, roll: async () => { rolls++; return [3] },
    })
    expect(rolls).toBe(distance === 10 ? 1 : 0)
    expect(prompts).toBe(0)
    expect(result.state.combatants.actor.currentHp).toBe(distance === 10 ? 17 : 20)
    expect(result.state.combatants.target.turn.reactionAvailable).toBe(false)
  })
  it.each([
    ['attack-roll', 'advantage'], ['attack-roll', 'disadvantage'],
    ['saving-throw', 'advantage'], ['saving-throw', 'disadvantage'],
  ] as const)('keeps explicit %s %s identical through direct and compiled Host settlement', (kind, rollMode) => {
    const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'explicit-mode', name: 'Explicit mode',
      activation: { kind: 'free' }, target: { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 30 },
      legacySource: { kind: 'feature', id: 'explicit-mode' }, automation,
      checks: [kind === 'attack-roll'
        ? { id: 'check', kind, rollId: 'check', scope: 'per-target', rollMode, attackBonus: { kind: 'constant', value: 0 } }
        : { id: 'check', kind, rollId: 'check', scope: 'per-target', rollMode, ability: 'wis', dc: { kind: 'constant', value: 12 } }],
      outcomes: [{ id: 'success', when: { kind: 'check', checkId: 'check', result: 'success' }, operations: [
        { id: 'damage', kind: 'damage', target: 'target', damageType: 'force', amount: { kind: 'constant', value: 3 } },
      ] }] }
    const packageId = 'test.explicit-mode', pluginId = 'test.explicit-mode-compiled'
    registerDnd5eActivityPackage({ packageId, packageVersion: '1.0.0', activities: [activity] })
    const state = combat()
    state.combatants.actor.pluginFeatureIds = [activity.id]
    const rolls = { 'check:target': { values: [2, 17], modifier: 0, total: 19 } }
    const direct = resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1,
      command: { schemaVersion: 1, commandId: 'mode', actorId: 'actor', packageId, packageVersion: '1.0.0',
        activityId: activity.id, targetIds: ['target'], expectedRevision: 1 }, authoritativeRolls: rolls, confirmedBy: 'actor' })
    expect(direct.result.ok, JSON.stringify(direct.result)).toBe(true)
    if (direct.phase !== 'commit' || !direct.result.ok) throw Error('expected commit')
    const expectedHp = rollMode === 'advantage' ? 17 : 20
    expect(direct.result.state.combatants.target.currentHp).toBe(expectedHp)
    const compiledDefinition = compileDnd5eActivityHeadlessAction(activity)
    expect(compiledDefinition.perTargetRolls?.[0].count).toBe(2)
    const dispose = registerDnd5eRulesPlugin({ manifest: { id: pluginId, name: 'Modes', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Test', license: 'CC0' }, setup(api) {
      api.registerHeadlessAction(compiledDefinition)
      api.registerFeature({ id: activity.id, name: activity.name, summary: 'Test', description: 'Test', automation: 'full',
        action: dnd5ePluginFeatureActionFromActivityV1(activity) })
    } })
    try {
      state.combatants.actor.pluginFeatureIds = [`${pluginId}:${activity.id}`]
      const compiled = resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId, actionId: activity.id,
        featureId: `${pluginId}:${activity.id}`, actorId: 'actor', targetId: 'target', distanceFeet: 5, rolls })
      expect(compiled.ok, JSON.stringify(compiled)).toBe(true)
      expect(compiled.state.combatants.target.currentHp).toBe(expectedHp)
      expect(state.combatants.target.currentHp).toBe(20)
      const missingDie = resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId, actionId: activity.id,
        featureId: `${pluginId}:${activity.id}`, actorId: 'actor', targetId: 'target', distanceFeet: 5,
        rolls: { 'check:target': { values: [17], modifier: 0, total: 17 } } })
      expect(missingDie.ok).toBe(false)
      expect(missingDie.state.combatants.target.currentHp).toBe(20)
    } finally { dispose() }
  })
  it.each(['generic', 'legacy', 'suspended', 'absent', 'companion-near', 'companion-far', 'companion-passive-near', 'companion-passive-far'] as const)('uses the same healing dice maximum in both Host Activity routes: %s', kind => {
    const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'maximum-heal', name: 'Synthetic healing',
      activation: { kind: 'free' }, target: { kind: 'self' }, legacySource: { kind: 'feature', id: 'maximum-heal' }, automation,
      outcomes: [{ id: 'heal', when: { kind: 'always' }, operations: [{ id: 'heal', kind: 'healing', target: 'actor',
        amount: { kind: 'add', values: [{ kind: 'dice', rollId: 'heal', count: 2, sides: 8 }, { kind: 'constant', value: 3 }] },
      }] }] }
    const packageId = 'test.maximum-healing'
    registerDnd5eActivityPackage({ packageId, packageVersion: '1.0.0', activities: [activity] })
    const state = combat()
    state.combatants.actor.currentHp = 1
    state.combatants.actor.maxHp = 50
    state.combatants.actor.pluginFeatureIds = [activity.id]
    const effect = createDnd5eMechanicalEffect({ definitionId: 'test:maximum', label: 'Maximum', targetId: 'actor',
      source: { kind: 'plugin' }, modifiers: kind === 'legacy' ? undefined : { maximizeHealingDice: true } })
    state.combatants.actor.classState.activeEffects = kind === 'absent' ? [] : [{ ...effect,
      ...(kind === 'legacy' ? { legacyCondition: 'rule-state:spell:beacon-of-hope:maximum-healing' } : {}),
      ...(kind === 'suspended' ? { suspendedBy: ['antimagic'] } : {}),
    }]
    if (kind === 'companion-near' || kind === 'companion-far' || kind === 'companion-passive-near' || kind === 'companion-passive-far') {
      effect.modifiers = { maximizeHealingDiceNearCompanion: [{ maximumDistanceFeet: 100, bondKey: 'familiar' }] }
      state.combatants.actor.classState.activeEffects = kind.startsWith('companion-passive') ? [] : [effect]
      if (kind.startsWith('companion-passive')) state.combatants.actor.maximizeHealingDiceNearCompanion = effect.modifiers.maximizeHealingDiceNearCompanion
      state.mapId = 'companion-heal'
      state.companionScene = { geometry: null, projectedTokenIds: ['actor'], map: {
        id: state.mapId, name: 'Scene', width: 3000, height: 500, gridSize: 50, feetPerCell: 5,
        gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
        tokens: [{ id: 'actor', characterId: 'hero', type: 'player', label: 'Hero', color: '', emoji: '', size: 1,
          x: state.combatants.actor.position.x, y: state.combatants.actor.position.y },
        { id: 'familiar', type: 'npc', label: 'Familiar', color: '', emoji: '', size: 1, hp: 1,
          x: state.combatants.actor.position.x + (kind === 'companion-near' || kind === 'companion-passive-near' ? 50 : 2000),
          y: state.combatants.actor.position.y,
          dnd5eSummon: { schemaVersion: 1, pluginId: 'test.companion', featureId: 'summon',
            sourceCharacterId: 'hero', sourceTokenId: 'actor', bondKey: 'familiar', side: 'player',
            createdRound: 1, expiresAfterRound: 10, persistent: true } }],
      } }
    }
    const restored = JSON.parse(JSON.stringify(state)) as typeof state
    const rolls = { heal: { values: [1, 2], modifier: 0, total: 3 } }
    const expectedHp = kind === 'generic' || kind === 'legacy' || kind === 'companion-near' || kind === 'companion-passive-near' ? 20 : 7
    const direct = resolveRegisteredDnd5eActivityInCombatV1({ state: restored, combatRevision: 1,
      command: { schemaVersion: 1, commandId: 'heal-1', actorId: 'actor', packageId, packageVersion: '1.0.0',
        activityId: activity.id, targetIds: ['actor'], expectedRevision: 1 }, authoritativeRolls: rolls, confirmedBy: 'actor' })
    expect(direct.result.ok, JSON.stringify(direct.result)).toBe(true)
    if (!direct.result.ok) throw Error('direct failed')
    expect(direct.result.state.combatants.actor.currentHp).toBe(expectedHp)
    const pluginId = 'test.maximum-healing-compiled'
    const dispose = registerDnd5eRulesPlugin({ manifest: { id: pluginId, name: 'Heal', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
      api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity))
      api.registerFeature({ id: activity.id, name: activity.name, summary: 'Test', description: 'Test', automation: 'full',
        action: dnd5ePluginFeatureActionFromActivityV1(activity) })
    } })
    try {
      restored.combatants.actor.pluginFeatureIds = [`${pluginId}:${activity.id}`]
      const compiled = resolveDnd5eHeadlessAction(restored, { type: 'plugin', pluginId, actionId: activity.id,
        featureId: `${pluginId}:${activity.id}`, actorId: 'actor', targetId: 'actor', distanceFeet: 0, rolls })
      expect(compiled.ok, JSON.stringify(compiled)).toBe(true)
      expect(compiled.state.combatants.actor.currentHp).toBe(expectedHp)
      expect(restored.combatants.actor.currentHp).toBe(1)
    } finally { dispose() }
  })

  it.each([true, undefined] as const)('preserves explicit non-spell magic classification (%s) through Host commit and reload', magical => {
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1, id: 'feature-veil', name: 'Synthetic veil', activation: { kind: 'free' },
      target: { kind: 'self' }, legacySource: { kind: 'feature', id: 'active-pulse' }, automation,
      effects: [{ schemaVersion: 1, id: 'veil', name: 'Veil', ...(magical ? { magical } : {}),
        duration: { kind: 'rounds', rounds: 1, expiresAt: 'target-turn-end' },
        conditions: ['invisible'], stacking: 'replace' }],
      outcomes: [{ id: 'veil', when: { kind: 'always' }, operations: [
        { id: 'apply', kind: 'apply-effect', target: 'actor', effectId: 'veil' },
      ] }],
    }
    const packageId = 'test.magical-feature'
    registerDnd5eActivityPackage({ packageId, packageVersion: PACKAGE_VERSION, activities: [activity] })
    const resolved = resolveRegisteredDnd5eActivityInCombatV1({ state: combat(), combatRevision: 1,
      command: { schemaVersion: 1, commandId: 'veil-1', actorId: 'actor', packageId,
        packageVersion: PACKAGE_VERSION, activityId: activity.id, targetIds: ['actor'], expectedRevision: 1 },
      authoritativeRolls: {}, confirmedBy: 'actor' })
    expect(resolved.result.ok, JSON.stringify(resolved.result)).toBe(true)
    if (resolved.phase !== 'commit' || !resolved.result.ok) throw Error('expected commit')
    const loaded = JSON.parse(JSON.stringify(resolved.result.state)) as ReturnType<typeof combat>
    const effect = loaded.combatants.actor.classState.activeEffects?.find(effect => effect.standardCondition === 'invisible')
    expect(effect?.source.magical).toBe(magical === true)
    expect(effect?.source.kind).not.toBe('spell')
    expect(effect?.source.spellLevel).toBeUndefined()
    const hero = normalizeCharacter({ id: 'hero', name: 'Hero', currentHp: 20, maxHp: 20,
      dnd5eCombatState: { activeEffects: loaded.combatants.actor.classState.activeEffects } })
    const map: BattleMap = { id: 'magic-provenance-map', name: 'Map', width: 200, height: 100,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
      tokens: [{ id: 'actor', type: 'player', characterId: hero.id, label: 'Hero', x: 25, y: 25, size: 1, emoji: '', color: '' }],
      dnd5ePluginAreas: [{ id: 'anti', pluginId: 'test', featureId: 'anti', label: 'Antimagic', color: '',
        sourceTokenId: 'other', sourceCharacterId: 'other', cells: [{ col: 0, row: 0 }],
        createdRound: 1, expiresAfterRound: 100, includeSelf: true, relation: 'any', occupantModifiers: { suppressesMagic: true } }] }
    const snapshot = (current: BattleMap, characters = [hero]) => createDnd5eMapCombatSnapshot({
      combatId: 'map-magic', map: current, characters,
      initiativeOrder: [{ tokenId: 'actor', label: 'Hero', emoji: '', color: '', roll: 20 }],
    })
    const inside = snapshot(map)
    expect(inside.state.combatants.actor.conditions.map(dnd5eStandardConditionId).includes('invisible')).toBe(magical !== true)
    const plan = planDnd5eMapResultApplication({ state: inside.state, map, characters: [hero],
      characterIdByCombatantId: inside.characterIdByCombatantId })
    const saved = JSON.parse(JSON.stringify(plan.characters)) as typeof plan.characters
    const outside = snapshot({ ...plan.map, tokens: plan.map.tokens.map(token => ({ ...token, x: 125 })) }, saved)
    expect(outside.state.combatants.actor.conditions.map(dnd5eStandardConditionId)).toContain('invisible')
    expect(outside.state.combatants.actor.classState.activeEffects?.find(row => row.standardCondition === 'invisible')?.duration).toEqual(effect?.duration)
  })
  it('binds a spell-hit follow-up to its original target, limits each turn, and expires at the next source turn end', async () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1, id: 'spell-hit-slow', name: 'Synthetic spell-hit slow', activation: { kind: 'free' },
      invocation: { kind: 'triggered', event: 'attack-hit', confirmation: 'actor-choice', retention: 'single-event' },
      legacySource: { kind: 'feature', id: 'spell-hit-slow' }, automation,
      target: { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 120 },
      requirements: [{ kind: 'event-source', source: 'attack', sourceId: 'eldritch-blast' },
        { kind: 'turn-owner', owner: 'actor' },
        { kind: 'once-per-turn', key: 'spell-hit-slow' }],
      effects: [{ schemaVersion: 1, id: 'slow', name: 'Slow', stacking: 'refresh-duration',
        duration: { kind: 'rounds', rounds: 1, expiresAt: 'source-turn-end' },
        modifiers: [{ kind: 'speed', mode: 'add', value: { kind: 'constant', value: -10 } }] }],
      outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [{ id: 'slow', kind: 'apply-effect', target: 'target', effectId: 'slow' }] }],
    }
    const packageId = 'test.spell-hit-follow-up'
    registerDnd5eActivityPackage({ packageId, packageVersion: '1.0.0', activities: [activity] })
    const state = combat()
    state.combatants.actor.pluginFeatureIds = [activity.id]
    const windows = (current: typeof state, spellId = 'eldritch-blast', hit = true, batch = 'beam-1') =>
      listDnd5eActivityTriggerWindowsV1({ state: current, eventBatchId: batch, events: [{
        type: 'attack-resolved', actorId: 'actor', targetId: 'target', spellId, attackMode: 'spell',
        d20: hit ? 15 : 1, total: hit ? 20 : 6, armorClass: 12, hit, critical: false,
      }] }).find(window => window.available.some(entry => entry.activity.id === activity.id))
    expect(windows(state, 'scorching-ray')).toBeUndefined()
    expect(windows(state, 'eldritch-blast', false)).toBeUndefined()
    for (const accepted of [true, false]) {
      let prompts = 0
      const event = { type: 'attack-resolved' as const, actorId: 'actor', targetId: 'target',
        spellId: 'eldritch-blast', attackMode: 'spell' as const, d20: 15, total: 20,
        armorClass: 12, hit: true, critical: false }
      const batch = await settleDnd5eActivityTriggerWindowsV1({ state, events: [event, event],
        eventBatchId: `multi-hit-${accepted}`, combatRevision: 1,
        confirm: async request => { if (request.activity.id !== activity.id) return false; prompts++; return accepted }, roll: async () => [] })
      expect(prompts, JSON.stringify(batch.diagnostics)).toBe(accepted ? 1 : 2)
      expect(batch.state.combatants.target.classState.activeEffects ?? []).toHaveLength(accepted ? 1 : 0)
    }
    const window = windows(state)!
    expect(window.triggerContext.eligibleTargetIds).toEqual(['target'])
    const command = { schemaVersion: 1 as const, commandId: 'slow-1', actorId: 'actor', packageId,
      packageVersion: '1.0.0', activityId: activity.id, targetIds: ['target'], expectedRevision: 1,
      triggerEventId: window.triggerContext.eventId }
    const offTurn = resolveRegisteredDnd5eActivityInCombatV1({ state: { ...state, initiativeIndex: 1 }, combatRevision: 1,
      command, triggerContext: window.triggerContext, authoritativeRolls: {}, confirmedBy: 'actor' })
    expect(offTurn.result.ok).toBe(false)
    const forged = resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1,
      command: { ...command, targetIds: ['actor'] }, triggerContext: window.triggerContext,
      authoritativeRolls: {}, confirmedBy: 'actor' })
    expect(forged.result.ok).toBe(false)
    const resolved = resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1, command,
      triggerContext: window.triggerContext, authoritativeRolls: {}, confirmedBy: 'actor' })
    expect(resolved.result.ok, JSON.stringify(resolved.result)).toBe(true)
    if (resolved.phase !== 'commit' || !resolved.result.ok) throw Error('expected commit')
    const effects = (current: typeof state) => current.combatants.target.classState.activeEffects ?? []
    expect(effects(resolved.result.state)).toContainEqual(expect.objectContaining({ modifiers: expect.objectContaining({ speedPenaltyFeet: 10 }) }))
    const loaded = JSON.parse(JSON.stringify(resolved.result.state)) as typeof state
    expect(windows(loaded, 'eldritch-blast', true, 'beam-2')).toBeUndefined()
    const secondContext = windows(state, 'eldritch-blast', true, 'beam-2')!.triggerContext
    const repeated = resolveRegisteredDnd5eActivityInCombatV1({ state: loaded, combatRevision: 1,
      command: { ...command, commandId: 'slow-2', triggerEventId: secondContext.eventId },
      triggerContext: secondContext, authoritativeRolls: {}, confirmedBy: 'actor' })
    expect(repeated.result.ok).toBe(false)
    expect(effects(loaded)).toHaveLength(1)
    const firstEnd = resolveDnd5eHeadlessAction(loaded, { type: 'end-turn', actorId: 'actor' })
    expect(firstEnd.ok).toBe(true)
    expect(effects(firstEnd.state)).toHaveLength(1)
    const otherEnd = resolveDnd5eHeadlessAction(firstEnd.state, { type: 'end-turn', actorId: 'target' })
    expect(otherEnd.ok).toBe(true)
    expect(windows(otherEnd.state, 'eldritch-blast', true, 'next-turn')).toBeDefined()
    const nextEnd = resolveDnd5eHeadlessAction(otherEnd.state, { type: 'end-turn', actorId: 'actor' })
    expect(nextEnd.ok).toBe(true)
    expect(effects(nextEnd.state)).toHaveLength(0)
  }, 20_000)
  it.each((['base', 'temporary', 'suspended', 'source-fey', 'source-humanoid', 'none'] as const).flatMap(mode =>
    (['direct', 'choice', 'slot'] as const).map(projection => ({ mode, projection }))))('filters immune targets without an initial save while consuming the action ($mode/$projection)', ({ mode, projection }) => {
    const immune = mode === 'base' || mode === 'temporary' || mode === 'source-fey'
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1, id: 'selective-pulse', name: 'Selective pulse', activation: { kind: 'action' },
      consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' },
        { kind: 'resource', resourceId: 'focus', amount: { kind: 'constant', value: 1 }, consumeOn: 'resolve' }],
      target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 30, excludedConditionImmunities: ['charmed'] },
      checks: [], outcomes: [{ id: 'hit', when: { kind: 'always' }, operations: [
        { id: 'damage', kind: 'damage', target: 'target', amount: { kind: 'constant', value: 3 }, damageType: 'psychic' },
      ] }], automation, legacySource: { kind: 'feature', id: 'selective-pulse' },
    }
    if (projection !== 'direct') {
      const effectiveTarget = structuredClone(activity.target)
      activity.target = { kind: 'creature', relation: 'any', count: 1, rangeFeet: 30 }
      if (projection === 'choice') activity.choices = [{ id: 'mode', label: 'Mode', options: [
        { id: 'selected', label: 'Selected', targetOverride: effectiveTarget },
      ] }]
      else activity.castLevelTargetProfiles = [{ minimumCastLevel: 3, target: effectiveTarget }]
    }
    registerDnd5eActivityPackage({ packageId: 'test.selective-pulse', packageVersion: '1.0.0', activities: [activity] })
    const state = combat()
    state.combatants.actor.pluginFeatureIds = ['selective-pulse']
    state.combatants.target.conditionImmunities = mode === 'base' ? ['charmed'] : []
    if (mode === 'temporary' || mode === 'suspended') state.combatants.target.classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'temporary-immunity', label: 'Temporary immunity', targetId: 'target', source: { kind: 'feature', actorId: 'target' },
      modifiers: { conditionImmunities: ['charmed'] }, ...(mode === 'suspended' ? { suspendedBy: ['suppression'] } : {}),
    })]
    if (mode === 'source-fey' || mode === 'source-humanoid') {
      state.combatants.actor.creatureType = mode === 'source-fey' ? 'fey' : 'humanoid'
      state.combatants.target.classState.activeEffects = [createDnd5eMechanicalEffect({
        definitionId: 'source-immunity', label: 'Source immunity', targetId: 'target', source: { kind: 'feature', actorId: 'target' },
        modifiers: { conditionImmunitiesBySourceCreatureType: [{ conditions: ['charmed'], sourceCreatureTypes: ['fey'] }] },
      })]
    }
    const resolved = resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1,
      command: { schemaVersion: 1, commandId: 'pulse', actorId: 'actor', packageId: 'test.selective-pulse', packageVersion: '1.0.0', activityId: activity.id, targetIds: ['target'], expectedRevision: 1,
        castLevel: 3, ...(projection === 'choice' ? { choices: { mode: 'selected' } } : {}) },
      authoritativeRolls: {}, confirmedBy: 'actor' })
    expect(resolved.result.ok, JSON.stringify(resolved.result)).toBe(true)
    if (resolved.phase !== 'commit' || !resolved.result.ok) throw Error('expected commit')
    expect(resolved.result.state.combatants.target.currentHp).toBe(immune ? 20 : 17)
    expect(resolved.result.state.combatants.actor.turn.actionAvailable).toBe(false)
    expect(resolved.result.state.combatants.actor.classResources.focus?.current).toBe(1)
    expect(state.combatants.target.currentHp).toBe(20)
  })
  it.each(['actor', 'target'])('attributes forced saves and only breaks preexisting effects when saving target is %s', targetId => {
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1, id: 'force-save', name: 'Force save', activation: { kind: 'free' },
      target: { kind: 'creature', relation: 'any', count: 1, includeSelf: true, rangeFeet: 30 },
      checks: [{ id: 'save', rollId: 'save', kind: 'saving-throw', ability: 'dex', dc: { kind: 'constant', value: 15 }, scope: 'per-target' }],
      effects: [{ schemaVersion: 1, id: 'fresh', name: 'Fresh', stacking: 'replace', duration: { kind: 'permanent' }, breakOn: ['forces-saving-throw'], modifiers: [{ kind: 'armor-class', mode: 'add', value: { kind: 'constant', value: 1 } }] }],
      outcomes: [{ id: 'done', when: { kind: 'always' }, operations: [{ id: 'fresh', kind: 'apply-effect', target: 'actor', effectId: 'fresh' }] }],
      automation, legacySource: { kind: 'feature', id: 'force-save' },
    }
    registerDnd5eActivityPackage({ packageId: 'test.forced-save', packageVersion: '1.0.0', activities: [activity] })
    const state = combat()
    state.combatants.actor.pluginFeatureIds = ['force-save']
    for (const id of ['actor', 'target']) state.combatants[id].classState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'old', label: 'Old', targetId: id, source: { kind: 'feature', actorId: id }, breakOn: ['forces-saving-throw'], modifiers: { armorClassBonus: 1 },
    })]
    const resolve = (roll: number) => resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1,
      command: { schemaVersion: 1, commandId: 'save', actorId: 'actor', packageId: 'test.forced-save', packageVersion: '1.0.0', activityId: activity.id, targetIds: [targetId], expectedRevision: 1 },
      authoritativeRolls: { [`save:${targetId}`]: { values: [roll] } }, confirmedBy: 'actor' })
    const failed = resolve(0)
    expect(failed.result.ok).toBe(false)
    expect(state.combatants.actor.classState.activeEffects?.some(effect => effect.definitionId === 'old')).toBe(true)
    const resolved = resolve(10)
    expect(resolved.result.ok, JSON.stringify(resolved.result)).toBe(true)
    if (resolved.phase !== 'commit' || !resolved.result.ok) throw Error('expected commit')
    expect(resolved.result.events).toContainEqual(expect.objectContaining({ type: 'saving-throw-resolved', sourceId: 'actor', targetId }))
    const actorEffects = resolved.result.state.combatants.actor.classState.activeEffects ?? []
    expect(actorEffects.some(effect => effect.definitionId === 'old')).toBe(targetId === 'actor')
    expect(actorEffects.some(effect => effect.definitionId.includes('fresh'))).toBe(true)
    expect(resolved.result.state.combatants.target.classState.activeEffects?.some(effect => effect.definitionId === 'old')).toBe(true)
    const dispose = registerDnd5eRulesPlugin({ manifest: { id: 'test.forced-save-compiled', name: 'Save', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
      api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity))
      api.registerFeature({ id: activity.id, name: activity.name, summary: 'Test', description: 'Test', automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(activity) })
    } })
    try {
      state.combatants.actor.pluginFeatureIds = ['test.forced-save-compiled:force-save']
      const compiled = resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: 'test.forced-save-compiled', actionId: activity.id, featureId: 'test.forced-save-compiled:force-save', actorId: 'actor', targetId, distanceFeet: targetId === 'actor' ? 0 : 5, rolls: { [`save:${targetId}`]: { values: [10], modifier: 0, total: 10 } } })
      expect(compiled.ok, JSON.stringify(compiled)).toBe(true)
      if (compiled.ok) {
        expect(compiled.events).toContainEqual(expect.objectContaining({ type: 'saving-throw-resolved', sourceId: 'actor', targetId }))
        expect(compiled.state.combatants.actor.classState.activeEffects?.some(effect => effect.definitionId === 'old')).toBe(targetId === 'actor')
      }
    } finally { dispose() }
  })
  it('keeps unique-by-source effects on each bearer and refreshes only the matching source copy', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1, id: 'shared-ward', name: 'Shared ward', activation: { kind: 'free' },
      target: { kind: 'creature', relation: 'any', count: 2 },
      legacySource: { kind: 'feature', id: 'shared-ward' }, automation,
      outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [{
        id: 'ward', kind: 'apply-effect', target: 'target', effectId: 'ward',
      }] }],
      effects: [{ schemaVersion: 1, id: 'ward', name: 'Ward', stacking: 'unique-by-source',
        duration: { kind: 'rounds', rounds: 3, expiresAt: 'target-turn-end' }, conditions: ['frightened'] }],
    }
    registerDnd5eActivityPackage({ packageId: 'test.shared-ward', packageVersion: '1.0.0', activities: [activity] })
    let state = combat()
    state.combatants.actor.pluginFeatureIds = ['shared-ward']
    state.combatants.other = combatant('other', 'player', 15)
    state.combatants.other.pluginFeatureIds = ['shared-ward']
    state.combatants.second = combatant('second', 'dm', 5)
    for (const [actorId, targetIds] of [['actor', ['target', 'second']], ['actor', ['target']], ['other', ['target']]] as const) {
      const resolved = resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1,
        command: { schemaVersion: 1, commandId: `ward-${actorId}`, actorId, packageId: 'test.shared-ward',
          packageVersion: '1.0.0', activityId: activity.id, targetIds, expectedRevision: 1 },
        authoritativeRolls: {}, confirmedBy: 'actor' })
      expect(resolved.result.ok).toBe(true)
      if (resolved.phase !== 'commit' || !resolved.result.ok) throw new Error('ward did not commit')
      state = resolved.result.state
      expect(state.combatants.target.conditions).toContain('frightened')
      expect(state.combatants.second.conditions).toContain('frightened')
      expect(state.combatants.second.classState.activeEffects).toHaveLength(1)
      expect(state.combatants.target.classState.activeEffects).toHaveLength(actorId === 'other' ? 2 : 1)
    }
  })
  it.each([30, 35, undefined])('uses Host target-pair geometry rather than command claims: %s', (distance) => {
    const activity: Dnd5eActivityDefinitionV1 = { ...activities[0]!, id: 'pair-limited',
      target: { kind: 'creature', relation: 'enemy', count: 2, rangeFeet: 60, maximumTargetSeparationFeet: 30 },
      legacySource: { kind: 'feature', id: 'pair-limited' } }
    registerDnd5eActivityPackage({ packageId: 'test.pair-limit', packageVersion: '1.0.0', activities: [activity] })
    const state = combat()
    state.combatants.actor.pluginFeatureIds = ['pair-limited']
    state.combatants.second = combatant('second', 'dm', 5)
    state.distanceFeetByCombatantPair = { ...state.distanceFeetByCombatantPair,
      [dnd5eCombatantPairKey('actor', 'second')]: 20,
      ...(distance == null ? {} : { [dnd5eCombatantPairKey('target', 'second')]: distance }) }
    const command = { schemaVersion: 1 as const, commandId: 'pair-1', actorId: 'actor',
      packageId: 'test.pair-limit', packageVersion: '1.0.0', activityId: 'pair-limited',
      targetIds: ['target', 'second'], expectedRevision: 1,
      distanceFeetBetweenTargets: { target: { second: 0 } } }
    const resolved = resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1, command,
      authoritativeRolls: {}, confirmedBy: 'actor' })
    expect(resolved.result.ok).toBe(distance === 30)
    if (resolved.phase === 'commit' && resolved.result.ok) {
      expect(resolved.result.state.combatants.target.currentHp).toBe(17)
      expect(resolved.result.state.combatants.second.currentHp).toBe(17)
    }
    expect(state.combatants.target.currentHp).toBe(20)
    expect(state.combatants.actor.classResources.focus?.current).toBe(2)
  })
  it.each([5, 10])('requests follow-up damage only after the actual source distance qualifies: %s', async (distance) => {
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1, id: 'arrival-test', name: 'Arrival test', activation: { kind: 'free' },
      invocation: { kind: 'triggered', event: 'movement-completed', confirmation: 'automatic' },
      target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 30 }, requirements: [
        { kind: 'event-source', source: 'movement', activityId: 'pull-test' },
        { kind: 'movement-property', movementKind: 'forced' },
        { kind: 'movement-source-distance', maximumFeet: 5 },
      ],
      outcomes: [{ id: 'arrival', when: { kind: 'always' }, operations: [{ id: 'damage', kind: 'damage',
        target: 'target', amount: { kind: 'dice', rollId: 'arrival-damage', count: 1, sides: 8 }, damageType: 'lightning' }] }],
      automation, legacySource: { kind: 'feature', id: 'arrival-test' },
    }
    registerDnd5eActivityPackage({ packageId: 'test.arrival', packageVersion: '1.0.0', activities: [activity] })
    const state = combat()
    state.combatants.actor.pluginFeatureIds = ['arrival-test']
    state.combatants.target.pluginFeatureIds = []
    let diceRequests = 0
    const settled = await settleDnd5eActivityTriggerWindowsV1({ state,
      events: [{ type: 'moved', actorId: 'target', from: { x: 0, y: 0 }, to: { x: 5, y: 0 }, distance: 5,
        movementKind: 'forced', sourceActorId: 'actor', activityId: 'pull-test', distanceFromSourceFeet: distance }],
      eventBatchId: 'arrival', combatRevision: 1, confirm: async () => true,
      roll: async () => { diceRequests += 1; return [4] },
    })
    expect(diceRequests).toBe(distance === 5 ? 1 : 0)
    expect(settled.state.combatants.target.currentHp).toBe(distance === 5 ? 16 : 20)
    expect(settled.state.combatants.actor.currentHp).toBe(20)
  })
  it.each(['missing','refused','accepted'] as const)('requires recipient consent before triggered dice and commitment: %s',async(decision)=>{
    const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'willing-trigger',name:'Willing trigger',activation:{kind:'free'},
      invocation:{kind:'triggered',event:'movement-completed',confirmation:'automatic'},
      target:{kind:'creature',relation:'any',count:1,rangeFeet:30,requiresWilling:true},
      consumption:[{kind:'resource',resourceId:'focus',amount:{kind:'constant',value:1},consumeOn:'resolve'}],
      requirements:[{kind:'event-source',source:'movement',activityId:'pull-test'}],
      outcomes:[{id:'effect',when:{kind:'always'},operations:[{id:'damage',kind:'damage',target:'target',amount:{kind:'dice',rollId:'damage',count:1,sides:8},damageType:'cold'}]}],
      automation,legacySource:{kind:'feature',id:'willing-trigger'}}
    registerDnd5eActivityPackage({packageId:'test.willing-trigger',packageVersion:'1.0.0',activities:[activity]})
    const state=combat()
    state.combatants.actor.pluginFeatureIds=['willing-trigger']
    state.combatants.target.pluginFeatureIds=[]
    let diceRequests=0
    const consentRequests:string[]=[]
    const settled=await settleDnd5eActivityTriggerWindowsV1({state,
      events:[{type:'moved',actorId:'target',from:{x:0,y:0},to:{x:5,y:0},distance:5,movementKind:'forced',sourceActorId:'actor',activityId:'pull-test',distanceFromSourceFeet:5}],
      eventBatchId:'willing-trigger',combatRevision:1,confirm:async()=>true,
      confirmTargetWillingness:decision==='missing'?undefined:async request=>{consentRequests.push(request.targetId);return decision==='accepted'},
      roll:async()=>{diceRequests++;return [4]},
    })
    expect(consentRequests).toEqual(decision==='missing'?[]:['target'])
    expect(diceRequests).toBe(decision==='accepted'?1:0)
    expect(settled.state.combatants.target.currentHp).toBe(decision==='accepted'?16:20)
    expect(settled.state.combatants.actor.classResources.focus?.current).toBe(decision==='accepted'?1:2)
    expect(state.combatants.target.currentHp).toBe(20)
    if(decision!=='accepted')expect(settled.diagnostics).toContainEqual(expect.objectContaining({reason:'target-not-willing',status:decision==='missing'?'unsupported':'declined'}))
  })

  it.each(['splash', undefined, 'target', 'outside'] as const)('selects one event-nearby target or skips without accepting forged targets: %s', async (selection) => {
    const template = activities.find((entry) => entry.id === 'event-target-splash')!
    const activity: Dnd5eActivityDefinitionV1 = { ...template, id: 'chosen-splash',
      target: { kind: 'area', origin: 'event-target', shape: 'circle', relation: 'any', radiusFeet: 5,
        maximumTargets: 1, includeSelf: true, excludeEventTarget: true, selection: 'choose-one' },
      legacySource: { kind: 'feature', id: 'chosen-splash' } }
    registerDnd5eActivityPackage({ packageId: 'test.chosen', packageVersion: '1.0.0', activities: [activity] })
    const state = combat()
    state.combatants.actor.pluginFeatureIds = ['chosen-splash']
    state.combatants.target.pluginFeatureIds = []
    state.combatants.splash = combatant('splash', 'dm', 5)
    state.combatants.outside = combatant('outside', 'dm', 1)
    state.distanceFeetByCombatantPair = { ...state.distanceFeetByCombatantPair,
      [dnd5eCombatantPairKey('target', 'splash')]: 5,
      [dnd5eCombatantPairKey('actor', 'splash')]: 10,
      [dnd5eCombatantPairKey('target', 'outside')]: 20 }
    const attack = resolveDnd5eHeadlessAction(state, { type: 'attack', actorId: 'actor', targetId: 'target',
      attackModifier: 4, d20: 18, damage: { count: 1, sides: 6, bonus: 2, rolls: [4], type: 'slashing' } })
    expect(attack.ok).toBe(true)
    const settled = await settleDnd5eActivityTriggerWindowsV1({ state: attack.state, events: attack.events,
      eventBatchId: 'chosen-splash', combatRevision: 1, confirm: async () => true, roll: async () => [],
      selectTarget: async ({ candidates }) => {
        expect(candidates.map((entry) => entry.id)).toEqual(['actor', 'splash'])
        return selection
      } })
    expect(settled.state.combatants.splash.currentHp).toBe(selection === 'splash' ? 18 : 20)
    expect(settled.state.combatants.actor.currentHp).toBe(20)
    expect(settled.state.combatants.target.currentHp).toBe(14)
    expect(settled.state.combatants.outside.currentHp).toBe(20)
    expect(settled.diagnostics).toContainEqual(expect.objectContaining({ activityId: 'chosen-splash',
      status: selection === 'splash' ? 'resolved' : selection == null ? 'declined' : 'rejected' }))
  })

  it('suspends a later effect by the real transition instance and resumes it when that instance expires', () => {
    const resolved = resolveRegisteredDnd5eActivityInCombatV1({
      state: combat(),
      combatRevision: 1,
      command: {
        schemaVersion: 1,
        commandId: 'suspended-cloud-stance-1',
        actorId: 'actor',
        packageId: PACKAGE_ID,
        packageVersion: PACKAGE_VERSION,
        activityId: 'suspended-cloud-stance',
        targetIds: ['actor'],
        expectedRevision: 1,
      },
      authoritativeRolls: {},
      confirmedBy: 'actor',
    })
    expect(resolved.phase).toBe('commit')
    if (resolved.phase !== 'commit' || !resolved.result.ok) return
    const appliedEffects = resolved.result.state.combatants.actor.classState.activeEffects ?? []
    const transition = appliedEffects.find((effect) => effect.stackingKey.includes(':cloud-transition:'))
    const cloud = appliedEffects.find((effect) => effect.definitionId.includes(':cloud-mode:'))
    expect(transition).toBeDefined()
    expect(cloud).toMatchObject({
      modifiers: { flySpeedFeet: 300 },
      suspendedBy: [transition?.id],
    })

    const ended = resolveDnd5eHeadlessAction(resolved.result.state, { type: 'end-turn', actorId: 'actor' })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    // A rounds duration lasts through a full round, including the application turn.
    expect(ended.state.combatants.actor.classState.activeEffects?.some(effect => effect.id === transition?.id)).toBe(true)
    const targetEnded = resolveDnd5eHeadlessAction(ended.state, {type:'end-turn',actorId:'target'})
    expect(targetEnded.ok).toBe(true)
    const nextEnded = resolveDnd5eHeadlessAction(targetEnded.state, {type:'end-turn',actorId:'actor'})
    expect(nextEnded.ok).toBe(true)
    const remaining = nextEnded.state.combatants.actor.classState.activeEffects ?? []
    expect(remaining.some((effect) => effect.id === transition?.id)).toBe(false)
    expect(remaining.find((effect) => effect.id === cloud?.id)?.suspendedBy).toBeUndefined()
  })

  it.each([false, true])('filters event-centered invisible occupants only when declared: %s', async requiresVisibleTargets => {
    const template = activities.find(entry => entry.id === 'event-target-splash')!
    registerDnd5eActivityPackage({ packageId: 'test.visible-event', packageVersion: '1.0.0', activities: [{
      ...template, id: 'visible-event', legacySource: { kind: 'feature', id: 'visible-event' },
      target: { kind: 'area', origin: 'event-target', shape: 'circle', relation: 'any', radiusFeet: 5,
        excludeEventTarget: true, requiresVisibleTargets },
    }] })
    const state = combat()
    state.combatants.actor.pluginFeatureIds = ['visible-event']
    state.combatants.target.pluginFeatureIds = []
    state.combatants.splash = combatant('splash', 'dm', 5)
    applyDnd5eStandardConditionEffect(state.combatants.splash, undefined, {
      rulesId: 'test-invisible', condition: 'invisible', duration: { type: 'permanent' }, sourceKind: 'spell',
    }, [])
    state.distanceFeetByCombatantPair = { ...state.distanceFeetByCombatantPair,
      [dnd5eCombatantPairKey('target', 'splash')]: 5, [dnd5eCombatantPairKey('actor', 'splash')]: 10 }
    const attack = resolveDnd5eHeadlessAction(state, { type: 'attack', actorId: 'actor', targetId: 'target',
      attackModifier: 4, d20: 18, damage: { count: 1, sides: 6, bonus: 2, rolls: [4], type: 'slashing' } })
    expect(attack.ok).toBe(true)
    const settled = await settleDnd5eActivityTriggerWindowsV1({ state: attack.state, events: attack.events,
      eventBatchId: 'visible-event', combatRevision: 1, confirm: async () => false, roll: async () => [] })
    expect(settled.state.combatants.splash.currentHp).toBe(requiresVisibleTargets ? 20 : 18)
  })

  it.each([[], ['splash'], ['actor', 'splash'], undefined, ['outside'], ['splash', 'splash']].map(selection => ({ selection })))('validates an explicit triggered area subset: $selection', async ({ selection }) => {
    const template = activities.find(entry => entry.id === 'event-target-splash')!
    registerDnd5eActivityPackage({ packageId: 'test.subset-event', packageVersion: '1.0.0', activities: [{
      ...template, id: 'subset-event', legacySource: { kind: 'feature', id: 'subset-event' },
      consumption: [{ kind: 'resource', resourceId: 'focus', amount: { kind: 'constant', value: 1 }, consumeOn: 'resolve' }],
      target: { kind: 'area', origin: 'event-target', shape: 'circle', relation: 'any', radiusFeet: 5,
        includeSelf: true, excludeEventTarget: true, selection: 'choose-any', maximumTargets: 1 },
    }] })
    const state = combat()
    state.combatants.actor.pluginFeatureIds = ['subset-event']
    state.combatants.target.pluginFeatureIds = []
    state.combatants.splash = combatant('splash', 'dm', 5)
    state.distanceFeetByCombatantPair = { ...state.distanceFeetByCombatantPair,
      [dnd5eCombatantPairKey('target', 'splash')]: 5, [dnd5eCombatantPairKey('actor', 'splash')]: 10 }
    const attack = resolveDnd5eHeadlessAction(state, { type: 'attack', actorId: 'actor', targetId: 'target',
      attackModifier: 4, d20: 18, damage: { count: 1, sides: 6, bonus: 2, rolls: [4], type: 'slashing' } })
    expect(attack.ok).toBe(true)
    const settled = await settleDnd5eActivityTriggerWindowsV1({ state: attack.state, events: attack.events,
      eventBatchId: 'subset-event', combatRevision: 1, confirm: async () => false, roll: async () => [],
      selectTargets: async ({ candidates }) => { expect(candidates.map(candidate => candidate.id)).toEqual(['actor', 'splash']); return selection },
    })
    const accepted = selection != null && (selection.length === 0 || (selection.length === 1 && selection[0] === 'splash'))
    expect(settled.state.combatants.splash.currentHp).toBe(accepted && selection?.length ? 18 : 20)
    expect(settled.state.combatants.actor.classResources.focus.current).toBe(accepted ? 1 : 2)
    expect(settled.diagnostics).toContainEqual(expect.objectContaining({ activityId: 'subset-event',
      status: accepted ? 'resolved' : selection == null ? 'declined' : 'rejected' }))
  })

  it('rebuilds an automatic event-target splash from Host distance pairs', async () => {
    const state = combat()
    state.combatants.actor.pluginFeatureIds = [...state.combatants.actor.pluginFeatureIds, 'event-target-splash']
    state.combatants.splash = combatant('splash', 'dm', 5)
    state.distanceFeetByCombatantPair = {
      ...state.distanceFeetByCombatantPair,
      [dnd5eCombatantPairKey('target', 'splash')]: 5,
      [dnd5eCombatantPairKey('actor', 'splash')]: 10,
    }
    const attack = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'actor', targetId: 'target', attackModifier: 4, d20: 18,
      damage: { count: 1, sides: 6, bonus: 2, rolls: [4], type: 'slashing' },
    })
    expect(attack.ok).toBe(true)
    if (!attack.ok) return
    const settled = await settleDnd5eActivityTriggerWindowsV1({
      state: attack.state,
      events: attack.events,
      eventBatchId: 'event-target-splash-batch',
      combatRevision: 1,
      confirm: async () => false,
      roll: async () => [],
    })
    expect(settled.diagnostics).toContainEqual(expect.objectContaining({
      activityId: 'event-target-splash', status: 'resolved',
    }))
    expect(settled.state.combatants.target.currentHp).toBe(14)
    expect(settled.state.combatants.actor.currentHp).toBe(18)
    expect(settled.state.combatants.splash.currentHp).toBe(18)
  })

  it('atomically resolves an active Activity from Host snapshots and exposes its canonical follow-up event', () => {
    const source = combat()
    const result = resolveRegisteredDnd5eActivityInCombatV1({
      state: source,
      combatRevision: 1,
      command: {
        schemaVersion: 1,
        commandId: 'active-command-1',
        actorId: 'actor',
        packageId: PACKAGE_ID,
        packageVersion: PACKAGE_VERSION,
        activityId: 'active-pulse',
        targetIds: ['target'],
        expectedRevision: 1,
      },
      authoritativeRolls: {},
      confirmedBy: 'actor',
    })
    expect(result.phase).toBe('commit')
    if (result.phase !== 'commit' || !result.result.ok) return
    expect(result.result.state.combatants.actor.turn.actionAvailable).toBe(false)
    expect(result.result.state.combatants.actor.classResources.focus?.current).toBe(1)
    expect(result.result.state.combatants.target.currentHp).toBe(17)
    expect(source.combatants.actor.turn.actionAvailable).toBe(true)
    expect(source.combatants.actor.classResources.focus?.current).toBe(2)
    expect(source.combatants.target.currentHp).toBe(20)

    const windows = listDnd5eActivityTriggerWindowsV1({
      state: result.result.state,
      events: result.result.events,
      eventBatchId: 'revision-2',
    })
    expect(windows).toContainEqual(expect.objectContaining({
      triggerContext: expect.objectContaining({ event: 'feature-used' }),
      available: [expect.objectContaining({ activity: expect.objectContaining({ id: 'feature-chain' }) })],
    }))
  })

  it('bridges a real light-weapon attack into bonus-action and defensive reaction windows', () => {
    const attack = resolveDnd5eHeadlessAction(combat(), {
      type: 'attack',
      actorId: 'actor',
      targetId: 'target',
      attackModifier: 4,
      d20: 18,
      damage: { count: 1, sides: 6, bonus: 2, rolls: [4], type: 'slashing' },
      classDamageContext: {
        weaponId: 'shortsword',
        weaponProperties: ['finesse', 'light'],
        mode: 'melee',
        finesse: true,
        strengthBased: false,
        weaponDamageSides: 6,
        damageType: 'slashing',
        adjacentEnemyOfTarget: false,
      },
      classDamageRolls: [],
    })
    expect(attack.ok).toBe(true)
    if (!attack.ok) return
    expect(attack.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', weaponId: 'shortsword', weaponProperties: ['finesse', 'light'], attackMode: 'melee',
    }))
    const windows = listDnd5eActivityTriggerWindowsV1({
      state: attack.state,
      events: attack.events,
      eventBatchId: 'revision-10',
    })
    const followUpWindow = windows.find((window) =>
      window.available.some((entry) => entry.activity.id === 'light-follow-up'))
    const reactionWindow = windows.find((window) =>
      window.available.some((entry) => entry.activity.id === 'retaliation'))
    expect(followUpWindow?.triggerContext).toMatchObject({
      event: 'attack-resolved', eligibleActorIds: ['actor'], eligibleTargetIds: ['target'],
      source: { kind: 'attack', weaponProperties: ['finesse', 'light'] },
    })
    expect(reactionWindow?.triggerContext).toMatchObject({
      event: 'reaction-window', eligibleActorIds: ['target'], eligibleTargetIds: ['actor'],
    })
    if (!followUpWindow || !reactionWindow) return

    const followUp = resolveRegisteredDnd5eActivityInCombatV1({
      state: attack.state,
      combatRevision: 10,
      command: {
        schemaVersion: 1,
        commandId: 'follow-up-command-1',
        actorId: 'actor',
        packageId: PACKAGE_ID,
        packageVersion: PACKAGE_VERSION,
        activityId: 'light-follow-up',
        targetIds: ['target'],
        expectedRevision: 10,
        triggerEventId: followUpWindow.triggerContext.eventId,
      },
      authoritativeRolls: {},
      triggerContext: followUpWindow.triggerContext,
      confirmedBy: 'actor',
    })
    expect(followUp.phase).toBe('commit')
    if (followUp.phase !== 'commit' || !followUp.result.ok) return
    expect(followUp.result.state.combatants.actor.turn.bonusActionAvailable).toBe(false)
    expect(followUp.result.state.combatants.target.currentHp).toBe(12)
    expect(followUp.result.state.combatants.actor.classState.declarativeUsedTurnKeys?.['light-follow-up']).toBeTruthy()

    const reaction = resolveRegisteredDnd5eActivityInCombatV1({
      state: followUp.result.state,
      combatRevision: 11,
      command: {
        schemaVersion: 1,
        commandId: 'reaction-command-1',
        actorId: 'target',
        packageId: PACKAGE_ID,
        packageVersion: PACKAGE_VERSION,
        activityId: 'retaliation',
        targetIds: ['actor'],
        expectedRevision: 11,
        triggerEventId: reactionWindow.triggerContext.eventId,
      },
      authoritativeRolls: {},
      triggerContext: reactionWindow.triggerContext,
      confirmedBy: 'actor',
    })
    expect(reaction.phase).toBe('commit')
    if (reaction.phase !== 'commit' || !reaction.result.ok) return
    expect(reaction.result.state.combatants.target.turn.reactionAvailable).toBe(false)
    expect(reaction.result.state.combatants.actor.currentHp).toBe(19)

    reaction.result.state.combatants.actor.turn.bonusActionAvailable = true
    const replay = resolveRegisteredDnd5eActivityInCombatV1({
      state: reaction.result.state,
      combatRevision: 12,
      command: {
        schemaVersion: 1,
        commandId: 'follow-up-command-2',
        actorId: 'actor',
        packageId: PACKAGE_ID,
        packageVersion: PACKAGE_VERSION,
        activityId: 'light-follow-up',
        targetIds: ['target'],
        expectedRevision: 12,
        triggerEventId: followUpWindow.triggerContext.eventId,
      },
      authoritativeRolls: {},
      triggerContext: followUpWindow.triggerContext,
      confirmedBy: 'actor',
    })
    expect(replay).toMatchObject({ phase: 'resolve', result: { ok: false, reason: 'requirement-failed' } })
    expect(reaction.result.state.combatants.target.currentHp).toBe(12)
  })

  it('uses one generic Effect plus the attack-hit window for a temporary unarmed profile and optional damage', () => {
    const stance = resolveRegisteredDnd5eActivityInCombatV1({
      state: combat(),
      combatRevision: 20,
      command: {
        schemaVersion: 1, commandId: 'fire-stance-1', actorId: 'actor',
        packageId: PACKAGE_ID, packageVersion: PACKAGE_VERSION, activityId: 'fire-fist-stance',
        targetIds: ['actor'], expectedRevision: 20,
      },
      authoritativeRolls: {},
      confirmedBy: 'actor',
    })
    expect(stance.phase).toBe('commit')
    if (stance.phase !== 'commit' || !stance.result.ok) return
    expect(stance.result.state.combatants.actor.classResources.ki.current).toBe(1)
    expect(stance.result.state.combatants.actor.classState.activeEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        definitionId: expect.stringContaining(':fire-fist-mode'),
        duration: { type: 'until-turn-boundary', boundary: 'source-turn-end' },
        modifiers: { attackProfiles: [{ attackModes: ['unarmed'], reachBonusFeet: 10, damageTypeOverride: 'fire' }] },
      }),
    ]))

    const attack = resolveDnd5eHeadlessAction(stance.result.state, {
      type: 'attack', actorId: 'actor', targetId: 'target', attackModifier: 4, d20: 18,
      damage: { count: 1, sides: 4, bonus: 2, rolls: [2], type: 'fire' },
    })
    expect(attack.ok).toBe(true)
    if (!attack.ok) return
    const window = listDnd5eActivityTriggerWindowsV1({
      state: attack.state, events: attack.events, eventBatchId: 'fire-hit-batch',
    }).find((candidate) => candidate.available.some((entry) => entry.activity.id === 'fire-fist-hit'))
    expect(window).toBeDefined()
    if (!window) return
    const extra = resolveRegisteredDnd5eActivityInCombatV1({
      state: attack.state,
      combatRevision: 21,
      command: {
        schemaVersion: 1, commandId: 'fire-hit-1', actorId: 'actor',
        packageId: PACKAGE_ID, packageVersion: PACKAGE_VERSION, activityId: 'fire-fist-hit',
        targetIds: ['target'], expectedRevision: 21, triggerEventId: window.triggerContext.eventId,
      },
      authoritativeRolls: { 'fire-fist-damage': { values: [7] } },
      triggerContext: window.triggerContext,
      confirmedBy: 'actor',
    })
    expect(extra.phase, extra.phase === 'resolve' && !extra.result.ok ? extra.result.reason : undefined).toBe('commit')
    if (extra.phase !== 'commit' || !extra.result.ok) return
    expect(extra.result.state.combatants.actor.classResources.ki.current).toBe(0)
    expect(extra.result.state.combatants.target.currentHp).toBe(9)
  })

  it('serially settles production trigger windows with Host confirmations and nested automatic Activities', async () => {
    const attack = resolveDnd5eHeadlessAction(combat(), {
      type: 'attack', actorId: 'actor', targetId: 'target', attackModifier: 4, d20: 18,
      damage: { count: 1, sides: 6, bonus: 2, rolls: [4], type: 'slashing' },
      classDamageContext: {
        weaponId: 'shortsword', weaponProperties: ['finesse', 'light'], mode: 'melee', finesse: true,
        strengthBased: false, weaponDamageSides: 6, damageType: 'slashing', adjacentEnemyOfTarget: false,
      },
      classDamageRolls: [],
    })
    expect(attack.ok).toBe(true)
    if (!attack.ok) return
    const confirmations: string[] = []
    const settled = await settleDnd5eActivityTriggerWindowsV1({
      state: attack.state,
      events: attack.events,
      eventBatchId: 'production-attack-1',
      combatRevision: 4,
      confirm: async (request) => {
        confirmations.push(request.activity.id)
        return true
      },
      roll: async () => [],
    })
    expect(confirmations).toEqual(['light-follow-up', 'retaliation'])
    expect(settled.state.combatants.target.currentHp).toBe(12)
    expect(settled.state.combatants.actor.currentHp).toBe(19)
    expect(settled.state.combatants.actor.temporaryHp).toBe(1)
    expect(settled.state.combatants.target.temporaryHp).toBe(2)
    expect(settled.state.combatants.actor.turn.bonusActionAvailable).toBe(false)
    expect(settled.state.combatants.target.turn.reactionAvailable).toBe(false)
    expect(settled.diagnostics.filter((entry) => entry.status === 'resolved').map((entry) => entry.activityId))
      .toEqual(['light-follow-up', 'retaliation', 'after-hurt-guard', 'after-hurt-guard', 'feature-chain'])
  })

  it('commits a registered mechanic handler through the production trigger transaction', async () => {
    const packageId = 'e2e.mechanic-handler'
    registerDnd5eActivityPackage({
      packageId,
      packageVersion: PACKAGE_VERSION,
      activities: [{
        schemaVersion: 1,
        id: 'event-damage-reflection',
        name: 'Event damage reflection',
        activation: { kind: 'passive' },
        invocation: { kind: 'triggered', event: 'after-damage', confirmation: 'automatic' },
        target: { kind: 'creature', relation: 'enemy', count: 1 },
        outcomes: [{ id: 'reflect', when: { kind: 'always' }, operations: [{
          id: 'reflect', kind: 'mechanic', handlerId: 'core.event-damage-reflection', target: 'target',
          parameters: { multiplier: 0.5, 'maximum-damage': 10, 'damage-type': 'fire', magical: true },
        }] }],
        automation,
        legacySource: { kind: 'feature', id: 'event-damage-reflection' },
      }],
    })
    const source = combat()
    source.combatants.target.pluginFeatureIds = [
      ...(source.combatants.target.pluginFeatureIds ?? []),
      'event-damage-reflection',
    ]
    const attack = resolveDnd5eHeadlessAction(source, {
      type: 'attack', actorId: 'actor', targetId: 'target', attackModifier: 4, d20: 18,
      damage: { count: 1, sides: 6, bonus: 2, rolls: [4], type: 'slashing' },
    })
    expect(attack.ok).toBe(true)
    if (!attack.ok) return
    const settled = await settleDnd5eActivityTriggerWindowsV1({
      state: attack.state,
      events: attack.events,
      eventBatchId: 'mechanic-handler-1',
      combatRevision: 30,
      confirm: async () => false,
      roll: async () => [],
    })
    expect(settled.state.combatants.target.currentHp).toBe(14)
    expect(settled.state.combatants.actor.currentHp).toBe(17)
    expect(settled.diagnostics).toContainEqual(expect.objectContaining({
      packageId,
      activityId: 'event-damage-reflection',
      status: 'resolved',
    }))
  })

  it('opens a generic reaction window when an immune condition is attempted and reflects it with Host dice', async () => {
    const state = combat()
    const events: Parameters<typeof applyDnd5eStandardConditionEffect>[3] = []
    expect(applyDnd5eStandardConditionEffect(state.combatants.target, state.combatants.actor, {
      rulesId: 'test-charm-attempt',
      condition: 'charmed',
      duration: { type: 'rounds', remainingRounds: 1, tickOn: 'target-turn-end' },
      sourceKind: 'spell',
      magical: true,
    }, events)).toBe(false)
    expect(events).toContainEqual(expect.objectContaining({
      type: 'condition-attempted', actorId: 'actor', targetId: 'target', condition: 'charmed', prevented: true,
    }))
    expect(events.some((event) => event.type === 'condition-applied')).toBe(false)

    const windows = listDnd5eActivityTriggerWindowsV1({
      state,
      events,
      eventBatchId: 'condition-attempt-1',
    })
    expect(windows).toContainEqual(expect.objectContaining({
      triggerContext: expect.objectContaining({
        event: 'on-condition-attempted', eligibleActorIds: ['target'], eligibleTargetIds: ['actor'],
      }),
      available: [expect.objectContaining({ activity: expect.objectContaining({ id: 'condition-reflection' }) })],
    }))

    const settled = await settleDnd5eActivityTriggerWindowsV1({
      state,
      events,
      eventBatchId: 'condition-attempt-1',
      combatRevision: 7,
      confirm: async () => true,
      roll: async () => [5],
    })
    expect(settled.state.combatants.target.turn.reactionAvailable).toBe(false)
    expect(settled.state.combatants.actor.conditions).toContain('charmed')
    expect(settled.diagnostics).toContainEqual(expect.objectContaining({
      activityId: 'condition-reflection', status: 'resolved',
    }))
  })

  it('accepts Host-rebuilt area placement for a triggered Activity', async () => {
    const areaPackageId = 'e2e.area-activity'
    registerDnd5eActivityPackage({
      packageId: areaPackageId,
      packageVersion: PACKAGE_VERSION,
      activities: [{
        schemaVersion: 1,
        id: 'zone-retort',
        name: 'Zone retort',
        activation: { kind: 'free', cost: 0 },
        invocation: { kind: 'triggered', event: 'after-damage', confirmation: 'automatic' },
        target: {
          kind: 'area', relation: 'enemy', origin: 'point', shape: 'circle',
          placeRangeFeet: 30, radiusFeet: 10, maximumTargets: 8,
        },
        outcomes: [{ id: 'damage', when: { kind: 'always' }, operations: [{
          id: 'force', kind: 'damage', target: 'all-targets',
          amount: { kind: 'constant', value: 2 }, damageType: 'force',
        }] }],
        automation,
        legacySource: { kind: 'feature', id: 'zone-retort' },
      }],
    })
    const source = combat()
    source.combatants.target.pluginFeatureIds = [
      ...(source.combatants.target.pluginFeatureIds ?? []),
      'zone-retort',
    ]
    const attack = resolveDnd5eHeadlessAction(source, {
      type: 'attack', actorId: 'actor', targetId: 'target', attackModifier: 4, d20: 18,
      damage: { count: 1, sides: 6, bonus: 2, rolls: [4], type: 'slashing' },
    })
    expect(attack.ok).toBe(true)
    if (!attack.ok) return
    const selected: string[] = []
    const settled = await settleDnd5eActivityTriggerWindowsV1({
      state: attack.state,
      events: attack.events,
      eventBatchId: 'production-area-1',
      combatRevision: 20,
      confirm: async () => true,
      roll: async () => [],
      selectArea: async (request) => {
        selected.push(request.activity.id)
        return {
          targetIds: ['actor'],
          areaPlacement: { x: 150, y: 100, radiusFeet: 10 },
          areaPlacementDistanceFeet: 5,
        }
      },
    })
    expect(selected).toEqual(['zone-retort'])
    // Existing retaliation deals 1 and the selected area retort deals 2.
    expect(settled.state.combatants.actor.currentHp).toBe(17)
    expect(settled.diagnostics).toContainEqual(expect.objectContaining({
      activityId: 'zone-retort', status: 'resolved',
    }))
  })

  it('rejects unowned Activities, stale revisions, and distances forged outside Host combat state', () => {
    const source = combat()
    delete source.distanceFeetByCombatantPair
    source.combatants.actor.pluginFeatureIds = []
    const unowned = resolveRegisteredDnd5eActivityInCombatV1({
      state: source,
      combatRevision: 3,
      command: {
        schemaVersion: 1,
        commandId: 'unowned-command-1',
        actorId: 'actor',
        packageId: PACKAGE_ID,
        packageVersion: PACKAGE_VERSION,
        activityId: 'active-pulse',
        targetIds: ['target'],
        expectedRevision: 3,
      },
      authoritativeRolls: {},
      confirmedBy: 'actor',
    })
    expect(unowned).toMatchObject({ phase: 'resolve', result: { ok: false, reason: 'unauthorized-actor' } })
    source.combatants.actor.pluginFeatureIds = ['active-pulse']
    const result = resolveRegisteredDnd5eActivityInCombatV1({
      state: source,
      combatRevision: 3,
      command: {
        schemaVersion: 1,
        commandId: 'forged-command-1',
        actorId: 'actor',
        packageId: PACKAGE_ID,
        packageVersion: PACKAGE_VERSION,
        activityId: 'active-pulse',
        targetIds: ['target'],
        expectedRevision: 2,
      },
      authoritativeRolls: {},
      confirmedBy: 'actor',
    })
    expect(result).toMatchObject({ phase: 'resolve', result: { ok: false, reason: 'stale-revision' } })
    expect(source.combatants.actor.classResources.focus?.current).toBe(2)
    expect(source.combatants.target.currentHp).toBe(20)
  })
})


describe('effect-bound temporary hit points', () => {
  it.each([0, 4, 12])('removes only the owning pool after damage and replacement (%s)', replacement => {
    const base: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1, id: 'bound-guard', name: 'Bound guard', activation: {kind:'free'},
      target: {kind:'self'}, automation, legacySource:{kind:'feature',id:'bound-guard'},
      effects:[{schemaVersion:1,id:'ward',name:'Ward',stacking:'replace',duration:{kind:'rounds',rounds:10,expiresAt:'target-turn-end'},modifiers:[]}],
      outcomes:[{id:'grant',when:{kind:'always'},operations:[
        {id:'effect',kind:'apply-effect',target:'actor',effectId:'ward'},
        {id:'pool',kind:'temporary-hit-points',target:'actor',amount:{kind:'constant',value:10},sourceEffectId:'ward'},
      ]}],
    }
    const clear: Dnd5eActivityDefinitionV1 = {...base,id:'clear-guard',legacySource:{kind:'feature',id:'clear-guard'},outcomes:[{id:'clear',when:{kind:'always'},operations:[{id:'clear',kind:'remove-effect',target:'actor',effectId:'ward',source:'self'}]}]}
    const other: Dnd5eActivityDefinitionV1 = {...base,id:'other-guard',legacySource:{kind:'feature',id:'other-guard'},outcomes:[{id:'other',when:{kind:'always'},operations:[{id:'other',kind:'temporary-hit-points',target:'actor',amount:{kind:'constant',value:replacement}}]}]}
    registerDnd5eActivityPackage({packageId:'test.bound-hp',packageVersion:'1.0.0',activities:[base,clear,other]})
    let state=combat();state.combatants.actor.pluginFeatureIds=['bound-guard','clear-guard','other-guard']
    const run=(activityId:string)=>{
      const result=resolveRegisteredDnd5eActivityInCombatV1({state,combatRevision:1,command:{schemaVersion:1,commandId:activityId,actorId:'actor',packageId:'test.bound-hp',packageVersion:'1.0.0',activityId,targetIds:['actor'],expectedRevision:1},authoritativeRolls:{},confirmedBy:'actor'})
      expect(result.result.ok,JSON.stringify(result)).toBe(true)
      if(result.phase!=='commit'||!result.result.ok)throw Error('did not commit')
      state=result.result.state
    }
    run('bound-guard')
    expect(state.combatants.actor.temporaryHp).toBe(10)
    expect(state.combatants.actor.classState.temporaryHitPointsSource?.effectDefinitionId).toBeDefined()
    const unboundOrder={...base,id:'invalid-order',legacySource:{kind:'feature' as const,id:'invalid-order'},outcomes:[{...base.outcomes[0],operations:[...base.outcomes[0].operations].reverse()}]}
    registerDnd5eActivityPackage({packageId:'test.bad-bound-order',packageVersion:'1.0.0',activities:[unboundOrder]})
    const untouched=combat();untouched.combatants.actor.pluginFeatureIds=['invalid-order']
    const denied=resolveRegisteredDnd5eActivityInCombatV1({state:untouched,combatRevision:1,command:{schemaVersion:1,commandId:'invalid',actorId:'actor',packageId:'test.bad-bound-order',packageVersion:'1.0.0',activityId:'invalid-order',targetIds:['actor'],expectedRevision:1},authoritativeRolls:{},confirmedBy:'actor'})
    expect(denied.result.ok).toBe(false)
    expect(untouched.combatants.actor.temporaryHp).toBe(0)
    expect(untouched.combatants.actor.classState.activeEffects ?? []).toEqual([])

    const expiring=structuredClone(state)
    expiring.combatants.actor.classState.activeEffects=expiring.combatants.actor.classState.activeEffects?.map(effect=>({...effect,appliedTurnKey:'previous-turn',duration:{type:'rounds' as const,remainingRounds:1,tickOn:'target-turn-end' as const}}))
    const end=resolveDnd5eHeadlessAction(expiring,{type:'end-turn',actorId:'actor'})
    expect(end.ok,JSON.stringify(end)).toBe(true)
    if(end.ok)expect(end.state.combatants.actor.temporaryHp).toBe(0)
    // Damage consumes part of this pool; expiry clears the remaining points, not its initial amount.
    state.combatants.actor.temporaryHp=4
    if(replacement)run('other-guard')
    run('clear-guard')
    expect(state.combatants.actor.temporaryHp).toBe(replacement)
    expect(state.combatants.actor.classState.temporaryHitPointsSource).toBeUndefined()
  })
})


it('records the current gap: a registered before-damage Activity is not dispatched by committed damage events',()=>{
 const guard:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'pre-damage-guard',name:'Guard',activation:{kind:'reaction'},invocation:{kind:'triggered',event:'before-damage',confirmation:'actor-choice',retention:'single-event'},target:{kind:'self'},legacySource:{kind:'feature',id:'pre-damage-guard'},automation,outcomes:[{id:'grant',when:{kind:'always'},operations:[{id:'grant',kind:'temporary-hit-points',target:'actor',amount:{kind:'constant',value:50}}]}]}
 registerDnd5eActivityPackage({packageId:'test.pending-guard',packageVersion:'1.0.0',activities:[guard]})
 const source=combat();source.combatants.target.pluginFeatureIds=[...source.combatants.target.pluginFeatureIds,'pre-damage-guard']
 const attack=resolveDnd5eHeadlessAction(source,{type:'attack',actorId:'actor',targetId:'target',attackModifier:4,d20:18,damage:{count:1,sides:6,bonus:2,rolls:[4],type:'fire'}})
 expect(attack.ok).toBe(true);if(!attack.ok)return
 expect(attack.state.combatants.target.currentHp).toBe(14)
 expect(attack.state.combatants.target.temporaryHp).toBe(0)
 const windows=listDnd5eActivityTriggerWindowsV1({state:attack.state,events:attack.events,eventBatchId:'pre-damage-gap'})
 expect(JSON.stringify(windows)).not.toContain('pre-damage-guard')
})
