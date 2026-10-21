import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { validateDeclarativeSubclassAbilityV1, type DeclarativeSubclassAbilityV1 } from './declarativeSubclassAbility'
import { validateDnd5eActivityDefinitionV1 } from './activities/dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'

it.each(['fighterSecondWind', 'fighterActionSurge', 'fighterIndomitable'])('accepts persisted core resource %s without relaxing plugin IDs', resourceId => {
  const ability: DeclarativeSubclassAbilityV1 = { schemaVersion: 1, id: 'guard', name: 'Guard', description: 'Synthetic', level: 3,
    trigger: { kind: 'before-damage-taken' }, cost: { economy: 'reaction', resources: [{ scope: 'core', resourceId, amount: 1 }] },
    targeting: { kind: 'single-creature', relation: 'ally', rangeFeet: 30, includeSelf: true }, effects: [],
    mechanic: { kind: 'damage-mitigation-interrupt', mode: 'resistance', protects: 'ally-or-self', damageTypes: ['fire'] }, automation: 'full' }
  expect(() => validateDeclarativeSubclassAbilityV1(ability)).not.toThrow()
  expect(() => validateDeclarativeSubclassAbilityV1({ ...ability, cost: { ...ability.cost, resources: [{ scope: 'plugin', resourceId, amount: 1 }] } })).toThrow()
  expect(() => validateDeclarativeSubclassAbilityV1({ ...ability, cost: { ...ability.cost, resources: [{ resourceId, amount: 1 }] } })).toThrow()
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'probe', name: 'Probe', activation: { kind: 'free' },
    automation: automationCapabilityFromLegacyStatus('full'), target: { kind: 'self' },
    consumption: [{ kind: 'resource', resourceId, amount: { kind: 'constant', value: 1 }, consumeOn: 'resolve' }],
    requirements: [{ kind: 'resource-capacity', resourceId, minimumMissing: { kind: 'constant', value: 1 } }],
    outcomes: [{ id: 'restore', when: { kind: 'always' }, operations: [{ id: 'restore', kind: 'resource', subject: 'actor', resourceId,
      mode: 'restore', amount: { kind: 'constant', value: 1 } }] }] }
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  for (const invalid of ['FighterSecondWind', 'unknownCoreResource', 'fighterSecondWind ', '__proto__']) {
    expect(() => validateDeclarativeSubclassAbilityV1({ ...ability, cost: { ...ability.cost, resources: [{ scope: 'core', resourceId: invalid, amount: 1 }] } })).toThrow()
    expect(validateDnd5eActivityDefinitionV1({ ...activity, consumption: [{ kind: 'resource', resourceId: invalid,
      amount: { kind: 'constant', value: 1 }, consumeOn: 'resolve' }] }).length).toBeGreaterThan(0)
  }
})
