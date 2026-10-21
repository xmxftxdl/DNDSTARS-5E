import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { evaluateDnd5eFormulaV1, type Dnd5eFormulaDiceEvidenceV1, type Dnd5eFormulaV1 } from './dnd5eFormula'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

const actor = { id: 'actor', controller: 'player' as const, level: 3, proficiencyBonus: 2,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, currentHp: 30, maxHp: 30,
  armorClass: 10, conditions: [] }
const die = { kind: 'dice' as const, rollId: 'damage', count: 1, sides: 6 }

it('traces consumed dice rather than an unused critical superset, including die floors', () => {
  const evidence: Dnd5eFormulaDiceEvidenceV1[] = []
  const rolls = { damage: { values: [1, 6] } }
  const amount = evaluateDnd5eFormulaV1(die, { actor, rolls, maximumDiceMultiplierByRollId: { damage: 2 },
    minimumDieValueByRollId: { damage: 2 }, onDiceEvaluated: row => evidence.push(row) })
  expect(amount).toBe(2)
  expect(evidence).toEqual([{ rollId: 'damage', count: 1, sides: 6, submittedCount: 2, rawValues: [1], values: [2] }])
  rolls.damage.values[0] = 5
  expect(evidence[0].rawValues).toEqual([1])
})

it('retains actual critical pool, maximized results, and separate uses of a shared roll id', () => {
  const evidence: Dnd5eFormulaDiceEvidenceV1[] = []
  expect(evaluateDnd5eFormulaV1({ kind: 'add', values: [die, die] }, { actor,
    rolls: { damage: { values: [2, 3] } }, diceMultiplierByRollId: { damage: 2 }, maximizeDiceRollIds: ['damage'],
    onDiceEvaluated: row => evidence.push(row) })).toBe(24)
  expect(evidence).toHaveLength(2)
  expect(evidence[0]).toMatchObject({ count: 2, rawValues: [2, 3], values: [6, 6] })
  expect(evidence[0].rollId).toBe(evidence[1].rollId)
})

it.each([
  { formula: { kind: 'constant', value: 7 } as Dnd5eFormulaV1, total: 7, adjustment: undefined, count: 0 },
  { formula: { kind: 'floor', value: { kind: 'multiply', values: [die, { kind: 'constant', value: 0.5 }] } } as Dnd5eFormulaV1,
    total: 2, adjustment: -3, count: 1 },
  { formula: { kind: 'add', values: [die, { kind: 'constant', value: 3 }] } as Dnd5eFormulaV1,
    total: 8, adjustment: 3, count: 1 },
  { formula: { kind: 'multiply', values: [die, { kind: 'constant', value: 0 }] } as Dnd5eFormulaV1,
    total: 0, adjustment: -5, count: 1 },
])('distinguishes fixed damage from rolled formulas even when final damage is zero: $total/$adjustment', ({ formula, total, adjustment, count }) => {
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'damage-evidence', name: 'Synthetic',
    activation: { kind: 'free' }, automation: automationCapabilityFromLegacyStatus('full'),
    target: { kind: 'creature', count: 2, relation: 'any', rangeFeet: 30 },
    outcomes: [{ id: 'damage', when: { kind: 'always' }, operations: [{ id: 'damage', kind: 'damage',
      target: 'all-targets', damageType: 'force', amount: formula }] }] }
  const result = resolveDnd5eActivity({ activity, actor, targets: [{ ...actor, id: 'a' }, { ...actor, id: 'b' }],
    rolls: { damage: { values: [5] } }, distanceFeetByTargetId: { a: 5, b: 5 } })
  expect(result.ok).toBe(true); if (!result.ok) return
  const damage = result.proposals.filter(p => p.kind === 'deal-damage')
  expect(damage).toHaveLength(2)
  for (const proposal of damage) {
    expect(proposal.amount).toBe(total)
    expect(proposal.formulaAdjustment).toBe(adjustment)
    expect(proposal.diceAudit ?? []).toHaveLength(count)
  }
  if (count) {
    expect(damage[0].diceAudit![0].rollId).toBe(damage[1].diceAudit![0].rollId)
    expect(damage[0].diceAudit![0].values).not.toBe(damage[1].diceAudit![0].values)
  }
})
