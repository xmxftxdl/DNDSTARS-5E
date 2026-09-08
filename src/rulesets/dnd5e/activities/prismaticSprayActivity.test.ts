import { describe, expect, it } from 'vitest'
import { dnd5eSrdAuditedSpellActivityV1 } from './dnd5eSrdAuditedSpellActivities'
import { compileDnd5eActivityHeadlessAction } from './dnd5eActivityHeadlessCompiler'
import { resolveDnd5eActivity, type Dnd5eActivityActorSnapshot } from './dnd5eActivityExecutor'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import { filterDnd5eConditionalActivityRollDeclarationsV1 } from './dnd5eActivityPerTargetRolls'
import { dnd5ePluginDiceRollDeclarationsForTargets } from '../pluginDice'

const abilities = { str: 10, dex: 14, con: 14, int: 18, wis: 12, cha: 10 } as const
const actor: Dnd5eActivityActorSnapshot = {
  id: 'wizard', name: '塑能法师', controller: 'players', level: 13, proficiencyBonus: 5,
  abilities, armorClass: 15, currentHp: 70, maxHp: 70, conditions: [], spellSaveDc: 18,
}
const target: Dnd5eActivityActorSnapshot = {
  id: 'target', name: '目标', controller: 'dm', level: 8, proficiencyBonus: 3,
  abilities, armorClass: 14, currentHp: 80, maxHp: 80, conditions: [],
  savingThrowModifiers: { dex: 2 },
}

function activity() {
  const value = dnd5eSrdAuditedSpellActivityV1('prismatic-spray')
  if (!value) throw new Error('prismatic spray activity is missing')
  return value
}

describe('虹光喷射 Activity', () => {
  it('declares a save followed by a per-target d8 and only opens matching chained rolls', () => {
    const definition = activity()
    expect(validateDnd5eActivityDefinitionV1(definition)).toEqual([])
    const compiled = compileDnd5eActivityHeadlessAction(definition, { outerSpellTransaction: true })
    const declarations = dnd5ePluginDiceRollDeclarationsForTargets({
      rolls: [], perTargetRolls: compiled.perTargetRolls,
    }, [target])
    expect(declarations.slice(0, 2)).toEqual([
      expect.objectContaining({ id: 'spell-save-d20:target', sides: 20 }),
      expect.objectContaining({ id: 'prismatic-ray-d8:target', sides: 8 }),
    ])

    const conditional = declarations.filter((entry) =>
      entry.id !== 'spell-save-d20:target' && entry.id !== 'prismatic-ray-d8:target')
    expect(filterDnd5eConditionalActivityRollDeclarationsV1({
      activity: definition,
      declarations: conditional,
      successfulCheckKeys: new Set(),
      rolls: { 'prismatic-ray-d8:target': { total: 8 } },
    }).map((entry) => entry.id)).toEqual([
      'prismatic-extra-ray-a-d8:target',
      'prismatic-extra-ray-b-d8:target',
    ])
  })

  it('applies the selected damage type, with half damage on a successful Dexterity save', () => {
    const definition = activity()
    const failed = resolveDnd5eActivity({
      activity: definition, actor, targets: [target],
      rolls: {
        'spell-save-d20:target': { values: [5] },
        'prismatic-ray-d8:target': { values: [1] },
        'prismatic-primary-damage-d6:target': { values: Array(10).fill(6) },
      },
      checkRollModes: { 'spell-save:target': 'normal' },
      areaPlacement: { x: 0, y: 0 }, areaPlacementDistanceFeet: 0,
    })
    if (!failed.ok) throw new Error(`${failed.reason}: ${failed.details.join('; ')}`)
    expect(failed).toMatchObject({
      ok: true,
      proposals: [{ kind: 'deal-damage', targetId: 'target', amount: 60, damageType: 'fire' }],
    })

    const succeeded = resolveDnd5eActivity({
      activity: definition, actor, targets: [target],
      rolls: {
        'spell-save-d20:target': { values: [20] },
        'prismatic-ray-d8:target': { values: [5] },
        'prismatic-primary-damage-d6:target': { values: Array(10).fill(5) },
      },
      checkRollModes: { 'spell-save:target': 'normal' },
      areaPlacement: { x: 0, y: 0 }, areaPlacementDistanceFeet: 0,
    })
    if (!succeeded.ok) throw new Error(`${succeeded.reason}: ${succeeded.details.join('; ')}`)
    expect(succeeded).toMatchObject({
      ok: true,
      proposals: [{ kind: 'deal-damage', targetId: 'target', amount: 25, damageType: 'cold' }],
    })
  })

  it('turns an 8 into two non-8 rays and creates the indigo and violet status tracks', () => {
    const resolved = resolveDnd5eActivity({
      activity: activity(), actor, targets: [target],
      rolls: {
        'spell-save-d20:target': { values: [5] },
        'prismatic-ray-d8:target': { values: [8] },
        'prismatic-extra-ray-a-d8:target': { values: [6] },
        'prismatic-extra-ray-b-d8:target': { values: [7] },
      },
      checkRollModes: { 'spell-save:target': 'normal' },
      areaPlacement: { x: 0, y: 0 }, areaPlacementDistanceFeet: 0,
    })
    if (!resolved.ok) throw new Error(`${resolved.reason}: ${resolved.details.join('; ')}`)
    expect(resolved).toMatchObject({ ok: true })
    expect(resolved.proposals).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'apply-effect', effectId: 'prismatic-spray-indigo', conditions: ['restrained'],
        duration: expect.objectContaining({ successesRequired: 3, failuresRequired: 3 }),
      }),
      expect.objectContaining({
        kind: 'apply-effect', effectId: 'prismatic-spray-violet', conditions: ['blinded'],
        extensionCondition: 'prismatic-spray-violet-dm-planar-destination',
      }),
    ]))
  })
})
