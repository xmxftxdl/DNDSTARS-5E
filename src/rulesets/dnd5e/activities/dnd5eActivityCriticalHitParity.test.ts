import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { resolveDnd5eAttackOutcome, DND5E_TOTAL_COVER_ARMOR_CLASS } from '../attackResolution'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import { dnd5eActivitySubmittedAttackCheckSuccessKeysV1 } from './dnd5eActivityRollRecipe'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

it('does not turn an automatic-critical-on-hit condition into an automatic hit', () => {
  expect(resolveDnd5eAttackOutcome({ attack: { roll: { d20: 10, total: 10, modifier: 0, mode: 'normal',
    naturalOne: false, naturalTwenty: false }, targetAc: 25, hit: false, critical: false }, automaticCritical: true }))
    .toMatchObject({ hit: false, critical: false })
})

it.each([
  { d20: 19, ac: 25, bonus: 0, hit: true, critical: true },
  { d20: 19, ac: 19, bonus: 0, hit: true, critical: true },
  { d20: 19, ac: 24, bonus: 5, hit: true, critical: true },
  { d20: 18, ac: 18, bonus: 0, hit: true, critical: false },
  { d20: 18, ac: 25, bonus: 0, hit: false, critical: false },
  { d20: 20, ac: 25, bonus: 0, hit: true, critical: true },
  { d20: 1, ac: 10, bonus: 100, hit: false, critical: false },
  { d20: 20, ac: DND5E_TOTAL_COVER_ARMOR_CLASS, bonus: 100, hit: false, critical: false },
])('matches native hit/critical rules at d20=$d20 AC=$ac bonus=$bonus', ({ d20, ac, bonus, hit, critical }) => {
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'critical', name: 'Synthetic threshold',
    activation: { kind: 'free' }, automation: automationCapabilityFromLegacyStatus('full'),
    target: { kind: 'creature', count: 1, relation: 'any', rangeFeet: 30 },
    checks: [{ id: 'attack', kind: 'attack-roll', rollId: 'attack', attackBonus: { kind: 'constant', value: bonus },
      criticalThreshold: 19, scope: 'per-target', rollMode: 'normal', delivery: 'melee' }],
    outcomes: [{ id: 'damage', when: { kind: 'check', checkId: 'attack', result: 'success' },
      operations: [{ id: 'damage', kind: 'damage', target: 'target', damageType: 'force', amount: { kind: 'constant', value: 1 } }] }],
  }
  const actor = { id: 'actor', controller: 'players' as const, level: 3, proficiencyBonus: 2, armorClass: 10,
    currentHp: 30, maxHp: 30, conditions: [], abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } }
  // Base AC deliberately differs to ensure preparation respects delivery-specific defenses.
  const target = { ...actor, id: 'target', attackArmorClasses: { default: 10, melee: ac, ranged: 10, spell: 10 } }
  const rolls = { 'attack:target': { values: [d20] } }
  const result = resolveDnd5eActivity({ activity, actor, targets: [target], rolls, distanceFeetByTargetId: { target: 5 } })
  expect(result.ok).toBe(true)
  if (!result.ok) throw Error('Activity failed')
  expect(result.checks[0]).toMatchObject({ success: hit, criticalSuccess: critical })
  expect(result.proposals.filter(p => p.kind === 'deal-damage')).toHaveLength(hit ? 1 : 0)
  const predicted = dnd5eActivitySubmittedAttackCheckSuccessKeysV1(activity, { actor, targets: [target], rolls, hostRollMode: () => 'normal' })
  expect(predicted.has('attack:target')).toBe(hit)
  const native = resolveDnd5eAttackOutcome({ attack: { roll: { d20, total: d20 + bonus, modifier: bonus, mode: 'normal',
    naturalOne: d20 === 1, naturalTwenty: d20 === 20 }, targetAc: ac, hit: false, critical: false }, criticalThreshold: 19 })
  expect(native).toMatchObject({ hit, critical })
})
