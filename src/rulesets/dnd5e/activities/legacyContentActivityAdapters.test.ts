import { describe, expect, it } from 'vitest'
import type { DeclarativeSubclassAbilityV1 } from '../declarativeSubclassAbility'
import type { Dnd5eMonsterAction } from '../monsters'
import type { Dnd5ePluginSpellDefinition } from '../pluginApi'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import { resolveDnd5eActivity, type Dnd5eActivityActorSnapshot } from './dnd5eActivityExecutor'
import { dnd5eActivityFromCustomHeadlessAction } from './legacyCustomHeadlessActivityAdapter'
import {
  dnd5eActivityFromDeclarativeSubclassAbility,
  dnd5eActivityFromMonsterAction,
  dnd5eActivityFromSpellDefinition,
} from './legacyContentActivityAdapters'

function damageSpell(): Dnd5ePluginSpellDefinition {
  return {
    id: 'ember-wave',
    name: 'Ember Wave',
    level: 3,
    school: 'evocation',
    ritual: false,
    castingTime: { value: 1, unit: 'action' },
    range: { type: 'distance', feet: 150, shape: 'sphere', sizeFeet: 20 },
    targeting: { relation: 'enemy', maximumTargets: 64 },
    components: { verbal: true, somatic: true, material: false },
    duration: { type: 'instantaneous', concentration: false },
    classes: ['wizard'],
    description: 'Synthetic spell.',
    mechanics: {
      kind: 'damage',
      resolution: 'saving-throw',
      savingThrow: { ability: 'dex', onSuccess: 'half' },
      damage: { dice: { count: 8, sides: 6, bonus: 0 }, type: 'fire' },
    },
    automation: { mode: 'headless-action', actionId: 'ember-wave-action' },
  }
}

