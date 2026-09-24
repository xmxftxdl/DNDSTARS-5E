import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import type { Dnd5eActivityExecutionInput } from '../../rulesets/dnd5e/activities/dnd5eActivityExecutor'
import { activitySavingThrowPreview } from './activitySavingThrowPreview'

const actor = { id: 'caster', controller: 'player' as const, name: '法师', level: 10, proficiencyBonus: 4,
  abilities: { str: 10, dex: 10, con: 10, int: 20, wis: 10, cha: 10 }, armorClass: 15,
  currentHp: 100, maxHp: 100, conditions: [], spellSaveDc: 17 }
const input: Dnd5eActivityExecutionInput = {
  actor, targets: [{ ...actor, id: 'target', name: '目标', savingThrowModifiers: { dex: 3 } }], rolls: {},
  activity: { schemaVersion: 1, id: 'save-test', name: 'Save test', activation: { kind: 'action', cost: 1 },
    target: { kind: 'self' },
    checks: [{ id: 'save', kind: 'saving-throw', scope: 'per-target', rollId: 'save-d20', ability: 'dex',
      rollMode: 'host-derived', dc: { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } } }],
    outcomes: [], automation: automationCapabilityFromLegacyStatus('full') },
}
const declaration = { id: 'save-d20:target', label: '豁免', count: 1, sides: 20,
  rollerTokenId: 'target', d20RollKind: 'saving-throw' as const }

it('previews caster-owned attack dice against the target AC, including natural dice and corrections', () => {
  const attackInput: Dnd5eActivityExecutionInput = { ...input,
    actor: { ...actor, spellAttackBonus: 9 },
    activity: { ...input.activity, checks: [{ id: 'attack', kind: 'attack-roll',
      rollId: 'attack-d20', scope: 'per-target', rollMode: 'host-derived',
      attackBonus: { kind: 'reference', reference: { kind: 'actor-spell-attack-bonus' } } }] },
  }
  const attackDeclaration = { ...declaration, id: 'attack-d20:target', rollerTokenId: 'caster', d20RollKind: 'attack' as const }
  const preview = activitySavingThrowPreview(attackInput, attackDeclaration)!
  expect(preview.kind).toBe('attack')
  expect(preview.targetName).toBe('目标')
  expect(preview.evaluate(6)).toBe(true)
  expect(preview.evaluate(5)).toBe(false)
  expect(preview.evaluate(1)).toBe(false)
  expect(preview.evaluate(20)).toBe(true)
  expect(activitySavingThrowPreview(attackInput, { ...attackDeclaration, count: 2, d20RollMode: 'advantage' })!.evaluate(1, 6)).toBe(true)
  expect(activitySavingThrowPreview(attackInput, { ...attackDeclaration, count: 2, d20RollMode: 'disadvantage' })!.evaluate(1, 20)).toBe(false)
  expect(attackInput.rolls).toEqual({})
})

it('evaluates the save before any damage pool exists and updates on DM face correction', () => {
  const preview = activitySavingThrowPreview(input, declaration)!
  expect(preview.evaluate(14)).toBe(true)
  expect(preview.evaluate(13)).toBe(false)
  expect(input.rolls).toEqual({})
})
it('uses the adopted advantage/disadvantage die and the correct target modifier', () => {
  expect(activitySavingThrowPreview(input, { ...declaration, count: 2, d20RollMode: 'advantage' })!.evaluate(2, 14)).toBe(true)
  expect(activitySavingThrowPreview(input, { ...declaration, count: 2, d20RollMode: 'disadvantage' })!.evaluate(2, 14)).toBe(false)
  expect(activitySavingThrowPreview(input, { ...declaration, rollerTokenId: 'other' })).toBeUndefined()
})
it('does not treat a damage or random d20 as a saving throw', () => {
  expect(activitySavingThrowPreview(input, { ...declaration, d20RollKind: undefined })).toBeUndefined()
})
it('does not apply advantage again after the Host has cancelled it with disadvantage', () => {
  const source = { ...input, targets: [{ ...input.targets[0]!, creatureType: 'humanoid' }],
    activity: { ...input.activity, checks: input.activity.checks!.map(check => ({ ...check,
      rollModeByCreatureType: { creatureTypes: ['humanoid'], mode: 'advantage' as const } })) } }
  const preview = activitySavingThrowPreview(source, { ...declaration, d20RollMode: 'normal' })!
  expect(preview.evaluate(2, 20)).toBe(false)
})
