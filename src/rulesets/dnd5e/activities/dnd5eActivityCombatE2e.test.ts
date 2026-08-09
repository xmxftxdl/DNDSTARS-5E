import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import {
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
    classResources: id === 'actor' ? { focus: { current: 2, max: 2 } } : undefined,
    pluginFeatureIds: id === 'actor'
      ? ['active-pulse', 'light-follow-up', 'feature-chain']
      : ['retaliation'],
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
