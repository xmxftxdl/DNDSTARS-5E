import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eCombatant, startDnd5eHeadlessCombat } from '../headlessCombatEngine'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { rollDnd5eActivityTriggerDiceV1 } from './dnd5eActivityTriggerSettlement'
import { filterDnd5eConditionalActivityRollDeclarationsV1 } from './dnd5eActivityPerTargetRolls'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'

function definition(scope: 'shared' | 'per-target'): Dnd5eActivityDefinitionV1 {
  return { schemaVersion: 1, id: 'chained-tables', name: 'Synthetic chained tables', activation: { kind: 'free' },
    target: { kind: 'creature', relation: 'any', rangeFeet: 60, count: 2 },
    checks: [
      { id: 'first', kind: 'random-roll', rollId: 'first', count: 1, sides: 4, modifier: 1, scope },
      { id: 'second', kind: 'random-roll', rollId: 'second', count: 1, sides: 4, scope,
        appliesWhenCheckTotal: { checkId: 'first', minimum: 5, maximum: 5 } },
      { id: 'third', kind: 'random-roll', rollId: 'third', count: 1, sides: 4, scope,
        appliesWhenCheckTotal: { checkId: 'second', minimum: 4, maximum: 4 } },
    ], outcomes: [{ id: 'result', when: { kind: 'check-total', checkId: 'third', minimum: 1 },
      operations: [{ id: 'result', kind: 'temporary-hit-points', target: 'target', amount: { kind: 'constant', value: 1 } }] }], automation: automationCapabilityFromLegacyStatus('full') }
}

it.each([1, 3, 5])('requests the inherited slot-level dice for a triggered followup (%i)', async castLevel => {
  const activity: Dnd5eActivityDefinitionV1 = {
    schemaVersion: 1, id: 'scaled-followup', name: 'Scaled followup', activation: { kind: 'free' },
    target: { kind: 'self' }, automation: automationCapabilityFromLegacyStatus('full'),
    outcomes: [{ id: 'result', when: { kind: 'always' }, operations: [{ id: 'damage', kind: 'damage',
      target: 'actor', damageType: 'cold', amount: { kind: 'dice', rollId: 'damage', count: 2, sides: 6 } }] }],
    scaling: [{ basis: 'slot-level', baseLevel: 1, adjustments: [{ operationId: 'damage', diceCountPerStep: 1 }] }],
  }
  const actor = createDnd5eCombatant({ id: 'actor', name: 'Actor', controller: 'dm', initiative: 10,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
    armorClass: 10, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
  const requested: number[] = []
  const result = await rollDnd5eActivityTriggerDiceV1({ state: startDnd5eHeadlessCombat('scaled-trigger', [actor]),
    actorId: 'actor', targetIds: ['actor'],
    available: { packageId: 'test.scaling', packageVersion: '1.0.0', activity, confirmation: 'automatic', retention: 'single-event' },
    triggerContext: { eventId: 'cast', event: 'spell-resolved', source: { kind: 'spell', id: 'parent', level: castLevel },
      eligibleActorIds: ['actor'], eligibleTargetIds: ['actor'] },
    roll: async request => { requested.push(request.count); return Array(request.count).fill(3) },
  })
  expect(result).not.toHaveProperty('unsupported')
  expect(requested).toEqual([castLevel + 1])
  expect('rolls' in result && result.rolls.damage.values).toHaveLength(castLevel + 1)
})

it.each(['shared', 'per-target'] as const)('requests only activated trigger-table branches (%s)', async scope => {
  const activity = definition(scope)
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  const make = (id: string) => createDnd5eCombatant({ id, name: id, controller: 'dm', initiative: 10,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
    armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
  const state = startDnd5eHeadlessCombat('table-test', [make('actor'), make('a'), make('b')])
  for (const first of [1, 4, 'mixed'] as const) {
    const requested: string[] = []
    const result = await rollDnd5eActivityTriggerDiceV1({ state, actorId: 'actor', targetIds: ['a', 'b'],
      available: { packageId: 'test.tables', packageVersion: '1.0.0', activity, confirmation: 'automatic', retention: 'single-event' },
      triggerContext: { eventId: 'hit', event: 'attack-hit', source: { kind: 'attack', id: 'attack', mode: 'melee' },
        eligibleActorIds: ['actor'], eligibleTargetIds: ['a', 'b'] },
      roll: async request => { requested.push(request.id); return [request.id.startsWith('first')
        ? first === 'mixed' ? request.id.endsWith(':b') ? 1 : 4 : first : 4] },
    })
    expect(result).not.toHaveProperty('unsupported')
    const checks = first !== 1 ? ['first', 'second', 'third'] : ['first']
    expect(requested).toEqual(checks.flatMap(id => scope === 'shared' ? [id]
      : first === 'mixed' && id !== 'first' ? [`${id}:a`] : [`${id}:a`, `${id}:b`]))
    expect(Object.keys('rolls' in result ? result.rolls : {})).toEqual(requested)
  }
})

it.each(['shared', 'per-target'] as const)('never opens a conditional table with missing or nonfinite totals (%s)', scope => {
  const id = scope === 'shared' ? 'second' : 'second:a'
  const prior = scope === 'shared' ? 'first' : 'first:a'
  for (const total of [undefined, NaN, Infinity, 4]) {
    expect(filterDnd5eConditionalActivityRollDeclarationsV1({ activity: definition(scope),
      declarations: [{ id, label: id, count: 1, sides: 4 }], successfulCheckKeys: new Set(),
      rolls: total === undefined ? {} : { [prior]: { total } },
    })).toEqual([])
  }
})
