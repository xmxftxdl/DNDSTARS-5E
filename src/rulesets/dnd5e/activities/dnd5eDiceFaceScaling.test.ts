import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { resolveDnd5eActivity, type Dnd5eActivityActorSnapshot } from './dnd5eActivityExecutor'
import { collectScaledDnd5eActivityFormulaRollDeclarationsV1 } from './dnd5eActivityRollRecipe'
import { scaleDnd5eActivityDefinitionV1 } from './dnd5eActivityScaling'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'

const actor: Dnd5eActivityActorSnapshot = { id: 'actor', controller: 'player', level: 20, proficiencyBonus: 6,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, armorClass: 10, conditions: [], currentHp: 10, maxHp: 100 }
function definition(): Dnd5eActivityDefinitionV1 {
  return { schemaVersion: 1, id: 'tiered-dice', name: 'Synthetic die progression', activation: { kind: 'free' }, target: { kind: 'self' },
    automation: automationCapabilityFromLegacyStatus('full'),
    scaling: [{ basis: 'custom-table', classId: 'monk', table: [{ level: 3, value: 0 }, { level: 5, value: 1 }, { level: 10, value: 2 }],
      adjustments: [{ operationId: 'heal', diceSidesPerStep: 2 }] }],
    outcomes: [{ id: 'heal', when: { kind: 'always' }, operations: [{ id: 'heal', kind: 'healing', target: 'actor', amount: { kind: 'add', values: [
      // A nested nondice expression must not intercept the first dice pool.
      { kind: 'floor', value: { kind: 'constant', value: 2.5 } },
      { kind: 'clamp', minimum: 0, value: { kind: 'dice', rollId: 'growing', count: 1, sides: 4 } },
      { kind: 'dice', rollId: 'fixed', count: 1, sides: 6 },
    ] } }] }],
  }
}

it.each([0, 3, 4, 5, 9, 10, 20])('uses class-tier faces in both the requested dice and accepted healing (%s)', level => {
  const activity = definition(), original = structuredClone(activity)
  const owner = { ...actor, classLevels: { monk: level, wizard: 20 - level } }
  const sides = level >= 10 ? 8 : level >= 5 ? 6 : 4
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  expect(collectScaledDnd5eActivityFormulaRollDeclarationsV1(activity, { scaling: { actor: owner } }))
    .toEqual([{ id: 'growing', count: 1, sides }, { id: 'fixed', count: 1, sides: 6 }])
  const input = { activity, actor: owner, targets: [owner], rolls: { growing: { values: [sides] }, fixed: { values: [6] } } }
  const result = resolveDnd5eActivity(input)
  expect(result).toMatchObject({ ok: true, proposals: [expect.objectContaining({ amount: sides + 8 })] })
  expect(resolveDnd5eActivity({ ...input, rolls: { ...input.rolls, growing: { values: [sides + 1] } } }).ok).toBe(false)
  expect(activity).toEqual(original)
})

it('persists scaled area damage and healing dice instead of requesting creation-time rolls', () => {
  const activity = definition()
  activity.target = { kind: 'area', relation: 'any', origin: 'point', shape: 'cube', lengthFeet: 5, widthFeet: 5, heightFeet: 5, placeRangeFeet: 60 }
  activity.outcomes[0].operations = [{ id: 'heal', kind: 'create-persistent-area', label: 'Synthetic zone', durationRounds: 10, concentration: true,
    triggers: [{ id: 'damage', label: 'Damage', timing: 'turn-end', oncePerTurn: true, damage: { count: 1, sides: 4, type: 'fire' } },
      { id: 'healing', label: 'Healing', timing: 'turn-start', oncePerTurn: true, healing: { amount: 2, dice: { count: 1, sides: 6 } } }] }]
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  const owner = { ...actor, classLevels: { monk: 10 } }
  expect(collectScaledDnd5eActivityFormulaRollDeclarationsV1(activity, { scaling: { actor: owner } })).toEqual([])
  const result = resolveDnd5eActivity({ activity, actor: owner, targets: [], areaPlacement: { x: 5, y: 5 }, areaPlacementDistanceFeet: 10, rolls: {} })
  expect(result).toMatchObject({ ok: true, proposals: [expect.objectContaining({ triggers: [
    expect.objectContaining({ damage: { count: 1, sides: 8, type: 'fire', modifier: 0 } }),
    expect.objectContaining({ healing: { amount: 2, dice: { count: 1, sides: 10 } } }),
  ] })] })
})

