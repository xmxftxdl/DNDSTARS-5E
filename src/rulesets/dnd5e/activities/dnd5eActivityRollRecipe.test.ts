import { describe, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { resolveDnd5eActivity, type Dnd5eActivityActorSnapshot } from './dnd5eActivityExecutor'
import {
  collectScaledDnd5eActivityFormulaRollDeclarationsV1,
  dnd5eActivitySubmittedAttackCheckSuccessKeysV1,
  dnd5eActivitySubmittedAttackRollIsCriticalV1,
} from './dnd5eActivityRollRecipe'
import { dnd5eSrdAuditedFullContentDefinitionsV1 } from './dnd5eSrdAuditedSpellActivities'

const abilities = { str: 10, dex: 10, con: 10, int: 20, wis: 10, cha: 10 } as const

function actor(id: string, controller: 'player' | 'dm'): Dnd5eActivityActorSnapshot {
  return {
    id,
    controller,
    level: 20,
    proficiencyBonus: 6,
    abilities,
    armorClass: controller === 'player' ? 15 : 10,
    currentHp: 100,
    maxHp: 100,
    conditions: [],
    spellAttackBonus: 11,
    spellcastingAbilityModifier: 5,
  }
}

function arcaneHandFist(): Dnd5eActivityDefinitionV1 {
  const definition = dnd5eSrdAuditedFullContentDefinitionsV1().find((entry) =>
    entry.id === 'arcane-hand')
  const activity = (definition?.activities as readonly Dnd5eActivityDefinitionV1[] | undefined)
    ?.find((candidate) => candidate.id === 'spell:arcane-hand:clenched-fist')
  if (!activity) throw new Error('Arcane Hand clenched fist Activity is unavailable')
  return activity
}

describe('scaled Activity roll recipe', () => {
  it('omits target-only damage on empty areas while preserving actor and global damage', () => {
    const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'empty-area', name: 'Empty area',
      activation: { kind: 'action' }, target: { kind: 'area', origin: 'point', relation: 'any', shape: 'rect', widthFeet: 5, lengthFeet: 5 },
      automation: automationCapabilityFromLegacyStatus('full'),
      outcomes: [{ id: 'damage', when: { kind: 'always' }, operations:
        (['target', 'all-targets', 'actor', 'all-combatants'] as const).map(target => ({
          id: target, kind: 'damage' as const, target, damageType: 'bludgeoning' as const,
          amount: { kind: 'dice' as const, rollId: target, count: 1, sides: 6 },
        })) }],
    }
    const ids = (targetCount?: number) => collectScaledDnd5eActivityFormulaRollDeclarationsV1(activity, { targetCount }).map(roll => roll.id).sort()
    expect(ids(0)).toEqual(['actor', 'all-combatants'])
    expect(ids(1)).toEqual(['actor', 'all-combatants', 'all-targets', 'target'])
    expect(ids()).toEqual(ids(1))
  })
  it('collects maximum-HP dice but doubles only declared critical damage dice', () => {
    const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'mixed-dice', name: 'Mixed dice',
      activation: { kind: 'action' }, target: { kind: 'creature', relation: 'any', count: 1 },
      automation: automationCapabilityFromLegacyStatus('full'),
      checks: [{ id: 'attack', kind: 'attack-roll', rollId: 'attack', attackBonus: { kind: 'constant', value: 5 }, rollMode: 'normal', scope: 'per-target' }],
      effects: [
        { schemaVersion: 1, id: 'debit', name: 'Debit', duration: { kind: 'permanent' }, stacking: 'replace' },
        { schemaVersion: 1, id: 'credit', name: 'Credit', duration: { kind: 'permanent' }, stacking: 'replace' },
        { schemaVersion: 1, id: 'boost', name: 'Boost', duration: { kind: 'permanent' }, stacking: 'replace',
          modifiers: [{ kind: 'hit-point-maximum', mode: 'add', value: { kind: 'dice', rollId: 'boost', count: 1, sides: 6 } }] },
      ],
      outcomes: [{ id: 'mixed', when: { kind: 'check', checkId: 'attack', result: 'success' }, operations: [
        { id: 'damage', kind: 'damage', target: 'target', damageType: 'force', critical: 'double-dice', amount: { kind: 'dice', rollId: 'damage', count: 1, sides: 8 } },
        { id: 'transfer', kind: 'transfer-hit-point-maximum', target: 'target', owningEffectId: 'debit', beneficiaryEffectId: 'credit', amount: { kind: 'dice', rollId: 'transfer', count: 2, sides: 4 } },
        { id: 'boost', kind: 'apply-effect', target: 'target', effectId: 'boost' },
      ] }],
    }
    expect(collectScaledDnd5eActivityFormulaRollDeclarationsV1(activity, { critical: true })).toEqual([
      { id: 'damage', count: 2, sides: 8 }, { id: 'transfer', count: 2, sides: 4 }, { id: 'boost', count: 1, sides: 6 },
    ])
    const result = resolveDnd5eActivity({ activity, actor: actor('caster', 'player'), targets: [actor('target', 'dm')],
      rolls: { 'attack:target': { values: [20] }, damage: { values: [7, 7] }, transfer: { values: [3, 4] }, boost: { values: [5] } } })
    expect(result.ok, result.ok ? undefined : result.details.join('; ')).toBe(true)
    if (result.ok) {
      expect(result.proposals).toContainEqual(expect.objectContaining({ kind: 'deal-damage', amount: 14 }))
      expect(result.proposals).toContainEqual(expect.objectContaining({ kind: 'transfer-hit-point-maximum', amount: 7 }))
      expect(result.proposals).toContainEqual(expect.objectContaining({ kind: 'apply-effect', modifierGroups: expect.arrayContaining([
        expect.objectContaining({ hitPointMaximumBonus: 5 }),
      ]) }))
    }
  })
  it('captures every Arcane Hand object statistic and resolves HP from the caster maximum', () => {
    const caster = actor('caster', 'player')
    caster.maxHp = 162
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1,
      id: 'arcane-hand-profile-test',
      name: 'Arcane Hand profile test',
      activation: { kind: 'action', cost: 1 },
      target: { kind: 'self' },
      outcomes: [{
        id: 'create',
        when: { kind: 'always' },
        operations: [{
          id: 'hand',
          kind: 'create-persistent-area',
          label: '奥术之手',
          durationRounds: 10,
          concentration: true,
          entityProfile: {
            armorClass: 20,
            hitPoints: 'actor-max-hit-points',
            strength: 26,
            dexterity: 10,
            cannotAttack: true,
            invisible: false,
          },
        }],
      }],
      automation: automationCapabilityFromLegacyStatus('full'),
    }
    const resolved = resolveDnd5eActivity({ activity, actor: caster, targets: [caster], rolls: {} })
    expect(resolved.ok, resolved.ok ? undefined : resolved.details.join('; ')).toBe(true)
    if (!resolved.ok) return
    expect(resolved.proposals).toContainEqual(expect.objectContaining({
      kind: 'create-persistent-area',
      entityProfile: {
        armorClass: 20,
        hitPoints: 162,
        strength: 26,
        dexterity: 10,
        cannotAttack: true,
        invisible: false,
      },
    }))
  })

  it('requests 4d8 at 5th level, 6d8 at 6th level, and 12d8 on a 6th-level critical', () => {
    const activity = arcaneHandFist()
    const caster = actor('caster', 'player')
    const count = (castLevel: number, critical = false) =>
      collectScaledDnd5eActivityFormulaRollDeclarationsV1(activity, {
        critical,
        scaling: { actor: caster, castLevel },
      }).find((roll) => roll.id === 'arcane-hand-fist-damage')?.count

    expect(count(5)).toBe(4)
    expect(count(6)).toBe(6)
    expect(count(6, true)).toBe(12)
  })

  it('derives the critical recipe from the selected Host roll-mode die', () => {
    const activity = arcaneHandFist()
    const targetIds = ['target']
    const critical = (values: readonly number[], mode: 'normal' | 'advantage' | 'disadvantage') =>
      dnd5eActivitySubmittedAttackRollIsCriticalV1(activity, {
        targetIds,
        rolls: { 'arcane-hand-fist-d20:target': { values } },
        hostRollMode: () => mode,
      })

    expect(critical([7, 20], 'normal')).toBe(false)
    expect(critical([7, 20], 'advantage')).toBe(true)
    expect(critical([7, 20], 'disadvantage')).toBe(false)
    expect(critical([20, 7], 'normal')).toBe(true)
  })

  it('derives per-target attack success keys for dependent saving throws', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1,
      id: 'attack-then-save',
      name: 'Attack then save',
      activation: { kind: 'action', cost: 1 },
      target: { kind: 'creature', relation: 'enemy', rangeFeet: 5, count: 2 },
      checks: [{
        id: 'spell-attack', kind: 'attack-roll', rollId: 'spell-attack-d20',
        attackBonus: { kind: 'reference', reference: { kind: 'actor-spell-attack-bonus' } },
        rollMode: 'host-derived', delivery: 'melee', scope: 'per-target',
      }],
      outcomes: [],
      automation: automationCapabilityFromLegacyStatus('full'),
    }
    const caster = actor('caster', 'player')
    const missed = actor('missed', 'dm')
    missed.armorClass = 18
    const hit = actor('hit', 'dm')
    hit.armorClass = 18

    const successes = dnd5eActivitySubmittedAttackCheckSuccessKeysV1(activity, {
      actor: caster,
      targets: [missed, hit],
      rolls: {
        'spell-attack-d20:missed': { values: [6] },
        'spell-attack-d20:hit': { values: [7] },
      },
      hostRollMode: () => 'normal',
    })

    expect([...successes]).toEqual(['spell-attack:hit'])
  })

  it('settles a 6th-level fist with six damage dice and a critical with twelve', () => {
    const activity = arcaneHandFist()
    const caster = actor('caster', 'player')
    const target = actor('target', 'dm')
    const settle = (d20: number, damageDice: readonly number[]) => resolveDnd5eActivity({
      activity,
      actor: caster,
      targets: [target],
      castLevel: 6,
      rolls: {
        'arcane-hand-fist-d20:target': { values: [d20, 1] },
        'arcane-hand-fist-damage': { values: damageDice },
      },
      checkRollModes: { 'spell-attack:target': 'normal' },
      distanceFeetByTargetId: { target: 5 },
      allowCriticalDiceSuperset: d20 === 20,
    })

    const ordinary = settle(10, [1, 2, 3, 4, 5, 6])
    expect(ordinary.ok, ordinary.ok ? undefined : ordinary.details.join('; ')).toBe(true)
    if (ordinary.ok) {
      expect(ordinary.proposals).toContainEqual(expect.objectContaining({
        kind: 'deal-damage', amount: 21,
      }))
    }

    const critical = settle(20, Array.from({ length: 12 }, () => 2))
    expect(critical.ok, critical.ok ? undefined : critical.details.join('; ')).toBe(true)
    if (critical.ok) {
      expect(critical.proposals).toContainEqual(expect.objectContaining({
        kind: 'deal-damage', amount: 24,
      }))
    }
  })
})


