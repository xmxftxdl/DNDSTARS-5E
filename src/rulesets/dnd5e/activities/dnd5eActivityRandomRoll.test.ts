import { describe, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { resolveDnd5eActivity, type Dnd5eActivityActorSnapshot } from './dnd5eActivityExecutor'
import { compileDnd5eActivityHeadlessAction } from './dnd5eActivityHeadlessCompiler'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'

const actor: Dnd5eActivityActorSnapshot = {
  id: 'actor', controller: 'players', level: 9, proficiencyBonus: 4,
  abilities: { str: 10, dex: 12, con: 14, int: 16, wis: 13, cha: 11 },
  armorClass: 15, currentHp: 60, maxHp: 60, conditions: [],
}

function randomTableActivity(scope: 'shared' | 'per-target' = 'shared'): Dnd5eActivityDefinitionV1 {
  return {
    schemaVersion: 1,
    id: `random-table-${scope}`,
    name: '权威随机表',
    activation: { kind: 'action' },
    target: scope === 'shared'
      ? { kind: 'self' }
      : { kind: 'creature', relation: 'any', count: 1, rangeFeet: 30 },
    checks: [{
      id: 'table', kind: 'random-roll', rollId: 'table-roll',
      count: 1, sides: 10, modifier: 0, scope,
    }],
    outcomes: [
      {
        id: 'low', when: { kind: 'check-total', checkId: 'table', minimum: 1, maximum: 5 },
        operations: [{
          id: 'low-damage', kind: 'damage', target: 'target',
          amount: { kind: 'constant', value: 5 }, damageType: 'psychic', magical: true,
        }],
      },
      {
        id: 'high', when: { kind: 'check-total', checkId: 'table', minimum: 6, maximum: 10 },
        operations: [{
          id: 'high-damage', kind: 'damage', target: 'target',
          amount: { kind: 'constant', value: 10 }, damageType: 'psychic', magical: true,
        }],
      },
    ],
    automation: automationCapabilityFromLegacyStatus('full'),
  }
}

describe('Host-authoritative Activity random tables', () => {
  it('validates and executes exactly the matching total range', () => {
    const activity = randomTableActivity()
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    expect(resolveDnd5eActivity({
      activity, actor, targets: [actor], rolls: { 'table-roll': { values: [6] } },
    })).toMatchObject({
      ok: true,
      checks: [{ checkId: 'table', total: 6 }],
      proposals: [{ kind: 'deal-damage', amount: 10 }],
    })
  })

  it('rejects forged die values and invalid closed dice declarations', () => {
    const activity = randomTableActivity()
    expect(resolveDnd5eActivity({
      activity, actor, targets: [actor], rolls: { 'table-roll': { values: [11] } },
    })).toMatchObject({ ok: false, reason: 'invalid-rolls' })
    const invalid: Dnd5eActivityDefinitionV1 = {
      ...activity,
      checks: [{ id: 'table', kind: 'random-roll', rollId: 'table-roll', count: 0, sides: 1 }],
    }
    expect(validateDnd5eActivityDefinitionV1(invalid)).toEqual(expect.arrayContaining([
      'activity.checks[0].count is invalid',
      'activity.checks[0].sides is invalid',
    ]))
  })

  it('compiles shared and per-target Host dice recipes without changing d20 checks', () => {
    const shared = compileDnd5eActivityHeadlessAction(randomTableActivity())
    expect(shared.rolls).toContainEqual(expect.objectContaining({
      id: 'table-roll', count: 1, sides: 10, modifier: 0,
    }))
    expect(shared.perTargetRolls).toEqual([])

    const perTarget = compileDnd5eActivityHeadlessAction(randomTableActivity('per-target'))
    expect(perTarget.rolls).toEqual([])
    expect(perTarget.perTargetRolls).toContainEqual(expect.objectContaining({
      id: 'table-roll', count: 1, sides: 10, modifier: 0,
    }))
  })
})