it('retains effect periodic, save-failure, and on-hit dice face progression across serialization', () => {
  const activity = definition()
  activity.outcomes[0].operations = [{ id: 'heal', kind: 'apply-effect', effectId: 'rider', target: 'actor' }]
  activity.effects = [{ schemaVersion: 1, id: 'rider', name: 'Synthetic rider', stacking: 'replace',
    duration: { kind: 'save-ends', timing: 'target-turn-end', ability: 'con', dc: { kind: 'constant', value: 12 }, maximumRounds: 10,
      damageOnFailure: { count: 1, sides: 4, type: 'cold' } },
    periodicDamage: { timing: 'target-turn-start', count: 1, sides: 6, type: 'fire' },
    modifiers: [{ kind: 'on-hit-bonus-damage', appliesTo: 'all-weapon-attacks', damageType: 'fire', amount: { kind: 'dice', rollId: 'bonus', count: 1, sides: 8 } }],
  }]
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  const scaled = scaleDnd5eActivityDefinitionV1(JSON.parse(JSON.stringify(activity)), { actor: { ...actor, classLevels: { monk: 10 } } }).activity
  expect(scaled.effects![0]).toMatchObject({ duration: { damageOnFailure: { sides: 8 } }, periodicDamage: { sides: 10 }, modifiers: [{ amount: { sides: 12 } }] })
  expect(validateDnd5eActivityDefinitionV1(scaled)).toEqual([])
  expect(activity.effects[0].periodicDamage?.sides).toBe(6)
})

it.each([-1, 0.5, NaN, Infinity, 101, '2'])('rejects unsafe or untyped face increments (%s)', increment => {
  const activity = definition()
  Object.assign(activity.scaling![0].adjustments![0], { diceSidesPerStep: increment })
  expect(validateDnd5eActivityDefinitionV1(activity).join(' ')).toContain('diceSidesPerStep must be a nonnegative integer')
})

it('rejects resizing a constant-only operation and overflow rather than silently changing the rule', () => {
  const activity = definition()
  activity.outcomes[0].operations = [{ id: 'heal', kind: 'healing', target: 'actor', amount: { kind: 'constant', value: 3 } }]
  expect(validateDnd5eActivityDefinitionV1(activity).join(' ')).toContain('requires declared dice')
  activity.outcomes[0].operations = [{ id: 'heal', kind: 'healing', target: 'actor', amount: { kind: 'dice', rollId: 'large', count: 1, sides: 10_000 } }]
  expect(() => scaleDnd5eActivityDefinitionV1(activity, { actor: { ...actor, classLevels: { monk: 10 } } })).toThrow('activity-scaled-die-sides-invalid')
})

it('does not let progression override actual weapon dice or damage-type lookup tables', () => {
  const activity = definition()
  activity.outcomes[0].operations = [{ id: 'heal', kind: 'damage', target: 'target', amount: { kind: 'constant', value: 0 },
    damageType: 'inherit-primary', weaponDiceFromTrigger: { rollId: 'weapon', count: 1 } }]
  expect(validateDnd5eActivityDefinitionV1(activity).join(' ')).toContain('cannot resize authoritative weapon dice')
  activity.outcomes[0].operations = [{ id: 'heal', kind: 'damage', target: 'target', amount: { kind: 'dice', rollId: 'type', count: 1, sides: 2 },
    damageType: 'fire', damageTypeFromRoll: { rollId: 'type', indexChoiceId: 'index', types: ['fire', 'cold'] } }]
  expect(validateDnd5eActivityDefinitionV1(activity).join(' ')).toContain('cannot resize authoritative weapon dice or damage-type lookup dice')
})