describe('legacy content Activity adapters', () => {
  it('projects a normal save spell without a spell-specific resolver', () => {
    const activity = dnd5eActivityFromSpellDefinition(damageSpell(), 'headless-action')
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    expect(activity).toMatchObject({
      id: 'spell:ember-wave',
      target: { kind: 'area', shape: 'sphere', radiusFeet: 20, placeRangeFeet: 150 },
      automation: { level: 'full' },
    })
    expect(activity.outcomes.map((outcome) => outcome.when)).toEqual([
      { kind: 'check', checkId: 'spell-save', result: 'failure' },
      { kind: 'check', checkId: 'spell-save', result: 'success' },
    ])
  })

  it('keeps the owning save gate when a linked Headless action supplies the effects', () => {
    const linked = dnd5eActivityFromCustomHeadlessAction({
      id: 'ember-wave-action', label: 'Ember Wave effects',
      effects: [{ kind: 'damage', dice: { count: 8, sides: 6 }, damageType: 'fire' }],
    })
    const activity = dnd5eActivityFromSpellDefinition(damageSpell(), 'headless-action', linked)
    expect(activity.checks).toContainEqual(expect.objectContaining({ id: 'spell-save', kind: 'saving-throw' }))
    expect(activity.outcomes.map((outcome) => outcome.when)).toEqual([
      { kind: 'check', checkId: 'spell-save', result: 'failure' },
      { kind: 'check', checkId: 'spell-save', result: 'success' },
    ])
    expect(activity.outcomes[0]?.operations[0]).toMatchObject({ kind: 'damage', target: 'target' })

    const actor: Dnd5eActivityActorSnapshot = {
      id: 'actor', controller: 'players', level: 5, proficiencyBonus: 3,
      abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
      armorClass: 12, currentHp: 30, maxHp: 30, conditions: [], spellSaveDc: 15,
    }
    const targets: Dnd5eActivityActorSnapshot[] = [
      { ...actor, id: 'failed', controller: 'dm', currentHp: 20, maxHp: 20, savingThrowModifiers: { dex: 0 } },
      { ...actor, id: 'passed', controller: 'dm', currentHp: 20, maxHp: 20, savingThrowModifiers: { dex: 0 } },
    ]
    const result = resolveDnd5eActivity({
      activity, actor, targets,
      areaPlacement: { x: 100, y: 100 }, areaPlacementDistanceFeet: 120,
      checkRollModes: { 'spell-save:failed': 'normal', 'spell-save:passed': 'normal' },
      rolls: {
        'spell-save-d20:failed': { values: [5] },
        'spell-save-d20:passed': { values: [18] },
        'effect-0': { values: [1, 2, 3, 4, 5, 6, 1, 2] },
      },
    })
    expect(result).toMatchObject({
      ok: true,
      proposals: [
        { kind: 'deal-damage', targetId: 'failed', amount: 24 },
        { kind: 'deal-damage', targetId: 'passed', amount: 12 },
      ],
    })
  })

  it('projects explicit cantrip thresholds into the shared Activity scaling recipe', () => {
    const spell: Dnd5ePluginSpellDefinition = {
      ...damageSpell(),
      id: 'resonant-pulse',
      name: 'Resonant Pulse',
      level: 0,
      range: { type: 'distance', feet: 60 },
      targeting: { relation: 'enemy', maximumTargets: 1 },
      mechanics: {
        kind: 'damage',
        resolution: 'automatic',
        damage: {
          dice: { count: 1, sides: 6, bonus: 0 },
          type: 'thunder',
          cantripScaling: {
            basis: 'character-level',
            steps: [
              { level: 5, diceCount: 1 },
              { level: 11, diceCount: 1, flatDamage: 2 },
              { level: 17, diceCount: 1 },
            ],
          },
        },
      },
      automation: { mode: 'headless-action', actionId: 'resonant-pulse' },
    }
    const activity = dnd5eActivityFromSpellDefinition(spell, 'headless-action')
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    expect(activity.automation.level).toBe('full')
    expect(activity.scaling).toEqual([
      {
        basis: 'custom-table',
        table: [{ level: 1, value: 0 }, { level: 5, value: 1 }],
        adjustments: [{ operationId: 'spell-damage', diceCountPerStep: 1 }],
      },
      {
        basis: 'custom-table',
        table: [{ level: 1, value: 0 }, { level: 11, value: 1 }],
        adjustments: [{ operationId: 'spell-damage', diceCountPerStep: 1, flatAmountPerStep: 2 }],
      },
      {
        basis: 'custom-table',
        table: [{ level: 1, value: 0 }, { level: 17, value: 1 }],
        adjustments: [{ operationId: 'spell-damage', diceCountPerStep: 1 }],
      },
    ])

    const actor: Dnd5eActivityActorSnapshot = {
      id: 'actor', controller: 'players', level: 11, proficiencyBonus: 4,
      abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
      armorClass: 12, currentHp: 30, maxHp: 30, conditions: [],
    }
    const target: Dnd5eActivityActorSnapshot = {
      ...actor, id: 'target', controller: 'dm', currentHp: 30, maxHp: 30,
    }
    const result = resolveDnd5eActivity({
      activity, actor, targets: [target],
      distanceFeetByTargetId: { target: 30 },
      rolls: { 'spell-damage': { values: [1, 2, 3] } },
    })
    expect(result).toMatchObject({
      ok: true,
      proposals: [{ kind: 'deal-damage', targetId: 'target', amount: 8 }],
    })
  })

  it('projects higher-slot damage onto both failed-save and successful-save outcomes', () => {
    const base = damageSpell()
    const activity = dnd5eActivityFromSpellDefinition({
      ...base,
      mechanics: {
        ...base.mechanics!,
        kind: 'damage',
        upcast: {
          fromSlotLevel: 3,
          effects: [
            { kind: 'damage-dice', diceCountPerSlot: 1 },
            { kind: 'flat-damage', amountPerSlot: 2 },
          ],
        },
      },
    }, 'headless-action')
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    expect(activity.automation.level).toBe('full')
    expect(activity.scaling).toEqual([{
      basis: 'slot-level',
      baseLevel: 3,
      adjustments: [
        { operationId: 'spell-damage', diceCountPerStep: 1 },
        { operationId: 'spell-damage-save-success', diceCountPerStep: 1 },
        { operationId: 'spell-damage', flatAmountPerStep: 2 },
        { operationId: 'spell-damage-save-success', flatAmountPerStep: 2 },
      ],
    }])
  })

  it('projects generic subclass rolls/effects while flagging special mechanics', () => {
    const ability: DeclarativeSubclassAbilityV1 = {
      schemaVersion: 1,
      id: 'measured-strike',
      name: 'Measured Strike',
      description: 'Synthetic feature.',
      level: 3,
      trigger: { kind: 'after-attack-hit' },
      predicates: { classId: 'fighter', minimumLevel: 3, oncePerTurn: true },
      cost: { resources: [{ resourceId: 'focus', amount: 1 }] },
      targeting: { kind: 'single-creature', relation: 'enemy', rangeFeet: 5 },
      rolls: [{ id: 'extra', kind: 'damage', label: 'Extra', dice: { count: 1, sides: 6 }, damageType: 'parent-weapon' }],
      effects: [{ kind: 'damage', target: 'target', rollId: 'extra' }],
      mechanic: { kind: 'combat-maneuver', operation: 'push-on-hit', resourceId: 'focus', superiorityRollId: 'extra' },
      automation: 'full',
    }
    const activity = dnd5eActivityFromDeclarativeSubclassAbility(ability)
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    expect(activity.automation.level).toBe('assisted')
    expect(activity.triggers?.[0]).toMatchObject({ event: 'on-hit', decision: 'actor-choice' })
    expect(activity.outcomes[0]?.operations).toContainEqual(expect.objectContaining({ kind: 'manual-adjudication' }))
  })

  it('projects multiattack as calls to ordinary monster Activities', () => {
    const action: Dnd5eMonsterAction = {
      id: 'double-claw',
      name: 'Double Claw',
      description: 'Synthetic multiattack.',
      kind: 'multiattack',
      automation: 'headless',
      sequence: ['claw', 'claw'],
    }
    const activity = dnd5eActivityFromMonsterAction({ id: 'room-monster:test', name: 'Test' }, action)
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    expect(activity.outcomes[0]?.operations).toEqual([
      expect.objectContaining({ kind: 'invoke-activity', activityId: 'monster:room-monster:test:claw' }),
      expect.objectContaining({ kind: 'invoke-activity', activityId: 'monster:room-monster:test:claw' }),
    ])
  })
})
