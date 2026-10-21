import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { createDnd5eMechanicalEffect, normalizeDnd5eActiveEffects, validateDnd5eActiveEffectsStrict } from './activeEffects'
import { dnd5eTargetDamageRollBonus } from './targetDamageRollBonus'
import { resolveDnd5eActivity } from './activities/dnd5eActivityExecutor'
import { validateDnd5eFormulaV1, type Dnd5eFormulaV1 } from './activities/dnd5eFormula'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { dnd5eEffectAutomationAnalysisV1 } from './plugins/pluginMechanicsRegistry'

const actor = { id: 'actor', controller: 'player' as const, level: 3, proficiencyBonus: 2,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, armorClass: 10,
  currentHp: 30, maxHp: 30, conditions: [] }
const rolled: Dnd5eFormulaV1 = { kind: 'damage-roll', rollId: 'primary', value: { kind: 'dice', rollId: 'damage', count: 1, sides: 6 } }

it('matches source and live effects after serialization without stacking duplicate definitions', () => {
  const effect = createDnd5eMechanicalEffect({ definitionId: 'mark', label: 'Mark', targetId: 'target',
    source: { kind: 'feature', actorId: actor.id }, modifiers: { damageRollsBySourceBonus: 2 } })
  const saved = normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify([effect])))
  expect(validateDnd5eActiveEffectsStrict(saved).ok).toBe(true)
  expect(dnd5eTargetDamageRollBonus(saved, actor.id)).toBe(2)
  expect(dnd5eTargetDamageRollBonus(saved, 'foreign')).toBe(0)
  expect(dnd5eTargetDamageRollBonus([], actor.id)).toBe(0)
  expect(dnd5eTargetDamageRollBonus([{ ...effect, suspendedBy: ['antimagic'] }], actor.id)).toBe(0)
  expect(dnd5eTargetDamageRollBonus([effect, { ...effect, id: 'duplicate', modifiers: { damageRollsBySourceBonus: 3 } }], actor.id)).toBe(3)
  expect(validateDnd5eActiveEffectsStrict([{ ...effect, modifiers: { damageRollsBySourceBonus: 1.5 } }]).ok).toBe(false)
})

it.each([
  { name: 'ordinary', amount: rolled, total: 7 },
  { name: 'half after bonus', amount: { kind: 'floor', value: { kind: 'multiply', values: [rolled, { kind: 'constant', value: 0.5 }] } } as Dnd5eFormulaV1, total: 3 },
  { name: 'fixed damage', amount: { kind: 'damage-roll', rollId: 'primary', value: { kind: 'constant', value: 5 } } as Dnd5eFormulaV1, total: 5 },
  { name: 'unwrapped dice', amount: { kind: 'dice', rollId: 'damage', count: 1, sides: 6 } as Dnd5eFormulaV1, total: 5 },
  { name: 'repeated boundary', amount: { kind: 'add', values: [rolled, rolled] } as Dnd5eFormulaV1, total: 12 },
  { name: 'nested boundary', amount: { kind: 'damage-roll', rollId: 'outer', value: rolled } as Dnd5eFormulaV1, total: 7 },
])('applies a source bonus at the declared damage roll boundary: $name', ({ name, amount, total }) => {
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'strike', name: 'Synthetic',
    activation: { kind: 'free' }, automation: automationCapabilityFromLegacyStatus('full'),
    target: { kind: 'creature', relation: 'any', count: 2, rangeFeet: 30 },
    outcomes: [{ id: 'damage', when: { kind: 'always' }, operations: [{ id: 'damage', kind: 'damage',
      target: 'all-targets', damageType: 'force', amount }] }] }
  let bonusReads = 0
  const resolve = () => resolveDnd5eActivity({ activity, actor, targets: [{ ...actor, id: 'a' }, { ...actor, id: 'b' }],
    rolls: { damage: { values: [5] } }, distanceFeetByTargetId: { a: 5, b: 5 },
    resolveDamageRollBonus: targetId => { bonusReads++; return targetId === 'a' ? 2 : 0 } })
  for (let execution = 0; execution < 2; execution++) {
    const result = resolve()
    expect(result.ok, JSON.stringify(result)).toBe(true); if (!result.ok) return
    const damage = result.proposals.filter(p => p.kind === 'deal-damage')
    expect(damage.find(p => p.targetId === 'a')?.amount).toBe(total)
  }
  expect(bonusReads).toBe(['fixed damage', 'unwrapped dice'].includes(name) ? 0 : 4)
})

it('validates boundary ids and does not advertise full support before native damage integration', () => {
  expect(validateDnd5eFormulaV1({ kind: 'damage-roll', rollId: '', value: rolled })).not.toEqual([])
  expect(dnd5eEffectAutomationAnalysisV1({ schemaVersion: 1, id: 'mark', name: 'Mark', stacking: 'replace',
    duration: { kind: 'rounds', rounds: 2, expiresAt: 'source-turn-end' },
    modifiers: [{ kind: 'damage-rolls-by-source-bonus', value: { kind: 'constant', value: 2 } }] }).level).toBe('assisted')
})
