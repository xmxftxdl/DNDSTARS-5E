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
      ? ['active-pulse', 'light-follow-up', 'feature-chain', 'fire-fist-stance', 'fire-fist-hit']
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
