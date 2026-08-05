import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { resolveDnd5eActivityCommand, type Dnd5eExecuteActivityCommandV1 } from './dnd5eActivityCommand'
import { clearDnd5eActivityRegistryForTests, registerDnd5eActivityPackage } from './dnd5eActivityRegistry'
import type { Dnd5eActivityActorSnapshot } from './dnd5eActivityExecutor'

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

beforeEach(() => {
  registerDnd5eActivityPackage({
    packageId: 'test.package', packageVersion: '1.0.0', activities: [{
      schemaVersion: 1, id: 'pulse', name: 'Pulse', activation: { kind: 'action' },
      target: { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 30 },
      outcomes: [{ id: 'resolve', when: { kind: 'always' }, operations: [{
        id: 'damage', kind: 'damage', target: 'target', amount: { kind: 'dice', rollId: 'damage', count: 1, sides: 6 }, damageType: 'force',
      }] }],
      automation: automationCapabilityFromLegacyStatus('full'),
    }],
  })
})
afterEach(clearDnd5eActivityRegistryForTests)

describe('Activity authority command boundary', () => {
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
})
