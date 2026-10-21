import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { validateDeclarativeSubclassAbilityV1, type DeclarativeSubclassAbilityV1 } from '../declarativeSubclassAbility'

it.each(['hit-target', 'hit-actor', 'always', 'miss-target'] as const)('attributes attack damage only to its successful branch and target (%s)', mode => {
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'probe', name: 'Probe', activation: { kind: 'free' },
    automation: automationCapabilityFromLegacyStatus('full'), target: { kind: 'creature', count: 1, relation: 'any', rangeFeet: 30 },
    checks: [{ id: 'attack', kind: 'attack-roll', rollId: 'attack', attackBonus: { kind: 'constant', value: 10 }, scope: 'per-target', rollMode: 'normal', delivery: 'ranged' }],
    outcomes: [{ id: 'damage', when: mode === 'always' ? { kind: 'always' } : { kind: 'check', checkId: 'attack', result: mode === 'miss-target' ? 'failure' : 'success' },
      operations: [{ id: 'damage', kind: 'damage', target: mode === 'hit-actor' ? 'actor' : 'target', damageType: 'fire', amount: { kind: 'constant', value: 9 } }] }],
  }
  const actor = { id: 'actor', controller: 'players' as const, level: 3, proficiencyBonus: 2, armorClass: 10, currentHp: 30, maxHp: 30, conditions: [],
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } }
  const result = resolveDnd5eActivity({ activity, actor, targets: [{ ...actor, id: 'target', controller: 'dm' }],
    distanceFeetByTargetId: { target: 5 }, rolls: { 'attack:target': { values: [mode === 'miss-target' ? 1 : 15] } } })
  expect(result.ok, JSON.stringify(result)).toBe(true)
  if (!result.ok) throw Error('Failed')
  const damage = result.proposals.filter(proposal => proposal.kind === 'deal-damage')
  expect(damage).toHaveLength(1)
  expect(damage[0].attackDamage === true).toBe(mode === 'hit-target')
})

it('strictly validates the optional attack-only trigger constraint', () => {
  const ability: DeclarativeSubclassAbilityV1 = { schemaVersion: 1, id: 'guard', name: 'Guard', description: 'Synthetic', level: 1,
    trigger: { kind: 'before-damage-taken' }, cost: { economy: 'reaction' }, targeting: { kind: 'single-creature', relation: 'ally', includeSelf: true },
    effects: [], mechanic: { kind: 'damage-mitigation-interrupt', mode: 'resistance', protects: 'self', damageTypes: ['fire'], attackOnly: true }, automation: 'full' }
  expect(() => validateDeclarativeSubclassAbilityV1(ability)).not.toThrow()
  for (const attackOnly of ['true', 1, {}, []]) {
    expect(() => validateDeclarativeSubclassAbilityV1({ ...ability, mechanic: { ...ability.mechanic, attackOnly } })).toThrow()
  }
})
