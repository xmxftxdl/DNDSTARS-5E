import { expect, it } from 'vitest'
import { dnd5eActivityAttackAbility } from './dnd5eAttackAbility'
import type { Dnd5eFormulaV1 } from './dnd5eFormula'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { dnd5eActivityPerTargetRollDeclarationsV1 } from './dnd5eActivityPerTargetRolls'

const spell: Dnd5eFormulaV1 = { kind: 'reference', reference: { kind: 'actor-spell-attack-bonus' } }
const dex: Dnd5eFormulaV1 = { kind: 'reference', reference: { kind: 'actor-ability-modifier', ability: 'dex' } }
it('derives the selected casting source rather than guessing from the highest stat or primary class', () => {
  expect(dnd5eActivityAttackAbility(spell, 'cha')).toBe('cha')
  expect(dnd5eActivityAttackAbility(spell, 'int')).toBe('int')
  expect(dnd5eActivityAttackAbility(spell)).toBeUndefined()
  expect(dnd5eActivityAttackAbility({ kind: 'add', values: [dex,
    { kind: 'reference', reference: { kind: 'actor-proficiency-bonus' } }, { kind: 'constant', value: 2 }] }, 'int')).toBe('dex')
})
it('does not assign an ability to flat, ambiguous, conditional or target-derived bonuses', () => {
  for (const formula of [
    { kind: 'constant', value: 8 },
    { kind: 'add', values: [dex, spell] },
    { kind: 'maximum', values: [dex, spell] },
    { kind: 'reference', reference: { kind: 'target-ability-modifier', ability: 'dex' } },
  ] as Dnd5eFormulaV1[]) expect(dnd5eActivityAttackAbility(formula, 'int')).toBeUndefined()
})
it('expands an attack with Host casting ability and mode, clearing forged metadata from other dice', () => {
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'spell', name: 'Spell',
    activation: { kind: 'action', cost: 1 }, target: { kind: 'creature', relation: 'enemy', rangeFeet: 60, count: 1 },
    checks: [{ id: 'attack', kind: 'attack-roll', rollId: 'attack', attackBonus: spell, rollMode: 'host-derived', scope: 'per-target' }],
    outcomes: [], automation: { schemaVersion: 1, level: 'full', supportedPhases: [], manualPhases: [], limitations: [] } }
  const run = (spellcastingAbility?: 'cha' | 'int') => dnd5eActivityPerTargetRollDeclarationsV1({ activity,
    actor: { id: 'caster' }, targets: [{ id: 'target' }], spellcastingAbility,
    hostAttackRollMode: () => 'advantage', hostSavingThrowMode: () => 'normal',
    declarations: [{ id: 'attack', label: 'Attack', count: 1, sides: 20, attackAbility: 'str' },
      { id: 'damage', label: 'Damage', count: 1, sides: 6, attackAbility: 'dex' }] })
  expect(run('cha')[0]).toMatchObject({ id: 'attack:target', count: 2, d20RollMode: 'advantage', d20RollKind: 'attack', attackAbility: 'cha', rollerTokenId: 'caster' })
  expect(run('int')[0].attackAbility).toBe('int')
  expect(run()[0].attackAbility).toBeUndefined()
  expect(run('cha')[1].attackAbility).toBeUndefined()
})
