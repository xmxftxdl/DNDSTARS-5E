import { describe, expect, it } from 'vitest'
import { resolveDnd5eActivity, type Dnd5eActivityActorSnapshot } from './activities/dnd5eActivityExecutor'
import { dnd5eSrdAuditedSpellActivityV1 } from './activities/dnd5eSrdAuditedSpellActivities'
import { validateDnd5eActivityDefinitionV1 } from './activities/dnd5eActivityValidation'
import { dnd5eActivityAutomationAnalysisV1 } from './plugins/pluginMechanicsRegistry'
import { dnd5eSpellUsesNarrativeResolution } from './spellNarrativeResolution'

const abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }

const actor: Dnd5eActivityActorSnapshot = {
  id: 'plane-shift-caster', controller: 'players', level: 20, proficiencyBonus: 6,
  abilities, armorClass: 12, conditions: [], currentHp: 100, maxHp: 100,
  spellSaveDc: 18, spellAttackBonus: 10,
}

const target: Dnd5eActivityActorSnapshot = {
  id: 'plane-shift-target', controller: 'dm', level: 10, proficiencyBonus: 4,
  abilities, armorClass: 16, conditions: [], currentHp: 80, maxHp: 80,
}

function activity() {
  const value = dnd5eSrdAuditedSpellActivityV1('plane-shift')
  if (!value) throw new Error('Plane Shift Activity is unavailable')
  return value
}

function hostileRolls(attackD20: number, saveD20?: number) {
  return resolveDnd5eActivity({
    activity: activity(), actor, targets: [target], castLevel: 7,
    choices: { mode: 'hostile-banishment' },
    distanceFeetByTargetId: { [target.id]: 5 },
    checkRollModes: {
      [`spell-attack:${target.id}`]: 'normal',
      [`spell-save:${target.id}`]: 'normal',
    },
    rolls: {
      [`spell-attack-d20:${target.id}`]: { values: [attackD20] },
      ...(saveD20 == null ? {} : {
        [`spell-save-d20:${target.id}`]: { values: [saveD20] },
      }),
    },
  })
}

describe('Plane Shift audited Activity', () => {
  it('offers direct willing travel and attack-then-save hostile banishment', () => {
    const value = activity()

    expect(validateDnd5eActivityDefinitionV1(value)).toEqual([])
    expect(value.choices).toEqual([expect.objectContaining({
      id: 'mode',
      options: [
        expect.objectContaining({
          id: 'willing-travel', label: '友方传送', targetOverride: { kind: 'self' },
        }),
        expect.objectContaining({
          id: 'hostile-banishment', label: '敌方传送',
          targetOverride: expect.objectContaining({
            kind: 'creature', relation: 'enemy', rangeFeet: 5, count: 1,
          }),
        }),
      ],
    })])
    expect(value.checks).toEqual([
      expect.objectContaining({
        id: 'spell-attack', kind: 'attack-roll', delivery: 'melee', scope: 'per-target',
        appliesWhenChoice: { choiceId: 'mode', optionIds: ['hostile-banishment'] },
      }),
      expect.objectContaining({
        id: 'spell-save', kind: 'saving-throw', ability: 'cha', scope: 'per-target',
        appliesWhenChoice: { choiceId: 'mode', optionIds: ['hostile-banishment'] },
        appliesWhenCheck: { checkId: 'spell-attack', result: 'success' },
      }),
    ])
    expect(value.effects).toContainEqual(expect.objectContaining({
      id: 'plane-shift-transferred',
      name: '异界传送：已被传送',
      duration: { kind: 'permanent' },
      extensionCondition: 'plane-shifted',
    }))
    expect(value.outcomes).toContainEqual(expect.objectContaining({
      when: {
        kind: 'all',
        conditions: [
          { kind: 'choice', choiceId: 'mode', optionId: 'hostile-banishment' },
          { kind: 'check', checkId: 'spell-attack', result: 'success' },
          { kind: 'check', checkId: 'spell-save', result: 'failure' },
        ],
      },
      operations: [expect.objectContaining({
        kind: 'apply-effect', target: 'target', effectId: 'plane-shift-transferred',
      })],
    }))
    const operations = value.outcomes.flatMap((outcome) => outcome.operations)
    expect(operations.some((operation) => operation.kind === 'manual-adjudication')).toBe(false)
    expect(dnd5eActivityAutomationAnalysisV1(value).capability.level).toBe('full')
    expect(dnd5eSpellUsesNarrativeResolution('plane-shift', value)).toBe(false)
  })

  it('settles willing travel without a creature target, attack roll, or saving throw', () => {
    const result = resolveDnd5eActivity({
      activity: activity(), actor, targets: [actor], castLevel: 7,
      choices: { mode: 'willing-travel' },
      distanceFeetByTargetId: { [actor.id]: 0 },
      rolls: {},
    })

    expect(result).toMatchObject({ ok: true, checks: [], proposals: [] })
  })

  it('does not request or resolve the Charisma save when the melee spell attack misses', () => {
    const result = hostileRolls(5)

    expect(result).toMatchObject({
      ok: true,
      checks: [expect.objectContaining({ checkId: 'spell-attack', success: false })],
      proposals: [],
    })
  })

  it('resolves the Charisma save only after a hit and transports only on a failed save', () => {
    const saved = hostileRolls(10, 20)
    expect(saved).toMatchObject({
      ok: true,
      checks: [
        expect.objectContaining({ checkId: 'spell-attack', success: true }),
        expect.objectContaining({ checkId: 'spell-save', success: true }),
      ],
      proposals: [],
    })

    const failed = hostileRolls(10, 1)
    expect(failed).toMatchObject({
      ok: true,
      checks: [
        expect.objectContaining({ checkId: 'spell-attack', success: true }),
        expect.objectContaining({ checkId: 'spell-save', success: false }),
      ],
      proposals: [expect.objectContaining({
        kind: 'apply-effect', targetId: target.id,
        effectId: 'plane-shift-transferred', extensionCondition: 'plane-shifted',
      })],
    })
  })
})
