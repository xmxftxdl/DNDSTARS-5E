import { describe, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { resolveDnd5eActivity, type Dnd5eActivityExecutionInput } from './dnd5eActivityExecutor'

const activity: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1, id: 'object-animation', name: 'Object animation', activation: { kind: 'action' },
  target: { kind: 'creature', relation: 'any', count: 2, rangeFeet: 5 },
  outcomes: [{ id: 'animate', when: { kind: 'always' }, operations: [{
    id: 'animate', kind: 'summon', animatedObjectSize: 'tiny', monsterId: 'srd-5.1:owl',
    count: { kind: 'constant', value: 1 }, timing: 'immediate', durationRounds: 4800,
    concentration: false, side: 'ally',
  }] }], automation: automationCapabilityFromLegacyStatus('full'),
}
const actor = { id: 'caster', controller: 'players' as const, level: 5, proficiencyBonus: 3,
  abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 }, armorClass: 10,
  currentHp: 10, maxHp: 10, conditions: [] }
const object = { ...actor, id: 'object-a', objectDamageThreshold: 0 }
const resolve = (definition = activity, targets: Dnd5eActivityExecutionInput['targets'] = [object, { ...object, id: 'object-b' }]) =>
  resolveDnd5eActivity({ activity: definition, actor, targets, rolls: {}, confirmedBy: 'actor',
    distanceFeetByTargetId: { 'object-a': 5, 'object-b': 5 } })

describe('object animation target contract', () => {
  it('compiles one source-bound summon per selected object after JSON reload', () => {
    const result = resolve(JSON.parse(JSON.stringify(activity)))
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) throw Error(result.reason)
    expect(result.proposals.filter(proposal => proposal.kind === 'summon')).toMatchObject([
      { objectTokenId: 'object-a', animatedObjectSize: 'tiny', count: 1 },
      { objectTokenId: 'object-b', animatedObjectSize: 'tiny', count: 1 },
    ])
  })
  it('rejects creature targets instead of treating them as objects', () => {
    expect(resolve(activity, [{ ...actor, id: 'object-a' }]).ok).toBe(false)
  })
  it('rejects an animation declaration mixed with creature damage', () => {
    const mixed = structuredClone(activity)
    mixed.outcomes[0].operations = [...mixed.outcomes[0].operations, {
      id: 'damage', kind: 'damage', target: 'target', damageType: 'fire', amount: { kind: 'constant', value: 3 },
    }]
    expect(resolve(mixed).ok).toBe(false)
  })
})
