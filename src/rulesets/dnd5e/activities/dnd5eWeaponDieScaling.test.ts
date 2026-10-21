import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { scaleDnd5eActivityDefinitionV1 } from './dnd5eActivityScaling'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'

it('scales dynamic and fixed dice independently without changing the installed definition', () => {
  const activity: Dnd5eActivityDefinitionV1 = {
    schemaVersion: 1, id: 'scaling-rider', name: 'Synthetic scaling rider',
    activation: { kind: 'free' }, target: { kind: 'self' },
    automation: automationCapabilityFromLegacyStatus('full'),
    effects: [{ schemaVersion: 1, id: 'rider', name: 'Rider', stacking: 'replace',
      duration: { kind: 'permanent' }, modifiers: [
        { kind: 'on-hit-bonus-damage', amount: { kind: 'weapon-dice', count: 1, bonus: 2 },
          damageType: 'inherit-primary', appliesTo: 'all-weapon-attacks', consumeEffectOnHit: false },
        { kind: 'on-hit-bonus-damage', amount: { kind: 'dice', rollId: 'fixed', count: 1, sides: 4 },
          damageType: 'fire', appliesTo: 'all-weapon-attacks' },
      ] }],
    outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [
      { kind: 'apply-effect', id: 'apply', effectId: 'rider', target: 'actor' },
    ] }],
    scaling: [{ basis: 'slot-level', baseLevel: 1, adjustments: [
      { operationId: 'apply', diceCountPerStep: 1, flatAmountPerStep: 2 },
    ] }],
  }
  const original = structuredClone(activity)
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  const scaled = scaleDnd5eActivityDefinitionV1(activity, {
    actor: { level: 5, proficiencyBonus: 3 }, castLevel: 3,
  }).activity
  expect(scaled.effects![0].modifiers).toEqual([
    { ...activity.effects![0].modifiers![0], amount: { kind: 'weapon-dice', count: 3, bonus: 6 } },
    { ...activity.effects![0].modifiers![1], amount: { kind: 'add', values: [
      { kind: 'dice', rollId: 'fixed', count: 3, sides: 4 }, { kind: 'constant', value: 4 },
    ] } },
  ])
  expect(validateDnd5eActivityDefinitionV1(scaled)).toEqual([])
  expect(activity).toEqual(original)
  expect(scaleDnd5eActivityDefinitionV1(activity, {
    actor: { level: 5, proficiencyBonus: 3 }, castLevel: 1,
  }).activity.effects).toEqual(original.effects)
})