it('keeps attack success and critical recipes aligned with a Host-negated disadvantage roll', () => {
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'luck-attack', name: 'Luck attack',
    activation: { kind: 'action' }, target: { kind: 'creature', relation: 'any', count: 1 },
    automation: automationCapabilityFromLegacyStatus('full'), outcomes: [],
    checks: [{ id: 'attack', kind: 'attack-roll', rollId: 'attack', scope: 'per-target', rollMode: 'disadvantage', attackBonus: { kind: 'constant', value: 0 } }],
  }
  const input = { actor: actor('actor', 'player'), targets: [actor('target', 'dm')], targetIds: ['target'],
    rolls: { 'attack:target': { values: [20] } }, hostRollMode: () => 'disadvantage' as const }
  expect(dnd5eActivitySubmittedAttackRollIsCriticalV1(activity, input)).toBe(false)
  expect(dnd5eActivitySubmittedAttackCheckSuccessKeysV1(activity, input).size).toBe(0)
  const selected = { ...input, negatedRollIds: new Set(['attack:target']) }
  expect(dnd5eActivitySubmittedAttackRollIsCriticalV1(activity, selected)).toBe(true)
  expect([...dnd5eActivitySubmittedAttackCheckSuccessKeysV1(activity, selected)]).toEqual(['attack:target'])
})
