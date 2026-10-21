import { expect, it } from 'vitest'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { resolveDnd5eActivity, type Dnd5eActivityExecutionInput } from './dnd5eActivityExecutor'
import { dnd5eActivityProjectileFormulaOptionsV1 } from './dnd5eActivitySaveGate'
import { collectScaledDnd5eActivityFormulaRollDeclarationsV1 } from './dnd5eActivityRollRecipe'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'

const activity: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1, id: 'independent', name: 'Independent attacks', activation: { kind: 'action' },
  target: { kind: 'creature', relation: 'any', count: 3 }, automation: automationCapabilityFromLegacyStatus('full'),
  checks: [{ id: 'hit', kind: 'attack-roll', rollId: 'hit', scope: 'per-target', rollMode: 'normal', attackBonus: { kind: 'constant', value: 5 } }],
  outcomes: [{ id: 'damage', when: { kind: 'check', checkId: 'hit', result: 'success' }, operations: [
    { id: 'damage', kind: 'damage', target: 'target', perTarget: true, critical: 'double-dice',
      damageType: 'force', amount: { kind: 'dice', rollId: 'damage', count: 2, sides: 6 } },
  ] }],
}
function input(): Dnd5eActivityExecutionInput {
  const actor = { id: 'actor', controller: 'players' as const, level: 5, proficiencyBonus: 3, abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 }, armorClass: 15, currentHp: 100, maxHp: 100, conditions: [] }
  return { activity, actor, targets: ['miss', 'normal', 'critical'].map(id => ({ ...actor, id })),
    rolls: { 'hit:miss': { values: [1] }, 'hit:normal': { values: [15] }, 'hit:critical': { values: [20] },
      'damage:normal': { values: [2, 3] }, 'damage:critical': { values: [1, 2, 3, 4] } } }
}
it('uses identical UI/Host recipes for distinct pools and only doubles the critical target', () => {
  const value = input()
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  expect(collectScaledDnd5eActivityFormulaRollDeclarationsV1(activity, dnd5eActivityProjectileFormulaOptionsV1(value, [])))
    .toEqual([{ id: 'damage:normal', count: 2, sides: 6 }, { id: 'damage:critical', count: 4, sides: 6 }])
  const result = resolveDnd5eActivity(value)
  expect(result.ok, JSON.stringify(result)).toBe(true)
  if (result.ok) expect(result.proposals.filter(p => p.kind === 'deal-damage').map(p => [p.targetId, p.amount])).toEqual([['normal', 5], ['critical', 10]])
})
it('rejects shared pools, missing critical dice, and duplicate target snapshots', () => {
  const value = input()
  expect(resolveDnd5eActivity({ ...value, rolls: { ...value.rolls, 'damage:critical': { values: [3, 4] } } }).ok).toBe(false)
  const { ['damage:normal']: omitted, ...rolls } = value.rolls
  expect(resolveDnd5eActivity({ ...value, rolls: { ...rolls, damage: omitted } }).ok).toBe(false)
  expect(resolveDnd5eActivity({ ...value, targets: [value.targets[1], value.targets[1]] }).ok).toBe(false)
  expect(validateDnd5eActivityDefinitionV1({ ...activity, target: { ...activity.target, kind: 'creature', relation: 'any', count: 3, allowDuplicateTargets: true } }).length).toBeGreaterThan(0)
})

