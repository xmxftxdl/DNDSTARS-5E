import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { resolveDnd5eActivityCommand, validateDnd5eExecuteActivityCommandV1, type Dnd5eExecuteActivityCommandV1 } from './dnd5eActivityCommand'
import { clearDnd5eActivityRegistryForTests, registerDnd5eActivityPackage } from './dnd5eActivityRegistry'
import type { Dnd5eActivityActorSnapshot } from './dnd5eActivityExecutor'
import { dnd5eActiveEffectId } from '../activeEffects'

const abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } as const
const actor: Dnd5eActivityActorSnapshot = {
  id: 'actor', controller: 'players', level: 3, proficiencyBonus: 2, abilities,
  armorClass: 14, conditions: [], currentHp: 20, maxHp: 20,
}
const target: Dnd5eActivityActorSnapshot = {
  id: 'target', controller: 'dm', level: 2, proficiencyBonus: 2, abilities,
  armorClass: 12, conditions: [], currentHp: 10, maxHp: 10,
}
const command: Dnd5eExecuteActivityCommandV1 = {
  schemaVersion: 1,
  commandId: 'command-1',
  actorId: 'actor',
  packageId: 'test.package',
  packageVersion: '1.0.0',
  activityId: 'pulse',
  targetIds: ['target'],
  expectedRevision: 7,
}

it('accepts native effect instance encoding without weakening other command ids', () => {
  const grantEffectId = dnd5eActiveEffectId('activity:shadow:modifiers:0', 'actor', 'actor')
  expect(validateDnd5eExecuteActivityCommandV1({ ...command, grantEffectId })).not.toContain('invalid grantEffectId')
  for (const invalid of ['', 'has space', '../bad/id', 'x'.repeat(1025)]) {
    expect(validateDnd5eExecuteActivityCommandV1({ ...command, grantEffectId: invalid })).toContain('invalid grantEffectId')
  }
  expect(validateDnd5eExecuteActivityCommandV1({ ...command, activityId: 'INVALID' })).toContain('invalid activityId')
})

beforeEach(() => {
  registerDnd5eActivityPackage({
    packageId: 'test.package', packageVersion: '1.0.0', activities: [{
      schemaVersion: 1, id: 'pulse', name: 'Pulse', activation: { kind: 'action' },
      target: { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 30 },
      outcomes: [{ id: 'resolve', when: { kind: 'always' }, operations: [{
        id: 'damage', kind: 'damage', target: 'target', amount: { kind: 'dice', rollId: 'damage', count: 1, sides: 6 }, damageType: 'force',
      }] }],
      automation: automationCapabilityFromLegacyStatus('full'),
    }, {
      schemaVersion: 1, id: 'light-follow-up', name: 'Light follow-up', activation: { kind: 'bonus-action' },
      invocation: { kind: 'triggered', event: 'attack-resolved', confirmation: 'actor-choice' },
      target: { kind: 'creature', relation: 'enemy', count: 1 },
      requirements: [{ kind: 'weapon-property', property: 'light', present: true }],
      outcomes: [{ id: 'resolve', when: { kind: 'always' }, operations: [{
        id: 'damage', kind: 'damage', target: 'target', amount: { kind: 'constant', value: 2 }, damageType: 'slashing',
      }] }],
      automation: automationCapabilityFromLegacyStatus('full'),
    }],
  })
})
afterEach(clearDnd5eActivityRegistryForTests)

describe('Activity authority command boundary', () => {
  it('bounds and validates submitted companion Help selections before resolving an Activity', () => {
    for (const invalid of ['help', [], { order: null }, { order: { targetId: 'target', helpKind: 'cast' } },
      { order: { targetId: 4, helpKind: 'attack' } }, { 'bad key': { targetId: 'target', helpKind: 'attack' } },
      Object.fromEntries(Array.from({ length: 65 }, (_, index) => [`order-${index}`, { targetId: 'target', helpKind: 'attack' }]))]) {
      const submitted = JSON.parse(JSON.stringify({ ...command, companionHelpTargets: invalid }))
      expect(validateDnd5eExecuteActivityCommandV1(submitted)).toContain('invalid companionHelpTargets')
    }
    expect(validateDnd5eExecuteActivityCommandV1({ ...command,
      companionHelpTargets: { order: { targetId: 'target', helpKind: 'ability-check' } } })).toEqual([])
  })
  it('resolves Host-owned rolls into proposals while the command contains only intent', () => {
    expect(command).not.toHaveProperty('damage')
    expect(command).not.toHaveProperty('rolls')
    expect(resolveDnd5eActivityCommand({
      command, currentRevision: 7, actor, targets: [target],
      authoritativeRolls: { damage: { values: [5] } }, distanceFeetByTargetId: { target: 20 },
    })).toMatchObject({
      ok: true,
      proposals: [{ kind: 'deal-damage', amount: 5, targetId: 'target' }],
    })
  })

  it('rejects stale revisions and content-version mismatches before resolution', () => {
    expect(resolveDnd5eActivityCommand({
      command, currentRevision: 8, actor, targets: [target], authoritativeRolls: {},
    })).toMatchObject({ ok: false, reason: 'stale-revision' })
    expect(resolveDnd5eActivityCommand({
      command: { ...command, packageVersion: '2.0.0' }, currentRevision: 7,
      actor, targets: [target], authoritativeRolls: {},
    })).toMatchObject({ ok: false, reason: 'content-version-mismatch' })
  })

  it('rejects authority snapshots that do not match the submitted actor and targets', () => {
    expect(resolveDnd5eActivityCommand({
      command, currentRevision: 7, actor: { ...actor, id: 'someone-else' }, targets: [target], authoritativeRolls: {},
    })).toMatchObject({ ok: false, reason: 'unauthorized-actor' })
    expect(resolveDnd5eActivityCommand({
      command, currentRevision: 7, actor, targets: [], authoritativeRolls: {},
    })).toMatchObject({ ok: false, reason: 'target-snapshot-mismatch' })
  })

  it('accepts triggered Activities only with a matching Host event envelope', () => {
    const triggeredCommand: Dnd5eExecuteActivityCommandV1 = {
      ...command,
      commandId: 'command-triggered',
      activityId: 'light-follow-up',
      triggerEventId: 'event-attack-1',
    }
    expect(resolveDnd5eActivityCommand({
      command: triggeredCommand, currentRevision: 7, actor, targets: [target], authoritativeRolls: {},
    })).toMatchObject({ ok: false, reason: 'invalid-command' })

    expect(resolveDnd5eActivityCommand({
      command: triggeredCommand,
      currentRevision: 7,
      actor,
      targets: [target],
      authoritativeRolls: {},
      triggerContext: {
        eventId: 'event-attack-1', event: 'attack-resolved',
        source: { kind: 'attack', id: 'shortsword', mode: 'melee', result: 'hit', weaponProperties: ['light'] },
        eligibleActorIds: ['actor'], eligibleTargetIds: ['target'], actionEconomyAvailable: { 'bonus-action': true },
      },
      confirmedBy: 'actor',
    })).toMatchObject({
      ok: true,
      proposals: [{ kind: 'deal-damage', amount: 2, targetId: 'target' }],
    })
  })
})
